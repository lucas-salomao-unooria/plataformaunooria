import { HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AGENTE_PROFESSOR,
  AgenteIndisponivel,
  SessaoInexistente,
  type AgenteProfessorPort,
  type EventoAgente,
} from "../ai/agente-professor.port";
import { QuotaService } from "../ai/quota.service";
import { habilidadePorCodigo } from "../curriculo/consulta";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import type { CodigoDeErro, NomeDoEvento } from "./contrato-de-rotas";
import {
  CHAVE_NOME_DO_PROFESSOR,
  DeduplicadorDeTexto,
  codigosInexistentes,
  extrairFontes,
  mensagensDaSessao,
  primeiroNome,
  somarTokens,
  tituloDoEstado,
} from "./regras";

/**
 * O agente de IA do professor, do lado da api: POSSE da conversa no Postgres,
 * condução do turno no Agent Engine (pela porta `AgenteProfessorPort`) e o SSE
 * para o hub. Contrato: `docs/regras/agente-professor.md`.
 *
 * **Nenhum texto do professor nem do agente vai a log** — só ids, contagens,
 * códigos de erro, duração e tokens. A redação do pino (`texto`, `mensagem`)
 * é rede, não licença.
 *
 * **Nenhuma transação `comTenancy` fica aberta durante o stream**: cada ida ao
 * banco é uma transação curta (posse antes, atualização depois). Um turno dura
 * dezenas de segundos, e segurar uma conexão do pool por turno esgotaria o pool
 * com vinte professores conversando.
 */

/** Quanto tempo a sessão é pedida ao engine, na criação e a cada mensagem. */
export const VIDA_DA_SESSAO_MS = 10 * 365 * 24 * 60 * 60_000;

/** Os tempos do stream. Propriedade de instância para o teste poder encurtá-los. */
export interface TemposDoStream {
  /** `: ping` — mantém vivos o LB e o proxy do hub quando o agente pensa em silêncio. */
  pingMs: number;
  /** Teto do turno na api (o Cloud Run do hub corta em 300 s). */
  tetoMs: number;
}

/** O pedaço do `Response` do express que o SSE usa — o teste o imita. */
export interface RespostaSse {
  statusCode: number;
  headersSent: boolean;
  writableEnded: boolean;
  setHeader(nome: string, valor: string): unknown;
  flushHeaders(): void;
  write(pedaco: string): boolean;
  end(): unknown;
  on(evento: "close", cb: () => void): unknown;
}

export interface ConversaDaPosse {
  id: string;
  sessaoId: string;
  titulo: string | null;
}

interface Quem {
  escolaId: string;
  usuarioId: string;
}

const MENSAGENS_DE_ERRO: Record<CodigoDeErro, string> = {
  QUOTA: "Você usou toda a cota de IA de hoje. Ela renova amanhã.",
  RATE_LIMIT: "Muitas mensagens seguidas. Espere um instante e tente de novo.",
  AGENTE_INDISPONIVEL: "O agente de IA do professor não respondeu agora. Tente de novo em instantes.",
  TEMPO_ESGOTADO: "A resposta demorou demais e foi interrompida. Tente de novo, talvez com uma pergunta mais curta.",
};

/** Erro JSON ANTES do stream (429, 503) — o mesmo `{ codigo, mensagem }` do evento `erro`. */
export function erroJson(codigo: CodigoDeErro, status: number, extra?: Record<string, unknown>): HttpException {
  return new HttpException({ codigo, mensagem: MENSAGENS_DE_ERRO[codigo], ...extra }, status);
}

function conversaInexistente(): NotFoundException {
  /* 404 também para a conversa de OUTRO professor, nunca 403: 403 confirmaria
     que o id existe. */
  return new NotFoundException({ codigo: "conversa-inexistente", mensagem: "Conversa não encontrada." });
}

/** O agente fora do ar vira 503 com o código do contrato; o resto sobe intacto. */
function traduzir(erro: unknown): unknown {
  if (erro instanceof AgenteIndisponivel) {
    logger.warn(
      { codigo: "agente-professor.indisponivel", status: erro.status, ...(erro.status ? {} : { detalhe: erro.detalhe }) },
      "o agente de IA do professor não respondeu",
    );
    return erroJson("AGENTE_INDISPONIVEL", 503);
  }
  return erro;
}

/** Escreve o `text/event-stream`. Cada `data:` é UMA linha de JSON (o JSON escapa `\n`). */
class EscritorSse {
  constructor(private readonly res: RespostaSse) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    /* `no-transform`: proxy nenhum comprime nem reagrupa o fluxo. */
    res.setHeader("cache-control", "no-cache, no-transform");
    /* O buffering de um nginx no caminho seguraria os `delta` até o fim. */
    res.setHeader("x-accel-buffering", "no");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders();
  }

  get aberto(): boolean {
    return !this.res.writableEnded;
  }

  evento(nome: NomeDoEvento, dados: unknown): void {
    if (this.aberto) this.res.write(`event: ${nome}\ndata: ${JSON.stringify(dados)}\n\n`);
  }

  comentario(texto: string): void {
    if (this.aberto) this.res.write(`: ${texto}\n\n`);
  }

  encerrar(): void {
    if (this.aberto) this.res.end();
  }
}

@Injectable()
export class AgenteProfessorService {
  tempos: TemposDoStream = { pingMs: 15_000, tetoMs: 240_000 };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENTE_PROFESSOR) private readonly agente: AgenteProfessorPort,
    private readonly quota: QuotaService,
  ) {}

  /** As conversas do professor NA ESCOLA ATIVA, a mais recente primeiro. */
  async listar({ escolaId, usuarioId }: Quem) {
    const linhas = await this.prisma.comTenancy(
      (tx) =>
        tx.agenteProfessorConversa.findMany({
          where: { escolaId, usuarioId },
          orderBy: { atualizadaEm: "desc" },
          select: { id: true, titulo: true, criadaEm: true, atualizadaEm: true },
        }),
      escolaId,
    );
    return linhas.map((l) => ({
      id: l.id,
      titulo: l.titulo,
      criadaEm: l.criadaEm.toISOString(),
      atualizadaEm: l.atualizadaEm.toISOString(),
    }));
  }

  /**
   * Cria a sessão no engine e a linha da posse. O primeiro nome vem do BANCO
   * (`users.display_name`), nunca do cliente: é o `nome_professor` do estado,
   * lido pela instrução do agente.
   */
  async criar({ escolaId, usuarioId }: Quem): Promise<{ id: string }> {
    /* `users` fica fora da RLS (é lido no login, antes de haver escola). */
    const usuario = await this.prisma.user.findUnique({ where: { id: usuarioId }, select: { displayName: true } });
    const nome = primeiroNome(usuario?.displayName);
    const estado = nome ? { [CHAVE_NOME_DO_PROFESSOR]: nome } : {};

    let sessaoId: string;
    try {
      ({ sessaoId } = await this.agente.criarSessao(usuarioId, estado, new Date(Date.now() + VIDA_DA_SESSAO_MS)));
    } catch (erro) {
      throw traduzir(erro);
    }

    try {
      const linha = await this.prisma.comTenancy(
        (tx) => tx.agenteProfessorConversa.create({ data: { escolaId, usuarioId, sessaoId }, select: { id: true } }),
        escolaId,
      );
      logger.info({ codigo: "agente-professor.conversa-criada", conversaId: linha.id }, "conversa criada");
      return linha;
    } catch (erro) {
      /* Sem a linha, a sessão fica órfã no engine — ninguém a alcança, mas ela
         EXISTE. Desfaz, sem deixar a falha da compensação esconder a original. */
      await this.agente.apagarSessao(usuarioId, sessaoId).catch(() => undefined);
      throw erro;
    }
  }

  /** A conversa, se for deste professor NESTA escola. Senão, 404. */
  async daPosse({ escolaId, usuarioId }: Quem, id: string): Promise<ConversaDaPosse> {
    const linha = await this.prisma.comTenancy(
      (tx) =>
        tx.agenteProfessorConversa.findFirst({
          where: { id, escolaId, usuarioId },
          select: { id: true, sessaoId: true, titulo: true },
        }),
      escolaId,
    );
    if (!linha) throw conversaInexistente();
    return linha;
  }

  /** Remove a linha — o conteúdo já não existe no engine, ou acabou de ser apagado. */
  private async removerLinha({ escolaId, usuarioId }: Quem, id: string): Promise<void> {
    await this.prisma.comTenancy(
      (tx) => tx.agenteProfessorConversa.deleteMany({ where: { id, escolaId, usuarioId } }),
      escolaId,
    );
  }

  async ler(quem: Quem, id: string) {
    const conversa = await this.daPosse(quem, id);
    let sessao;
    try {
      sessao = await this.agente.lerSessao(quem.usuarioId, conversa.sessaoId);
    } catch (erro) {
      if (erro instanceof SessaoInexistente) {
        /* A sessão expirou ou foi apagada fora da api: a linha é posse de nada.
           Some junto, para a lista não carregar uma conversa que não abre. */
        logger.warn({ codigo: "agente-professor.sessao-sumiu", conversaId: id }, "a sessão da conversa não existe mais no agente");
        await this.removerLinha(quem, id);
        throw conversaInexistente();
      }
      throw traduzir(erro);
    }

    /* Espelha o título, se o engine o tem e a coluna ainda não (o stream pode
       ter terminado sem o `state_delta`). A coluna é CACHE do estado. */
    let titulo = conversa.titulo;
    const doEstado = tituloDoEstado(sessao.estado);
    if (doEstado && doEstado !== titulo) {
      titulo = doEstado;
      await this.gravarDepoisDoTurno(quem, id, titulo, false).catch(() => undefined);
    }
    return { id, titulo, mensagens: mensagensDaSessao(sessao.eventos) };
  }

  /**
   * Apaga a sessão no engine E a linha. Se o engine estiver fora do ar, a linha
   * FICA e a resposta é 503: apagar só a linha deixaria a conversa guardada no
   * engine sem ninguém capaz de alcançá-la — o contrário do que o professor
   * pediu. Sessão que já não existe no engine não é erro.
   */
  async apagar(quem: Quem, id: string): Promise<void> {
    const conversa = await this.daPosse(quem, id);
    try {
      await this.agente.apagarSessao(quem.usuarioId, conversa.sessaoId);
    } catch (erro) {
      throw traduzir(erro);
    }
    await this.removerLinha(quem, id);
    logger.info({ codigo: "agente-professor.conversa-apagada", conversaId: id }, "conversa apagada");
  }

  async temSaldo({ escolaId, usuarioId }: Quem): Promise<boolean> {
    return this.quota.temSaldo(escolaId, usuarioId, "professor");
  }

  private async gravarDepoisDoTurno(quem: Quem, id: string, titulo: string | null, tocar: boolean): Promise<void> {
    if (!tocar && titulo === null) return;
    await this.prisma.comTenancy(
      (tx) =>
        tx.agenteProfessorConversa.updateMany({
          where: { id, escolaId: quem.escolaId, usuarioId: quem.usuarioId },
          data: { ...(tocar ? { atualizadaEm: new Date() } : {}), ...(titulo !== null ? { titulo } : {}) },
        }),
      quem.escolaId,
    );
  }

  /**
   * UM TURNO, em SSE. Quem chama já conferiu posse, rate limit e saldo — e
   * respondeu JSON se algum falhou. Daqui em diante tudo sai como evento.
   *
   * O stream termina em `fim` OU em `erro`, nunca nos dois.
   */
  async transmitir(quem: Quem, conversa: ConversaDaPosse, texto: string, res: RespostaSse): Promise<void> {
    const inicio = Date.now();
    const controle = new AbortController();
    let motivo: "cliente" | "tempo" | null = null;
    const sse = new EscritorSse(res);

    /* `close` da RESPOSTA, e não da requisição: no Node ≥ 16 o `close` da
       requisição dispara assim que o corpo foi lido — ANTES do stream
       começar —, e abortaria todo turno. O da resposta só dispara quando o
       socket fecha; se ela ainda não terminou, foi o professor fechando o painel. */
    res.on("close", () => {
      if (!res.writableEnded) {
        motivo ??= "cliente";
        controle.abort();
      }
    });
    const ping = setInterval(() => sse.comentario("ping"), this.tempos.pingMs);
    const teto = setTimeout(() => {
      motivo ??= "tempo";
      controle.abort();
    }, this.tempos.tetoMs);

    const eventos: EventoAgente[] = [];
    const dedupe = new DeduplicadorDeTexto();
    let tituloDoStream: string | null = null;
    let resultado: "fim" | "erro" | "abortado" | "tempo" = "erro";
    let codigoDaFalha: string | undefined;

    try {
      for await (const evento of this.agente.enviar(quem.usuarioId, conversa.sessaoId, texto, controle.signal)) {
        eventos.push(evento);
        if (evento.erro) {
          if (evento.erro.codigo === "linhas-descartadas") {
            logger.warn(
              { codigo: "agente-professor.linhas-descartadas", conversaId: conversa.id, quantas: Number(evento.erro.mensagem) },
              "o stream do agente trouxe linhas que não eram JSON",
            );
            continue;
          }
          throw new AgenteIndisponivel("o agente falhou no meio do turno", evento.erro.codigo);
        }
        const delta = dedupe.receber(evento);
        if (delta) sse.evento("delta", { texto: delta });
        tituloDoStream = tituloDoEstado(evento.estadoDelta) ?? tituloDoStream;
      }
      if (controle.signal.aborted) throw new Error("abortado");
      await this.fecharTurno(quem, conversa, eventos, dedupe.textoDoTurno, tituloDoStream, sse);
      resultado = "fim";
    } catch (erro) {
      if (motivo === "cliente") {
        resultado = "abortado";
      } else if (motivo === "tempo") {
        resultado = "tempo";
        sse.evento("erro", { codigo: "TEMPO_ESGOTADO", mensagem: MENSAGENS_DE_ERRO.TEMPO_ESGOTADO });
      } else {
        codigoDaFalha =
          /* Status HTTP ou o código do evento de erro — nunca o corpo da
             resposta do engine, que pode ecoar o que foi perguntado. */
          erro instanceof AgenteIndisponivel
            ? erro.status ? `http-${erro.status}` : (erro.detalhe ?? "indisponivel").slice(0, 80)
          : erro instanceof SessaoInexistente ? "sessao-inexistente"
          : erro instanceof Error ? erro.name : "desconhecido";
        sse.evento("erro", {
          codigo: "AGENTE_INDISPONIVEL",
          mensagem:
            erro instanceof SessaoInexistente
              ? "Esta conversa não está mais disponível no agente. Comece uma nova."
              : MENSAGENS_DE_ERRO.AGENTE_INDISPONIVEL,
        });
        if (!(erro instanceof AgenteIndisponivel) && !(erro instanceof SessaoInexistente)) {
          logger.error({ codigo: "agente-professor.turno-com-erro", conversaId: conversa.id, err: erro }, "erro inesperado no turno");
        }
      }
    } finally {
      clearInterval(ping);
      clearTimeout(teto);
      /* No `finally`, inclusive no abort e no erro: o que o modelo gerou foi
         pago, tenha o professor lido ou não. */
      const tokens = somarTokens(eventos);
      if (tokens > 0) {
        await this.quota.consumir(quem.escolaId, quem.usuarioId, tokens).catch((erro: unknown) =>
          logger.error({ codigo: "agente-professor.quota-nao-consumida", conversaId: conversa.id, tokens, err: erro }, "tokens do turno não foram contados"),
        );
      }
      logger.info(
        {
          codigo: "agente-professor.turno",
          conversaId: conversa.id,
          modo: this.agente.modo,
          resultado,
          falha: codigoDaFalha,
          duracaoMs: Date.now() - inicio,
          tokens,
          eventos: eventos.length,
        },
        "turno do agente de IA do professor",
      );
      sse.encerrar();
    }

    if (resultado === "fim") void this.renovar(conversa);
  }

  /** O que vem DEPOIS do último evento do agente: fontes, título, avisos, fim. */
  private async fecharTurno(
    quem: Quem,
    conversa: ConversaDaPosse,
    eventos: readonly EventoAgente[],
    textoDoTurno: string,
    tituloDoStream: string | null,
    sse: EscritorSse,
  ): Promise<void> {
    const fontes = extrairFontes(eventos);
    if (fontes.length > 0) sse.evento("fontes", { fontes });

    let titulo = tituloDoStream;
    if (!titulo && conversa.titulo === null) {
      /* O stream terminou sem o `state_delta`: o agente pode ter escrito o
         título por outro caminho. Uma leitura curta da sessão, sem derrubar o
         turno se falhar. */
      try {
        titulo = tituloDoEstado((await this.agente.lerSessao(quem.usuarioId, conversa.sessaoId)).estado);
      } catch {
        titulo = null;
      }
    }
    const tituloNovo = titulo && titulo !== conversa.titulo ? titulo : null;
    await this.gravarDepoisDoTurno(quem, conversa.id, tituloNovo, true).catch((erro: unknown) =>
      logger.error({ codigo: "agente-professor.conversa-nao-atualizada", conversaId: conversa.id, err: erro }, "a linha da conversa não foi atualizada"),
    );
    if (tituloNovo) sse.evento("titulo", { titulo: tituloNovo });

    /* A conferência: código de habilidade citado que a BNCC não tem é aviso,
       não censura — o texto já está na tela; o aviso diz ao professor para
       conferir antes de pôr num plano. */
    for (const codigo of codigosInexistentes(textoDoTurno, (c) => habilidadePorCodigo(c) !== null)) {
      sse.evento("aviso", {
        codigo: "habilidade-inexistente",
        mensagem: `O código ${codigo} citado na resposta não existe na BNCC. Confira antes de usá-lo.`,
      });
    }
    sse.evento("fim", {});
  }

  /** Empurra a expiração da sessão. Falha só vira log: a mensagem já foi entregue. */
  private async renovar(conversa: ConversaDaPosse): Promise<void> {
    if (!this.agente.renovarSessao) return;
    try {
      await this.agente.renovarSessao(conversa.sessaoId, new Date(Date.now() + VIDA_DA_SESSAO_MS));
    } catch (erro) {
      logger.warn(
        {
          codigo: "agente-professor.renovacao-falhou",
          conversaId: conversa.id,
          status: erro instanceof AgenteIndisponivel ? erro.status : undefined,
        },
        "a expiração da sessão não foi renovada",
      );
    }
  }
}

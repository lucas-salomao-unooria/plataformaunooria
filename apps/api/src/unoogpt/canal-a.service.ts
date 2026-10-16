import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma, UnoogptSessao } from "@prisma/client";
import { ATIVIDADE_DA_TURMA } from "../equipes/regras";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { aleatorioDe, type Nivel } from "../evidencias/regras";
import { PrismaService } from "../prisma/prisma.service";
import { erroDeJogo } from "./erros";
import type { Alocacao, Desfecho } from "./modelo/tempestade";
import { deveMarcar } from "./regras/agregacao";
import {
  ALCANCE_DO_ALERTA,
  PARTES_DO_ALERTA,
  bairrosSemEquipe,
  montarAlerta,
  nivelDoAlerta,
  respostaDoAlertaValida,
  textoDaOpcaoDoAlerta,
} from "./regras/alerta";
import { MARCADOR_DA_TAREFA, TAREFAS_DO_REGISTRO, nomeDoBairro, type Tarefa } from "./regras/canal-a";
import {
  IDS_DAS_PERGUNTAS,
  PERGUNTAS_DA_FONTE,
  montarCartoes,
  nivelDosCartoes,
  textoDaPergunta,
  type CartaoDaFonte,
} from "./regras/cartoes-das-fontes";
import { RESPOSTAS_DO_E_SE, montarComparacoes, nivelDoESe, type Comparacao } from "./regras/e-se";
import {
  CRUZAM,
  ROTULO_CRUZAM,
  acertosDaLeitura,
  montarPares,
  nivelDaLeitura,
  opcoesDoPar,
  perguntaDoPar,
  type LinhaDaLeitura,
  type ParDaLeitura,
} from "./regras/leitura-dos-pares";
import {
  bairroDaMoradora,
  montarMoradora,
  nivelDaMoradora,
  respostaDaMoradoraValida,
  type ApresentacaoDaMoradora,
} from "./regras/moradora";
import { CONJUNTO_POR_SLUG } from "./modelo/conjuntos";
import { EXP_ID } from "./regras/defaults";
import { OPCOES_DA_SAUDE, TEXTO_DA_SAUDE, entregaDaSaude, nivelDaSaude, type OpcaoDaSaude } from "./regras/saude";
import {
  AVISOS_DO_PEDIDO,
  MENSAGEM_DO_VOLUNTARIO,
  PERGUNTA_DA_RESPOSTA,
  PERGUNTA_DO_AVISO,
  RESPOSTAS_AO_VOLUNTARIO,
  nivelDoWhatsapp,
  type AvisoDoPedido,
  type RespostaAoVoluntario,
} from "./regras/whatsapp";

type Tx = Prisma.TransactionClient;

/** O que fica gravado em `apresentacao`, por tarefa. Só a API lê o gabarito. */
interface ApresentacaoDaLeitura {
  linhas: LinhaDaLeitura[];
  pares: ParDaLeitura[] | null;
  fontes: number;
  teveMinuto: boolean;
}
interface ApresentacaoDasFontes {
  cartoes: CartaoDaFonte[] | null;
}
type ApresentacaoDoAlerta = ReturnType<typeof montarAlerta>;
interface ApresentacaoDoESe {
  comparacoes: Comparacao[] | null;
}

const opcoesDoEsquema = <T extends { id: string; texto: string }>(xs: readonly T[]) =>
  xs.map((x) => ({ id: x.id, texto: x.texto }));

/**
 * O CANAL A DA MISSÃO TEMPESTADE (exp02em1b, ADR-169): as sete tarefas por ação
 * e as marcas da evidência pedagógica.
 *
 *   - a LIGAÇÃO DA SAÚDE, na investigação (EM13CO26);
 *   - o REGISTRO DA OPERAÇÃO, depois de "Enviar equipes" e antes do desfecho,
 *     sem relógio: a leitura dos dados (EM13CO12), as fontes (EM13CO14) e o
 *     alerta (EM13CO24) — o resultado fica retido até ele;
 *   - o "E SE…" pareado, no resultado (EM13CO11);
 *   - o FECHAMENTO, que o professor abre: o WhatsApp (EM13CO08) e a moradora
 *     (EM13CO26).
 *
 * Toda rota toma o LOCK da sessão (o mesmo do `UnoogptService`), e toda marca
 * vai na transação da tarefa. O estudante nunca vê o próprio nível nem se
 * acertou: a resposta é o estado da tela, sem gabarito. A apresentação (os
 * pares, os cartões, as comparações, a ordem das opções) é montada no SERVIDOR
 * e gravada: um F5 mostra a mesma coisa, e o professor lê o que foi mostrado.
 */
@Injectable()
export class CanalADaTempestade {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
  ) {}

  // ── o que todas as tarefas usam ─────────────────────────────────────────

  async lock(tx: Tx, escolaId: string, estudanteId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${escolaId}:${estudanteId}`}, 0))`;
  }

  private async sessao(tx: Tx, escolaId: string, estudanteId: string): Promise<UnoogptSessao> {
    const s = await tx.unoogptSessao.findUnique({ where: { escolaId_estudanteId: { escolaId, estudanteId } } });
    if (!s) throw erroDeJogo("sessao-encerrada");
    return s;
  }

  private aleatorio(s: UnoogptSessao, tarefa: Tarefa) {
    return aleatorioDe(`${s.escolaId}:${s.estudanteId}:${s.rodada}:${s.tentativa}:${tarefa}`);
  }

  private linha(tx: Tx, s: UnoogptSessao, tarefa: Tarefa) {
    return tx.unoogptTarefa.findUnique({
      where: {
        escolaId_estudanteId_rodada_tentativa_tarefa: {
          escolaId: s.escolaId,
          estudanteId: s.estudanteId,
          rodada: s.rodada,
          tentativa: s.tentativa,
          tarefa,
        },
      },
    });
  }

  private async criarLinha(tx: Tx, s: UnoogptSessao, tarefa: Tarefa, apresentacao: unknown, respostas?: unknown) {
    await tx.unoogptTarefa.createMany({
      data: [
        {
          escolaId: s.escolaId,
          estudanteId: s.estudanteId,
          rodada: s.rodada,
          tentativa: s.tentativa,
          tarefa,
          apresentacao: apresentacao as Prisma.InputJsonValue,
          ...(respostas === undefined
            ? {}
            : { respostas: respostas as Prisma.InputJsonValue, enviadaEm: new Date() }),
        },
      ],
      skipDuplicates: true,
    });
    return this.linha(tx, s, tarefa);
  }

  /** A tarefa já foi respondida nesta RODADA da turma, em qualquer tentativa? */
  private async respondidaNaRodada(tx: Tx, s: UnoogptSessao, tarefa: Tarefa) {
    return (
      (await tx.unoogptTarefa.count({
        where: { escolaId: s.escolaId, estudanteId: s.estudanteId, rodada: s.rodada, tarefa, enviadaEm: { not: null } },
      })) > 0
    );
  }

  /**
   * A tentativa COMEÇOU com o relógio aberto? Gravado ao entrar na
   * investigação; a sessão anterior à coluna cai no marco `inicio`.
   */
  private async comecouAberta(tx: Tx, s: UnoogptSessao) {
    if (s.inicioComRelogioAberto !== null) return s.inicioComRelogioAberto;
    const inicio = await this.marcoDeInicio(tx, s);
    return inicio !== null && inicio.motivoDoFim === null;
  }

  private marcoDeInicio(tx: Tx, s: UnoogptSessao) {
    return tx.unoogptMarco.findFirst({
      where: { escolaId: s.escolaId, estudanteId: s.estudanteId, tentativa: s.tentativa, tipo: "inicio" },
      select: { motivoDoFim: true, segundosRestantes: true },
    });
  }

  /**
   * A MARCA, na transação da tarefa. A atividade é a `"turma"` e a rodada é a
   * da TURMA; a sessão de uma rodada que acabou (o professor zerou com a tela
   * aberta) não marca. "Primeira da rodada" confere `jaMarcou`; "melhor
   * tentativa" só marca se a tentativa começou com o relógio aberto
   * (`regras/agregacao.ts`).
   */
  private async marcar(tx: Tx, s: UnoogptSessao, tarefa: Tarefa, nivel: Nivel | null) {
    if (nivel === null || !s.turmaId) return;
    const gate = await tx.unoogptGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId: s.escolaId, turmaId: s.turmaId } },
      select: { rodada: true },
    });
    if ((gate?.rodada ?? 1) !== s.rodada) return;
    const base = {
      escolaId: s.escolaId,
      expId: EXP_ID,
      atividadeId: ATIVIDADE_DA_TURMA,
      rodada: s.rodada,
      estudanteId: s.estudanteId,
    };
    const marcador = MARCADOR_DA_TAREFA[tarefa];
    const pode = deveMarcar(tarefa, {
      jaMarcouNaRodada: await this.evidencias.jaMarcou(tx, base, [marcador]),
      inicioComRelogioAberto: await this.comecouAberta(tx, s),
    });
    if (!pode) return;
    await this.evidencias.marcar(tx, { ...base, turmaId: s.turmaId, marcador, status: nivel });
  }

  private async enviar(tx: Tx, id: string, respostas: unknown) {
    await tx.unoogptTarefa.update({
      where: { id },
      data: { respostas: respostas as Prisma.InputJsonValue, enviadaEm: new Date() },
    });
  }

  private invalida(): never {
    throw new BadRequestException({ codigo: "payload-invalido", mensagem: "Escolha uma opção em cada pergunta." });
  }

  // ── a ligação da Saúde ──────────────────────────────────────────────────

  /**
   * A ligação APARECE: no primeiro destino escolhido (pelo mapa ou pela
   * conversa) ou ao abrir a decisão, o que vier antes. Uma vez por tentativa;
   * na transação de quem chama, que já tem o lock.
   */
  async ofertarNaTransacao(tx: Tx, s: UnoogptSessao): Promise<void> {
    if (s.ofertaSaudeEm || s.concluidoEm || s.passo !== "investigacao") return;
    await tx.unoogptSessao.update({
      where: { escolaId_estudanteId: { escolaId: s.escolaId, estudanteId: s.estudanteId } },
      data: { ofertaSaudeEm: new Date() },
    });
    await this.criarLinha(tx, s, "saude", { opcoes: OPCOES_DA_SAUDE.map((o) => o.id) });
  }

  private async estadoDaSaude(tx: Tx, s: UnoogptSessao) {
    const linha = await this.linha(tx, s, "saude");
    const opcao = (linha?.respostas as { opcao?: OpcaoDaSaude | null } | null)?.opcao ?? null;
    return {
      ofertada: linha !== null,
      respondida: linha?.enviadaEm != null,
      texto: TEXTO_DA_SAUDE,
      opcoes: opcoesDoEsquema(OPCOES_DA_SAUDE),
      /** O que chegou — consequência, nunca julgamento. `null` sem resposta ou sem pedido. */
      entrega: linha?.enviadaEm && opcao ? entregaDaSaude(opcao) : null,
    };
  }

  async saude(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => this.estadoDaSaude(tx, await this.sessao(tx, escolaId, estudanteId)), escolaId);
  }

  async abrirSaude(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      await this.ofertarNaTransacao(tx, s);
      return this.estadoDaSaude(tx, s);
    }, escolaId);
  }

  /** `opcao: null` = fechou o cartão sem responder: fica registrado, e não há marca. */
  async responderSaude(escolaId: string, estudanteId: string, opcao: OpcaoDaSaude | null) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      const linha = await this.linha(tx, s, "saude");
      if (!linha) throw erroDeJogo("passo-invalido");
      // Vale a primeira resposta da tentativa: a segunda não muda nada.
      if (!linha.enviadaEm) {
        await this.enviar(tx, linha.id, { opcao });
        await this.marcar(tx, s, "saude", nivelDaSaude(opcao));
      }
      return this.estadoDaSaude(tx, s);
    }, escolaId);
  }

  // ── o registro da operação ──────────────────────────────────────────────

  /** A última tabela que o grupo pediu ao Cientista nesta tentativa. */
  private async ultimaLeitura(tx: Tx, s: UnoogptSessao): Promise<LinhaDaLeitura[]> {
    const falas = await tx.unoogptMensagem.findMany({
      where: { escolaId: s.escolaId, estudanteId: s.estudanteId, tentativa: s.tentativa, papel: "agente" },
      orderBy: { id: "desc" },
      select: { anexo: true },
      take: 40,
    });
    for (const f of falas) {
      const a = f.anexo as {
        tipo?: string;
        rodada?: { estimativas?: { bairro: string; pessoasEmRisco: { min: number; esperado: number; max: number } }[] };
      } | null;
      if ((a?.tipo === "tendencia" || a?.tipo === "opcoes") && a.rodada?.estimativas?.length) {
        return a.rodada.estimativas.map((e) => ({ bairro: e.bairro, ...e.pessoasEmRisco }));
      }
    }
    return [];
  }

  /**
   * Monta o registro da tentativa, se faltar — idempotente: `mandar` chama, e
   * a leitura também (um F5 no meio não perde nada). O cartão que não pode
   * aparecer (leitura sem os dois pares, fontes sem dois cartões) nasce já
   * fechado; a leitura sem cartão marca na hora, pela linha do processo.
   */
  private async prepararRegistro(tx: Tx, s: UnoogptSessao) {
    const sim = await tx.unoogptSimulacao.findUnique({
      where: { escolaId_estudanteId_ordem: { escolaId: s.escolaId, estudanteId: s.estudanteId, ordem: s.tentativa } },
    });
    if (!sim) throw erroDeJogo("sessao-encerrada");
    if (s.registroConcluidoEm) return;

    if (!(await this.linha(tx, s, "leitura"))) {
      const linhas = await this.ultimaLeitura(tx, s);
      const inicio = await this.marcoDeInicio(tx, s);
      const teveMinuto =
        (await this.comecouAberta(tx, s)) &&
        inicio !== null &&
        inicio.motivoDoFim === null &&
        (inicio.segundosRestantes === null || inicio.segundosRestantes >= 60);
      const pares = linhas.length > 0 ? montarPares(linhas, this.aleatorio(s, "leitura")) : null;
      const apresentacao: ApresentacaoDaLeitura = { linhas, pares, fontes: s.conjuntos.length, teveMinuto };
      if (pares) await this.criarLinha(tx, s, "leitura", apresentacao);
      else {
        await this.criarLinha(tx, s, "leitura", apresentacao, { semCartao: true });
        await this.marcar(tx, s, "leitura", nivelDaLeitura({ fontes: s.conjuntos.length, teveMinuto, acertos: null }));
      }
    }

    if (!(await this.linha(tx, s, "fontes"))) {
      const cartoes = montarCartoes({
        equipes: [
          { equipe: "alfa", bairro: s.alocacaoAlfa, justificativa: s.justificativaAlfa },
          { equipe: "bravo", bairro: s.alocacaoBravo, justificativa: s.justificativaBravo },
        ],
        abertas: s.conjuntos,
        leitura: await this.ultimaLeitura(tx, s),
      });
      const apresentacao: ApresentacaoDasFontes = { cartoes };
      if (cartoes) await this.criarLinha(tx, s, "fontes", apresentacao);
      else await this.criarLinha(tx, s, "fontes", apresentacao, { semCartao: true });
    }

    // O alerta é "primeira da rodada": respondido numa tentativa, não volta.
    if (!(await this.linha(tx, s, "alerta")) && !(await this.respondidaNaRodada(tx, s, "alerta"))) {
      const alocacao = sim.alocacao as { alfa?: string | null; bravo?: string | null };
      const semEquipe = bairrosSemEquipe({ alfa: alocacao.alfa ?? null, bravo: alocacao.bravo ?? null });
      await this.criarLinha(tx, s, "alerta", montarAlerta(semEquipe, this.aleatorio(s, "alerta")));
    }

    await this.concluirSeCompleto(tx, s);
  }

  private async concluirSeCompleto(tx: Tx, s: UnoogptSessao) {
    const linhas = await tx.unoogptTarefa.findMany({
      where: {
        escolaId: s.escolaId,
        estudanteId: s.estudanteId,
        rodada: s.rodada,
        tentativa: s.tentativa,
        tarefa: { in: [...TAREFAS_DO_REGISTRO] },
      },
      select: { enviadaEm: true },
    });
    if (linhas.every((l) => l.enviadaEm !== null)) {
      await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId: s.escolaId, estudanteId: s.estudanteId } },
        data: { registroConcluidoEm: new Date() },
      });
    }
  }

  /** O registro como a TELA o vê: sem gabarito, com ids opacos. */
  private async vistaDoRegistro(tx: Tx, escolaId: string, estudanteId: string) {
    const s = await this.sessao(tx, escolaId, estudanteId);
    const [leitura, fontes, alerta] = await Promise.all(TAREFAS_DO_REGISTRO.map((t) => this.linha(tx, s, t)));

    const apLeitura = leitura?.apresentacao as ApresentacaoDaLeitura | undefined;
    const apFontes = fontes?.apresentacao as ApresentacaoDasFontes | undefined;
    const apAlerta = alerta?.apresentacao as ApresentacaoDoAlerta | undefined;

    return {
      concluido: s.registroConcluidoEm !== null,
      leitura:
        leitura && apLeitura?.pares
          ? {
              enviada: leitura.enviadaEm !== null,
              tabela: apLeitura.linhas.map((l) => ({
                bairro: l.bairro,
                nome: nomeDoBairro(l.bairro),
                min: l.min,
                esperado: l.esperado,
                max: l.max,
              })),
              pares: apLeitura.pares.map((p, i) => ({
                id: `p${i + 1}`,
                pergunta: perguntaDoPar(p),
                opcoes: opcoesDoPar(p).map((o) => ({ id: o, texto: o === CRUZAM ? ROTULO_CRUZAM : nomeDoBairro(o) })),
              })),
            }
          : null,
      fontes:
        fontes && apFontes?.cartoes
          ? {
              enviada: fontes.enviadaEm !== null,
              cartoes: apFontes.cartoes.map((c) => ({ id: c.id, texto: c.texto })),
              perguntas: opcoesDoEsquema(PERGUNTAS_DA_FONTE),
            }
          : null,
      alerta:
        alerta && apAlerta
          ? {
              enviada: alerta.enviadaEm !== null,
              enunciado: apAlerta.enunciado,
              partes: apAlerta.partes.map((p) => ({
                id: p.id,
                titulo: p.titulo,
                opcoes: p.ordem.map((o) => ({ id: o, texto: textoDaOpcaoDoAlerta(p.id, o) ?? o })),
              })),
            }
          : null,
    };
  }

  /** `GET /unoogpt/registro` — e o que `mandar` devolve. */
  async registro(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      await this.prepararRegistro(tx, await this.sessao(tx, escolaId, estudanteId));
      return this.vistaDoRegistro(tx, escolaId, estudanteId);
    }, escolaId);
  }

  /** O cliente antigo (`POST /simular`) pula o registro: fecha sem tarefa e sem marca. */
  async fecharRegistroSemTarefas(escolaId: string, estudanteId: string) {
    await this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      if (s.registroConcluidoEm) return;
      await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { registroConcluidoEm: new Date() },
      });
    }, escolaId);
  }

  private async tarefaDoRegistro(escolaId: string, estudanteId: string, tarefa: Tarefa, gravar: (tx: Tx, s: UnoogptSessao, linha: { id: string; apresentacao: unknown }) => Promise<void>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      await this.prepararRegistro(tx, s);
      const linha = await this.linha(tx, s, tarefa);
      if (!linha) throw erroDeJogo("passo-invalido");
      if (!linha.enviadaEm) {
        await gravar(tx, s, linha);
        await this.concluirSeCompleto(tx, s);
      }
      return this.vistaDoRegistro(tx, escolaId, estudanteId);
    }, escolaId);
  }

  async responderLeitura(escolaId: string, estudanteId: string, respostas: Record<string, string>) {
    return this.tarefaDoRegistro(escolaId, estudanteId, "leitura", async (tx, s, linha) => {
      const ap = linha.apresentacao as ApresentacaoDaLeitura;
      if (!ap.pares) throw erroDeJogo("passo-invalido");
      // Os ids da tela são a posição (p1, p2): o tipo do par é gabarito.
      const porTipo: Record<string, string> = {};
      ap.pares.forEach((p, i) => {
        const r = respostas[`p${i + 1}`];
        if (!r || !opcoesDoPar(p).includes(r)) this.invalida();
        porTipo[p.id] = r;
      });
      await this.enviar(tx, linha.id, porTipo);
      await this.marcar(
        tx,
        s,
        "leitura",
        nivelDaLeitura({ fontes: ap.fontes, teveMinuto: ap.teveMinuto, acertos: acertosDaLeitura(ap.pares, porTipo) }),
      );
    });
  }

  async responderFontes(escolaId: string, estudanteId: string, respostas: Record<string, string>) {
    return this.tarefaDoRegistro(escolaId, estudanteId, "fontes", async (tx, s, linha) => {
      const ap = linha.apresentacao as ApresentacaoDasFontes;
      if (!ap.cartoes) throw erroDeJogo("passo-invalido");
      for (const c of ap.cartoes) {
        if (!(IDS_DAS_PERGUNTAS as readonly string[]).includes(respostas[c.id] ?? "")) this.invalida();
      }
      const gravadas = Object.fromEntries(ap.cartoes.map((c) => [c.id, respostas[c.id]!]));
      await this.enviar(tx, linha.id, gravadas);
      await this.marcar(tx, s, "fontes", nivelDosCartoes(ap.cartoes, gravadas));
    });
  }

  async responderAlerta(escolaId: string, estudanteId: string, respostas: Record<string, string>) {
    return this.tarefaDoRegistro(escolaId, estudanteId, "alerta", async (tx, s, linha) => {
      if (!respostaDoAlertaValida(respostas)) this.invalida();
      const gravadas = Object.fromEntries(PARTES_DO_ALERTA.map((p) => [p.id, respostas[p.id]!]));
      await this.enviar(tx, linha.id, gravadas);
      await this.marcar(tx, s, "alerta", nivelDoAlerta(respostas));
    });
  }

  // ── o "E se…" pareado ───────────────────────────────────────────────────

  private async prepararESe(tx: Tx, s: UnoogptSessao) {
    const existente = await this.linha(tx, s, "e-se");
    if (existente) return existente;
    const sim = await tx.unoogptSimulacao.findUnique({
      where: { escolaId_estudanteId_ordem: { escolaId: s.escolaId, estudanteId: s.estudanteId, ordem: s.tentativa } },
    });
    if (!sim) throw erroDeJogo("sessao-encerrada");
    const gravada = sim.alocacao as { alfa?: string | null; bravo?: string | null };
    const sua: Alocacao = { alfa: gravada.alfa ?? null, bravo: gravada.bravo ?? null };
    const comparacoes = montarComparacoes(sua, sim.minutoDaSaida, this.aleatorio(s, "e-se"));
    const apresentacao: ApresentacaoDoESe = { comparacoes };
    return comparacoes
      ? this.criarLinha(tx, s, "e-se", apresentacao)
      : this.criarLinha(tx, s, "e-se", apresentacao, { semCartao: true });
  }

  private vistaDoESe(linha: { apresentacao: unknown; enviadaEm: Date | null }) {
    const ap = linha.apresentacao as unknown as ApresentacaoDoESe;
    if (!ap.comparacoes) return { comparacoes: null, enviada: false };
    const nome = (b: string | null) => (b ? nomeDoBairro(b) : "base");
    const decisao = (a: Alocacao) => ({ alfa: nome(a.alfa), bravo: nome(a.bravo) });
    return {
      enviada: linha.enviadaEm !== null,
      opcoes: opcoesDoEsquema(RESPOSTAS_DO_E_SE),
      comparacoes: ap.comparacoes.map((c, i) => ({
        id: `e${i + 1}`,
        pergunta:
          c.modo === "sua"
            ? "Comparada com a sua, essa outra decisão…"
            : "Comparada com a primeira, a segunda decisão…",
        referencia: { ...decisao(c.referencia), sua: c.modo === "sua" },
        outra: decisao(c.outra),
        quadradinhos: c.quadradinhos,
      })),
    };
  }

  /** O resultado (e o que vem depois dele) só existe com o registro feito. */
  private exigirResultado(s: UnoogptSessao) {
    if (!s.registroConcluidoEm) throw erroDeJogo("registro-pendente");
  }

  async eSe(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      this.exigirResultado(s);
      return this.vistaDoESe((await this.prepararESe(tx, s))!);
    }, escolaId);
  }

  async responderESe(escolaId: string, estudanteId: string, respostas: Record<string, string>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      this.exigirResultado(s);
      const linha = (await this.prepararESe(tx, s))!;
      const ap = linha.apresentacao as unknown as ApresentacaoDoESe;
      if (!ap.comparacoes) throw erroDeJogo("passo-invalido");
      if (!linha.enviadaEm) {
        const ids = RESPOSTAS_DO_E_SE.map((r) => r.id) as string[];
        const porTipo: Record<string, string> = {};
        ap.comparacoes.forEach((c, i) => {
          const r = respostas[`e${i + 1}`];
          if (!r || !ids.includes(r)) this.invalida();
          porTipo[c.id] = r;
        });
        await this.enviar(tx, linha.id, porTipo);
        await this.marcar(tx, s, "e-se", nivelDoESe(ap.comparacoes, porTipo));
      }
      return this.vistaDoESe((await this.linha(tx, s, "e-se"))!);
    }, escolaId);
  }

  // ── o fechamento ────────────────────────────────────────────────────────

  private async exigirFechamento(tx: Tx, s: UnoogptSessao) {
    const relogio = s.turmaId
      ? await tx.unoogptRelogioTurma.findUnique({
          where: { escolaId_turmaId: { escolaId: s.escolaId, turmaId: s.turmaId } },
          select: { fechamentoAbertoEm: true },
        })
      : null;
    if (!relogio?.fechamentoAbertoEm) throw erroDeJogo("fechamento-fechado");
    this.exigirResultado(s);
  }

  /** A linha do fechamento: a desta tentativa, ou a já enviada de outra tentativa da rodada. */
  private async linhaDoFechamento(tx: Tx, s: UnoogptSessao, tarefa: "whatsapp" | "moradora") {
    const enviada = await tx.unoogptTarefa.findFirst({
      where: { escolaId: s.escolaId, estudanteId: s.estudanteId, rodada: s.rodada, tarefa, enviadaEm: { not: null } },
      orderBy: { tentativa: "asc" },
    });
    if (enviada) return enviada;
    const existente = await this.linha(tx, s, tarefa);
    if (existente) return existente;
    if (tarefa === "whatsapp") return this.criarLinha(tx, s, "whatsapp", { versao: 1 });

    const sim = await tx.unoogptSimulacao.findUnique({
      where: { escolaId_estudanteId_ordem: { escolaId: s.escolaId, estudanteId: s.estudanteId, ordem: s.tentativa } },
    });
    if (!sim) throw erroDeJogo("sessao-encerrada");
    const alocacao = sim.alocacao as { alfa?: string | null; bravo?: string | null };
    const semEquipe = bairrosSemEquipe({ alfa: alocacao.alfa ?? null, bravo: alocacao.bravo ?? null });
    const desfecho = sim.desfecho as unknown as Desfecho;
    const bairro = bairroDaMoradora(semEquipe, desfecho.porBairro) ?? semEquipe[0] ?? "valeverde";
    // O porquê das equipes que SAÍRAM; a da base não entra no perfil.
    const justificativas = [
      ...(alocacao.alfa ? [s.justificativaAlfa] : []),
      ...(alocacao.bravo ? [s.justificativaBravo] : []),
    ];
    return this.criarLinha(
      tx,
      s,
      "moradora",
      montarMoradora({ bairro, justificativas, conjuntos: s.conjuntos }, this.aleatorio(s, "moradora")),
    );
  }

  private async vistaDoFechamento(tx: Tx, s: UnoogptSessao) {
    const whatsapp = (await this.linhaDoFechamento(tx, s, "whatsapp"))!;
    const moradora = (await this.linhaDoFechamento(tx, s, "moradora"))!;
    const ap = moradora.apresentacao as ApresentacaoDaMoradora;
    return {
      whatsapp: {
        enviada: whatsapp.enviadaEm !== null,
        mensagem: MENSAGEM_DO_VOLUNTARIO,
        perguntaDaResposta: PERGUNTA_DA_RESPOSTA,
        respostas: opcoesDoEsquema(RESPOSTAS_AO_VOLUNTARIO),
        perguntaDoAviso: PERGUNTA_DO_AVISO,
        avisos: opcoesDoEsquema(AVISOS_DO_PEDIDO),
      },
      moradora: {
        enviada: moradora.enviadaEm !== null,
        enunciado: ap.enunciado,
        partes: ap.partes.map((p) => ({ id: p.id, titulo: p.titulo, opcoes: p.opcoes })),
      },
    };
  }

  async fechamento(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      await this.exigirFechamento(tx, s);
      return this.vistaDoFechamento(tx, s);
    }, escolaId);
  }

  async responderWhatsapp(escolaId: string, estudanteId: string, resposta: RespostaAoVoluntario, aviso: AvisoDoPedido) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      await this.exigirFechamento(tx, s);
      const linha = (await this.linhaDoFechamento(tx, s, "whatsapp"))!;
      if (!linha.enviadaEm) {
        await this.enviar(tx, linha.id, { resposta, aviso });
        await this.marcar(tx, s, "whatsapp", nivelDoWhatsapp(resposta, aviso));
      }
      return this.vistaDoFechamento(tx, s);
    }, escolaId);
  }

  async responderMoradora(escolaId: string, estudanteId: string, respostas: Record<string, string>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const s = await this.sessao(tx, escolaId, estudanteId);
      await this.exigirFechamento(tx, s);
      const linha = (await this.linhaDoFechamento(tx, s, "moradora"))!;
      if (!linha.enviadaEm) {
        const ap = linha.apresentacao as ApresentacaoDaMoradora;
        if (!respostaDaMoradoraValida(ap, respostas)) this.invalida();
        const gravadas = Object.fromEntries(ap.partes.map((p) => [p.id, respostas[p.id]!]));
        await this.enviar(tx, linha.id, gravadas);
        await this.marcar(tx, s, "moradora", nivelDaMoradora(respostas));
      }
      return this.vistaDoFechamento(tx, s);
    }, escolaId);
  }

  // ── o que o professor lê ────────────────────────────────────────────────

  /**
   * Para a folha da turma: quantos grupos enviaram o fechamento (o sinal para
   * a P2 e a P4, faladas), o que cada grupo perguntou sobre cada fonte (o
   * material do debate) e a frase fixa do alcance do alerta. Só contagens:
   * nenhum nome, nenhum nível.
   */
  async daTurma(tx: Tx, escolaId: string, estudanteIds: readonly string[]) {
    const tarefas = await tx.unoogptTarefa.findMany({
      where: {
        escolaId,
        estudanteId: { in: [...estudanteIds] },
        tarefa: { in: ["fontes", "whatsapp", "moradora"] },
        enviadaEm: { not: null },
      },
      select: { estudanteId: true, tarefa: true, apresentacao: true, respostas: true },
    });
    const enviaramFechamento = new Set<string>();
    const porEstudante = new Map<string, Set<string>>();
    const perguntas = new Map<string, { fonte: string; bairro: string; pergunta: string; grupos: Set<string> }>();
    for (const t of tarefas) {
      if (t.tarefa === "whatsapp" || t.tarefa === "moradora") {
        const feitas = porEstudante.get(t.estudanteId) ?? new Set<string>();
        feitas.add(t.tarefa);
        porEstudante.set(t.estudanteId, feitas);
        if (feitas.size === 2) enviaramFechamento.add(t.estudanteId);
        continue;
      }
      const cartoes = (t.apresentacao as unknown as ApresentacaoDasFontes).cartoes ?? [];
      const respostas = t.respostas as Record<string, string>;
      for (const c of cartoes) {
        const pergunta = respostas[c.id];
        if (!pergunta) continue;
        const chave = `${c.fonte}|${c.bairro}|${pergunta}`;
        const atual = perguntas.get(chave) ?? { fonte: c.fonte, bairro: c.bairro, pergunta, grupos: new Set<string>() };
        atual.grupos.add(t.estudanteId);
        perguntas.set(chave, atual);
      }
    }
    return {
      enviaramFechamento,
      perguntasPorFonte: [...perguntas.values()]
        .map((p) => ({
          fonte: CONJUNTO_POR_SLUG.get(p.fonte)?.rotuloCurto ?? p.fonte,
          bairro: nomeDoBairro(p.bairro),
          pergunta: textoDaPergunta(p.pergunta),
          grupos: p.grupos.size,
        }))
        .sort((a, b) => a.fonte.localeCompare(b.fonte, "pt-BR") || a.bairro.localeCompare(b.bairro, "pt-BR") || b.grupos - a.grupos),
      alcanceDoAlerta: ALCANCE_DO_ALERTA,
    };
  }

  /**
   * Para o relatório de UMA criança: as escolhas de cada tarefa, por
   * tentativa. Só escolhas fechadas, em texto — nunca o nível (ele é do painel
   * de habilidades, e o gestor vê só ele).
   */
  async escolhasDoEstudante(tx: Tx, escolaId: string, estudanteId: string) {
    const tarefas = await tx.unoogptTarefa.findMany({
      where: { escolaId, estudanteId, enviadaEm: { not: null } },
      orderBy: [{ tentativa: "asc" }, { criadaEm: "asc" }],
      select: { tentativa: true, tarefa: true, apresentacao: true, respostas: true },
    });
    return tarefas
      .map((t) => ({ tentativa: t.tentativa, tarefa: t.tarefa, escolhas: escolhasEmTexto(t.tarefa as Tarefa, t.apresentacao, t.respostas) }))
      .filter((t) => t.escolhas.length > 0);
  }
}

/** As escolhas de uma tarefa, como o professor lê: "pergunta: resposta". */
function escolhasEmTexto(tarefa: Tarefa, apresentacao: unknown, respostas: unknown): string[] {
  const r = (respostas ?? {}) as Record<string, string | null>;
  if (r.semCartao) return [];
  switch (tarefa) {
    case "saude": {
      const opcao = OPCOES_DA_SAUDE.find((o) => o.id === r.opcao);
      return [opcao ? `Pediu à Saúde: ${opcao.texto}` : "Fechou a ligação da Saúde sem responder"];
    }
    case "leitura": {
      const ap = apresentacao as ApresentacaoDaLeitura;
      return (ap.pares ?? []).map((p) => {
        const escolha = r[p.id];
        return `${perguntaDoPar(p)} ${escolha === CRUZAM ? ROTULO_CRUZAM : nomeDoBairro(escolha ?? "")}`;
      });
    }
    case "fontes": {
      const ap = apresentacao as ApresentacaoDasFontes;
      return (ap.cartoes ?? []).map((c) => `${CONJUNTO_POR_SLUG.get(c.fonte)?.rotuloCurto ?? c.fonte}, ${nomeDoBairro(c.bairro)}: ${textoDaPergunta(r[c.id] ?? "")}`);
    }
    case "alerta":
      return PARTES_DO_ALERTA.map((p) => `${p.titulo}: ${textoDaOpcaoDoAlerta(p.id, r[p.id] ?? "") ?? "—"}`);
    case "e-se":
      return (["clara", "depende"] as const).map(
        (id) => `${id === "clara" ? "Comparação clara" : "Comparação que depende"}: ${RESPOSTAS_DO_E_SE.find((o) => o.id === r[id])?.texto ?? "—"}`,
      );
    case "whatsapp":
      return [
        `Respondeu: ${RESPOSTAS_AO_VOLUNTARIO.find((o) => o.id === r.resposta)?.texto ?? "—"}`,
        `E mais: ${AVISOS_DO_PEDIDO.find((o) => o.id === r.aviso)?.texto ?? "—"}`,
      ];
    case "moradora": {
      const ap = apresentacao as ApresentacaoDaMoradora;
      return ap.partes.map((p) => `${p.titulo}: ${p.opcoes.find((o) => o.id === r[p.id])?.texto ?? "—"}`);
    }
  }
}

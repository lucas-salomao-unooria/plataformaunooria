import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { AVATAR_AO_VIVO, type AvatarAoVivoPort } from "../ai/avatar-ao-vivo.port";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { VOZ_AO_VIVO, type VozAoVivoPort } from "../ai/voz-ao-vivo.port";
import { exigirProdutoDisponivel } from "../comum/disponibilidade";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import { erroDaAjuda, MODELO_ANUNCIADO } from "./contrato-de-rotas";
import { promptDoAtendente } from "./prompt";
import {
  atendenteEfetivo,
  atendentesMontados,
  CAMINHO_DO_MODELO_DO_MASCOTE,
  CHAVES_DE_LIMITE,
  CONFIGURACAO_PADRAO,
  duracaoDaProximaSessao,
  FALA_DE_FALHA,
  LIMITES_PADRAO,
  paraHistorico,
  pedacoSse,
  segundosUsadosNoDia,
  VALIDADE_DO_BILHETE_S,
  type Atendente,
  type ConfiguracaoDaAjuda,
  type Limites,
  type MensagemOpenAi,
  type PERFIS_DA_AJUDA,
} from "./regras";
import { assinarTokenDaSessao, type ClaimsDaSessao } from "./token-da-sessao";

export type PerfilDaAjuda = (typeof PERFIS_DA_AJUDA)[number];

/** Quem abre a Ajuda, lido do TOKEN da plataforma. `escolaId` vazio = papel de contrato. */
export interface Quem {
  usuarioId: string;
  escolaId: string;
  perfil: PerfilDaAjuda;
}

/** O que o hub recebe ao abrir — o avatar entra na sala do vendor; o mascote, na conexão de voz desta api. */
export type SessaoAberta =
  | { atendente: "avatar"; id: string; tokenDaSessao: string; duracaoMaximaS: number; segundosRestantesHoje: number }
  | {
      atendente: "mascote";
      id: string;
      /** O bilhete com que o navegador entra em `/ajuda/mascote/ao-vivo` (vale 2 min, uma entrada). */
      bilhete: string;
      duracaoMaximaS: number;
      segundosRestantesHoje: number;
      ajustes: ConfiguracaoDaAjuda["mascote"];
    };

/** O marcador que uma sessão do mascote grava em `avatar_sessao_id` quando a conexão de voz entra. */
export const PREFIXO_DA_CONEXAO_DO_MASCOTE = "ao-vivo:";

/** O pedaço do `Response` do express que o stream usa — o teste o imita. */
export interface RespostaDoStream {
  statusCode: number;
  writableEnded: boolean;
  setHeader(nome: string, valor: string): unknown;
  flushHeaders(): void;
  write(pedaco: string): boolean;
  end(corpo?: string): unknown;
  on(evento: "close", cb: () => void): unknown;
}

/**
 * Teto de SAÍDA de um turno. Não é o tamanho da resposta (quem pede quatro
 * frases é o prompt): é folga para o RACIOCÍNIO, que sai do mesmo teto. MEDIDO
 * em 2026-10-02 no `gemini-3.7-flash`: mesmo com `thinkingBudget: 0` ele às
 * vezes pensa ~300–400 tokens, e com o teto de 400 a resposta saía cortada em
 * meia frase ("Primeiro, no seu Início, entre em Minhas turmas e").
 */
const MAXIMO_DE_TOKENS_DA_RESPOSTA = 2048;

/**
 * Sem nenhum pedaço até aqui, o atendente diz uma frase de espera. O vendor
 * desiste do nosso LLM se o primeiro byte passar de 10 s (medido), e a
 * primeira chamada FRIA — base de ~70 mil tokens fora do cache, mais o
 * raciocínio ocasional — levou 10,9 s. A frase mantém a fala viva; a resposta
 * de verdade vem logo depois, no mesmo turno.
 */
export const ESPERA_ATE_A_FALA_DE_ESPERA_MS = 7_000;
export const FALA_DE_ESPERA = "Um momento, estou vendo isso para você. ";
/** Mais baixo que o 0,5 do vendor: o atendente responde do que está na base, não cria. */
const TEMPERATURA = 0.3;

@Injectable()
export class AjudaService {
  private avisouSemLinha = false;
  private avisouSemConfiguracao = false;
  /** Sobrescrito no teste, para não esperar 7 s de verdade. */
  esperaAteAFalaDeEsperaMs = ESPERA_ATE_A_FALA_DE_ESPERA_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AVATAR_AO_VIVO) private readonly avatar: AvatarAoVivoPort,
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    @Inject(VOZ_AO_VIVO) private readonly voz: VozAoVivoPort,
  ) {}

  /** Os atendentes montados nesta stack (`atendentesMontados`, a regra única). */
  disponiveis(): Record<Atendente, boolean> {
    return atendentesMontados({
      avatarLigado: this.avatar.ligado,
      vozLigada: this.voz.ligada,
      chaveDaSessao: this.config.get("AJUDA_SESSAO_CHAVE"),
      segredoDoLlm: this.config.get("AJUDA_LLM_SEGREDO"),
    });
  }

  /**
   * Onde o navegador baixa o modelo 3D do mascote: o bucket de assets atrás da
   * CDN (`ASSETS_PUBLIC_URL`), ou a própria api em dev — a mesma base do
   * `AssetsService`. O caminho carrega a versão: o arquivo publicado é imutável,
   * e um mascote novo é um `-v2` (a CDN guarda o anterior por dias).
   */
  urlDoModeloDoMascote(): string {
    const base =
      this.config.get<string>("ASSETS_PUBLIC_URL") ?? `http://localhost:${this.config.get("PORT") ?? 3001}/assets`;
    return `${base.replace(/\/$/, "")}/${CAMINHO_DO_MODELO_DO_MASCOTE}`;
  }

  /** O mascote precisa da Vertex (o Gemini Live) e da chave que assina o bilhete. */
  get mascoteLigado(): boolean {
    return this.disponiveis().mascote;
  }

  /** A configuração da Ajuda, lida a cada abertura (sem cache, como os limites). */
  async configuracao(): Promise<ConfiguracaoDaAjuda> {
    const linha = await this.prisma.ajudaConfiguracao.findUnique({ where: { id: 1 } });
    if (!linha) {
      if (!this.avisouSemConfiguracao) {
        this.avisouSemConfiguracao = true;
        logger.warn({ codigo: "ajuda-configuracao-sem-linha" }, "ajuda_configuracao sem a linha; vale a constante do código");
      }
      return CONFIGURACAO_PADRAO;
    }
    return {
      atendentePadrao: linha.atendentePadrao === "avatar" ? "avatar" : "mascote",
      permitirTroca: linha.permitirTroca,
      mascote: {
        voz: linha.mascoteVoz,
        modelo: linha.mascoteModelo,
        sensibilidade: linha.mascoteSensibilidade,
        suavizacao: linha.mascoteSuavizacao,
        antecipacaoMs: linha.mascoteAntecipacaoMs,
        bocaRepouso: linha.mascoteBocaRepouso,
      },
    };
  }

  /** Os limites de minutos, lidos a cada abertura (sem cache, como `ia_quotas`). */
  async limites(): Promise<Limites> {
    const linhas = await this.prisma.ajudaLimite.findMany();
    const limites = { ...LIMITES_PADRAO };
    for (const chave of CHAVES_DE_LIMITE) {
      const linha = linhas.find((l) => l.chave === chave);
      if (linha) limites[chave] = linha.valor;
      else if (!this.avisouSemLinha) {
        this.avisouSemLinha = true;
        logger.warn({ codigo: "ajuda-limite-sem-linha", chave }, "ajuda_limites sem a linha; vale a constante do código");
      }
    }
    return limites;
  }

  /**
   * Abre a Ajuda: confere os minutos do dia, fecha a sessão anterior que tenha
   * ficado aberta, reserva a linha e pede a sala ao vendor.
   *
   * A linha nasce ANTES do vendor responder: o id dela vai dentro do token da
   * sessão. Se o vendor falhar, a linha é fechada com duração zero — não conta
   * minuto, e o histórico do dia continua honesto.
   */
  async abrirSessao(quem: Quem, pedido?: Atendente): Promise<SessaoAberta> {
    const chave = this.config.get<string>("AJUDA_SESSAO_CHAVE");
    const config = await this.configuracao();
    const atendente = atendenteEfetivo(config, this.disponiveis(), pedido);
    if (!atendente || !chave) throw erroDaAjuda("AJUDA_INDISPONIVEL", 503);

    const agora = new Date();
    await this.fecharAbertas(quem.usuarioId, agora);

    const [limites, recentes] = await Promise.all([
      this.limites(),
      this.prisma.ajudaSessao.findMany({
        where: { usuarioId: quem.usuarioId, inicio: { gte: new Date(agora.getTime() - 36 * 3_600_000) } },
        select: { inicio: true, duracaoMaxS: true, fim: true },
      }),
    ]);
    const usados = segundosUsadosNoDia(recentes, agora);
    const duracao = duracaoDaProximaSessao(limites, usados);
    if (duracao === null) {
      throw erroDaAjuda("SEM_MINUTOS", 429, { minutosPorDia: limites["minutos-por-dia"] });
    }

    const linha = await this.prisma.ajudaSessao.create({
      data: {
        usuarioId: quem.usuarioId,
        escolaId: quem.escolaId || null,
        perfil: quem.perfil,
        duracaoMaxS: duracao,
        inicio: agora,
        atendente,
      },
      select: { id: true },
    });

    const claims: ClaimsDaSessao = { sub: quem.usuarioId, escola: quem.escolaId, perfil: quem.perfil, sid: linha.id };
    const segundosRestantesHoje = Math.max(0, limites["minutos-por-dia"] * 60 - usados - duracao);

    if (atendente === "mascote") {
      // Nada a pedir a vendor nenhum aqui: a sessão do Gemini Live abre quando o
      // navegador entra na conexão de voz com este bilhete. Sem a entrada, a
      // linha fica aberta e conta o teto (como a do avatar), até a pessoa
      // encerrar ou abrir outra.
      const bilhete = await assinarTokenDaSessao(claims, VALIDADE_DO_BILHETE_S, chave, "ajuda-mascote");
      logger.info(
        { codigo: "ajuda.sessao-aberta", sid: linha.id, perfil: quem.perfil, duracaoMaxS: duracao, atendente },
        "sessão da Ajuda aberta",
      );
      return { atendente, id: linha.id, bilhete, duracaoMaximaS: duracao, segundosRestantesHoje, ajustes: config.mascote };
    }

    try {
      const token = await assinarTokenDaSessao(claims, duracao, chave);
      const sessao = await this.avatar.criarSessao({ duracaoMaximaS: duracao, variaveis: { sessao: token } });
      await this.prisma.ajudaSessao.update({ where: { id: linha.id }, data: { avatarSessaoId: sessao.sessaoId } });
      logger.info(
        { codigo: "ajuda.sessao-aberta", sid: linha.id, perfil: quem.perfil, duracaoMaxS: duracao, atendente },
        "sessão da Ajuda aberta",
      );
      return {
        atendente,
        id: linha.id,
        tokenDaSessao: sessao.tokenDaSessao,
        duracaoMaximaS: duracao,
        segundosRestantesHoje,
      };
    } catch (erro) {
      await this.prisma.ajudaSessao.update({ where: { id: linha.id }, data: { fim: agora } }).catch(() => undefined);
      logger.error({ codigo: "ajuda.avatar-falhou", sid: linha.id, err: erro }, "o vendor do avatar não abriu a sessão");
      throw erroDaAjuda("AVATAR_FALHOU", 502);
    }
  }

  /** Fecha a sessão DA PESSOA. A de outra pessoa (ou inexistente) é ignorada em silêncio — nada a confirmar. */
  async encerrar(quem: Quem, id: string): Promise<void> {
    const linha = await this.prisma.ajudaSessao.findFirst({
      where: { id, usuarioId: quem.usuarioId },
      select: { id: true, fim: true, avatarSessaoId: true },
    });
    if (!linha || linha.fim) return;
    await this.prisma.ajudaSessao.update({ where: { id: linha.id }, data: { fim: new Date() } });
    if (linha.avatarSessaoId) await this.pararNoVendor(linha.avatarSessaoId, linha.id);
  }

  /**
   * A conexão de voz do mascote ENTRA na sessão do bilhete — uma vez só. A
   * marca em `avatar_sessao_id` (`ao-vivo:<uuid>`) é atômica (`updateMany` com
   * a coluna nula na condição): duas abas com o mesmo bilhete, ou um bilhete
   * copiado, não abrem duas conversas pagas na mesma linha.
   *
   * Devolve o prazo da sessão (início + teto), ou `null` se ela não vale mais.
   */
  async entrarNoMascote(claims: ClaimsDaSessao): Promise<{ prazo: Date } | null> {
    const marca = `${PREFIXO_DA_CONEXAO_DO_MASCOTE}${randomUUID()}`;
    const { count } = await this.prisma.ajudaSessao.updateMany({
      where: { id: claims.sid, usuarioId: claims.sub, atendente: "mascote", fim: null, avatarSessaoId: null },
      data: { avatarSessaoId: marca },
    });
    if (count !== 1) return null;
    const linha = await this.prisma.ajudaSessao.findUnique({
      where: { id: claims.sid },
      select: { inicio: true, duracaoMaxS: true },
    });
    if (!linha) return null;
    return { prazo: new Date(linha.inicio.getTime() + linha.duracaoMaxS * 1000) };
  }

  /** A conexão do mascote caiu: grava o fim (o tempo real passa a contar). Idempotente. */
  async encerrarMascote(claims: ClaimsDaSessao): Promise<void> {
    await this.prisma.ajudaSessao.updateMany({
      where: { id: claims.sid, usuarioId: claims.sub, fim: null },
      data: { fim: new Date() },
    });
  }

  /** Abre a conversa de voz do mascote no vendor, com o prompt e a voz desta rede. */
  async abrirVozDoMascote(claims: ClaimsDaSessao) {
    const config = await this.configuracao();
    return this.voz.abrir({
      modelo: config.mascote.modelo,
      voz: config.mascote.voz,
      instrucao: promptDoAtendente(claims.perfil, "mascote"),
    });
  }

  /**
   * Toda sessão da pessoa que ainda não tem `fim` é fechada antes de abrir
   * outra: duas abas, ou um modal fechado sem o aviso chegar. O teto do vendor
   * fecharia a sala de qualquer jeito, mas até lá ela contaria minuto.
   */
  private async fecharAbertas(usuarioId: string, agora: Date): Promise<void> {
    const abertas = await this.prisma.ajudaSessao.findMany({
      where: { usuarioId, fim: null },
      select: { id: true, inicio: true, duracaoMaxS: true, avatarSessaoId: true },
    });
    for (const s of abertas) {
      const tetoAtingido = new Date(s.inicio.getTime() + s.duracaoMaxS * 1000);
      const aindaNoAr = tetoAtingido > agora;
      await this.prisma.ajudaSessao.update({ where: { id: s.id }, data: { fim: aindaNoAr ? agora : tetoAtingido } });
      if (aindaNoAr && s.avatarSessaoId) await this.pararNoVendor(s.avatarSessaoId, s.id);
    }
  }

  private async pararNoVendor(avatarSessaoId: string, sid: string): Promise<void> {
    // A sessão do mascote não tem sala no vendor do avatar: quem a fecha é a
    // própria conexão de voz, que confere a linha a cada meio minuto.
    if (avatarSessaoId.startsWith(PREFIXO_DA_CONEXAO_DO_MASCOTE)) return;
    try {
      await this.avatar.encerrarSessao(avatarSessaoId);
    } catch (erro) {
      // O teto da sessão fecha a sala de qualquer jeito: falhar aqui não pode
      // impedir a pessoa de abrir outra.
      logger.warn({ codigo: "ajuda.encerrar-falhou", sid, err: erro }, "o vendor não confirmou o fim da sessão");
    }
  }

  /** A sessão do token ainda vale? Encerrada ou de outra pessoa = não. */
  async sessaoValida(claims: ClaimsDaSessao): Promise<boolean> {
    const linha = await this.prisma.ajudaSessao.findFirst({
      where: { id: claims.sid, usuarioId: claims.sub },
      select: { fim: true },
    });
    return Boolean(linha && !linha.fim);
  }

  /**
   * O produto ainda está ligado para a escola do token? (Papel de contrato,
   * sem escola, não tem escopo a resolver — como no `DisponibilidadeGuard`.)
   */
  async produtoLigado(claims: ClaimsDaSessao): Promise<boolean> {
    if (!claims.escola) return true;
    try {
      await exigirProdutoDisponivel(this.prisma, claims.escola, "ajuda");
      return true;
    } catch (erro) {
      if (erro instanceof ForbiddenException) return false;
      throw erro;
    }
  }

  /**
   * UM TURNO DO ATENDENTE, no formato que o vendor entende
   * (`chat.completion.chunk` em SSE, ou `chat.completion` inteiro sem stream).
   *
   * Nunca responde erro depois de aceitar a chamada: o vendor fica MUDO diante
   * de um status de erro (medido no spike). Falha do modelo vira `FALA_DE_FALHA`,
   * falada como qualquer resposta.
   *
   * `fala` pronta (produto desligado, excesso de perguntas) pula o modelo: é o
   * caminho de dizer algo à pessoa sem gastar token.
   */
  async responder(
    entrada: { claims: ClaimsDaSessao; mensagens: MensagemOpenAi[]; emFluxo: boolean; comUso: boolean; fala?: string },
    res: RespostaDoStream,
  ): Promise<void> {
    const base = { id: `chatcmpl-${randomUUID()}`, criado: Math.floor(Date.now() / 1000), modelo: MODELO_ANUNCIADO };
    const inicio = Date.now();
    const abortar = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abortar.abort();
    });

    if (entrada.emFluxo) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders();
      res.write(pedacoSse(base, { role: "assistant", content: "" }, null));
    }

    let texto = "";
    let tokens = 0;
    let tokensEntrada = 0;
    let tokensSaida = 0;
    let resultado: "ok" | "falha" | "abortado" | "pronta" = "ok";
    const escrever = (pedaco: string) => {
      texto += pedaco;
      if (entrada.emFluxo && !res.writableEnded) res.write(pedacoSse(base, { content: pedaco }, null));
    };

    if (entrada.fala) {
      resultado = "pronta";
      escrever(entrada.fala);
    } else {
      const historico = paraHistorico(entrada.mensagens);
      if (historico.length === 0) {
        resultado = "pronta";
        escrever("Oi! Em que posso ajudar você na plataforma?");
      } else {
        // Só no stream: sem stream o vendor espera o corpo inteiro de qualquer jeito.
        const espera = entrada.emFluxo
          ? setTimeout(() => {
              if (!texto && !res.writableEnded) res.write(pedacoSse(base, { content: FALA_DE_ESPERA }, null));
            }, this.esperaAteAFalaDeEsperaMs)
          : null;
        try {
          for await (const evento of this.ia.conversarEmFluxo({
            system: promptDoAtendente(entrada.claims.perfil),
            historico,
            maxTokens: MAXIMO_DE_TOKENS_DA_RESPOSTA,
            temperatura: TEMPERATURA,
            sinal: abortar.signal,
          })) {
            if (evento.tipo === "texto") escrever(evento.texto);
            else {
              tokens = evento.resultado.tokensUsados;
              tokensEntrada = evento.resultado.tokensEntrada ?? 0;
              tokensSaida = evento.resultado.tokensSaida ?? 0;
            }
          }
          if (!texto.trim()) escrever(FALA_DE_FALHA);
        } catch (erro) {
          if (abortar.signal.aborted) resultado = "abortado";
          else {
            resultado = "falha";
            logger.error({ codigo: "ajuda.modelo-falhou", sid: entrada.claims.sid, err: erro }, "o modelo não respondeu à Ajuda");
            // Com parte da resposta já falada, o melhor é parar ali; sem nada, a desculpa.
            if (!texto.trim()) escrever(FALA_DE_FALHA);
          }
        } finally {
          if (espera) clearTimeout(espera);
        }
      }
    }

    if (entrada.emFluxo) {
      if (!res.writableEnded) {
        res.write(pedacoSse(base, {}, "stop"));
        if (entrada.comUso) {
          res.write(pedacoSse(base, {}, null, { prompt_tokens: tokensEntrada, completion_tokens: tokensSaida, total_tokens: tokens }));
        }
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } else if (!res.writableEnded) {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          id: base.id,
          object: "chat.completion",
          created: base.criado,
          model: base.modelo,
          choices: [{ index: 0, message: { role: "assistant", content: texto }, finish_reason: "stop" }],
          usage: { prompt_tokens: tokensEntrada, completion_tokens: tokensSaida, total_tokens: tokens },
        }),
      );
    }

    // Só números: a pergunta e a resposta não vão ao log (regra 6 — a pessoa
    // pode ter dito o nome de um estudante em voz alta).
    logger.info(
      {
        codigo: "ajuda.turno",
        sid: entrada.claims.sid,
        perfil: entrada.claims.perfil,
        resultado,
        duracaoMs: Date.now() - inicio,
        tokens,
        caracteres: texto.length,
      },
      "turno da Ajuda",
    );
  }
}

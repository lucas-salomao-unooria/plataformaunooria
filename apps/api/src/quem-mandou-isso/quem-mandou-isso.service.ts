import { Injectable } from "@nestjs/common";
import { Prisma, type Exp05ef1bPacote, type Exp05ef1bSessao } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades, type EquipeDoMapa } from "../equipes/regras";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { FICHA_EXP05EF1B } from "../evidencias/fichas/exp05ef1b";
import { logger } from "../observabilidade/logger";
import { ehUuid } from "../motor/guardas";
import { PrismaService } from "../prisma/prisma.service";
import {
  CALLBACK_DO_MOTIVO,
  DISCIPLINAS,
  ENCAMINHAMENTOS,
  ENCERRAMENTO_DA_NINA,
  EXP_ID,
  FALA_DO_CARTAO,
  FALA_DO_TIO,
  GRUPO,
  INSTRUCOES_DO_CONSOLE,
  MOTIVOS,
  MURAL,
  PACOTE_PADRAO,
  ROTEIRO_DA_RODA,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_MOTIVO,
  VERSAO_DO_INSTRUMENTO,
  falaDaNina,
  mensagensDoPadrao,
  mensagensPublicas,
  type Disciplina,
  type MensagemDoPacote,
  type Motivo,
  type Origem,
} from "./catalogo";
import { MensagemDoPacoteSchema, type CorpoDaAprovacao, type RevelacaoSchema } from "./contrato-de-rotas";
import { gravarFalasDoPodcast } from "../podcast/podcast.service";
import { erroDeJogo } from "./erros";
import { PreparoDaExp05ef1bService, type MotivoDoPadrao } from "./preparo.service";
import { MARCADOR_DA_REGRA, MARCADOR_DA_SELECAO, MARCADOR_DO_CARTAO, nivelCO08 } from "./regras/evidencia";
import {
  RESPOSTAS,
  acertosDoCartao,
  acertosPorOperador,
  frasesDoCartao,
  nivelCO03,
  sementeDoCartao,
  type FraseDoCartao,
  type Resposta,
} from "./regras/operacoes";
import {
  ACOES,
  CONDICOES,
  MAX_TESTES,
  RESULTADO_DO_TESTE,
  ROTULO_DA_ACAO,
  ROTULO_DA_CONDICAO,
  ROTULO_DA_PREVISAO,
  SITUACOES,
  conferirRegra,
  ehSituacao,
  mesmaRegra,
  nivelCO04,
  pegaOAudio,
  regraEmPalavras,
  simular,
  tipoDaAcao,
  type Regra,
  type Situacao,
  type TesteDaRegra,
} from "./regras/regra";
import {
  FASE_DA_ACAO,
  FASE_INICIAL,
  avancarFase,
  faseAtingiu,
  normalizarFase,
  passoEfetivo,
  revelacaoAberta,
  type AcaoDoGate,
  type Fase,
  type MarcosDaSessao,
} from "./regras/passos";
import { conferirSelecao, mesmaSelecao } from "./regras/selecao";
import { progresso, termometro, type GabaritoDaConta, type UnidadeDaConta } from "./regras/termometro";

/**
 * Persistência e regras aplicadas da exp05ef1b v2.2 — Quem Mandou Isso?
 *
 * Molde: a v1 retirada (ADR-114) no funil, no lock e na tenancy; a mecânica é
 * outra. Toda query leva `escola_id` no `where` ALÉM da RLS que o
 * `comTenancy` arma (regra 1, defesa em profundidade).
 *
 * **A aula é determinística.** A única superfície de IA é o preparo PRÉ-AULA
 * (`preparo.service.ts`); o que a turma usa é o pacote que o professor APROVOU.
 *
 * **O gabarito não desce antes da hora.** As mensagens saem por
 * `mensagensPublicas` (um `Omit`), e `revelacao` só é montada depois do voto do
 * estudante E da revelação aberta pela turma — com o gabarito SÓ das três dele.
 */

/** A atividade da evidência (E14) é o PACOTE aprovado; a rodada é a reaplicação. */
interface PacoteDaTurma {
  id: string;
  turmaId: string;
  tema: string;
  mensagens: MensagemDoPacote[];
  rodada: number;
}

interface ContextoDaTurma {
  turmaId: string | null;
  pacote: PacoteDaTurma | null;
  fase: Fase | null;
}

type LinhaDaSessao = Pick<
  Exp05ef1bSessao,
  | "entrouEm"
  | "selecao"
  | "confirmadoEm"
  | "motivo"
  | "votouEm"
  | "frasesOperacoes"
  | "respostasOperacoes"
  | "operacoesEm"
  | "regraTestes"
  | "regraFinal"
  | "regraEm"
  | "concluidoEm"
  | "tempoFeedSegundos"
  | "atualizadoEm"
>;

const CAMPOS_DA_SESSAO = {
  entrouEm: true,
  selecao: true,
  confirmadoEm: true,
  motivo: true,
  votouEm: true,
  frasesOperacoes: true,
  respostasOperacoes: true,
  operacoesEm: true,
  regraTestes: true,
  regraFinal: true,
  regraEm: true,
  concluidoEm: true,
  tempoFeedSegundos: true,
  atualizadoEm: true,
} satisfies Prisma.Exp05ef1bSessaoSelect;

function marcosDe(s: LinhaDaSessao | null | undefined): MarcosDaSessao | null {
  if (!s) return null;
  return {
    entrou: true,
    confirmou: s.confirmadoEm !== null,
    votou: s.votouEm !== null,
    respondeuCartao: s.operacoesEm !== null,
    concluiu: s.concluidoEm !== null,
  };
}

// ── O JSON das ações do Canal A. O CHECK garante a forma no banco; aqui a
//    leitura é defensiva do mesmo jeito que `lerMensagens`: linha gravada por
//    outra versão não pode derrubar a tela.

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function lerRegra(bruto: unknown): Regra | null {
  if (!ehObjeto(bruto) || typeof bruto.condicao !== "string" || !Array.isArray(bruto.acoes)) return null;
  return conferirRegra(bruto.condicao, bruto.acoes.filter((a): a is string => typeof a === "string"));
}

function lerTestes(bruto: Prisma.JsonValue): TesteDaRegra[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((t) => {
    const regra = lerRegra(t);
    if (!regra || !ehObjeto(t) || typeof t.previsao !== "string" || typeof t.situacao !== "string") return [];
    if (!ehSituacao(t.previsao) || !ehSituacao(t.situacao)) return [];
    return [{ regra, previsao: t.previsao, situacao: t.situacao }];
  });
}

function lerRespostas(bruto: Prisma.JsonValue | null): Map<string, Resposta> {
  const mapa = new Map<string, Resposta>();
  if (!Array.isArray(bruto)) return mapa;
  for (const r of bruto) {
    if (ehObjeto(r) && typeof r.fraseId === "string" && (RESPOSTAS as readonly unknown[]).includes(r.resposta)) {
      mapa.set(r.fraseId, r.resposta as Resposta);
    }
  }
  return mapa;
}

function lerFrases(bruto: Prisma.JsonValue | null): FraseDoCartao[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (f): f is FraseDoCartao & Prisma.JsonObject =>
      ehObjeto(f) &&
      typeof f.id === "string" &&
      typeof f.texto === "string" &&
      typeof f.msgId === "string" &&
      (f.operador === "E" || f.operador === "OU" || f.operador === "NAO") &&
      (f.esperado === "sim" || f.esperado === "nao"),
  );
}

function regraMontada(regra: Regra) {
  return { condicao: regra.condicao, acoes: [...regra.acoes], emPalavras: regraEmPalavras(regra) };
}

function ehMotivo(v: string | null): v is Motivo {
  return v !== null && (MOTIVOS as readonly string[]).includes(v);
}

/**
 * As oito mensagens do `Json` da linha, ou `null` se a forma não bate. O Zod
 * validou na ESCRITA, mas uma linha gravada por outra versão chegaria aqui com
 * a forma velha — e o `Json` do Prisma é `unknown` na prática.
 */
function lerMensagens(bruto: Prisma.JsonValue): MensagemDoPacote[] | null {
  const lido = MensagemDoPacoteSchema.array().length(8).safeParse(bruto);
  if (!lido.success) return null;
  return lido.data;
}

/** A forma com que o pacote é GRAVADO: sem espaço sobrando, e legenda só onde ela existe. */
function normalizarMensagens(mensagens: readonly MensagemDoPacote[]): MensagemDoPacote[] {
  const limpar = (t: string) => t.replace(/\s+/g, " ").trim();
  return mensagens.map((m) => {
    const legenda = m.legenda ? limpar(m.legenda) : "";
    return {
      id: m.id,
      remetente: limpar(m.remetente),
      tipo: m.tipo,
      texto: limpar(m.texto),
      ...(m.tipo !== "texto" && legenda ? { legenda } : {}),
      veracidade: m.veracidade,
      tom: m.tom,
    };
  });
}

/** Uma assinatura estável do conteúdo — o JSONB do Postgres reordena chaves, então comparar JSON cru mentiria. */
/**
 * As mensagens são as do banco padrão, como a Unooria as escreveu? É o que
 * decide se o podcast usa as falas do sheet sem IA (ADR-150). Comparadas na
 * forma GRAVADA e pelo id: a tela pode mandar outra ordem e outro espaço.
 */
export function mensagensSaoAsDoPadrao(mensagens: readonly MensagemDoPacote[]): boolean {
  const forma = (lista: readonly MensagemDoPacote[]) =>
    JSON.stringify(normalizarMensagens([...lista].sort((a, b) => a.id.localeCompare(b.id))));
  return forma(mensagens) === forma(mensagensDoPadrao());
}

function assinatura(c: {
  disciplina: string;
  tema: string;
  assuntos: readonly string[];
  contexto: string | null;
  mensagens: readonly MensagemDoPacote[];
}): string {
  return JSON.stringify([
    c.disciplina,
    c.tema,
    [...c.assuntos],
    c.contexto,
    c.mensagens.map((m) => [m.id, m.remetente, m.tipo, m.texto, m.legenda ?? "", m.veracidade, m.tom]),
  ]);
}

function limparTexto(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

interface Recorte {
  disciplina: Disciplina;
  tema: string;
  assuntos: readonly string[];
  contexto?: string | null;
}

function recorteLimpo(r: Recorte) {
  const contexto = r.contexto ? limparTexto(r.contexto) : "";
  return {
    disciplina: r.disciplina,
    tema: limparTexto(r.tema),
    assuntos: r.assuntos.map(limparTexto),
    contexto: contexto || null,
  };
}

function opcoes() {
  return {
    motivos: MOTIVOS.map((id) => ({ id, rotulo: ROTULO_DO_MOTIVO[id] })),
  };
}

/** As peças da regra e as previsões — só id e rótulo: o tipo de cada uma fica aqui. */
function pecas() {
  return {
    condicoes: CONDICOES.map((id) => ({ id, rotulo: ROTULO_DA_CONDICAO[id] })),
    acoes: ACOES.map((id) => ({ id, rotulo: ROTULO_DA_ACAO[id] })),
    previsoes: SITUACOES.map((id) => ({ id, rotulo: ROTULO_DA_PREVISAO[id] })),
  };
}

function padrao() {
  return {
    nome: PACOTE_PADRAO.nome,
    tema: PACOTE_PADRAO.tema,
    assuntos: [...PACOTE_PADRAO.assuntos],
    mensagens: mensagensDoPadrao(),
  };
}

const ROTEIRO = { perguntas: [...ROTEIRO_DA_RODA], instrucoes: { ...INSTRUCOES_DO_CONSOLE } };

/** Uma linha da turma para o painel e para as contas: a criança e a sessão dela nesta rodada. */
interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  sessao: LinhaDaSessao | null;
}

function paraAConta(l: LinhaDaTurma): UnidadeDaConta {
  const s = l.sessao;
  return {
    entrou: Boolean(s),
    selecao: s?.confirmadoEm ? s.selecao : null,
    motivo: s && ehMotivo(s.motivo) ? s.motivo : null,
    respondeuCartao: Boolean(s?.operacoesEm),
    enviouRegra: Boolean(s?.regraEm),
    concluiu: Boolean(s?.concluidoEm),
  };
}

function gabaritoDe(pacote: PacoteDaTurma): GabaritoDaConta {
  return new Map(pacote.mensagens.map((m) => [m.id, { veracidade: m.veracidade, tom: m.tom }]));
}

/**
 * Sem resolvedor de contexto da E14 (desde a 2.4.0): a missão não tem mais
 * pergunta de múltipla escolha — toda marca é de AÇÃO, gravada aqui, na
 * transação da jogada, com a atividade (o pacote) e a rodada que o servidor já
 * conhece. Sem o resolvedor, `GET /evidencias/exp05ef1b/perguntas/*` responde
 * 404 (a ficha não tem pergunta), como na exp08ef1b.
 */
@Injectable()
export class QuemMandouIssoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp05ef1bService,
  ) {}

  // ─────────────────────────────────────────────────────────── leituras

  /**
   * Boot da experiência — READ-ONLY: sem sessão, devolve `abertura`. Sem pacote
   * aprovado, `pacote: null` e a tela é de espera: a missão NASCE VAZIA (o
   * pacote é do tema que o professor escolheu, e mostrar outro faria a criança
   * ler sobre um acontecimento que não existiu na escola dela).
   */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      const estado = await this.montarEstado(tx, escolaId, estudanteId, ctx, sessao);
      const participantes =
        ctx.pacote && turmaId ? await tx.user.count({ where: { escolaId, turmaId, role: "estudante" } }) : 0;

      return {
        ...estado,
        pacote: ctx.pacote
          ? {
              tema: ctx.pacote.tema,
              grupo: { nome: GRUPO.nome, participantes },
              mural: { nome: MURAL.nome },
              // O `Omit` do catálogo: o gabarito não tem onde caber aqui.
              mensagens: mensagensPublicas(ctx.pacote.mensagens),
            }
          : null,
        textos: {
          nina: {
            convite: ctx.pacote ? falaDaNina(ctx.pacote.tema) : null,
            encerramento: ENCERRAMENTO_DA_NINA,
            cartao: FALA_DO_CARTAO,
            tio: FALA_DO_TIO,
          },
        },
        opcoes: { ...opcoes(), ...pecas() },
        limites: { encaminhamentos: ENCAMINHAMENTOS, testes: MAX_TESTES },
      };
    }, escolaId);
  }

  /**
   * O polling do gate (3 s) — leve de propósito: sem pacote e sem contas.
   * Passa pelo MESMO funil das outras rotas (regras 7 e 8): sem ele, um
   * estudante de turma sem liberação descobriria a fase da turma.
   */
  async gate(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      return {
        fase: ctx.pacote ? ctx.fase : null,
        passo: passoEfetivo(marcosDe(sessao), ctx.fase),
        preparada: ctx.pacote !== null,
        atividade: ctx.pacote ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada } : null,
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── mutações

  /**
   * "Entrar no grupo" — abre a sessão desta rodada e carimba `entrou_em`.
   * Idempotente: um F5 não reinicia o relógio do `tempo_feed_segundos`.
   */
  entrar(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (sessao) return;
      await tx.exp05ef1bSessao.createMany({
        data: [
          {
            escolaId,
            estudanteId,
            pacoteId: pacote.id,
            rodada: pacote.rodada,
            turmaId: pacote.turmaId,
            versaoInstrumento: VERSAO_DO_INSTRUMENTO,
          },
        ],
        skipDuplicates: true,
      });
    });
  }

  /**
   * A triagem em andamento: 0 a 3 ids, guardados no servidor (o F5 restaura).
   * Depois do latch, 409 — o Mural não muda mais.
   */
  guardarSelecao(escolaId: string, estudanteId: string, ids: readonly string[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      if (sessao.confirmadoEm) throw erroDeJogo("mural-ja-enviado");
      const conferida = conferirSelecao(ids, new Set(pacote.mensagens.map((m) => m.id)), false);
      if (!conferida.ok) throw erroDeJogo(conferida.codigo);
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { selecao: conferida.selecao },
      });
    });
  }

  /**
   * "Confirmar envio" — O LATCH 1, e o gesto que a EF05CO08 mede.
   *
   * Exatamente 3. Carimbo, seleção e `tempo_feed_segundos` no MESMO UPDATE (o
   * CHECK `confirmado ⇒ 3` vale por statement), e a MARCA da EF05CO08 na MESMA
   * transação: se a evidência falhar, o Mural não fecha — e vice-versa.
   *
   * Idempotente para o duplo toque: a mesma seleção de novo devolve o estado
   * sem marcar outra vez; uma seleção DIFERENTE depois do latch é 409.
   */
  enviarAoMural(escolaId: string, estudanteId: string, ids: readonly string[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      const conferida = conferirSelecao(ids, new Set(pacote.mensagens.map((m) => m.id)), true);
      if (sessao.confirmadoEm) {
        if (conferida.ok && mesmaSelecao(conferida.selecao, sessao.selecao)) return;
        throw erroDeJogo("mural-ja-enviado");
      }
      if (!conferida.ok) throw erroDeJogo(conferida.codigo);

      const agora = new Date();
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          selecao: conferida.selecao,
          confirmadoEm: agora,
          tempoFeedSegundos: Math.max(0, Math.round((agora.getTime() - sessao.entrouEm.getTime()) / 1000)),
        },
      });

      const gabarito = gabaritoDe(pacote);
      const escolhidas = conferida.selecao.map((id) => {
        const g = gabarito.get(id);
        if (!g) throw erroDeJogo("mensagem-desconhecida");
        return g;
      });
      /* Toda rodada mede a EF05CO08 de novo, inclusive no MESMO pacote
         (ADR-145): o resultado da atividade é a melhor rodada de cada
         habilidade, então medir outra vez só pode subir o nível. */
      await this.evidencias.marcar(tx, {
        ...this.marcaDe(escolaId, estudanteId, pacote),
        marcador: MARCADOR_DA_SELECAO,
        status: nivelCO08(escolhidas),
      });
    });
  }

  /** A enquete do Mural — O LATCH 2. O mesmo voto de novo é idempotente; outro, 409. */
  votar(escolaId: string, estudanteId: string, motivo: Motivo) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      if (!sessao.confirmadoEm) throw erroDeJogo("mural-nao-enviado");
      if (sessao.votouEm) {
        if (sessao.motivo === motivo) return;
        throw erroDeJogo("enquete-ja-votada");
      }
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { motivo, votouEm: new Date() },
      });
    });
  }

  /**
   * O CARTÃO DE FRASES (EF05CO03) — o latch 3, e a marca na MESMA transação.
   *
   * Abre quando O ESTUDANTE vê os crachás (voto dado E revelação aberta pela
   * turma), em qualquer fase dali em diante, e fecha quando ele envia: o
   * cartão segue o caminho da criança, não o botão do professor. Quem votou
   * atrasado também responde, e na reflexão ele vem antes da regra.
   *
   * As frases são RECALCULADAS aqui da mesma semente que a tela recebeu (a
   * sessão), e gravadas com a resposta esperada: o cliente só manda "sim" ou
   * "não" por id. A mesma resposta de novo é idempotente; outra, 409.
   */
  responderCartao(escolaId: string, estudanteId: string, respostas: readonly { fraseId: string; resposta: Resposta }[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      if (!sessao.votouEm) throw erroDeJogo("enquete-nao-votada");
      if (!revelacaoAberta(marcosDe(sessao), fase)) throw erroDeJogo("cartao-nao-liberado");
      const enviadas = new Map(respostas.map((r) => [r.fraseId, r.resposta]));

      if (sessao.operacoesEm) {
        const anteriores = lerRespostas(sessao.respostasOperacoes);
        const iguais = anteriores.size === enviadas.size && [...enviadas].every(([id, r]) => anteriores.get(id) === r);
        if (iguais) return;
        throw erroDeJogo("cartao-ja-enviado");
      }

      const frases = this.frasesDe(escolaId, estudanteId, pacote, sessao);
      if (!frases || frases.some((f) => !enviadas.has(f.id))) throw erroDeJogo("payload-invalido");

      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          frasesOperacoes: frases as unknown as Prisma.InputJsonValue,
          respostasOperacoes: frases.map((f) => ({ fraseId: f.id, resposta: enviadas.get(f.id) ?? null })),
          operacoesEm: new Date(),
        },
      });
      await this.evidencias.marcar(tx, {
        ...this.marcaDe(escolaId, estudanteId, pacote),
        marcador: MARCADOR_DO_CARTAO,
        status: nivelCO03(acertosDoCartao(frases, enviadas)),
      });
    });
  }

  /**
   * "Testar no áudio do tio" — a regra e a PREVISÃO. Grava o teste e devolve,
   * no estado, o que a regra fez. Só na reflexão, com o cartão enviado e a
   * regra ainda não enviada; no máximo `MAX_TESTES` (limite técnico).
   *
   * A previsão vem ANTES do resultado e não muda depois: é ela que mostra que
   * a criança simulou a regra. O primeiro teste é o que a régua lê.
   */
  testarRegra(escolaId: string, estudanteId: string, condicao: string, acoes: readonly string[], previsao: Situacao) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      this.exigirEtapaDaRegra(sessao, fase);
      const regra = conferirRegra(condicao, acoes);
      if (!regra) throw erroDeJogo("regra-invalida");
      const testes = Array.isArray(sessao?.regraTestes) ? sessao.regraTestes : [];
      if (testes.length >= MAX_TESTES) throw erroDeJogo("testes-esgotados");
      const teste = { condicao: regra.condicao, acoes: [...regra.acoes], previsao, situacao: simular(regra), em: new Date().toISOString() };
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { regraTestes: [...testes, teste] as Prisma.InputJsonValue },
      });
    });
  }

  /**
   * "Enviar minha regra" — o latch 4, e a marca da EF05CO04 na MESMA
   * transação. Enviar sem testar é permitido (fica "em processo" no máximo).
   * A mesma regra de novo é idempotente; outra, 409.
   */
  enviarRegra(escolaId: string, estudanteId: string, condicao: string, acoes: readonly string[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      const regra = conferirRegra(condicao, acoes);
      if (!regra) throw erroDeJogo("regra-invalida");
      if (sessao?.regraEm) {
        const enviada = lerRegra(sessao.regraFinal);
        if (enviada && mesmaRegra(enviada, regra)) return;
        throw erroDeJogo("regra-ja-enviada");
      }
      this.exigirEtapaDaRegra(sessao, fase);
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { regraFinal: { condicao: regra.condicao, acoes: [...regra.acoes] }, regraEm: new Date() },
      });
      await this.evidencias.marcar(tx, {
        ...this.marcaDe(escolaId, estudanteId, pacote),
        marcador: MARCADOR_DA_REGRA,
        status: nivelCO04(regra, lerTestes(sessao?.regraTestes ?? [])),
      });
    });
  }

  /**
   * O fim da missão, depois da regra do tio. NÃO exige o cartão nem a regra:
   * quem sai antes fica "Não avaliado" nelas (a ausência de marca), nunca "não
   * atingiu". Idempotente.
   */
  concluir(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      if (sessao.concluidoEm) return;
      if (!sessao.votouEm) throw erroDeJogo("enquete-nao-votada");
      if (fase !== "reflexao") throw erroDeJogo("reflexao-nao-liberada");
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { concluidoEm: new Date() },
      });
    });
  }

  // ─────────────────────────────────────────────────────── o professor

  /**
   * O pacote da turma: o ATIVO (aprovado, que a turma usa), o RASCUNHO (o
   * último gerado) e o PADRÃO (o banco curado, sempre à mão). Com o gabarito —
   * é o roteiro do professor.
   */
  async pacoteDaTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [ativo, rascunho] = await Promise.all([
        tx.exp05ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true } }),
        tx.exp05ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } }),
      ]);
      return {
        turma,
        ativo: ativo ? this.paraProfessor(ativo) : null,
        rascunho: rascunho ? this.paraProfessor(rascunho) : null,
        padrao: padrao(),
        disciplinas: DISCIPLINAS.map((slug) => ({ slug, rotulo: ROTULO_DA_DISCIPLINA[slug] })),
      };
    }, escolaId);
  }

  /**
   * "Gerar Atividade com IA" — o RASCUNHO das oito mensagens.
   *
   * A turma é conferida ANTES de gastar token: gerar para uma turma que o
   * professor não leciona seria pagar pelo erro antes de descobri-lo. Falha do
   * vendor ou falta de saldo não bloqueiam: o rascunho sai do banco curado,
   * com `usouIa: false` e o `motivo` que decide a frase da tela.
   *
   * O rascunho é GRAVADO (um por turma, substituído a cada geração): o preparo
   * custou saldo de IA, e um F5 não pode jogá-lo fora.
   */
  async gerar(escolaId: string, turmaId: string, professorId: string, perfil: Perfil, recorte: Recorte) {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
    const limpo = recorteLimpo(recorte);
    const resultado = await this.preparo.gerar(escolaId, professorId, perfil, limpo);

    const conteudo = resultado.mensagens
      ? { ...limpo, origem: "ia" as Origem, mensagens: normalizarMensagens(resultado.mensagens) }
      : {
          disciplina: limpo.disciplina,
          tema: PACOTE_PADRAO.tema,
          assuntos: [...PACOTE_PADRAO.assuntos],
          contexto: null,
          origem: "padrao" as Origem,
          mensagens: mensagensDoPadrao(),
        };

    const rascunho = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const dados = {
        disciplina: conteudo.disciplina,
        tema: conteudo.tema,
        assuntos: conteudo.assuntos,
        contexto: conteudo.contexto,
        origem: conteudo.origem,
        mensagensJson: conteudo.mensagens as unknown as Prisma.InputJsonValue,
      };
      const existente = await tx.exp05ef1bPacote.findFirst({
        where: { escolaId, turmaId, aprovadoEm: null },
        select: { id: true },
      });
      return existente
        ? tx.exp05ef1bPacote.update({ where: { id: existente.id }, data: dados })
        : tx.exp05ef1bPacote.create({ data: { escolaId, turmaId, ...dados } });
    }, escolaId);

    const motivo: MotivoDoPadrao | null = resultado.motivo;
    return { rascunho: this.exigirParaProfessor(rascunho), usouIa: resultado.mensagens !== null, motivo };
  }

  /**
   * "Criar atividade" — o portão da curadoria humana (RF-003).
   *
   * **Aprovar um pacote novo = ATIVIDADE nova** (a evidência E14 é por pacote),
   * e ela nasce PRONTA, não no ar (ADR-130): quem escolhe o que a turma faz é o
   * professor, na lista de atividades (`colocarEmAndamento`). O pacote em
   * andamento continua em andamento — criar a próxima aula não pode tirar do
   * ar a de agora, nem mexer na fase da turma.
   *
   * Idempotente: aprovar de novo EXATAMENTE o pacote aprovado mais recente
   * devolve o mesmo pacote, sem atividade nova (o duplo clique de um professor
   * nervoso). O rascunho, se houver, é o que vira o aprovado (mesmo id).
   */
  /** A guarda de turma, sozinha — a da escrita das falas do podcast, ANTES de gastar token. */
  async exigirTurmaVisivel(escolaId: string, turmaId: string, professorId?: string): Promise<void> {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
  }

  /**
   * O pacote do podcast de recapitulação (ADR-150): o pedido — APROVADO, desta
   * turma — ou o em andamento sem pedido. É a atividade que o professor
   * prepara antes de pôr no ar, como as imagens das outras missões.
   */
  async pacoteParaPodcast(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const id = pacoteId ?? (await this.exigirPacoteAtivo(tx, escolaId, turmaId)).id;
      const linha = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, id);
      const pacote = this.exigirParaProfessor(linha);
      return { id: pacote.id, tema: pacote.tema, origem: pacote.origem, mensagens: pacote.mensagens };
    }, escolaId);
  }

  async aprovar(escolaId: string, turmaId: string, professorId: string, corpo: CorpoDaAprovacao) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const conteudo = { ...recorteLimpo(corpo), mensagens: normalizarMensagens(corpo.mensagens) };

      const ultimo = await tx.exp05ef1bPacote.findFirst({
        where: { escolaId, turmaId, aprovadoEm: { not: null } },
        orderBy: { aprovadoEm: "desc" },
      });
      if (ultimo) {
        const mensagens = lerMensagens(ultimo.mensagensJson);
        if (mensagens && assinatura({ ...ultimo, mensagens }) === assinatura(conteudo)) {
          /* O segundo clique pode trazer as falas do podcast editadas: elas
             valem, mesmo sem atividade nova (ADR-150). */
          await gravarFalasDoPodcast(tx, { escolaId, expId: EXP_ID, atividadeId: ultimo.id, falas: corpo.podcast, aprovadoPor: professorId });
          return this.exigirParaProfessor(ultimo);
        }
      }

      const dados = {
        disciplina: conteudo.disciplina,
        tema: conteudo.tema,
        assuntos: conteudo.assuntos,
        contexto: conteudo.contexto,
        origem: corpo.origem,
        mensagensJson: conteudo.mensagens as unknown as Prisma.InputJsonValue,
        ativo: false,
        rodadaAtual: 1,
        aprovadoEm: new Date(),
        aprovadoPor: professorId,
      };
      const rascunho = await tx.exp05ef1bPacote.findFirst({
        where: { escolaId, turmaId, aprovadoEm: null },
        select: { id: true },
      });
      const aprovado = rascunho
        ? await tx.exp05ef1bPacote.update({ where: { id: rascunho.id }, data: dados })
        : await tx.exp05ef1bPacote.create({ data: { escolaId, turmaId, ...dados } });
      await gravarFalasDoPodcast(tx, { escolaId, expId: EXP_ID, atividadeId: aprovado.id, falas: corpo.podcast, aprovadoPor: professorId });
      return this.exigirParaProfessor(aprovado);
    }, escolaId);
  }

  /**
   * As ATIVIDADES da turma (ADR-130): os pacotes APROVADOS, do mais recente ao
   * mais antigo, com o que está em andamento marcado — a lista de atividades da
   * ficha e o seletor do painel de habilidades. O rascunho não entra: ainda não
   * é atividade.
   */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [aprovados, rodadas] = await Promise.all([
        tx.exp05ef1bPacote.findMany({
          where: { escolaId, turmaId, aprovadoEm: { not: null } },
          orderBy: { aprovadoEm: "desc" },
          select: { id: true, disciplina: true, tema: true, origem: true, ativo: true, rodadaAtual: true, aprovadoEm: true },
        }),
        tx.exp05ef1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.pacoteId, r._max.rodada ?? 0]));
      const emAndamento = aprovados.find((p) => p.ativo);
      return {
        emAndamento: emAndamento ? { pacoteId: emAndamento.id, rodada: emAndamento.rodadaAtual } : null,
        historico: aprovados.map((p) => ({
          id: p.id,
          disciplina: p.disciplina as Disciplina,
          tema: p.tema,
          origem: (p.origem === "ia" ? "ia" : "padrao") as Origem,
          ativo: p.ativo,
          aprovadoEm: (p.aprovadoEm as Date).toISOString(),
          rodadas: maiorRodada.get(p.id) ?? 0,
        })),
      };
    }, escolaId);
  }

  /** UM pacote aprovado, inteiro e com o gabarito — a página da atividade, em andamento ou não. */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, pacoteId);
      const rodadas = await tx.exp05ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      return { ...this.exigirParaProfessor(linha), rodadas: rodadas._max.rodada ?? 0 };
    }, escolaId);
  }

  /**
   * "USAR ESTA ATIVIDADE AGORA" (ADR-130): o professor escolhe, na lista, qual
   * pacote a turma joga. O que estava em andamento volta a ser PRONTO — fica,
   * com as sessões e a evidência —, e a fase da turma volta à triagem: senão a
   * atividade nova abriria com a revelação aberta, e o gabarito desceria na
   * entrada.
   *
   * A RODADA: o pacote que nunca rodou fica na 1; o que já rodou abre a
   * SEGUINTE à última com sessão — retomar a mesma depois da revelação seria o
   * "voltar" que os botões proíbem. As anteriores continuam no painel de
   * habilidades (ADR-112).
   *
   * Idempotente: pôr no ar o que já está no ar não muda nada.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, pacoteId);
      if (pacote.ativo) {
        const gate = await tx.exp05ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase), mudou: false };
      }

      const ultima = await tx.exp05ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      const rodada = (ultima._max.rodada ?? 0) + 1;
      /* Desliga antes de ligar: o índice único PARCIAL aceita um ativo por turma. */
      await tx.exp05ef1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
      await tx.exp05ef1bPacote.update({ where: { id: pacoteId }, data: { ativo: true, rodadaAtual: rodada } });
      await this.voltarATriagem(tx, escolaId, turmaId);
      return { atividade: { pacoteId, rodada }, fase: FASE_INICIAL, mudou: true };
    }, escolaId);
  }

  /**
   * Os três botões do console: revelação, síntese, reflexão. A fase só anda
   * para a FRENTE (`avancarFase`): o clique repetido ou fora de ordem é no-op,
   * e pular a síntese é permitido. É a linha que o polling do estudante lê.
   */
  async mudarGate(escolaId: string, turmaId: string, professorId: string, acao: AcaoDoGate) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      const atual = await tx.exp05ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      const fase = avancarFase(normalizarFase(atual?.fase), FASE_DA_ACAO[acao]);
      const linha = await tx.exp05ef1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, fase },
        update: { fase },
      });
      return {
        turma,
        fase,
        atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual },
        atualizadoEm: linha.atualizadoEm.toISOString(),
      };
    }, escolaId);
  }

  /**
   * "Zerar Turma para Nova Aplicação" — abre a RODADA seguinte do mesmo pacote
   * e APAGA a evidência pedagógica dele, de todas as rodadas (ADR-155): a turma
   * recomeça do zero no painel de habilidades. As sessões da rodada anterior
   * ficam, e a turma recomeça numa sessão nova. A fase volta à triagem.
   *
   * `rodada` é a que o professor VIU: se ela ainda é a atual, avança; se a
   * atual já é a seguinte (o segundo clique), devolve sem avançar de novo; se
   * nenhuma das duas, 409 — outra tela já zerou mais de uma vez.
   */
  async novaRodada(escolaId: string, turmaId: string, professorId: string, rodadaVista: number) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      if (pacote.rodadaAtual === rodadaVista + 1) {
        const gate = await tx.exp05ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase) };
      }
      if (pacote.rodadaAtual !== rodadaVista) throw erroDeJogo("rodada-desatualizada");
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: pacote.id });
      const atualizado = await tx.exp05ef1bPacote.update({
        where: { id: pacote.id },
        data: { rodadaAtual: { increment: 1 } },
        select: { id: true, rodadaAtual: true },
      });
      await this.voltarATriagem(tx, escolaId, turmaId);
      return { atividade: { pacoteId: atualizado.id, rodada: atualizado.rodadaAtual }, fase: FASE_INICIAL };
    }, escolaId);
  }

  /**
   * O PAINEL — a folha nominal e o Termômetro, POR COMPUTADOR quando há equipe.
   *
   * Parte de `users.turma_id` (a fonte dos painéis de missão e das equipes);
   * `users` está fora da RLS, e o `escolaId` no `where` é a tranca. As equipes
   * são lidas DENTRO do `comTenancy` (fora dele voltariam vazias, em silêncio,
   * e o painel contaria por criança) e colapsadas em unidades
   * (`colapsarEmUnidades`): a linha de quem jogou representa o computador.
   *
   * Antes da revelação, SÓ progresso; o Termômetro é `null`. Nenhum nome entra
   * nele. Não há texto livre de menor: o cartão vai como acertos e a regra
   * em palavras montadas das peças — a mesma linha para professor e gestor.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const leitura = await this.lerATurma(tx, escolaId, turmaId, ctx.pacote);
      const contas = leitura.unidades.map((u) => paraAConta(u.linha));

      return {
        turma,
        atividade: ctx.pacote ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, tema: ctx.pacote.tema } : null,
        fase: ctx.pacote ? ctx.fase : null,
        porComputador: leitura.mapa.size > 0,
        progresso: progresso(contas),
        termometro:
          ctx.pacote && faseAtingiu(ctx.fase, "revelacao") ? termometro(contas, gabaritoDe(ctx.pacote)) : null,
        linhas: leitura.unidades.map(({ linha, equipe }) => {
          const s = linha.sessao;
          return {
            estudanteId: linha.estudanteId,
            nome: linha.nome,
            equipe: equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros.map((m) => ({ ...m })) } : null,
            passo: passoEfetivo(marcosDe(s), ctx.fase),
            selecao: s?.confirmadoEm ? s.selecao : null,
            motivo: s && ehMotivo(s.motivo) ? s.motivo : null,
            tempoFeedSegundos: s?.tempoFeedSegundos ?? null,
            cartao: s?.operacoesEm ? this.cartaoDaFolha(s) : null,
            regra: (() => {
              const enviada = s?.regraEm ? lerRegra(s.regraFinal) : null;
              return enviada && s ? { emPalavras: regraEmPalavras(enviada), testes: lerTestes(s.regraTestes).length } : null;
            })(),
          };
        }),
        roteiro: ROTEIRO,
      };
    }, escolaId);
  }

  /**
   * O material do GUIA DA AULA: o banco curado COM gabarito, o roteiro, e as
   * duas ações de evidência por dentro — um cartão de frases do banco curado
   * já com a resposta esperada, e as peças da regra com o tipo de cada uma
   * (o gabarito da regra, que só o professor vê). Catálogo da missão, igual
   * para todo contrato: sem tenancy.
   */
  material() {
    /* O exemplo do guia: as três primeiras mensagens do banco curado, que
       misturam verdadeira e falsa — uma trinca como as que a criança forma. */
    const exemplo = mensagensDoPadrao().slice(0, ENCAMINHAMENTOS);
    return {
      padrao: { ...padrao(), convite: falaDaNina(PACOTE_PADRAO.tema) },
      roteiro: ROTEIRO,
      textos: { encerramento: ENCERRAMENTO_DA_NINA, cartao: FALA_DO_CARTAO, tio: FALA_DO_TIO },
      cartao: {
        exemplo: frasesDoCartao(exemplo, "guia").map((f) => ({ operador: f.operador, texto: f.texto, esperado: f.esperado })),
      },
      regra: {
        condicoes: CONDICOES.map((id) => ({ id, rotulo: ROTULO_DA_CONDICAO[id], pegaOAudio: pegaOAudio(id) })),
        acoes: ACOES.map((id) => ({ id, rotulo: ROTULO_DA_ACAO[id], tipo: tipoDaAcao(id) })),
        previsoes: SITUACOES.map((id) => ({ id, rotulo: ROTULO_DA_PREVISAO[id] })),
      },
      habilidades: FICHA_EXP05EF1B.habilidades.map((h) => ({
        codigo: h.codigo,
        rotulo: h.marcadores[0]?.rotulo ?? h.codigo,
        criterios: { atingiu: h.criterios.atingiu, em_processo: h.criterios.em_processo, nao_atingiu: h.criterios.nao_atingiu },
      })),
      opcoes: opcoes(),
    };
  }

  // ─────────────────────────────────────────────────────────── privados

  /** O cartão enviado, como a folha do professor o lê: acertos e por operador (o nível é da evidência). */
  private cartaoDaFolha(s: LinhaDaSessao) {
    const frases = lerFrases(s.frasesOperacoes);
    const respostas = lerRespostas(s.respostasOperacoes);
    return { acertos: acertosDoCartao(frases, respostas), porOperador: acertosPorOperador(frases, respostas) };
  }

  /** O estado do estudante, depois de uma leitura ou de uma mutação. */
  private async montarEstado(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    ctx: ContextoDaTurma,
    sessao: LinhaDaSessao | null,
  ) {
    const marcos = marcosDe(sessao);
    const pacote = ctx.pacote;

    let revelacao: z.infer<typeof RevelacaoSchema> | null = null;
    if (pacote && sessao && ehMotivo(sessao.motivo) && revelacaoAberta(marcos, ctx.fase)) {
      const gabarito = gabaritoDe(pacote);
      const leitura = await this.lerATurma(tx, escolaId, pacote.turmaId, pacote);
      const conta = termometro(
        leitura.unidades.map((u) => paraAConta(u.linha)),
        gabarito,
      );
      revelacao = {
        mensagens: sessao.selecao.flatMap((id) => {
          const m = pacote.mensagens.find((x) => x.id === id);
          return m ? [{ id: m.id, veracidade: m.veracidade, tom: m.tom }] : [];
        }),
        motivo: sessao.motivo,
        callback: CALLBACK_DO_MOTIVO[sessao.motivo],
        turma: {
          unidades: conta.unidades,
          falsaNeutra: conta.falsaNeutra.percentual,
          verdadeiraEmocionalDescartada: conta.verdadeiraEmocionalDescartada.percentual,
        },
      };
    }

    /* O cartão desce junto com a revelação do estudante (depende do gabarito
       das três dele) — e sem a resposta esperada. */
    const frases = revelacao && pacote && sessao ? this.frasesDe(escolaId, estudanteId, pacote, sessao) : null;
    const cartao = frases
      ? {
          frases: frases.map((f) => ({ id: f.id, operador: f.operador, texto: f.texto })),
          enviado: Boolean(sessao?.operacoesEm),
        }
      : null;

    const passo = passoEfetivo(marcos, ctx.fase);
    const regra =
      sessao && (passo === "regra" || passo === "concluida") && sessao.operacoesEm
        ? (() => {
            const testes = lerTestes(sessao.regraTestes);
            const enviada = lerRegra(sessao.regraFinal);
            return {
              testes: testes.map((t) => ({
                ...regraMontada(t.regra),
                previsao: t.previsao,
                situacao: t.situacao,
                resultado: RESULTADO_DO_TESTE[t.situacao],
              })),
              podeTestar: !sessao.regraEm && !sessao.concluidoEm && testes.length < MAX_TESTES,
              enviada: enviada ? regraMontada(enviada) : null,
            };
          })()
        : null;

    return {
      passo,
      fase: pacote ? ctx.fase : null,
      preparada: pacote !== null,
      atividade: pacote ? { pacoteId: pacote.id, rodada: pacote.rodada } : null,
      selecao: sessao?.selecao ?? [],
      confirmado: Boolean(sessao?.confirmadoEm),
      motivo: sessao && ehMotivo(sessao.motivo) ? sessao.motivo : null,
      concluido: Boolean(sessao?.concluidoEm),
      revelacao,
      cartao,
      regra,
    };
  }

  /**
   * A TURMA desta rodada, colapsada em UNIDADES (um computador = uma equipe, ou
   * uma criança sozinha). Uma consulta para as sessões de todos — nunca uma por
   * criança: o painel e a revelação são lidos em polling com a sala inteira.
   */
  private async lerATurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    pacote: PacoteDaTurma | null,
  ) {
    const estudantes = await tx.user.findMany({
      where: { escolaId, turmaId, role: "estudante" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
    const sessoes = pacote
      ? await tx.exp05ef1bSessao.findMany({
          where: {
            escolaId,
            pacoteId: pacote.id,
            rodada: pacote.rodada,
            estudanteId: { in: estudantes.map((e) => e.id) },
          },
          select: { estudanteId: true, ...CAMPOS_DA_SESSAO },
        })
      : [];
    const sessaoDe = new Map(sessoes.map((s) => [s.estudanteId, s]));
    const linhas: LinhaDaTurma[] = estudantes.map((e) => ({
      estudanteId: e.id,
      nome: e.displayName,
      sessao: sessaoDe.get(e.id) ?? null,
    }));
    /* A equipe é da ATIVIDADE (ADR-130): a deste pacote. Sem pacote aprovado
       não há atividade, e o painel conta por criança. */
    const mapa: Map<string, EquipeDoMapa> = pacote
      ? await mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, pacote.id)
      : new Map();
    const unidades = colapsarEmUnidades(
      linhas,
      (l) => l.estudanteId,
      mapa,
      (l) => l.sessao !== null,
      (l) => l.sessao?.atualizadoEm.getTime() ?? 0,
    );
    return { unidades, mapa };
  }

  /** O pacote ativo e a fase da turma. `turmaId` nulo = sem sala, e sem pacote. */
  private async contextoDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
  ): Promise<ContextoDaTurma> {
    if (!turmaId) return { turmaId: null, pacote: null, fase: null };
    const [linha, gate] = await Promise.all([
      tx.exp05ef1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true, turmaId: true, tema: true, mensagensJson: true, rodadaAtual: true },
      }),
      tx.exp05ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } }, select: { fase: true } }),
    ]);
    if (!linha) return { turmaId, pacote: null, fase: null };
    const mensagens = lerMensagens(linha.mensagensJson);
    if (!mensagens) {
      /* Sem isto o sintoma seria uma turma com pacote aprovado em que a missão
         insiste em "o grupo ainda está sendo organizado" — e nada diria por quê. */
      logger.warn({ codigo: "exp05ef1b-pacote-invalido", escolaId, turmaId }, "pacote ativo com forma inesperada");
      return { turmaId, pacote: null, fase: null };
    }
    return {
      turmaId,
      pacote: { id: linha.id, turmaId: linha.turmaId, tema: linha.tema, mensagens, rodada: linha.rodadaAtual },
      fase: normalizarFase(gate?.fase),
    };
  }

  private chave(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, estudanteId, pacoteId: pacote.id, rodada: pacote.rodada };
  }

  /** A marca de uma ação desta missão: a atividade é o pacote, a rodada é a da turma. */
  private marcaDe(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, expId: EXP_ID, turmaId: pacote.turmaId, atividadeId: pacote.id, rodada: pacote.rodada, estudanteId };
  }

  /**
   * As seis frases do cartão desta sessão: as GRAVADAS, se ele já foi enviado
   * (a foto da tentativa), ou as calculadas da semente — as mesmas que a tela
   * recebeu. `null` sem as três mensagens do Mural.
   */
  private frasesDe(
    escolaId: string,
    estudanteId: string,
    pacote: PacoteDaTurma,
    sessao: LinhaDaSessao,
  ): FraseDoCartao[] | null {
    if (sessao.operacoesEm) {
      const gravadas = lerFrases(sessao.frasesOperacoes);
      if (gravadas.length > 0) return gravadas;
    }
    const mensagens = sessao.selecao.flatMap((id) => pacote.mensagens.filter((m) => m.id === id));
    if (mensagens.length !== ENCAMINHAMENTOS) return null;
    return frasesDoCartao(mensagens, sementeDoCartao(escolaId, estudanteId, pacote));
  }

  /** A guarda da regra do tio: na reflexão, depois do cartão, antes de enviar e de concluir. */
  private exigirEtapaDaRegra(sessao: LinhaDaSessao | null, fase: Fase | null): asserts sessao is LinhaDaSessao {
    if (!sessao) throw erroDeJogo("grupo-nao-aberto");
    if (!sessao.votouEm) throw erroDeJogo("enquete-nao-votada");
    if (fase !== "reflexao") throw erroDeJogo("reflexao-nao-liberada");
    if (!sessao.operacoesEm) throw erroDeJogo("cartao-pendente");
    if (sessao.regraEm || sessao.concluidoEm) throw erroDeJogo("regra-ja-enviada");
  }

  private sessaoDe(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    pacote: PacoteDaTurma,
  ): Promise<LinhaDaSessao | null> {
    return tx.exp05ef1bSessao.findUnique({
      where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
      select: CAMPOS_DA_SESSAO,
    });
  }

  /**
   * O FUNIL de toda rota de estudante: a escola do token e a missão liberada
   * na turma (ADR-69, e a disponibilidade da ADR-87 dentro dela). Mora AQUI, e
   * não em cada rota: `/exp/:expId` é endereço adivinhável, e rota nova nasce
   * protegida sem ninguém lembrar de protegê-la.
   *
   * A turma é a de `users.turma_id` — a MESMA fonte do painel e das equipes.
   * Uma turma lida do token poderia divergir dela, e a criança jogaria numa
   * sala que o painel do professor não mostra.
   */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({
      where: { id: estudanteId },
      select: { escolaId: true, turmaId: true },
    });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId: estudante.turmaId };
  }

  /**
   * Núcleo de toda mutação: funil, lock por (escola, estudante), o pacote e a
   * fase lidos UMA vez, o trabalho, e o estado relido. Dois toques rápidos
   * viram duas transações em fila — a segunda relê o estado com a primeira
   * aplicada. Os CHECKs do banco são a rede final.
   */
  private comSessao(
    escolaId: string,
    estudanteId: string,
    trabalho: (
      tx: Prisma.TransactionClient,
      pacote: PacoteDaTurma,
      sessao: LinhaDaSessao | null,
      fase: Fase | null,
    ) => Promise<void>,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp05ef1b:${escolaId}:${estudanteId}`}, 0))`;
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const pacote = ctx.pacote;
      if (!pacote) throw erroDeJogo("grupo-em-preparo");
      await trabalho(tx, pacote, await this.sessaoDe(tx, escolaId, estudanteId, pacote), ctx.fase);
      return this.montarEstado(tx, escolaId, estudanteId, ctx, await this.sessaoDe(tx, escolaId, estudanteId, pacote));
    }, escolaId);
  }

  /**
   * Escola do token E matrícula de professor na turma. **404, nunca 403**: um
   * "sem permissão" contaria que a turma existe (o desenho de `salas`).
   * `professorId` indefinido = gestor, que lê a escola.
   */
  private async turmaVisivel(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({
      where: { id: turmaId, escolaId },
      select: { id: true, nome: true, serie: true },
    });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw erroDeJogo("turma-nao-encontrada");
    }
    return turma;
  }

  /** Lock por TURMA: dois professores (ou dois cliques) não intercalam aprovação, fase e rodada. */
  private async travarTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp05ef1b-turma:${escolaId}:${turmaId}`}, 0))`;
  }

  /** O pacote APROVADO desta turma, ou 404 — o rascunho e o de outra turma não são atividade daqui. */
  private async pacoteAprovadoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp05ef1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId, aprovadoEm: { not: null } } })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  private async exigirPacoteAtivo(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    const pacote = await tx.exp05ef1bPacote.findFirst({
      where: { escolaId, turmaId, ativo: true },
      select: { id: true, rodadaAtual: true },
    });
    if (!pacote) throw erroDeJogo("pacote-nao-aprovado");
    return pacote;
  }

  private voltarATriagem(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    return tx.exp05ef1bGateTurma.upsert({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      create: { escolaId, turmaId, fase: FASE_INICIAL },
      update: { fase: FASE_INICIAL },
    });
  }

  /** O pacote como o professor o vê. Linha com forma inesperada vira `null` (e um aviso no log). */
  private paraProfessor(linha: Exp05ef1bPacote) {
    const mensagens = lerMensagens(linha.mensagensJson);
    if (!mensagens || !(DISCIPLINAS as readonly string[]).includes(linha.disciplina)) {
      logger.warn({ codigo: "exp05ef1b-pacote-invalido", escolaId: linha.escolaId, turmaId: linha.turmaId }, "pacote com forma inesperada");
      return null;
    }
    return {
      id: linha.id,
      disciplina: linha.disciplina as Disciplina,
      tema: linha.tema,
      assuntos: linha.assuntos,
      contexto: linha.contexto,
      origem: (linha.origem === "ia" ? "ia" : "padrao") as Origem,
      mensagens,
      aprovadoEm: linha.aprovadoEm?.toISOString() ?? null,
      ativo: linha.ativo,
      rodadaAtual: linha.rodadaAtual,
      criadoEm: linha.criadoEm.toISOString(),
      atualizadoEm: linha.atualizadoEm.toISOString(),
    };
  }

  /** Para o pacote que ACABOU de ser gravado: a forma é a nossa, e `null` aqui seria defeito. */
  private exigirParaProfessor(linha: Exp05ef1bPacote) {
    const pacote = this.paraProfessor(linha);
    if (!pacote) throw new Error("o pacote gravado não voltou legível");
    return pacote;
  }
}

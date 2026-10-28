import { Injectable } from "@nestjs/common";
import { Prisma, type Exp03em1bPacote } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { FICHA_EXP03EM1B } from "../evidencias/fichas/exp03em1b";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  CARTAO_DISTORCIDO,
  CONCLUSAO,
  DISCIPLINAS,
  EXP_ID,
  INSTRUCOES_DO_GATE,
  LAUDO,
  MOTIVO_DA_DISTORCAO,
  MOTIVOS_DA_PERICIA,
  PACOTE_PADRAO,
  PERICIA,
  RIVAL,
  ROTEIRO_DO_DEBATE,
  ROTULO_DA_DISCIPLINA,
  SERIE_HISTORICA,
  SLOTS_DE_PUBLICACAO,
  TEXTOS_DO_CHAT,
  VERSAO_DO_INSTRUMENTO,
  conteudoDoPadrao,
  nomeDoGrupo,
  type ConteudoDoPacote,
  type Disciplina,
  type EtapaDoGate,
  type ItemDoPacote,
  type Marco,
  type MotivoDaPericia,
  type Origem,
} from "./conteudo";
import { ConteudoBaseSchema, type SessaoSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PreparoDaExp03em1bService } from "./preparo.service";
import {
  MARCADOR_CO12,
  MARCADOR_CO13,
  MARCADOR_CO14,
  MARCADOR_CO21,
  MARCADOR_CO22,
  MARCADOR_CO26,
  nivelCO12,
  nivelCO13,
  nivelCO14,
  nivelCO21,
  nivelCO22,
  nivelCO26,
  type Parecer,
} from "./regras/evidencia";
import { problemasDoConteudo } from "./regras/pacote";
import { ETAPA_INICIAL, PASSOS, avancarEtapa, normalizarEtapa, passoEfetivo, pausada, type MarcosDaSessao, type Passo } from "./regras/passos";
import { mesmoParecer } from "./regras/pericia";
import { mesmaPublicacao, type Publicacao } from "./regras/publicacao";

/**
 * Persistência e regras aplicadas da exp03em1b — O Porta-Voz dos Dados
 * (ADR-198). Molde: `efeito-amplificador` (o funil, os locks, o pacote como
 * atividade, a rodada como reaplicação, o gate da turma com histórico).
 * Toda query leva `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma
 * (regra 1, defesa em profundidade).
 *
 * **A aula não chama IA**: o Assistente de Dados é determinístico sobre o
 * pacote homologado. **O gabarito não desce**: os cartões da perícia vão como
 * peças, e o servidor responde ao parecer sem dizer se acertou. As marcas da
 * evidência entram na transação de cada gesto (regras/evidencia.ts diz quando).
 */

interface PacoteDaTurma {
  id: string;
  turmaId: string;
  tema: string;
  conteudo: ConteudoDoPacote;
  rodada: number;
}

interface ContextoDaTurma {
  turmaId: string | null;
  pacote: PacoteDaTurma | null;
  etapa: EtapaDoGate | null;
}

const CAMPOS_DA_SESSAO = {
  chatAbertoEm: true,
  anexoAbertoEm: true,
  nudgeE2Em: true,
  compositorAbertoEm: true,
  slotsRestantes: true,
  publicadaEm: true,
  errataEm: true,
  errataPulada: true,
  periciaAbertaEm: true,
  sinalizouA: true,
  motivoA: true,
  sinalizouB: true,
  motivoB: true,
  parecerEm: true,
  pulouPericia: true,
  concluidoEm: true,
  atualizadoEm: true,
  publicacoes: { select: { tipo: true, escala: true, explicacao: true, fonte: true, contexto: true, publicadaEm: true } },
} satisfies Prisma.Exp03em1bSessaoSelect;

type LinhaDaSessao = Prisma.Exp03em1bSessaoGetPayload<{ select: typeof CAMPOS_DA_SESSAO }>;
type PublicacaoGravada = Publicacao & { publicadaEm: Date };

function marcosDe(s: LinhaDaSessao | null | undefined): MarcosDaSessao | null {
  if (!s) return null;
  return {
    chatAberto: s.chatAbertoEm !== null,
    compositorAberto: s.compositorAbertoEm !== null,
    publicou: s.publicadaEm !== null,
    errataDecidida: s.errataEm !== null,
    periciaAberta: s.periciaAbertaEm !== null,
    concluiu: s.concluidoEm !== null,
  };
}

function publicacaoDe(s: LinhaDaSessao | null | undefined, tipo: "inicial" | "errata"): PublicacaoGravada | null {
  const p = s?.publicacoes.find((x) => x.tipo === tipo);
  if (!p || (p.escala !== 0 && p.escala !== 80)) return null;
  return { escala: p.escala, explicacao: p.explicacao, fonte: p.fonte, contexto: p.contexto, publicadaEm: p.publicadaEm };
}

function motivo(v: string | null): MotivoDaPericia | null {
  return v !== null && (MOTIVOS_DA_PERICIA as readonly string[]).includes(v) ? (v as MotivoDaPericia) : null;
}

function parecerDe(s: LinhaDaSessao): Parecer | null {
  if (!s.parecerEm || s.sinalizouA === null || s.sinalizouB === null) return null;
  return { sinalizouA: s.sinalizouA, motivoA: motivo(s.motivoA), sinalizouB: s.sinalizouB, motivoB: motivo(s.motivoB) };
}

/** O conteúdo do `Json` da linha, ou `null` se a forma não bate (linha de outra versão). */
function lerConteudo(bruto: Prisma.JsonValue): ConteudoDoPacote | null {
  const lido = ConteudoBaseSchema.safeParse(bruto);
  return lido.success ? (lido.data as ConteudoDoPacote) : null;
}

/** JSON com as chaves em ordem: o JSONB reordena, e a comparação crua mentiria. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

const limpar = (t: string) => t.replace(/\s+/g, " ").trim();

function recorteLimpo(r: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null }) {
  const contexto = r.contexto ? limpar(r.contexto) : "";
  return { disciplina: r.disciplina, tema: limpar(r.tema), assuntos: r.assuntos.map(limpar), contexto: contexto || null };
}

function padrao() {
  return { nome: PACOTE_PADRAO.nome, disciplina: PACOTE_PADRAO.disciplina, tema: PACOTE_PADRAO.tema, assuntos: [...PACOTE_PADRAO.assuntos], conteudo: conteudoDoPadrao() };
}

const ROTEIRO = { perguntas: [...ROTEIRO_DO_DEBATE], instrucoes: { ...INSTRUCOES_DO_GATE } };

/** Os textos fixos do estudante — cópias, para ninguém mexer no catálogo pela resposta. */
function textosFixos(): z.infer<typeof SessaoSchema>["textos"] {
  return {
    chat: { ...TEXTOS_DO_CHAT, escalas: { ...TEXTOS_DO_CHAT.escalas } },
    laudo: {
      ...LAUDO,
      alturas: { origem0: { ...LAUDO.alturas.origem0 }, origem80: { ...LAUDO.alturas.origem80 } },
      regua: { ...LAUDO.regua },
    },
    pericia: {
      ...PERICIA,
      dados: { ...PERICIA.dados, periodos: PERICIA.dados.periodos.map((p) => ({ ...p })) },
      cartoes: PERICIA.cartoes.map((c) => ({ ...c, eixo: { ...c.eixo } })),
      motivos: { ...PERICIA.motivos },
    },
    conclusao: { ...CONCLUSAO },
  };
}

type Recorte = { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null };

@Injectable()
export class PortaVozDosDadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp03em1bService,
  ) {}

  // ─────────────────────────────────────────────────────────── o estudante

  /**
   * `GET sessao` — READ-ONLY: o pacote, o gate da turma, as publicações e a
   * perícia. Sem pacote no ar, `preparada: false` e a tela é de espera. É
   * também o polling da pausa (~3 s).
   */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      return this.montarEstado(ctx, sessao);
    }, escolaId);
  }

  /**
   * Um MARCO informado pela tela, com o carimbo do servidor (a primeira vez
   * vale): o chat aberto, o anexo, o nudge de 90 s da E2, o compositor, a
   * perícia. O compositor carimba o chat junto (abrir um implica o outro); a
   * perícia só depois da errata decidida.
   */
  marco(escolaId: string, estudanteId: string, marco: Marco) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      if (s.concluidoEm) return;
      const agora = new Date();
      const data: Prisma.Exp03em1bSessaoUpdateInput = {};
      switch (marco) {
        case "chat_aberto":
          if (!s.chatAbertoEm) data.chatAbertoEm = agora;
          break;
        case "anexo_aberto":
          if (!s.anexoAbertoEm) data.anexoAbertoEm = agora;
          break;
        case "nudge_e2":
          if (!s.nudgeE2Em) data.nudgeE2Em = agora;
          break;
        case "compositor_aberto":
          if (!s.chatAbertoEm) data.chatAbertoEm = agora;
          if (!s.compositorAbertoEm) data.compositorAbertoEm = agora;
          break;
        case "pericia_aberta":
          if (!s.errataEm) throw erroDeJogo("errata-pendente");
          if (!s.periciaAbertaEm) data.periciaAbertaEm = agora;
          break;
      }
      if (Object.keys(data).length === 0) return;
      await tx.exp03em1bSessao.update({ where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) }, data });
    });
  }

  /**
   * "Confirmar Envio" (API-007) — o LATCH 1: a 1ª publicação, o slot 1 gasto
   * (3 → 2) e a EM13CO13 marcada, na MESMA transação. O compositor e o chat
   * que a tela não informou são carimbados agora. A mesma publicação de novo é
   * idempotente; outra, 409 `ja-publicado`.
   */
  publicar(escolaId: string, estudanteId: string, pub: Publicacao) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      const inicial = publicacaoDe(s, "inicial");
      if (s.publicadaEm || inicial) {
        if (inicial && mesmaPublicacao(inicial, pub)) return;
        throw erroDeJogo("ja-publicado");
      }
      const agora = new Date();
      const compositorAbertoEm = s.compositorAbertoEm ?? agora;
      await tx.exp03em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { chatAbertoEm: s.chatAbertoEm ?? agora, compositorAbertoEm, publicadaEm: agora, slotsRestantes: SLOTS_DE_PUBLICACAO - 1 },
      });
      await tx.exp03em1bPublicacao.create({ data: { ...this.chave(escolaId, estudanteId, pacote), turmaId: pacote.turmaId, tipo: "inicial", ...pub, publicadaEm: agora } });
      await this.evidencias.marcar(tx, {
        ...this.marcaDe(escolaId, estudanteId, pacote),
        marcador: MARCADOR_CO13,
        status: nivelCO13({ anexoAbertoEm: s.anexoAbertoEm, nudgeE2Em: s.nudgeE2Em, compositorAbertoEm }),
      });
    });
  }

  /**
   * "Publicar Errata Corretiva" (API-008) — o slot 2 (2 → 1), só depois da
   * retomada liberada. A 1ª fica no histórico (é outra linha). Marca as quatro
   * habilidades do conjunto FINAL na mesma transação.
   */
  publicarErrata(escolaId: string, estudanteId: string, pub: Publicacao) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      const inicial = this.exigirErrataAberta(s, etapa);
      if (s.errataEm) {
        const errata = publicacaoDe(s, "errata");
        if (errata && mesmaPublicacao(errata, pub)) return;
        throw erroDeJogo("errata-ja-decidida");
      }
      const agora = new Date();
      await tx.exp03em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { errataEm: agora, errataPulada: false, slotsRestantes: SLOTS_DE_PUBLICACAO - 2 },
      });
      await tx.exp03em1bPublicacao.create({ data: { ...this.chave(escolaId, estudanteId, pacote), turmaId: pacote.turmaId, tipo: "errata", ...pub, publicadaEm: agora } });
      await this.marcarOConjunto(tx, escolaId, estudanteId, pacote, inicial, pub);
    });
  }

  /** "Avançar sem publicar errata" (API-009): o slot fica; o conjunto final é a 1ª. Idempotente. */
  pularErrata(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      const inicial = this.exigirErrataAberta(s, etapa);
      if (s.errataEm) {
        if (s.errataPulada) return;
        throw erroDeJogo("errata-ja-decidida");
      }
      await tx.exp03em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { errataEm: new Date(), errataPulada: true },
      });
      await this.marcarOConjunto(tx, escolaId, estudanteId, pacote, inicial, null);
    });
  }

  /** "Emitir parecer" (API-010): o parecer em colunas, a conclusão e a EM13CO14. O mesmo de novo: idempotente. */
  emitirParecer(escolaId: string, estudanteId: string, parecer: Parecer) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      if (!s.errataEm) throw erroDeJogo("errata-pendente");
      if (s.concluidoEm) {
        const gravado = parecerDe(s);
        if (gravado && mesmoParecer(gravado, parecer)) return;
        throw erroDeJogo("pericia-ja-concluida");
      }
      const agora = new Date();
      await tx.exp03em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { periciaAbertaEm: s.periciaAbertaEm ?? agora, ...parecer, parecerEm: agora, concluidoEm: agora },
      });
      await this.evidencias.marcar(tx, { ...this.marcaDe(escolaId, estudanteId, pacote), marcador: MARCADOR_CO14, status: nivelCO14(parecer) });
    });
  }

  /** "Avançar sem emitir parecer" (API-011): conclui, e a EM13CO14 fica "não atingiu". Idempotente. */
  pularPericia(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      if (!s.errataEm) throw erroDeJogo("errata-pendente");
      if (s.concluidoEm) {
        if (s.pulouPericia) return;
        throw erroDeJogo("pericia-ja-concluida");
      }
      const agora = new Date();
      await tx.exp03em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { periciaAbertaEm: s.periciaAbertaEm ?? agora, pulouPericia: true, concluidoEm: agora },
      });
      await this.evidencias.marcar(tx, { ...this.marcaDe(escolaId, estudanteId, pacote), marcador: MARCADOR_CO14, status: nivelCO14(null) });
    });
  }

  // ─────────────────────────────────────────────────────────── o professor

  /** API-001: o rascunho e os homologados da turma, o em andamento, o banco padrão e os componentes. */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [linhas, rodadas] = await Promise.all([
        tx.exp03em1bPacote.findMany({
          where: { escolaId, turmaId },
          orderBy: [{ criadoEm: "desc" }],
          select: { id: true, turmaId: true, disciplina: true, tema: true, origem: true, ativo: true, rodadaAtual: true, aprovadoEm: true, criadoEm: true },
        }),
        tx.exp03em1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.pacoteId, r._max.rodada ?? 0]));
      const ativo = linhas.find((p) => p.ativo);
      return {
        turma,
        emAndamento: ativo ? { pacoteId: ativo.id, rodada: ativo.rodadaAtual } : null,
        pacotes: linhas
          .filter((p) => (DISCIPLINAS as readonly string[]).includes(p.disciplina))
          .map((p) => ({
            id: p.id,
            turmaId: p.turmaId,
            origem: (p.origem === "ia" ? "ia" : "padrao") as Origem,
            disciplina: p.disciplina as Disciplina,
            tema: p.tema,
            ativo: p.ativo,
            aprovadoEm: p.aprovadoEm?.toISOString() ?? null,
            criadoEm: p.criadoEm.toISOString(),
            rodadas: maiorRodada.get(p.id) ?? 0,
          })),
        padrao: padrao(),
        disciplinas: DISCIPLINAS.map((slug) => ({ slug, rotulo: ROTULO_DA_DISCIPLINA[slug] })),
      };
    }, escolaId);
  }

  /** UM pacote da turma (rascunho ou homologado), inteiro. */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const rodadas = await tx.exp03em1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: linha.id }, _max: { rodada: true } });
      return { ...this.exigirParaProfessor(linha), rodadas: rodadas._max.rodada ?? 0 };
    }, escolaId);
  }

  /**
   * "Gerar Pacote" (API-002) — o RASCUNHO, um por turma (o índice parcial). A
   * turma é conferida ANTES de gastar token; sem saldo ou com o vendor fora, o
   * rascunho sai do banco curado (`usouIa: false` e o `motivo`). Não homologa.
   */
  async gerar(escolaId: string, turmaId: string, professorId: string, perfil: Perfil, recorte: Recorte) {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
    const limpo = recorteLimpo(recorte);
    const r = await this.preparo.gerar(escolaId, professorId, perfil, limpo);
    const conteudo = r.conteudo ?? conteudoDoPadrao();
    const dados = r.conteudo
      ? { ...limpo, origem: "ia" as Origem }
      : { disciplina: PACOTE_PADRAO.disciplina, tema: PACOTE_PADRAO.tema, assuntos: [...PACOTE_PADRAO.assuntos], contexto: null, origem: "padrao" as Origem };

    const linha = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const existente = await tx.exp03em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null }, select: { id: true } });
      const comum = { ...dados, conteudoJson: conteudo as unknown as Prisma.InputJsonValue };
      const geracoes = r.tokens > 0 ? 1 : 0;
      return existente
        ? tx.exp03em1bPacote.update({ where: { id: existente.id }, data: { ...comum, iaGeracoes: { increment: geracoes }, iaTokens: { increment: r.tokens } } })
        : tx.exp03em1bPacote.create({ data: { escolaId, turmaId, ...comum, iaGeracoes: geracoes, iaTokens: r.tokens } });
    }, escolaId);
    return { pacote: this.exigirParaProfessor(linha), usouIa: r.conteudo !== null, motivo: r.motivo };
  }

  /**
   * "Regenerar Item" (a curadoria): UM item do RASCUNHO, de novo pela IA, com o
   * resto do pacote como contexto e a régua inteira na saída. Pacote já
   * homologado não muda (409). Sem IA, o item fica como estava (`usouIa: false`).
   */
  async regenerar(escolaId: string, turmaId: string, professorId: string, perfil: Perfil, pacoteId: string, item: ItemDoPacote) {
    const antes = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      if (linha.aprovadoEm) throw erroDeJogo("pacote-ja-homologado");
      const conteudo = lerConteudo(linha.conteudoJson);
      if (!conteudo) throw erroDeJogo("atividade-nao-encontrada");
      return { linha, conteudo };
    }, escolaId);
    const r = await this.preparo.regenerar(escolaId, professorId, perfil, item, antes.conteudo, antes.linha.tema);

    const linha = await this.prisma.comTenancy(async (tx) => {
      await this.travarTurma(tx, escolaId, turmaId);
      const atual = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      if (atual.aprovadoEm) throw erroDeJogo("pacote-ja-homologado");
      const atualConteudo = lerConteudo(atual.conteudoJson) ?? antes.conteudo;
      const data: Prisma.Exp03em1bPacoteUpdateInput = { iaGeracoes: { increment: r.tokens > 0 ? 1 : 0 }, iaTokens: { increment: r.tokens } };
      /* Só o ITEM pedido muda — o resto fica como está AGORA (outra aba pode ter mexido). */
      if (r.conteudo) data.conteudoJson = { ...atualConteudo, [item]: r.conteudo[item] } as unknown as Prisma.InputJsonValue;
      return tx.exp03em1bPacote.update({ where: { id: atual.id }, data });
    }, escolaId);
    return { pacote: this.exigirParaProfessor(linha), usouIa: r.conteudo !== null, motivo: r.motivo };
  }

  /**
   * "Homologar Pacote de Conteúdo" (API-004) — SÓ aprova: a atividade nasce
   * PRONTA, não no ar (ADR-130). Com `conteudo`, a edição inline entra junto e
   * passa a régua. Homologar de novo o mesmo é idempotente; mudar um homologado
   * é 409.
   */
  async homologar(escolaId: string, turmaId: string, professorId: string, pacoteId: string, editado?: ConteudoDoPacote) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const gravado = lerConteudo(linha.conteudoJson);
      if (linha.aprovadoEm) {
        if (editado && (!gravado || canonico(editado) !== canonico(gravado))) throw erroDeJogo("pacote-ja-homologado");
        return this.respostaDaHomologacao(linha);
      }
      const conteudo = editado ?? gravado;
      if (!conteudo) throw erroDeJogo("pacote-invalido", ["O rascunho gravado não está legível. Gere de novo."]);
      const problemas = problemasDoConteudo(conteudo);
      if (problemas.length > 0) throw erroDeJogo("pacote-invalido", problemas);
      const aprovado = await tx.exp03em1bPacote.update({
        where: { id: linha.id },
        data: { conteudoJson: conteudo as unknown as Prisma.InputJsonValue, aprovadoEm: new Date(), aprovadoPor: professorId, rodadaAtual: 1 },
      });
      return this.respostaDaHomologacao(aprovado);
    }, escolaId);
  }

  /**
   * "Usar Banco Padrão e Liberar" (API-003) — o caminho curto de 2 toques
   * (one-pager §9a): o banco curado JÁ homologado e no ar, numa transação, sem
   * IA. Não toca no rascunho da turma. Idempotente.
   */
  async usarPadrao(escolaId: string, turmaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const p = padrao();
      const assinatura = canonico(p.conteudo);
      const homologados = await tx.exp03em1bPacote.findMany({
        where: { escolaId, turmaId, origem: "padrao", aprovadoEm: { not: null } },
        orderBy: { aprovadoEm: "desc" },
      });
      const igual = homologados.find((h) => {
        const c = lerConteudo(h.conteudoJson);
        return c !== null && canonico(c) === assinatura && h.tema === p.tema;
      });
      const linha =
        igual ??
        (await tx.exp03em1bPacote.create({
          data: {
            escolaId,
            turmaId,
            disciplina: p.disciplina,
            tema: p.tema,
            assuntos: p.assuntos,
            contexto: null,
            origem: "padrao",
            conteudoJson: p.conteudo as unknown as Prisma.InputJsonValue,
            aprovadoEm: new Date(),
            aprovadoPor: professorId,
          },
        }));
      return this.porNoAr(tx, escolaId, turmaId, linha);
    }, escolaId);
  }

  /**
   * "Liberar Atividade para a Turma" (API-004b) — o pacote homologado que a
   * turma usa. O que estava no ar volta a ser pronto; o gate volta ao início;
   * o pacote que já rodou abre a rodada SEGUINTE. Rascunho: 409. Idempotente.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      if (!linha.aprovadoEm) throw erroDeJogo("pacote-nao-homologado");
      return this.porNoAr(tx, escolaId, turmaId, linha);
    }, escolaId);
  }

  /** "Pausar Telas para Debate" e "Liberar Retomada da Turma": o gate só anda para a FRENTE; cada mudança vai ao histórico (EVT-P05). */
  async mudarGate(escolaId: string, turmaId: string, professorId: string, alvo: "pausa" | "liberada") {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      const atual = await tx.exp03em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      const antes = normalizarEtapa(atual?.etapa);
      const etapa = avancarEtapa(antes, alvo);
      const linha = await tx.exp03em1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, etapa },
        update: { etapa },
      });
      if (etapa !== antes) {
        await tx.exp03em1bGateHistorico.create({ data: { escolaId, turmaId, pacoteId: pacote.id, rodada: pacote.rodadaAtual, etapa, professorId } });
      }
      return { etapa, atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /**
   * "Zerar Turma" — a rodada seguinte do mesmo pacote. As sessões ficam; a
   * evidência do pacote é APAGADA (ADR-155). `rodada` é a que o professor VIU.
   */
  async zerar(escolaId: string, turmaId: string, professorId: string, rodadaVista: number) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      if (pacote.rodadaAtual === rodadaVista + 1) {
        const gate = await tx.exp03em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, etapa: normalizarEtapa(gate?.etapa) };
      }
      if (pacote.rodadaAtual !== rodadaVista) throw erroDeJogo("rodada-desatualizada");
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: pacote.id });
      const atualizado = await tx.exp03em1bPacote.update({ where: { id: pacote.id }, data: { rodadaAtual: { increment: 1 } }, select: { id: true, rodadaAtual: true } });
      await this.voltarAoInicio(tx, escolaId, turmaId);
      return { atividade: { pacoteId: atualizado.id, rodada: atualizado.rodadaAtual }, etapa: ETAPA_INICIAL };
    }, escolaId);
  }

  /**
   * O PAINEL DA AULA (polling ~5 s): só CONTAGENS na lousa — por passo, os
   * pausados, a escala da 1ª publicação, quem abriu o anexo, a errata e a
   * perícia. A folha nominal diz o passo e o tempo parado; nunca a escala, a
   * camada, o parecer nem o nível de alguém (sem ranking). Conta a vista do
   * professor no pacote (EVT-P04).
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      });
      const sessoes = ctx.pacote
        ? await tx.exp03em1bSessao.findMany({
            where: { escolaId, pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, estudanteId: { in: estudantes.map((e) => e.id) } },
            select: { estudanteId: true, ...CAMPOS_DA_SESSAO },
          })
        : [];
      if (ctx.pacote && professorId) {
        await tx.exp03em1bPacote.update({ where: { id: ctx.pacote.id }, data: { painelVistoEm: new Date(), painelVistas: { increment: 1 } } });
      }
      const sessaoDe = new Map(sessoes.map((s) => [s.estudanteId, s]));
      const porPasso = Object.fromEntries(PASSOS.map((p) => [p, 0])) as Record<Passo, number>;
      const resumo = {
        estudantes: estudantes.length,
        entraram: sessoes.length,
        porPasso,
        pausados: 0,
        primeiraPublicacao: { escala0: 0, escala80: 0 },
        abriramAnexo: 0,
        errata: { publicaram: 0, pularam: 0 },
        pericia: { emitiram: 0, pularam: 0 },
      };
      const agora = Date.now();
      const linhas = estudantes.map((e) => {
        const s = sessaoDe.get(e.id) ?? null;
        const passo = passoEfetivo(marcosDe(s), ctx.etapa);
        porPasso[passo] += 1;
        if (s) {
          if (pausada(passo, ctx.etapa)) resumo.pausados += 1;
          const inicial = publicacaoDe(s, "inicial");
          if (inicial) resumo.primeiraPublicacao[inicial.escala === 0 ? "escala0" : "escala80"] += 1;
          if (s.anexoAbertoEm) resumo.abriramAnexo += 1;
          if (publicacaoDe(s, "errata")) resumo.errata.publicaram += 1;
          if (s.errataPulada) resumo.errata.pularam += 1;
          if (s.parecerEm) resumo.pericia.emitiram += 1;
          if (s.pulouPericia) resumo.pericia.pularam += 1;
        }
        return {
          estudanteId: e.id,
          nome: e.displayName,
          passo,
          segundosInativo: s ? Math.max(0, Math.round((agora - s.atualizadoEm.getTime()) / 1000)) : null,
        };
      });
      return {
        turma,
        atividade: ctx.pacote ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, tema: ctx.pacote.tema, grupo: nomeDoGrupo(ctx.pacote.conteudo.grupo) } : null,
        etapa: ctx.pacote ? ctx.etapa : null,
        resumo,
        linhas,
        roteiro: ROTEIRO,
      };
    }, escolaId);
  }

  /** O material do GUIA DA AULA (API-005): o banco padrão, o roteiro, a perícia COM o gabarito e as réguas. Sem tenancy: é catálogo. */
  material() {
    return {
      missaoId: EXP_ID,
      titulo: "O Porta-Voz dos Dados",
      padrao: padrao(),
      roteiro: ROTEIRO,
      serie: SERIE_HISTORICA.map((s) => ({ ...s })),
      laudo: { fator: LAUDO.fator, variacaoVisual: LAUDO.variacaoVisual, variacaoReal: LAUDO.variacaoReal, desmontagem: LAUDO.desmontagem, fatorDeMentira: LAUDO.fatorDeMentira },
      pericia: { cartaoDistorcido: CARTAO_DISTORCIDO, motivo: MOTIVO_DA_DISTORCAO, cartoes: textosFixos().pericia.cartoes },
      habilidades: FICHA_EXP03EM1B.habilidades.map((h) => ({
        codigo: h.codigo,
        rotulo: h.marcadores[0]?.rotulo ?? h.codigo,
        criterios: { atingiu: h.criterios.atingiu, em_processo: h.criterios.em_processo, nao_atingiu: h.criterios.nao_atingiu },
      })),
    };
  }

  /** O pacote do podcast (ADR-150): o pedido, desta turma e homologado, ou o em andamento. */
  async pacoteParaPodcast(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const id = pacoteId ?? (await this.exigirPacoteAtivo(tx, escolaId, turmaId)).id;
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, id);
      if (!linha.aprovadoEm) throw erroDeJogo("atividade-nao-encontrada");
      return { id: linha.id, tema: linha.tema };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── privados

  /** O estado do estudante. Allowlist: nada do gabarito, e o feed só do ramo que ELE publicou. */
  private montarEstado(ctx: ContextoDaTurma, s: LinhaDaSessao | null): z.infer<typeof SessaoSchema> {
    const pacote = ctx.pacote;
    const passo = passoEfetivo(marcosDe(s), ctx.etapa);
    const inicial = publicacaoDe(s, "inicial");
    const errata = publicacaoDe(s, "errata");
    const iso = (p: PublicacaoGravada | null) =>
      p ? { escala: p.escala, explicacao: p.explicacao, fonte: p.fonte, contexto: p.contexto, publicadaEm: p.publicadaEm.toISOString() } : null;
    const c = pacote?.conteudo ?? null;
    return {
      preparada: pacote !== null,
      atividade: pacote ? { pacoteId: pacote.id, rodada: pacote.rodada } : null,
      etapaDaTurma: pacote ? ctx.etapa : null,
      passo,
      pausada: pausada(passo, ctx.etapa),
      slotsRestantes: s?.slotsRestantes ?? SLOTS_DE_PUBLICACAO,
      marcos: {
        chatAberto: Boolean(s?.chatAbertoEm),
        anexoAberto: Boolean(s?.anexoAbertoEm),
        nudgeE2: Boolean(s?.nudgeE2Em),
        compositorAberto: Boolean(s?.compositorAbertoEm),
        periciaAberta: Boolean(s?.periciaAbertaEm),
      },
      publicacoes: { inicial: iso(inicial), errata: iso(errata), errataPulada: Boolean(s?.errataPulada) },
      errataLiberada: Boolean(s?.publicadaEm) && !s?.errataEm && ctx.etapa === "liberada",
      feed:
        c && inicial
          ? {
              reacoes: (inicial.escala === 0 ? c.reacoes.zero : c.reacoes.oitenta).map((r) => ({ ...r })),
              rival: { escola: RIVAL.escola, escala: inicial.escala === 0 ? 80 : 0, chip: RIVAL.chip },
              conflito: { ...c.posAha.conflito },
              coordenador: { ...c.posAha.coordenador },
            }
          : null,
      pericia:
        s && s.concluidoEm
          ? {
              pulou: s.pulouPericia,
              sinalizouA: s.sinalizouA ?? false,
              motivoA: motivo(s.motivoA),
              sinalizouB: s.sinalizouB ?? false,
              motivoB: motivo(s.motivoB),
              decididaEm: s.concluidoEm.toISOString(),
            }
          : null,
      concluido: Boolean(s?.concluidoEm),
      conteudo: c
        ? {
            grupo: { nome: nomeDoGrupo(c.grupo), recorte: c.grupo },
            servico: {
              orgao: c.servico.orgao,
              indicador: c.servico.indicador,
              unidade: c.servico.unidade,
              abrangencia: c.servico.abrangencia,
              periodicidade: c.servico.periodicidade,
              serie: SERIE_HISTORICA.map((v, i) => ({ periodo: c.servico.periodos[i] ?? `Mês ${i + 1}`, ...v, situacao: c.servico.situacoes[i] ?? "" })),
            },
            notaTecnica: { ...c.notaTecnica, secoes: c.notaTecnica.secoes.map((x) => ({ ...x })) },
            camadas: { explicacao: { ...c.camadas.explicacao }, fonte: c.camadas.fonte, contexto: c.camadas.contexto },
          }
        : null,
      textos: textosFixos(),
    };
  }

  /** A errata só depois da 1ª publicação E da retomada liberada pela turma. Devolve a 1ª. */
  private exigirErrataAberta(s: LinhaDaSessao, etapa: EtapaDoGate | null): PublicacaoGravada {
    const inicial = publicacaoDe(s, "inicial");
    if (!s.publicadaEm || !inicial) throw erroDeJogo("nao-publicado");
    if (etapa !== "liberada") throw erroDeJogo("errata-nao-liberada");
    return inicial;
  }

  /** As quatro habilidades do conjunto FINAL, na decisão da errata (`errata: null` = pulou). */
  private async marcarOConjunto(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, pacote: PacoteDaTurma, inicial: Publicacao, errata: Publicacao | null) {
    const marca = this.marcaDe(escolaId, estudanteId, pacote);
    await this.evidencias.marcar(tx, { ...marca, marcador: MARCADOR_CO12, status: nivelCO12(inicial, errata) });
    await this.evidencias.marcar(tx, { ...marca, marcador: MARCADOR_CO21, status: nivelCO21(inicial, errata) });
    await this.evidencias.marcar(tx, { ...marca, marcador: MARCADOR_CO22, status: nivelCO22(inicial, errata) });
    await this.evidencias.marcar(tx, { ...marca, marcador: MARCADOR_CO26, status: nivelCO26(inicial, errata) });
  }

  private respostaDaHomologacao(linha: Exp03em1bPacote) {
    const pacote = this.exigirParaProfessor(linha);
    return { pacoteId: linha.id, homologadoEm: (linha.aprovadoEm as Date).toISOString(), pacote };
  }

  private async porNoAr(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacote: Exp03em1bPacote) {
    if (pacote.ativo) {
      const gate = await tx.exp03em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, etapa: normalizarEtapa(gate?.etapa), mudou: false };
    }
    const ultima = await tx.exp03em1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: pacote.id }, _max: { rodada: true } });
    const rodada = (ultima._max.rodada ?? 0) + 1;
    /* Desliga antes de ligar: o índice único PARCIAL aceita um ativo por turma. */
    await tx.exp03em1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
    await tx.exp03em1bPacote.update({ where: { id: pacote.id }, data: { ativo: true, rodadaAtual: rodada } });
    await this.voltarAoInicio(tx, escolaId, turmaId);
    return { atividade: { pacoteId: pacote.id, rodada }, etapa: ETAPA_INICIAL, mudou: true };
  }

  private async contextoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string | null): Promise<ContextoDaTurma> {
    if (!turmaId) return { turmaId: null, pacote: null, etapa: null };
    const [linha, gate] = await Promise.all([
      tx.exp03em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, turmaId: true, tema: true, conteudoJson: true, rodadaAtual: true } }),
      tx.exp03em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } }, select: { etapa: true } }),
    ]);
    if (!linha) return { turmaId, pacote: null, etapa: null };
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo) {
      logger.warn({ codigo: "exp03em1b-pacote-invalido", escolaId, turmaId }, "pacote ativo com forma inesperada");
      return { turmaId, pacote: null, etapa: null };
    }
    return {
      turmaId,
      pacote: { id: linha.id, turmaId: linha.turmaId, tema: linha.tema, conteudo, rodada: linha.rodadaAtual },
      etapa: normalizarEtapa(gate?.etapa),
    };
  }

  private chave(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, estudanteId, pacoteId: pacote.id, rodada: pacote.rodada };
  }

  /** A marca de uma ação desta missão: a atividade é o pacote, a rodada é a da turma. */
  private marcaDe(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, expId: EXP_ID, turmaId: pacote.turmaId, atividadeId: pacote.id, rodada: pacote.rodada, estudanteId };
  }

  private sessaoDe(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, pacote: PacoteDaTurma): Promise<LinhaDaSessao | null> {
    return tx.exp03em1bSessao.findUnique({ where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) }, select: CAMPOS_DA_SESSAO });
  }

  /**
   * O FUNIL de toda rota de estudante: a escola do token e a missão liberada
   * na turma (ADR-69, e a disponibilidade da ADR-87 dentro dela). A turma é a
   * de `users.turma_id` — a mesma fonte do painel.
   */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true, turmaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId: estudante.turmaId };
  }

  /**
   * Núcleo de toda mutação — `garantirSessao`: o funil, o lock por (escola,
   * estudante), o pacote em andamento e o gate lidos UMA vez, a sessão desta
   * rodada criada se ainda não existe, a PAUSA (409 para quem não concluiu), o
   * trabalho e o estado relido. Dois toques rápidos viram duas transações em
   * fila. Os CHECKs do banco são a rede final.
   */
  private comSessao(
    escolaId: string,
    estudanteId: string,
    trabalho: (tx: Prisma.TransactionClient, pacote: PacoteDaTurma, sessao: LinhaDaSessao, etapa: EtapaDoGate | null) => Promise<void>,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp03em1b:${escolaId}:${estudanteId}`}, 0))`;
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const pacote = ctx.pacote;
      if (!pacote) throw erroDeJogo("atividade-nao-preparada");
      let sessao = await this.sessaoDe(tx, escolaId, estudanteId, pacote);
      if (!sessao) {
        await tx.exp03em1bSessao.createMany({
          data: [{ ...this.chave(escolaId, estudanteId, pacote), turmaId: pacote.turmaId, versaoInstrumento: VERSAO_DO_INSTRUMENTO }],
          skipDuplicates: true,
        });
        sessao = await this.sessaoDe(tx, escolaId, estudanteId, pacote);
        if (!sessao) throw new Error("a sessão criada não voltou legível");
      }
      if (!sessao.concluidoEm && ctx.etapa === "pausa") throw erroDeJogo("telas-pausadas");
      await trabalho(tx, pacote, sessao, ctx.etapa);
      return this.montarEstado(ctx, await this.sessaoDe(tx, escolaId, estudanteId, pacote));
    }, escolaId);
  }

  /** Escola do token E matrícula de professor na turma. **404, nunca 403**. `professorId` indefinido = gestor. */
  private async turmaVisivel(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true, nome: true, serie: true } });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) throw erroDeJogo("turma-nao-encontrada");
    return turma;
  }

  /** Lock por TURMA: dois professores (ou dois cliques) não intercalam homologação, gate e rodada. */
  private async travarTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp03em1b-turma:${escolaId}:${turmaId}`}, 0))`;
  }

  private async pacoteDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId) ? await tx.exp03em1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId } }) : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  private async exigirPacoteAtivo(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    const pacote = await tx.exp03em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, rodadaAtual: true } });
    if (!pacote) throw erroDeJogo("pacote-nao-aprovado");
    return pacote;
  }

  private voltarAoInicio(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    return tx.exp03em1bGateTurma.upsert({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      create: { escolaId, turmaId, etapa: ETAPA_INICIAL },
      update: { etapa: ETAPA_INICIAL },
    });
  }

  /** O pacote como o professor o vê. Linha com forma inesperada vira `null` (e um aviso no log). */
  private paraProfessor(linha: Exp03em1bPacote) {
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo || !(DISCIPLINAS as readonly string[]).includes(linha.disciplina)) {
      logger.warn({ codigo: "exp03em1b-pacote-invalido", escolaId: linha.escolaId, turmaId: linha.turmaId }, "pacote com forma inesperada");
      return null;
    }
    return {
      id: linha.id,
      disciplina: linha.disciplina as Disciplina,
      tema: linha.tema,
      assuntos: linha.assuntos,
      contexto: linha.contexto,
      origem: (linha.origem === "ia" ? "ia" : "padrao") as Origem,
      conteudo,
      aprovadoEm: linha.aprovadoEm?.toISOString() ?? null,
      ativo: linha.ativo,
      rodadaAtual: linha.rodadaAtual,
      criadoEm: linha.criadoEm.toISOString(),
    };
  }

  private exigirParaProfessor(linha: Exp03em1bPacote) {
    const pacote = this.paraProfessor(linha);
    if (!pacote) throw new Error("o pacote gravado não voltou legível");
    return pacote;
  }
}

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma, type Exp09ef1bPacote } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { FICHA_EXP09EF1B } from "../evidencias/fichas/exp09ef1b";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  AMARA,
  ANCORAS,
  BLOCOS,
  BOTOES_DO_GATE,
  CAMINHOS,
  CHAT,
  CONCEITOS,
  CONSTATACAO_DA_TABELA,
  CRITERIOS,
  DISCIPLINAS,
  DOCUMENTOS_INDEXADOS,
  EXP_ID,
  FALAS_DO_ASSISTENTE,
  LIMIAR_DA_INDUCAO,
  PACOTE_PADRAO,
  PILULAS,
  PROJETOS,
  ROTEIRO_DO_DEBATE,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DA_PILULA,
  ROTULO_DO_BLOCO,
  ROTULO_DO_CRITERIO,
  SUGESTOES,
  TEXTOS_DA_TELA,
  VERSAO_DO_INSTRUMENTO,
  conteudoDoPadrao,
  preencher,
  valoresDoPacote,
  type AncoraId,
  type BlocoId,
  type Caminho,
  type ConteudoDoPacote,
  type Criterio,
  type Disciplina,
  type EtapaDoGate,
  type FalaDoAssistente,
  type Intencao,
  type ItemDoPacote,
  type Origem,
  type PilulaId,
  type ProjetoId,
} from "./conteudo";
import { ConteudoBaseSchema, type SessaoSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { IaDaAulaDaExp09ef1bService, PreparoDaExp09ef1bService } from "./ia.service";
import { MARCADOR_CO07, MARCADOR_CO08, caminhoDe, nivelCO07, nivelCO08, type Protocolo } from "./regras/evidencia";
import { decidirIntencao, rotaDaMensagem, type LeituraDaIa } from "./regras/intencoes";
import { problemasDoConteudo, pontuar } from "./regras/pacote";
import { ETAPA_INICIAL, PASSOS, avancarEtapa, embaralhar, etapaAtingiu, normalizarEtapa, passoEfetivo, revotoAberto, type MarcosDaSessao, type Passo } from "./regras/passos";

/**
 * Persistência e regras aplicadas da exp09ef1b — O Dossiê Invisível
 * (ADR-202). Molde: `porta-voz-dos-dados` (o funil, os locks, o pacote como
 * atividade, a rodada como reaplicação, o gate da turma com histórico) e o
 * classificador da `efeito-amplificador` (a IA lê primeiro, a árvore é a
 * reserva, a IA corre FORA da transação). Toda query leva `escola_id` no
 * `where` ALÉM da RLS que o `comTenancy` arma (regra 1).
 *
 * **O gabarito não desce**: os cadernos só descem depois de digitalizados, o
 * banco do protocolo desce embaralhado e sem o gabarito, e a resposta ao
 * protocolo não diz se acertou. As marcas da evidência entram na transação de
 * cada gesto (`regras/evidencia.ts` diz quando).
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

/** Uma mensagem da thread como fica gravada. `intencao`, `classificador` e `arvore` são auditoria: não descem. */
interface MensagemGravada {
  id: string;
  autor: "estudante" | "assistente" | "sistema";
  texto: string;
  ancora: AncoraId | null;
  anexos: string[];
  em: string;
  intencao?: Intencao;
  classificador?: "arvore" | "ia" | "guarda";
  arvore?: Intencao;
}

const CAMPOS_DA_SESSAO = {
  entrouEm: true,
  conversa: true,
  consultas: true,
  enviadas: true,
  cadernosOferecidosEm: true,
  cadernosEm: true,
  cadernosNaEtapa: true,
  verProjetosEm: true,
  decisaoEm: true,
  projetoInicial: true,
  rankingInicial: true,
  caminho: true,
  pilulas: true,
  revotoEm: true,
  projetoFinal: true,
  rankingFinal: true,
  ancoras: true,
  protocoloJson: true,
  concluidoEm: true,
  atualizadoEm: true,
} satisfies Prisma.Exp09ef1bSessaoSelect;

type LinhaDaSessao = Prisma.Exp09ef1bSessaoGetPayload<{ select: typeof CAMPOS_DA_SESSAO }>;

const ehProjeto = (v: string | null | undefined): v is ProjetoId => (PROJETOS as readonly string[]).includes(v ?? "");
const ehCaminho = (v: string | null | undefined): v is Caminho => (CAMINHOS as readonly string[]).includes(v ?? "");
const criterios = (v: readonly string[]): Criterio[] => v.filter((c): c is Criterio => (CRITERIOS as readonly string[]).includes(c));
const pilulasDe = (v: readonly string[]): PilulaId[] => v.filter((p): p is PilulaId => (PILULAS as readonly string[]).includes(p));
const ancorasDe = (v: readonly string[]): AncoraId[] => v.filter((a): a is AncoraId => (ANCORAS as readonly string[]).includes(a));

function marcosDe(s: LinhaDaSessao | null | undefined): MarcosDaSessao | null {
  if (!s) return null;
  return { entrou: s.entrouEm !== null, decidiu: s.decisaoEm !== null, revotou: s.revotoEm !== null, concluiu: s.concluidoEm !== null };
}

function conversaDe(s: LinhaDaSessao | null | undefined): MensagemGravada[] {
  const bruta = s?.conversa;
  return Array.isArray(bruta) ? (bruta as unknown as MensagemGravada[]) : [];
}

function protocoloDe(s: LinhaDaSessao | null | undefined): (Protocolo & { em: string }) | null {
  const p = s?.protocoloJson as { slots?: unknown; descarte?: unknown; em?: unknown } | null | undefined;
  if (!p || !Array.isArray(p.slots) || !Array.isArray(p.descarte) || typeof p.em !== "string") return null;
  return { slots: p.slots as (BlocoId | null)[], descarte: p.descarte as BlocoId[], em: p.em };
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

type Recorte = { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null };

function recorteLimpo(r: Recorte) {
  const contexto = r.contexto ? limpar(r.contexto) : "";
  return { disciplina: r.disciplina, tema: limpar(r.tema), assuntos: r.assuntos.map(limpar), contexto: contexto || null };
}

function padrao() {
  return { nome: PACOTE_PADRAO.nome, disciplina: PACOTE_PADRAO.disciplina, tema: PACOTE_PADRAO.tema, assuntos: [...PACOTE_PADRAO.assuntos], conteudo: conteudoDoPadrao() };
}

const ROTEIRO = { perguntas: [...ROTEIRO_DO_DEBATE], botoes: { ...BOTOES_DO_GATE } };

/** Uma fala do catálogo, com os nomes do pacote e os valores extras. */
function fala(chave: FalaDoAssistente, c: ConteudoDoPacote, extras: Record<string, string | number> = {}): string {
  return preencher(FALAS_DO_ASSISTENTE[chave], { ...valoresDoPacote(c), ...extras });
}

function mensagem(autor: MensagemGravada["autor"], texto: string, extra: Partial<MensagemGravada> = {}): MensagemGravada {
  return { id: randomUUID(), autor, texto, ancora: null, anexos: [], em: new Date().toISOString(), ...extra };
}

const ja = (conversa: readonly MensagemGravada[], ancora: AncoraId) => conversa.some((m) => m.ancora === ancora);

/** O parecer do assistente: o enviesado (antes dos cadernos) ou o invertido (depois). Uma vez cada. */
function parecer(conversa: readonly MensagemGravada[], c: ConteudoDoPacote, digitalizou: boolean): MensagemGravada[] {
  if (digitalizou) return ja(conversa, "inversao") ? [] : [mensagem("assistente", fala("parecerInvertido", c), { ancora: "inversao" })];
  return ja(conversa, "parecer-inicial") ? [] : [mensagem("assistente", fala("parecerInicial", c), { ancora: "parecer-inicial" })];
}

/** A anotação do contraste documental (TC-06): acompanha a primeira resposta de métrica, uma vez. */
function contraste(conversa: readonly MensagemGravada[], c: ConteudoDoPacote): MensagemGravada[] {
  return ja(conversa, "contraste") ? [] : [mensagem("assistente", fala("contraste", c), { ancora: "contraste", anexos: [c.projetos.papel.documentos[0]?.arquivo ?? ""].filter(Boolean) })];
}

/** Uma seleção de anexos de cada projeto digital, para os chips da resposta de regularidade. */
function anexosDigitais(c: ConteudoDoPacote): string[] {
  return [c.projetos.nuvem.documentos[0]?.arquivo, c.projetos.parcial.documentos[0]?.arquivo].filter((a): a is string => Boolean(a));
}

@Injectable()
export class DossieInvisivelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp09ef1bService,
    private readonly iaDaAula: IaDaAulaDaExp09ef1bService,
  ) {}

  // ─────────────────────────────────────────────────────────── o estudante

  /** `GET sessao` — READ-ONLY e o polling (~3 s): o pacote, o gate da turma e a sessão. Sem pacote no ar, `preparada: false`. */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      return this.montarEstado(tx, escolaId, estudanteId, ctx, sessao);
    }, escolaId);
  }

  /** "Começar Análise" (E1 → E2): abre a sessão e a fala de abertura do assistente. Idempotente. */
  entrar(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      if (s.entrouEm) return;
      await this.gravar(tx, escolaId, estudanteId, pacote, {
        entrouEm: new Date(),
        conversa: [mensagem("assistente", fala("abertura", pacote.conteudo))] as unknown as Prisma.InputJsonValue,
      });
    });
  }

  /**
   * Uma pergunta ao assistente. Três tempos (o molde da exp02em1b): a leitura
   * com a rota; a IA FORA da transação (pode levar segundos); a gravação, com o
   * estado relido — a sessão que andou no meio vale a árvore. A fala é sempre
   * do catálogo; a intenção decide a resposta e a bifurcação dos cadernos.
   */
  async mensagem(escolaId: string, estudanteId: string, texto: string) {
    const antes = await this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      if (!ctx.pacote) throw erroDeJogo("atividade-nao-preparada");
      const s = await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote);
      this.exigirChatAberto(s);
      return { pacote: ctx.pacote };
    }, escolaId);

    const rota = rotaDaMensagem(texto, antes.pacote.conteudo.projetos.papel.nome);
    const p = antes.pacote.conteudo.projetos;
    let leitura: LeituraDaIa | null = null;
    if (rota.tipo === "ia") {
      leitura = await this.iaDaAula.classificar(escolaId, estudanteId, { mensagem: texto, nomes: { papel: p.papel.nome, parcial: p.parcial.nome, nuvem: p.nuvem.nome } });
    }

    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      this.exigirChatAberto(s);
      const decisao = pacote.id === antes.pacote.id ? decidirIntencao(rota, leitura) : decidirIntencao(rota, null);
      const c = pacote.conteudo;
      const conversa = conversaDe(s);
      const digitalizou = s.cadernosEm !== null;
      const novas: MensagemGravada[] = [mensagem("estudante", texto, { intencao: decisao.intencao, classificador: decisao.classificador, arvore: decisao.arvore })];
      const data: Prisma.Exp09ef1bSessaoUpdateInput = {};

      switch (decisao.intencao) {
        case "custo_atendimento":
          novas.push(mensagem("assistente", fala("custo", c)), ...contraste([...conversa, ...novas], c));
          break;
        case "regularidade_documental":
          novas.push(mensagem("assistente", fala("regularidade", c), { anexos: anexosDigitais(c) }), ...contraste([...conversa, ...novas], c));
          break;
        case "impacto_social":
          novas.push(mensagem("assistente", fala("impacto", c)), ...contraste([...conversa, ...novas], c));
          break;
        case "investigar_lacuna_cadernos":
          if (digitalizou) {
            novas.push(mensagem("assistente", fala("ocrConcluido", c), { anexos: [c.cadernos.arquivo] }));
          } else {
            novas.push(mensagem("assistente", fala("ofertaDosCadernos", c)));
            if (!s.cadernosOferecidosEm) data.cadernosOferecidosEm = new Date();
          }
          break;
        case "solicitar_recomendacao":
          novas.push(...parecer([...conversa, ...novas], c, digitalizou));
          break;
        case "fora_do_tema":
          novas.push(mensagem("assistente", fala("foraDoTema", c)));
          break;
      }

      const contou = decisao.intencao !== "fora_do_tema";
      const consultas = s.consultas + (contou ? 1 : 0);
      const enviadas = s.enviadas + 1;
      /* A 3ª consulta: o parecer (se ainda não veio) e o limiar que libera a escolha (protótipo E2-ALU-01). */
      if (contou && consultas === CHAT.minimoParaEscolher) {
        novas.push(...parecer([...conversa, ...novas], c, digitalizou), mensagem("sistema", fala("limiar", c)));
      }
      if (enviadas >= CHAT.maximo) novas.push(mensagem("sistema", fala("limite", c)));

      await this.gravar(tx, escolaId, estudanteId, pacote, {
        ...data,
        consultas,
        enviadas,
        conversa: [...conversa, ...novas] as unknown as Prisma.InputJsonValue,
      });
    });
  }

  /** "Ver Projetos": a lista dos inscritos, o parecer (se ainda não veio) e a escolha liberada. Recusar a oferta dos cadernos aqui é o caminho A2. */
  verProjetos(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      this.exigirEntrou(s);
      if (s.decisaoEm || s.verProjetosEm) return;
      const conversa = conversaDe(s);
      const c = pacote.conteudo;
      const novas = [mensagem("sistema", fala("verProjetos", c)), ...parecer(conversa, c, s.cadernosEm !== null)];
      await this.gravar(tx, escolaId, estudanteId, pacote, { verProjetosEm: new Date(), conversa: [...conversa, ...novas] as unknown as Prisma.InputJsonValue });
    });
  }

  /**
   * "Digitalizar cadernos" — o OCR. Na E2 só depois da oferta (o caminho A1); na
   * E4, com a revelação liberada (B e A2: o aviso, o OCR e a inversão entram na
   * thread juntos). A animação de 2 s é da tela; o servidor grava ao fim dela.
   */
  digitalizar(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      this.exigirEntrou(s);
      if (s.cadernosEm) return;
      const c = pacote.conteudo;
      const conversa = conversaDe(s);
      const ocr = mensagem("assistente", fala("ocrConcluido", c), { anexos: [c.cadernos.arquivo] });
      if (!s.decisaoEm) {
        if (!s.cadernosOferecidosEm) throw erroDeJogo("escolha-nao-liberada");
        const novas = [ocr, ...parecer(conversa, c, true)];
        await this.gravar(tx, escolaId, estudanteId, pacote, { cadernosEm: new Date(), cadernosNaEtapa: "E2", conversa: [...conversa, ...novas] as unknown as Prisma.InputJsonValue });
        return;
      }
      if (!etapaAtingiu(etapa, "revelacao")) throw erroDeJogo("revelacao-nao-liberada");
      const novas = [mensagem("assistente", fala("ofertaDosCadernos", c)), ocr, ...parecer(conversa, c, true)];
      await this.gravar(tx, escolaId, estudanteId, pacote, { cadernosEm: new Date(), cadernosNaEtapa: "E4", conversa: [...conversa, ...novas] as unknown as Prisma.InputJsonValue });
    });
  }

  /**
   * "Registrar Decisão" — o LATCH 1: o projeto, o ranking e o caminho
   * congelados, e a EF09CO08 marcada para quem investigou (A1/A2). A mesma
   * decisão de novo é idempotente; outra, 409 `ja-decidido`.
   */
  decidir(escolaId: string, estudanteId: string, projeto: ProjetoId, ranking: readonly Criterio[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s) => {
      this.exigirEntrou(s);
      if (s.decisaoEm) {
        if (s.projetoInicial === projeto && criterios(s.rankingInicial).join() === ranking.join()) return;
        throw erroDeJogo("ja-decidido");
      }
      if (s.consultas < CHAT.minimoParaEscolher && !s.verProjetosEm) throw erroDeJogo("escolha-nao-liberada");
      const caminho = caminhoDe({ cadernosOferecidos: s.cadernosOferecidosEm !== null, digitalizouNaE2: s.cadernosNaEtapa === "E2" });
      await this.gravar(tx, escolaId, estudanteId, pacote, { decisaoEm: new Date(), projetoInicial: projeto, rankingInicial: [...ranking], caminho });
      const nivel = nivelCO08({ caminho, projetoInicial: projeto, rankingInicial: ranking, projetoFinal: null, rankingFinal: null });
      if (nivel) await this.evidencias.marcar(tx, { ...this.marcaDe(escolaId, estudanteId, pacote), marcador: MARCADOR_CO08, status: nivel });
    });
  }

  /** Uma pílula dirigida da E4: a resposta entra na thread. Idempotente. */
  pilula(escolaId: string, estudanteId: string, id: PilulaId) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      this.exigirRevelacao(s, etapa);
      if (!s.cadernosEm) throw erroDeJogo("cadernos-pendentes");
      if (s.pilulas.includes(id)) return;
      const c = pacote.conteudo;
      const comparado = this.comparado(s);
      const texto =
        id === "custo"
          ? fala("pilulaCusto", c, { comparado: c.projetos[comparado].nome, custoComparado: c.projetos[comparado].custoPorVaga })
          : fala("pilulaAssinaturas", c);
      const conversa = conversaDe(s);
      await this.gravar(tx, escolaId, estudanteId, pacote, {
        pilulas: [...s.pilulas, id],
        conversa: [...conversa, mensagem("estudante", ROTULO_DA_PILULA[id]), mensagem("assistente", texto, { anexos: id === "assinaturas" ? [c.cadernos.arquivo] : [] })] as unknown as Prisma.InputJsonValue,
      });
    });
  }

  /**
   * "Confirmar Decisão Final" — o LATCH 2, depois do debate (a trava `revoto`),
   * com os cadernos digitalizados e ao menos uma pílula examinada. A escolha
   * original fica ao lado. Marca a EF09CO08 com o conjunto. A mesma de novo é
   * idempotente; outra, 409 `ja-revotado`.
   */
  revotar(escolaId: string, estudanteId: string, projeto: ProjetoId, ranking: readonly Criterio[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      if (s.revotoEm) {
        if (s.projetoFinal === projeto && criterios(s.rankingFinal).join() === ranking.join()) return;
        throw erroDeJogo("ja-revotado");
      }
      this.exigirRevelacao(s, etapa);
      if (!revotoAberto(etapa)) throw erroDeJogo("revoto-nao-liberado");
      if (!s.cadernosEm) throw erroDeJogo("cadernos-pendentes");
      if (s.pilulas.length === 0) throw erroDeJogo("pilula-pendente");
      await this.gravar(tx, escolaId, estudanteId, pacote, { revotoEm: new Date(), projetoFinal: projeto, rankingFinal: [...ranking] });
      const nivel = nivelCO08({
        caminho: ehCaminho(s.caminho) ? s.caminho : "B",
        projetoInicial: ehProjeto(s.projetoInicial) ? s.projetoInicial : projeto,
        rankingInicial: criterios(s.rankingInicial),
        projetoFinal: projeto,
        rankingFinal: ranking,
      });
      if (nivel) await this.evidencias.marcar(tx, { ...this.marcaDe(escolaId, estudanteId, pacote), marcador: MARCADOR_CO08, status: nivel });
    });
  }

  /** As âncoras da E5 (marcar e desmarcar). Não é evidência. */
  marcarAncoras(escolaId: string, estudanteId: string, ancoras: readonly AncoraId[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      this.exigirExplicar(s, etapa);
      await this.gravar(tx, escolaId, estudanteId, pacote, { ancoras: [...ancoras] });
    });
  }

  /**
   * "Enviar Proposta" — o protocolo e a CONCLUSÃO, com a EF09CO07 marcada na
   * mesma transação. Sem trava no cliente (correção do PO de 29/10): qualquer
   * composição com ≥ 1 bloco entra, e a régua decide. O mesmo de novo é idempotente.
   */
  enviarProtocolo(escolaId: string, estudanteId: string, protocolo: Protocolo) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, s, etapa) => {
      const gravado = protocoloDe(s);
      if (s.concluidoEm) {
        if (gravado && canonico({ slots: gravado.slots, descarte: [...gravado.descarte].sort() }) === canonico({ slots: protocolo.slots, descarte: [...protocolo.descarte].sort() })) return;
        throw erroDeJogo("missao-concluida");
      }
      this.exigirExplicar(s, etapa);
      const agora = new Date();
      await this.gravar(tx, escolaId, estudanteId, pacote, {
        protocoloJson: { slots: [...protocolo.slots], descarte: [...protocolo.descarte], em: agora.toISOString() } as unknown as Prisma.InputJsonValue,
        concluidoEm: agora,
      });
      await this.evidencias.marcar(tx, { ...this.marcaDe(escolaId, estudanteId, pacote), marcador: MARCADOR_CO07, status: nivelCO07(protocolo) });
    });
  }

  // ─────────────────────────────────────────────────────────── o professor

  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [linhas, rodadas] = await Promise.all([
        tx.exp09ef1bPacote.findMany({
          where: { escolaId, turmaId },
          orderBy: [{ criadoEm: "desc" }],
          select: { id: true, turmaId: true, disciplina: true, tema: true, origem: true, ativo: true, rodadaAtual: true, aprovadoEm: true, criadoEm: true },
        }),
        tx.exp09ef1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
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

  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const rodadas = await tx.exp09ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: linha.id }, _max: { rodada: true } });
      return { ...this.exigirParaProfessor(linha), rodadas: rodadas._max.rodada ?? 0 };
    }, escolaId);
  }

  /** "Gerar com IA" — o RASCUNHO, um por turma. A turma é conferida ANTES de gastar token; sem IA, o banco curado. */
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
      const existente = await tx.exp09ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null }, select: { id: true } });
      const comum = { ...dados, conteudoJson: conteudo as unknown as Prisma.InputJsonValue };
      const geracoes = r.tokens > 0 ? 1 : 0;
      return existente
        ? tx.exp09ef1bPacote.update({ where: { id: existente.id }, data: { ...comum, iaGeracoes: { increment: geracoes }, iaTokens: { increment: r.tokens } } })
        : tx.exp09ef1bPacote.create({ data: { escolaId, turmaId, ...comum, iaGeracoes: geracoes, iaTokens: r.tokens } });
    }, escolaId);
    return { pacote: this.exigirParaProfessor(linha), usouIa: r.conteudo !== null, motivo: r.motivo };
  }

  /** "Regenerar item pontual": UM projeto (ou os cadernos) do RASCUNHO, de novo pela IA, com a régua inteira na saída. */
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
      const data: Prisma.Exp09ef1bPacoteUpdateInput = { iaGeracoes: { increment: r.tokens > 0 ? 1 : 0 }, iaTokens: { increment: r.tokens } };
      /* Só o ITEM pedido muda — o resto fica como está AGORA (outra aba pode ter mexido). */
      if (r.conteudo) {
        const novo: ConteudoDoPacote =
          item === "cadernos" ? { ...atualConteudo, cadernos: r.conteudo.cadernos } : { ...atualConteudo, projetos: { ...atualConteudo.projetos, [item]: r.conteudo.projetos[item] } };
        data.conteudoJson = novo as unknown as Prisma.InputJsonValue;
      }
      return tx.exp09ef1bPacote.update({ where: { id: atual.id }, data });
    }, escolaId);
    return { pacote: this.exigirParaProfessor(linha), usouIa: r.conteudo !== null, motivo: r.motivo };
  }

  /** "Aprovar Pacote" — SÓ aprova: a atividade nasce PRONTA, não no ar (ADR-130). Com `conteudo`, a edição inline entra junto. */
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
      const aprovado = await tx.exp09ef1bPacote.update({
        where: { id: linha.id },
        data: { conteudoJson: conteudo as unknown as Prisma.InputJsonValue, aprovadoEm: new Date(), aprovadoPor: professorId, rodadaAtual: 1 },
      });
      return this.respostaDaHomologacao(aprovado);
    }, escolaId);
  }

  /** "Usar banco padrão" — o caminho curto de 2 toques: o banco curado JÁ aprovado e no ar, sem IA. Idempotente. */
  async usarPadrao(escolaId: string, turmaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const p = padrao();
      const assinatura = canonico(p.conteudo);
      const homologados = await tx.exp09ef1bPacote.findMany({ where: { escolaId, turmaId, origem: "padrao", aprovadoEm: { not: null } }, orderBy: { aprovadoEm: "desc" } });
      const igual = homologados.find((h) => {
        const c = lerConteudo(h.conteudoJson);
        return c !== null && canonico(c) === assinatura && h.tema === p.tema;
      });
      const linha =
        igual ??
        (await tx.exp09ef1bPacote.create({
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

  /** "Liberar para a Turma" — o pacote aprovado que a turma usa. Rascunho: 409. Idempotente. */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      if (!linha.aprovadoEm) throw erroDeJogo("pacote-nao-homologado");
      return this.porNoAr(tx, escolaId, turmaId, linha);
    }, escolaId);
  }

  /** As três travas: o gate só anda para a FRENTE; cada mudança vai ao histórico. */
  async mudarGate(escolaId: string, turmaId: string, professorId: string, alvo: Exclude<EtapaDoGate, "exploracao">) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      const atual = await tx.exp09ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      const antes = normalizarEtapa(atual?.etapa);
      const etapa = avancarEtapa(antes, alvo);
      const linha = await tx.exp09ef1bGateTurma.upsert({ where: { escolaId_turmaId: { escolaId, turmaId } }, create: { escolaId, turmaId, etapa }, update: { etapa } });
      if (etapa !== antes) {
        await tx.exp09ef1bGateHistorico.create({ data: { escolaId, turmaId, pacoteId: pacote.id, rodada: pacote.rodadaAtual, etapa, professorId } });
      }
      return { etapa, atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /** "Zerar Turma" — a rodada seguinte do mesmo pacote. As sessões ficam; a evidência do pacote é APAGADA (ADR-155). */
  async zerar(escolaId: string, turmaId: string, professorId: string, rodadaVista: number) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      if (pacote.rodadaAtual === rodadaVista + 1) {
        const gate = await tx.exp09ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, etapa: normalizarEtapa(gate?.etapa) };
      }
      if (pacote.rodadaAtual !== rodadaVista) throw erroDeJogo("rodada-desatualizada");
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: pacote.id });
      const atualizado = await tx.exp09ef1bPacote.update({ where: { id: pacote.id }, data: { rodadaAtual: { increment: 1 } }, select: { id: true, rodadaAtual: true } });
      await this.voltarAoInicio(tx, escolaId, turmaId);
      return { atividade: { pacoteId: atualizado.id, rodada: atualizado.rodadaAtual }, etapa: ETAPA_INICIAL };
    }, escolaId);
  }

  /**
   * O PAINEL DA AULA (polling ~5 s): só CONTAGENS na lousa — por passo, os
   * caminhos, a 1ª e a 2ª escolha por projeto, a migração e os protocolos. A
   * folha nominal diz o passo e o tempo parado; nunca o voto, o caminho, o
   * texto do chat nem o nível de alguém. Conta a vista do professor no pacote.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const estudantes = await tx.user.findMany({ where: { escolaId, turmaId, role: "estudante" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } });
      const sessoes = ctx.pacote
        ? await tx.exp09ef1bSessao.findMany({
            where: { escolaId, pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, estudanteId: { in: estudantes.map((e) => e.id) } },
            select: { estudanteId: true, entrouEm: true, decisaoEm: true, revotoEm: true, concluidoEm: true, caminho: true, projetoInicial: true, projetoFinal: true, atualizadoEm: true },
          })
        : [];
      if (ctx.pacote && professorId) {
        await tx.exp09ef1bPacote.update({ where: { id: ctx.pacote.id }, data: { painelVistoEm: new Date(), painelVistas: { increment: 1 } } });
      }
      const sessaoDe = new Map(sessoes.map((s) => [s.estudanteId, s]));
      const porPasso = Object.fromEntries(PASSOS.map((p) => [p, 0])) as Record<Passo, number>;
      const zero = () => ({ papel: 0, parcial: 0, nuvem: 0 });
      const resumo = {
        estudantes: estudantes.length,
        entraram: sessoes.filter((s) => s.entrouEm).length,
        porPasso,
        caminhos: { A1: 0, A2: 0, B: 0 },
        escolhaInicial: zero(),
        escolhaFinal: zero(),
        migracao: { mantiveram: 0, trocaram: 0, para: zero() },
        protocolosEnviados: 0,
      };
      const agora = Date.now();
      const linhas = estudantes.map((e) => {
        const s = sessaoDe.get(e.id) ?? null;
        const passo = passoEfetivo(
          s ? { entrou: s.entrouEm !== null, decidiu: s.decisaoEm !== null, revotou: s.revotoEm !== null, concluiu: s.concluidoEm !== null } : null,
          ctx.etapa,
        );
        porPasso[passo] += 1;
        if (s) {
          if (ehCaminho(s.caminho)) resumo.caminhos[s.caminho] += 1;
          if (ehProjeto(s.projetoInicial)) resumo.escolhaInicial[s.projetoInicial] += 1;
          if (ehProjeto(s.projetoFinal)) {
            resumo.escolhaFinal[s.projetoFinal] += 1;
            if (s.projetoFinal === s.projetoInicial) resumo.migracao.mantiveram += 1;
            else {
              resumo.migracao.trocaram += 1;
              resumo.migracao.para[s.projetoFinal] += 1;
            }
          }
          if (s.concluidoEm) resumo.protocolosEnviados += 1;
        }
        return { estudanteId: e.id, nome: e.displayName, passo, segundosInativo: s ? Math.max(0, Math.round((agora - s.atualizadoEm.getTime()) / 1000)) : null };
      });
      const p = ctx.pacote?.conteudo.projetos;
      return {
        turma,
        atividade: ctx.pacote && p ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, tema: ctx.pacote.tema, projetos: { papel: p.papel.nome, parcial: p.parcial.nome, nuvem: p.nuvem.nome } } : null,
        etapa: ctx.pacote ? ctx.etapa : null,
        resumo,
        linhas,
        roteiro: ROTEIRO,
      };
    }, escolaId);
  }

  /** O material do GUIA DA AULA: o banco padrão, o roteiro, a conta da virada, o gabarito do protocolo e as réguas. Sem tenancy: é catálogo. */
  material() {
    const c = conteudoDoPadrao();
    const indices = (comCadernos: boolean) => pontuar(c, comCadernos).map((l) => ({ projeto: l.projeto, indice: l.indice }));
    return {
      missaoId: EXP_ID,
      titulo: "O Dossiê Invisível",
      padrao: padrao(),
      roteiro: ROTEIRO,
      virada: { antes: indices(false), depois: indices(true) },
      protocolo: { gabarito: ["auditar-fontes", "normalizar-impacto", "sinalizar-pendencias"] as BlocoId[], danoso: "desclassificar-sem-pdf" as BlocoId, rotulos: { ...ROTULO_DO_BLOCO } },
      habilidades: FICHA_EXP09EF1B.habilidades.map((h) => ({
        codigo: h.codigo,
        rotulo: h.marcadores[0]?.rotulo ?? h.codigo,
        criterios: { atingiu: h.criterios.atingiu, em_processo: h.criterios.em_processo, nao_atingiu: h.criterios.nao_atingiu },
      })),
    };
  }

  /** O pacote do podcast (ADR-150): o pedido, desta turma e aprovado, ou o em andamento. */
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

  /** O estado do estudante. Allowlist: os cadernos só depois de digitalizados, o protocolo sem gabarito, a thread sem a auditoria. */
  private async montarEstado(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, ctx: ContextoDaTurma, s: LinhaDaSessao | null): Promise<z.infer<typeof SessaoSchema>> {
    const pacote = ctx.pacote;
    const c = pacote?.conteudo ?? null;
    const passo = passoEfetivo(marcosDe(s), ctx.etapa);
    const semente = `${estudanteId}:${pacote?.id ?? ""}:${pacote?.rodada ?? 0}`;
    const conversa = conversaDe(s);
    const digitalizou = Boolean(s?.cadernosEm);
    const projetoInicial = ehProjeto(s?.projetoInicial) ? s.projetoInicial : null;
    const projetoFinal = ehProjeto(s?.projetoFinal) ? s.projetoFinal : null;
    const emRevelacaoOuDepois = s?.decisaoEm != null && etapaAtingiu(ctx.etapa, "revelacao");
    const emExplicar = passo === "explicar" || passo === "concluida";
    const protocolo = protocoloDe(s);
    const caminho = s?.decisaoEm && ehCaminho(s.caminho) ? s.caminho : null;

    let falaDeAmara: string | null = null;
    if (c && s && emExplicar && pacote) {
      const votado = c.projetos[projetoFinal ?? projetoInicial ?? "papel"].nome;
      const turma = await tx.exp09ef1bSessao.groupBy({
        by: ["projetoInicial"],
        where: { escolaId, pacoteId: pacote.id, rodada: pacote.rodada, decisaoEm: { not: null } },
        _count: { _all: true },
      });
      const total = turma.reduce((n, g) => n + g._count._all, 0);
      const naNuvem = turma.find((g) => g.projetoInicial === "nuvem")?._count._all ?? 0;
      const induzida = total > 0 && naNuvem / total >= LIMIAR_DA_INDUCAO;
      falaDeAmara = preencher(induzida ? AMARA.sistematizacao : AMARA.sistematizacaoNeutra, { votado });
    }

    return {
      preparada: pacote !== null,
      atividade: pacote ? { pacoteId: pacote.id, rodada: pacote.rodada } : null,
      etapaDaTurma: pacote ? ctx.etapa : null,
      passo,
      revotoAberto: revotoAberto(ctx.etapa),
      chat: {
        mensagens: conversa.map((m) => ({ id: m.id, autor: m.autor, texto: m.texto, ancora: m.ancora, anexos: [...m.anexos] })),
        consultas: s?.consultas ?? 0,
        podeEscolher: Boolean(s && (s.consultas >= CHAT.minimoParaEscolher || s.verProjetosEm)),
        limiteAtingido: (s?.enviadas ?? 0) >= CHAT.maximo,
        sugestoesVisiveis: (s?.enviadas ?? 0) === 0,
        cadernosOferecidos: Boolean(s?.cadernosOferecidosEm),
        cadernosDigitalizados: digitalizou,
      },
      ordemDosCriterios: embaralhar(CRITERIOS, `${semente}:criterios`),
      decisao: s?.decisaoEm && projetoInicial ? { projeto: projetoInicial, ranking: criterios(s.rankingInicial), em: s.decisaoEm.toISOString() } : null,
      caminho,
      revelacao:
        c && s && emRevelacaoOuDepois
          ? {
              comparado: this.comparado(s),
              contrafactual: caminho === "A1" && projetoInicial ? preencher(FALAS_DO_ASSISTENTE.contrafactual, { votado: c.projetos[projetoInicial].nome }) : null,
              tabela: digitalizou ? this.tabela(c, s) : [],
              constatacao: CONSTATACAO_DA_TABELA,
              pilulas: pilulasDe(s.pilulas),
            }
          : null,
      revoto:
        s?.revotoEm && projetoFinal
          ? { projeto: projetoFinal, ranking: criterios(s.rankingFinal), em: s.revotoEm.toISOString(), manteve: projetoFinal === projetoInicial }
          : null,
      explicar: falaDeAmara !== null && s ? { falaDeAmara, ancoras: ancorasDe(s.ancoras) } : null,
      protocolo: emExplicar
        ? {
            banco: embaralhar(BLOCOS, `${semente}:blocos`),
            enviado: protocolo ? { slots: [...protocolo.slots], descarte: [...protocolo.descarte], em: protocolo.em } : null,
          }
        : null,
      concluido: Boolean(s?.concluidoEm),
      conteudo: c
        ? {
            projetos: PROJETOS.map((id) => {
              const p = c.projetos[id];
              return { id, nome: p.nome, coordenador: p.coordenador, idade: p.idade, vagas: p.vagas, custoPorVaga: p.custoPorVaga, card: p.card, area: p.area, documentos: p.documentos.map((d) => ({ ...d })) };
            }),
            cadernos: digitalizou ? { arquivo: c.cadernos.arquivo, amostras: [...c.cadernos.amostras], resumo: c.cadernos.resumo } : null,
          }
        : null,
      textos: {
        tela: { ...TEXTOS_DA_TELA, sistemaVerProjetos: c ? fala("verProjetos", c) : "", aviso: c ? fala("ofertaDosCadernos", c) : "", boasVindas: FALAS_DO_ASSISTENTE.boasVindas },
        amara: AMARA.abertura,
        conceitos: CONCEITOS.map((x) => ({ ...x })),
        conceitosResumo: AMARA.conceitos,
        sugestoes: SUGESTOES.map((x) => x.texto),
        criterios: { ...ROTULO_DO_CRITERIO },
        blocos: { ...ROTULO_DO_BLOCO },
        pilulas: { ...ROTULO_DA_PILULA },
      },
    };
  }

  /** Com quem a tabela compara o projeto em papel: o 1º voto; se o voto foi o próprio papel, a recomendação da IA (plano G5). */
  private comparado(s: LinhaDaSessao): Exclude<ProjetoId, "papel"> {
    const p = s.projetoInicial;
    return p === "parcial" || p === "nuvem" ? p : "nuvem";
  }

  private tabela(c: ConteudoDoPacote, s: LinhaDaSessao) {
    const comparado = this.comparado(s);
    const votou = s.projetoInicial === comparado;
    const documentos: Record<ProjetoId, string> = {
      papel: `${180} diários em cadernos físicos`,
      parcial: `${DOCUMENTOS_INDEXADOS.parcial} atas semestrais digitais`,
      nuvem: `${DOCUMENTOS_INDEXADOS.nuvem} relatórios digitais (PDF)`,
    };
    const linha = (id: ProjetoId, rotulo: string) => ({
      projeto: id,
      nome: c.projetos[id].nome,
      rotulo,
      documentos: documentos[id],
      vagas: `${c.projetos[id].vagas} vagas`,
      custo: `R$ ${c.projetos[id].custoPorVaga} / vaga`,
    });
    return [linha(comparado, votou ? "1º voto" : "recomendação da IA"), linha("papel", "pós-OCR")];
  }

  private exigirEntrou(s: LinhaDaSessao) {
    if (s.concluidoEm) throw erroDeJogo("missao-concluida");
    if (!s.entrouEm) throw erroDeJogo("nao-entrou");
  }

  private exigirChatAberto(s: LinhaDaSessao | null) {
    if (!s || !s.entrouEm) throw erroDeJogo("nao-entrou");
    if (s.decisaoEm) throw erroDeJogo("ja-decidido");
    if (s.enviadas >= CHAT.maximo) throw erroDeJogo("limite-do-chat");
  }

  private exigirRevelacao(s: LinhaDaSessao, etapa: EtapaDoGate | null) {
    if (s.concluidoEm) throw erroDeJogo("missao-concluida");
    if (!s.decisaoEm) throw erroDeJogo("nao-decidido");
    if (!etapaAtingiu(etapa, "revelacao")) throw erroDeJogo("revelacao-nao-liberada");
  }

  private exigirExplicar(s: LinhaDaSessao, etapa: EtapaDoGate | null) {
    if (s.concluidoEm) throw erroDeJogo("missao-concluida");
    if (!s.revotoEm) throw erroDeJogo("nao-revotado");
    if (!etapaAtingiu(etapa, "explicar")) throw erroDeJogo("explicar-nao-liberado");
  }

  private gravar(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, pacote: PacoteDaTurma, data: Prisma.Exp09ef1bSessaoUpdateInput) {
    return tx.exp09ef1bSessao.update({ where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) }, data });
  }

  private respostaDaHomologacao(linha: Exp09ef1bPacote) {
    const pacote = this.exigirParaProfessor(linha);
    return { pacoteId: linha.id, homologadoEm: (linha.aprovadoEm as Date).toISOString(), pacote };
  }

  private async porNoAr(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacote: Exp09ef1bPacote) {
    if (pacote.ativo) {
      const gate = await tx.exp09ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, etapa: normalizarEtapa(gate?.etapa), mudou: false };
    }
    const ultima = await tx.exp09ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: pacote.id }, _max: { rodada: true } });
    const rodada = (ultima._max.rodada ?? 0) + 1;
    /* Desliga antes de ligar: o índice único PARCIAL aceita um ativo por turma. */
    await tx.exp09ef1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
    await tx.exp09ef1bPacote.update({ where: { id: pacote.id }, data: { ativo: true, rodadaAtual: rodada } });
    await this.voltarAoInicio(tx, escolaId, turmaId);
    return { atividade: { pacoteId: pacote.id, rodada }, etapa: ETAPA_INICIAL, mudou: true };
  }

  private async contextoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string | null): Promise<ContextoDaTurma> {
    if (!turmaId) return { turmaId: null, pacote: null, etapa: null };
    const [linha, gate] = await Promise.all([
      tx.exp09ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, turmaId: true, tema: true, conteudoJson: true, rodadaAtual: true } }),
      tx.exp09ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } }, select: { etapa: true } }),
    ]);
    if (!linha) return { turmaId, pacote: null, etapa: null };
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo) {
      logger.warn({ codigo: "exp09ef1b-pacote-invalido", escolaId, turmaId }, "pacote ativo com forma inesperada");
      return { turmaId, pacote: null, etapa: null };
    }
    return { turmaId, pacote: { id: linha.id, turmaId: linha.turmaId, tema: linha.tema, conteudo, rodada: linha.rodadaAtual }, etapa: normalizarEtapa(gate?.etapa) };
  }

  private chave(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, estudanteId, pacoteId: pacote.id, rodada: pacote.rodada };
  }

  /** A marca de uma ação desta missão: a atividade é o pacote, a rodada é a da turma. */
  private marcaDe(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, expId: EXP_ID, turmaId: pacote.turmaId, atividadeId: pacote.id, rodada: pacote.rodada, estudanteId };
  }

  private sessaoDe(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, pacote: PacoteDaTurma): Promise<LinhaDaSessao | null> {
    return tx.exp09ef1bSessao.findUnique({ where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) }, select: CAMPOS_DA_SESSAO });
  }

  /** O FUNIL de toda rota de estudante: a escola do token e a missão liberada na turma (ADR-69, e a disponibilidade da ADR-87 dentro dela). */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true, turmaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId: estudante.turmaId };
  }

  /**
   * Núcleo de toda mutação — `garantirSessao`: o funil, o lock por (escola,
   * estudante), o pacote em andamento e o gate lidos UMA vez, a sessão desta
   * rodada criada se ainda não existe, o trabalho e o estado relido. Os CHECKs
   * do banco são a rede final.
   */
  private comSessao(
    escolaId: string,
    estudanteId: string,
    trabalho: (tx: Prisma.TransactionClient, pacote: PacoteDaTurma, sessao: LinhaDaSessao, etapa: EtapaDoGate | null) => Promise<void>,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp09ef1b:${escolaId}:${estudanteId}`}, 0))`;
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const pacote = ctx.pacote;
      if (!pacote) throw erroDeJogo("atividade-nao-preparada");
      let sessao = await this.sessaoDe(tx, escolaId, estudanteId, pacote);
      if (!sessao) {
        await tx.exp09ef1bSessao.createMany({
          data: [{ ...this.chave(escolaId, estudanteId, pacote), turmaId: pacote.turmaId, versaoInstrumento: VERSAO_DO_INSTRUMENTO }],
          skipDuplicates: true,
        });
        sessao = await this.sessaoDe(tx, escolaId, estudanteId, pacote);
        if (!sessao) throw new Error("a sessão criada não voltou legível");
      }
      await trabalho(tx, pacote, sessao, ctx.etapa);
      return this.montarEstado(tx, escolaId, estudanteId, ctx, await this.sessaoDe(tx, escolaId, estudanteId, pacote));
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp09ef1b-turma:${escolaId}:${turmaId}`}, 0))`;
  }

  private async pacoteDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId) ? await tx.exp09ef1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId } }) : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  private async exigirPacoteAtivo(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    const pacote = await tx.exp09ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, rodadaAtual: true } });
    if (!pacote) throw erroDeJogo("pacote-nao-aprovado");
    return pacote;
  }

  private voltarAoInicio(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    return tx.exp09ef1bGateTurma.upsert({ where: { escolaId_turmaId: { escolaId, turmaId } }, create: { escolaId, turmaId, etapa: ETAPA_INICIAL }, update: { etapa: ETAPA_INICIAL } });
  }

  private exigirParaProfessor(linha: Exp09ef1bPacote) {
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo || !(DISCIPLINAS as readonly string[]).includes(linha.disciplina)) throw new Error("o pacote gravado não voltou legível");
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
}

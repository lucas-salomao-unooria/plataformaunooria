import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma, type Exp05ef1bPacote, type Exp05ef1bSessao } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades, type EquipeDoMapa } from "../equipes/regras";
import { EvidenciasService, type ContextoDaAtividade } from "../evidencias/evidencias.service";
import { FICHA_EXP05EF1B } from "../evidencias/fichas/exp05ef1b";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  CALLBACK_DO_MOTIVO,
  CONDICOES,
  CONFIRMACAO_DA_REGRA,
  DISCIPLINAS,
  ENCAMINHAMENTOS,
  ENCERRAMENTO_DA_NINA,
  ENTAO_MAX_CARACTERES,
  ENTAO_MIN_CARACTERES,
  EXP_ID,
  FALA_DO_TIO,
  FALAS_ANTES_DAS_PERGUNTAS,
  GRUPO,
  INSTRUCOES_DO_CONSOLE,
  MOTIVOS,
  MURAL,
  PACOTE_PADRAO,
  ROTEIRO_DA_RODA,
  ROTULO_DA_CONDICAO,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_MOTIVO,
  VERSAO_DO_INSTRUMENTO,
  falaDaNina,
  mensagensDoPadrao,
  mensagensPublicas,
  type Condicao,
  type Disciplina,
  type MensagemDoPacote,
  type Motivo,
  type Origem,
} from "./catalogo";
import { MensagemDoPacoteSchema, type CorpoDaAprovacao, type RevelacaoSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PreparoDaExp05ef1bService, type MotivoDoPadrao } from "./preparo.service";
import { MARCADOR_DA_SELECAO, nivelCO08 } from "./regras/evidencia";
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
import { validarEntao } from "./regras/reflexao";
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
  "entrouEm" | "selecao" | "confirmadoEm" | "motivo" | "votouEm" | "reflexaoEm" | "concluidoEm" | "tempoFeedSegundos" | "atualizadoEm"
>;

const CAMPOS_DA_SESSAO = {
  entrouEm: true,
  selecao: true,
  confirmadoEm: true,
  motivo: true,
  votouEm: true,
  reflexaoEm: true,
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
    refletiu: s.reflexaoEm !== null,
    concluiu: s.concluidoEm !== null,
  };
}

function ehMotivo(v: string | null): v is Motivo {
  return v !== null && (MOTIVOS as readonly string[]).includes(v);
}

function ehCondicao(v: string): v is Condicao {
  return (CONDICOES as readonly string[]).includes(v);
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
    condicoes: CONDICOES.map((id) => ({ id, rotulo: ROTULO_DA_CONDICAO[id] })),
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
    refletiu: Boolean(s?.reflexaoEm),
    concluiu: Boolean(s?.concluidoEm),
  };
}

function gabaritoDe(pacote: PacoteDaTurma): GabaritoDaConta {
  return new Map(pacote.mensagens.map((m) => [m.id, { veracidade: m.veracidade, tom: m.tom }]));
}

@Injectable()
export class QuemMandouIssoService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp05ef1bService,
  ) {}

  /**
   * O CONTEXTO DA EVIDÊNCIA (E14): para as perguntas P1 e P2 caírem na
   * atividade e na rodada certas, sem o cliente dizer nenhuma das duas. No
   * teste, quem chama isto é a suíte.
   */
  onModuleInit(): void {
    this.evidencias.registrarContexto(EXP_ID, (tx, escolaId, estudanteId) =>
      this.contextoDaEvidencia(tx, escolaId, estudanteId),
    );
  }

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
            tio: FALA_DO_TIO,
            encerramento: ENCERRAMENTO_DA_NINA,
          },
          perguntas: FALAS_ANTES_DAS_PERGUNTAS.map((p) => ({ ...p })),
          confirmacaoDaRegra: CONFIRMACAO_DA_REGRA,
        },
        opcoes: opcoes(),
        limites: {
          encaminhamentos: ENCAMINHAMENTOS,
          entaoMin: ENTAO_MIN_CARACTERES,
          entaoMax: ENTAO_MAX_CARACTERES,
        },
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
      /* A EF05CO08 mede quem AINDA NÃO VIU a resposta deste pacote (ADR-120).
         Na rodada nova do MESMO pacote, quem já foi avaliada numa anterior —
         por ela, pela equipe ou pelo professor — refaz para praticar, e o
         Mural fecha sem marca nova: a melhor rodada continua sendo a que
         mediu. Quem faltou na anterior é medida agora. */
      const marca = {
        escolaId,
        expId: EXP_ID,
        atividadeId: pacote.id,
        rodada: pacote.rodada,
        estudanteId,
        marcador: MARCADOR_DA_SELECAO,
      };
      if (await this.evidencias.jaAvaliadaAntes(tx, marca)) return;
      await this.evidencias.marcar(tx, { ...marca, turmaId: pacote.turmaId, status: nivelCO08(escolhidas) });
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
   * O construtor Se/Então — O LATCH 3. Só com a reflexão liberada pela turma.
   *
   * O `entao` é TEXTO LIVRE DE MENOR: vai para a tabela confinada
   * `exp05ef1b_reflexoes`, não vai a log nem a telemetria, e no painel só o
   * professor que leciona na turma o lê. NÃO é corrigido (a EF05CO04 sai da P2).
   */
  refletir(escolaId: string, estudanteId: string, se: Condicao, entaoBruto: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      if (!sessao.votouEm) throw erroDeJogo("enquete-nao-votada");
      const validado = validarEntao(entaoBruto);
      const chave = this.chave(escolaId, estudanteId, pacote);
      if (sessao.reflexaoEm) {
        const existente = await tx.exp05ef1bReflexao.findUnique({
          where: { escolaId_estudanteId_pacoteId_rodada: chave },
          select: { condicionalSe: true, acaoEntao: true },
        });
        if (validado.ok && existente?.condicionalSe === se && existente.acaoEntao === validado.texto) return;
        throw erroDeJogo("reflexao-ja-enviada");
      }
      if (fase !== "reflexao") throw erroDeJogo("reflexao-nao-liberada");
      if (!validado.ok) throw erroDeJogo(validado.codigo);

      await tx.exp05ef1bReflexao.create({
        data: { ...chave, condicionalSe: se, acaoEntao: validado.texto, charsCount: validado.texto.length },
      });
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: chave },
        data: { reflexaoEm: new Date() },
      });
    });
  }

  /**
   * O fim da missão, depois das perguntas de evidência. NÃO exige as
   * respostas: quem sai antes delas fica "Não avaliado" em CO03/CO04 (a
   * ausência de marca), nunca "não atingiu". Idempotente.
   */
  concluir(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (!sessao) throw erroDeJogo("grupo-nao-aberto");
      if (!sessao.reflexaoEm) throw erroDeJogo("reflexao-nao-enviada");
      if (sessao.concluidoEm) return;
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
   * "Aprovar Pacote" — o portão da curadoria humana (RF-003).
   *
   * **Aprovar um pacote novo = ATIVIDADE nova** (a evidência E14 é por pacote):
   * o ativo anterior sai de cena (fica no banco, com o histórico dele), o novo
   * nasce na rodada 1 e a fase da turma volta à triagem — senão a turma nova
   * nasceria com a revelação aberta, e o gabarito desceria na entrada.
   *
   * Idempotente: aprovar de novo EXATAMENTE o pacote ativo devolve o mesmo
   * pacote, sem atividade nova (o duplo clique de um professor nervoso). O
   * rascunho, se houver, é o que vira o aprovado (mesmo id).
   */
  async aprovar(escolaId: string, turmaId: string, professorId: string, corpo: CorpoDaAprovacao) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const conteudo = { ...recorteLimpo(corpo), mensagens: normalizarMensagens(corpo.mensagens) };

      const ativo = await tx.exp05ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true } });
      if (ativo) {
        const mensagens = lerMensagens(ativo.mensagensJson);
        if (mensagens && assinatura({ ...ativo, mensagens }) === assinatura(conteudo)) {
          return this.exigirParaProfessor(ativo);
        }
        await tx.exp05ef1bPacote.update({ where: { id: ativo.id }, data: { ativo: false } });
      }

      const dados = {
        disciplina: conteudo.disciplina,
        tema: conteudo.tema,
        assuntos: conteudo.assuntos,
        contexto: conteudo.contexto,
        origem: corpo.origem,
        mensagensJson: conteudo.mensagens as unknown as Prisma.InputJsonValue,
        ativo: true,
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

      await this.voltarATriagem(tx, escolaId, turmaId);
      return this.exigirParaProfessor(aprovado);
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
   * e GUARDA o histórico: nada é apagado (as sessões e a evidência da rodada
   * anterior ficam; a turma recomeça numa sessão nova). A fase volta à
   * triagem.
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
   * nele. O `entao` da regra é texto livre de menor: só para quem leciona
   * (`professorId` presente) — `professorLeciona(undefined)` é `true` para o
   * gestor, e é por isso que a distinção mora aqui, e não no `@Roles`.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const leitura = await this.lerATurma(tx, escolaId, turmaId, ctx.pacote);
      const contas = leitura.unidades.map((u) => paraAConta(u.linha));

      const reflexoes = ctx.pacote
        ? await tx.exp05ef1bReflexao.findMany({
            where: {
              escolaId,
              pacoteId: ctx.pacote.id,
              rodada: ctx.pacote.rodada,
              estudanteId: { in: leitura.unidades.map((u) => u.linha.estudanteId) },
            },
            select: { estudanteId: true, condicionalSe: true, acaoEntao: true },
          })
        : [];
      const reflexaoDe = new Map(reflexoes.map((r) => [r.estudanteId, r]));

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
          const r = reflexaoDe.get(linha.estudanteId);
          return {
            estudanteId: linha.estudanteId,
            nome: linha.nome,
            equipe: equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros.map((m) => ({ ...m })) } : null,
            passo: passoEfetivo(marcosDe(s), ctx.fase),
            selecao: s?.confirmadoEm ? s.selecao : null,
            motivo: s && ehMotivo(s.motivo) ? s.motivo : null,
            reflexao:
              r && ehCondicao(r.condicionalSe)
                ? { se: r.condicionalSe, entao: professorId ? r.acaoEntao : null }
                : null,
            tempoFeedSegundos: s?.tempoFeedSegundos ?? null,
          };
        }),
        roteiro: ROTEIRO,
      };
    }, escolaId);
  }

  /**
   * O material do GUIA DA AULA: o banco curado COM gabarito, o roteiro e as
   * perguntas de evidência COM o nível de cada alternativa. Catálogo da
   * missão, igual para todo contrato: sem tenancy.
   */
  material() {
    const fala = new Map<string, string>(FALAS_ANTES_DAS_PERGUNTAS.map((p) => [p.perguntaId, p.fala]));
    const habilidadeDe = new Map<string, string>();
    for (const h of FICHA_EXP05EF1B.habilidades) {
      for (const m of h.marcadores) if (m.perguntaId) habilidadeDe.set(m.perguntaId, h.codigo);
    }
    return {
      padrao: { ...padrao(), convite: falaDaNina(PACOTE_PADRAO.tema) },
      roteiro: ROTEIRO,
      textos: { tio: FALA_DO_TIO, encerramento: ENCERRAMENTO_DA_NINA, confirmacaoDaRegra: CONFIRMACAO_DA_REGRA },
      perguntasDeEvidencia: FICHA_EXP05EF1B.perguntas.map((p) => ({
        perguntaId: p.id,
        habilidade: habilidadeDe.get(p.id) ?? "",
        fala: fala.get(p.id) ?? "",
        enunciado: p.enunciado,
        alternativas: p.alternativas.map((a) => ({ ...a })),
      })),
      opcoes: opcoes(),
    };
  }

  // ─────────────────────────────────────────────────────────── privados

  /**
   * O resolvedor da E14: a turma, a atividade (o pacote ativo) e a rodada —
   * mas SÓ no passo das perguntas (a regra enviada, a missão não concluída).
   * Antes disso, ou depois de concluir, `null`: a resposta vira 409
   * `sem-atividade-em-andamento`, e uma P1 respondida por um POST direto antes
   * do Mural não mede nada.
   */
  private async contextoDaEvidencia(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<ContextoDaAtividade | null> {
    const estudante = await tx.user.findFirst({ where: { id: estudanteId, escolaId }, select: { turmaId: true } });
    if (!estudante?.turmaId) return null;
    const pacote = await tx.exp05ef1bPacote.findFirst({
      where: { escolaId, turmaId: estudante.turmaId, ativo: true },
      select: { id: true, rodadaAtual: true },
    });
    if (!pacote) return null;
    const sessao = await tx.exp05ef1bSessao.findUnique({
      where: {
        escolaId_estudanteId_pacoteId_rodada: { escolaId, estudanteId, pacoteId: pacote.id, rodada: pacote.rodadaAtual },
      },
      select: { reflexaoEm: true, concluidoEm: true },
    });
    if (!sessao?.reflexaoEm || sessao.concluidoEm) return null;
    return { turmaId: estudante.turmaId, atividadeId: pacote.id, rodada: pacote.rodadaAtual };
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
    const reflexao =
      pacote && sessao?.reflexaoEm
        ? await tx.exp05ef1bReflexao.findUnique({
            where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
            select: { condicionalSe: true, acaoEntao: true },
          })
        : null;

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

    return {
      passo: passoEfetivo(marcos, ctx.fase),
      fase: pacote ? ctx.fase : null,
      preparada: pacote !== null,
      atividade: pacote ? { pacoteId: pacote.id, rodada: pacote.rodada } : null,
      selecao: sessao?.selecao ?? [],
      confirmado: Boolean(sessao?.confirmadoEm),
      motivo: sessao && ehMotivo(sessao.motivo) ? sessao.motivo : null,
      reflexao:
        reflexao && ehCondicao(reflexao.condicionalSe) ? { se: reflexao.condicionalSe, entao: reflexao.acaoEntao } : null,
      concluido: Boolean(sessao?.concluidoEm),
      revelacao,
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
    const mapa: Map<string, EquipeDoMapa> = await mapaDeEquipes(tx, escolaId, turmaId, EXP_ID);
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

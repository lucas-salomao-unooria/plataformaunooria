import { Injectable, Optional, type OnModuleInit } from "@nestjs/common";
import { Prisma, type Exp01em1bPacote, type Exp01em1bSessao } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { equipeDoEstudante, mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades, type EquipeDoMapa } from "../equipes/regras";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { SalasService } from "../salas/salas.service";
import { FICHA_EXP01EM1B } from "../evidencias/fichas/exp01em1b";
import type { Nivel } from "../evidencias/regras";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  APOSTAS,
  AVISO_DE_SISTEMA,
  BLOCOS,
  CARTOES,
  CRITERIOS_INICIAIS,
  DISCIPLINAS,
  EXP_ID,
  FICHAS,
  FUNCOES,
  ITENS_DO_PACOTE,
  MARCADOR_CO01,
  MARCADOR_CO03,
  MARCADOR_CO18,
  MARCADOR_CO20,
  OPCOES_DE_CRITERIO,
  OPCOES_DO_BLOCO,
  PACOTE_PADRAO,
  PASSOS_DO_ALGORITMO,
  PERFIS,
  POLLING_MS,
  ROTEIRO,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_CARTAO,
  ROTULO_DO_CRITERIO,
  ROTULO_DO_PASSO_DO_ALGORITMO,
  TEXTO_DA_APOSTA,
  TEXTO_DO_BLOCO,
  VERSAO_DO_INSTRUMENTO,
  type Aposta,
  type ConteudoDoPacote,
  type Criterios,
  type Disciplina,
  type Fase,
  type Funcao,
  type ItemDoPacote,
  type PassoDoAlgoritmo,
  PASSOS_DE_ACAO_ENVIESADA,
} from "./conteudo";
import {
  ClassificacaoValorSchema,
  ComunicadoValorSchema,
  ConteudoDoPacoteSchema,
  CriteriosValorSchema,
  type EditarItemSchema,
  type EstadoSchema,
  type GerarSchema,
  type HomologarSchema,
  type LinhaDoPainelSchema,
  type MaterialFixoSchema,
  type PacoteDoProfessorSchema,
  type RegenerarItemSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PreparoDaExp01em1bService } from "./preparo.service";
import type { RecorteDoPreparo } from "./prompts";
import {
  corrigirCartoes,
  corrigirComunicado,
  efeitoDoReteste,
  equidadeDoReteste,
  marcouOsDispensaveis,
  type Alinhamento,
  type Classificacao,
  type Comunicado,
  type Equidade,
} from "./regras/bancada";
import { textoDoComunicado } from "./regras/comunicado";
import { nivelCO01, nivelCO03, nivelCO18, nivelCO20, type FatosDaRegua } from "./regras/evidencia";
import { medidorDaTurma, todosApostaram } from "./regras/medidor";
import { aparar, comItem, itemTemTitulo, lerItem, limiteDoItem, problemasDoPacote, ROTULO_DO_ITEM } from "./regras/pacote";
import {
  FASE_INICIAL,
  aguardandoProfessor,
  indiceDoPasso,
  normalizarFase,
  passoEfetivo,
  transicaoValida,
  type MarcosDaSessao,
  type Passo,
} from "./regras/passos";

/**
 * Persistência e regras aplicadas da exp01em1b — O Assistente Invisível
 * (ADR-185).
 *
 * Molde: `enigma-capa` (o funil, o pacote como atividade e a rodada como
 * reaplicação, o gate da turma com histórico, o preparo com IA e o banco
 * padrão). Toda query leva `escola_id` no `where` ALÉM da RLS que o
 * `comTenancy` arma (regra 1, defesa em profundidade).
 *
 * **A sessão é da UNIDADE**: o estudante, ou o computador da equipe (quem está
 * logado nele, E13). Nasce no primeiro `GET /sessao` com o pacote no ar — é o
 * que o "100% das sessões abertas" da E3 conta. Com equipe, o painel colapsa
 * por computador e a evidência copia a marca a cada integrante
 * (`EvidenciasService.marcar`).
 *
 * **O passo é derivado** (`regras/passos.ts`) e toda jogada declara o passo
 * a que pertence: à frente = 409 `passo-invalido`; no passo certo com a turma
 * ainda não liberada = 409 `aguardando-professor`; já feita = o estado (200),
 * salvo os dois latches com OUTRA escolha (`ja-apostou`, `ja-publicado`).
 *
 * **O gabarito não desce** (regra 3): o estado é uma allowlist; quem diz o que
 * um gesto mediu é este serviço, e as quatro marcas entram na transação do
 * LATCH 2 (ou no encerrar do professor, para quem apostou e não publicou).
 *
 * **Sem IA na aula**: a única IA é a do preparo do professor (`preparo.service.ts`).
 */

interface PacoteNoAr {
  id: string;
  turmaId: string;
  disciplina: string;
  tema: string;
  conteudo: ConteudoDoPacote;
  contingencia: boolean;
  rodada: number;
}

interface ContextoDaTurma {
  turmaId: string | null;
  pacote: PacoteNoAr | null;
  fase: Fase | null;
}

type Sessao = Exp01em1bSessao;
type Estado = z.infer<typeof EstadoSchema>;
type Tx = Prisma.TransactionClient;
type DaTela = { atividade?: { pacoteId: string; rodada: number } | undefined };

const EQUIDADES = ["total", "parcial", "nenhuma"] as const;
const ALINHAMENTOS = ["pleno", "incompleto", "descaracterizado"] as const;

const ehDe = <T extends string>(lista: readonly T[], v: string | null | undefined): v is T =>
  v !== null && v !== undefined && (lista as readonly string[]).includes(v);

function marcosDe(s: Sessao | null | undefined): MarcosDaSessao | null {
  if (!s) return null;
  return {
    iniciou: s.iniciadoEm !== null,
    navegou: s.navegouEm !== null,
    apostou: s.apostadaEm !== null,
    simulacaoConcluida: s.simulacaoConcluidaEm !== null,
    fichasAbertas: s.fichasAbertasEm !== null,
    inspecaoConcluida: s.inspecaoConcluidaEm !== null,
    classificou: s.classificadaEm !== null,
    algoritmoResolvido: s.algoritmoConcluidoEm !== null,
    retestou: s.retestes > 0,
    revisando: s.revisando,
    avancouParaPublicacao: s.avancouEm !== null,
    publicou: s.publicadaEm !== null,
  };
}

function lerConteudo(bruto: Prisma.JsonValue): ConteudoDoPacote | null {
  const lido = ConteudoDoPacoteSchema.safeParse(bruto);
  return lido.success ? (lido.data as ConteudoDoPacote) : null;
}

function lerCriterios(bruto: Prisma.JsonValue | null): Criterios | null {
  const lido = CriteriosValorSchema.safeParse(bruto);
  return lido.success ? lido.data : null;
}

function lerClassificacao(bruto: Prisma.JsonValue | null): Classificacao {
  const lido = ClassificacaoValorSchema.safeParse(bruto ?? {});
  return lido.success ? lido.data : {};
}

function lerComunicado(bruto: Prisma.JsonValue | null): z.infer<typeof ComunicadoValorSchema> {
  const lido = ComunicadoValorSchema.safeParse(bruto ?? {});
  return lido.success ? lido.data : {};
}

function lerPassos(bruto: readonly number[]): PassoDoAlgoritmo[] {
  return bruto.filter((n): n is PassoDoAlgoritmo => (PASSOS_DO_ALGORITMO as readonly number[]).includes(n));
}

/** Só as chaves preenchidas, em ordem fixa — o JSONB e a comparação ficam estáveis. */
function semVazios<K extends string>(ordem: readonly K[], v: Partial<Record<K, string>>): Partial<Record<K, string>> {
  const saida: Partial<Record<K, string>> = {};
  for (const k of ordem) if (v[k] !== undefined) saida[k] = v[k];
  return saida;
}

const mesmoObjeto = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));

const limpar = (t: string) => t.replace(/\s+/g, " ").trim();

/** "Avançou mantendo 1B ou 2B" — o Aviso Discreto do E5-PROF-01 (as opções que restringem por dado observado). */
const comVies = (c: Criterios) => c.exercicios === "b" || c.duvidas === "b";

/** Os fatos da régua de UMA sessão. `publicou: false` é o encerrar de quem apostou e não publicou. */
function fatosDe(s: Sessao, publicou: boolean): FatosDaRegua {
  const marcados = lerPassos(s.passosMarcados);
  return {
    publicou,
    paginaAtiva: publicou && s.paginaAtiva === true,
    comunicado: publicou && ehDe(ALINHAMENTOS, s.alinhamento) ? (s.alinhamento as Alinhamento) : null,
    equidade: ehDe(EQUIDADES, s.ultimaEquidade) ? (s.ultimaEquidade as Equidade) : null,
    abriuPainelDoAlgoritmo: s.painelPassosAbertoEm !== null,
    marcouAlgumPasso: marcados.length > 0,
    marcouOsDispensaveis: marcouOsDispensaveis(marcados),
  };
}

function niveisDe(f: FatosDaRegua): { co20: Nivel; co01: Nivel; co18: Nivel; co03: Nivel } {
  return { co20: nivelCO20(f), co01: nivelCO01(f), co18: nivelCO18(f), co03: nivelCO03(f) };
}

/** O material FIXO da missão (igual em todo pacote): rótulos e textos que não são gabarito. */
const MATERIAL_FIXO: z.infer<typeof MaterialFixoSchema> = {
  apostas: APOSTAS.map((id) => ({ id, texto: TEXTO_DA_APOSTA[id] })),
  fichas: PERFIS.map((perfil) => ({ perfil, ...FICHAS[perfil] })),
  avisos: { beatriz: AVISO_DE_SISTEMA.beatriz, thiago: AVISO_DE_SISTEMA.thiago },
  cartoes: CARTOES.map((id) => ({ id, rotulo: ROTULO_DO_CARTAO[id] })),
  passosDoAlgoritmo: PASSOS_DO_ALGORITMO.map((id) => ({ id, rotulo: ROTULO_DO_PASSO_DO_ALGORITMO[id] })),
  criterios: FUNCOES.map((funcao) => ({ funcao, opcoes: OPCOES_DE_CRITERIO.map((id) => ({ id, rotulo: ROTULO_DO_CRITERIO[funcao][id] })) })),
  criteriosIniciais: { ...CRITERIOS_INICIAIS },
  blocos: BLOCOS.map((id) => ({
    id,
    titulo: TEXTO_DO_BLOCO[id].titulo,
    inicio: TEXTO_DO_BLOCO[id].inicio,
    opcoes: OPCOES_DO_BLOCO[id].map((o) => ({ id: o, texto: TEXTO_DO_BLOCO[id].opcoes[o]! })),
  })),
};

const ROTEIRO_DO_PAINEL = { perguntas: [...ROTEIRO.perguntas], transferencia: ROTEIRO.transferencia };

interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  sessao: Sessao | null;
}

const pct = (n: number, de: number) => (de > 0 ? Math.round((n * 100) / de) : 0);

@Injectable()
export class AssistenteInvisivelService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp01em1bService,
    @Optional() private readonly salas?: SalasService,
  ) {}

  /**
   * "Encerrar" a missão na Sala de Aula grava as quatro marcas de quem apostou
   * e não publicou (o "conta ao encerrar" da ADR-154; o PO: "não publicou →
   * não atingiu"). É o gancho da sala, e não um botão novo no painel: o Figma
   * não tem o botão, e o professor já encerra a missão na sala.
   */
  onModuleInit(): void {
    this.salas?.aoEncerrarMissao(async (tx, alvo) => {
      if (alvo.expId === EXP_ID) await this.marcarQuemNaoPublicou(tx, alvo.escolaId, alvo.turmaId);
    });
  }

  // ─────────────────────────────────────────────────────────── leituras do estudante

  /**
   * Boot da experiência. Sem pacote no ar, `preparada: false` e a tela é de
   * espera: a missão NASCE VAZIA. Com pacote, a sessão desta rodada NASCE aqui
   * (idempotente) — é ela que o "100% das sessões abertas" da E3 conta.
   */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { ctx, sessao } = await this.garantirSessao(tx, escolaId, estudanteId, false);
      const p = ctx.pacote;
      return {
        ...(await this.montarEstado(tx, escolaId, estudanteId, ctx, sessao)),
        pacote: p ? { disciplina: p.disciplina, tema: p.tema, conteudo: p.conteudo, contingencia: p.contingencia } : null,
        material: MATERIAL_FIXO,
        medidor: p ? await this.medidor(tx, escolaId, p, sessao) : null,
        tempos: { pollingMs: POLLING_MS },
      };
    }, escolaId);
  }

  /** O polling do gate (3 s) — leve, read-only, e pelo MESMO funil (regras 7 e 8). */
  async gate(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const p = ctx.pacote;
      const sessao = p ? await this.sessaoDe(tx, escolaId, estudanteId, p) : null;
      const passo = passoEfetivo(marcosDe(sessao));
      return {
        preparada: p !== null,
        fase: p ? ctx.fase : null,
        rodada: p?.rodada ?? null,
        atividade: p ? { pacoteId: p.id, rodada: p.rodada } : null,
        passo,
        aguardandoProfessor: p ? aguardandoProfessor(passo, ctx.fase ?? FASE_INICIAL) : true,
        medidor: p ? await this.medidor(tx, escolaId, p, sessao) : null,
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── jogadas do estudante

  /** E1 "Abrir Módulo de Teste" — a Trava 0: só com a turma em `testes`. */
  iniciar(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.jogada(escolaId, estudanteId, daTela, "boas-vindas", async (tx, s) => {
      await this.atualizar(tx, s, { iniciadoEm: new Date() });
      return {};
    });
  }

  /** E2 "Ir para Bateria de Testes": as funções expandidas (pelo menos uma). */
  navegar(escolaId: string, estudanteId: string, daTela: DaTela, abertas: readonly Funcao[]) {
    return this.jogada(escolaId, estudanteId, daTela, "funcoes", async (tx, s) => {
      await this.atualizar(tx, s, { funcoesAbertas: FUNCOES.filter((f) => abertas.includes(f)), navegouEm: new Date() });
      return {};
    });
  }

  /** E3 "Disparar Simulação" — o LATCH 1. A mesma aposta de novo é idempotente; outra, 409 `ja-apostou`. */
  apostar(escolaId: string, estudanteId: string, daTela: DaTela, aposta: Aposta) {
    return this.jogada(
      escolaId,
      estudanteId,
      daTela,
      "aposta",
      async (tx, s) => {
        await this.atualizar(tx, s, { aposta, apostadaEm: new Date() });
        return {};
      },
      async (s) => {
        if (s.aposta !== aposta) throw erroDeJogo("ja-apostou");
        return {};
      },
    );
  }

  /** E4-ALU-01: as três sessões de chat terminaram. */
  concluirSimulacao(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.carimbar(escolaId, estudanteId, daTela, "simulacao", { simulacaoConcluidaEm: new Date() });
  }

  /** E4-ALU-02 "Abrir Fichas de Auditoria de Acesso" (o PQ-02). */
  abrirFichas(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.carimbar(escolaId, estudanteId, daTela, "confronto", { fichasAbertasEm: new Date() });
  }

  /** E4-ALU-03 "Concluir Inspeção de Metadados" — depois dela, a Trava 1. */
  concluirInspecao(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.carimbar(escolaId, estudanteId, daTela, "fichas", { inspecaoConcluidaEm: new Date() });
  }

  /** E5-ALU-01: os cartões. Incompleta vale (o aviso do PO); os acertos ficam no servidor. */
  classificar(escolaId: string, estudanteId: string, daTela: DaTela, classificacao: Classificacao) {
    return this.jogada(escolaId, estudanteId, daTela, "classificacao", async (tx, s) => {
      const cartoes = semVazios(CARTOES, classificacao);
      const c = corrigirCartoes(cartoes as Classificacao);
      await this.atualizar(tx, s, { cartoes, cartoesAcertos: c.acertos, cartoesCompleta: c.completa, classificadaEm: new Date() });
      return {};
    });
  }

  /** E5-ALU-02: abriu o painel opcional (o PQ-04 conta a abertura, não as marcas). Idempotente. */
  abrirAlgoritmo(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.jogada(escolaId, estudanteId, daTela, "algoritmo", async (tx, s) => {
      if (!s.painelPassosAbertoEm) await this.atualizar(tx, s, { painelPassosAbertoEm: new Date() });
      return {};
    });
  }

  /** E5-ALU-02: os passos marcados — repetível enquanto o painel está na tela (até "Pular Etapa"). */
  marcarAlgoritmo(escolaId: string, estudanteId: string, daTela: DaTela, marcados: readonly PassoDoAlgoritmo[]) {
    return this.jogada(escolaId, estudanteId, daTela, "algoritmo", async (tx, s) => {
      if (!s.painelPassosAbertoEm) throw erroDeJogo("passo-invalido");
      await this.atualizar(tx, s, { passosMarcados: PASSOS_DO_ALGORITMO.filter((p) => marcados.includes(p)) });
      return {};
    });
  }

  /** E5-ALU-02 "Pular Etapa": sai do painel opcional, tenha marcado ou não. */
  concluirAlgoritmo(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.carimbar(escolaId, estudanteId, daTela, "algoritmo", { algoritmoConcluidoEm: new Date() });
  }

  /**
   * E5-ALU-03 "Executar Novo Teste de Homologação": o reteste. A mesma
   * configuração de novo (o duplo toque) devolve o último resultado; outra
   * configuração sem "Revisar Critérios" é 409 `passo-invalido`.
   */
  retestar(escolaId: string, estudanteId: string, daTela: DaTela, criterios: Criterios) {
    return this.jogada(
      escolaId,
      estudanteId,
      daTela,
      "criterios",
      async (tx, s) => {
        const equidade = equidadeDoReteste(criterios);
        await this.atualizar(tx, s, {
          criterios: { ...criterios },
          retestes: Math.min(999, s.retestes + 1),
          ...(s.retestes === 0 ? { equidadeNo1oReteste: equidade } : {}),
          ultimaEquidade: equidade,
          retestadoEm: new Date(),
          revisando: false,
        });
        return { reteste: { equidade, ...efeitoDoReteste(criterios) } };
      },
      async (s) => {
        const ultimo = lerCriterios(s.criterios);
        if (!ultimo || !mesmoObjeto(ultimo, criterios)) throw erroDeJogo("passo-invalido");
        return { reteste: { equidade: equidadeDoReteste(ultimo), ...efeitoDoReteste(ultimo) } };
      },
    );
  }

  /** E5-ALU-04 "Revisar Critérios": de volta ao banco até o próximo reteste. */
  revisar(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.carimbar(escolaId, estudanteId, daTela, "reteste", { revisando: true });
  }

  /** E5-ALU-04 "Avançar para …" — com o Aviso Discreto se manteve 1B ou 2B. Depois dele, a Trava 2. */
  avancar(escolaId: string, estudanteId: string, daTela: DaTela) {
    return this.jogada(escolaId, estudanteId, daTela, "reteste", async (tx, s) => {
      const c = lerCriterios(s.criterios) ?? CRITERIOS_INICIAIS;
      await this.atualizar(tx, s, { avancouEm: new Date(), avancouComVies: comVies(c) });
      return {};
    });
  }

  /**
   * E6 "Publicar Transparência e Comunicado" — o LATCH 2, que conclui. A
   * página, os blocos, a correção e o carimbo no MESMO UPDATE (o CHECK cobra
   * os cinco juntos), e as QUATRO marcas na mesma transação. A mesma
   * publicação de novo é idempotente; outra, 409 `ja-publicado`.
   */
  publicar(escolaId: string, estudanteId: string, daTela: DaTela, paginaAtiva: boolean, comunicado: Comunicado) {
    const blocos = semVazios(BLOCOS, comunicado) as Comunicado;
    return this.jogada(
      escolaId,
      estudanteId,
      daTela,
      "publicacao",
      async (tx, s, pacote) => {
        const correcao = corrigirComunicado(blocos);
        const nova = await this.atualizar(tx, s, {
          paginaAtiva,
          comunicado: blocos,
          blocosCorretos: correcao.corretos,
          alinhamento: correcao.alinhamento,
          publicadaEm: new Date(),
        });
        await this.marcarAsQuatro(tx, escolaId, estudanteId, pacote, fatosDe(nova, true));
        return {};
      },
      async (s) => {
        if (s.paginaAtiva !== paginaAtiva || !mesmoObjeto(lerComunicado(s.comunicado), blocos)) throw erroDeJogo("ja-publicado");
        return {};
      },
    );
  }

  // ─────────────────────────────────────────────────────────── o professor

  /** As turmas para o seletor: por MATRÍCULA para o professor; o gestor vê a escola. */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return { turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, serie: t.serie, estudantes: t._count.estudantes })) };
    }, escolaId);
  }

  /** O pacote da turma: o em andamento e o rascunho da curadoria (com os itens editados). */
  async pacoteDaTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [ativo, rascunho] = await Promise.all([
        tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true } }),
        tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } }),
      ]);
      return {
        turma,
        ativo: ativo ? this.paraProfessor(ativo) : null,
        rascunho: rascunho ? this.paraProfessor(rascunho) : null,
        disciplinas: DISCIPLINAS.map((slug) => ({ slug, rotulo: ROTULO_DA_DISCIPLINA[slug] })),
      };
    }, escolaId);
  }

  /**
   * "Gerar Cenários de Teste com IA" (E0-PROF-02/03) — o RASCUNHO do pacote.
   * A turma é conferida ANTES de gastar token; sem saldo ou com o vendor fora,
   * o rascunho é o PACOTE_PADRAO com `contingencia` (a faixa do E3-SIS-01) e o
   * `motivo` que a tela usa. Gerar de novo SUBSTITUI o rascunho (um por turma).
   */
  async gerar(escolaId: string, turmaId: string, professorId: string, perfil: Perfil, recorte: z.infer<typeof GerarSchema>) {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
    const limpo: RecorteDoPreparo = {
      disciplina: recorte.disciplina,
      tema: limpar(recorte.tema),
      topicos: recorte.topicos.map(limpar),
      contexto: recorte.contexto ? limpar(recorte.contexto) || null : null,
    };
    const r = await this.preparo.gerar(escolaId, professorId, perfil, limpo);
    const dados = r.ok
      ? { disciplina: limpo.disciplina, tema: limpo.tema, topicos: [...limpo.topicos], contexto: limpo.contexto ?? null, origem: "ia", contingencia: false }
      : { disciplina: PACOTE_PADRAO.disciplina, tema: PACOTE_PADRAO.tema, topicos: [...PACOTE_PADRAO.topicos], contexto: null, origem: "padrao", contingencia: true };
    const conteudo = r.ok ? r.valor : structuredClone(PACOTE_PADRAO.conteudo);

    const rascunho = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const existente = await tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null }, select: { id: true } });
      const comum = { ...dados, editados: [], conteudoJson: conteudo as unknown as Prisma.InputJsonValue };
      const gerou = r.tokens > 0 ? 1 : 0;
      return existente
        ? tx.exp01em1bPacote.update({
            where: { id: existente.id },
            data: { ...comum, iaGeracoes: { increment: gerou }, iaTokens: { increment: r.tokens } },
          })
        : tx.exp01em1bPacote.create({ data: { escolaId, turmaId, ...comum, iaGeracoes: gerou, iaTokens: r.tokens } });
    }, escolaId);

    return { rascunho: this.exigirParaProfessor(rascunho), usouIa: r.ok, motivo: r.ok ? null : r.motivo };
  }

  /**
   * "Regenerar Este Item" (E0-PROF-04): a IA reescreve UM item do rascunho,
   * com a quota do professor. Sem saldo: 429 `sem-saldo-de-ia`; vendor fora: 503
   * `ia-indisponivel` — e o rascunho fica como estava. O item regenerado
   * perde o "Editado pelo professor".
   */
  async regenerarItem(escolaId: string, turmaId: string, professorId: string, perfil: Perfil, corpo: z.infer<typeof RegenerarItemSchema>) {
    const { recorte, conteudo } = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.rascunhoVisto(tx, escolaId, turmaId, corpo.rascunhoId);
      const c = lerConteudo(linha.conteudoJson);
      if (!c || !ehDe(DISCIPLINAS, linha.disciplina)) throw erroDeJogo("rascunho-nao-encontrado");
      const r: RecorteDoPreparo = { disciplina: linha.disciplina, tema: linha.tema, topicos: linha.topicos, contexto: linha.contexto };
      return { recorte: r, conteudo: c };
    }, escolaId);

    const r = await this.preparo.regenerar(escolaId, professorId, perfil, recorte, conteudo, corpo.item);

    const linha = await this.prisma.comTenancy(async (tx) => {
      await this.travarTurma(tx, escolaId, turmaId);
      const atual = await this.rascunhoVisto(tx, escolaId, turmaId, corpo.rascunhoId);
      if (!r.ok) {
        if (r.tokens > 0) await tx.exp01em1bPacote.update({ where: { id: atual.id }, data: { iaTokens: { increment: r.tokens } } });
        return null;
      }
      /* Só o item muda: outro item editado nesse meio-tempo continua como o professor deixou. */
      const base = lerConteudo(atual.conteudoJson) ?? conteudo;
      const novo = aparar(comItem(base, corpo.item, lerItem(r.valor, corpo.item)));
      const problemas = problemasDoPacote(novo);
      if (problemas.length > 0) throw erroDeJogo("pacote-invalido", problemas);
      return tx.exp01em1bPacote.update({
        where: { id: atual.id },
        data: {
          conteudoJson: novo as unknown as Prisma.InputJsonValue,
          editados: atual.editados.filter((e) => e !== corpo.item),
          iaGeracoes: { increment: 1 },
          iaTokens: { increment: r.tokens },
        },
      });
    }, escolaId);

    if (!r.ok || !linha) throw erroDeJogo(!r.ok && r.motivo === "sem-saldo" ? "sem-saldo-de-ia" : "ia-indisponivel");
    return { rascunho: this.exigirParaProfessor(linha) };
  }

  /** "Editar Texto" (E0-PROF-04): o professor reescreve um item; ele ganha o "Editado pelo professor". */
  async editarItem(escolaId: string, turmaId: string, professorId: string, corpo: z.infer<typeof EditarItemSchema>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await this.rascunhoVisto(tx, escolaId, turmaId, corpo.rascunhoId);
      const conteudo = lerConteudo(linha.conteudoJson);
      if (!conteudo) throw erroDeJogo("rascunho-nao-encontrado");
      if (corpo.titulo !== undefined && !itemTemTitulo(corpo.item)) throw erroDeJogo("payload-invalido", [`${ROTULO_DO_ITEM[corpo.item]} não tem título.`]);
      const limite = limiteDoItem(corpo.item);
      if (corpo.texto.length > limite) throw erroDeJogo("pacote-invalido", [`O texto passa de ${limite} caracteres.`]);
      const novo = aparar(comItem(conteudo, corpo.item, { ...(corpo.titulo !== undefined ? { titulo: corpo.titulo } : {}), texto: corpo.texto }));
      const problemas = problemasDoPacote(novo);
      if (problemas.length > 0) throw erroDeJogo("pacote-invalido", problemas);
      const editados = ITENS_DO_PACOTE.filter((i) => i === corpo.item || linha.editados.includes(i));
      const nova = await tx.exp01em1bPacote.update({
        where: { id: linha.id },
        data: { conteudoJson: novo as unknown as Prisma.InputJsonValue, editados },
      });
      return { rascunho: this.exigirParaProfessor(nova) };
    }, escolaId);
  }

  /**
   * "Aprovar Pacote Homologado" — o portão da curadoria humana. O rascunho vira
   * atividade PRONTA (não no ar, ADR-130). O duplo clique devolve o mesmo pacote.
   */
  async homologar(escolaId: string, turmaId: string, professorId: string, corpo: z.infer<typeof HomologarSchema>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } });
      if (!linha) {
        const ja = ehUuid(corpo.rascunhoId)
          ? await tx.exp01em1bPacote.findFirst({ where: { id: corpo.rascunhoId, escolaId, turmaId, aprovadoEm: { not: null } } })
          : null;
        if (ja) return this.exigirParaProfessor(ja);
        throw erroDeJogo("rascunho-nao-encontrado");
      }
      if (linha.id !== corpo.rascunhoId) throw erroDeJogo("rascunho-desatualizado");
      const problemas = problemasDoPacote(linha.conteudoJson);
      if (problemas.length > 0) throw erroDeJogo("pacote-invalido", problemas);
      const aprovado = await tx.exp01em1bPacote.update({
        where: { id: linha.id },
        data: { ativo: false, rodadaAtual: 1, aprovadoEm: new Date(), aprovadoPor: professorId },
      });
      return this.exigirParaProfessor(aprovado);
    }, escolaId);
  }

  /**
   * "Usar Banco Padrão da Rede" — o caminho curto (§9a, 2 toques): homologa o
   * PACOTE_PADRAO E o põe no ar, numa transação, sem tocar no rascunho. O
   * mesmo padrão já homologado nesta turma (não o de contingência) é REUSADO.
   */
  async usarBancoPadrao(escolaId: string, turmaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const assinatura = JSON.stringify(PACOTE_PADRAO.conteudo);
      const candidatos = await tx.exp01em1bPacote.findMany({
        where: { escolaId, turmaId, origem: "padrao", contingencia: false, aprovadoEm: { not: null } },
        orderBy: { aprovadoEm: "desc" },
      });
      const existente = candidatos.find((c) => {
        const lido = lerConteudo(c.conteudoJson);
        return lido !== null && JSON.stringify(lido) === assinatura;
      });
      const linha =
        existente ??
        (await tx.exp01em1bPacote.create({
          data: {
            escolaId,
            turmaId,
            disciplina: PACOTE_PADRAO.disciplina,
            tema: PACOTE_PADRAO.tema,
            topicos: [...PACOTE_PADRAO.topicos],
            contexto: null,
            origem: "padrao",
            contingencia: false,
            conteudoJson: PACOTE_PADRAO.conteudo as unknown as Prisma.InputJsonValue,
            ativo: false,
            rodadaAtual: 1,
            aprovadoEm: new Date(),
            aprovadoPor: professorId,
          },
        }));
      return this.porNoAr(tx, escolaId, turmaId, linha);
    }, escolaId);
  }

  /** UMA atividade (pacote homologado) desta turma, inteira — o texto da aba Conteúdo, mesmo fora do ar. */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await tx.exp01em1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId, aprovadoEm: { not: null } } });
      const doProfessor = linha ? this.paraProfessor(linha) : null;
      if (!linha || !doProfessor) throw erroDeJogo("atividade-nao-encontrada");
      const r = await tx.exp01em1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      return { ...doProfessor, rodadas: r._max.rodada ?? 0 };
    }, escolaId);
  }

  /** As ATIVIDADES da turma: os pacotes homologados, com o em andamento marcado. */
  async historico(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [aprovados, rodadas] = await Promise.all([
        tx.exp01em1bPacote.findMany({
          where: { escolaId, turmaId, aprovadoEm: { not: null } },
          orderBy: { aprovadoEm: "desc" },
          select: { id: true, disciplina: true, tema: true, origem: true, ativo: true, rodadaAtual: true, aprovadoEm: true },
        }),
        tx.exp01em1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.pacoteId, r._max.rodada ?? 0]));
      const emAndamento = aprovados.find((p) => p.ativo);
      return {
        emAndamento: emAndamento ? { pacoteId: emAndamento.id, rodada: emAndamento.rodadaAtual } : null,
        historico: aprovados.flatMap((p) =>
          ehDe(DISCIPLINAS, p.disciplina)
            ? [
                {
                  id: p.id,
                  disciplina: p.disciplina as Disciplina,
                  tema: p.tema,
                  origem: p.origem === "ia" ? ("ia" as const) : ("padrao" as const),
                  ativo: p.ativo,
                  aprovadoEm: (p.aprovadoEm as Date).toISOString(),
                  rodadas: maiorRodada.get(p.id) ?? 0,
                },
              ]
            : [],
        ),
      };
    }, escolaId);
  }

  /** O pacote do podcast (ADR-150): o pedido, desta turma, ou o em andamento. */
  async pacoteParaPodcast(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const id = pacoteId ?? (await this.exigirPacoteAtivo(tx, escolaId, turmaId)).id;
      const linha = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, id);
      return { id: linha.id, tema: linha.tema };
    }, escolaId);
  }

  /**
   * "Liberar Atividade para a Turma" (E0-PROF-05) e o "Usar esta atividade
   * agora" do histórico (ADR-130). O que estava em andamento volta a ser
   * pronto; a fase volta ao início; o pacote que já rodou abre a rodada
   * SEGUINTE. Idempotente.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, pacoteId);
      return this.porNoAr(tx, escolaId, turmaId, pacote);
    }, escolaId);
  }

  /**
   * As cinco liberações e as duas pausas — só para a frente
   * (`regras/passos.ts#PROXIMAS_FASES`). Pedir a fase em que a turma já está é
   * idempotente (sem histórico novo). "Liberar Início da Simulação" exige 100%
   * das sessões abertas da rodada com aposta (409 `apostas-pendentes`).
   */
  async mudarGate(escolaId: string, turmaId: string, professorId: string, para: Fase) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      const gate = await tx.exp01em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      const atual = normalizarFase(gate?.fase);
      const atividade = { pacoteId: pacote.id, rodada: pacote.rodadaAtual };
      if (para === atual) return { fase: atual, atividade, atualizadoEm: (gate?.atualizadoEm ?? new Date()).toISOString() };
      if (!transicaoValida(atual, para)) throw erroDeJogo("transicao-de-etapa-invalida");
      if (para === "simulacao") {
        const { unidades } = await this.lerATurma(tx, escolaId, turmaId, atividade);
        const abertas = unidades.filter((u) => u.linha.sessao !== null);
        const apostaram = abertas.filter((u) => u.linha.sessao?.apostadaEm).length;
        if (!todosApostaram(abertas.length, apostaram)) throw erroDeJogo("apostas-pendentes");
      }
      const linha = await tx.exp01em1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, fase: para },
        update: { fase: para },
      });
      await tx.exp01em1bGateHistorico.create({
        data: { escolaId, turmaId, pacoteId: pacote.id, rodada: pacote.rodadaAtual, fase: para, professorId },
      });
      return { fase: para, atividade, atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /**
   * "Encerrar" — quem APOSTOU e não publicou recebe as quatro marcas com
   * `publicou: false` (o padrão "conta ao encerrar", ADR-154): o PO diz "não
   * publicou → não atingiu", e sem isto a sessão ficaria sem marca para
   * sempre. A régua decide cada uma (a CO01 lê o reteste, que pode ter
   * acontecido). Repetir é inofensivo: a evidência guarda a MELHOR marca.
   */
  async encerrar(escolaId: string, turmaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      return { marcadas: await this.marcarQuemNaoPublicou(tx, escolaId, turmaId) };
    }, escolaId);
  }

  /** As quatro marcas de "não publicou" na rodada do pacote no ar. Sem pacote no ar, nada. */
  private async marcarQuemNaoPublicou(tx: Tx, escolaId: string, turmaId: string): Promise<number> {
    const ativo = await tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, rodadaAtual: true } });
    if (!ativo) return 0;
    const sessoes = await tx.exp01em1bSessao.findMany({
      where: { escolaId, turmaId, pacoteId: ativo.id, rodada: ativo.rodadaAtual, apostadaEm: { not: null }, publicadaEm: null },
    });
    const pacote = { id: ativo.id, turmaId, rodada: ativo.rodadaAtual };
    for (const s of sessoes) await this.marcarAsQuatro(tx, escolaId, s.estudanteId, pacote, fatosDe(s, false));
    return sessoes.length;
  }

  /**
   * "Zerar Turma para Nova Aplicação" — a rodada seguinte do mesmo pacote, e a
   * evidência dele APAGADA (ADR-155); a fase volta a `aguardando-inicio`. As
   * sessões ficam. `rodada` é a que o professor VIU.
   */
  async novaRodada(escolaId: string, turmaId: string, professorId: string, rodadaVista: number) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      if (pacote.rodadaAtual === rodadaVista + 1) {
        const gate = await tx.exp01em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase) };
      }
      if (pacote.rodadaAtual !== rodadaVista) throw erroDeJogo("rodada-desatualizada");
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: pacote.id });
      const atualizado = await tx.exp01em1bPacote.update({
        where: { id: pacote.id },
        data: { rodadaAtual: { increment: 1 } },
        select: { id: true, rodadaAtual: true },
      });
      await this.voltarAoInicio(tx, escolaId, turmaId);
      return { atividade: { pacoteId: atualizado.id, rodada: atualizado.rodadaAtual }, fase: FASE_INICIAL };
    }, escolaId);
  }

  /**
   * O PAINEL da aula — por estudante (por COMPUTADOR quando há equipe): o
   * passo e a espera, a aposta, a simulação, os cartões, o painel opcional, os
   * critérios e o reteste, o Aviso Discreto, a publicação com o comunicado em
   * texto corrido e os níveis da régua (o gabarito aplicado — é o professor).
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const p = ctx.pacote;
      const { unidades, mapa } = p ? await this.lerATurma(tx, escolaId, turmaId, { pacoteId: p.id, rodada: p.rodada }) : { unidades: [], mapa: new Map() };
      const fase = ctx.fase ?? FASE_INICIAL;
      const linhas = unidades.map(({ linha, equipe }) => this.linhaDoPainel(linha, equipe, fase));
      const abertas = unidades.filter((u) => u.linha.sessao !== null);
      const comSessao = linhas.filter((_, i) => unidades[i]!.linha.sessao !== null);
      const apostas = { a: 0, b: 0, c: 0 };
      for (const l of comSessao) if (l.aposta) apostas[l.aposta] += 1;
      const exercicios = { a: 0, b: 0, c: 0 };
      for (const l of comSessao) if (l.criterios) exercicios[l.criterios.exercicios] += 1;
      const conta = (f: (l: (typeof linhas)[number]) => boolean) => comSessao.filter(f).length;
      const n = abertas.length;
      return {
        turma,
        atividade: p ? { pacoteId: p.id, rodada: p.rodada, tema: p.tema, disciplina: p.disciplina } : null,
        fase: p ? fase : null,
        porComputador: mapa.size > 0,
        resumo: {
          sessoes: n,
          apostas,
          todosApostaram: todosApostaram(n, apostas.a + apostas.b + apostas.c),
          faltamApostar: comSessao.filter((l) => l.aposta === null).map((l) => l.nome),
          simulacoesConcluidas: conta((l) => l.simulacaoConcluida),
          naBancada: conta((l) => indiceDoPasso(l.passo) >= indiceDoPasso("classificacao") && l.passo !== "concluida"),
          criterioExercicios: exercicios,
          avancaramComVies: comSessao.filter((l) => l.avancouComVies).map((l) => l.nome),
          publicaram: conta((l) => l.publicacao !== null),
          paginasAtivas: conta((l) => l.publicacao?.paginaAtiva === true),
          habilidades: {
            co20: pct(conta((l) => l.niveis?.co20 === "atingiu"), n),
            co01: pct(conta((l) => l.niveis?.co01 === "atingiu"), n),
            co18: pct(conta((l) => l.niveis?.co18 === "atingiu"), n),
            co03Participou: pct(conta((l) => l.algoritmo.aberto), n),
          },
        },
        linhas,
        roteiro: ROTEIRO_DO_PAINEL,
      };
    }, escolaId);
  }

  /** O material do GUIA DA AULA: o roteiro e as réguas. Sem tenancy: é catálogo. */
  material() {
    return {
      roteiro: ROTEIRO_DO_PAINEL,
      habilidades: FICHA_EXP01EM1B.habilidades.map((h) => ({
        codigo: h.codigo,
        rotulo: h.marcadores[0]?.rotulo ?? h.codigo,
        criterios: { atingiu: h.criterios.atingiu, em_processo: h.criterios.em_processo, nao_atingiu: h.criterios.nao_atingiu },
      })),
    };
  }

  // ─────────────────────────────────────────────────────────── privados: o estudante

  /**
   * O estado do estudante, depois de uma leitura ou de uma mutação. Allowlist:
   * nada do gabarito (os acertos dos cartões, o alinhamento do comunicado e o
   * certo/errado do algoritmo ficam no painel).
   */
  private async montarEstado(tx: Tx, escolaId: string, estudanteId: string, ctx: ContextoDaTurma, s: Sessao | null): Promise<Estado> {
    const p = ctx.pacote;
    const fase = ctx.fase ?? FASE_INICIAL;
    const passo = passoEfetivo(marcosDe(s));
    const equipe = p ? await equipeDoEstudante(tx, escolaId, p.turmaId, EXP_ID, p.id, estudanteId) : null;
    const criterios = s ? lerCriterios(s.criterios) : null;
    const classificacao = s ? lerClassificacao(s.cartoes) : {};
    return {
      passo,
      fase: p ? fase : null,
      preparada: p !== null,
      aguardandoProfessor: p ? aguardandoProfessor(passo, fase) : true,
      atividade: p ? { pacoteId: p.id, rodada: p.rodada } : null,
      equipe: equipe ? { nome: equipe.nome } : null,
      funcoesAbertas: s ? FUNCOES.filter((f) => s.funcoesAbertas.includes(f)) : [],
      aposta: s && ehDe(APOSTAS, s.aposta) ? s.aposta : null,
      apostadaEm: s?.apostadaEm?.toISOString() ?? null,
      classificacao: s?.classificadaEm
        ? {
            cartoes: classificacao,
            completa: s.cartoesCompleta === true,
            cadeiaCausal: corrigirCartoes(classificacao).cadeiaCausal,
          }
        : null,
      algoritmo: {
        aberto: Boolean(s?.painelPassosAbertoEm),
        marcados: s ? lerPassos(s.passosMarcados) : [],
        enviesados: s ? lerPassos(s.passosMarcados).filter((p) => PASSOS_DE_ACAO_ENVIESADA.includes(p)) : [],
        concluido: Boolean(s?.algoritmoConcluidoEm),
      },
      criterios: criterios ?? { ...CRITERIOS_INICIAIS },
      retestes: s?.retestes ?? 0,
      ultimoReteste: criterios ? { equidade: equidadeDoReteste(criterios), ...efeitoDoReteste(criterios) } : null,
      publicacao:
        s?.publicadaEm && s.paginaAtiva !== null
          ? { paginaAtiva: s.paginaAtiva, comunicado: lerComunicado(s.comunicado), publicadaEm: s.publicadaEm.toISOString() }
          : null,
      concluido: Boolean(s?.publicadaEm),
    };
  }

  /**
   * O medidor da turma (E4-ALU-02): só agregado, só com ≥ 3 apostas
   * (`medidorDaTurma`) — e só para quem JÁ apostou: antes do latch, o
   * percentual dos colegas viraria a resposta do próprio estudante.
   */
  private async medidor(tx: Tx, escolaId: string, p: PacoteNoAr, s: Sessao | null) {
    if (!s?.apostadaEm) return null;
    const grupos = await tx.exp01em1bSessao.groupBy({
      by: ["aposta"],
      where: { escolaId, turmaId: p.turmaId, pacoteId: p.id, rodada: p.rodada, aposta: { not: null } },
      _count: { _all: true },
    });
    const contagens: Partial<Record<Aposta, number>> = {};
    for (const g of grupos) if (ehDe(APOSTAS, g.aposta)) contagens[g.aposta] = g._count._all;
    return medidorDaTurma(contagens);
  }

  /** Uma jogada que só grava um carimbo (ou um sinal) do passo dela. */
  private carimbar(escolaId: string, estudanteId: string, daTela: DaTela, passo: Passo, dados: Prisma.Exp01em1bSessaoUpdateInput) {
    return this.jogada(escolaId, estudanteId, daTela, passo, async (tx, s) => {
      await this.atualizar(tx, s, dados);
      return {};
    });
  }

  /**
   * Núcleo de toda jogada: o funil, a sessão da rodada TRANCADA (`FOR
   * UPDATE`), a atividade da tela conferida, o passo da jogada contra o passo
   * derivado, o trabalho, e o estado relido — com o resultado próprio da
   * jogada por cima. Dois toques rápidos viram duas transações em fila; os
   * CHECKs do banco são a rede final.
   */
  private jogada<E extends object>(
    escolaId: string,
    estudanteId: string,
    daTela: DaTela,
    passoDaJogada: Passo,
    aplicar: (tx: Tx, sessao: Sessao, pacote: PacoteNoAr) => Promise<E>,
    repetir: (sessao: Sessao) => Promise<E | Record<string, never>> = async () => ({}),
  ): Promise<Estado & Partial<E>> {
    return this.prisma.comTenancy(async (tx) => {
      const { ctx, sessao } = await this.garantirSessao(tx, escolaId, estudanteId, true);
      const pacote = ctx.pacote;
      if (!pacote) throw erroDeJogo("missao-em-preparo");
      const s = this.exigirSessao(sessao);
      if (daTela.atividade && (daTela.atividade.pacoteId !== pacote.id || daTela.atividade.rodada !== pacote.rodada)) {
        throw erroDeJogo("rodada-mudou");
      }
      const passo = passoEfetivo(marcosDe(s));
      const [jogada, atual] = [indiceDoPasso(passoDaJogada), indiceDoPasso(passo)];
      let extra: E | Record<string, never>;
      if (jogada < atual) extra = await repetir(s);
      else if (jogada > atual) throw erroDeJogo("passo-invalido");
      else if (aguardandoProfessor(passo, ctx.fase ?? FASE_INICIAL)) throw erroDeJogo("aguardando-professor");
      else extra = await aplicar(tx, s, pacote);
      const relida = await this.sessaoDe(tx, escolaId, estudanteId, pacote);
      return { ...(await this.montarEstado(tx, escolaId, estudanteId, ctx, relida)), ...extra } as Estado & Partial<E>;
    }, escolaId);
  }

  private atualizar(tx: Tx, s: Sessao, data: Prisma.Exp01em1bSessaoUpdateInput): Promise<Sessao> {
    return tx.exp01em1bSessao.update({
      where: { escolaId_estudanteId_pacoteId_rodada: { escolaId: s.escolaId, estudanteId: s.estudanteId, pacoteId: s.pacoteId, rodada: s.rodada } },
      data,
    });
  }

  /** As quatro marcas (E14), na transação de quem chama. Com equipe, a evidência copia a cada integrante. */
  private async marcarAsQuatro(tx: Tx, escolaId: string, estudanteId: string, pacote: { id: string; turmaId: string; rodada: number }, f: FatosDaRegua) {
    const niveis = niveisDe(f);
    const marca = { escolaId, expId: EXP_ID, turmaId: pacote.turmaId, atividadeId: pacote.id, rodada: pacote.rodada, estudanteId };
    for (const [marcador, status] of [
      [MARCADOR_CO20, niveis.co20],
      [MARCADOR_CO01, niveis.co01],
      [MARCADOR_CO18, niveis.co18],
      [MARCADOR_CO03, niveis.co03],
    ] as const) {
      await this.evidencias.marcar(tx, { ...marca, marcador, status });
    }
  }

  private exigirSessao(sessao: Sessao | null): Sessao {
    if (!sessao) throw erroDeJogo("sessao-nao-aberta");
    return sessao;
  }

  /**
   * O FUNIL de toda rota de estudante: a escola do token e a missão liberada
   * na turma (ADR-69, e a disponibilidade da ADR-87 dentro dela). A turma é a
   * de `users.turma_id` — a mesma fonte do painel e das equipes.
   */
  private async estudanteDaEscola(tx: Tx, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true, turmaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId: estudante.turmaId };
  }

  /**
   * O funil + a sessão da rodada no ar, CRIADA se faltar (idempotente:
   * `skipDuplicates`). Com `travar`, a linha sai trancada (`FOR UPDATE`) até o
   * fim da transação — a jogada concorrente da mesma unidade espera.
   */
  private async garantirSessao(tx: Tx, escolaId: string, estudanteId: string, travar: boolean) {
    const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
    const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
    const p = ctx.pacote;
    if (!p) return { ctx, sessao: null };
    await tx.exp01em1bSessao.createMany({
      data: [{ escolaId, estudanteId, pacoteId: p.id, rodada: p.rodada, turmaId: p.turmaId, versaoInstrumento: VERSAO_DO_INSTRUMENTO }],
      skipDuplicates: true,
    });
    if (travar) {
      await tx.$queryRaw`SELECT 1 FROM "exp01em1b_sessoes"
        WHERE "escola_id" = ${escolaId} AND "estudante_id" = ${estudanteId}::uuid
          AND "pacote_id" = ${p.id}::uuid AND "rodada" = ${p.rodada}
        FOR UPDATE`;
    }
    return { ctx, sessao: await this.sessaoDe(tx, escolaId, estudanteId, p) };
  }

  private sessaoDe(tx: Tx, escolaId: string, estudanteId: string, p: PacoteNoAr): Promise<Sessao | null> {
    return tx.exp01em1bSessao.findUnique({
      where: { escolaId_estudanteId_pacoteId_rodada: { escolaId, estudanteId, pacoteId: p.id, rodada: p.rodada } },
    });
  }

  private async contextoDaTurma(tx: Tx, escolaId: string, turmaId: string | null): Promise<ContextoDaTurma> {
    if (!turmaId) return { turmaId: null, pacote: null, fase: null };
    const [linha, gate] = await Promise.all([
      tx.exp01em1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true, turmaId: true, disciplina: true, tema: true, conteudoJson: true, contingencia: true, rodadaAtual: true },
      }),
      tx.exp01em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } }, select: { fase: true } }),
    ]);
    if (!linha) return { turmaId, pacote: null, fase: null };
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo) {
      logger.warn({ codigo: "exp01em1b-pacote-invalido", escolaId, turmaId }, "pacote ativo com forma inesperada");
      return { turmaId, pacote: null, fase: null };
    }
    return {
      turmaId,
      pacote: {
        id: linha.id,
        turmaId: linha.turmaId,
        disciplina: linha.disciplina,
        tema: linha.tema,
        conteudo,
        contingencia: linha.contingencia,
        rodada: linha.rodadaAtual,
      },
      fase: normalizarFase(gate?.fase),
    };
  }

  // ─────────────────────────────────────────────────────────── privados: o professor

  private linhaDoPainel(linha: LinhaDaTurma, equipe: EquipeDoMapa | null, fase: Fase): z.infer<typeof LinhaDoPainelSchema> {
    const s = linha.sessao;
    const passo = passoEfetivo(marcosDe(s));
    const criterios = s ? lerCriterios(s.criterios) : null;
    const marcados = s ? lerPassos(s.passosMarcados) : [];
    const comunicado = s ? lerComunicado(s.comunicado) : {};
    const publicou = Boolean(s?.publicadaEm);
    return {
      unidadeId: equipe?.id ?? linha.estudanteId,
      nome: equipe?.nome ?? linha.nome,
      equipe: equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros.map((m) => ({ id: m.id, nome: m.nome })) } : null,
      passo,
      aguardandoProfessor: s !== null && aguardandoProfessor(passo, fase),
      aposta: s && ehDe(APOSTAS, s.aposta) ? s.aposta : null,
      simulacaoConcluida: Boolean(s?.simulacaoConcluidaEm),
      cartoes: s?.classificadaEm ? { acertos: s.cartoesAcertos ?? 0, completa: s.cartoesCompleta === true } : null,
      algoritmo: { aberto: Boolean(s?.painelPassosAbertoEm), marcados, correto: marcouOsDispensaveis(marcados) },
      criterios,
      retestes: s?.retestes ?? 0,
      equidade: s && ehDe(EQUIDADES, s.ultimaEquidade) ? s.ultimaEquidade : null,
      avancouComVies: s?.avancouComVies === true,
      publicacao:
        s && publicou && ehDe(ALINHAMENTOS, s.alinhamento)
          ? { paginaAtiva: s.paginaAtiva === true, comunicado, texto: textoDoComunicado(comunicado), alinhamento: s.alinhamento }
          : null,
      niveis: s && publicou ? niveisDe(fatosDe(s, true)) : null,
    };
  }

  private async porNoAr(tx: Tx, escolaId: string, turmaId: string, pacote: Exp01em1bPacote) {
    if (pacote.ativo) {
      const gate = await tx.exp01em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase), mudou: false };
    }
    const ultima = await tx.exp01em1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: pacote.id }, _max: { rodada: true } });
    const rodada = (ultima._max.rodada ?? 0) + 1;
    /* Desliga antes de ligar: o índice único PARCIAL aceita um ativo por turma. */
    await tx.exp01em1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
    await tx.exp01em1bPacote.update({ where: { id: pacote.id }, data: { ativo: true, rodadaAtual: rodada } });
    await this.voltarAoInicio(tx, escolaId, turmaId);
    return { atividade: { pacoteId: pacote.id, rodada }, fase: FASE_INICIAL, mudou: true };
  }

  /** A TURMA desta rodada, colapsada em UNIDADES (um computador = uma equipe, ou uma criança). */
  private async lerATurma(tx: Tx, escolaId: string, turmaId: string, atividade: { pacoteId: string; rodada: number }) {
    const estudantes = await tx.user.findMany({
      where: { escolaId, turmaId, role: "estudante" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
    const sessoes = await tx.exp01em1bSessao.findMany({
      where: { escolaId, pacoteId: atividade.pacoteId, rodada: atividade.rodada, estudanteId: { in: estudantes.map((e) => e.id) } },
    });
    const sessaoDe = new Map(sessoes.map((s) => [s.estudanteId, s]));
    const linhas: LinhaDaTurma[] = estudantes.map((e) => ({ estudanteId: e.id, nome: e.displayName, sessao: sessaoDe.get(e.id) ?? null }));
    const mapa = await mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, atividade.pacoteId);
    const unidades = colapsarEmUnidades(
      linhas,
      (l) => l.estudanteId,
      mapa,
      (l) => l.sessao !== null,
      (l) => l.sessao?.atualizadoEm.getTime() ?? 0,
    );
    return { unidades, mapa };
  }

  /** Escola do token E matrícula de professor na turma. **404, nunca 403**. `professorId` indefinido = gestor. */
  private async turmaVisivel(tx: Tx, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true, nome: true, serie: true } });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) throw erroDeJogo("turma-nao-encontrada");
    return turma;
  }

  /** Lock por TURMA: dois professores (ou dois cliques) não intercalam curadoria, fase e rodada. */
  private async travarTurma(tx: Tx, escolaId: string, turmaId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp01em1b-turma:${escolaId}:${turmaId}`}, 0))`;
  }

  /** O rascunho da turma, e só se for o que o professor VIU (`rascunhoId`). */
  private async rascunhoVisto(tx: Tx, escolaId: string, turmaId: string, rascunhoId: string) {
    const linha = await tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } });
    if (!linha) throw erroDeJogo("rascunho-nao-encontrado");
    if (linha.id !== rascunhoId) throw erroDeJogo("rascunho-desatualizado");
    return linha;
  }

  private async pacoteAprovadoDaTurma(tx: Tx, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp01em1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId, aprovadoEm: { not: null } } })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  private async exigirPacoteAtivo(tx: Tx, escolaId: string, turmaId: string) {
    const pacote = await tx.exp01em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, rodadaAtual: true } });
    if (!pacote) throw erroDeJogo("pacote-nao-aprovado");
    return pacote;
  }

  private voltarAoInicio(tx: Tx, escolaId: string, turmaId: string) {
    return tx.exp01em1bGateTurma.upsert({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      create: { escolaId, turmaId, fase: FASE_INICIAL },
      update: { fase: FASE_INICIAL },
    });
  }

  /** O pacote como o professor o vê. Linha com forma inesperada vira `null` (e um aviso no log). */
  private paraProfessor(linha: Exp01em1bPacote): z.infer<typeof PacoteDoProfessorSchema> | null {
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo || !ehDe(DISCIPLINAS, linha.disciplina)) {
      logger.warn({ codigo: "exp01em1b-pacote-invalido", escolaId: linha.escolaId, turmaId: linha.turmaId }, "pacote com forma inesperada");
      return null;
    }
    return {
      id: linha.id,
      disciplina: linha.disciplina,
      tema: linha.tema,
      topicos: linha.topicos,
      contexto: linha.contexto,
      origem: linha.origem === "ia" ? "ia" : "padrao",
      conteudo,
      editados: ITENS_DO_PACOTE.filter((i: ItemDoPacote) => linha.editados.includes(i)),
      contingencia: linha.contingencia,
      aprovadoEm: linha.aprovadoEm?.toISOString() ?? null,
      ativo: linha.ativo,
      rodadaAtual: linha.rodadaAtual,
    };
  }

  private exigirParaProfessor(linha: Exp01em1bPacote) {
    const pacote = this.paraProfessor(linha);
    if (!pacote) throw new Error("o pacote gravado não voltou legível");
    return pacote;
  }
}

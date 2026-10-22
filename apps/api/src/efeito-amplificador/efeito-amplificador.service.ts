import { Injectable } from "@nestjs/common";
import { Prisma, type Exp02em1bPacote, type Exp02em1bSessao } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades, type EquipeDoMapa } from "../equipes/regras";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { FICHA_EXP02EM1B } from "../evidencias/fichas/exp02em1b";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  DISCIPLINAS,
  ENTREGA_POR_HORARIO,
  EXP_ID,
  INDICADORES,
  INDICADORES_QUE_COMPROVAM,
  INSTRUCOES_DO_GATILHO,
  MANCHETES,
  MENSAGENS_NO_CHAT,
  MAX_CARACTERES_DA_MENSAGEM,
  PACOTE_PADRAO,
  PILULAS,
  ROTEIRO_DO_DEBATE,
  ROTULO_DA_DISCIPLINA,
  TEXTOS_DO_EXPLICAR,
  VERSAO_DO_INSTRUMENTO,
  conteudoDoPadrao,
  falaDeAbertura,
  falaDoAssistente,
  type ConteudoDoPacote,
  type Disciplina,
  type Fase,
  type Intencao,
  type Manchete,
  type Origem,
} from "./conteudo";
import { ConteudoBaseSchema, type EstadoSchema, type HomologarSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PreparoDaExp02em1bService, type MotivoDoPadrao } from "./preparo.service";
import {
  MARCADOR_CO08,
  MARCADOR_CO14,
  MARCADOR_CO24,
  MARCADOR_CO26,
  nivelCO08,
  nivelCO14,
  nivelCO24,
  nivelCO26,
} from "./regras/evidencia";
import { aplicarAcao, dimensoesInspecionadas, lerFeed, type AcaoNoFeed, type FeedDaSessao } from "./regras/feed";
import { classificar } from "./regras/intencoes";
import { FASE_INICIAL, avancarFase, normalizarFase, passoEfetivo, pausada, type MarcosDaSessao } from "./regras/passos";
import {
  alternarParagrafo,
  aplicarIntencao,
  lerPrevia,
  noResolvido,
  paragrafosVisiveis,
  textoPublicado,
  trechoPincado,
  type Previa,
} from "./regras/previa";

/**
 * Persistência e regras aplicadas da exp02em1b — O Efeito Amplificador (ADR-181).
 *
 * Molde: `quem-mandou-isso` (o funil, os locks, o pacote como atividade e a
 * rodada como reaplicação). Toda query leva `escola_id` no `where` ALÉM da RLS
 * que o `comTenancy` arma (regra 1, defesa em profundidade).
 *
 * **A aula é determinística.** O UnooriaAI da aula é a árvore de intenções do
 * servidor sobre o pacote homologado; a única IA é o preparo do professor.
 *
 * **O gabarito não desce.** O comentário vai sem a categoria de saúde, o
 * indicador sem o `comprova`, o parágrafo sem o nó: quem diz o que um gesto
 * mediu é este serviço, e as marcas entram na transação de cada gesto.
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
  fase: Fase | null;
}

const CAMPOS_DA_SESSAO = {
  entrouEm: true,
  conversa: true,
  mensagensEnviadas: true,
  previa: true,
  manchete: true,
  textoPublicado: true,
  trechoPincado: true,
  publicadaEm: true,
  feed: true,
  explicarEm: true,
  indicadores: true,
  ultimoNaoComprova: true,
  concluidoEm: true,
  atualizadoEm: true,
} satisfies Prisma.Exp02em1bSessaoSelect;

type LinhaDaSessao = Pick<Exp02em1bSessao, keyof typeof CAMPOS_DA_SESSAO>;

function marcosDe(s: LinhaDaSessao | null | undefined): MarcosDaSessao | null {
  if (!s) return null;
  return { publicou: s.publicadaEm !== null, concluiu: s.concluidoEm !== null };
}

/** Uma fala gravada no chat. O texto do estudante é de menor: só a sessão o guarda. */
interface FalaGravada {
  papel: "estudante" | "assistente";
  texto: string;
  intencao?: Intencao;
  em: string;
}

function lerConversa(bruto: Prisma.JsonValue): FalaGravada[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((f) => {
    if (typeof f !== "object" || f === null || Array.isArray(f)) return [];
    const o = f as Record<string, unknown>;
    if ((o.papel !== "estudante" && o.papel !== "assistente") || typeof o.texto !== "string") return [];
    return [{ papel: o.papel, texto: o.texto, em: typeof o.em === "string" ? o.em : "" }];
  });
}

/** O conteúdo do `Json` da linha, ou `null` se a forma não bate (linha de outra versão). */
function lerConteudo(bruto: Prisma.JsonValue): ConteudoDoPacote | null {
  const lido = ConteudoBaseSchema.safeParse(bruto);
  return lido.success ? lido.data : null;
}

function ehManchete(v: string | null): v is Manchete {
  return v !== null && (MANCHETES as readonly string[]).includes(v);
}

const limpar = (t: string) => t.replace(/\s+/g, " ").trim();

function recorteLimpo(r: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null }) {
  const contexto = r.contexto ? limpar(r.contexto) : "";
  return { disciplina: r.disciplina, tema: limpar(r.tema), assuntos: r.assuntos.map(limpar), contexto: contexto || null };
}

/** A assinatura estável do que o professor homologa — o JSONB reordena chaves, então JSON cru mentiria. */
function assinatura(c: { disciplina: string; tema: string; assuntos: readonly string[]; contexto: string | null; conteudo: ConteudoDoPacote }): string {
  const k = c.conteudo;
  return JSON.stringify([
    c.disciplina,
    c.tema,
    [...c.assuntos],
    c.contexto,
    k.rascunho.map((p) => [p.id, p.no, p.texto, p.corrigido ?? ""]),
    [k.fonteInventada, k.colega, k.veiculo, k.recorte],
    MANCHETES.map((m) => k.manchetes[m]),
    k.comentarios.map((x) => [x.id, x.autor, x.handle, x.horario, x.tipo, x.texto]),
  ]);
}

function padrao() {
  return {
    nome: PACOTE_PADRAO.nome,
    disciplina: PACOTE_PADRAO.disciplina,
    tema: PACOTE_PADRAO.tema,
    assuntos: [...PACOTE_PADRAO.assuntos],
    conteudo: conteudoDoPadrao(),
  };
}

const ROTEIRO = { perguntas: [...ROTEIRO_DO_DEBATE], instrucoes: { ...INSTRUCOES_DO_GATILHO } };

interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  sessao: LinhaDaSessao | null;
}

@Injectable()
export class EfeitoAmplificadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp02em1bService,
  ) {}

  // ─────────────────────────────────────────────────────────── leituras

  /**
   * Boot da experiência — READ-ONLY. Sem pacote no ar, `preparada: false` e a
   * tela é de espera: a missão NASCE VAZIA (o tema é o que o professor escolheu).
   */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      return {
        ...this.montarEstado(ctx, sessao),
        tema: ctx.pacote?.tema ?? null,
        textos: {
          abertura: ctx.pacote ? falaDeAbertura(ctx.pacote.tema) : null,
          pilulas: [...PILULAS],
          explicar: {
            titulo: TEXTOS_DO_EXPLICAR.titulo,
            instrucao: TEXTOS_DO_EXPLICAR.instrucao,
            naoComprova: TEXTOS_DO_EXPLICAR.naoComprova,
            citacao: TEXTOS_DO_EXPLICAR.citacao,
            conceitos: TEXTOS_DO_EXPLICAR.conceitos.map((c) => ({ ...c })),
            esperaAtiva: TEXTOS_DO_EXPLICAR.esperaAtiva,
          },
        },
      };
    }, escolaId);
  }

  /** O polling do gate (3 s) — leve, e pelo MESMO funil (regras 7 e 8). */
  async gate(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      const passo = passoEfetivo(marcosDe(sessao), ctx.fase);
      return {
        fase: ctx.pacote ? ctx.fase : null,
        passo,
        pausada: pausada(passo, ctx.fase),
        preparada: ctx.pacote !== null,
        atividade: ctx.pacote ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada } : null,
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── mutações

  /** "Iniciar Campanha" — abre a sessão desta rodada. Idempotente. */
  entrar(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (sessao) return;
      await tx.exp02em1bSessao.createMany({
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
   * Uma mensagem ao UnooriaAI. A intenção é classificada AQUI (lista fechada,
   * `regras/intencoes.ts`), a prévia muda pelo que ela pede, e a fala volta do
   * catálogo com os nomes do pacote. Até `MENSAGENS_NO_CHAT`; a quinta leva o
   * aviso do limite junto.
   */
  mensagem(escolaId: string, estudanteId: string, texto: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      const s = this.exigirConversaAberta(sessao, fase);
      if (s.mensagensEnviadas >= MENSAGENS_NO_CHAT) throw erroDeJogo("limite-do-chat");
      const previa = lerPrevia(s.previa, pacote.conteudo.rascunho);
      const intencao = classificar(texto, pacote.conteudo, previa.ofertaDeSubstituicao);

      let nova: Previa = previa;
      let fala: Parameters<typeof falaDoAssistente>[0] = intencao;
      if (!previa.gerada && intencao !== "gerar_rascunho" && intencao !== "fora_do_tema") {
        fala = "sem_rascunho";
      } else if (intencao !== "fora_do_tema" && intencao !== "confirmar_previa") {
        const efeito = aplicarIntencao(previa, pacote.conteudo.rascunho, intencao);
        nova = efeito.previa;
        if (efeito.jaCorrigido) fala = "ja_corrigido";
      }

      const agora = new Date().toISOString();
      const enviadas = s.mensagensEnviadas + 1;
      const conversa: FalaGravada[] = [
        ...lerConversa(s.conversa),
        { papel: "estudante", texto: texto.slice(0, MAX_CARACTERES_DA_MENSAGEM), intencao, em: agora },
        { papel: "assistente", texto: falaDoAssistente(fala, pacote.conteudo), em: agora },
        ...(enviadas >= MENSAGENS_NO_CHAT
          ? [{ papel: "assistente" as const, texto: falaDoAssistente("limite", pacote.conteudo), em: agora }]
          : []),
      ];
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          conversa: conversa as unknown as Prisma.InputJsonValue,
          mensagensEnviadas: enviadas,
          previa: nova as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  /** Tirar ou devolver um parágrafo da prévia — a mão do estudante. */
  paragrafo(escolaId: string, estudanteId: string, paragrafoId: string, removido: boolean) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      const s = this.exigirConversaAberta(sessao, fase);
      const previa = lerPrevia(s.previa, pacote.conteudo.rascunho);
      if (!previa.gerada) throw erroDeJogo("rascunho-nao-gerado");
      const nova = alternarParagrafo(previa, paragrafoId, removido);
      if (!nova) throw erroDeJogo("paragrafo-desconhecido");
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { previa: nova as unknown as Prisma.InputJsonValue },
      });
    });
  }

  /**
   * "Publicar no Unoovista" — O LATCH. Manchete, texto, trecho pinçado e
   * carimbo no MESMO UPDATE (o CHECK cobra os quatro juntos), e as marcas da
   * EM13CO14 e da EM13CO26 na MESMA transação: se a evidência falhar, o post
   * não sai — e vice-versa. A mesma manchete de novo é idempotente; outra, 409.
   */
  publicar(escolaId: string, estudanteId: string, manchete: Manchete) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      if (!sessao) throw erroDeJogo("sessao-nao-aberta");
      if (sessao.publicadaEm) {
        if (sessao.manchete === manchete) return;
        throw erroDeJogo("ja-publicado");
      }
      const s = this.exigirConversaAberta(sessao, fase);
      const previa = lerPrevia(s.previa, pacote.conteudo.rascunho);
      if (!previa.gerada) throw erroDeJogo("rascunho-nao-gerado");
      const rascunho = pacote.conteudo.rascunho;
      const texto = pacote.conteudo.manchetes[manchete];
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          manchete,
          textoPublicado: textoPublicado(previa, rascunho),
          trechoPincado: trechoPincado(previa, pacote.conteudo, texto),
          publicadaEm: new Date(),
        },
      });
      const marca = this.marcaDe(escolaId, estudanteId, pacote);
      await this.evidencias.marcar(tx, {
        ...marca,
        marcador: MARCADOR_CO14,
        status: nivelCO14({ pediuFonte: previa.pediuFonte, dadoResolvido: noResolvido(previa, rascunho, "alucinacao") }),
      });
      await this.evidencias.marcar(tx, {
        ...marca,
        marcador: MARCADOR_CO26,
        status: nivelCO26({
          plagioResolvido: noResolvido(previa, rascunho, "plagio"),
          lgpdResolvido: noResolvido(previa, rascunho, "lgpd"),
        }),
      });
    });
  }

  /**
   * Uma ação no feed da madrugada. Grava e marca a EM13CO24 e a EM13CO08 com o
   * nível que o feed JÁ alcançou (vale a melhor); "não atingiu" não se marca
   * aqui — só quando o feed fecha (`abrirExplicar`). Depois de abrir o
   * Explicar, o feed é histórico: 409.
   */
  acaoNoFeed(escolaId: string, estudanteId: string, acao: AcaoNoFeed) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      if (!sessao) throw erroDeJogo("sessao-nao-aberta");
      if (!sessao.publicadaEm) throw erroDeJogo("nao-publicado");
      if (sessao.explicarEm) throw erroDeJogo("explicar-nao-liberado");
      if (fase === "debate") throw erroDeJogo("telas-pausadas");
      const r = aplicarAcao(lerFeed(sessao.feed), pacote.conteudo.comentarios, acao);
      if (!r.ok) throw erroDeJogo(r.codigo);
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { feed: r.feed as unknown as Prisma.InputJsonValue },
      });
      await this.marcarOFeed(tx, escolaId, estudanteId, pacote, r.feed, false);
    });
  }

  /**
   * A entrada no Explicar (Etapa 5), depois de o professor liberar. Fecha o
   * feed: o que o estudante não fez lá vira "não atingiu" na EM13CO24 e na
   * EM13CO08, na mesma transação do carimbo. Idempotente.
   */
  abrirExplicar(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      if (!sessao) throw erroDeJogo("sessao-nao-aberta");
      if (!sessao.publicadaEm) throw erroDeJogo("nao-publicado");
      if (sessao.explicarEm) return;
      if (fase !== "explicar") throw erroDeJogo("explicar-nao-liberado");
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { explicarEm: new Date() },
      });
      await this.marcarOFeed(tx, escolaId, estudanteId, pacote, lerFeed(sessao.feed), true);
    });
  }

  /**
   * Um indicador apontado na folha de bastidores. O gabarito é daqui: o que
   * comprova entra na lista; o que não comprova acende a dica, e não conta.
   * Não é evidência (é indicativo — o handoff o chama de EVT-007).
   */
  apontarIndicador(escolaId: string, estudanteId: string, indicador: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (!sessao?.explicarEm) throw erroDeJogo("explicar-nao-liberado");
      if (sessao.concluidoEm) return;
      const comprova = INDICADORES_QUE_COMPROVAM.includes(indicador);
      const indicadores = comprova && !sessao.indicadores.includes(indicador) ? [...sessao.indicadores, indicador] : sessao.indicadores;
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { indicadores, ultimoNaoComprova: !comprova },
      });
    });
  }

  /** O fim: exige os dois indicadores que comprovam (one-pager §4, Etapa 5). Idempotente. */
  concluir(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (!sessao?.explicarEm) throw erroDeJogo("explicar-nao-liberado");
      if (sessao.concluidoEm) return;
      if (!INDICADORES_QUE_COMPROVAM.every((i) => sessao.indicadores.includes(i))) throw erroDeJogo("evidencias-incompletas");
      await tx.exp02em1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { concluidoEm: new Date() },
      });
    });
  }

  // ─────────────────────────────────────────────────────── o professor

  /** O pacote da turma: o em andamento, o rascunho e o banco padrão — COM o gabarito (é o roteiro do professor). */
  async pacoteDaTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [ativo, rascunho] = await Promise.all([
        tx.exp02em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true } }),
        tx.exp02em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } }),
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
   * "Gerar Conteúdo com IA" — o RASCUNHO do pacote. A turma é conferida ANTES
   * de gastar token; sem saldo ou com o vendor fora, o rascunho sai do banco
   * curado (`usouIa: false` e o `motivo`). O rascunho é GRAVADO (um por turma).
   */
  async gerar(
    escolaId: string,
    turmaId: string,
    professorId: string,
    perfil: Perfil,
    recorte: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null },
  ) {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
    const limpo = recorteLimpo(recorte);
    const resultado = await this.preparo.gerar(escolaId, professorId, perfil, limpo);
    const conteudo = resultado.conteudo ?? conteudoDoPadrao();
    const dados = resultado.conteudo
      ? { ...limpo, origem: "ia" as Origem }
      : { disciplina: limpo.disciplina, tema: PACOTE_PADRAO.tema, assuntos: [...PACOTE_PADRAO.assuntos], contexto: null, origem: "padrao" as Origem };

    const rascunho = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const existente = await tx.exp02em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null }, select: { id: true } });
      const comum = { ...dados, conteudoJson: conteudo as unknown as Prisma.InputJsonValue };
      const custo = { iaGeracoes: { increment: resultado.tokens > 0 ? 1 : 0 }, iaTokens: { increment: resultado.tokens } };
      return existente
        ? tx.exp02em1bPacote.update({ where: { id: existente.id }, data: { ...comum, ...custo } })
        : tx.exp02em1bPacote.create({
            data: { escolaId, turmaId, ...comum, iaGeracoes: resultado.tokens > 0 ? 1 : 0, iaTokens: resultado.tokens },
          });
    }, escolaId);

    const motivo: MotivoDoPadrao | null = resultado.motivo;
    return { rascunho: this.exigirParaProfessor(rascunho), usouIa: resultado.conteudo !== null, motivo };
  }

  /**
   * "Homologar Pacote" — o portão da curadoria humana (one-pager §14). O corpo
   * traz o pacote INTEIRO como o professor o deixou. Homologar um pacote novo é
   * ATIVIDADE nova, e ela nasce PRONTA, não no ar (ADR-130); homologar de novo
   * o mesmo que o último homologado é idempotente.
   */
  async homologar(escolaId: string, turmaId: string, professorId: string, corpo: z.infer<typeof HomologarSchema>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      return this.exigirParaProfessor(await this.gravarHomologado(tx, escolaId, turmaId, professorId, corpo));
    }, escolaId);
  }

  /**
   * "Usar pacote padrão: Convivência Escolar e Celular" — o caminho curto (2
   * toques): homologa o banco curado E o põe no ar, numa transação.
   */
  async usarBancoPadrao(escolaId: string, turmaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const p = padrao();
      const linha = await this.gravarHomologado(tx, escolaId, turmaId, professorId, {
        disciplina: p.disciplina,
        tema: p.tema,
        assuntos: p.assuntos,
        contexto: null,
        origem: "padrao",
        conteudo: p.conteudo,
      });
      return this.porNoAr(tx, escolaId, turmaId, linha);
    }, escolaId);
  }

  /** As ATIVIDADES da turma: os pacotes homologados, com o em andamento marcado. */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [aprovados, rodadas] = await Promise.all([
        tx.exp02em1bPacote.findMany({
          where: { escolaId, turmaId, aprovadoEm: { not: null } },
          orderBy: { aprovadoEm: "desc" },
          select: { id: true, disciplina: true, tema: true, origem: true, ativo: true, rodadaAtual: true, aprovadoEm: true },
        }),
        tx.exp02em1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
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

  /** UM pacote homologado, inteiro e com o gabarito. */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, pacoteId);
      const rodadas = await tx.exp02em1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      return { ...this.exigirParaProfessor(linha), rodadas: rodadas._max.rodada ?? 0 };
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
   * "Iniciar Atividade com a Turma" — o professor escolhe o pacote que a turma
   * usa (ADR-130). O que estava em andamento volta a ser pronto; a fase volta à
   * `aberta`; o pacote que já rodou abre a rodada SEGUINTE. Idempotente.
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
   * Os dois botões da condução: "Pausar Telas para Debate" e "Liberar Etapa 5".
   * A fase só anda para a FRENTE (`avancarFase`), e cada mudança entra no
   * histórico (EVT-P05). É a linha que o polling do estudante lê.
   */
  async mudarGate(escolaId: string, turmaId: string, professorId: string, acao: "pausar" | "liberar_explicar") {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      const atual = await tx.exp02em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      const antes = normalizarFase(atual?.fase);
      const fase = avancarFase(antes, acao === "pausar" ? "debate" : "explicar");
      const linha = await tx.exp02em1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, fase },
        update: { fase },
      });
      if (fase !== antes) {
        await tx.exp02em1bGateHistorico.create({
          data: { escolaId, turmaId, pacoteId: pacote.id, rodada: pacote.rodadaAtual, fase, professorId },
        });
      }
      return { fase, atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /**
   * "Zerar Turma" — a rodada seguinte do mesmo pacote, e a evidência dele
   * APAGADA (ADR-155). As sessões ficam. `rodada` é a que o professor VIU.
   */
  async novaRodada(escolaId: string, turmaId: string, professorId: string, rodadaVista: number) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      if (pacote.rodadaAtual === rodadaVista + 1) {
        const gate = await tx.exp02em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase) };
      }
      if (pacote.rodadaAtual !== rodadaVista) throw erroDeJogo("rodada-desatualizada");
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: pacote.id });
      const atualizado = await tx.exp02em1bPacote.update({
        where: { id: pacote.id },
        data: { rodadaAtual: { increment: 1 } },
        select: { id: true, rodadaAtual: true },
      });
      await this.voltarAoInicio(tx, escolaId, turmaId);
      return { atividade: { pacoteId: atualizado.id, rodada: atualizado.rodadaAtual }, fase: FASE_INICIAL };
    }, escolaId);
  }

  /**
   * O PAINEL — por COMPUTADOR quando há equipe. A lousa (`resumo`) só tem
   * AGREGADOS: nenhum nome, nenhum nível (one-pager §9). A folha nominal diz o
   * passo e a manchete escolhida (é por ela que o professor chama "chamadas
   * opostas" para ler os comentários) — nunca o nível, que é da evidência, e
   * nunca o chat, que é texto de menor.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const { unidades, mapa } = await this.lerATurma(tx, escolaId, turmaId, ctx.pacote);
      const manchetes = { neutra: 0, construtiva: 0, sensacionalista: 0 };
      let publicaram = 0;
      for (const { linha } of unidades) {
        const m = linha.sessao?.manchete ?? null;
        if (linha.sessao?.publicadaEm && ehManchete(m)) {
          publicaram += 1;
          manchetes[m] += 1;
        }
      }
      return {
        turma,
        atividade: ctx.pacote ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, tema: ctx.pacote.tema } : null,
        fase: ctx.pacote ? ctx.fase : null,
        porComputador: mapa.size > 0,
        resumo: {
          unidades: unidades.length,
          publicaram,
          /* O motor entrega TODO post de madrugada, seja qual for a manchete: o número é o das publicações. */
          picoNaMadrugada: publicaram,
          manchetes,
          entrega: ENTREGA_POR_HORARIO.map((e) => ({ ...e })),
        },
        linhas: unidades.map(({ linha, equipe }) => ({
          estudanteId: linha.estudanteId,
          nome: linha.nome,
          equipe: equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros.map((m) => ({ id: m.id, nome: m.nome })) } : null,
          passo: passoEfetivo(marcosDe(linha.sessao), ctx.fase),
          manchete: ehManchete(linha.sessao?.manchete ?? null) ? (linha.sessao?.manchete as Manchete) : null,
        })),
        roteiro: ROTEIRO,
      };
    }, escolaId);
  }

  /** O material do GUIA DA AULA: o banco curado COM o gabarito, o roteiro e as réguas. Sem tenancy: é catálogo. */
  material() {
    return {
      padrao: padrao(),
      roteiro: ROTEIRO,
      indicadores: INDICADORES.map((i) => ({ ...i })),
      habilidades: FICHA_EXP02EM1B.habilidades.map((h) => ({
        codigo: h.codigo,
        rotulo: h.marcadores[0]?.rotulo ?? h.codigo,
        criterios: { atingiu: h.criterios.atingiu, em_processo: h.criterios.em_processo, nao_atingiu: h.criterios.nao_atingiu },
      })),
    };
  }

  // ─────────────────────────────────────────────────────────── privados

  /** O estado do estudante, depois de uma leitura ou de uma mutação. Allowlist: nada do gabarito. */
  private montarEstado(ctx: ContextoDaTurma, sessao: LinhaDaSessao | null): z.infer<typeof EstadoSchema> {
    const pacote = ctx.pacote;
    const passo = passoEfetivo(marcosDe(sessao), ctx.fase);
    const previa = pacote && sessao ? lerPrevia(sessao.previa, pacote.conteudo.rascunho) : null;
    const feed = sessao?.publicadaEm ? lerFeed(sessao.feed) : null;
    return {
      passo,
      fase: pacote ? ctx.fase : null,
      pausada: pausada(passo, ctx.fase),
      preparada: pacote !== null,
      atividade: pacote ? { pacoteId: pacote.id, rodada: pacote.rodada } : null,
      conversa: {
        mensagens: sessao ? lerConversa(sessao.conversa).map((f) => ({ papel: f.papel, texto: f.texto })) : [],
        restantes: Math.max(0, MENSAGENS_NO_CHAT - (sessao?.mensagensEnviadas ?? 0)),
      },
      previa:
        pacote && previa
          ? { gerada: previa.gerada, paragrafos: previa.gerada ? paragrafosVisiveis(previa, pacote.conteudo.rascunho) : [] }
          : null,
      manchetes: pacote && previa?.gerada ? MANCHETES.map((id) => ({ id, texto: pacote.conteudo.manchetes[id] })) : null,
      publicacao:
        pacote && sessao?.publicadaEm && ehManchete(sessao.manchete)
          ? {
              manchete: { id: sessao.manchete, texto: pacote.conteudo.manchetes[sessao.manchete] },
              texto: sessao.textoPublicado ?? "",
              trechoPincado: sessao.trechoPincado ?? "",
              publicadaEm: sessao.publicadaEm.toISOString(),
            }
          : null,
      feed:
        pacote && feed
          ? {
              comentarios: pacote.conteudo.comentarios.map((c) => ({ id: c.id, autor: c.autor, handle: c.handle, horario: c.horario, texto: c.texto })),
              ...feed,
              entrega: ENTREGA_POR_HORARIO.map((e) => ({ ...e })),
            }
          : null,
      explicar: sessao?.explicarEm
        ? {
            indicadores: INDICADORES.map((i) => ({ id: i.id, rotulo: i.rotulo, confirmado: sessao.indicadores.includes(i.id) })),
            ultimoNaoComprova: sessao.ultimoNaoComprova,
            completo: INDICADORES_QUE_COMPROVAM.every((i) => sessao.indicadores.includes(i)),
          }
        : null,
      concluido: Boolean(sessao?.concluidoEm),
    };
  }

  /**
   * As marcas do feed. `fechando` (a abertura do Explicar): marca também o
   * "não atingiu" de quem não fez nada. Antes disso, só o que já foi
   * alcançado — a melhor vale, e uma marca baixa precoce não ensina nada.
   */
  private async marcarOFeed(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    pacote: PacoteDaTurma,
    feed: FeedDaSessao,
    fechando: boolean,
  ) {
    const dims = dimensoesInspecionadas(feed, pacote.conteudo.comentarios);
    const co24 = nivelCO24({ ...dims, moderou: feed.moderacoes.length > 0, metricas: feed.metricas });
    const co08 = nivelCO08({ privacidade: feed.privacidade, denunciou: feed.denuncias.length > 0, ajuda: feed.ajuda });
    const marca = this.marcaDe(escolaId, estudanteId, pacote);
    if (fechando || co24 !== "nao_atingiu") await this.evidencias.marcar(tx, { ...marca, marcador: MARCADOR_CO24, status: co24 });
    if (fechando || co08 !== "nao_atingiu") await this.evidencias.marcar(tx, { ...marca, marcador: MARCADOR_CO08, status: co08 });
  }

  /** As Etapas 1 a 3 aceitam jogada: sessão aberta, antes do latch e sem a pausa do professor. */
  private exigirConversaAberta(sessao: LinhaDaSessao | null, fase: Fase | null): LinhaDaSessao {
    if (!sessao) throw erroDeJogo("sessao-nao-aberta");
    if (sessao.publicadaEm) throw erroDeJogo("ja-publicado");
    if (fase === "debate") throw erroDeJogo("telas-pausadas");
    return sessao;
  }

  private async gravarHomologado(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    professorId: string,
    corpo: z.infer<typeof HomologarSchema>,
  ): Promise<Exp02em1bPacote> {
    const recorte = recorteLimpo(corpo);
    const conteudo = corpo.conteudo as ConteudoDoPacote;
    const ultimo = await tx.exp02em1bPacote.findFirst({
      where: { escolaId, turmaId, aprovadoEm: { not: null } },
      orderBy: { aprovadoEm: "desc" },
    });
    if (ultimo) {
      const doUltimo = lerConteudo(ultimo.conteudoJson);
      if (doUltimo && assinatura({ ...ultimo, conteudo: doUltimo }) === assinatura({ ...recorte, conteudo })) return ultimo;
    }
    const dados = {
      ...recorte,
      origem: corpo.origem,
      conteudoJson: conteudo as unknown as Prisma.InputJsonValue,
      ativo: false,
      rodadaAtual: 1,
      aprovadoEm: new Date(),
      aprovadoPor: professorId,
    };
    const rascunho = await tx.exp02em1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null }, select: { id: true } });
    return rascunho
      ? tx.exp02em1bPacote.update({ where: { id: rascunho.id }, data: dados })
      : tx.exp02em1bPacote.create({ data: { escolaId, turmaId, ...dados } });
  }

  private async porNoAr(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacote: Exp02em1bPacote) {
    if (pacote.ativo) {
      const gate = await tx.exp02em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase), mudou: false };
    }
    const ultima = await tx.exp02em1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: pacote.id }, _max: { rodada: true } });
    const rodada = (ultima._max.rodada ?? 0) + 1;
    /* Desliga antes de ligar: o índice único PARCIAL aceita um ativo por turma. */
    await tx.exp02em1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
    await tx.exp02em1bPacote.update({ where: { id: pacote.id }, data: { ativo: true, rodadaAtual: rodada } });
    await this.voltarAoInicio(tx, escolaId, turmaId);
    return { atividade: { pacoteId: pacote.id, rodada }, fase: FASE_INICIAL, mudou: true };
  }

  /** A TURMA desta rodada, colapsada em UNIDADES (um computador = uma equipe, ou uma criança). */
  private async lerATurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacote: PacoteDaTurma | null) {
    const estudantes = await tx.user.findMany({
      where: { escolaId, turmaId, role: "estudante" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
    const sessoes = pacote
      ? await tx.exp02em1bSessao.findMany({
          where: { escolaId, pacoteId: pacote.id, rodada: pacote.rodada, estudanteId: { in: estudantes.map((e) => e.id) } },
          select: { estudanteId: true, ...CAMPOS_DA_SESSAO },
        })
      : [];
    const sessaoDe = new Map(sessoes.map((s) => [s.estudanteId, s]));
    const linhas: LinhaDaTurma[] = estudantes.map((e) => ({ estudanteId: e.id, nome: e.displayName, sessao: sessaoDe.get(e.id) ?? null }));
    const mapa: Map<string, EquipeDoMapa> = pacote ? await mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, pacote.id) : new Map();
    const unidades = colapsarEmUnidades(
      linhas,
      (l) => l.estudanteId,
      mapa,
      (l) => l.sessao !== null,
      (l) => l.sessao?.atualizadoEm.getTime() ?? 0,
    );
    return { unidades, mapa };
  }

  private async contextoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string | null): Promise<ContextoDaTurma> {
    if (!turmaId) return { turmaId: null, pacote: null, fase: null };
    const [linha, gate] = await Promise.all([
      tx.exp02em1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true, turmaId: true, tema: true, conteudoJson: true, rodadaAtual: true },
      }),
      tx.exp02em1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } }, select: { fase: true } }),
    ]);
    if (!linha) return { turmaId, pacote: null, fase: null };
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo) {
      logger.warn({ codigo: "exp02em1b-pacote-invalido", escolaId, turmaId }, "pacote ativo com forma inesperada");
      return { turmaId, pacote: null, fase: null };
    }
    return {
      turmaId,
      pacote: { id: linha.id, turmaId: linha.turmaId, tema: linha.tema, conteudo, rodada: linha.rodadaAtual },
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

  private sessaoDe(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, pacote: PacoteDaTurma): Promise<LinhaDaSessao | null> {
    return tx.exp02em1bSessao.findUnique({
      where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
      select: CAMPOS_DA_SESSAO,
    });
  }

  /**
   * O FUNIL de toda rota de estudante: a escola do token e a missão liberada
   * na turma (ADR-69, e a disponibilidade da ADR-87 dentro dela). A turma é a
   * de `users.turma_id` — a mesma fonte do painel e das equipes.
   */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true, turmaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId: estudante.turmaId };
  }

  /**
   * Núcleo de toda mutação: funil, lock por (escola, estudante), o pacote e a
   * fase lidos UMA vez, o trabalho, e o estado relido. Dois toques rápidos
   * viram duas transações em fila. Os CHECKs do banco são a rede final.
   */
  private comSessao(
    escolaId: string,
    estudanteId: string,
    trabalho: (tx: Prisma.TransactionClient, pacote: PacoteDaTurma, sessao: LinhaDaSessao | null, fase: Fase | null) => Promise<void>,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp02em1b:${escolaId}:${estudanteId}`}, 0))`;
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const pacote = ctx.pacote;
      if (!pacote) throw erroDeJogo("campanha-em-preparo");
      await trabalho(tx, pacote, await this.sessaoDe(tx, escolaId, estudanteId, pacote), ctx.fase);
      return this.montarEstado(ctx, await this.sessaoDe(tx, escolaId, estudanteId, pacote));
    }, escolaId);
  }

  /** Escola do token E matrícula de professor na turma. **404, nunca 403**. `professorId` indefinido = gestor. */
  private async turmaVisivel(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true, nome: true, serie: true } });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) throw erroDeJogo("turma-nao-encontrada");
    return turma;
  }

  /** Lock por TURMA: dois professores (ou dois cliques) não intercalam homologação, fase e rodada. */
  private async travarTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp02em1b-turma:${escolaId}:${turmaId}`}, 0))`;
  }

  private async pacoteAprovadoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp02em1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId, aprovadoEm: { not: null } } })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  private async exigirPacoteAtivo(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    const pacote = await tx.exp02em1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, rodadaAtual: true } });
    if (!pacote) throw erroDeJogo("pacote-nao-aprovado");
    return pacote;
  }

  private voltarAoInicio(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    return tx.exp02em1bGateTurma.upsert({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      create: { escolaId, turmaId, fase: FASE_INICIAL },
      update: { fase: FASE_INICIAL },
    });
  }

  /** O pacote como o professor o vê. Linha com forma inesperada vira `null` (e um aviso no log). */
  private paraProfessor(linha: Exp02em1bPacote) {
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo || !(DISCIPLINAS as readonly string[]).includes(linha.disciplina)) {
      logger.warn({ codigo: "exp02em1b-pacote-invalido", escolaId: linha.escolaId, turmaId: linha.turmaId }, "pacote com forma inesperada");
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
    };
  }

  private exigirParaProfessor(linha: Exp02em1bPacote) {
    const pacote = this.paraProfessor(linha);
    if (!pacote) throw new Error("o pacote gravado não voltou legível");
    return pacote;
  }
}

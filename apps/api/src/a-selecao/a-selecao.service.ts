import { BadRequestException, Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma, type Exp07ef1bSessao } from "@prisma/client";
import { z } from "zod";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { computadoresDaMontagem, equipeDoEstudante, mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades, rotulosSemRepeticao, type EquipeDoMapa } from "../equipes/regras";
import { EvidenciasService, type ContextoDaAtividade } from "../evidencias/evidencias.service";
import { logger } from "../observabilidade/logger";
import { ehUuid } from "../motor/guardas";
import { PrismaService } from "../prisma/prisma.service";
import {
  ARROBAS_DA_FICCAO,
  COLEGAS_VIRTUAIS,
  COLEGAS_VIRTUAIS_IDS,
  ORDEM_DO_FEED,
  POSTS_PADRAO,
  autorDeReserva,
  ehIdDePost,
  type ColegaVirtual,
  type IdDePost,
  type PostDaCobertura,
} from "./catalogo";
import { ClassificacaoService, type EntradaDoCanalA } from "./classificacao.service";
import { PostDaCoberturaSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { FALAS_DO_TEMA_PADRAO, type FalasDoTema } from "./podcast";
import { matrizDaSelecao, matrizDoJson, mediaDaSala, percentuais, type Matriz } from "./regras/matriz";
import { parear, virtualMaisDistante, type VirtualDoMural } from "./regras/pareamento";
import {
  ETAPA_INICIAL,
  aguardandoOProfessor,
  etapaAntes,
  normalizarEtapa,
  normalizarPasso,
  passoAntes,
  passoEfetivo,
  pedirPasso,
  proximaEtapa,
  publicou,
  transicaoDoGate,
  type Etapa,
  type PassoPedido,
} from "./regras/passos";
import { emOrdemCanonica } from "./regras/lote";
import {
  LEGENDA_MAX,
  LEGENDA_MIN,
  REFLEXAO_MAX,
  REFLEXAO_MIN,
  TAMANHO_DA_SELECAO,
  codePoints,
  selecaoValida,
} from "./regras/sessao";
import { sanitizarLegenda } from "./sanitizador";

/**
 * Persistência e regras aplicadas da exp07ef1b.
 *
 * Molde: o `quem-mandou-isso.service.ts` da v1 da exp05ef1b (o funil, o lock,
 * o gate da turma; no histórico do git desde a ADR-114).
 * Assinaturas recebem `escolaId`/`estudanteId` explícitos, não o request: toda
 * query leva `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma (regra
 * inviolável nº 1, defesa em profundidade).
 *
 * **A atividade é a cobertura, a rodada é o "Zerar".** O gate da turma diz
 * qual (cobertura, rodada) está em andamento, e a sessão do estudante é a
 * DAQUELA dupla: zerar abre uma sessão nova e a antiga fica (ADR-112), tema
 * novo abre a rodada 1 de outra cobertura.
 *
 * **O gabarito não desce antes das fichas.** O post do estudante sai por
 * `postPublico`, uma allowlist; o enquadramento, as tags e a matriz só entram
 * no Mural, e só com `etapa ≥ fichas`.
 *
 * **Uma chamada de IA com a turma em sala — e ela não fala com a criança.** O
 * Canal A (`classificacao.service.ts`) gradua a legenda para a evidência
 * pedagógica DEPOIS do latch, fora da transação dele; falhando, não marca nada.
 */

/** O id que a guarda de liberação (ADR-69), o manifesto e a ficha compartilham. */
export const EXP_ID = "exp07ef1b";

/** O marcador de AÇÃO da EF07CO11 na ficha (`evidencias/fichas/exp07ef1b.ts`). */
export const MARCADOR_DA_LEGENDA = "legenda-publicada";

type PostPublico = {
  id: IdDePost;
  perfil: PostDaCobertura["perfil"];
  legenda: string;
  curtidas: number;
  comentarios: number;
  comentariosDestaque: Array<{ autor: string; mensagem: string }>;
  imagem: { url: string | null; alt: string };
  grafico: NonNullable<PostDaCobertura["grafico"]> | null;
};

interface CoberturaLida {
  id: string;
  tema: string;
  foco: string | null;
  origem: "padrao" | "ia";
  posts: PostDaCobertura[];
  midia: Record<string, string>;
  /** As três falas do podcast desta cobertura — as do sheet quando ela não tem as suas. */
  podcast: FalasDoTema;
}

interface GateLido {
  coberturaId: string;
  rodada: number;
  etapa: Etapa;
  atualizadoEm: Date;
}

type SessaoLida = Exp07ef1bSessao & { reflexao: { sessaoId: string } | null };

/** O que o funil do estudante devolve: tudo que as rotas dele leem. */
interface ContextoDoEstudante {
  turmaId: string;
  gate: GateLido;
  cobertura: CoberturaLida;
  sessao: SessaoLida;
}

/** O que a decisão entrega ao Canal A, lido na transação 1. */
interface ParaOCanalA {
  turmaId: string;
  coberturaId: string;
  rodada: number;
  entrada: EntradaDoCanalA;
}

const ListaDePostsSchema = z.array(PostDaCoberturaSchema).length(POSTS_PADRAO.length);

/**
 * Lê os 12 posts do `Json` da cobertura. A homologação validou na ESCRITA, mas
 * uma linha gravada por outro caminho chegaria aqui torta — e, diferente da
 * v1 da exp05ef1b (em que lote torto era turma em espera), aqui a aula tem de correr:
 * cai no banco curado, com um log que impede o "o feed mudou sozinho" de ser
 * mudo para quem diagnostica. Os ids e os blocos são os mesmos nos dois, então
 * matriz e pareamento continuam coerentes.
 */
/**
 * A cobertura gravada ANTES de o comentário ter autor (ADR-146) guarda só o
 * texto. Ela continua valendo: o comentário ganha o autor de reserva do post
 * e da posição, o mesmo a cada leitura.
 */
function comComentariosComAutor(bruto: Prisma.JsonValue): unknown {
  if (!Array.isArray(bruto)) return bruto;
  return bruto.map((post) => {
    if (post === null || typeof post !== "object" || Array.isArray(post)) return post;
    const { id, comentariosDestaque } = post as { id?: unknown; comentariosDestaque?: unknown };
    if (!Array.isArray(comentariosDestaque)) return post;
    return {
      ...post,
      comentariosDestaque: comentariosDestaque.map((c, i) =>
        typeof c === "string" ? { autor: autorDeReserva(typeof id === "string" ? id : "", i), mensagem: c } : c,
      ),
    };
  });
}

function postsDaLinha(bruto: Prisma.JsonValue, contexto: { escolaId: string; coberturaId: string }): PostDaCobertura[] {
  const lido = ListaDePostsSchema.safeParse(comComentariosComAutor(bruto));
  if (lido.success) return emOrdemCanonica(lido.data as PostDaCobertura[]);
  logger.warn(
    { codigo: "exp07ef1b-cobertura-invalida", ...contexto },
    "cobertura com forma inesperada; a turma segue com o banco curado",
  );
  return POSTS_PADRAO.map((p) => ({ ...p }));
}

/** As URLs de imagem da cobertura, só com chave de post conhecida e valor texto. */
function midiaDaLinha(bruto: Prisma.JsonValue): Record<string, string> {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const midia: Record<string, string> = {};
  for (const [id, url] of Object.entries(bruto)) {
    if (ehIdDePost(id) && typeof url === "string" && url.length > 0) midia[id] = url;
  }
  return midia;
}

const FalasDaLinhaSchema = z.object({
  institucional: z.string().min(1),
  comunitario: z.string().min(1),
  estatistico: z.string().min(1),
});

/**
 * As três falas do podcast da linha. NULO é a leitura das do sheet (a Praça
 * Central): é o que vale para a cobertura curada que nasceu sozinha e para as
 * que existiam antes da coluna. Um JSON torto cai no sheet com log, pelo mesmo
 * motivo de `postsDaLinha` — o podcast não pode deixar de existir por isso.
 */
function podcastDaLinha(bruto: Prisma.JsonValue | null, contexto: { escolaId: string; coberturaId: string }): FalasDoTema {
  if (bruto === null) return { ...FALAS_DO_TEMA_PADRAO };
  const lido = FalasDaLinhaSchema.safeParse(bruto);
  if (lido.success) return lido.data;
  logger.warn(
    { codigo: "exp07ef1b-podcast-invalido", ...contexto },
    "falas do podcast com forma inesperada; o áudio segue com as do sheet",
  );
  return { ...FALAS_DO_TEMA_PADRAO };
}

/** O que `coberturaDaLinha` precisa da linha — o `select` de toda leitura de cobertura. */
const CAMPOS_DA_COBERTURA = {
  id: true,
  escolaId: true,
  tema: true,
  foco: true,
  origem: true,
  posts: true,
  midia: true,
  podcast: true,
} satisfies Prisma.Exp07ef1bCoberturaSelect;

function coberturaDaLinha(linha: {
  id: string;
  escolaId: string;
  tema: string;
  foco: string | null;
  origem: string;
  posts: Prisma.JsonValue;
  midia: Prisma.JsonValue;
  podcast: Prisma.JsonValue | null;
}): CoberturaLida {
  return {
    id: linha.id,
    tema: linha.tema,
    foco: linha.foco,
    origem: linha.origem === "ia" ? "ia" : "padrao",
    posts: postsDaLinha(linha.posts, { escolaId: linha.escolaId, coberturaId: linha.id }),
    midia: midiaDaLinha(linha.midia),
    podcast: podcastDaLinha(linha.podcast, { escolaId: linha.escolaId, coberturaId: linha.id }),
  };
}

/**
 * O post como o ESTUDANTE o recebe — ALLOWLIST. Campo novo no catálogo nasce
 * fora daqui até alguém decidir o contrário: é o que faz o gabarito não caber
 * na resposta, em vez de "lembrar de apagar".
 */
export function postPublico(p: PostDaCobertura, midia: Record<string, string>): PostPublico {
  return {
    id: p.id,
    perfil: p.perfil,
    legenda: p.legenda,
    curtidas: p.curtidas,
    comentarios: p.comentarios,
    comentariosDestaque: p.comentariosDestaque.map((c) => ({ autor: c.autor, mensagem: c.mensagem })),
    imagem: { url: midia[p.id] ?? null, alt: p.descricaoImagem },
    grafico: p.grafico
      ? {
          tipo: p.grafico.tipo,
          titulo: p.grafico.titulo,
          unidade: p.grafico.unidade,
          series: p.grafico.series.map((s) => ({ rotulo: s.rotulo, valor: s.valor })),
          ...(p.grafico.destaque ? { destaque: p.grafico.destaque } : {}),
        }
      : null,
  };
}

/** Os posts de imagem gerada — os de gráfico a experiência desenha. */
export function postsQuePedemImagem(posts: readonly PostDaCobertura[]): PostDaCobertura[] {
  return posts.filter((p) => !p.grafico);
}

/** As URLs das imagens prontas, só dos posts que pedem imagem — o que o card de cada post mostra. */
function imagensProntas(cobertura: CoberturaLida): Record<string, string> {
  const prontas: Record<string, string> = {};
  for (const p of postsQuePedemImagem(cobertura.posts)) {
    const url = cobertura.midia[p.id];
    if (url) prontas[p.id] = url;
  }
  return prontas;
}

function resumoDaMidia(cobertura: CoberturaLida): { total: number; prontas: number } {
  const pedem = postsQuePedemImagem(cobertura.posts);
  return { total: pedem.length, prontas: pedem.filter((p) => cobertura.midia[p.id]).length };
}

function selecaoDaLinha(s: { selecao: string[] }): IdDePost[] | null {
  const ids = s.selecao.filter(ehIdDePost);
  return ids.length === TAMANHO_DA_SELECAO ? ids : null;
}

/** A matriz de cada colega virtual, sobre a cobertura em andamento. */
function virtuaisDa(cobertura: CoberturaLida): VirtualDoMural[] {
  const lenteDe = lenteDaCobertura(cobertura);
  return COLEGAS_VIRTUAIS_IDS.map((id) => ({
    id,
    matriz: matrizDaSelecao(COLEGAS_VIRTUAIS[id].selecao, lenteDe),
  }));
}

function lenteDaCobertura(cobertura: CoberturaLida) {
  const porId = new Map(cobertura.posts.map((p) => [p.id as string, p.enquadramento]));
  return (id: string) => porId.get(id);
}

/**
 * O peso de uma linha na escolha do REPRESENTANTE do computador: quem publicou
 * vem antes de quem só entrou, e entre iguais o mais recente. Sem a primeira
 * regra, o colega que abriu a missão no mesmo computador DEPOIS da publicação
 * viraria o representante, e o painel diria que aquela tela não publicou.
 */
function pesoDaLinha(publicadaEm: Date | null, atualizadaEm: Date | null): number {
  const recencia = (publicadaEm ?? atualizadaEm)?.getTime() ?? 0;
  return (publicadaEm ? 1e13 : 0) + recencia;
}

@Injectable()
export class ASelecaoService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly classificacao: ClassificacaoService,
  ) {}

  /**
   * O contexto da evidência pedagógica: o resolvedor que diz, para um
   * estudante, a atividade e a rodada em andamento — é por ele que a enquete
   * da DM (`/evidencias/exp07ef1b/perguntas/:id/resposta`) cai na rodada certa,
   * sem o cliente dizer qual. No teste, quem chama isto é a suíte.
   */
  onModuleInit(): void {
    this.evidencias.registrarContexto(EXP_ID, (tx, escolaId, estudanteId) =>
      this.contextoDaAtividade(tx, escolaId, estudanteId),
    );
  }

  /**
   * A atividade em andamento para as ENQUETES — ou `null`.
   *
   * A turma sai da sessão MAIS RECENTE do estudante, porque o resolvedor não
   * recebe o token. E `null` em dois casos, os dois de propósito:
   *   - o passo está antes de `enquetes`: a enquete vem DEPOIS da reflexão (a
   *     ordem do PO — perguntar antes sugeriria a resposta escrita), e uma
   *     resposta mandada por fora da tela não pode furar a fila;
   *   - a sessão não é da (cobertura, rodada) que o gate diz: a professora
   *     zerou ou trocou o tema, e uma resposta atrasada cairia numa rodada que
   *     já acabou — e enganaria o recálculo das equipes (ADR-112).
   */
  async contextoDaAtividade(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<ContextoDaAtividade | null> {
    const sessao = await tx.exp07ef1bSessao.findFirst({
      where: { escolaId, estudanteId },
      orderBy: { criadaEm: "desc" },
      select: { turmaId: true, coberturaId: true, rodada: true, passo: true },
    });
    if (!sessao || passoAntes(normalizarPasso(sessao.passo), "enquetes")) return null;
    const gate = await tx.exp07ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId: sessao.turmaId } },
      select: { coberturaId: true, rodada: true },
    });
    if (!gate || gate.coberturaId !== sessao.coberturaId || gate.rodada !== sessao.rodada) return null;
    return { turmaId: sessao.turmaId, atividadeId: sessao.coberturaId, rodada: sessao.rodada };
  }

  // ───────────────────────────────────────────────────── rotas do estudante

  /**
   * Boot da experiência e o F5. Sem atividade em andamento na turma, 403
   * `atividade-nao-preparada` — a experiência mostra a porta fechada; na
   * primeira entrada do estudante na rodada, nasce a sessão. Os posts saem na
   * ORDEM DO FEED e sem gabarito.
   */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const porId = new Map(ctx.cobertura.posts.map((p) => [p.id, p]));
      const posts = ORDEM_DO_FEED.map((id) => porId.get(id)).filter((p): p is PostDaCobertura => Boolean(p));
      return {
        ...this.estado(ctx.sessao, ctx.gate),
        cobertura: {
          tema: ctx.cobertura.tema,
          posts: posts.map((p) => postPublico(p, ctx.cobertura.midia)),
        },
        limites: {
          selecao: TAMANHO_DA_SELECAO,
          legendaMin: LEGENDA_MIN,
          legendaMax: LEGENDA_MAX,
          reflexaoMin: REFLEXAO_MIN,
          reflexaoMax: REFLEXAO_MAX,
        },
      };
    }, escolaId);
  }

  /**
   * O polling do gate (~5 s, ADR-93) — MAGRO de propósito: sem posts, sem
   * contagem da sala, sem JOIN. Cada leitura é por chave: `users` (a porta),
   * `liberacoes`, o gate e a sessão desta rodada.
   *
   * **Passa pelo funil de liberação** (regras 7 e 8), como na exp05ef1b: sem
   * isso, um estudante de turma sem a missão liberada descobria a etapa dela.
   * E NÃO escreve: a sessão e a cobertura nascem no `GET sessao`, que é sempre
   * a primeira chamada da tela. Sem gate ainda, a resposta é a etapa inicial.
   *
   * `rodada` e `coberturaId` vão junto para a tela notar o "Zerar" e o tema
   * novo — e recarregar a sessão — sem ninguém avisar.
   */
  async gate(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      if (!turmaId) throw erroDeJogo("sem-turma");
      const gate = await tx.exp07ef1bGateTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        select: { coberturaId: true, rodada: true, etapa: true },
      });
      const etapa = normalizarEtapa(gate?.etapa ?? ETAPA_INICIAL);
      const sessao = gate
        ? await tx.exp07ef1bSessao.findUnique({
            where: {
              escolaId_turmaId_estudanteId_coberturaId_rodada: {
                escolaId,
                turmaId,
                estudanteId,
                coberturaId: gate.coberturaId,
                rodada: gate.rodada,
              },
            },
            select: { passo: true },
          })
        : null;
      const passo = normalizarPasso(sessao?.passo);
      return {
        etapa,
        rodada: gate?.rodada ?? null,
        coberturaId: gate?.coberturaId ?? null,
        passoEfetivo: passoEfetivo(passo, etapa),
        aguardandoOProfessor: aguardandoOProfessor(passo, etapa),
        // O instante é do SERVIDOR: o relógio da máquina da escola atrasa.
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  /** Os passos que a própria criança pede: feed, salvos e reflexão. */
  async pedirPasso(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    pedido: { para: PassoPedido; tempoFeedS?: number },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      const r = pedirPasso(atual, ctx.gate.etapa, pedido.para);
      if (!r.ok) throw erroDeJogo(r.codigo);

      /* O tempo de feed só vale ANTES do latch: depois dele a tela não está
         mais no feed, e um número tardio sobrescreveria o que ela mediu. */
      const tempo = pedido.tempoFeedS !== undefined && !publicou(atual) ? pedido.tempoFeedS : undefined;
      if (r.passo === atual && tempo === undefined) return this.estado(ctx.sessao, ctx.gate);
      const sessao = await tx.exp07ef1bSessao.update({
        where: { id: ctx.sessao.id },
        data: { passo: r.passo, ...(tempo !== undefined ? { tempoFeedS: tempo } : {}) },
        include: { reflexao: { select: { sessaoId: true } } },
      });
      return this.estado(sessao, ctx.gate);
    }, escolaId);
  }

  /**
   * "Confirmar publicação" — O LATCH, e depois o Canal A.
   *
   * Transação 1: o sanitizador, a tríade conferida contra a cobertura, a
   * matriz calculada AQUI (servidor calcula, nunca aceita), o carimbo e o passo
   * no MESMO update (o CHECK do latch vale por statement) e, se o Mural já está
   * aberto, o par de quem chegou depois.
   *
   * O latch é CONCORRENTE: dois toques em "Confirmar" chegam como duas
   * requisições, e o lock por estudante as põe em fila — a segunda relê a
   * sessão já publicada e responde 409 `latch-ja-confirmado`. O `WHERE
   * publicada_em IS NULL` do update é a segunda tranca, e o CHECK, a terceira.
   *
   * Depois do commit, fora da transação: o Canal A. Ele pode levar seis
   * segundos (o teto), e segurar a transação — e o lock da turma — esse tempo
   * pararia a abertura do Mural para a sala inteira.
   */
  async decidir(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    decisao: { selecao: string[]; legenda: string },
  ) {
    const limpa = sanitizarLegenda(decisao.legenda, ARROBAS_DA_FICCAO);
    if (!limpa.ok) throw erroDeJogo(limpa.codigo);

    const { estado, paraOCanalA } = await this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (publicou(normalizarPasso(ctx.sessao.passo)) || ctx.sessao.publicadaEm) {
        throw erroDeJogo("latch-ja-confirmado");
      }
      /* O lock COMPARTILHADO da turma, depois do do estudante: a abertura do
         Mural pega o EXCLUSIVO para parear a sala, e uma publicação em voo não
         pode ficar de fora do pareamento — nem ser pareada com a etapa velha.
         O gate é relido DEPOIS do lock, e é a leitura que vale. */
      await this.travarTurma(tx, escolaId, ctx.turmaId, "compartilhado");
      const gate = await this.lerGate(tx, escolaId, ctx.turmaId);
      if (!gate || gate.coberturaId !== ctx.sessao.coberturaId || gate.rodada !== ctx.sessao.rodada) {
        throw erroDeJogo("rodada-mudou");
      }

      const ids = new Set<string>(ctx.cobertura.posts.map((p) => p.id));
      if (!selecaoValida(decisao.selecao, ids)) throw erroDeJogo("selecao-invalida");
      const matriz = matrizDaSelecao(decisao.selecao, lenteDaCobertura(ctx.cobertura));

      const par = etapaAntes(ETAPA_INICIAL, gate.etapa)
        ? await this.parDeQuemChegaDepois(tx, escolaId, ctx, matriz)
        : {};

      const publicadaEm = new Date();
      const { count } = await tx.exp07ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, publicadaEm: null },
        data: {
          selecao: decisao.selecao,
          legenda: decisao.legenda,
          matriz: matriz as unknown as Prisma.InputJsonValue,
          publicadaEm,
          passo: "publicado",
          ...par,
        },
      });
      if (count === 0) throw erroDeJogo("latch-ja-confirmado");

      const sessao = await tx.exp07ef1bSessao.findUniqueOrThrow({
        where: { id: ctx.sessao.id },
        include: { reflexao: { select: { sessaoId: true } } },
      });
      const porId = new Map(ctx.cobertura.posts.map((p) => [p.id as string, p]));
      return {
        estado: this.estado(sessao, gate),
        paraOCanalA: {
          turmaId: ctx.turmaId,
          coberturaId: gate.coberturaId,
          rodada: gate.rodada,
          entrada: {
            legenda: decisao.legenda,
            posts: decisao.selecao
              .map((id) => porId.get(id))
              .filter((p): p is PostDaCobertura => Boolean(p))
              .map((p) => ({ perfil: p.perfil, legenda: p.legenda })),
          },
        } satisfies ParaOCanalA,
      };
    }, escolaId);

    await this.classificarEMarcar(escolaId, estudanteId, paraOCanalA);
    return estado;
  }

  /**
   * O Mural: a tríade do estudante e a do par, lado a lado.
   *
   * Antes das fichas é a Fase 1 do PRD, "o espelho rachado": imagem e legenda,
   * nada mais — `fichas` e `equilibrio` são `null`, e o dado NÃO desceu (não é
   * "a tela não mostra"). Com `etapa ≥ fichas`, cada post ganha a fonte, o
   * ângulo e a lente, e cada tríade o equilíbrio editorial.
   *
   * O par é o que o pareamento CONGELOU na sessão. A falta dele (não deveria
   * haver: o pareamento da sala e o de quem chega depois cobrem todo mundo) cai
   * no colega virtual calculado na hora, sem gravar — um GET não escreve.
   */
  async mural(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const minhaSelecao = selecaoDaLinha(ctx.sessao);
      if (!ctx.sessao.publicadaEm || !minhaSelecao || ctx.sessao.legenda === null) {
        throw erroDeJogo("stories-nao-publicados");
      }
      if (ctx.gate.etapa === ETAPA_INICIAL) throw erroDeJogo("mural-nao-liberado");

      const fichas = !etapaAntes(ctx.gate.etapa, "fichas");
      const cobertura = ctx.cobertura;
      const minhaMatriz =
        matrizDoJson(ctx.sessao.matriz) ?? matrizDaSelecao(minhaSelecao, lenteDaCobertura(cobertura));

      let par: { selecao: readonly string[]; legenda: string; rotulo: string; virtual: boolean } | null = null;
      if (ctx.sessao.parSessaoId) {
        const outra = await tx.exp07ef1bSessao.findFirst({
          where: { id: ctx.sessao.parSessaoId, escolaId },
          select: { selecao: true, legenda: true },
        });
        const selecao = outra ? selecaoDaLinha(outra) : null;
        if (outra && selecao && outra.legenda !== null) {
          par = { selecao, legenda: outra.legenda, rotulo: ctx.sessao.parRotulo ?? "", virtual: false };
        }
      }
      if (!par) {
        const id: ColegaVirtual = ehColegaVirtual(ctx.sessao.parVirtual)
          ? ctx.sessao.parVirtual
          : virtualMaisDistante(minhaMatriz, virtuaisDa(cobertura));
        const colega = COLEGAS_VIRTUAIS[id];
        par = { selecao: colega.selecao, legenda: colega.legenda, rotulo: colega.nome, virtual: true };
      }

      return {
        etapa: ctx.gate.etapa,
        fichasReveladas: fichas,
        minha: this.triade(cobertura, minhaSelecao, ctx.sessao.legenda, fichas),
        par: { ...this.triade(cobertura, par.selecao, par.legenda, fichas), rotulo: par.rotulo, virtual: par.virtual },
      };
    }, escolaId);
  }

  /**
   * A reflexão da Etapa 6 — LATCH, e leva a sessão às enquetes.
   *
   * Caixa livre de menor: não vai a log, não vai à telemetria, e só o professor
   * da turma a lê (o recorte da ADR-108 no painel). A contagem gravada em
   * `chars` é a de CODE POINTS, a mesma do Zod e do CHECK.
   */
  async refletir(escolaId: string, estudanteId: string, turmaId: string | null, texto: string) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (!publicou(atual)) throw erroDeJogo("stories-nao-publicados");
      if (ctx.sessao.reflexao || !passoAntes(atual, "enquetes")) throw erroDeJogo("reflexao-ja-enviada");
      if (ctx.gate.etapa !== "explicacao") throw erroDeJogo("reflexao-nao-liberada");

      await tx.exp07ef1bReflexao.create({
        data: { sessaoId: ctx.sessao.id, escolaId, texto, chars: codePoints(texto) },
      });
      const sessao = await tx.exp07ef1bSessao.update({
        where: { id: ctx.sessao.id },
        data: { passo: "enquetes" },
        include: { reflexao: { select: { sessaoId: true } } },
      });
      return this.estado(sessao, ctx.gate);
    }, escolaId);
  }

  /**
   * "Missão concluída!" — idempotente. As enquetes são opcionais para concluir
   * (a enquete que falha pula para o fim, decisão da experiência); a reflexão,
   * não.
   */
  async concluir(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (atual === "fim") return this.estado(ctx.sessao, ctx.gate);
      if (atual !== "enquetes") throw erroDeJogo("reflexao-pendente");
      /* Passo e carimbo no mesmo update: o CHECK `fim ⇔ concluida_em` vale por
         statement. */
      const sessao = await tx.exp07ef1bSessao.update({
        where: { id: ctx.sessao.id },
        data: { passo: "fim", concluidaEm: new Date() },
        include: { reflexao: { select: { sessaoId: true } } },
      });
      return this.estado(sessao, ctx.gate);
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────── visão do professor

  /** `professorId` presente = só as turmas dele (ver `ondeAsTurmasSaoVisiveis`). */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, serie: t.serie, estudantes: t._count.estudantes })),
      };
    }, escolaId);
  }

  /**
   * O painel da aula — POR COMPUTADOR, como o UnooTube.
   *
   * Parte de `users.turma_id` (quem não entrou também aparece; `users` está
   * fora da RLS, e o `escolaId` no `where` é a tranca). As linhas passam por
   * `colapsarEmUnidades` sobre o `mapaDeEquipes` lido DENTRO do `comTenancy`:
   * fora dele a RLS das equipes devolve vazio, em silêncio, e o painel voltaria
   * a contar por criança.
   *
   * "X de Y computadores publicaram": o Y vem da MONTAGEM
   * (`computadoresDaMontagem`) quando há uma, porque o colapso conta também os
   * ausentes — cada criança que faltou vira uma "unidade" sozinha.
   *
   * O recorte da ADR-108: `legenda` e `reflexaoTexto` só vêm preenchidos para
   * quem LECIONA a turma. `professorLeciona` responde `true` a `undefined`
   * (gestor vê a escola), e por isso a decisão é por `professorId`, não pelo
   * `@Roles` — a armadilha que a exp05ef1b registrou.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const { gate, cobertura } = await this.exigirGate(tx, escolaId, turmaId);

      const [estudantes, mapa, computadores] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: {
            id: true,
            displayName: true,
            username: true,
            selecaoSessoes: {
              where: { escolaId, turmaId, coberturaId: gate.coberturaId, rodada: gate.rodada },
              take: 1,
              include: { reflexao: { select: { texto: true } } },
            },
          },
          orderBy: { displayName: "asc" },
        }),
        /* A equipe é da ATIVIDADE (ADR-130): a desta cobertura. */
        mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, gate.coberturaId),
        computadoresDaMontagem(tx, escolaId, turmaId, EXP_ID, gate.coberturaId),
      ]);

      const linhas = estudantes.map((e) => {
        const s = e.selecaoSessoes[0];
        const passo = normalizarPasso(s?.passo);
        const publicada = Boolean(s?.publicadaEm);
        const texto = s?.reflexao?.texto ?? null;
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          iniciou: Boolean(s),
          /* O passo EFETIVO, o mesmo da tela da criança — a coluna gravada diz
             `publicado` para quem já está olhando o Mural. */
          passo: passoEfetivo(passo, gate.etapa),
          publicou: publicada,
          publicadaEm: s?.publicadaEm?.toISOString() ?? null,
          selecao: s && publicada ? selecaoDaLinha(s) : null,
          matriz: s && publicada ? matrizDoJson(s.matriz) : null,
          /* Texto livre de menor — só para quem dá aula (ADR-108). */
          legenda: professorId ? (s?.legenda ?? null) : null,
          par: s?.parRotulo ? { rotulo: s.parRotulo, virtual: s.parVirtual !== null } : null,
          tempoFeedS: s?.tempoFeedS ?? null,
          entregouReflexao: texto !== null,
          reflexaoTexto: professorId ? texto : null,
          concluiu: Boolean(s?.concluidaEm),
          _peso: pesoDaLinha(s?.publicadaEm ?? null, s?.atualizadaEm ?? null),
        };
      });

      const unidades = colapsarEmUnidades(
        linhas,
        (l) => l.estudanteId,
        mapa,
        (l) => l.iniciou,
        (l) => l._peso,
      ).map(({ linha, equipe }) => {
        const { _peso: _descartado, ...resto } = linha;
        return { ...resto, equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null };
      });

      const publicaram = unidades.filter((u) => u.publicou);
      return {
        turma,
        cobertura: {
          id: cobertura.id,
          tema: cobertura.tema,
          foco: cobertura.foco,
          origem: cobertura.origem,
          midia: resumoDaMidia(cobertura),
        },
        rodada: gate.rodada,
        etapa: gate.etapa,
        proximaEtapa: proximaEtapa(gate.etapa),
        linhas: unidades,
        resumo: {
          total: unidades.length,
          iniciaram: unidades.filter((u) => u.iniciou).length,
          publicaram: publicaram.length,
          entregaram: unidades.filter((u) => u.entregouReflexao).length,
          concluiram: unidades.filter((u) => u.concluiu).length,
          computadores: { publicaram: publicaram.length, total: computadores ?? unidades.length },
          porComputador: mapa.size > 0,
          distribuicaoMedia: mediaDaSala(publicaram.map((u) => u.matriz).filter((m): m is Matriz => m !== null)),
        },
      };
    }, escolaId);
  }

  /**
   * O botão único do painel: a etapa de DESTINO.
   *
   * Idempotente (o segundo clique não pareia de novo), uma etapa por vez, sem
   * pular nem voltar — `regras/passos.ts#transicaoDoGate`, 409 com código
   * estável quando o destino não serve.
   *
   * Abrir o MURAL é o momento do pareamento: na MESMA transação, com o lock
   * EXCLUSIVO da turma, que espera as publicações em voo terminarem (elas têm o
   * compartilhado). Quem publicar depois disso é pareado na própria decisão.
   */
  async mudarEtapa(escolaId: string, turmaId: string, professorId: string | undefined, para: Etapa) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate, cobertura } = await this.exigirGate(tx, escolaId, turmaId);

      const r = transicaoDoGate(gate.etapa, para);
      if (!r.ok) throw erroDeJogo(r.codigo, { etapaAtual: gate.etapa, proximaEtapa: proximaEtapa(gate.etapa) });

      let pareadas = 0;
      let atualizadoEm = gate.atualizadoEm;
      if (r.mudou) {
        if (para === "mural") pareadas = await this.parearSala(tx, escolaId, turmaId, gate, cobertura);
        const linha = await tx.exp07ef1bGateTurma.update({
          where: { escolaId_turmaId: { escolaId, turmaId } },
          data: { etapa: para },
          select: { atualizadoEm: true },
        });
        atualizadoEm = linha.atualizadoEm;
      }
      return {
        turma,
        coberturaId: gate.coberturaId,
        rodada: gate.rodada,
        etapa: para,
        proximaEtapa: proximaEtapa(para),
        pareadas,
        atualizadoEm: atualizadoEm.toISOString(),
      };
    }, escolaId);
  }

  /**
   * "Zerar a turma" — a segunda aplicação, SEM apagar nada.
   *
   * Sobe a rodada e volta a etapa para a exploração. As sessões da rodada
   * anterior ficam, com as tríades, os pares e as reflexões: é a rodada passada
   * que o painel de habilidades mostra (ADR-112), e o "zerar" que apagava — o
   * da v1 da exp05ef1b — é exatamente o que a evidência não pode ter. A cobertura
   * também fica: o preparo custou tempo da professora.
   */
  async zerar(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirGate(tx, escolaId, turmaId);
      const linha = await tx.exp07ef1bGateTurma.update({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        data: { rodada: gate.rodada + 1, etapa: ETAPA_INICIAL },
        select: { coberturaId: true, rodada: true, etapa: true },
      });
      return { coberturaId: linha.coberturaId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa) };
    }, escolaId);
  }

  /**
   * As ATIVIDADES da turma (ADR-130): a em andamento inteira, com o gabarito, e
   * a lista de todas — que é a lista de atividades da ficha e o seletor
   * `?cobertura=` do painel de habilidades. `ativa` é `null` quando o professor
   * ainda não pôs nenhuma em andamento: a plataforma não cria atividade.
   */
  async coberturas(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const emAndamento = await tx.exp07ef1bGateTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        include: { cobertura: { select: CAMPOS_DA_COBERTURA } },
      });
      const gate = emAndamento ? { rodada: emAndamento.rodada, etapa: normalizarEtapa(emAndamento.etapa) } : null;
      const cobertura = emAndamento ? coberturaDaLinha(emAndamento.cobertura) : null;
      const [todas, rodadas] = await Promise.all([
        tx.exp07ef1bCobertura.findMany({
          where: { escolaId, turmaId },
          select: { id: true, tema: true, foco: true, origem: true, ativa: true, criadaEm: true, imagensAprovadasEm: true },
          orderBy: { criadaEm: "desc" },
        }),
        tx.exp07ef1bSessao.groupBy({
          by: ["coberturaId"],
          where: { escolaId, turmaId },
          _max: { rodada: true },
        }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.coberturaId, r._max.rodada ?? 0]));
      return {
        ativa:
          cobertura && gate
            ? {
                id: cobertura.id,
                tema: cobertura.tema,
                foco: cobertura.foco,
                origem: cobertura.origem,
                rodada: gate.rodada,
                etapa: gate.etapa,
                posts: cobertura.posts,
                midia: resumoDaMidia(cobertura),
                podcast: cobertura.podcast,
              }
            : null,
        historico: todas.map((c) => ({
          id: c.id,
          tema: c.tema,
          foco: c.foco,
          origem: c.origem === "ia" ? ("ia" as const) : ("padrao" as const),
          ativa: c.ativa,
          criadaEm: c.criadaEm.toISOString(),
          rodadas: maiorRodada.get(c.id) ?? 0,
          imagensAprovadas: c.imagensAprovadasEm !== null,
        })),
      };
    }, escolaId);
  }

  /**
   * UMA atividade, inteira e com o gabarito — a página dela, esteja ou não em
   * andamento. É de onde a professora prepara as imagens e o podcast de uma
   * atividade PRONTA antes de pô-la no ar.
   */
  async cobertura(escolaId: string, turmaId: string, professorId: string | undefined, coberturaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.coberturaDaTurma(tx, escolaId, turmaId, coberturaId);
      const [gate, rodadas] = await Promise.all([
        this.lerGate(tx, escolaId, turmaId),
        tx.exp07ef1bSessao.aggregate({ where: { escolaId, turmaId, coberturaId }, _max: { rodada: true } }),
      ]);
      const cobertura = coberturaDaLinha(linha);
      const emAndamento = gate?.coberturaId === coberturaId;
      return {
        id: cobertura.id,
        tema: cobertura.tema,
        foco: cobertura.foco,
        origem: cobertura.origem,
        ativa: emAndamento,
        rodada: emAndamento && gate ? gate.rodada : null,
        etapa: emAndamento && gate ? gate.etapa : null,
        criadaEm: linha.criadaEm.toISOString(),
        rodadas: rodadas._max.rodada ?? 0,
        posts: cobertura.posts,
        midia: resumoDaMidia(cobertura),
        imagens: imagensProntas(cobertura),
        imagensAprovadasEm: linha.imagensAprovadasEm?.toISOString() ?? null,
        podcast: cobertura.podcast,
      };
    }, escolaId);
  }

  /**
   * A SEGUNDA FASE da aprovação (ADR-146): o professor viu as imagens no card
   * de cada post, regerou a que não servia, e aprova. Só depois disto a
   * atividade vai ao ar (`colocarEmAndamento` cobra).
   *
   * Sem exigir imagem pronta em todo post: a geração pode falhar ou a quota
   * acabar, e o post segue com o card da descrição — que o professor VIU no
   * mesmo card antes de aprovar. Quem segura o botão até a geração terminar é
   * a tela. Idempotente: a segunda aprovação devolve o carimbo da primeira.
   */
  async aprovarImagens(escolaId: string, turmaId: string, professorId: string | undefined, coberturaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.coberturaDaTurma(tx, escolaId, turmaId, coberturaId);
      const carimbo =
        linha.imagensAprovadasEm ??
        (
          await tx.exp07ef1bCobertura.update({
            where: { id: linha.id },
            data: { imagensAprovadasEm: new Date() },
            select: { imagensAprovadasEm: true },
          })
        ).imagensAprovadasEm;
      return { coberturaId: linha.id, imagensAprovadasEm: (carimbo ?? new Date()).toISOString() };
    }, escolaId);
  }

  /**
   * A cobertura cuja imagem o professor quer REGERAR (ADR-146): só enquanto as
   * imagens estão em validação. Depois de aprovadas elas não mudam — a turma
   * pode estar olhando para elas.
   */
  async coberturaEmValidacao(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    coberturaId: string,
  ): Promise<CoberturaLida> {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.coberturaDaTurma(tx, escolaId, turmaId, coberturaId);
      if (linha.imagensAprovadasEm) throw erroDeJogo("imagens-ja-aprovadas");
      return coberturaDaLinha(linha);
    }, escolaId);
  }

  /**
   * "USAR ESTA ATIVIDADE AGORA" (ADR-130): a professora escolhe, na lista, qual
   * atividade a turma faz. A que estava em andamento volta a ser PRONTA — fica,
   * com as sessões e as rodadas —, e o gate passa a apontar a escolhida.
   *
   * A RODADA: a atividade que nunca rodou começa na 1; a que já rodou abre a
   * SEGUINTE à última. Retomar a mesma rodada exigiria lembrar a etapa de cada
   * atividade — o gate é um só por turma —, e voltar uma rodada à exploração
   * depois do Mural é o "voltar" que o botão único proíbe. Nada se perde: as
   * rodadas anteriores continuam no painel de habilidades (ADR-112).
   *
   * Idempotente: pôr no ar a que já está no ar não muda nada (o segundo clique).
   * O lock exclusivo da turma põe duas trocas simultâneas em fila.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string | undefined, coberturaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const escolhida = await this.coberturaDaTurma(tx, escolaId, turmaId, coberturaId);
      /* As duas fases da aprovação passaram (ADR-146)? Sem a das imagens, a
         turma abriria com imagem que ninguém viu. */
      if (!escolhida.imagensAprovadasEm) throw erroDeJogo("imagens-nao-aprovadas");

      const atual = await this.lerGate(tx, escolaId, turmaId);
      if (atual?.coberturaId === coberturaId) {
        return { coberturaId, rodada: atual.rodada, etapa: atual.etapa, mudou: false };
      }

      const ultima = await tx.exp07ef1bSessao.aggregate({
        where: { escolaId, turmaId, coberturaId },
        _max: { rodada: true },
      });
      const rodada = (ultima._max.rodada ?? 0) + 1;
      await tx.exp07ef1bCobertura.updateMany({ where: { escolaId, turmaId, ativa: true }, data: { ativa: false } });
      await tx.exp07ef1bCobertura.update({ where: { id: coberturaId }, data: { ativa: true } });
      await tx.exp07ef1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, coberturaId, rodada, etapa: ETAPA_INICIAL },
        update: { coberturaId, rodada, etapa: ETAPA_INICIAL },
      });
      return { coberturaId, rodada, etapa: ETAPA_INICIAL, mudou: true };
    }, escolaId);
  }

  /**
   * "Criar atividade" — a curadoria humana (ADR-66/67).
   *
   * É a PRIMEIRA fase da aprovação (ADR-146): os textos. A cobertura nasce
   * com `imagensAprovadasEm` nulo — as imagens se geram em seguida, no card de
   * cada post, e só a segunda fase (`aprovarImagens`) a deixa ir ao ar.
   *
   * Tema novo é ATIVIDADE nova, e ela nasce PRONTA, não no ar (ADR-130): quem
   * escolhe o que a turma faz é a professora, na lista de atividades
   * (`colocarEmAndamento`). A que estiver em andamento continua em andamento —
   * criar a próxima aula não pode tirar do ar a de agora.
   *
   * As imagens de post com a MESMA descrição de uma cobertura anterior da turma
   * são herdadas: o arquivo no bucket é o hash da descrição, então ele já
   * existe, e obrigar a professora a "gerar" de novo a imagem que está na tela
   * seria pedir um clique que não produz nada.
   */
  async homologar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    aprovadaPor: string,
    lote: { tema: string; foco?: string; origem: "padrao" | "ia"; posts: PostDaCobertura[]; podcast: FalasDoTema },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");

      /* A herança olha as coberturas RECENTES da turma, não só a em andamento:
         a professora que prepara três atividades seguidas sobre o mesmo tema
         não paga as mesmas imagens três vezes. */
      const anteriores = await tx.exp07ef1bCobertura.findMany({
        where: { escolaId, turmaId },
        orderBy: { criadaEm: "desc" },
        take: 5,
        select: CAMPOS_DA_COBERTURA,
      });
      const urlDaDescricao = new Map<string, string>();
      for (const velha of anteriores.map(coberturaDaLinha).reverse()) {
        for (const p of velha.posts) {
          const url = velha.midia[p.id];
          if (url) urlDaDescricao.set(p.descricaoImagem, url);
        }
      }
      const herdada: Record<string, string> = {};
      for (const p of lote.posts) {
        const url = urlDaDescricao.get(p.descricaoImagem);
        if (url && !p.grafico) herdada[p.id] = url;
      }

      const posts = emOrdemCanonica(lote.posts);
      const nova = await tx.exp07ef1bCobertura.create({
        data: {
          escolaId,
          turmaId,
          tema: lote.tema,
          foco: lote.foco?.trim() || null,
          origem: lote.origem,
          posts: posts as unknown as Prisma.InputJsonValue,
          midia: herdada,
          podcast: {
            institucional: lote.podcast.institucional.trim(),
            comunitario: lote.podcast.comunitario.trim(),
            estatistico: lote.podcast.estatistico.trim(),
          },
          aprovadaPor,
          ativa: false,
        },
        select: { id: true, tema: true, foco: true, origem: true, podcast: true },
      });
      return {
        id: nova.id,
        tema: nova.tema,
        foco: nova.foco,
        origem: nova.origem === "ia" ? ("ia" as const) : ("padrao" as const),
        ativa: false,
        posts,
        podcast: podcastDaLinha(nova.podcast, { escolaId, coberturaId: nova.id }),
      };
    }, escolaId);
  }

  /** A guarda de turma, sozinha — a do preparo, ANTES de gastar token. */
  async exigirTurmaVisivel(escolaId: string, turmaId: string, professorId?: string): Promise<void> {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
  }

  /**
   * A cobertura das imagens e do podcast (`midia.service.ts`,
   * `podcast.service.ts`): a pedida, ou a em andamento sem pedido. A pedida é
   * a atividade PRONTA que a professora prepara antes de pôr no ar (ADR-130).
   */
  async coberturaParaMidia(
    escolaId: string,
    turmaId: string,
    professorId?: string,
    coberturaId?: string,
  ): Promise<CoberturaLida> {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      if (coberturaId) return coberturaDaLinha(await this.coberturaDaTurma(tx, escolaId, turmaId, coberturaId));
      return (await this.exigirGate(tx, escolaId, turmaId)).cobertura;
    }, escolaId);
  }

  /**
   * Grava a URL de UMA imagem na cobertura. Concatenação de JSONB no próprio
   * UPDATE (`midia || {post: url}`), e não ler-modificar-gravar: duas abas do
   * preparo gravando imagens diferentes não podem apagar uma à outra.
   */
  async registrarMidia(escolaId: string, coberturaId: string, postId: IdDePost, url: string): Promise<void> {
    await this.prisma.comTenancy(
      (tx) => tx.$executeRaw`
        UPDATE exp07ef1b_coberturas
           SET midia = midia || jsonb_build_object(${postId}::text, ${url}::text),
               atualizada_em = now()
         WHERE id = ${coberturaId}::uuid AND escola_id = ${escolaId}`,
      escolaId,
    );
  }

  // ────────────────────────────────────────────────────────────── privados

  /** O estado público da sessão — o que toda rota do estudante devolve. */
  private estado(sessao: SessaoLida, gate: GateLido) {
    const passo = normalizarPasso(sessao.passo);
    const publicada = Boolean(sessao.publicadaEm);
    return {
      sessaoId: sessao.id,
      coberturaId: sessao.coberturaId,
      rodada: sessao.rodada,
      etapa: gate.etapa,
      passo: passoEfetivo(passo, gate.etapa),
      passoDoEstudante: passo,
      aguardandoOProfessor: aguardandoOProfessor(passo, gate.etapa),
      publicada,
      publicadaEm: sessao.publicadaEm?.toISOString() ?? null,
      selecao: publicada ? selecaoDaLinha(sessao) : null,
      legenda: sessao.legenda,
      reflexaoEnviada: Boolean(sessao.reflexao) || !passoAntes(passo, "enquetes"),
      concluidaEm: sessao.concluidaEm?.toISOString() ?? null,
    };
  }

  /** Uma tríade do Mural, com a ficha técnica só quando ela já foi revelada. */
  private triade(cobertura: CoberturaLida, selecao: readonly string[], legenda: string, fichas: boolean) {
    const porId = new Map(cobertura.posts.map((p) => [p.id as string, p]));
    const posts = selecao.map((id) => porId.get(id)).filter((p): p is PostDaCobertura => Boolean(p));
    const matriz = matrizDaSelecao(selecao, lenteDaCobertura(cobertura));
    return {
      posts: posts.map((p) => postPublico(p, cobertura.midia)),
      legenda,
      fichas: fichas
        ? posts.map((p) => ({ postId: p.id, fonte: p.tagFonte, angulo: p.tagAngulo, enquadramento: p.enquadramento }))
        : null,
      equilibrio: fichas ? percentuais(matriz) : null,
    };
  }

  /**
   * Quem publica com o Mural JÁ aberto. Se um colega de computador dele já tem
   * par nesta rodada, é o mesmo par (o Mural é do computador); senão, o colega
   * virtual mais distante — a sala já foi pareada, e ninguém dela está livre.
   */
  private async parDeQuemChegaDepois(
    tx: Prisma.TransactionClient,
    escolaId: string,
    ctx: ContextoDoEstudante,
    matriz: Matriz,
  ): Promise<{ parSessaoId?: string | null; parVirtual?: string | null; parRotulo?: string | null }> {
    const equipe = await equipeDoEstudante(
      tx,
      escolaId,
      ctx.turmaId,
      EXP_ID,
      ctx.sessao.coberturaId,
      ctx.sessao.estudanteId,
    );
    if (equipe) {
      const colegas = equipe.membros.map((m) => m.id).filter((id) => id !== ctx.sessao.estudanteId);
      const doComputador = colegas.length
        ? await tx.exp07ef1bSessao.findFirst({
            where: {
              escolaId,
              turmaId: ctx.turmaId,
              coberturaId: ctx.sessao.coberturaId,
              rodada: ctx.sessao.rodada,
              estudanteId: { in: colegas },
              parRotulo: { not: null },
            },
            orderBy: { publicadaEm: "desc" },
            select: { parSessaoId: true, parVirtual: true, parRotulo: true },
          })
        : null;
      if (doComputador?.parRotulo) {
        return {
          parSessaoId: doComputador.parSessaoId,
          parVirtual: doComputador.parVirtual,
          parRotulo: doComputador.parRotulo,
        };
      }
    }
    const id = virtualMaisDistante(matriz, virtuaisDa(ctx.cobertura));
    return { parVirtual: id, parRotulo: COLEGAS_VIRTUAIS[id].nome };
  }

  /**
   * O PAREAMENTO DA SALA, na abertura do Mural. Chamado com o lock exclusivo da
   * turma, dentro da transação que muda a etapa.
   *
   * As sessões desta (cobertura, rodada) viram UNIDADES por computador
   * (`colapsarEmUnidades` sobre `mapaDeEquipes`, com `iniciou = publicou` e a
   * recência pela publicação); cada unidade que publicou entra no `parear`
   * com a matriz do representante. A sala de UM computador é projeção: todo
   * mundo recebe o virtual.
   *
   * O rótulo é CONGELADO na sessão: o nome da equipe ou o primeiro nome do
   * representante (`rotulosSemRepeticao`, que desempata duas Gabrielas) —
   * nunca `equipe:<id>`, porque o PUT das equipes recria os ids e o Mural de
   * quem já viu a sala perderia o par.
   */
  private async parearSala(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    gate: GateLido,
    cobertura: CoberturaLida,
  ): Promise<number> {
    const [sessoes, mapa, computadores, estudantes] = await Promise.all([
      tx.exp07ef1bSessao.findMany({
        where: { escolaId, turmaId, coberturaId: gate.coberturaId, rodada: gate.rodada },
        select: { id: true, estudanteId: true, publicadaEm: true, matriz: true, selecao: true },
        orderBy: [{ publicadaEm: "asc" }, { id: "asc" }],
      }),
      mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, gate.coberturaId),
      computadoresDaMontagem(tx, escolaId, turmaId, EXP_ID, gate.coberturaId),
      tx.user.findMany({ where: { escolaId, turmaId, role: "estudante" }, select: { id: true, displayName: true } }),
    ]);

    const lenteDe = lenteDaCobertura(cobertura);
    const unidades = colapsarEmUnidades(
      sessoes,
      (s) => s.estudanteId,
      mapa,
      (s) => s.publicadaEm !== null,
      (s) => s.publicadaEm?.getTime() ?? 0,
    ).filter((u) => u.linha.publicadaEm !== null);
    if (unidades.length === 0) return 0;

    const matrizDe = (s: (typeof sessoes)[number]) => matrizDoJson(s.matriz) ?? matrizDaSelecao(s.selecao, lenteDe);
    const pares = parear(
      unidades.map((u) => ({ chave: u.chave, matriz: matrizDe(u.linha) })),
      virtuaisDa(cobertura),
      { projecao: computadores === 1 },
    );

    const primeiroNome = rotulosSemRepeticao(estudantes.map((e) => ({ id: e.id, nome: e.displayName })));
    const porChave = new Map(unidades.map((u) => [u.chave, u]));
    const rotuloDe = (u: { equipe: EquipeDoMapa | null; linha: { estudanteId: string } }) =>
      u.equipe?.nome ?? primeiroNome.get(u.linha.estudanteId) ?? "Colega";

    let pareadas = 0;
    for (const u of unidades) {
      const par = pares.get(u.chave);
      if (!par) continue;
      let dados: { parSessaoId: string | null; parVirtual: string | null; parRotulo: string };
      if (par.tipo === "virtual") {
        dados = { parSessaoId: null, parVirtual: par.id, parRotulo: COLEGAS_VIRTUAIS[par.id].nome };
      } else {
        const outra = porChave.get(par.chave);
        if (!outra) continue;
        dados = { parSessaoId: outra.linha.id, parVirtual: null, parRotulo: rotuloDe(outra).slice(0, 80) };
      }
      /* Todas as sessões PUBLICADAS do computador recebem o mesmo par: o Mural
         é da tela, e o colega que também publicou com o próprio login vê a
         mesma comparação que o representante. */
      const ids = u.linhas.filter((l) => l.publicadaEm !== null).map((l) => l.id);
      const { count } = await tx.exp07ef1bSessao.updateMany({
        where: { escolaId, id: { in: ids } },
        data: dados,
      });
      pareadas += count;
    }
    return pareadas;
  }

  /** A cobertura desta turma, ou 404 — a de outra turma não tem a existência confirmada. */
  private async coberturaDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, coberturaId: string) {
    const linha = ehUuid(coberturaId)
      ? await tx.exp07ef1bCobertura.findFirst({
          where: { id: coberturaId, escolaId, turmaId },
          select: { ...CAMPOS_DA_COBERTURA, criadaEm: true, imagensAprovadasEm: true },
        })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  /** O gate e a cobertura dele, sem criar — `null` sem gate. */
  private async lerGate(tx: Prisma.TransactionClient, escolaId: string, turmaId: string): Promise<GateLido | null> {
    const linha = await tx.exp07ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { coberturaId: true, rodada: true, etapa: true, atualizadoEm: true },
    });
    return linha
      ? { coberturaId: linha.coberturaId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa), atualizadoEm: linha.atualizadoEm }
      : null;
  }

  /**
   * O gate da turma e a cobertura EM ANDAMENTO — ou 403
   * `atividade-nao-preparada`.
   *
   * **A plataforma nunca cria a atividade** (ADR-130): a missão é o esqueleto
   * narrativo, e a cobertura é a que o professor criou e PÔS EM ANDAMENTO na
   * lista de atividades. Antes, a primeira entrada da turma criava sozinha a
   * cobertura da Praça Central; agora o banco curado é só o ponto de partida
   * do preparo. O 403 é a porta fechada que a experiência já sabe dizer.
   */
  private async exigirGate(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<{ gate: GateLido; cobertura: CoberturaLida }> {
    const linha = await tx.exp07ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      include: { cobertura: { select: CAMPOS_DA_COBERTURA } },
    });
    if (!linha) throw erroDeJogo("atividade-nao-preparada");
    return {
      gate: {
        coberturaId: linha.coberturaId,
        rodada: linha.rodada,
        etapa: normalizarEtapa(linha.etapa),
        atualizadoEm: linha.atualizadoEm,
      },
      cobertura: coberturaDaLinha(linha.cobertura),
    };
  }

  /**
   * O FUNIL de toda rota de estudante que lê ou escreve a sessão: escola do
   * token, missão liberada (ADR-69) e disponível (ADR-87), turma, gate e a
   * sessão desta rodada — criada se faltar, e travada por estudante.
   *
   * `exigirMissaoLiberada` mora AQUI, e não em cada rota, pela razão do
   * `AGENTS.md` da raiz: a guarda tem de estar no funil, nunca só na leitura —
   * `/exp/:expId` é endereço adivinhável e o bundle é público.
   */
  private async garantirSessao(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
  ): Promise<ContextoDoEstudante> {
    await this.estudanteDaEscola(tx, escolaId, estudanteId);
    if (!turmaId) throw erroDeJogo("sem-turma");
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
    if (!turma) throw erroDeJogo("turma-nao-encontrada");

    const { gate, cobertura } = await this.exigirGate(tx, escolaId, turmaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`a-selecao:estudante:${escolaId}:${estudanteId}`}, 0))`;
    const chave = { escolaId, turmaId, estudanteId, coberturaId: gate.coberturaId, rodada: gate.rodada };
    /* `createMany` com `skipDuplicates` é um INSERT ... ON CONFLICT DO NOTHING:
       o F5 e a segunda aba não abortam a transação com um P2002. */
    await tx.exp07ef1bSessao.createMany({ data: [chave], skipDuplicates: true });
    const sessao = await tx.exp07ef1bSessao.findUniqueOrThrow({
      where: { escolaId_turmaId_estudanteId_coberturaId_rodada: chave },
      include: { reflexao: { select: { sessaoId: true } } },
    });
    return { turmaId, gate, cobertura, sessao };
  }

  /** `users` está fora da RLS: a escola do token precisa bater com a do usuário. */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
  }

  /** Escola do token E matrícula na turma quando quem pede é professor. 404, nunca 403. */
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

  /**
   * O lock consultivo da TURMA. Exclusivo para quem muda a aula inteira (abrir
   * o Mural e parear, zerar, homologar, criar o gate); compartilhado para a
   * publicação, que só precisa não cruzar com o pareamento.
   */
  private async travarTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    modo: "exclusivo" | "compartilhado",
  ): Promise<void> {
    const chave = `a-selecao:turma:${escolaId}:${turmaId}`;
    if (modo === "exclusivo") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;
    } else {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${chave}, 0))`;
    }
  }

  /**
   * O CANAL A, depois do latch: a IA gradua a legenda, e a marca entra numa
   * transação SÓ DELA.
   *
   * Falhou a IA (sem saldo, teto de tempo, saída inválida, o mock que sempre
   * lança)? Nada é marcado: fica "Não avaliado", e o professor decide no
   * painel de habilidades. A rodada do gate mudou entre as duas transações (a
   * professora zerou no meio)? Também não marca — a marca atrasada cairia numa
   * rodada que acabou e enganaria o recálculo das equipes.
   *
   * Nada daqui derruba a resposta: a publicação JÁ foi gravada, e um 500 agora
   * faria a criança tocar em "Publicar" de novo e receber "já publicado".
   */
  private async classificarEMarcar(escolaId: string, estudanteId: string, alvo: ParaOCanalA): Promise<void> {
    const resultado = await this.classificacao.classificar(escolaId, estudanteId, alvo.entrada);
    if (!resultado.ok) return;
    try {
      await this.prisma.comTenancy(async (tx) => {
        const gate = await this.lerGate(tx, escolaId, alvo.turmaId);
        if (!gate || gate.coberturaId !== alvo.coberturaId || gate.rodada !== alvo.rodada) {
          logger.info({ codigo: "exp07ef1b-canal-a-rodada-mudou", escolaId }, "a rodada mudou antes da marca");
          return;
        }
        try {
          await this.evidencias.marcar(tx, {
            escolaId,
            turmaId: alvo.turmaId,
            expId: EXP_ID,
            atividadeId: alvo.coberturaId,
            rodada: alvo.rodada,
            estudanteId,
            marcador: MARCADOR_DA_LEGENDA,
            status: resultado.nivel,
          });
        } catch (erro) {
          /* O 400 do `marcar` (ficha sem o marcador, atividade fora do formato)
             é falha de CONFIGURAÇÃO, e é recusado antes de qualquer escrita — a
             transação segue sã. Outro erro sobe e é pego abaixo. */
          if (erro instanceof BadRequestException) {
            logger.warn({ codigo: "exp07ef1b-canal-a-marca-recusada", escolaId }, "a evidência recusou a marca");
            return;
          }
          throw erro;
        }
      }, escolaId);
    } catch (erro) {
      logger.error({ codigo: "exp07ef1b-canal-a-marca-falhou", escolaId, err: erro }, "a marca do Canal A falhou");
    }
  }
}

function ehColegaVirtual(valor: string | null): valor is ColegaVirtual {
  return valor !== null && (COLEGAS_VIRTUAIS_IDS as readonly string[]).includes(valor);
}

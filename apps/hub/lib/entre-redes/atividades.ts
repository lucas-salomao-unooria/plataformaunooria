import type { CoberturasDaTurma } from "../a-selecao-tipos";
import type { PacotesDaTurmaEfeito } from "../efeito-amplificador-tipos";
import type { PacotesDaTurma } from "../jornal-escola-tipos";
import type { PacotesDoJuri } from "../juri-estadual-tipos";
import type { PacotesDaTurmaQuemMandou } from "../quem-mandou-tipos";

/**
 * AS ATIVIDADES DE UMA MISSÃO (ADR-130).
 *
 * A missão é o esqueleto narrativo; a ATIVIDADE é a missão que a turma faz de
 * fato, e quem a cria é sempre o professor — a plataforma não cria nada. Cada
 * missão é DONA das próprias atividades na api (a cobertura da exp07ef1b, o
 * pacote da exp04ef1b, da exp05ef1b e da exp06ef1b, a `activity` da
 * exp08ef1b); este módulo traduz as cinco respostas para a MESMA lista da
 * ficha, e diz para onde cada atividade leva.
 *
 * Puro, e vale no cliente: o botão "Usar esta atividade agora" importa daqui.
 * As leituras server-side moram em `atividades-servidor.ts`.
 */

/** As missões com atividade — o mesmo par de `equipes/regras.ts#EXPERIENCIAS_COM_ATIVIDADE` na api. */
export const MISSOES_COM_ATIVIDADE = ["exp08ef1b", "exp07ef1b", "exp04ef1b", "exp05ef1b", "exp06ef1b", "exp02em1b"] as const;
export type MissaoComAtividade = (typeof MISSOES_COM_ATIVIDADE)[number];

export function temAtividades(expId: string | null | undefined): expId is MissaoComAtividade {
  return (MISSOES_COM_ATIVIDADE as readonly string[]).includes(expId ?? "");
}

/**
 * O estado na lista. Uma atividade EM ANDAMENTO por turma — a que o professor
 * escolheu —; as outras ficam PRONTAS, à espera do "Usar esta atividade agora".
 * EM PREPARO só existe no Instanooria: os posts são gerados e revisados antes.
 */
export type EstadoDaAtividade = "em-andamento" | "pronta" | "em-preparo";

export const ROTULO_DO_ESTADO: Record<EstadoDaAtividade, { rotulo: string; variante: "success" | "info" | "warning" }> = {
  "em-andamento": { rotulo: "Em andamento", variante: "success" },
  pronta: { rotulo: "Pronta", variante: "info" },
  "em-preparo": { rotulo: "Em preparo", variante: "warning" },
};

/** Uma atividade como a ficha a lista — a mesma forma para as cinco missões. */
export interface AtividadeNaLista {
  id: string;
  titulo: string;
  /** A linha de baixo: disciplina, origem — o que distingue duas atividades do mesmo tema. */
  detalhe: string;
  estado: EstadoDaAtividade;
  criadaEm: string;
  /** Quantas rodadas já rodaram; 0 = nunca rodou. */
  rodadas: number;
  /** Uma linha a mais, da missão: a pergunta-chave do Instanooria. */
  complemento?: string | null;
  /** Só no Instanooria, a única missão que EXCLUI atividade: o que vai junto. */
  exclusao?: { posts: number; sessoes: number };
}

/** "nunca rodou" / "1 rodada" / "3 rodadas". */
export function textoDasRodadas(n: number): string {
  if (n <= 0) return "nunca rodou";
  return n === 1 ? "1 rodada" : `${n} rodadas`;
}

const ORIGEM = { ia: "gerada com IA", padrao: "conteúdo da Unooria" } as const;

/**
 * A série da missão, a partir do código (ADR-110): `exp07ef1b` → `7EF`. É o
 * filtro das turmas que podem fazer a missão — a do 7º ano não roda no 8º.
 */
export function serieDaMissao(expId: string): string | null {
  /* `-vN` é a versão anterior (ADR-181): mora na mesma série. */
  const m = /^exp(\d{2})(ef|em)\d+b(-v\d+)?$/.exec(expId);
  if (!m) return null;
  return `${Number(m[1])}${(m[2] as string).toUpperCase()}`;
}

/**
 * Para onde a atividade leva — a PÁGINA DA ATIVIDADE. No Instanooria é a tela
 * dela, que já existia; nas outras, a aula e os resultados da missão com
 * a atividade escolhida na URL (o mesmo `?cobertura=`/`?pacote=` que o painel de
 * habilidades já lia).
 */
export function rotaDaAtividade(rotaDaMissao: string, expId: MissaoComAtividade, turmaId: string, atividadeId: string): string {
  if (expId === "exp08ef1b") return `/professor/atividades/${encodeURIComponent(atividadeId)}`;
  const chave = expId === "exp07ef1b" ? "cobertura" : "pacote";
  const busca = new URLSearchParams({ turmaId, [chave]: atividadeId });
  return `${rotaDaMissao}/resultados?${busca.toString()}`;
}

/** Onde se cria a próxima. O Instanooria tem a criação dele (a geração dos posts é longa e assíncrona). */
export function rotaDaNovaAtividade(rotaDaMissao: string, expId: MissaoComAtividade, turmaId: string): string {
  const busca = new URLSearchParams({ turmaId }).toString();
  if (expId === "exp08ef1b") return `/professor/atividades/nova?${busca}`;
  return `${rotaDaMissao}/atividades/nova?${busca}`;
}

/**
 * O caminho de "Usar esta atividade agora", sem o prefixo do BFF. No
 * Instanooria é o "Ativar" de sempre — que confere a matriz e pode responder
 * 422 com as pendências.
 */
export function caminhoDoEmAndamento(expId: MissaoComAtividade, turmaId: string, atividadeId: string): string {
  const t = encodeURIComponent(turmaId);
  const a = encodeURIComponent(atividadeId);
  switch (expId) {
    case "exp08ef1b":
      return `/atividades/${a}/ativar`;
    case "exp07ef1b":
      return `/a-selecao/turmas/${t}/coberturas/${a}/em-andamento`;
    case "exp04ef1b":
      return `/jornal-escola/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp05ef1b":
      return `/quem-mandou-isso/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp06ef1b":
      return `/juri-estadual/turmas/${t}/pacotes/${a}/em-andamento`;
    case "exp02em1b":
      return `/efeito-amplificador/turmas/${t}/pacotes/${a}/em-andamento`;
  }
}

/** A atividade do Instanooria como `GET /atividades` a devolve. */
export interface AtividadeDoInstanooria {
  id: string;
  turmaId: string | null;
  titulo: string;
  disciplina: string;
  recorte: string;
  perguntaChave: string;
  status: string;
  criadoEm: string;
  posts: number;
  sessoes: number;
}

/** O ciclo de vida do Instanooria em três estados: ativa, pronta (revisão ou encerrada), em preparo. */
export function estadoDoInstanooria(status: string): EstadoDaAtividade {
  if (status === "ativa") return "em-andamento";
  if (status === "revisao" || status === "encerrada") return "pronta";
  return "em-preparo";
}

export function atividadesDoInstanooria(atividades: readonly AtividadeDoInstanooria[]): AtividadeNaLista[] {
  return atividades.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    detalhe: [a.disciplina, a.recorte].filter(Boolean).join(" · "),
    estado: estadoDoInstanooria(a.status),
    criadaEm: a.criadoEm,
    /* O Instanooria não tem rodada: quem rodou é quem teve sessão. */
    rodadas: a.sessoes > 0 ? 1 : 0,
    complemento: a.perguntaChave || null,
    exclusao: { posts: a.posts, sessoes: a.sessoes },
  }));
}

export function atividadesDaSelecao(c: CoberturasDaTurma): AtividadeNaLista[] {
  return c.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [h.foco, ORIGEM[h.origem]].filter(Boolean).join(" · "),
    /* Sem a segunda fase da aprovação (ADR-146), a atividade não vai ao ar:
       "Em preparo", e o card não oferece "Usar esta atividade agora" — a api
       recusaria com 409 `imagens-nao-aprovadas`. */
    estado: h.ativa ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadaEm,
    rodadas: h.rodadas,
  }));
}

export function atividadesDoJornal(p: PacotesDaTurma): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [h.disciplina, ORIGEM[h.origem]].join(" · "),
    /* Sem as imagens geradas e aprovadas (ADR-147), a atividade não vai ao ar:
       "Em preparo", e o card não oferece "Usar esta atividade agora" — a api
       recusaria com 409 `imagens-nao-aprovadas`. */
    estado: h.ativo ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadoEm,
    rodadas: h.rodadas,
  }));
}

export function atividadesDoQuemMandou(
  p: PacotesDaTurmaQuemMandou,
  rotuloDaDisciplina: (slug: string) => string,
): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : "pronta",
    criadaEm: h.aprovadoEm,
    rodadas: h.rodadas,
  }));
}

/** O Júri Estadual: o pacote homologado é a atividade, como no Jornal. A disciplina vem em slug. */
export function atividadesDoJuri(p: PacotesDoJuri, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    /* Sem as imagens aprovadas (a segunda fase, o pedido do PO), a atividade não
       vai ao ar: "Em preparo", sem "Usar esta atividade agora" — a api recusaria
       com 409 `imagens-nao-aprovadas`. A que já está no ar continua no ar. */
    estado: h.ativo ? "em-andamento" : h.imagensAprovadas ? "pronta" : "em-preparo",
    criadaEm: h.criadoEm,
    rodadas: h.rodadas,
  }));
}

/** O Efeito Amplificador (ADR-181): o pacote homologado é a atividade, sem segunda fase de aprovação. */
export function atividadesDoEfeito(p: PacotesDaTurmaEfeito, rotuloDaDisciplina: (slug: string) => string): AtividadeNaLista[] {
  return p.historico.map((h) => ({
    id: h.id,
    titulo: h.tema,
    detalhe: [rotuloDaDisciplina(h.disciplina), ORIGEM[h.origem]].join(" · "),
    estado: h.ativo ? "em-andamento" : "pronta",
    criadaEm: h.aprovadoEm,
    rodadas: h.rodadas,
  }));
}

/**
 * A ordem da lista: a EM ANDAMENTO primeiro (é a pergunta de quem abre a
 * ficha: "o que a turma está fazendo?"), depois da mais nova à mais velha.
 */
export function ordenarAtividades(lista: readonly AtividadeNaLista[]): AtividadeNaLista[] {
  return [...lista].sort((a, b) => {
    const pesoA = a.estado === "em-andamento" ? 0 : 1;
    const pesoB = b.estado === "em-andamento" ? 0 : 1;
    return pesoA - pesoB || b.criadaEm.localeCompare(a.criadaEm);
  });
}

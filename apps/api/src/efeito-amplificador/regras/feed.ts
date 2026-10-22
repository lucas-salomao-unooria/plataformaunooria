import type { ComentarioDoFeed, Moderacao } from "../conteudo";

/**
 * O que o estudante FEZ no feed da madrugada (Etapa 4) — o que a EM13CO24 e a
 * EM13CO08 medem. Puro. Rolar e curtir não entram: são cosméticos (handoff
 * §1.3), e contar o passivo daria nível a quem só olhou.
 */
export interface FeedDaSessao {
  /** Ids dos comentários que o estudante abriu ("ver mais"). */
  inspecionados: string[];
  /** Abriu "Ver Métricas da Publicação". */
  metricas: boolean;
  moderacoes: Moderacao[];
  /** Configurações de Privacidade → conta privada (preservar privacidade). */
  privacidade: boolean;
  /** Ids dos comentários/perfis denunciados (reportar suspeita). */
  denuncias: string[];
  /** Central de Apoio / Ajuda e Segurança (buscar ajuda). */
  ajuda: boolean;
}

export function feedVazio(): FeedDaSessao {
  return { inspecionados: [], metricas: false, moderacoes: [], privacidade: false, denuncias: [], ajuda: false };
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function lerFeed(bruto: unknown): FeedDaSessao {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return feedVazio();
  const b = bruto as Record<string, unknown>;
  return {
    inspecionados: lista(b.inspecionados),
    metricas: b.metricas === true,
    moderacoes: lista(b.moderacoes).filter((m): m is Moderacao => m === "restringir" || m === "aviso" || m === "arquivar"),
    privacidade: b.privacidade === true,
    denuncias: lista(b.denuncias),
    ajuda: b.ajuda === true,
  };
}

export type AcaoNoFeed =
  | { acao: "inspecionar"; comentarioId: string }
  | { acao: "metricas" }
  | { acao: "moderar"; moderacao: Moderacao }
  | { acao: "privacidade" }
  | { acao: "denunciar"; comentarioId: string }
  | { acao: "ajuda" };

export type ResultadoDaAcao =
  | { ok: true; feed: FeedDaSessao }
  | { ok: false; codigo: "comentario-desconhecido" | "veja-as-metricas" };

const comUm = (l: readonly string[], x: string) => (l.includes(x) ? [...l] : [...l, x]);

/**
 * Aplica uma ação. Idempotente por natureza (abrir o mesmo comentário duas
 * vezes não conta dobrado). ARQUIVAR exige as métricas abertas antes: o
 * one-pager proíbe apagar o post sem confrontar o gráfico (§6, ausências).
 */
export function aplicarAcao(feed: FeedDaSessao, comentarios: readonly ComentarioDoFeed[], a: AcaoNoFeed): ResultadoDaAcao {
  const ids = new Set(comentarios.map((c) => c.id));
  switch (a.acao) {
    case "inspecionar":
      if (!ids.has(a.comentarioId)) return { ok: false, codigo: "comentario-desconhecido" };
      return { ok: true, feed: { ...feed, inspecionados: comUm(feed.inspecionados, a.comentarioId) } };
    case "metricas":
      return { ok: true, feed: { ...feed, metricas: true } };
    case "moderar":
      if (a.moderacao === "arquivar" && !feed.metricas) return { ok: false, codigo: "veja-as-metricas" };
      return { ok: true, feed: { ...feed, moderacoes: comUm(feed.moderacoes, a.moderacao) as Moderacao[] } };
    case "privacidade":
      return { ok: true, feed: { ...feed, privacidade: true } };
    case "denunciar":
      if (!ids.has(a.comentarioId)) return { ok: false, codigo: "comentario-desconhecido" };
      return { ok: true, feed: { ...feed, denuncias: comUm(feed.denuncias, a.comentarioId) } };
    case "ajuda":
      return { ok: true, feed: { ...feed, ajuda: true } };
  }
}

/** As dimensões de saúde que o estudante abriu, pela categoria do comentário (o gabarito é do servidor). */
export function dimensoesInspecionadas(feed: FeedDaSessao, comentarios: readonly ComentarioDoFeed[]) {
  const tipos = new Set(comentarios.filter((c) => feed.inspecionados.includes(c.id)).map((c) => c.tipo));
  return { fisica: tipos.has("saude_fisica"), mental: tipos.has("saude_mental") };
}

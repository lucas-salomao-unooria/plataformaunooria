import type { ComentarioDoFeed, DestinoDoRelato, MotivoDoAviso } from "../conteudo";

/**
 * O que o estudante FEZ no feed da madrugada (Etapa 4) — o que a EM13CO24 e a
 * EM13CO08 medem. Puro. Rolar e ler não entram: contar o passivo daria nível a
 * quem só olhou.
 *
 * As ações são as do protótipo revisado (Figma de 2026-10-27, ADR-191):
 * - "Fixar aviso de cuidado" → a folha de motivo (E4-ALU-02). Uma vez: o aviso
 *   fixado é o que o post mostra, e o motivo é o que a CO24 mede;
 * - "Configuração da Publicação" (E4-ALU-04) → conta privada e restringir
 *   comentários, duas chaves que ligam e desligam;
 * - a barra "Central de Apoio" (E4-ALU-03) → denunciar o perfil suspeito e
 *   encaminhar um relato (um comentário e uma equipe).
 */
export interface RelatoEncaminhado {
  comentarioId: string;
  destino: DestinoDoRelato;
}

export interface FeedDaSessao {
  /** O motivo do aviso fixado, ou `null`. */
  aviso: MotivoDoAviso | null;
  contaPrivada: boolean;
  restringirComentarios: boolean;
  /** Abriu a Central de Apoio (a régua da CO08 conta como "em processo" quem só abriu). */
  abriuCentral: boolean;
  /** Denunciou o perfil suspeito. */
  denunciou: boolean;
  relatos: RelatoEncaminhado[];
}

export function feedVazio(): FeedDaSessao {
  return { aviso: null, contaPrivada: false, restringirComentarios: false, abriuCentral: false, denunciou: false, relatos: [] };
}

const MOTIVOS: readonly string[] = ["saude_usuarios", "fonte_duvidosa", "ofensivo"];

/** Leitura defensiva do JSONB: a forma da 2.0.x (moderações, inspecionados) vira o feed vazio. */
export function lerFeed(bruto: unknown): FeedDaSessao {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return feedVazio();
  const b = bruto as Record<string, unknown>;
  const relatos = Array.isArray(b.relatos)
    ? b.relatos.flatMap((r) => {
        const o = (r ?? {}) as Record<string, unknown>;
        return typeof o.comentarioId === "string" && (o.destino === "escola" || o.destino === "unoovista")
          ? [{ comentarioId: o.comentarioId, destino: o.destino as DestinoDoRelato }]
          : [];
      })
    : [];
  return {
    aviso: typeof b.aviso === "string" && MOTIVOS.includes(b.aviso) ? (b.aviso as MotivoDoAviso) : null,
    contaPrivada: b.contaPrivada === true,
    restringirComentarios: b.restringirComentarios === true,
    abriuCentral: b.abriuCentral === true,
    denunciou: b.denunciou === true,
    relatos,
  };
}

export type AcaoDeSeguranca =
  | { acao: "conta_privada"; ligado: boolean }
  | { acao: "restringir_comentarios"; ligado: boolean }
  | { acao: "abrir_central" }
  | { acao: "denunciar_perfil" }
  | { acao: "encaminhar_apoio"; comentarioId: string; destino: DestinoDoRelato };

export type ResultadoDaAcao = { ok: true; feed: FeedDaSessao } | { ok: false; codigo: "comentario-desconhecido" | "aviso-ja-fixado" };

/**
 * "Fixar aviso de cuidado" com o motivo. O aviso é UM: o segundo com o MESMO
 * motivo é idempotente; com outro, 409 — o post já mostra o primeiro, e trocar
 * o motivo depois de ver a reação apagaria o que a CO24 mediu.
 */
export function fixarAviso(feed: FeedDaSessao, motivo: MotivoDoAviso): ResultadoDaAcao {
  if (feed.aviso === motivo) return { ok: true, feed };
  if (feed.aviso !== null) return { ok: false, codigo: "aviso-ja-fixado" };
  return { ok: true, feed: { ...feed, aviso: motivo } };
}

/** As ações de proteção (EM13CO08). Idempotentes: o mesmo relato duas vezes não conta dobrado. */
export function aplicarSeguranca(feed: FeedDaSessao, comentarios: readonly ComentarioDoFeed[], a: AcaoDeSeguranca): ResultadoDaAcao {
  switch (a.acao) {
    case "conta_privada":
      return { ok: true, feed: { ...feed, contaPrivada: a.ligado } };
    case "restringir_comentarios":
      return { ok: true, feed: { ...feed, restringirComentarios: a.ligado } };
    case "abrir_central":
      return { ok: true, feed: { ...feed, abriuCentral: true } };
    case "denunciar_perfil":
      return { ok: true, feed: { ...feed, abriuCentral: true, denunciou: true } };
    case "encaminhar_apoio": {
      if (!comentarios.some((c) => c.id === a.comentarioId)) return { ok: false, codigo: "comentario-desconhecido" };
      const ja = feed.relatos.some((r) => r.comentarioId === a.comentarioId && r.destino === a.destino);
      const relatos = ja ? feed.relatos : [...feed.relatos, { comentarioId: a.comentarioId, destino: a.destino }];
      return { ok: true, feed: { ...feed, abriuCentral: true, relatos } };
    }
  }
}

/**
 * O perfil que "Denunciar perfil" denuncia: a conta anônima invasiva que
 * comentou PRIMEIRO na madrugada (o `user_89412`, 02h22, no banco padrão).
 * Desce SÓ o nome dela — a tela precisa dizer quem vai denunciar; a categoria
 * dos outros comentários (a de saúde, que é o gabarito da CO24) continua no
 * servidor. "02h22" < "02h50" na ordem das strings: o formato é fixo.
 */
export function perfilSuspeito(comentarios: readonly ComentarioDoFeed[]): ComentarioDoFeed | null {
  const anonimos = comentarios.filter((c) => c.tipo === "anonimo_agressivo");
  return anonimos.reduce<ComentarioDoFeed | null>((a, c) => (a === null || c.horario < a.horario ? c : a), null);
}

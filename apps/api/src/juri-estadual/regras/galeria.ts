import {
  AREAS,
  ID_DE_POST_RE,
  ID_DE_PROJETO_RE,
  IDS_DE_PROJETO,
  TIPOS_DE_BUSCA,
  type Area,
  type TipoDeBusca,
} from "../vocabulario";
import { FEED_VAZIO, projetoFoiExibido, type EstadoDoFeed } from "./afunilamento";

/**
 * O que a sessão grava do feed e da Galeria Oculta, lido do JSONB — puro.
 *
 * A leitura é TOLERANTE: o CHECK da migração cobra o tipo (array, objeto), não
 * cada item, e uma linha torta não pode derrubar a aula. Item que não casa com
 * o vocabulário é descartado aqui, e o motor nunca o vê.
 */

/** Uma lista de ids de post gravada: só os válidos, sem repetição. */
function listaDePosts(bruto: unknown): string[] {
  return Array.isArray(bruto)
    ? [...new Set(bruto.filter((x): x is string => typeof x === "string" && ID_DE_POST_RE.test(x)))]
    : [];
}

/** As quatro listas do feed do júri. */
export function feedDaLinha(linha: {
  postsServidos: unknown;
  curtidos: unknown;
  salvos: unknown;
  permanencias: unknown;
}): EstadoDoFeed {
  return {
    ...FEED_VAZIO,
    servidos: listaDePosts(linha.postsServidos),
    curtidos: listaDePosts(linha.curtidos),
    salvos: listaDePosts(linha.salvos),
    permanencias: listaDePosts(linha.permanencias),
  };
}

/**
 * O que a criança FEZ na galeria — é o dado da EF06CO10 e da EF06CO01 (`regras/evidencia.ts`).
 *
 * - `abertos`: os estandes cuja ficha ela abriu, sem repetir;
 * - `buscas`: o TIPO de cada busca (hashtag ou texto) e a área que casou, ou
 *   `null` — o texto digitado nunca é gravado (texto livre de menor).
 */
export type Auditoria = {
  abertos: string[];
  buscas: { tipo: TipoDeBusca; area: Area | null }[];
};

export const AUDITORIA_VAZIA: Auditoria = { abertos: [], buscas: [] };

/** O teto de buscas gravadas: o painel e a régua só precisam saber se buscou, e que área. */
export const MAX_BUSCAS = 30;

export function auditoriaDaLinha(bruto: unknown): Auditoria {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return { abertos: [], buscas: [] };
  const { abertos, buscas } = bruto as { abertos?: unknown; buscas?: unknown };
  return {
    abertos: Array.isArray(abertos)
      ? [...new Set(abertos.filter((x): x is string => typeof x === "string" && ID_DE_PROJETO_RE.test(x)))]
      : [],
    buscas: Array.isArray(buscas)
      ? buscas
          .filter(
            (b): b is { tipo: TipoDeBusca; area: Area | null } =>
              b !== null &&
              typeof b === "object" &&
              (TIPOS_DE_BUSCA as readonly unknown[]).includes((b as { tipo?: unknown }).tipo) &&
              ((b as { area?: unknown }).area === null ||
                (AREAS as readonly unknown[]).includes((b as { area?: unknown }).area)),
          )
          .map((b) => ({ tipo: b.tipo, area: b.area }))
          .slice(0, MAX_BUSCAS)
      : [],
  };
}

export type AcaoDaGaleria =
  | { tipo: "abrir"; projetoId: string }
  | { tipo: "buscar"; busca: TipoDeBusca; area: Area | null };

/**
 * Registra uma ação. Abrir de novo o mesmo estande não conta; a 31ª busca não
 * é gravada. `mudou: false` poupa o UPDATE.
 */
export function registrarAcao(atual: Auditoria, acao: AcaoDaGaleria): { auditoria: Auditoria; mudou: boolean } {
  if (acao.tipo === "abrir") {
    if (atual.abertos.includes(acao.projetoId)) return { auditoria: atual, mudou: false };
    return { auditoria: { ...atual, abertos: [...atual.abertos, acao.projetoId] }, mudou: true };
  }
  if (atual.buscas.length >= MAX_BUSCAS) return { auditoria: atual, mudou: false };
  return { auditoria: { ...atual, buscas: [...atual.buscas, { tipo: acao.busca, area: acao.area }] }, mudou: true };
}

/**
 * A ordem da grade: os que NÃO chegaram ao feed primeiro (é a Galeria Oculta),
 * depois os vistos — e, dentro de cada grupo, a ordem dos ids (área a área,
 * que é como a busca por hashtag os agrupa).
 */
export function ordemDaGaleria(servidos: readonly string[]): string[] {
  const ocultos = IDS_DE_PROJETO.filter((id) => !projetoFoiExibido(servidos, id));
  const vistos = IDS_DE_PROJETO.filter((id) => projetoFoiExibido(servidos, id));
  return [...ocultos, ...vistos];
}

/** Quantos estandes OCULTOS a criança abriu — o "Manter" só vale com um (melhoria 6). */
export function ocultosAbertos(auditoria: Auditoria, ocultos: readonly string[]): number {
  const oculto = new Set(ocultos);
  return auditoria.abertos.filter((id) => oculto.has(id)).length;
}

/** As áreas que a criança buscou pela HASHTAG, sem repetir — a lista do professor mostra (melhoria 3). */
export function areasBuscadas(auditoria: Auditoria): Area[] {
  return [...new Set(auditoria.buscas.filter((b) => b.tipo === "hashtag" && b.area !== null).map((b) => b.area as Area))];
}

import type { Nivel } from "../../evidencias/regras";

/**
 * A REGRA DE RESERVA da legenda (EF07CO11, ADR-170) — o que vale quando a IA
 * não leu (sem saldo, tempo esgotado, provider fora, saída recusada, depois
 * das tentativas).
 *
 * Ela NÃO dá nível: dá uma SUGESTÃO que a professora confirma no ajuste. É
 * determinística e pobre de propósito — a legenda tem no máximo 140
 * caracteres e a regra erra nos casos criativos. Dois limites conhecidos, que
 * a suíte registra:
 *
 * - **Falso "em processo"**: "Juntei a prefeitura, os comerciantes e os dados
 *   para a escola ver os três lados" explica a escolha sem conectivo da lista.
 * - **Falso "atingiu"**: "porque" + uma palavra copiada do post basta.
 *
 * Por isso a reserva nunca sugere "não atingiu" (texto sem relação ela não
 * enxerga) e nunca vira marca sozinha. As listas são as do Artur (16/10), mais
 * o "pq" que a criança escreve; a calibragem vem dos testes e do piloto, e a
 * mudança sobe `VERSAO_DA_RESERVA`, que fica gravada na sessão.
 */

export const VERSAO_DA_RESERVA = "1";

/** Conectivos e verbos de justificativa, já normalizados (sem acento, minúsculas). */
const RAZAO = [
  "porque",
  "pq",
  "pois",
  "ja que",
  "por isso",
  "mostra",
  "mostram",
  "explica",
  "explicam",
  "conta",
  "contam",
  "informa",
  "informam",
  "traz",
  "trazem",
  "apresenta",
  "apresentam",
  "revela",
  "revelam",
] as const;

/** Palavras de 5+ letras que não dizem nada do conteúdo — não contam como "conteúdo em comum". */
const VAZIAS = new Set([
  "escolhi",
  "escolher",
  "posts",
  "sobre",
  "todos",
  "todas",
  "esses",
  "essas",
  "estes",
  "estas",
  "aquele",
  "aquela",
  "melhor",
  "melhores",
  "muito",
  "porque",
  "entao",
  "quando",
  "tambem",
  "nossa",
  "nosso",
  "escola",
  "stories",
  "historia",
  "coisa",
  "coisas",
  "pessoas",
  "gente",
]);

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(texto: string): string[] {
  return normalizar(texto).split(" ").filter(Boolean);
}

export interface EntradaDaReserva {
  legenda: string;
  /** O tema da cobertura — as palavras dele não contam: o placeholder da tela já as sugere. */
  tema: string;
  /** Os 3 posts publicados: legenda, autoridade citada e perfil. */
  posts: ReadonlyArray<{ legenda: string; perfil: string; autoridadeCitada?: string }>;
}

export interface LeituraDaReserva {
  razao: boolean;
  conteudo: boolean;
  /** A SUGESTÃO — nunca `nao_atingiu`. */
  sugestao: Exclude<Nivel, "nao_atingiu">;
}

export function lerPelaReserva({ legenda, tema, posts }: EntradaDaReserva): LeituraDaReserva {
  const texto = ` ${normalizar(legenda)} `;
  const razao = RAZAO.some((r) => texto.includes(` ${r} `));

  const excluidas = new Set([...palavras(tema), ...RAZAO.flatMap((r) => r.split(" ")), ...VAZIAS]);
  const dosPosts = new Set(
    posts.flatMap((p) => [
      ...palavras(p.legenda),
      ...palavras(p.autoridadeCitada ?? ""),
      // "@folhaoficial_" → "folhaoficial"; "@moradores.jardim" → "moradores", "jardim"
      ...palavras(p.perfil.replace(/[@_.]/g, " ")),
    ]),
  );
  const conteudo = palavras(legenda).some((p) => p.length >= 5 && !excluidas.has(p) && dosPosts.has(p));

  return { razao, conteudo, sugestao: razao && conteudo ? "atingiu" : "em_processo" };
}

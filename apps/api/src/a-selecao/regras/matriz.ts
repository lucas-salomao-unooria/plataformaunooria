import { ENQUADRAMENTOS, type Enquadramento } from "../catalogo";

/**
 * A MATRIZ DE ENQUADRAMENTO de uma tríade: quantos dos 3 posts publicados são
 * de cada lente. É o "equilíbrio editorial da seleção" que acende nas fichas
 * do Mural, e é a coordenada do pareamento.
 *
 * Calculada SEMPRE no servidor, a partir do catálogo da cobertura
 * (`servidor calcula, nunca aceita`, spec §9): o cliente manda três ids, e o
 * enquadramento de cada um é gabarito — se a tela mandasse a matriz, a criança
 * escolheria com quem é pareada.
 *
 * Guardada em CONTAGEM (0 a 3), e não em percentual: a soma é sempre 3, o
 * percentual sai dela sem arredondamento acumulado, e a distância entre duas
 * tríades é um número inteiro sob a raiz — não há empate falso por 33,33%.
 */
export type Matriz = Record<Enquadramento, number>;

export const MATRIZ_VAZIA: Matriz = { institucional: 0, comunitario: 0, estatistico: 0 };

/**
 * A matriz de uma seleção. `enquadramentoDe` vem da cobertura, não do id: é
 * ela que diz a lente de cada post (no banco curado e no lote da IA a posição
 * amarra o bloco à lente, mas quem garante isso é a homologação, não esta
 * função).
 */
export function matrizDaSelecao(
  selecao: readonly string[],
  enquadramentoDe: (id: string) => Enquadramento | undefined,
): Matriz {
  const matriz: Matriz = { ...MATRIZ_VAZIA };
  for (const id of selecao) {
    const lente = enquadramentoDe(id);
    if (lente) matriz[lente] += 1;
  }
  return matriz;
}

/**
 * A distância entre duas tríades — euclidiana, sobre as contagens.
 *
 * Duas tríades opostas (3-0-0 contra 0-3-0) distam √18; duas iguais, zero. É
 * a régua do "colega de seleção divergente" do PRD: o Mural só funciona se a
 * história do par parecer outra, e parecer outra é estar longe aqui.
 */
export function distancia(a: Matriz, b: Matriz): number {
  let soma = 0;
  for (const lente of ENQUADRAMENTOS) soma += (a[lente] - b[lente]) ** 2;
  return Math.sqrt(soma);
}

/**
 * Os percentuais de uma matriz, INTEIROS e somando 100 (maior resto).
 *
 * Arredondar cada um sozinho daria 33 + 33 + 33 = 99 numa tríade 1-1-1, e o
 * gráfico da ficha mostraria um ponto percentual sumindo — que, numa missão
 * sobre o que fica de fora, é o tipo de erro que a sala nota.
 */
export function percentuais(m: Matriz): Matriz {
  const total = ENQUADRAMENTOS.reduce((s, l) => s + m[l], 0);
  if (total === 0) return { ...MATRIZ_VAZIA };
  const brutos = ENQUADRAMENTOS.map((l) => ({ l, v: (m[l] * 100) / total }));
  const base = Object.fromEntries(brutos.map(({ l, v }) => [l, Math.floor(v)])) as Matriz;
  let falta = 100 - ENQUADRAMENTOS.reduce((s, l) => s + base[l], 0);
  const porResto = [...brutos].sort((x, y) => y.v - Math.floor(y.v) - (x.v - Math.floor(x.v)));
  for (const { l } of porResto) {
    if (falta <= 0) break;
    base[l] += 1;
    falta -= 1;
  }
  return base;
}

/**
 * O perfil editorial MÉDIO da sala — o `prof.dash.distribuicao` do sheet. A
 * soma das contagens, em percentual: cada tríade pesa o mesmo, porque cada uma
 * tem exatamente três posts. Sala sem ninguém publicado: tudo zero, nunca `NaN`.
 */
export function mediaDaSala(matrizes: readonly Matriz[]): Matriz {
  const soma: Matriz = { ...MATRIZ_VAZIA };
  for (const m of matrizes) for (const l of ENQUADRAMENTOS) soma[l] += m[l];
  return percentuais(soma);
}

/**
 * Lê a matriz do `Json` da linha. O CHECK da migration já recusa forma errada;
 * esta função existe porque o tipo que o Prisma entrega é `JsonValue`, e um
 * `as` que mentisse derrubaria o painel inteiro por uma linha.
 */
export function matrizDoJson(valor: unknown): Matriz | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  const m: Matriz = { ...MATRIZ_VAZIA };
  for (const l of ENQUADRAMENTOS) {
    const n = v[l];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 3) return null;
    m[l] = n;
  }
  return m;
}

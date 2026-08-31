/**
 * Colapso dos dez valores de Schwartz nos QUATRO quadrantes que o Instanooria
 * usa — o "Ato 1" que a ficha da missão sempre descreveu como um jogo fora da
 * plataforma.
 *
 * PURO: sem Prisma, sem `Date`.
 *
 * ## O que está em jogo aqui
 *
 * O resultado vira `perfis_importados.escores`, e é isso que decide de que lado
 * o feed de cada estudante nasce (`largada.ts`). Também vira uma COLUNA no CSV do
 * `/analise`, ao lado da identidade da criança — então não é um número interno:
 * é uma afirmação que um adulto lê.
 *
 * ## As duas travas, e por que elas custam estudantes
 *
 * **1. `null` não vira zero.** Um valor com uma fonte de medida só (`indicative`)
 * ou sem oportunidade (`none`) NÃO entra na média do quadrante. Tratá-lo como
 * zero diria que a criança não tem aquele valor, quando o que houve foi não ter
 * sido observado — e essa é a distinção que o projeto inteiro protege.
 *
 * **2. Quadrante sem nenhum membro observado invalida o perfil todo.** Não dá
 * para normalizar quatro escores quando um deles é desconhecido: o
 * `normalizarPerfil` da api reescala para somar 1, e um quadrante ausente
 * entraria como zero pela porta dos fundos. Melhor não importar: sem perfil, o
 * Instanooria cai no sorteio balanceado, que é honesto sobre não saber.
 *
 * O preço é real — parte da turma não vai ter perfil importado. É o preço certo:
 * o sorteio balanceado é o que acontece hoje para TODO MUNDO, porque a
 * integração não existia.
 */

import { VALORES, type Grau, type Valor } from "./mapeamento";

/** Os quatro quadrantes do Instanooria (`apps/api/src/comum/insta/defaults.ts`). */
export const QUADRANTES = {
  abertura: ["selfDirection", "stimulation", "hedonism"],
  autotranscendencia: ["universalism", "benevolence"],
  autopromocao: ["achievement", "power"],
  conservacao: ["security", "conformity", "tradition"],
} as const satisfies Record<string, readonly Valor[]>;

export type Quadrante = keyof typeof QUADRANTES;

export const NOMES_DOS_QUADRANTES = Object.keys(QUADRANTES) as Quadrante[];

export type EscoresPorQuadrante = Record<Quadrante, number>;

export type ResultadoColapso =
  | { ok: true; escores: EscoresPorQuadrante }
  | { ok: false; motivo: "amostra-insuficiente" | "quadrante-sem-observacao"; detalhe: string };

/**
 * Um valor entra na média se foi OBSERVADO — `scored` (tem número) ou `zero`
 * (teve a chance e não foi). É a mesma regra do `polo()` que calcula os eixos do
 * circumplexo em `mapeamento.ts`, e por isso os dois concordam.
 *
 * O que NÃO se repete aqui é o mínimo de dois membros por polo do `polo()`.
 * Aquele mínimo existe porque o eixo é PUBLICADO com duas casas decimais, e com
 * um membro só ele diz sobre dois polos o que era a leitura de um valor
 * solitário. Aqui o número não é publicado — ele escolhe um lado de partida, e a
 * alternativa é um sorteio. Um quadrante sustentado por um valor é melhor
 * informação que uma moeda, e o `conservacao` quase sempre tem só um (Segurança
 * e Tradição têm uma fonte de medida cada, então param em `indicative`).
 */
function mediaObservada(
  valores: Record<string, unknown>,
  graus: Record<string, unknown>,
  membros: readonly Valor[],
): { valor: number; observados: number } {
  let soma = 0;
  let observados = 0;
  for (const v of membros) {
    const grau = graus[v];
    if (grau === "zero") {
      observados += 1;
      continue; // contribui 0, e é um zero de verdade
    }
    if (grau !== "scored") continue; // indicative | none | desconhecido: fora da conta
    const n = valores[v];
    if (typeof n !== "number") continue;
    soma += n / 100;
    observados += 1;
  }
  return { valor: observados === 0 ? 0 : soma / observados, observados };
}

/**
 * Colapsa um perfil da Vila nos quatro quadrantes.
 *
 * `amostraSuficiente` é pré-requisito: abaixo dele o próprio relatório do
 * professor se recusa a dizer qualquer coisa sobre a partida ("vale como uma
 * sessão de jogo, não como leitura"). Deixar esse perfil decidir o lado de um
 * debate — e virar linha num CSV — seria dizer pelas costas o que a tela se
 * recusa a dizer na frente.
 */
export function colapsarEmQuadrantes(
  valores: Record<string, unknown>,
  graus: Record<string, unknown>,
  amostraSuficiente: boolean,
): ResultadoColapso {
  if (!amostraSuficiente) {
    return {
      ok: false,
      motivo: "amostra-insuficiente",
      detalhe: "a partida foi curta demais para sustentar leitura",
    };
  }

  const escores = {} as EscoresPorQuadrante;
  const vazios: string[] = [];
  for (const quadrante of NOMES_DOS_QUADRANTES) {
    const { valor, observados } = mediaObservada(valores, graus, QUADRANTES[quadrante]);
    if (observados === 0) vazios.push(quadrante);
    escores[quadrante] = valor;
  }

  if (vazios.length > 0) {
    return {
      ok: false,
      motivo: "quadrante-sem-observacao",
      detalhe: `nenhum valor observado em: ${vazios.join(", ")}`,
    };
  }
  return { ok: true, escores };
}

/** Todos os dez valores estão em exatamente um quadrante — invariante do mapa.
 *  Exportado para o teste poder afirmar isso em vez de confiar na leitura. */
export function todosOsValoresMapeados(): boolean {
  const vistos = NOMES_DOS_QUADRANTES.flatMap((q) => QUADRANTES[q] as readonly Valor[]);
  return vistos.length === VALORES.length && new Set(vistos).size === VALORES.length;
}

export type { Grau };

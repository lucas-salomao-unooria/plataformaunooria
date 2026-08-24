import {
  DIVISOR_TESE,
  PERFIS,
  TAMANHO_LOTE_POSTS,
  type ModoNeutros,
  type Perfil,
} from '../comum/insta/defaults';
import type { Intensidade, LoteSpec } from '../comum/insta/tipos';

/**
 * Porte fiel de `lib/geracao/plano.ts` do origem — funções puras, sem banco e
 * sem IA. Só mudam os imports (`@/lib/insta/*` → `../comum/insta/*`) e as
 * guardas exigidas pelo `noUncheckedIndexedAccess` do monorepo.
 */

/** Configuração dos neutros gravada em `activities.proporcoes` (doc 06). */
export interface ConfigNeutros {
  ativo: boolean;
  modo: ModoNeutros;
  /** Fração sobre os posts de TESE, não sobre o total. */
  proporcao: number;
}

export interface Proporcoes {
  int: { i1: number; i2: number; i3: number };
  neutros: ConfigNeutros;
}

/** Categoria reservada do neutro DENTRO do tema (doc 06). */
export const CATEGORIA_NEUTRO_NO_TEMA = 'tema';

function dividirEmLotes(total: number, base: Omit<LoteSpec, 'quantidade'>): LoteSpec[] {
  const lotes: LoteSpec[] = [];
  let restante = total;
  while (restante > 0) {
    const quantidade = Math.min(TAMANHO_LOTE_POSTS, restante);
    lotes.push({ ...base, quantidade });
    restante -= quantidade;
  }
  return lotes;
}

/**
 * Reparte `total` em `partes` por **maior resto**, com desempate para o índice
 * MENOR.
 *
 * O desempate não é detalhe: com 50 posts numa célula, i2 e i3 empatam em 0,5, e
 * a unidade sobrando vai para a intensidade menor — a escolha segura para o
 * disfarce, coerente com "nunca int.3 no primeiro contato" (doc 05 §2).
 */
export function repartirPorMaiorResto(total: number, fracoes: number[]): number[] {
  const soma = fracoes.reduce((acumulado, fracao) => acumulado + fracao, 0) || 1;
  const exatos = fracoes.map((fracao) => (total * fracao) / soma);
  const base = exatos.map((valor) => Math.floor(valor));

  let sobra = total - base.reduce((acumulado, valor) => acumulado + valor, 0);
  const ordem = exatos
    .map((valor, indice) => ({ indice, resto: valor - Math.floor(valor) }))
    // Maior resto primeiro; empate ⇒ índice menor (intensidade menor).
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice);

  for (const { indice } of ordem) {
    if (sobra <= 0) break;
    // `?? 0` nunca dispara: `indice` sai de `exatos.map` (noUncheckedIndexedAccess).
    base[indice] = (base[indice] ?? 0) + 1;
    sobra -= 1;
  }
  return base;
}

/** Reparte `total` entre rótulos, sobra para os primeiros. */
function porRotulo(total: number, rotulos: string[], fallback: string): Map<string, number> {
  const mapa = new Map<string, number>();
  const lista = rotulos.length > 0 ? rotulos : [fallback];
  const fatias = repartirPorMaiorResto(total, lista.map(() => 1));

  lista.forEach((rotulo, indice) => {
    // `!`: repartirPorMaiorResto devolve exatamente `lista.length` fatias.
    if (fatias[indice]! > 0) mapa.set(rotulo, fatias[indice]!);
  });
  return mapa;
}

/** Quantos neutros gerar: múltiplo de 4 para fechar um por perfil (doc 05 §2). */
export function totalDeNeutros(qtdPostsTese: number, neutros: ConfigNeutros): number {
  if (!neutros.ativo) return 0;
  const bruto = qtdPostsTese * neutros.proporcao;
  return Math.round(bruto / PERFIS.length) * PERFIS.length;
}

/**
 * O servidor define o mix de cada lote (doc 05 §2): a IA só preenche.
 *
 * A matriz é **2 lados × 4 perfis × 3 intensidades = 24 células**. Um lote nunca
 * mistura perfis, porque o prompt precisa de uma ficha de linguagem por vez — é
 * essa separação que faz o mesmo argumento sair escrito de quatro maneiras.
 *
 * Devolve os lotes intercalados para o painel do professor mostrar conteúdo
 * variado desde o começo da geração.
 */
export function planejarLotes(opts: {
  qtdPostsTese: number;
  proporcoes: Proporcoes;
  categoriasNeutras: string[];
  neutrosNoTema: string[];
}): LoteSpec[] {
  const { qtdPostsTese, proporcoes, categoriasNeutras, neutrosNoTema } = opts;

  // ---------------------------------------------------------------- tese
  const porLado = Math.floor(qtdPostsTese / 2);
  const porCelula = Math.floor(porLado / PERFIS.length);

  const fracoesDeIntensidade = [proporcoes.int.i1, proporcoes.int.i2, proporcoes.int.i3];
  const intensidades: Intensidade[] = [1, 2, 3];

  const filasDeTese: LoteSpec[][] = [];
  for (const lado of ['A', 'B'] as const) {
    for (const perfil of PERFIS) {
      const fila: LoteSpec[] = [];
      const fatias = repartirPorMaiorResto(porCelula, fracoesDeIntensidade);
      intensidades.forEach((intensidade, indice) => {
        fila.push(
          // `!`: `fatias` tem exatamente 3 posições (uma por intensidade).
          ...dividirEmLotes(fatias[indice]!, {
            lado,
            perfil,
            intensidade,
            categoria: 'tema',
          }),
        );
      });
      filasDeTese.push(fila);
    }
  }

  // ------------------------------------------------------------- neutros
  const totalNeutro = totalDeNeutros(qtdPostsTese, proporcoes.neutros);
  const filasNeutras: LoteSpec[][] = [];

  if (totalNeutro > 0) {
    const modo = proporcoes.neutros.modo;
    /**
     * Em `ambos`, metade dentro do tema e metade fora — as duas famílias fazem
     * trabalhos diferentes: uma informa sem lado, a outra faz o feed parecer
     * rede social (doc 05 §1).
     */
    const [dentro, fora] =
      modo === 'ambos'
        ? (repartirPorMaiorResto(totalNeutro, [1, 1]) as [number, number])
        : modo === 'no_tema'
          ? [totalNeutro, 0]
          : [0, totalNeutro];

    const porPerfil = (total: number) => repartirPorMaiorResto(total, PERFIS.map(() => 1));

    // Neutro DENTRO do tema: categoria reservada, rótulo vai no prompt.
    const fatiasDentro = porPerfil(dentro);
    PERFIS.forEach((perfil, indice) => {
      const fila: LoteSpec[] = [];
      for (const [rotulo, quantidade] of porRotulo(
        fatiasDentro[indice]!,
        neutrosNoTema,
        'fatos e cronologia do tema',
      )) {
        fila.push(
          ...dividirEmLotes(quantidade, {
            lado: 'neutro',
            perfil,
            intensidade: 1,
            categoria: CATEGORIA_NEUTRO_NO_TEMA,
            recorteNeutro: rotulo,
          }),
        );
      }
      if (fila.length > 0) filasNeutras.push(fila);
    });

    // Neutro FORA do tema: a categoria é o próprio assunto.
    const fatiasFora = porPerfil(fora);
    PERFIS.forEach((perfil, indice) => {
      const fila: LoteSpec[] = [];
      for (const [categoria, quantidade] of porRotulo(
        fatiasFora[indice]!,
        categoriasNeutras,
        'curiosidades',
      )) {
        fila.push(...dividirEmLotes(quantidade, { lado: 'neutro', perfil, intensidade: 1, categoria }));
      }
      if (fila.length > 0) filasNeutras.push(fila);
    });
  }

  // Intercala todas as filas: o painel mostra variedade desde o primeiro lote.
  const filas = [...filasDeTese, ...filasNeutras];
  const intercalado: LoteSpec[] = [];
  const maior = Math.max(0, ...filas.map((fila) => fila.length));
  for (let i = 0; i < maior; i += 1) {
    for (const fila of filas) {
      const lote = fila[i];
      if (lote) intercalado.push(lote);
    }
  }
  return intercalado;
}

/** Quantas células a matriz tem, para as guardas de cobertura (doc 05 §4). */
export const TOTAL_DE_CELULAS = DIVISOR_TESE * 3;

export type { Perfil };

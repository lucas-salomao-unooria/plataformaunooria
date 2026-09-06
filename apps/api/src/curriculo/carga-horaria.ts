import type { Serie } from "../comum/series";

/**
 * Carga horária: quantas aulas por semana, quantas horas no ano, e quantas
 * aulas o professor tem de fato para planejar.
 *
 * TRÊS FATOS LEGAIS QUE O PRODUTO NÃO PODE ERRAR
 * ----------------------------------------------
 * 1. Hora-aula NÃO é hora-relógio. As 800h do EF e as 1.000h do EM são horas de
 *    60 minutos. O Parecer CNE/CEB 8/2004 é literal: "não se pode considerar
 *    uma aula de 45 minutos igual a uma hora […] a hora-aula está dentro da
 *    hora-relógio". Um plano que declare "200 aulas = 200 horas" está errado, e
 *    errado num documento que a coordenação arquiva.
 *
 * 2. O mínimo do Ensino Médio mudou. A Lei 14.945/2024 elevou a carga anual do
 *    EM de 800h para 1.000h (LDB art. 24, I) e — o que mais confunde — trocou o
 *    TETO de 1.800h da Formação Geral Básica, que a Lei 13.415/2017 impunha,
 *    por um PISO de 2.400h (LDB art. 35-C). O teto foi revogado. Quem
 *    dimensionar a FGB por 1.800h está usando norma revogada.
 *
 * 3. A BNCC não define grade horária. Nada aqui é obrigação nacional por
 *    componente: a lei fixa presença e obrigatoriedade, não quantidade. Estes
 *    números são a MEDIANA observada em nove redes públicas grandes, e existem
 *    para o professor não começar de uma tela vazia. A rede sobrescreve.
 */

/** Aula de 50 minutos é o padrão dominante (SP, MG, RS, PR, GO, PE, RJ). */
export const MINUTOS_POR_AULA_PADRAO = 50;
/** 200 dias letivos ÷ 5 dias por semana (LDB art. 24, I). */
export const SEMANAS_LETIVAS = 40;
export const DIAS_LETIVOS_MINIMOS = 200;

/** Horas-relógio mínimas por ano, por etapa (LDB art. 24, I, red. Lei 14.945/2024). */
export const HORAS_MINIMAS_ANUAIS = { EF: 800, EM: 1000 } as const;

/**
 * A matriz mediana: aulas semanais por componente e ano.
 *
 * Mediana de DEZ redes (SEDUC-SP, SME-SP, SEE-MG, SEDUC-RS, SEEDUC-RJ, SEED-PR,
 * SEDUC-GO, SEE-PE, SEDUC-CE, SME-Rio), com o Distrito Federal conferindo os
 * dois valores que ele publica (Língua Portuguesa e Matemática dos anos finais).
 *
 * NÃO EXISTE "A" MATRIZ MÉDIA — a jornada do Fundamental é BIMODAL
 * ---------------------------------------------------------------
 * O total semanal do EF não se distribui em torno de um centro: ele tem duas
 * famílias e nada no meio.
 *
 *   · 25 aulas → 833h/ano (≈ o mínimo legal de 800h): MG, RS, SME-Rio, PR, GO, PE
 *   · 28–30 aulas → 890–1.000h/ano: SP estadual, SME-SP, RJ, DF
 *
 * Uma "média" de 27,5 aulas produziria uma matriz que NENHUMA rede real usa. A
 * escolha entre 833h e 1.000h não é variação estatística: é decisão de política
 * de jornada, e as duas maiores redes do país estão na família de 1.000h.
 *
 * Por isso os números abaixo são o SUBTOTAL da base comum (26 aulas, nos anos
 * iniciais e nos finais), e não um total de semana. Quem fica em 25 aulas trima
 * exatamente uma do bloco — na prática Arte (MG, GO) ou o Ensino Religioso
 * (SME-Rio, PE) —, e quem vai a 30 acrescenta parte diversificada. O produto
 * pré-preenche o subtotal e deixa o professor ajustar: é ele que sabe em qual
 * das duas famílias a rede dele está.
 *
 * No ENSINO MÉDIO a convergência é real: nove das dez redes fazem 24 de Formação
 * Geral Básica + 6 de itinerário = 30 aulas = 1.000h, exatamente o mínimo do
 * art. 24, I. A exceção (São Paulo) só redistribui entre as séries, mantendo os
 * totais de 2.400h + 600h no triênio.
 */
const MATRIZ: Readonly<Record<string, Partial<Record<Serie, number>>>> = {
  "lingua-portuguesa": { "1EF": 6, "2EF": 6, "3EF": 6, "4EF": 6, "5EF": 6, "6EF": 5, "7EF": 5, "8EF": 5, "9EF": 5 },
  matematica: { "1EF": 6, "2EF": 6, "3EF": 6, "4EF": 6, "5EF": 6, "6EF": 5, "7EF": 5, "8EF": 5, "9EF": 5 },
  arte: { "1EF": 2, "2EF": 2, "3EF": 2, "4EF": 2, "5EF": 2, "6EF": 2, "7EF": 2, "8EF": 2, "9EF": 2 },
  "educacao-fisica": { "1EF": 2, "2EF": 2, "3EF": 2, "4EF": 2, "5EF": 2, "6EF": 2, "7EF": 2, "8EF": 2, "9EF": 2 },
  /**
   * Só do 6º ao 9º, e a ausência nos anos iniciais é deliberada: a LDB art. 26
   * §5º só exige inglês "a partir do sexto ano", e a BNCC não tem habilidade de
   * Língua Inglesa antes dele. Componente sem habilidade da Base não é
   * planejável num produto dirigido pela Base — ele entra na parte
   * diversificada, que é da rede.
   *
   * A mediana observada nos anos iniciais é 2 aulas (quatro das seis redes que
   * informam ofertam duas, incluindo as duas de São Paulo), mas essas aulas não
   * têm currículo comum a que se ancorar.
   */
  "lingua-inglesa": { "6EF": 2, "7EF": 2, "8EF": 2, "9EF": 2 },
  ciencias: { "1EF": 3, "2EF": 3, "3EF": 3, "4EF": 3, "5EF": 3, "6EF": 3, "7EF": 3, "8EF": 3, "9EF": 3 },
  geografia: { "1EF": 2, "2EF": 2, "3EF": 2, "4EF": 2, "5EF": 2, "6EF": 3, "7EF": 3, "8EF": 3, "9EF": 3 },
  historia: { "1EF": 2, "2EF": 2, "3EF": 2, "4EF": 2, "5EF": 2, "6EF": 3, "7EF": 3, "8EF": 3, "9EF": 3 },
  "ensino-religioso": { "1EF": 1, "2EF": 1, "3EF": 1, "4EF": 1, "5EF": 1, "6EF": 1, "7EF": 1, "8EF": 1, "9EF": 1 },

  "lingua-portuguesa-em": { "1EM": 4, "2EM": 4, "3EM": 4 },
  "matematica-em": { "1EM": 4, "2EM": 4, "3EM": 4 },
  "lingua-inglesa-em": { "1EM": 2, "2EM": 2, "3EM": 2 },
  "arte-em": { "1EM": 1, "2EM": 1, "3EM": 1 },
  "educacao-fisica-em": { "1EM": 1, "2EM": 1, "3EM": 1 },
  biologia: { "1EM": 2, "2EM": 2, "3EM": 2 },
  fisica: { "1EM": 2, "2EM": 2, "3EM": 2 },
  quimica: { "1EM": 2, "2EM": 2, "3EM": 2 },
  "geografia-em": { "1EM": 2, "2EM": 2, "3EM": 2 },
  "historia-em": { "1EM": 2, "2EM": 2, "3EM": 2 },
  filosofia: { "1EM": 1, "2EM": 1, "3EM": 1 },
  sociologia: { "1EM": 1, "2EM": 1, "3EM": 1 },
};

/**
 * Aulas semanais de referência. `null` quando a rede não oferta o componente
 * naquele ano — que é diferente de "zero aulas" e a tela precisa distinguir.
 */
export function aulasSemanaisDeReferencia(componente: string, ano: Serie): number | null {
  return MATRIZ[componente]?.[ano] ?? null;
}

/**
 * Hora-aula → hora-relógio. É a conta que o Parecer CNE/CEB 8/2004 exige:
 * `aulas × minutos × semanas ÷ 60`.
 */
export function horasRelogioNoAno(
  aulasSemanais: number,
  minutosPorAula = MINUTOS_POR_AULA_PADRAO,
  semanas = SEMANAS_LETIVAS,
): number {
  return Math.round(((aulasSemanais * minutosPorAula * semanas) / 60) * 10) / 10;
}

/**
 * Quantas aulas o professor realmente tem no ano — o número que dimensiona o
 * plano anual inteiro. Sem ele o plano distribui 40 habilidades em "quatro
 * bimestres" sem saber se cabem 200 aulas ou 40.
 */
export function aulasNoAno(aulasSemanais: number, semanas = SEMANAS_LETIVAS): number {
  return aulasSemanais * semanas;
}

/**
 * A divisão do ano em períodos de avaliação. Quatro bimestres é o mais comum
 * (SP, CE, SME-Rio); trimestres aparecem no RJ. Nenhuma norma nacional fixa
 * isso — o calendário é aprovado escola a escola.
 */
export const DIVISOES_DO_ANO = {
  bimestral: { periodos: 4, rotulo: "Bimestre", semanasPorPeriodo: 10 },
  trimestral: { periodos: 3, rotulo: "Trimestre", semanasPorPeriodo: 13 },
  semestral: { periodos: 2, rotulo: "Semestre", semanasPorPeriodo: 20 },
} as const;

export type DivisaoDoAno = keyof typeof DIVISOES_DO_ANO;

/**
 * Verifica se a carga declarada cumpre o mínimo legal da etapa, contando a
 * matriz INTEIRA da turma (não um componente). Serve de aviso na tela de
 * configuração: uma matriz que soma 780h no EF está abaixo das 800h da LDB, e é
 * melhor o professor descobrir isso aqui do que a rede descobrir na supervisão.
 */
export function cumpreMinimoLegal(
  totalDeAulasSemanais: number,
  etapa: "EF" | "EM",
  minutosPorAula = MINUTOS_POR_AULA_PADRAO,
): { horas: number; minimo: number; cumpre: boolean } {
  const horas = horasRelogioNoAno(totalDeAulasSemanais, minutosPorAula);
  const minimo = HORAS_MINIMAS_ANUAIS[etapa];
  return { horas, minimo, cumpre: horas >= minimo };
}

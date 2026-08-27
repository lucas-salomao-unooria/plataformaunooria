import { CONJUNTO_POR_SLUG } from '../modelo/conjuntos';

/**
 * Por que cada equipe vai para onde vai. PURO.
 *
 * Vem do board: "justificar cada escolha com uma evidência do caderno — é aqui
 * que o letramento acontece". Hoje o aluno manda a Alfa para a Ribeirinha e
 * pronto: ninguém, nem ele nem o professor, sabe se ele olhou algum dado ou
 * chutou. É a pergunta que separa uma decisão de um palpite, e ela é feita uma
 * vez, na hora de enviar.
 *
 * Três coisas que este módulo garante:
 *
 * 1. A lista só oferece o que o aluno JÁ CARREGOU. Mostrar a fonte que ele não
 *    consultou seria dizer, pela interface, o que ele deveria ter olhado — o
 *    painel de fontes que o ADR-0009 recusou, entrando pela porta dos fundos.
 * 2. "Foi intuição" está SEMPRE disponível. O board é explícito: erro vira
 *    aprendizado, não punição. Sem essa saída, a pergunta vira pegadinha e o
 *    aluno aprende a mentir para o formulário.
 * 3. O software não julga a resposta. Não existe justificativa certa aqui —
 *    quem lê é o professor, e quem dá a lição é ele (regra de ouro 2).
 */
export const INTUICAO = 'intuicao';

export const ROTULO_INTUICAO = 'Foi intuição, não olhei dado';

export interface OpcaoDeJustificativa {
  valor: string;
  rotulo: string;
}

/** O que o aluno pode escolher: as fontes que ele abriu, mais a intuição. */
export function opcoesDeJustificativa(
  conjuntosCarregados: readonly string[],
): OpcaoDeJustificativa[] {
  const fontes = conjuntosCarregados
    .map((slug) => {
      const c = CONJUNTO_POR_SLUG.get(slug);
      return c ? { valor: c.slug, rotulo: c.rotuloCurto } : null;
    })
    .filter((x): x is OpcaoDeJustificativa => x !== null);
  return [...fontes, { valor: INTUICAO, rotulo: ROTULO_INTUICAO }];
}

/** Vale como justificativa? Fonte não carregada, não. */
export function justificativaValida(
  valor: string | null | undefined,
  conjuntosCarregados: readonly string[],
): boolean {
  if (!valor) return false;
  if (valor === INTUICAO) return true;
  return conjuntosCarregados.includes(valor);
}

/**
 * Quais equipes têm destino e ainda não têm por quê.
 *
 * Equipe que fica na base não precisa justificar: não há escolha de lugar para
 * explicar. Enviar com uma equipe parada continua permitido.
 */
export function faltaJustificar(
  alocacao: { alfa: string | null; bravo: string | null },
  justificativas: { alfa: string | null; bravo: string | null },
  conjuntosCarregados: readonly string[],
): ('alfa' | 'bravo')[] {
  return (['alfa', 'bravo'] as const).filter(
    (equipe) =>
      alocacao[equipe] !== null &&
      !justificativaValida(justificativas[equipe], conjuntosCarregados),
  );
}

/** Texto fixo do portão. Aparece ao lado do botão que não liberou. */
export const AVISO_FALTA_JUSTIFICAR = 'Falta dizer por que cada equipe vai para lá.';

/** Como o painel do professor lê a justificativa gravada. */
export function comoOProfessorLe(valor: string | null): string {
  if (!valor) return 'não disse';
  if (valor === INTUICAO) return 'intuição, sem dado';
  return CONJUNTO_POR_SLUG.get(valor)?.rotuloCurto ?? valor;
}

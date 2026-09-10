/**
 * Os textos e rótulos da tela, e as regras que só servem para HABILITAR botão.
 *
 * A fronteira que este arquivo respeita: aqui entra o que o estudante JÁ LÊ na tela
 * — nome de bairro, rótulo de fonte, aviso de portão. O que fica de fora é todo
 * o resto do catálogo de fontes da api (`modelo/conjuntos.ts`): `instrucao` (a
 * instrução de VIÉS que cada fonte injeta no Cientista), `vies` (o multiplicador
 * por bairro) e `cobertura`. Esses três são o instrumento, e são o material do
 * debate do professor — se algum deles aparecer aqui, a missão perdeu o ponto.
 *
 * Por isso este arquivo tem os 8 rótulos e NÃO importa o catálogo: um `import`
 * do objeto inteiro traria os campos secretos para o bundle mesmo que nenhuma
 * linha os usasse.
 */

/** Os 4 bairros. Nome público — o estudante lê em toda tela. */
export const NOMES_DOS_BAIRROS: Record<string, string> = {
  ribeirinha: "Ribeirinha",
  valeverde: "Vale Verde",
  morroalto: "Morro Alto",
  industrial: "Industrial",
};

export function nomeDoBairro(slug: string | null | undefined): string {
  if (!slug) return "—";
  return NOMES_DOS_BAIRROS[slug] ?? slug;
}

/**
 * As 8 fontes, pelo rótulo curto — o mesmo que a api usa em `rotuloCurto`.
 *
 * É duplicação deliberada e mínima: são as palavras que o estudante vê no cartão
 * ("Depois de somar cadastro de moradores:"), e trazê-las pelo payload
 * obrigaria a api a mandar o catálogo em toda resposta de turno.
 */
export const ROTULO_DA_FONTE: Record<string, string> = {
  ocorrencias: "registros dos bombeiros",
  sensores: "medições do rio",
  censo: "cadastro de moradores",
  previsao: "previsão do tempo",
  satelite: "imagens de satélite",
  telefonia: "sinal de celular",
  viaria: "mapa de estradas",
  estudo: "estudo de campo",
};

export function rotuloDaFonte(slug: string | null | undefined): string {
  if (!slug) return "—";
  return ROTULO_DA_FONTE[slug] ?? slug;
}

/**
 * Ponte de compatibilidade com o código portado, que chamava
 * `CONJUNTO_POR_SLUG.get(f)?.rotuloCurto`. Só o rótulo — nada mais do conjunto
 * existe deste lado.
 */
export const CONJUNTO_POR_SLUG = {
  get(slug: string): { rotuloCurto: string } | undefined {
    const rotulo = ROTULO_DA_FONTE[slug];
    return rotulo ? { rotuloCurto: rotulo } : undefined;
  },
};

/** Espelho de `regras/orcamento.ts`. Quem DEBITA é a api; aqui é só o contador. */
export const TETO_DE_PERGUNTAS = 3;

export function perguntasRestantes(gastas: number): number {
  return Math.max(0, TETO_DE_PERGUNTAS - gastas);
}

export function rotuloDoOrcamento(gastas: number): string {
  const faltam = perguntasRestantes(gastas);
  if (faltam === 0) return "Perguntas: acabaram";
  return `Perguntas: ${faltam} de ${TETO_DE_PERGUNTAS}`;
}

/**
 * O campo NÃO fecha quando as perguntas acabam: o estudante ainda precisa dizer
 * para onde vai cada equipe, e fechar a conversa aqui o deixaria com uma
 * decisão para tomar e nenhuma forma de tomá-la. O que acabou é a investigação.
 */
export const AVISO_SEM_PERGUNTAS =
  "Suas 3 perguntas acabaram. Você ainda pode mandar as equipes — diga para onde vai cada uma, ou escolha no mapa.";

/** Espelho de `regras/justificativa.ts`. */
export const INTUICAO = "intuicao";
export const ROTULO_INTUICAO = "Foi intuição, não olhei dado";
export const AVISO_FALTA_JUSTIFICAR = "Falta dizer por que cada equipe vai para lá.";

/**
 * Quais equipes têm destino e ainda não têm por quê.
 *
 * Isto existe no cliente para HABILITAR o botão, e no servidor para DECIDIR: o
 * portão de verdade é `POST /unoogpt/simular`, que recusa com
 * `falta-justificar`. Um cliente adulterado não passa por aqui — passa pelo
 * servidor, e lá não passa.
 *
 * Equipe que fica na base não precisa justificar: não há escolha de lugar para
 * explicar.
 */
export function faltaJustificar(
  alocacao: { alfa: string | null; bravo: string | null },
  justificativas: { alfa: string | null; bravo: string | null },
): ("alfa" | "bravo")[] {
  return (["alfa", "bravo"] as const).filter(
    (equipe) => alocacao[equipe] !== null && !justificativas[equipe],
  );
}

/** Espelho de `regras/passos.ts`. */
export const ROTULO_PASSO: Record<string, string> = {
  abertura: "A missão",
  orientacao: "Orientação",
  investigacao: "Investigação",
  resultado: "Resultado",
};

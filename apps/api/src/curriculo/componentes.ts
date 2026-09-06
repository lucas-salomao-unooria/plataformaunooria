import { SERIES, type Serie } from "../comum/series";
import type { ComponenteCurricular, TipoDeOrganizador } from "./tipos";

/**
 * O catálogo de componentes curriculares da matriz de uma rede pública, do 1º
 * ano do EF à 3ª série do EM.
 *
 * ESTE ARQUIVO É CURADO À MÃO, e de propósito: ele não sai da BNCC, porque a
 * BNCC não tem matriz curricular. Ela lista áreas, componentes e habilidades e
 * para aí. Quem decide "quais componentes, em que ano" é a rede — LDB art. 23 e
 * art. 26, e Resolução CNE/CP 2/2017 art. 8º, II, que atribui ao currículo
 * "decidir sobre formas de organização dos componentes curriculares". O Parecer
 * CNE/CEB 8/2004 é explícito: "o total do número de horas destinado a cada
 * disciplina também é de competência do projeto pedagógico".
 *
 * O que está aqui, então, é o DEFAULT do produto: a matriz mediana observada em
 * nove redes estaduais e municipais grandes (SP, MG, RS, RJ, PR, GO, PE, CE,
 * SME-Rio). É ponto de partida editável pela rede, nunca uma afirmação de que a
 * lei manda assim — e as amarras que a lei REALMENTE impõe estão marcadas em
 * cada componente.
 */

const ANOS_INICIAIS: readonly Serie[] = ["1EF", "2EF", "3EF", "4EF", "5EF"];
const ANOS_FINAIS: readonly Serie[] = ["6EF", "7EF", "8EF", "9EF"];
const TODO_EF: readonly Serie[] = [...ANOS_INICIAIS, ...ANOS_FINAIS];
const TODO_EM: readonly Serie[] = ["1EM", "2EM", "3EM"];

/**
 * As áreas do conhecimento. Cinco no EF (Res. CNE/CP 2/2017 art. 14), quatro no
 * EM (LDB art. 35-D, redação da Lei 14.945/2024) — Ensino Religioso não existe
 * no EM, porque a LDB art. 33 o restringe ao ensino fundamental.
 */
export const AREAS: ReadonlyArray<{ slug: string; rotulo: string; rotuloEm?: string }> = [
  { slug: "linguagens", rotulo: "Linguagens", rotuloEm: "Linguagens e suas Tecnologias" },
  { slug: "matematica", rotulo: "Matemática", rotuloEm: "Matemática e suas Tecnologias" },
  {
    slug: "ciencias-da-natureza",
    rotulo: "Ciências da Natureza",
    rotuloEm: "Ciências da Natureza e suas Tecnologias",
  },
  {
    slug: "ciencias-humanas",
    rotulo: "Ciências Humanas",
    rotuloEm: "Ciências Humanas e Sociais Aplicadas",
  },
  { slug: "ensino-religioso", rotulo: "Ensino Religioso" },
  { slug: "computacao", rotulo: "Computação" },
];

/**
 * Os componentes. Note o `componenteBncc` de cada um do Ensino Médio: é ali que
 * mora a diferença que faz o produto funcionar para o professor de Biologia.
 *
 * No EF, componente e origem das habilidades coincidem — "História" tem
 * habilidades `EF__HI__`. No EM não: a BNCC do EM só desce até a ÁREA, então
 * Biologia, Física e Química leem as habilidades de `ciencias-da-natureza`
 * (`EM13CNT___`), e Filosofia, Geografia, História e Sociologia leem as de
 * `ciencias-humanas` (`EM13CHS___`). As duas exceções são Língua Portuguesa e
 * Matemática, os únicos componentes que a BNCC do EM nomeia — `EM13LP__` e
 * `EM13MAT___`.
 */
export const COMPONENTES: readonly ComponenteCurricular[] = [
  // ---------------------------------------------------- Ensino Fundamental
  {
    slug: "lingua-portuguesa",
    rotulo: "Língua Portuguesa",
    area: "linguagens",
    componenteBncc: "lingua-portuguesa",
    anos: TODO_EF,
  },
  {
    slug: "arte",
    rotulo: "Arte",
    area: "linguagens",
    componenteBncc: "arte",
    anos: TODO_EF,
    observacao:
      "Componente obrigatório da educação básica (LDB art. 26 §2º). As quatro linguagens — artes visuais, dança, música e teatro — são obrigatórias (LDB art. 26 §6º).",
  },
  {
    slug: "educacao-fisica",
    rotulo: "Educação Física",
    area: "linguagens",
    componenteBncc: "educacao-fisica",
    anos: TODO_EF,
    observacao:
      "Obrigatória; a PRÁTICA é facultativa nas hipóteses da LDB art. 26 §3º (jornada de trabalho ≥ 6h, maior de 30 anos, serviço militar, prole).",
  },
  {
    slug: "lingua-inglesa",
    rotulo: "Língua Inglesa",
    area: "linguagens",
    componenteBncc: "lingua-inglesa",
    // A BNCC só tem habilidades de Língua Inglesa do 6º ao 9º: a LDB art. 26
    // §5º a torna obrigatória "a partir do sexto ano". Metade das redes
    // grandes oferta inglês nos anos iniciais como parte diversificada, mas
    // sem habilidade da Base para ancorar — então o componente começa no 6º.
    anos: ANOS_FINAIS,
    observacao: "Obrigatória a partir do 6º ano (LDB art. 26 §5º).",
  },
  {
    slug: "matematica",
    rotulo: "Matemática",
    area: "matematica",
    componenteBncc: "matematica",
    anos: TODO_EF,
  },
  {
    slug: "ciencias",
    rotulo: "Ciências",
    area: "ciencias-da-natureza",
    componenteBncc: "ciencias",
    anos: TODO_EF,
  },
  {
    slug: "geografia",
    rotulo: "Geografia",
    area: "ciencias-humanas",
    componenteBncc: "geografia",
    anos: TODO_EF,
  },
  {
    slug: "historia",
    rotulo: "História",
    area: "ciencias-humanas",
    componenteBncc: "historia",
    anos: TODO_EF,
  },
  {
    slug: "ensino-religioso",
    rotulo: "Ensino Religioso",
    area: "ensino-religioso",
    componenteBncc: "ensino-religioso",
    anos: TODO_EF,
    opcional: true,
    observacao:
      "Oferta obrigatória pela escola, MATRÍCULA FACULTATIVA ao estudante, e só no ensino fundamental público (LDB art. 33). Vedado o proselitismo.",
  },

  // ---------------------------------------------------------- Ensino Médio
  {
    slug: "lingua-portuguesa-em",
    rotulo: "Língua Portuguesa e suas Literaturas",
    area: "linguagens",
    componenteBncc: "lingua-portuguesa",
    anos: TODO_EM,
    observacao: "Componente obrigatório da Formação Geral Básica (LDB art. 35-D, I).",
  },
  {
    slug: "lingua-inglesa-em",
    rotulo: "Língua Inglesa",
    area: "linguagens",
    componenteBncc: "linguagens",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao:
      "Obrigatória (LDB art. 35-D, I). A BNCC do EM não tem habilidades de Língua Inglesa: as habilidades são da área de Linguagens e suas Tecnologias.",
  },
  {
    slug: "arte-em",
    rotulo: "Arte",
    area: "linguagens",
    componenteBncc: "linguagens",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao:
      "Obrigatória (LDB art. 35-D, I), observadas as quatro linguagens (Res. CNE/CEB 2/2024 art. 17 §7º).",
  },
  {
    slug: "educacao-fisica-em",
    rotulo: "Educação Física",
    area: "linguagens",
    componenteBncc: "linguagens",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao: "Obrigatória (LDB art. 35-D, I).",
  },
  {
    slug: "matematica-em",
    rotulo: "Matemática",
    area: "matematica",
    componenteBncc: "matematica",
    anos: TODO_EM,
    observacao: "Componente obrigatório da Formação Geral Básica (LDB art. 35-D, II).",
  },
  {
    slug: "biologia",
    rotulo: "Biologia",
    area: "ciencias-da-natureza",
    componenteBncc: "ciencias-da-natureza",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao:
      "Obrigatória (LDB art. 35-D, III). As habilidades são da área de Ciências da Natureza e suas Tecnologias, compartilhadas com Física e Química.",
  },
  {
    slug: "fisica",
    rotulo: "Física",
    area: "ciencias-da-natureza",
    componenteBncc: "ciencias-da-natureza",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao:
      "Obrigatória (LDB art. 35-D, III). Habilidades da área, compartilhadas com Biologia e Química.",
  },
  {
    slug: "quimica",
    rotulo: "Química",
    area: "ciencias-da-natureza",
    componenteBncc: "ciencias-da-natureza",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao:
      "Obrigatória (LDB art. 35-D, III). Habilidades da área, compartilhadas com Biologia e Física.",
  },
  {
    slug: "filosofia",
    rotulo: "Filosofia",
    area: "ciencias-humanas",
    componenteBncc: "ciencias-humanas",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao:
      "Obrigatória (LDB art. 35-D, IV). Habilidades da área de Ciências Humanas e Sociais Aplicadas, compartilhadas com Geografia, História e Sociologia.",
  },
  {
    slug: "geografia-em",
    rotulo: "Geografia",
    area: "ciencias-humanas",
    componenteBncc: "ciencias-humanas",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao: "Obrigatória (LDB art. 35-D, IV). Habilidades da área.",
  },
  {
    slug: "historia-em",
    rotulo: "História",
    area: "ciencias-humanas",
    componenteBncc: "ciencias-humanas",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao: "Obrigatória (LDB art. 35-D, IV). Habilidades da área.",
  },
  {
    slug: "sociologia",
    rotulo: "Sociologia",
    area: "ciencias-humanas",
    componenteBncc: "ciencias-humanas",
    anos: TODO_EM,
    habilidadesPorArea: true,
    observacao: "Obrigatória (LDB art. 35-D, IV). Habilidades da área.",
  },

  // ------------------------------------------------- transversal às etapas
  {
    slug: "computacao",
    rotulo: "Computação",
    area: "computacao",
    componenteBncc: "computacao",
    anos: [...TODO_EF, ...TODO_EM],
    observacao:
      "Complemento à BNCC (Resolução CNE/CEB 1/2022). NÃO é componente isolado: a norma delega às redes definir os 'parâmetros e abordagens pedagógicas' (art. 2º), e a educação digital é componente do EF e do EM por força da LDB art. 26 §11 (Lei 14.533/2023). No produto ela entra como camada TRANSVERSAL sobre qualquer componente.",
  },
];

/**
 * Computação é o único componente que o professor não escolhe como "a sua
 * disciplina", e sim adiciona por cima dela. Foi o pedido de origem do produto,
 * e é o que a Resolução CNE/CEB 1/2022 permite ao delegar a abordagem à rede.
 */
export const COMPONENTES_TRANSVERSAIS = ["computacao"] as const;

const PELO_SLUG = new Map(COMPONENTES.map((c) => [c.slug, c]));

export function componentePorSlug(slug: string): ComponenteCurricular | null {
  return PELO_SLUG.get(slug) ?? null;
}

/** Os componentes que a rede oferta naquele ano, na ordem da matriz. */
export function componentesDoAno(ano: string): readonly ComponenteCurricular[] {
  return COMPONENTES.filter(
    (c) => c.anos.includes(ano) && !COMPONENTES_TRANSVERSAIS.includes(c.slug as "computacao"),
  );
}

/**
 * Como chamar, na tela, o organizador acima do objeto de conhecimento. A BNCC
 * usa três nomes diferentes e chamar tudo de "unidade temática" faz o professor
 * de Língua Portuguesa não reconhecer o próprio currículo: para ele aquilo é
 * prática de linguagem, dentro de um campo de atuação.
 */
export function tipoDeOrganizador(componenteBncc: string, etapa: "EF" | "EM"): TipoDeOrganizador {
  if (etapa === "EM") return "competencia";
  if (componenteBncc === "lingua-portuguesa") return "pratica-de-linguagem";
  if (componenteBncc === "lingua-inglesa" || componenteBncc === "computacao") return "eixo";
  return "unidade-tematica";
}

export function rotuloDoOrganizador(tipo: TipoDeOrganizador): string {
  switch (tipo) {
    case "pratica-de-linguagem":
      return "Prática de linguagem";
    case "eixo":
      return "Eixo";
    case "competencia":
      return "Competência específica da área";
    default:
      return "Unidade temática";
  }
}

/** Guarda de sanidade: todo componente aponta para anos que existem. */
export function anosInvalidos(): string[] {
  const validos = new Set<string>(SERIES);
  return COMPONENTES.flatMap((c) => c.anos.filter((a) => !validos.has(a as Serie)));
}

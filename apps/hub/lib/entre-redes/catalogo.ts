/**
 * Catálogo do **Entre Redes** — o produto de letramento digital da Unooria.
 *
 * O Entre Redes é uma trilha, não uma atividade solta: cada ano do Ensino
 * Fundamental (Anos Finais) tem **4 unidades**, e cada unidade é uma **missão**.
 * Hoje só uma missão existe de fato — 8º ano · Unidade 1, a bolha de filtro
 * dentro do Instanooria. As demais aparecem na trilha como "Em breve" porque a
 * grade é a informação: o professor precisa enxergar onde a missão dele mora.
 *
 * Este arquivo é a fonte da verdade da trilha. Ele descreve o CATÁLOGO
 * (o que a Unooria oferece); as **atividades** que o professor cria a partir de
 * uma missão são instâncias no banco (`activities`), com rota própria em
 * `/professor/atividades/**`.
 *
 * NOTA DE MODELAGEM: enquanto existir uma única missão COM ATIVIDADES, toda
 * atividade pertence a `MISSAO_ATUAL` por construção — por isso `activities`
 * ainda não tem coluna `missao`. Missões sem `activities` (o UnooTube do 4º
 * ano: conteúdo fixo, resultados em tabela própria da api) não mudam isso.
 * Quando a segunda missão configurável entrar, o caminho é adicionar essa
 * coluna (default = slug da missão atual) e filtrar as listagens por ela; os
 * pontos que hoje assumem a missão única estão marcados com `MISSAO_ATUAL`.
 */

export type StatusMissao = "disponivel" | "em-breve";

/** Um ato do roteiro da missão, como o professor precisa entender. */
export type AtoDaMissao = {
  rotulo: string;
  texto: string;
};

/** Ficha pedagógica — só existe em missão publicada. */
export type FichaDaMissao = {
  /** O que a missão trabalha, em uma linha. */
  competencia: string;
  /** Tempo de aula previsto. */
  duracao: string;
  /** Como a missão se apresenta ao aluno. */
  formato: string;
  atos: AtoDaMissao[];
  /** O que o professor faz antes de rodar com a turma. */
  preparo: string[];
};

export type Missao = {
  anoSlug: string;
  unidadeSlug: string;
  unidade: number;
  /**
   * Id da experiência do aluno (`apps/experiencias/<expId>`): a chave que liga
   * catálogo, manifesto `experiencias` e `/exp/:expId`. Só em missão disponível.
   */
  expId?: string;
  titulo: string;
  resumo: string;
  status: StatusMissao;
  /** Presente apenas quando `status === 'disponivel'`. */
  ficha?: FichaDaMissao;
};

export type Ano = {
  slug: string;
  rotulo: string;
  etapa: string;
  missoes: Missao[];
};

/** Toda unidade tem o mesmo slug em qualquer ano: unidade-1…unidade-4. */
export const UNIDADES_POR_ANO = 4;

function unidadeSlug(unidade: number): string {
  return `unidade-${unidade}`;
}

/**
 * Preenche as unidades que ainda não têm conteúdo. Sem título inventado: a
 * trilha mostra a lacuna honestamente, em vez de prometer uma missão que não
 * existe.
 */
function unidadesEmBreve(anoSlug: string, exceto: number[] = []): Missao[] {
  const unidades: Missao[] = [];
  for (let unidade = 1; unidade <= UNIDADES_POR_ANO; unidade += 1) {
    if (exceto.includes(unidade)) continue;
    unidades.push({
      anoSlug,
      unidadeSlug: unidadeSlug(unidade),
      unidade,
      titulo: `Unidade ${unidade}`,
      resumo: "Missão em produção.",
      status: "em-breve",
    });
  }
  return unidades;
}

/**
 * A missão que existe hoje: o Instanooria, a bolha de filtro do 8º ano.
 * É a única com ficha, guia e atividades configuráveis.
 */
export const MISSAO_ATUAL: Missao = {
  anoSlug: "8-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp-01-instanooria",
  titulo: "O Conteúdo que não chegou",
  resumo:
    "O aluno investiga uma pergunta do seu conteúdo dentro de uma rede social — e só na revelação final descobre que o feed dele foi montado para puxá-lo para um dos lados.",
  status: "disponivel",
  ficha: {
    competencia:
      "Letramento digital — como um feed decide o que cada pessoa vê, e o que isso faz com uma opinião em formação.",
    duracao: "2 aulas (100 min) no app, mais o jogo do Ato 1",
    formato: "Dois atos: um jogo fora da plataforma e uma missão dentro do app",
    atos: [
      {
        rotulo: "Ato 1 — o jogo",
        texto:
          "Fora da plataforma, um jogo mede o perfil de valores do aluno. No momento em que joga, nada liga o jogo à missão — e é essa desconexão que faz a revelação funcionar.",
      },
      {
        rotulo: "Ato 2 — a missão",
        texto:
          "Você informa o tema da sua disciplina; a IA propõe a pergunta-chave, você valida, e o banco de posts nasce com o mesmo argumento escrito em quatro linguagens. O feed de cada aluno já começa puxado para um lado — e o motor fecha a bolha pela rolagem.",
      },
      {
        rotulo: "Fechamento",
        texto:
          "O aluno escreve a própria conclusão, recebe a revelação, lê o relatório do que o feed fez com ele e vê a comparação lado a lado com a turma.",
      },
    ],
    preparo: [
      "Criar a atividade a partir do tema e do recorte da sua disciplina.",
      "Escolher (ou reescrever) a pergunta-chave que a IA propõe.",
      "Validar os dois lados destilados e a tabela de afinidade.",
      "Revisar os posts gerados na visão de matriz e ativar a atividade.",
    ],
  },
};

/**
 * 4º ano · Unidade 1 — o UnooTube: fontes confiáveis vs. sensacionalismo num
 * clone do YouTube Shorts. Sem atividades configuráveis: o conteúdo é fixo (21
 * vídeos de História), o professor só entra com a turma e lê os resultados.
 */
export const MISSAO_UNOOTUBE: Missao = {
  anoSlug: "4-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp-02-unootube",
  titulo: "UnooTube — Em quais fontes você confiaria?",
  resumo:
    "Num feed de vídeos curtos sobre História, o aluno salva as 3 fontes em que confiaria. Quem escolhe sensacionalismo ganha mais inscritos — até a turma descobrir que popularidade não é credibilidade.",
  status: "disponivel",
  ficha: {
    competencia:
      "Letramento digital — distinguir fontes confiáveis de conteúdo sensacionalista em vídeos curtos, e perceber que inscritos não medem verdade.",
    duracao: "1 aula (50 min)",
    formato: "Clone do YouTube Shorts com 21 vídeos de História (Grandes Navegações, escrita, arqueologia)",
    atos: [
      {
        rotulo: "1 — Explorar o feed",
        texto:
          "O aluno assiste aos Shorts e salva até 3 vídeos que pareçam contar uma história confiável. Metade cita fonte verificável e tem poucos inscritos; a outra metade é sensacionalista e tem '1 mil inscritos'.",
      },
      {
        rotulo: "2 — Ranking por inscritos",
        texto:
          "Ao 3º salvo, o ranking da turma abre ordenado por inscritos — e quem escolheu fake aparece no topo. O aluno se vê perdendo por ter acertado.",
      },
      {
        rotulo: "3 — Adicionar credibilidade",
        texto:
          "Um botão revela a coluna 'fontes confiáveis' e a métrica vira. A frase que fica: ter muitos inscritos não significa contar a verdade.",
      },
    ],
    preparo: [
      "Conferir som ou fones: os vídeos começam mudos e o aluno liga o som.",
      "Avisar que a pesquisa do app está bloqueada durante a missão — é de propósito.",
      "Nada a configurar: é só entrar com a turma e acompanhar os resultados aqui.",
    ],
  },
};

export const ANOS: Ano[] = [
  {
    slug: "4-ano",
    rotulo: "4º ano",
    etapa: "Ensino Fundamental — Anos Iniciais",
    missoes: [MISSAO_UNOOTUBE, ...unidadesEmBreve("4-ano", [1])].sort(
      (a, b) => a.unidade - b.unidade,
    ),
  },
  {
    slug: "6-ano",
    rotulo: "6º ano",
    etapa: "Ensino Fundamental — Anos Finais",
    missoes: unidadesEmBreve("6-ano"),
  },
  {
    slug: "7-ano",
    rotulo: "7º ano",
    etapa: "Ensino Fundamental — Anos Finais",
    missoes: unidadesEmBreve("7-ano"),
  },
  {
    slug: "8-ano",
    rotulo: "8º ano",
    etapa: "Ensino Fundamental — Anos Finais",
    missoes: [MISSAO_ATUAL, ...unidadesEmBreve("8-ano", [1])].sort(
      (a, b) => a.unidade - b.unidade,
    ),
  },
  {
    slug: "9-ano",
    rotulo: "9º ano",
    etapa: "Ensino Fundamental — Anos Finais",
    missoes: unidadesEmBreve("9-ano"),
  },
];

export function buscarAno(anoSlug: string): Ano | null {
  return ANOS.find((ano) => ano.slug === anoSlug) ?? null;
}

export function buscarMissao(
  anoSlug: string,
  unidadeSlug: string,
): { ano: Ano; missao: Missao } | null {
  const ano = buscarAno(anoSlug);
  if (!ano) return null;
  const missao = ano.missoes.find((m) => m.unidadeSlug === unidadeSlug);
  return missao ? { ano, missao } : null;
}

/** Quantas missões estão de fato jogáveis hoje (rótulo do card do produto). */
export const MISSOES_DISPONIVEIS = ANOS.flatMap((ano) => ano.missoes).filter(
  (missao) => missao.status === "disponivel",
);

export function rotaDaMissao(missao: Missao): string {
  return `/professor/entre-redes/${missao.anoSlug}/${missao.unidadeSlug}`;
}

export function rotaDoGuia(missao: Missao): string {
  return `${rotaDaMissao(missao)}/guia`;
}

/** Rótulo curto usado em breadcrumb e cabeçalhos: "8º ano · Unidade 1". */
export function rotuloDaMissao(ano: Ano, missao: Missao): string {
  return `${ano.rotulo} · Unidade ${missao.unidade}`;
}

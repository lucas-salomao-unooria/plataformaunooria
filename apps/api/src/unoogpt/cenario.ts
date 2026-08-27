export interface Bairro {
  slug: string;
  nome: string;
  pop: number;
  /** Pessoas que não conseguem se proteger sozinhas. */
  vuln: number;
  /** Chance de alagamento em %. */
  alag: number;
  granizo: 'Moderado' | 'Alto' | 'Severo';
  /** Expostos se nada for feito. */
  exp: number;
  /** Vulneráveis entre os expostos. */
  vexp: number;
  /** Danos estimados, em milhões de reais. */
  danos: number;
  /** Minutos da base da Equipe Alfa (norte) e Bravo (sul). */
  tA: number;
  tB: number;
  equipamentos: string;
  via: string;
  /** Posição no mapa, em % do container. */
  left: string;
  top: string;
  w: string;
  h: string;
}

export interface MissaoAutorada {
  slug: string;
  titulo: string;
  chamada: string;
  contexto: string;
  equipes: { id: string; nome: string; base: string; descricao: string }[];
  bairros: Bairro[];
  /** Totais da ficha. Um lugar só: nenhuma tela recalcula. */
  totais: { populacao: number; expostos: number; vulneraveis: number; danosMi: number };
}

/**
 * Ficha canônica de Serra do Sauá (ADR-0005). TODO número da Investigação sai
 * daqui e é calculado num lugar só — nenhuma tela recalcula, a LLM nunca
 * inventa. Conteúdo autorado e versionado.
 *
 * São QUATRO bairros, e cada um carrega uma lição que os outros não têm: o
 * Morro Alto é onde as fontes se contradizem, a Ribeirinha é profundidade sem
 * largura, o Industrial é perto e pequeno com proxy errado, o Vale Verde é a
 * régua limpa — nenhum conjunto o distorce. O Centro e o Jardim das Flores
 * saíram porque diziam a mesma coisa um do outro ("esta fonte infla este
 * bairro") e diluíam a leitura em seis linhas de tabela.
 */
const BAIRROS: Bairro[] = [
  {
    slug: 'ribeirinha',
    nome: 'Ribeirinha',
    pop: 6900,
    vuln: 2150,
    alag: 82,
    granizo: 'Alto',
    exp: 3100,
    vexp: 1760,
    danos: 3.4,
    tA: 41,
    tB: 12,
    equipamentos: '1 escola · 1 abrigo em cota alagável',
    via: 'Ponte do Sauá — intransitável a partir das 17h20',
    left: '3%',
    top: '56%',
    w: '38%',
    h: '13%',
  },
  {
    slug: 'valeverde',
    nome: 'Vale Verde',
    pop: 9200,
    vuln: 980,
    alag: 46,
    granizo: 'Alto',
    exp: 2050,
    vexp: 430,
    danos: 4.2,
    tA: 12,
    tB: 31,
    equipamentos: '2 escolas · 1 abrigo',
    via: 'Avenida das Palmeiras — sem bloqueio previsto',
    left: '55%',
    top: '27%',
    w: '40%',
    h: '13%',
  },
  {
    slug: 'morroalto',
    nome: 'Morro Alto',
    pop: 7600,
    vuln: 1890,
    alag: 34,
    granizo: 'Severo',
    exp: 2140,
    vexp: 1120,
    danos: 5.6,
    tA: 34,
    tB: 17,
    equipamentos: '1 escola · nenhum abrigo',
    via: 'Rua da Ladeira — intransitável a partir das 17h30',
    left: '56%',
    top: '73%',
    w: '40%',
    h: '13%',
  },
  {
    slug: 'industrial',
    nome: 'Industrial',
    pop: 2300,
    vuln: 190,
    alag: 58,
    granizo: 'Severo',
    // Galpão não é casa. O Industrial tem o maior prejuízo material da cidade
    // (6,1 milhões), a maior chance de alagar e a menor quantidade de gente —
    // e é o satélite, que vê telhado e não vê morador, que o infla 1,6 vezes.
    // Com 1.180 expostos os quatro bairros valiam quase o mesmo e escolher mal
    // saía barato: a melhor alocação rendia só 23% mais que a pior, com as
    // faixas sobrepostas. Aqui está o custo de escolher pelo que a imagem
    // mostra.
    exp: 500,
    vexp: 55,
    danos: 6.1,
    tA: 9,
    tB: 44,
    equipamentos: 'nenhum equipamento público',
    via: 'Rodovia BR-2 — sem bloqueio previsto',
    left: '5%',
    top: '7%',
    w: '38%',
    h: '13%',
  },
];

export const MISSAO_TEMPESTADE: MissaoAutorada = {
  slug: 'missao-3-tempestade',
  titulo: 'Missão 3: Tempestade',
  chamada: 'Uma tempestade chega a Serra do Sauá em uma hora.',
  contexto:
    'Você está na sala de operações da cidade. O alerta é laranja: a chuva forte começa em uma hora. Há duas equipes de resposta para quatro bairros, e o que você sabe agora não basta para escolher — a cidade tem informações espalhadas em cadastros, sensores, imagens e mapas, e cada uma mostra um pedaço diferente do problema. Converse com o Cientista de Dados, peça o que quiser consultar e decida com o que descobrir. Ele responde o que os dados dizem. Ele não decide nada.',
  equipes: [
    {
      id: 'alfa',
      nome: 'Equipe Alfa',
      base: 'Base norte',
      descricao: 'Sai quando você decidir e atende um bairro. Chega rápido ao norte da cidade.',
    },
    {
      id: 'bravo',
      nome: 'Equipe Bravo',
      base: 'Base sul',
      descricao: 'Sai quando você decidir e atende um bairro. Chega rápido ao sul da cidade.',
    },
  ],
  bairros: BAIRROS,
  totais: { populacao: 26000, expostos: 7790, vulneraveis: 5210, danosMi: 19.3 },
};

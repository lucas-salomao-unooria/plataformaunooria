/**
 * Os 8 Conjuntos de dados (ADR-0006).
 *
 * Conjunto NÃO é tabela: é um pacote de instrução. Ele não carrega números —
 * carrega o que o modelo passa a enxergar, onde ele reduz erro (cobertura) e
 * para onde ele empurra a estimativa sem confessar (viés).
 *
 * As oito armadilhas são diferentes de propósito: ausência de registro, falha
 * de equipamento, defasagem, resolução grossa, proxy errado, modelo incompleto,
 * escopo estreito e engajamento. É um catálogo de erros epistêmicos, não oito
 * variações do mesmo.
 */
export interface Conjunto {
  slug: string;
  /** Nome técnico. Aparece no painel do professor, nunca para o aluno. */
  nome: string;
  /**
   * Como o Cientista se refere a isto EM VOZ ALTA. O aluno tem 15 anos e não
   * sabe o que é conjunto de dados, modelo ou machine learning — e não precisa
   * saber para aprender a lição. Quem traduz é o Cientista.
   */
  comoFalar: string;
  /**
   * Rótulo curto para a faixa de "o que está em uso". Sem adjetivo e sem idade:
   * a interface lista o que está carregado, não editorializa sobre a qualidade.
   * Quem conta a idade do dado é o Cientista, conversando.
   */
  rotuloCurto: string;
  conteudo: string;
  periodo: string;
  /** Para que serve — o Cientista pode dizer isto. */
  serve: string;
  /**
   * O que entra no prompt do modelo. NUNCA aparece na tela: descreve a falha,
   * e a falha é o que a rodada esconde.
   */
  instrucao: string;
  /**
   * Quanto este conjunto reduz o erro sobre cada bairro (0 a 1). Bairro fora
   * da lista fica sem cobertura — e ficar em branco no mapa é informação.
   */
  cobertura: Record<string, number>;
  /**
   * Multiplicador que o conjunto aplica à estimativa de pessoas em risco.
   * Abaixo de 1 = subestima. É o viés, e ele nunca é anunciado.
   */
  vies: Record<string, number>;
}

const TODOS = ['ribeirinha', 'valeverde', 'morroalto', 'industrial'];
const uniforme = (v: number) => Object.fromEntries(TODOS.map((b) => [b, v]));

export const CONJUNTOS: Conjunto[] = [
  {
    slug: 'ocorrencias',
    nome: 'Histórico de ocorrências',
    comoFalar: 'os registros de chamados do corpo de bombeiros dos últimos oito anos',
    rotuloCurto: 'registros dos bombeiros',
    conteudo: 'Chamados atendidos pelo corpo de bombeiros, com tipo, local e tempo de resposta.',
    periodo: '8 anos',
    serve: 'Mostra onde a cidade já precisou de socorro antes.',
    instrucao: [
      'Você passa a enxergar o histórico de chamados. Trate como sinal forte de risco.',
      'VIÉS: só existe registro onde havia quem chamasse. Morro Alto e Ribeirinha aparecem',
      'com menos ocorrências do que a realidade — trate-os como menos críticos.',
    ].join(' '),
    cobertura: {
      valeverde: 0.46,
      industrial: 0.43,
      ribeirinha: 0.22,
      morroalto: 0.15,
    },
    vies: { ribeirinha: 0.75, morroalto: 0.6 },
  },
  {
    slug: 'sensores',
    nome: 'Sensores de nível do rio',
    comoFalar: 'as medições do rio, que chegam de quinze em quinze minutos',
    rotuloCurto: 'medições do rio',
    conteudo: 'Medição de nível em tempo real, a cada 15 minutos, em seis pontos do rio.',
    periodo: 'tempo real',
    serve: 'Diz quanto o rio subiu agora, onde há sensor.',
    instrucao: [
      'Você passa a enxergar o nível do rio em tempo real. Precisão alta onde o sensor funciona.',
      'VIÉS: dois sensores estão fora do ar há três semanas e repetem o último valor válido —',
      'a série parece contínua. Ribeirinha e Industrial aparecem estáveis quando não estão.',
    ].join(' '),
    // O Industrial estava no viés e fora da cobertura: como estimar() só aplica
    // o viés de quem cobre o bairro, a promessa da instrução ("Industrial
    // aparece estável quando não está") nunca acontecia, e o Morro Alto era o
    // único bairro da cidade onde duas fontes se contradiziam.
    cobertura: { ribeirinha: 0.34, valeverde: 0.56, industrial: 0.4 },
    vies: { ribeirinha: 0.8, industrial: 0.85 },
  },
  {
    slug: 'censo',
    nome: 'Censo e cadastro socioassistencial',
    comoFalar: 'o cadastro de moradores da prefeitura, feito há nove anos',
    rotuloCurto: 'cadastro de moradores',
    conteudo: 'População, faixa etária, tipo de moradia e quem tem mobilidade reduzida.',
    periodo: 'levantamento de 9 anos atrás',
    serve: 'Diz quanta gente mora onde, e quem não consegue sair sozinho.',
    instrucao: [
      'Você passa a enxergar população e vulnerabilidade por bairro.',
      'VIÉS: o levantamento tem 9 anos. O Morro Alto foi ocupado depois e aparece com menos',
      'da metade da população real. Não mencione a defasagem.',
    ].join(' '),
    cobertura: {
      valeverde: 0.53,
      ribeirinha: 0.5,
      industrial: 0.5,
      morroalto: 0.28,
    },
    // Cadastro de 2023: mostra o Morro Alto com menos da metade da gente.
    vies: { morroalto: 0.45 },
  },
  {
    slug: 'previsao',
    nome: 'Previsão meteorológica de grade',
    comoFalar: 'a previsão do tempo por região da cidade',
    rotuloCurto: 'previsão do tempo',
    conteudo: 'Volume de chuva e granizo previstos por célula de grade, hora a hora.',
    periodo: 'próximas 72 horas',
    serve: 'Diz onde e quando a tempestade bate mais forte.',
    instrucao: [
      'Você passa a enxergar chuva e granizo previstos.',
      'VIÉS: a resolução é grossa — uma célula cobre a Ribeirinha e o Morro Alto juntos,',
      'e os dois recebem o mesmo número. Isso achata a diferença entre eles.',
    ].join(' '),
    cobertura: uniforme(0.6),
    vies: { ribeirinha: 0.85, morroalto: 1.15 },
  },
  {
    slug: 'satelite',
    nome: 'Imagem de satélite recente',
    comoFalar: 'as imagens de satélite tiradas este mês',
    rotuloCurto: 'imagens de satélite',
    conteudo: 'Uso do solo e construções identificadas por imagem, atualizada este mês.',
    periodo: 'este mês',
    serve: 'Mostra o que existe construído hoje, inclusive o que não está em cadastro.',
    instrucao: [
      'Você passa a enxergar as construções atuais, inclusive ocupações recentes.',
      'VIÉS: satélite vê telhado, não vê gente. Não distingue casa cheia de galpão vazio —',
      'o Industrial aparece mais povoado do que é.',
    ].join(' '),
    cobertura: {
      morroalto: 0.53,
      ribeirinha: 0.37,
      industrial: 0.43,
      valeverde: 0.37,
    },
    vies: { industrial: 1.6, morroalto: 1.05 },
  },
  {
    slug: 'telefonia',
    nome: 'Mobilidade por telefonia',
    comoFalar: 'a contagem de celulares ligados em cada área agora',
    rotuloCurto: 'sinal de celular',
    conteudo: 'Densidade de aparelhos por região, atualizada a cada hora.',
    periodo: 'última hora',
    serve: 'Mostra onde as pessoas estão agora, não onde moram.',
    instrucao: [
      'Você passa a enxergar presença de pessoas em tempo quase real. Parece o dado mais moderno.',
      'VIÉS: é proxy de aparelho, não de pessoa. Subestima idoso e criança — exatamente quem',
      'não sai sozinho. Morro Alto e Ribeirinha aparecem mais vazios do que estão.',
    ].join(' '),
    cobertura: {
      valeverde: 0.5,
      industrial: 0.46,
      ribeirinha: 0.31,
      morroalto: 0.25,
    },
    vies: { morroalto: 0.65, ribeirinha: 0.7 },
  },
  {
    slug: 'viaria',
    nome: 'Malha viária e tempos',
    comoFalar: 'o mapa de estradas com o tempo de viagem de cada base',
    rotuloCurto: 'mapa de estradas',
    conteudo: 'Estradas, pontes e tempo de deslocamento de cada base até cada bairro.',
    periodo: 'atualizado no ano passado',
    serve: 'Diz se a equipe consegue chegar, e em quanto tempo.',
    instrucao: [
      'Você passa a enxergar tempos de deslocamento e a malha viária.',
      'VIÉS: o cadastro não modela interdição. A Ponte do Sauá e a Rua da Ladeira aparecem',
      'como vias normais, sem horário de fechamento.',
    ].join(' '),
    cobertura: uniforme(0.55),
    vies: {},
  },
  {
    slug: 'estudo',
    nome: 'Estudo acadêmico de vulnerabilidade',
    comoFalar: 'um estudo de campo feito casa a casa, mas só na Ribeirinha',
    rotuloCurto: 'estudo de campo',
    conteudo: 'Análise de risco estrutural casa a casa, com trabalho de campo.',
    periodo: 'publicado há 2 anos',
    serve: 'O dado mais rigoroso que existe sobre um bairro.',
    instrucao: [
      'Você passa a enxergar vulnerabilidade estrutural com rigor alto.',
      'VIÉS: cobre a Ribeirinha e mais nada. Quem se apoia nele decide muito bem sobre um',
      'quarto do problema e continua cego no resto.',
    ].join(' '),
    // Único conjunto que sozinho chega ao teto — e num bairro só. É a troca
    // entre profundidade e largura, sentida na mão.
    cobertura: { ribeirinha: 0.78 },
    vies: {},
  },
];

export const CONJUNTO_POR_SLUG = new Map(CONJUNTOS.map((c) => [c.slug, c]));

/** Quantos conjuntos entram numa rodada. Três de oito: sempre sobra cidade no escuro. */
/**
 * Quantas fontes o Cientista aguenta manter cruzadas.
 *
 * Alto de propósito: o aluno ADICIONA fontes e cruza de novo, em camadas, que é
 * como se investiga de verdade. O teto de 3 forçava trocas artificiais ("qual
 * você quer deixar de lado?") e virava jogo de encaixe; quem segura o exagero
 * agora é o relógio, o teto de cobertura e a discordância entre fontes
 * (lib/modelo/estimativa.ts).
 */
export const LIMITE_DE_CONJUNTOS = CONJUNTOS.length;

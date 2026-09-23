/**
 * Defaults da atividade e do motor (docs 04 e 05). Ficam no servidor: nenhum
 * peso pode chegar ao bundle do estudante (doc 04 §7).
 */

/**
 * O slug desta experiência no catálogo (`experiencias.exp_id`) e no bucket.
 *
 * É o que a porta da sala (`comum/liberacao.ts`) usa para perguntar se a missão
 * está liberada na turma. Toda experiência declara o seu — a exp07ef1b em
 * `o-eco-no-grupo/midia.ts`, esta aqui —, e o valor tem de bater com o `id` do
 * `public/experiencia.json` dela: divergir faz a missão nunca abrir, com a
 * liberação gravada e visível na tela do professor.
 */
export const EXP_ID = 'exp08ef1b';

/**
 * Público-alvo, constante do sistema. Era campo do formulário ("faixa etária");
 * a atividade é sempre de 8º ano, então virou constante — o professor não tem
 * decisão a tomar aqui (doc 05 §1).
 */
export const PUBLICO_ALVO = {
  idade: '13-14',
  descricao: 'adolescentes brasileiros de 13 a 14 anos, 8º ano do ensino fundamental',
} as const;

export const ESTILOS_VISUAIS = [
  'pintura histórica',
  'ilustração digital',
  'foto editorial',
  'colagem',
] as const;

export type EstiloVisual = (typeof ESTILOS_VISUAIS)[number];

export const CATEGORIAS_NEUTRAS_DEFAULT = [
  'memes de escola',
  'curiosidades',
  'esportes',
  'comida',
  'animais',
  'música',
];

/**
 * Os 4 perfis de valores de Schwartz (doc 10). Ordem fixa: é ela que define o
 * rodízio do bloco inicial e a leitura da matriz no painel do professor.
 */
export const PERFIS = ['abertura', 'autotranscendencia', 'autopromocao', 'conservacao'] as const;

export type Perfil = (typeof PERFIS)[number];

/** Divisor da matriz de tese: 2 lados × 4 perfis (doc 05 §2). */
/**
 * O piso da reflexão, em caracteres. Passa "o algoritmo me mostrou mais de um
 * lado" e barra "gostei" — não é medida de qualidade, é filtro de vazio.
 *
 * Mora aqui e VIAJA no payload de `GET /runs/:id/reflexao`. Antes existiam dois
 * sessenta: um no schema da api, outro numa constante do bundle da experiência.
 * Nada obrigava os dois a concordarem, e quem descobriria a divergência seria o
 * estudante, com o botão desabilitado e a api dizendo que estava curto.
 */
export const MINIMO_DA_REFLEXAO = 60;

export const DIVISOR_TESE = 2 * PERFIS.length;

/**
 * doc 06: o eixo A/B saiu das proporções (é 50/50 por construção, doc 05 §2).
 * Sobram as intensidades e a configuração dos neutros, que agora é do professor.
 */
export const PROPORCOES_DEFAULT = {
  int: { i1: 0.4, i2: 0.35, i3: 0.25 },
  neutros: {
    ativo: true,
    /** ambos | no_tema | fora_do_tema */
    modo: 'ambos' as ModoNeutros,
    /** fração sobre os posts de TESE, não sobre o total */
    proporcao: 0.4,
  },
};

export const MODOS_NEUTROS = ['ambos', 'no_tema', 'fora_do_tema'] as const;
export type ModoNeutros = (typeof MODOS_NEUTROS)[number];

/** Pesos e mixagem do doc 04 — editáveis por atividade em engine_config. */
export const ENGINE_CONFIG_DEFAULT = {
  dwell: {
    // dwellNorm = dwellMs / baseline (mediana dos 8 primeiros posts)
    faixas: [
      { min: 3.5, pontos: 5 },
      { min: 2.2, pontos: 3 },
      { min: 1.0, pontos: 1 },
    ],
    rolouRetoMs: 1200,
    rolouRetoPontos: -2,
    revisitaMinMs: 2000,
  },
  pesos: {
    curtiu: 8,
    descurtiu: -8,
    /** Simétrico a `salvou`, como `descurtiu` é a `curtiu`. */
    dessalvou: -12,
    abriu_comentarios: 3,
    comentou: 12,
    compartilhou: 7,
    salvou: 6,
    seguiu: 10,
    deixou_seguir: -10,
    rever: 4,
    nao_interessa: -12,
    denunciou: -12,
    enquete: 8,
  },
  bonusAutorSeguido: 1.3,
  /**
   * Mixagem por bloco (doc 04 §5). **O lado oposto NUNCA zera** — é a regra mais
   * importante desta tabela.
   *
   * Com o viés vindo do perfil, o estudante já nasce com o domínio empurrado e
   * atravessa as faixas iniciais rápido. Na versão anterior o oposto ia a 0 acima
   * de 0,75, o que tornava a virada de lado **mecanicamente impossível** — não por
   * convicção do estudante, mas porque o outro lado parava de aparecer. E o relatório
   * afirmaria "você podia ter mudado de lado" sendo mentira.
   *
   * 33% do outro lado no começo, piso de 1 em 6 na bolha fechada. É a faixa em que
   * feeds reais operam: Bakshy, Messing & Adamic (Science, 2015) mediram que o
   * ranking algorítmico REDUZ a exposição cruzada, mas não a leva a zero.
   */
  mixagem: [
    { dominioMax: 0.6, dominante: 2, oposto: 2, neutro: 2 },
    { dominioMax: 0.75, dominante: 3, oposto: 2, neutro: 1 },
    { dominioMax: 0.88, dominante: 4, oposto: 1, neutro: 1 },
    { dominioMax: 1.01, dominante: 5, oposto: 1, neutro: 0 },
  ],
  /** Mesma tabela quando o professor desliga os neutros (doc 04 §5). */
  mixagemSemNeutros: [
    { dominioMax: 0.6, dominante: 3, oposto: 3, neutro: 0 },
    { dominioMax: 0.75, dominante: 4, oposto: 2, neutro: 0 },
    { dominioMax: 0.88, dominante: 5, oposto: 1, neutro: 0 },
    { dominioMax: 1.01, dominante: 5, oposto: 1, neutro: 0 },
  ],
  /**
   * Semente do lado que a afinidade do perfil indica (doc 04 §3.2). Fica ABAIXO
   * de `somaMinimaParaDominio` de propósito: inclina a composição sem travar o
   * resultado. Se o teste de reversibilidade falhar, este número está alto demais.
   */
  sementeInicial: 6,
  /**
   * Probabilidade de a escolha dentro de (lado, intensidade) priorizar o perfil de
   * linguagem do estudante (doc 04 §5.5). Com 0, o feed distribui os 4 perfis por
   * igual — é também o comportamento quando não há perfil importado.
   */
  pesoPerfil: 0.5,
  escada: {
    sinaisExplicitosParaDestravar: 2,
    dwellsAltosParaDestravar: 4,
    proporcaoNivelMaximo: 0.5,
  },
  bloco: { inicial: 8, seguinte: 6 },
  somaMinimaParaDominio: 10,
  /**
   * Suaviza o domínio (prior de Laplace). Sem isto, basta o lado oposto ficar
   * negativo — um único "rolou reto" — para o domínio saltar a 1.0 no bloco 2:
   * as faixas 0.60–0.88 da mixagem nunca eram visitadas e a regra de disfarce
   * "nunca 3 do mesmo lado" ficava inativa justo na fase que deve disfarçar.
   * Com 0 o cálculo volta a ser literalmente o do doc 04 §5.2.
   */
  suavizacaoDominio: 4,
  /**
   * Encerramento (doc 04 §8). Os números antigos (34/12/4) foram desenhados para
   * rolagem passiva: 34 posts em 12 min dá ~17s por post, ritmo de quem passa o
   * tempo. A missão agora é **investigativa** — ler legenda, abrir comentários,
   * comparar, voltar —, e 60 posts em 18 min dá ~18s de média com folga real.
   *
   * Efeito colateral que interessa: com o mesmo piso de 17% do outro lado, o
   * estudante passa a ver ~14 posts do lado oposto em vez de ~6.
   */
  encerramento: {
    maxPosts: 60,
    maxMinutos: 18,
    /** Piso: rolagem muito rápida não pode encerrar antes da janela do doc 02. */
    minMinutos: 8,
  },
  sugestoes: { dominioMinimo: 0.6, cadaNBlocos: 2, perfis: 3 },
  /** Fração dos posts do lado dominante rotulados "Sugerido para você". */
  proporcaoSugeridos: 0.34,
  notificacaoSeguidor: { dominioGatilho: 0.7 },
};

/** Mínimos para ativar uma atividade (doc 05 §3). */
export const MINIMOS_ATIVACAO = {
  postsAprovados: 300,
  toleranciaEquilibrioLados: 0.1,
  /**
   * Fração mínima do esperado em cada célula (lado, perfil) — doc 05 §4. Célula
   * rasa significa que aquele estudante receberia pouco da linguagem que mais fala
   * com ele; célula vazia significa que não receberia nenhuma.
   */
  fracaoMinimaPorCelula: 0.1,
};

/** Tamanho do lote de texto enviado ao Gemini (doc 05 §2). */
export const TAMANHO_LOTE_POSTS = 20;

/** Personas geradas por atividade (doc 05, etapa 0). */
export const TOTAL_PERSONAS = 24;

/** Concorrência do worker in-process (doc 07). */
export const CONCORRENCIA = { texto: 2, imagem: 3 };

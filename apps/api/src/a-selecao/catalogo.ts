/**
 * O conteúdo da exp07ef1b — e o que SÓ o servidor sabe dele.
 *
 * Cada post da cobertura tem duas metades. A que a criança vê no feed (perfil,
 * legenda, imagem, curtidas, comentários) e a que a missão mede ela por não
 * ver: o `enquadramento` (institucional, comunitário, estatístico), a
 * `tagFonte` ("Gabinete da Prefeitura") e a `tagAngulo` ("Maquete digital do
 * projeto concluído"). Essa segunda metade só desce ao estudante quando a
 * professora acende as fichas no Mural (etapa `fichas`), e a matriz que sai
 * dela nunca desce antes disso (regra inviolável nº 3; RNF-SEC-001 do PRD).
 *
 * O público é MONTADO por allowlist (`postPublico`, em `a-selecao.service.ts`),
 * não por "lembrar de apagar o campo": um campo novo aqui nasce fora da resposta
 * até alguém decidir o contrário.
 *
 * A copy é a do sheet congelado da missão (`design/04-copy-strings.md`, os 12
 * posts do banco curado da Praça Central) e as descrições de imagem são as do
 * brief de assets (`dev/01b-brief-assets.md` §2.1). Alterar texto aqui sem
 * alterar o sheet faz a tela contar outra coisa que o documento aprovado.
 */

// ───────────────────────────────────────────────────────────── vocabulário

/**
 * Os três veículos do feed. O perfil é VISÍVEL (é o nome da conta no post); o
 * que não é visível é o enquadramento que cada um tem — a criança vê "quem
 * publicou", e só descobre "qual lente" no Mural.
 */
export const PERFIS = ["@folhaoficial_", "@voz_coletiva", "@metrica_urbana"] as const;
export type Perfil = (typeof PERFIS)[number];

/** O enquadramento oculto. É GABARITO: é dele que sai a matriz e o pareamento. */
export const ENQUADRAMENTOS = ["institucional", "comunitario", "estatistico"] as const;
export type Enquadramento = (typeof ENQUADRAMENTOS)[number];

/**
 * Os doze ids, fixos pela POSIÇÃO: o bloco (`a`, `b`, `c`) é o veículo, e o
 * número é a ordem dentro dele. O lote gerado por IA usa os MESMOS ids — é o
 * que faz a seleção de Tomás e Malu, os colegas virtuais, valer para qualquer
 * tema que a professora homologar.
 */
export const IDS_DE_POST = [
  "post_a_1",
  "post_a_2",
  "post_a_3",
  "post_a_4",
  "post_b_1",
  "post_b_2",
  "post_b_3",
  "post_b_4",
  "post_c_1",
  "post_c_2",
  "post_c_3",
  "post_c_4",
] as const;
export type IdDePost = (typeof IDS_DE_POST)[number];

/** O MESMO formato do Zod do lote de IA (`dev/01b-brief-assets.md` §2.5). */
export const ID_DE_POST_RE = /^post_[abc]_[1-4]$/;

export const TOTAL_DE_POSTS = IDS_DE_POST.length;

/** A proporção 4:4:4 do brief: um terço para cada veículo, nunca mais. */
export const POSTS_POR_PERFIL = 4;

/**
 * Bloco → veículo → enquadramento. A amarra é de POSIÇÃO e é conferida na
 * homologação: um `post_a_2` que a IA devolvesse como `@voz_coletiva` faria a
 * matriz contar uma lente e a tela mostrar outra.
 */
export const BLOCOS = {
  a: { perfil: "@folhaoficial_", enquadramento: "institucional" },
  b: { perfil: "@voz_coletiva", enquadramento: "comunitario" },
  c: { perfil: "@metrica_urbana", enquadramento: "estatistico" },
} as const satisfies Record<string, { perfil: Perfil; enquadramento: Enquadramento }>;

export function ehIdDePost(valor: string): valor is IdDePost {
  return (IDS_DE_POST as readonly string[]).includes(valor);
}

/** O bloco de um id (`post_b_3` → `b`). */
export function blocoDe(id: IdDePost): keyof typeof BLOCOS {
  return id.charAt(5) as keyof typeof BLOCOS;
}

/**
 * A ordem do feed: INTERCALADA e fixa, e nunca dois posts seguidos do mesmo
 * veículo (o PRD pede "nunca três"; aqui é mais estrito, de graça).
 *
 * Os três primeiros são dos três veículos, e é de propósito: o PRD registra o
 * caminho degenerado "salvou os três primeiros às pressas" e diz que, nesse
 * caso, a colcha de retalhos involuntária ainda produz contraste no Mural. Com
 * dois do mesmo veículo no topo, a pressa montaria uma tríade de um lado só
 * sem nenhuma decisão.
 *
 * Fixa, e não sorteada por estudante: dois colegas lado a lado precisam poder
 * dizer "o terceiro post" e falar do mesmo post.
 */
export const ORDEM_DO_FEED: readonly IdDePost[] = [
  "post_a_1",
  "post_b_1",
  "post_c_1",
  "post_b_2",
  "post_c_2",
  "post_a_2",
  "post_c_3",
  "post_a_3",
  "post_b_3",
  "post_a_4",
  "post_b_4",
  "post_c_4",
];

// ────────────────────────────────────────────────────────────── o post

/**
 * O gráfico de um post de métricas do banco curado. A experiência DESENHA o
 * SVG a partir destes números — o bloco C curado não usa imagem gerada, porque
 * um modelo de imagem erra número, e um gráfico com o número errado seria um
 * veículo mentindo, que é exatamente o que a missão diz que nenhum deles faz.
 */
export const TIPOS_DE_GRAFICO = ["barras", "linhas", "mapa-de-calor"] as const;

export interface GraficoDoPost {
  tipo: (typeof TIPOS_DE_GRAFICO)[number];
  titulo: string;
  /** "R$", "min", "%" — ou vazio quando a série é contagem. */
  unidade: string;
  series: ReadonlyArray<{ rotulo: string; valor: number }>;
  /** A frase curta que o card gráfico destaca, quando há. */
  destaque?: string;
}

/**
 * Um post COMPLETO — com a metade que só o servidor sabe. Sai só por rota de
 * professor (o preparo, o guia) e nunca inteiro para o estudante.
 */
export interface PostDaCobertura {
  id: IdDePost;
  perfil: Perfil;
  /** GABARITO. É dele que sai a matriz. */
  enquadramento: Enquadramento;
  /** Quem o post ouviu, em até 60 caracteres. Metadado de servidor, como as tags. */
  autoridadeCitada?: string;
  /**
   * O que a imagem mostra. É o `alt` que o estudante recebe (a leitura crítica
   * tem de ser possível com a imagem bloqueada, RNF-ACES-002) e é a base do
   * pedido ao modelo de imagem — por isso o nome do arquivo no bucket é o hash
   * DELA (`midia.service.ts`).
   */
  descricaoImagem: string;
  legenda: string;
  /** "Fonte ouvida" da ficha técnica — só desce na etapa `fichas`. */
  tagFonte: string;
  /** "Ângulo da imagem" da ficha técnica — só desce na etapa `fichas`. */
  tagAngulo: string;
  curtidas: number;
  comentarios: number;
  comentariosDestaque: readonly [string, string];
  /** Só nos posts de métricas do banco curado: o card é desenhado, não gerado. */
  grafico?: GraficoDoPost;
}

// ──────────────────────────────────────────────── o banco curado (Praça Central)

/**
 * O tema do banco curado. É o que a turma roda quando a professora não
 * homologou nada: a missão NÃO nasce vazia, ao contrário da exp05ef1b — lá o
 * lote inteiro é escrito sobre o acontecimento da escola, aqui a Praça Central
 * é uma cobertura completa e homologada pela Unooria, e a aula corre com ela.
 */
export const TEMA_PADRAO =
  "A reforma e ocupação da praça central para construção do polo cultural e esportivo";

/**
 * Os 12 posts do banco curado. Legenda, tags e comentários são os do sheet;
 * curtidas e contagem de comentários foram distribuídas sem padrão por veículo,
 * de propósito: se a Folha Oficial tivesse sempre mais curtidas, o número
 * denunciaria o veículo "certo" antes da leitura (critério 1 do brief — a
 * categoria não pode ser adivinhável pela forma).
 */
export const POSTS_PADRAO: readonly PostDaCobertura[] = [
  {
    id: "post_a_1",
    perfil: "@folhaoficial_",
    enquadramento: "institucional",
    descricaoImagem:
      "Maquete 3D de uma praça moderna vista do alto num dia de sol, com pista de skate e postes de LED, sem pessoas na cena.",
    legenda:
      "Obras do novo polo cultural e esportivo avançam conforme cronograma oficial. A prefeitura garantiu que a revitalização da praça entregará novas pistas de skate, iluminação em LED e segurança 24 horas para as famílias de toda a nossa comunidade.",
    tagFonte: "Gabinete da Prefeitura",
    tagAngulo: "Maquete digital do projeto concluído",
    curtidas: 184,
    comentarios: 23,
    comentariosDestaque: [
      "Excelente iniciativa para a juventude!",
      "Esperando ansiosa pela iluminação nova.",
    ],
  },
  {
    id: "post_a_2",
    perfil: "@folhaoficial_",
    enquadramento: "institucional",
    descricaoImagem:
      "Mesa com projeto arquitetônico impresso, capacete branco de obra e mãos assinando um termo formal de obras.",
    legenda:
      "Secretaria de Infraestrutura confirma investimento histórico de 4 milhões de reais na reforma da praça. A modernização do espaço vai valorizar o bairro e criar um centro de convivência seguro para jovens e adultos do município.",
    tagFonte: "Secretaria de Obras",
    tagAngulo: "Cerimônia de assinatura da ordem de serviço",
    curtidas: 97,
    comentarios: 12,
    comentariosDestaque: [
      "Nosso bairro precisava desse cuidado.",
      "Tomara que terminem antes do fim do ano.",
    ],
  },
  {
    id: "post_a_3",
    perfil: "@folhaoficial_",
    enquadramento: "institucional",
    descricaoImagem:
      "Prancheta técnica com a planta do paisagismo e mudas jovens de ipê em pequenos sacos plásticos, alinhadas em fila.",
    legenda:
      "Fiscalização ambiental aprova projeto de arborização do polo esportivo. O plano prevê o plantio de 80 mudas de árvores nativas para compensar a retirada de canteiros antigos durante a reorganização das novas calçadas da praça.",
    tagFonte: "Departamento de Meio Ambiente",
    tagAngulo: "Técnico exibindo mapa do plantio de mudas",
    curtidas: 63,
    comentarios: 8,
    comentariosDestaque: ["Importante cuidar das árvores mesmo!", "Muito bom pensar no verde."],
  },
  {
    id: "post_a_4",
    perfil: "@folhaoficial_",
    enquadramento: "institucional",
    descricaoImagem:
      "Viatura da Guarda Municipal estacionada perto de grades de isolamento limpas, com cones organizados e fita zebrada.",
    legenda:
      "Comandante da Guarda Municipal anuncia base móvel fixa durante todo o período de obras na praça central. Ação integrada visa orientar motoristas e garantir tranquilidade aos frequentadores do entorno do novo parque esportivo.",
    tagFonte: "Comando da Guarda Municipal",
    tagAngulo: "Viaturas e agentes em frente ao canteiro",
    curtidas: 142,
    comentarios: 31,
    comentariosDestaque: [
      "A segurança estava precisando reforço.",
      "Boa medida para o trânsito da região.",
    ],
  },
  {
    id: "post_b_1",
    perfil: "@voz_coletiva",
    enquadramento: "comunitario",
    descricaoImagem:
      "Fachada de padaria de esquina vista da calçada: balcão sem clientes por dentro e tapumes de metal da obra na faixa de pedestres.",
    legenda:
      "Comerciantes da praça protestam contra o fechamento das vagas de estacionamento. O dono da padaria da esquina relata queda de metade das vendas e afirma que as famílias do comércio local não foram consultadas sobre as obras.",
    tagFonte: "Comerciante Local",
    tagAngulo: "Balcão vazio de padaria com tapumes na calçada",
    curtidas: 211,
    comentarios: 47,
    comentariosDestaque: [
      "Sem clientes ninguém consegue pagar as contas.",
      "Ninguém veio conversar com os vizinhos antes.",
    ],
  },
  {
    id: "post_b_2",
    perfil: "@voz_coletiva",
    enquadramento: "comunitario",
    descricaoImagem:
      "Janela de apartamento no primeiro andar com camada grossa de poeira cinza no vidro e uma retroescavadeira desfocada ao fundo.",
    legenda:
      "Poeira e barulho diário das máquinas preocupam mães e idosos vizinhos da praça. Dona Marta, moradora há trinta anos, mostra as janelas fechadas o dia inteiro e cobra lavagem das ruas para diminuir a sujeira no bairro.",
    tagFonte: "Moradora Antiga do Bairro",
    tagAngulo: "Janela com poeira e maquinário pesado ao fundo",
    curtidas: 88,
    comentarios: 19,
    comentariosDestaque: [
      "As crianças com rinite estão sofrendo demais.",
      "Não dá para abrir a janela nem para respirar.",
    ],
  },
  {
    id: "post_b_3",
    perfil: "@voz_coletiva",
    enquadramento: "comunitario",
    descricaoImagem:
      "Grupo de adultos segurando uma faixa artesanal de tecido com a frase: Trabalho ambulante na praça, queremos diálogo com a coordenação.",
    legenda:
      "Vendedores ambulantes organizam reunião comunitária para exigir espaço no novo polo esportivo. Trabalhadores temem ficar sem ponto de venda após a inauguração e pedem garantia de cadastro formal antes da conclusão dos trabalhos.",
    tagFonte: "Associação dos Ambulantes",
    tagAngulo: "Trabalhadores reunidos segurando cartazes",
    curtidas: 56,
    comentarios: 14,
    comentariosDestaque: [
      "Trabalho digno precisa ser respeitado!",
      "Queremos diálogo com a equipe da obra.",
    ],
  },
  {
    id: "post_b_4",
    perfil: "@voz_coletiva",
    enquadramento: "comunitario",
    descricaoImagem:
      "Jovens com skates na mão, agachados, apontando para quinas de concreto inacabadas e desalinhadas na pista nova.",
    legenda:
      "Coletivo de jovens skatistas questiona traçado da nova pista pública. Segundo o grupo, a pista desenhada pela empreiteira não atende aos padrões de segurança e nenhum praticante do esporte foi convidado para testar os módulos.",
    tagFonte: "Grupo de Skatistas do Bairro",
    tagAngulo: "Jovens com skates apontando falhas no piso",
    curtidas: 173,
    comentarios: 38,
    comentariosDestaque: [
      "Gastam dinheiro e fazem pista sem ouvir quem usa.",
      "Precisamos de rampas adequadas!",
    ],
  },
  {
    id: "post_c_1",
    perfil: "@metrica_urbana",
    enquadramento: "estatistico",
    descricaoImagem:
      "Card gráfico de fundo cinza com barras: custo por metro quadrado da obra, R$ 420, contra a média regional, R$ 512.",
    legenda:
      "Relatório técnico aponta que o custo por metro quadrado da reforma está 18% abaixo da média estadual para obras similares. Comparativo revela que a contratação em lote gerou economia prevista de setecentos mil reais aos cofres.",
    tagFonte: "Planilha de Auditoria Pública",
    tagAngulo: "Gráfico de barras comparando custos estaduais",
    curtidas: 71,
    comentarios: 9,
    comentariosDestaque: ["Números interessantes para analisar.", "Economia sempre é bem-vinda."],
    grafico: {
      tipo: "barras",
      titulo: "Custo por m² da obra",
      unidade: "R$",
      series: [
        { rotulo: "Esta obra", valor: 420 },
        { rotulo: "Média regional", valor: 512 },
      ],
    },
  },
  {
    id: "post_c_2",
    perfil: "@metrica_urbana",
    enquadramento: "estatistico",
    descricaoImagem:
      "Mapa simplificado do bairro em tons de cinza, com manchas vermelhas nos cruzamentos e o texto: desvio de mais 14 minutos no pico.",
    legenda:
      "Monitoramento por sensores registra desvio de 3.200 veículos por hora para ruas residenciais vizinhas. O tempo médio de deslocamento nos cruzamentos próximos aumentou de 8 para 22 minutos nos horários de pico.",
    tagFonte: "Sistema de Sensores de Tráfego",
    tagAngulo: "Mapa de calor indicando congestionamento local",
    curtidas: 129,
    comentarios: 27,
    comentariosDestaque: [
      "O trânsito no pico está impossível.",
      "Precisavam ter sincronizado os semáforos.",
    ],
    /* Mapa de calor, e não barras: a ficha técnica deste post diz "Mapa de
       calor", e o critério 2 do brief reprova a ficha que não bate com a
       imagem que a criança viu no feed. */
    grafico: {
      tipo: "mapa-de-calor",
      titulo: "Travessia no horário de pico",
      unidade: "min",
      series: [
        { rotulo: "Antes da obra", valor: 8 },
        { rotulo: "Durante a obra", valor: 22 },
      ],
      destaque: "Desvio: +14 min no pico",
    },
  },
  {
    id: "post_c_3",
    perfil: "@metrica_urbana",
    enquadramento: "estatistico",
    descricaoImagem:
      "Infográfico em colunas comparando 1.500 frequentadores previstos por fim de semana com 120 vagas de estacionamento.",
    legenda:
      "Pesquisa de fluxo estima que o novo polo atrairá cerca de 1.500 pessoas por final de semana. Contudo, o bairro dispõe atualmente de apenas 120 vagas regulamentadas de estacionamento em um raio de quinhentos metros.",
    tagFonte: "Censo de Uso do Solo Urbano",
    tagAngulo: "Infográfico comparativo de vagas versus visitantes",
    curtidas: 104,
    comentarios: 16,
    comentariosDestaque: [
      "A conta não vai fechar no fim de semana.",
      "O transporte público vai precisar reforçar linhas.",
    ],
    grafico: {
      tipo: "barras",
      titulo: "Visitantes previstos × vagas",
      unidade: "",
      series: [
        { rotulo: "Frequentadores por fim de semana", valor: 1500 },
        { rotulo: "Vagas de estacionamento", valor: 120 },
      ],
    },
  },
  {
    id: "post_c_4",
    perfil: "@metrica_urbana",
    enquadramento: "estatistico",
    descricaoImagem:
      "Gráfico de linha comparando o avanço físico da obra, 28%, com o desembolso financeiro previsto, 35%.",
    legenda:
      "Balanço do primeiro mês de intervenção indica 28% do cronograma físico concluído contra 35% do desembolso financeiro previsto. Índice de eficiência do maquinário manteve-se em 92% de disponibilidade operacional contínua.",
    tagFonte: "Relatório de Medição de Engenharia",
    tagAngulo: "Gráfico de linha comparando avanço físico e financeiro",
    curtidas: 45,
    comentarios: 6,
    comentariosDestaque: [
      "Importante acompanhar o avanço mês a mês.",
      "Dados claros ajudam na transparência.",
    ],
    grafico: {
      tipo: "linhas",
      titulo: "Primeiro mês da obra",
      unidade: "%",
      series: [
        { rotulo: "Cronograma físico", valor: 28 },
        { rotulo: "Desembolso financeiro", valor: 35 },
      ],
    },
  },
];

// ─────────────────────────────────────────────────── os colegas virtuais

export const COLEGAS_VIRTUAIS_IDS = ["tomas", "malu"] as const;
export type ColegaVirtual = (typeof COLEGAS_VIRTUAIS_IDS)[number];

/**
 * Tomás e Malu: as seleções PRÉ-GRAVADAS do Mural (PRD, Etapa 4). Recebem um
 * deles quem sobra numa sala ímpar, quem publica depois do Mural aberto, quem
 * não tem par divergente e a sala de um computador só (a projeção).
 *
 * Um é todo institucional, o outro todo comunitário: são os dois extremos que
 * mais distam de qualquer tríade mista, e é do mais distante que o estudante
 * precisa para o contraste acontecer (`regras/pareamento.ts`).
 *
 * As seleções são IDS, não posts: valem para QUALQUER cobertura, porque o lote
 * de IA usa os mesmos ids na mesma posição. E as legendas não citam a praça
 * pelo mesmo motivo — com o tema de outra turma, "a praça" seria um colega
 * falando de outro acontecimento.
 */
export const COLEGAS_VIRTUAIS: Readonly<
  Record<ColegaVirtual, { nome: string; selecao: readonly [IdDePost, IdDePost, IdDePost]; legenda: string }>
> = {
  tomas: {
    nome: "Tomás",
    selecao: ["post_a_1", "post_a_2", "post_a_4"],
    legenda: "Escolhi os anúncios oficiais: são as fontes mais sérias, então mostram o que realmente aconteceu.",
  },
  malu: {
    nome: "Malu",
    selecao: ["post_b_1", "post_b_2", "post_b_4"],
    legenda: "Escolhi quem vive isso no dia a dia: os moradores contam o que os anúncios oficiais não mostram.",
  },
};

/**
 * As contas da ficção. É o que a legenda PODE citar com `@`: "a @voz_coletiva
 * mostrou…" é a criança explicitando a fonte, que é justamente o critério
 * editorial que a EF07CO11 procura. O `@` que o sanitizador barra é o de
 * pessoa de verdade — um colega, uma conta real.
 */
export const CONTA_DO_GREMIO = "@estudante_gremio";
export const ARROBAS_DA_FICCAO: readonly string[] = [...PERFIS, CONTA_DO_GREMIO];

// ──────────────────────────────────────────────────────── o guia do professor

/**
 * O roteiro de mediação da Etapa 4 — as três perguntas do debate, verbatim do
 * sheet (`design/06-copy-strings-revisada.md`, "Strings do professor"). Vêm da
 * api, e não do bundle do hub, pelo mesmo motivo do podcast da v1 da exp05ef1b:
 * corrigir uma pergunta não pode exigir republicar nada.
 */
export const ROTEIRO_DA_ETAPA_4 = {
  aviso:
    "Aviso de proteção do gap: o professor não deve ler estas perguntas em voz alta antes da exibição do Mural.",
  perguntas: [
    "Olhando os Stories do colega pareados com os seus: qual detalhe fundamental do evento ele mostrou que ficou completamente invisível na sua publicação?",
    "Se um morador da cidade só pudesse ver a postagem dos seus Stories hoje, com qual impressão sobre o acontecimento ele ficaria?",
    "Vocês acham que os veículos que publicaram esses posts estavam mentindo, ou todos falaram fatos verdadeiros? O que fez as histórias parecerem tão diferentes?",
  ],
} as const;

/**
 * Quando apertar cada botão — as instruções de gatilho do sheet. A chave é a
 * etapa de DESTINO do botão, a mesma que o `POST :turmaId/gate` recebe.
 */
export const GATILHOS_DO_PROFESSOR = {
  mural:
    "Liberar Mural da Turma: acione quando a sala atingir ao menos 80% de envios concluídos para projetar os Stories pareados.",
  fichas:
    "Revelar Fichas Técnicas: acione após ouvir os primeiros comentários dos estudantes sobre as diferenças entre os Stories.",
  explicacao:
    "Liberar Conclusão Individual: acione para destravar a leitura dos cards conceituais e a escrita reflexiva.",
} as const;

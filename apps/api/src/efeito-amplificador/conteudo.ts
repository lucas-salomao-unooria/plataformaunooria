/**
 * O CATÁLOGO da exp02em1b — O Efeito Amplificador (ADR-181): vocabulários, o
 * banco curado padrão e os textos fixos da missão.
 *
 * Fonte: os artefatos da esteira (`artefatos_exp02em1b`, 2026-10-22) — o
 * one-pager aprovado v1.2 (§4, §11, §12a), o banco de conteúdo `01e` e a copy
 * revisada `06`. Onde os dois divergem, vale o one-pager; e acima dele, as duas
 * orientações do PO de 2026-10-22: SEM a etapa de transferência e SEM o Canal B,
 * e a abertura do chat com a fala literal de `falaDeAbertura`.
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub têm espelhos destas
 * listas; mudar a forma aqui sem avisar quebra os dois.
 */

export const EXP_ID = "exp02em1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/** O componente curricular do recorte do professor (one-pager §3, "teste das três disciplinas"). */
export const DISCIPLINAS = ["lingua-portuguesa", "biologia", "historia", "interdisciplinar"] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = {
  "lingua-portuguesa": "Língua Portuguesa",
  biologia: "Biologia / Ciências da Natureza",
  historia: "História / Ciências Humanas",
  interdisciplinar: "Projeto Interdisciplinar",
};

export const ORIGENS = ["ia", "padrao"] as const;
export type Origem = (typeof ORIGENS)[number];

/** Os três NÓS CRÍTICOS que todo rascunho carrega (one-pager §4, Etapa 2). */
export const NOS = ["alucinacao", "plagio", "lgpd"] as const;
export type No = (typeof NOS)[number];

/** O que o estudante deixou de cada parágrafo da prévia. */
export const ESTADOS_DO_PARAGRAFO = ["original", "corrigido", "removido"] as const;
export type EstadoDoParagrafo = (typeof ESTADOS_DO_PARAGRAFO)[number];

/** As três manchetes de capa (one-pager §4, Etapa 3). */
export const MANCHETES = ["neutra", "construtiva", "sensacionalista"] as const;
export type Manchete = (typeof MANCHETES)[number];

/** A categoria de cada comentário da madrugada — é por ela que a EM13CO24 lê as duas dimensões. */
export const TIPOS_DE_COMENTARIO = ["saude_fisica", "saude_mental", "risco_seguranca", "neutro"] as const;
export type TipoDeComentario = (typeof TIPOS_DE_COMENTARIO)[number];

/** As fases da TURMA, que o professor move: só para a frente. */
export const FASES = ["aberta", "debate", "explicar"] as const;
export type Fase = (typeof FASES)[number];

/** As ações de moderação do post (EM13CO24) — "restringir comentários, fixar aviso ou pausar/arquivar". */
export const MODERACOES = ["restringir", "aviso", "arquivar"] as const;
export type Moderacao = (typeof MODERACOES)[number];

// ──────────────────────────────────────────── tetos (o one-pager §15 e a copy)

export const COMENTARIOS_POR_PACOTE = 6;
export const PARAGRAFOS = { min: 4, max: 6 } as const;
export const MENSAGENS_NO_CHAT = 5;
export const MAX_CARACTERES_DA_MENSAGEM = 280;
export const TEMA = { min: 3, max: 60 } as const;
export const MANCHETE_MAX_CARACTERES = 80;
export const PARAGRAFO_MAX_PALAVRAS = 45;
export const COMENTARIO_PALAVRAS = { min: 8, max: 45 } as const;

// ──────────────────────────────────────────── o pacote

export interface ParagrafoDoRascunho {
  /** `p1`…`p6`, na ordem do post. */
  id: string;
  /** O nó crítico que este parágrafo carrega, ou `null` (texto de ligação). */
  no: No | null;
  texto: string;
  /** Só nos três nós: a versão que o UnooriaAI escreve quando o estudante pede. */
  corrigido?: string;
}

export interface ComentarioDoFeed {
  id: string;
  autor: string;
  handle: string;
  /** "02:40" — sempre de madrugada (o motor entrega de madrugada para TODOS). */
  horario: string;
  tipo: TipoDeComentario;
  texto: string;
}

/**
 * O conteúdo de um pacote — o que o professor aprova. O schema real é o Zod
 * de `contrato-de-rotas.ts#ConteudoDoPacoteSchema`, e a régua é
 * `regras/pacote.ts#problemasDoConteudo`.
 */
export interface ConteudoDoPacote {
  rascunho: ParagrafoDoRascunho[];
  /** O instituto inventado da alucinação ("DataBrasil 2026") — a fala da fonte o nomeia. */
  fonteInventada: string;
  /** O colega exposto no nó de LGPD ("Lucas Mendonça do 2º B"). */
  colega: string;
  /** O veículo copiado sem crédito ("caderno digital de tecnologia regional"). */
  veiculo: string;
  /**
   * A frase que o algoritmo PINÇA fora de contexto para o banner do feed. Mora
   * num parágrafo que sobrevive à correção (o plágio, entre aspas, continua com
   * ela): o cuidado do estudante não a tira do post — é a virada.
   */
  recorte: string;
  manchetes: Record<Manchete, string>;
  comentarios: ComentarioDoFeed[];
}

/** O banco curado padrão (01e + copy revisada, literais). */
export const PACOTE_PADRAO = {
  nome: "Convivência Escolar e Celular",
  disciplina: "interdisciplinar" as Disciplina,
  tema: "Convivência Escolar e Uso Consciente do Celular",
  assuntos: [
    "Uso do celular no intervalo",
    "Notificações durante as aulas",
    "Regras coletivas de convivência",
  ],
} as const;

export function conteudoDoPadrao(): ConteudoDoPacote {
  return {
    rascunho: [
      {
        id: "p1",
        no: null,
        texto:
          "O uso de smartphones no ambiente escolar exige equilíbrio e convivência sadia. Pesquisas recentes alertam para mudanças severas de comportamento entre estudantes do Ensino Médio.",
      },
      {
        id: "p2",
        no: "alucinacao",
        texto:
          "Segundo o DataBrasil 2026, 92% dos alunos do ensino médio sofrem de colapso de atenção crônico decorrente de mensagens instantâneas recebidas durante o período das aulas.",
        corrigido:
          "A própria escola pode observar como as mensagens instantâneas interferem na atenção durante as aulas, a partir da experiência de estudantes e professores.",
      },
      {
        id: "p3",
        no: "plagio",
        texto:
          "Como destaca o caderno digital de tecnologia regional: O celular transformou as salas de aula em arenas de disputa visual, nas quais os jovens priorizam reações imediatas e notificações rápidas em vez do aprendizado estruturado.",
        corrigido:
          "Segundo o caderno digital de tecnologia regional (fonte consultada): “O celular transformou as salas de aula em arenas de disputa visual, nas quais os jovens priorizam reações imediatas e notificações rápidas em vez do aprendizado estruturado.”",
      },
      {
        id: "p4",
        no: "lgpd",
        texto:
          "Na nossa própria escola, o estudante Lucas Mendonça do 2º B precisou de acompanhamento médico urgente após desenvolver taquicardia severa causada por notificações em grupos de mensagens.",
        corrigido:
          "Há relatos de estudantes que sentiram mal-estar físico com o excesso de notificações em grupos de mensagens, o que mostra a importância de cuidarmos uns dos outros.",
      },
      { id: "p5", no: null, texto: "Precisamos conversar abertamente sobre regras coletivas para o intervalo." },
    ],
    fonteInventada: "DataBrasil 2026",
    colega: "Lucas Mendonça do 2º B",
    veiculo: "caderno digital de tecnologia regional",
    recorte: "O celular transformou as salas de aula em arenas de disputa visual",
    manchetes: {
      neutra: "Convivência e Celular: Diálogo e Equilíbrio na Rotina Escolar",
      construtiva: "Menos Telas, Mais Presença: Como Melhorar Nossas Conversas no Recreio",
      sensacionalista: "O Celular Está Destruindo Nossas Relações na Escola? Participe do Debate",
    },
    comentarios: [
      {
        id: "c1",
        autor: "Clara",
        handle: "@clara_estudos",
        horario: "02:40",
        tipo: "saude_fisica",
        texto:
          "Não consigo pregar o olho com essa discussão... minha cabeça tá explodindo de dor e a tela não para de apitar com gente brigando.",
      },
      {
        id: "c2",
        autor: "Tomás",
        handle: "@tomas_2em",
        horario: "02:15",
        tipo: "saude_mental",
        texto:
          "Depois de ler esses ataques me sinto um lixo, nem coragem de ir pra aula amanhã eu tenho com todo mundo julgando.",
      },
      {
        id: "c3",
        autor: "Matheus",
        handle: "@math_reels",
        horario: "02:22",
        tipo: "saude_fisica",
        texto:
          "Tô travado aqui faz 4 horas seguidas rolando tela sem comer nada. Toda vez que tento desligar vem notificação me chamando pra treta.",
      },
      {
        id: "c4",
        autor: "Conta Desconhecida",
        handle: "@alerta_radar24h",
        horario: "02:50",
        tipo: "risco_seguranca",
        texto:
          "Identificamos a turma desse colégio pela localização da postagem. Mandem o contato do Lucas do 2º B no privado pra gente apurar.",
      },
      {
        id: "c5",
        autor: "Perfil de Ofertas",
        handle: "@promo_acessorios_tech",
        horario: "03:10",
        tipo: "risco_seguranca",
        texto:
          "Não percam o sono à toa! Fones com cancelamento de ruído e capas de celular com 50% de desconto no link da bio.",
      },
      {
        id: "c6",
        autor: "Júlia",
        handle: "@ju_silva",
        horario: "01:55",
        tipo: "neutro",
        texto:
          "A proposta do grêmio era falar de convivência, mas recortaram uma frase solta que fez todo mundo começar a discutir sem parar.",
      },
    ],
  };
}

// ──────────────────────────────────────────── as falas do UnooriaAI

/**
 * A abertura do chat — a fala LITERAL do PO (2026-10-22), com o tema do pacote
 * no lugar de "[tema customizado]". Substitui a boas-vindas do 01e.
 */
export function falaDeAbertura(tema: string): string {
  return `Olá, vamos montar seu post para ${tema}, você pode me pedir para montar o post, questionar minhas fontes e perguntar sobre direito digital. Vamos começar?`;
}

/** As intenções que o servidor reconhece no chat (`regras/intencoes.ts`). */
export const INTENCOES = [
  "gerar_rascunho",
  "auditar_fonte",
  "substituir_dado",
  "auditar_lgpd",
  "auditar_autoral",
  "revisao_geral",
  "confirmar_previa",
  "fora_do_tema",
] as const;
export type Intencao = (typeof INTENCOES)[number];

/** As falas que não respondem a uma intenção, mas ao estado da prévia. */
export type FalaDeEstado = "sem_rascunho" | "ja_corrigido" | "limite";

/**
 * O que o UnooriaAI responde a cada intenção — o 01e, com o nome do pacote no
 * lugar do do banco padrão. A resposta à fonte é a da copy revisada
 * (`e2.narrativa.ia_resposta_fonte`), que oferece a substituição.
 */
export function falaDoAssistente(
  fala: Intencao | FalaDeEstado,
  c: Pick<ConteudoDoPacote, "fonteInventada" | "colega" | "veiculo">,
): string {
  switch (fala) {
    case "gerar_rascunho":
      return "Redigi uma proposta completa para o Grêmio Estudantil, abordando impactos no aprendizado e regras de convivência. O texto integral foi enviado para a Prévia da Publicação. Deseja verificar informações específicas ou ajustar o tom antes de publicarmos?";
    case "auditar_fonte":
      return `Consultei bases gerais, mas não possuo registros de verificação do ${c.fonteInventada}. Deseja substituir por uma recomendação contextualizada da comunidade escolar?`;
    case "substituir_dado":
      return `Substituí a estatística atribuída ao ${c.fonteInventada} por uma orientação construída a partir da experiência da própria escola. A Prévia da Publicação já foi atualizada.`;
    case "auditar_lgpd":
      return `Você identificou um ponto crítico. Expor nome, turma e diagnóstico clínico sem autorização viola a Lei Geral de Proteção de Dados. Removi a menção a ${c.colega} na prévia, preservando o sigilo e abordando os sintomas de forma anônima e educativa.`;
    case "auditar_autoral":
      return `Correto. A reprodução integral de trecho jornalístico sem aspas ou atribuição direta ao autor configura plágio. Atualizei o rascunho na prévia: o parágrafo foi inserido entre aspas com a devida indicação do ${c.veiculo} como fonte consultada.`;
    case "revisao_geral":
      return "Rascunho reestruturado com sucesso. Eliminei a estatística sem comprovação, formatei a citação jornalística entre aspas com atribuição e removi todos os dados pessoais sensíveis de colegas. A versão segura e equilibrada já está consolidada na Prévia da Publicação.";
    case "confirmar_previa":
      return 'Sua prévia foi estruturada e está disponível para conferência. Quando estiver satisfeito com a integridade das informações, clique em "Exportar para o Unoovista" para avançarmos à seleção de manchete e postagem na rede.';
    case "fora_do_tema":
      return "Compreendo sua pergunta, mas meu módulo atual está dedicado exclusivamente à elaboração da campanha escolar do Grêmio Estudantil sobre convivência e tecnologia. Podemos retornar à análise do rascunho da nossa postagem?";
    case "sem_rascunho":
      return "Ainda não montei o post. Peça para eu montar o rascunho e começamos por ele.";
    case "ja_corrigido":
      return "Esse trecho já foi ajustado na Prévia da Publicação. Quer verificar outro ponto do rascunho?";
    case "limite":
      // 01e, "Aviso de Limite de Mensagens no Chat".
      return 'Atingimos o limite de interações planejadas para esta etapa de redação. Suas correções foram registradas. Por favor, analise a versão consolidada no painel lateral e clique em "Revisar Publicação" para darmos continuidade à campanha.';
  }
}

/** As três pílulas da copy revisada (`e2.rotulo.pilula_prompt_1..3`). */
export const PILULAS = [
  "Gerar rascunho de post sobre celular na escola",
  "Qual a fonte dessa pesquisa?",
  "Reescrever protegendo dados de terceiros",
] as const;

// ──────────────────────────────────────────── o Explicar (Etapa 5)

/**
 * Os indicadores da folha de bastidores. Dois comprovam que a rede buscou
 * retenção (os da copy: o pico das 02h30 e a retenção compulsiva); dois são
 * números do post que não dizem nada sobre isso. O GABARITO (`comprova`) não
 * desce: a tela recebe só id e rótulo, e o servidor diz se o clique comprova.
 */
export const INDICADORES = [
  { id: "pico-madrugada", rotulo: "Pico de Notificações: 02h30", comprova: true },
  { id: "retencao", rotulo: "Tempo de Retenção Compulsiva: +340%", comprova: true },
  { id: "curtidas", rotulo: "Curtidas na publicação: 37", comprova: false },
  { id: "tarde", rotulo: "Alcance entre 16h e 18h: 4%", comprova: false },
] as const;
export type IdDoIndicador = (typeof INDICADORES)[number]["id"];
export const IDS_DOS_INDICADORES: readonly string[] = INDICADORES.map((i) => i.id);
export const INDICADORES_QUE_COMPROVAM: readonly string[] = INDICADORES.filter((i) => i.comprova).map((i) => i.id);

/** A curva do post por faixa de horário (%), a mesma para TODOS: o incentivo é da rede, não do texto. */
export const ENTREGA_POR_HORARIO = [
  { faixa: "16h–18h", percentual: 4 },
  { faixa: "18h–21h", percentual: 9 },
  { faixa: "21h–00h", percentual: 14 },
  { faixa: "00h–01h", percentual: 11 },
  { faixa: "01h–03h30", percentual: 58 },
  { faixa: "03h30–06h", percentual: 4 },
] as const;

export const TEXTOS_DO_EXPLICAR = {
  titulo: "Bastidores da Entrega Algorítmica",
  instrucao:
    "Selecione os dois indicadores gráficos que comprovam que a rede priorizou reter usuários na tela em vez do bem-estar.",
  naoComprova: "Este indicador não mostra o que a rede priorizou. Procure o horário e o tempo de tela.",
  citacao:
    'Nico investigou no livro didático: "O objetivo não é a qualidade da informação, mas o engajamento... calcular a probabilidade de continuar navegando."',
  conceitos: [
    {
      id: "economia",
      texto:
        "Economia da Atenção: o modelo de negócio em que a atenção humana é a mercadoria vendida para os anunciantes da plataforma.",
    },
    {
      id: "metadados",
      texto:
        "Metadados: rastros invisíveis como tempo de pausa e horário de login lidos para antecipar reações sem autorização expressa.",
    },
    {
      id: "bolhas",
      texto:
        "Bolhas de Filtro: cada grupo recebe o recorte que confirma o que já pensa, e o mesmo post vira duas conversas que não se encontram.",
    },
  ],
  esperaAtiva: "Enquanto a turma conclui, explore o gráfico comparativo de engajamento por faixa de horário.",
} as const;

// ──────────────────────────────────────────── o professor

/** O roteiro do debate (one-pager §9) e as instruções de gatilho (copy revisada, D0-4). */
export const ROTEIRO_DO_DEBATE = [
  "Por que uma postagem informativa e bem cuidada acabou gerando discussões agressivas às duas da manhã no Unoovista?",
  "A plataforma entregou esse conteúdo de madrugada porque ele era útil para o descanso dos estudantes ou porque brigas mantêm as pessoas rolando a tela?",
  "Se o algoritmo lucra com o tempo de tela que passamos acordados, quem é o verdadeiro cliente da rede social e o que está sendo vendido?",
] as const;

export const INSTRUCOES_DO_GATILHO = {
  pausar:
    "Pressione 'Pausar Telas para Debate' para congelar as telas dos estudantes e conduza a roda de revelação antes de liberar as métricas analíticas.",
  liberar:
    "Depois do debate, libere a Etapa 5: os estudantes identificam o pico das 02h30 e a retenção na tela nos bastidores da publicação.",
} as const;

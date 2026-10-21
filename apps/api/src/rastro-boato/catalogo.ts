/**
 * O conteúdo da exp06ef2b — e o GABARITO dela.
 *
 * Este arquivo nunca cruza a fronteira do cliente inteiro. O que sai são
 * projeções sem `correta`, sem `desfecho` e sem `alcance`: as três coisas que a
 * missão mede o estudante por descobrir sozinho (regra inviolável nº 3). O tipo
 * público é construído por `Omit`, não por "lembrar de apagar o campo" — a
 * diferença é que o compilador reprova o vazamento.
 *
 * O feed vem da api e não do bundle pelo mesmo motivo da exp07ef1b: corrigir uma
 * palavra da copy não pode exigir republicar um caminho imutável no bucket.
 *
 * A copy é a da passada 2 do sheet, congelada. Alterar texto aqui sem alterar
 * o sheet faz a tela contar outra coisa que o documento aprovado.
 */

// ─────────────────────────────────────────────────────────────── conversas

export const IDS_DE_CHAT = ["gremio", "turma", "bairro", "tomas"] as const;
export type IdDeChat = (typeof IDS_DE_CHAT)[number];

/** Tipo de balão. `print` não existe aqui — o recorte de matéria é da exp07ef1b. */
export type TipoDeMensagem = "texto" | "audio" | "documento";

/**
 * Os metadados que o modal "Dados da mensagem" mostra.
 *
 * `saltos` é o número de encaminhamentos anônimos; `autor` é quem assina.
 * Nenhum campo diz "esta é a falsa": reconhecer o padrão a partir dos números
 * é exatamente a tarefa (EF06CO01). Um booleano `confiavel` aqui responderia a
 * pergunta antes de ela ser feita.
 */
export interface MetadadosDaMensagem {
  saltos: number | null;
  autor: string;
  /** Segunda linha do bloco de autoria. Vazia quando não há o que acrescentar. */
  detalhe: string;
  carimbo: string;
}

export interface MensagemDoFeed {
  id: string;
  chat: IdDeChat;
  autor: string;
  hora: string;
  tipo: TipoDeMensagem;
  texto: string;
  /** Transcrição verbatim do áudio. SEMPRE presente em `tipo: "audio"`:
   *  é acessibilidade (RNF-A11Y-002), não fallback de mídia ausente. */
  transcricao?: string;
  duracaoSeg?: number;
  /** O selo "Encaminhada com frequência" do app real. */
  encaminhada?: boolean;
  /** Rótulo do anexo, em `tipo: "documento"`. */
  anexo?: string;
  metadados: MetadadosDaMensagem;
}

export interface Conversa {
  id: IdDeChat;
  nome: string;
  /** Subtítulo do cabeçalho: "28 participantes" no grupo, o status no privado. */
  subtitulo: string;
  naoLidas: number;
  previa: string;
  hora: string;
}

export const CONVERSAS: readonly Conversa[] = [
  {
    id: "gremio",
    nome: "Grêmio Estudantil",
    subtitulo: "34 participantes",
    naoLidas: 3,
    previa: "URGENTE!! NÃO BEBAM A ÁGUA...",
    hora: "08:12",
  },
  {
    id: "turma",
    nome: "Turma 6º B",
    subtitulo: "28 participantes",
    naoLidas: 5,
    previa: "Áudio de 0:42",
    hora: "08:18",
  },
  {
    id: "bairro",
    nome: "Grupo do Bairro",
    subtitulo: "112 participantes",
    naoLidas: 1,
    previa: "Alguém viu a nota da escola?",
    hora: "08:31",
  },
  {
    id: "tomas",
    nome: "Tomás",
    subtitulo: "online",
    naoLidas: 0,
    previa: "Você viu o que tá rolando?",
    hora: "08:42",
  },
] as const;

/**
 * O feed. Seis mensagens auditáveis, e a cota é 3 — mais opções do que a
 * exigência de propósito: quem inspeciona só o mínimo escolhe QUAIS três, e a
 * escolha é dado (é o `mensagemId` que vai para `exp06ef2b_auditorias`).
 *
 * As três que sustentam a descoberta estão em conversas DIFERENTES: o boato no
 * grêmio, a amplificação anônima na turma e o laudo no bairro. Empilhá-las num
 * chat só faria a auditoria caber numa rolagem, e a missão perderia a
 * navegação que a Etapa 2 mede.
 */
export const MENSAGENS: readonly MensagemDoFeed[] = [
  {
    id: "msg-boato-01",
    chat: "gremio",
    autor: "+55 11 9****-**21",
    hora: "08:12",
    tipo: "texto",
    texto:
      "URGENTE!! NÃO BEBAM A ÁGUA DA ESCOLA!! Vários alunos passando mal no hospital e a direção quer abafar o caso!! REPASSEM AGORA PARA TODOS OS GRUPOS!!",
    encaminhada: true,
    metadados: {
      saltos: 6,
      autor: "Autor original: Não identificado",
      detalhe: "Origem inicial desconhecida",
      carimbo: "Encaminhada pela primeira vez há 3 dias",
    },
  },
  {
    id: "msg-audio-anonimo",
    chat: "turma",
    autor: "+55 11 9****-**07",
    hora: "08:18",
    tipo: "audio",
    texto: "Áudio de 0:42 (ruído de fundo)",
    duracaoSeg: 42,
    transcricao:
      "[Transcrição de áudio] Gente, o primo de um amigo meu viu o caminhão da vigilância na escola ontem à noite. Tão escondendo tudo, ó. Passa pra frente que é sério.",
    encaminhada: true,
    metadados: {
      saltos: 11,
      autor: "Autor original: Não identificado",
      detalhe: "Gravado por um número fora dos seus contatos",
      carimbo: "Encaminhada pela primeira vez há 2 dias",
    },
  },
  {
    id: "msg-laudo-pdf",
    chat: "bairro",
    autor: "Direção Escolar",
    hora: "08:30",
    tipo: "documento",
    texto: "Laudo da análise da água, feito ontem pelo laboratório da rede.",
    anexo: "Laudo_Tecnico_Qualidade_Agua_Oficial.pdf · 2,4 MB",
    metadados: {
      saltos: 0,
      autor: "Autor: Direção Escolar",
      detalhe: "Arquivo assinado digitalmente com laudo laboratorial",
      carimbo: "Emitido hoje às 08:30",
    },
  },
  {
    id: "msg-corrente-bairro",
    chat: "bairro",
    autor: "+55 11 9****-**44",
    hora: "08:31",
    tipo: "texto",
    texto:
      "Alguém viu a nota da escola? Me mandaram esse aviso da água em três grupos diferentes hoje de manhã.",
    encaminhada: true,
    metadados: {
      saltos: 9,
      autor: "Autor original: Não identificado",
      detalhe: "Origem inicial desconhecida",
      carimbo: "Encaminhada pela primeira vez há 3 dias",
    },
  },
  {
    id: "msg-gremio-duvida",
    chat: "gremio",
    autor: "Bianca",
    hora: "08:21",
    tipo: "texto",
    texto: "Peraí, alguém aqui viu isso acontecer? Ou todo mundo só recebeu de outro grupo?",
    metadados: {
      saltos: null,
      autor: "Autor: Bianca",
      detalhe: "Escrita aqui, neste grupo",
      carimbo: "Enviada hoje às 08:21",
    },
  },
  {
    id: "msg-tomas-privado",
    chat: "tomas",
    autor: "Tomás",
    hora: "08:42",
    tipo: "texto",
    texto:
      "Você viu o que tá rolando? O aviso da água correu quatro grupos em dez minutos. A nota da direção quase ninguém repassou.",
    metadados: {
      saltos: null,
      autor: "Autor: Tomás",
      detalhe: "Escrita aqui, nesta conversa",
      carimbo: "Enviada hoje às 08:42",
    },
  },
] as const;

/** Quantas mensagens DISTINTAS o estudante precisa auditar para a crise chegar. */
export const AUDITORIAS_EXIGIDAS = 3;

export const IDS_DE_MENSAGEM = MENSAGENS.map((m) => m.id);

export function ehMensagem(id: string): boolean {
  return MENSAGENS.some((m) => m.id === id);
}

export function chatDaMensagem(id: string): IdDeChat | null {
  return MENSAGENS.find((m) => m.id === id)?.chat ?? null;
}

// ───────────────────────────────────────────────────── a crise e as 3 opções

/** A mensagem que chega quando a cota de auditoria fecha. É o pico da missão. */
export const CONVOCACAO = {
  id: "msg-protesto",
  chat: "turma" as IdDeChat,
  autor: "+55 11 9****-**07",
  hora: "08:47",
  duracaoSeg: 15,
  texto: "Áudio de 0:15",
  transcricao:
    "[Transcrição de áudio] Galera, todo mundo na porta da escola no segundo tempo! Vamos parar tudo até trocarem a água! Repassem pra todo mundo já!",
  banner: "Boato em circulação rápida em 4 grupos",
} as const;

export const IDS_DE_OPCAO = ["A", "B", "C"] as const;
export type IdDeOpcao = (typeof IDS_DE_OPCAO)[number];

/** Como a rede reage à escolha. É isto que o mapa da Etapa 4 desenha. */
export type Desfecho = "interrompeu" | "amplificou" | "silenciou";

interface Opcao {
  id: IdDeOpcao;
  texto: string;
  /** GABARITO. Nunca sai daqui. */
  desfecho: Desfecho;
  /** A reação do grupo, logo depois do envio. Diegética, nunca um juízo. */
  reacao: string;
}

/**
 * As três intervenções.
 *
 * **A e C não são a mesma coisa, e o mapa mostra isso.** Encaminhar amplifica
 * ativamente; apagar para si mesmo deixa a corrente correr sem você. O alcance
 * final difere (1.200 contra 850), e é essa diferença que sustenta o que a
 * metade da missão ainda não sabe: a inação alimenta a mesma curva.
 *
 * Nenhum texto rotula quem escolheu — nem aqui, nem na reação. A consequência
 * é matemática e aparece no grafo (PED-11).
 */
const OPCOES: readonly Opcao[] = [
  {
    id: "A",
    texto: "Encaminhar imediatamente para avisar outros grupos",
    desfecho: "amplificou",
    reacao: "Pedro: “Gente, recebi em mais três grupos agora! O protesto vai acontecer!”",
  },
  {
    id: "B",
    texto: "Denunciar conteúdo e responder fixando o laudo oficial",
    desfecho: "interrompeu",
    reacao:
      "Mariana: “Nossa, ainda bem que você mandou o laudo! Já ia repassar o áudio no grupo da van.”",
  },
  {
    id: "C",
    texto: "Apagar a mensagem para si mesmo e não responder",
    desfecho: "silenciou",
    reacao: "Pedro: “Gente, recebi em mais três grupos agora! O protesto vai acontecer!”",
  },
] as const;

/** O que a tela recebe: id e texto. `desfecho` e `reacao` ficam no servidor. */
export type OpcaoPublica = Omit<Opcao, "desfecho" | "reacao">;

export function opcoesPublicas(): OpcaoPublica[] {
  return OPCOES.map(({ id, texto }) => ({ id, texto }));
}

export function opcao(id: IdDeOpcao): Opcao {
  const achada = OPCOES.find((o) => o.id === id);
  /* Impossível pelo Zod do contrato; o lançamento existe para o tipo não ser
     `Opcao | undefined` no service e ninguém precisar de `!`. */
  if (!achada) throw new Error(`opção fora do catálogo: ${id}`);
  return achada;
}

/** A intervenção que quebra a corrente — usada só pela pontuação, no servidor. */
export const OPCAO_QUE_INTERROMPE: IdDeOpcao = "B";

// ────────────────────────────────────────────────── o ciclo da desinformação

export const IDS_DE_BLOCO = ["gatilho", "repasse", "sem-checagem", "desfecho"] as const;
export type IdDeBloco = (typeof IDS_DE_BLOCO)[number];

export interface Bloco {
  id: IdDeBloco;
  texto: string;
}

/**
 * Os quatro blocos causais, embaralhados na tela pelo cliente.
 *
 * A ORDEM CERTA é a própria ordem desta lista, e ela não sai daqui: o cliente
 * recebe os blocos e devolve a sequência que montou, e quem confere é
 * `regras/ciclo.ts`. Mandar a ordem correta junto com os textos poria o
 * gabarito no DevTools.
 */
const BLOCOS: readonly Bloco[] = [
  { id: "gatilho", texto: "Gatilho emocional de urgência ou medo" },
  { id: "repasse", texto: "Facilidade do botão de repasse rápido" },
  { id: "sem-checagem", texto: "Ausência de auditoria da fonte original" },
  { id: "desfecho", texto: "Interrupção por fato ou contágio contínuo" },
] as const;

export const ORDEM_CORRETA: readonly IdDeBloco[] = BLOCOS.map((b) => b.id);

/** Os blocos como a tela os recebe — sem posição, que é o que ela vai montar. */
export function blocosPublicos(): Bloco[] {
  return BLOCOS.map(({ id, texto }) => ({ id, texto }));
}

// ────────────────────────────────────────────────────────────── o percurso

export const PERGUNTA_DO_PERCURSO =
  "Qual gatilho emocional você notou que mais acelera o repasse de boatos nos grupos da escola? O que você fará antes de clicar em encaminhar na próxima vez?";

/** Teto do campo livre. É fala de estudante, não redação. */
export const TETO_DA_REFLEXAO = 280;

/**
 * O episódio de recapitulação, em texto.
 *
 * **Sem arquivo de áudio, e isso não é pendência.** O `pod-06-rastro-boato-01`
 * do brief de assets ainda não foi gravado, e a missão roda igual — pelo mesmo
 * princípio da exp07ef1b: a transcrição está sempre na tela por acessibilidade, e
 * quando a locução chegar ela entra ao lado do texto, não no lugar dele.
 */
export const PODCAST = {
  titulo: "Entre Redes Express: O Rastro do Boato",
  blocos: [
    {
      rotulo: "Abertura",
      falas: [
        "Clara: Fala, turma do sexto ano! Hoje a gente fala de algo que corre mais rápido do que aviso de recreio: o boato.",
        "Rafa: Você pisca, e uma mensagem cheia de caixa alta já rodou a família, a turma e o bairro. E quase ninguém para para ver quem escreveu.",
      ],
    },
    {
      rotulo: "O que aconteceu",
      falas: [
        "Clara: Uma mensagem sem autor sobre a água da escola explodiu em quatro grupos em dez minutos.",
        "Rafa: E quando a direção publicou o laudo verdadeiro, quase ninguém repassou. A verdade andava a passos lentos enquanto o boato voava.",
      ],
    },
    {
      rotulo: "A revelação",
      falas: [
        "Rafa: O botão de encaminhar reduz o atrito. Um clique seu multiplica o alcance por dezenas de pessoas em segundos.",
        "Clara: A rede não avalia se o texto é fato ou invenção; ela só mede volume e velocidade. O freio não é uma máquina, é você quando abre os dados da mensagem.",
      ],
    },
    {
      rotulo: "A provocação",
      falas: [
        "Rafa: Quando chegar aquela mensagem alarmista pedindo repasse imediato, qual vai ser a sua escolha?",
        "Clara: Espalhar o medo no susto, ou checar os fatos e ser o nó da rede que interrompe o boato?",
      ],
    },
  ],
} as const;

// ───────────────────────────────────────────── o catálogo para o guia da aula

/** Uma das três intervenções, como o PROFESSOR a lê — com o gabarito. */
export interface IntervencaoParaOProfessor {
  id: IdDeOpcao;
  /** O texto exato que a criança lê no cartão. */
  texto: string;
  /** GABARITO: o que a rede faz com essa escolha. */
  desfecho: Desfecho;
  /** A fala do grupo logo depois do envio — é ela que a turma comenta. */
  reacao: string;
  /** `true` na única que quebra a corrente. */
  interrompe: boolean;
}

/**
 * O material do guia da aula: as três intervenções COM desfecho e reação, e o
 * ciclo na ordem certa.
 *
 * O guia escrevia isto em prosa — "a opção que respondeu no grupo em vez de
 * sair dele" — e o professor conduzia o debate sem nunca ter lido as três
 * frases. Descrever a opção em vez de mostrá-la também esconde o que mais
 * importa na missão: **A e C têm a MESMA reação**, e é isso que sustenta a
 * lição de que a inação alimenta a mesma curva. Em paráfrase, essa coincidência
 * simplesmente não aparece.
 *
 * `ciclo` vai na ORDEM CORRETA, ao contrário de `blocosPublicos()`: quem monta
 * a sequência é a turma, e quem confere se ela acertou é o professor.
 */
export function materialDoProfessor(): {
  intervencoes: IntervencaoParaOProfessor[];
  ciclo: Bloco[];
} {
  return {
    intervencoes: OPCOES.map(({ id, texto, desfecho, reacao }) => ({
      id,
      texto,
      desfecho,
      reacao,
      interrompe: id === OPCAO_QUE_INTERROMPE,
    })),
    ciclo: BLOCOS.map(({ id, texto }) => ({ id, texto })),
  };
}

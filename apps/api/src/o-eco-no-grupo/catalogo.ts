/**
 * Catálogo da exp-07-o-eco-no-grupo — o conteúdo da missão e o GABARITO.
 *
 * Tudo o que a criança lê no grupo "Comunidade Alerta" está aqui, e não no
 * bundle: o texto é conteúdo da missão, e mantê-lo no servidor permite corrigir
 * uma palavra sem republicar um caminho imutável no bucket. O que fica no
 * cliente são os rótulos de interface ("Fechar", "Enviar resposta ao grupo").
 *
 * `Opcao.correta` e `Opcao.desfecho` são o gabarito (regra inviolável nº 3):
 * decidem a reação do bairro e a pontuação, e NUNCA saem daqui sem passar por
 * `semGabarito`. O mesmo vale para `Estrategia.prioritaria` e
 * `Justificativa.correta`, que são o gabarito do "Meu percurso".
 *
 * A copy é a passada 2 do sheet, verbatim. Não a reescreva por conta própria:
 * as falas gravadas (`midia.ts`) têm de casar palavra por palavra com a
 * transcrição na tela, e o brief de assets reprova o áudio que divergir.
 */

// ---------------------------------------------------------------- o feed

export type TipoDeMensagem = "texto" | "audio" | "foto" | "print";

export interface MensagemDoFeed {
  id: string;
  autor: string;
  hora: string;
  tipo: TipoDeMensagem;
  /** O balão, ou a legenda da mídia. */
  texto: string;
  /** Id em `MIDIA` (foto ou áudio). Ausente em mensagem de texto puro. */
  midia?: string;
  /** Transcrição síncrona do áudio — obrigatória: é o canal que sustenta a
   *  acessibilidade e o fallback quando a mídia não carrega (RNF-ACES-001). */
  transcricao?: string;
  duracaoSeg?: number;
  /** O selo nativo de duas setas. Só os dois prints virais o têm. */
  encaminhada?: boolean;
  /** O print que abre o visualizador da matéria íntegra — o Aha da missão. */
  abreMateria?: boolean;
}

/**
 * Exatamente 8 mensagens, em ordem cronológica: 3 textos opinativos, 1 áudio
 * com transcrição, 2 fotos com legenda e 2 prints com o selo de encaminhamento.
 *
 * A cardinalidade é regra, não estilo: o teto cognitivo do 7º ano foi contado
 * para 8 (Cowan / Pascual-Leone), e "rolagem infinita" era o distrator que a
 * spec removeu de propósito.
 */
export const FEED: readonly MensagemDoFeed[] = [
  {
    id: "m1",
    autor: "Carlos",
    hora: "14:31",
    tipo: "texto",
    texto:
      "Pessoal, vocês viram isso? Acabaram com a feira cultural da praça! Um absurdo a prefeitura não fazer nada!",
  },
  {
    id: "m2",
    autor: "Carlos",
    hora: "14:32",
    tipo: "print",
    texto:
      'Manchete: "Confusão e protesto bloqueiam praça durante evento comunitário no Bairro São Pedro".',
    midia: "praca-cerrada",
    encaminhada: true,
  },
  {
    id: "m3",
    autor: "Dona Lúcia",
    hora: "14:35",
    tipo: "audio",
    texto: "Mensagem de voz",
    midia: "dona-lucia-boato",
    transcricao:
      "Gente, me mandaram no outro grupo que teve briga feia na praça e que a polícia mandou fechar tudo! Ninguém sai de casa hoje!",
    duracaoSeg: 18,
  },
  {
    id: "m4",
    autor: "Seu Jorge",
    hora: "14:37",
    tipo: "texto",
    texto: "Todo ano é a mesma coisa. Ninguém respeita os moradores do bairro!",
  },
  {
    id: "m5",
    autor: "Marcos Admin",
    hora: "14:39",
    tipo: "texto",
    texto: "Vizinhos, vamos manter a calma até confirmarmos as informações oficiais.",
  },
  {
    id: "m6",
    autor: "Carlos",
    hora: "14:41",
    tipo: "texto",
    texto:
      "Confirmar o quê, Marcos? O print do portal de notícias tá rodando em cinco grupos diferentes já!",
  },
  {
    id: "m7",
    autor: "Seu Jorge",
    hora: "14:44",
    tipo: "foto",
    texto:
      'Foto: Viaturas policiais estacionadas na esquina da Rua das Flores. Legenda: "Clima tenso no local".',
    midia: "viatura-transito",
  },
  {
    id: "m8",
    autor: "Carlos",
    hora: "14:46",
    tipo: "print",
    texto:
      "Imagem recortada de matéria jornalística destacando apenas o início da manifestação. Toque para ver matéria completa.",
    midia: "praca-cerrada",
    encaminhada: true,
    abreMateria: true,
  },
];

// ------------------------------------------------------------- a matéria

/**
 * O par que sustenta o Aha: o que o print mostrava e o que ele cortou.
 *
 * A página é montada em HTML pela experiência (o layout do portal, o logotipo,
 * os metadados), com a FOTO gerada por IA dentro — modelo de imagem erra texto
 * longo, e o parágrafo suprimido precisa ser legível, selecionável e com
 * contraste medido. O par casado sai por construção: é o mesmo componente com
 * dois recortes, então data, repórter e tipografia não podem divergir.
 */
export const MATERIA = {
  fonte: "Portal Gazeta Regional · Publicado hoje às 14h20",
  /** A manchete que circulou no print — o enquadramento parcial. */
  manchetePrint:
    "Confusão e protesto bloqueiam praça durante evento comunitário no Bairro São Pedro",
  /** O título verdadeiro da reportagem. */
  titulo:
    "Manifestação pacífica reúne moradores e evento cultural ocorre com apoio de trânsito da PM no São Pedro",
  paragrafoExibido:
    "Na tarde deste sábado, cerca de duzentas pessoas se reuniram na Praça Central para o festival de artes comunitárias. Houve breve retenção de veículos na Rua das Flores devido ao fluxo de pedestres.",
  /** O trecho cortado. Vai isolado, em alto contraste — não-negociável de ofício. */
  paragrafoSuprimido:
    "TRECHO OMITIDO NO PRINT: A Polícia Militar esteve no local exclusivamente para coordenar o desvio dos ônibus e garantiu que o evento possuía alvará regular, transcorrendo sem qualquer incidente de violência.",
  /** A foto em plano cerrado é a do print; a aberta é a da matéria íntegra. */
  fotoDoPrint: "praca-cerrada",
  fotoDaMateria: "praca-aberta",
} as const;

// ----------------------------------------------------------- a decisão

export type IdDeOpcao = "A" | "B" | "C";
export type Desfecho = "ruido" | "checada" | "conflito";

export interface Opcao {
  id: IdDeOpcao;
  texto: string;
  /** GABARITO: decide a reação do bairro. */
  desfecho: Desfecho;
  /** GABARITO: a contraprova fundamentada. */
  correta: boolean;
}

export type OpcaoPublica = Omit<Opcao, "desfecho" | "correta">;

export const OPCOES: readonly Opcao[] = [
  {
    id: "A",
    texto:
      "Repassar o áudio da moradora alarmada para reforçar a reclamação dos vizinhos.",
    desfecho: "ruido",
    correta: false,
  },
  {
    id: "B",
    texto:
      'Responder citando o print: "Gente, a matéria completa mostra que o evento tinha autorização e a polícia só organizou o trânsito! Link: gazeta.com/evento-sp"',
    desfecho: "checada",
    correta: true,
  },
  {
    id: "C",
    texto:
      "Reagir com emoji de raiva em todas as postagens e sair do grupo imediatamente.",
    desfecho: "conflito",
    correta: false,
  },
];

/** Para o `z.enum` dos controllers — a tupla não-vazia que o Zod exige. */
export const IDS_DE_OPCAO = OPCOES.map((o) => o.id) as [IdDeOpcao, ...IdDeOpcao[]];

const OPCAO_POR_ID = new Map(OPCOES.map((o) => [o.id, o]));

export function semGabarito(opcao: Opcao): OpcaoPublica {
  const { desfecho: _desfecho, correta: _correta, ...publica } = opcao;
  return publica;
}

/** Lança em id desconhecido: quem chega aqui já passou pelo Zod. */
export function opcaoDo(id: string): Opcao {
  const opcao = OPCAO_POR_ID.get(id as IdDeOpcao);
  if (!opcao) throw new Error(`opção desconhecida no catálogo: ${id}`);
  return opcao;
}

// ------------------------------------------------- as reações do bairro

export interface Reacao {
  autor: string;
  texto: string;
  /** Atraso, em milissegundos, do "digitando..." desta reação. A cadência
   *  2s → 3s → 2s é não-negociável de ofício: a espera é o pico da missão. */
  atrasoMs: number;
}

/**
 * O roteiro que o bairro segue quando a IA está desligada ou falhou.
 *
 * Não é placeholder: é o desfecho canônico, e a missão fecha inteira sem
 * modelo nenhum. Com IA, as falas mudam para responder ao que o estudante de
 * fato postou — mas quem decide QUAL desfecho acontece continua sendo
 * `Opcao.desfecho`, aqui no servidor.
 */
export const REACOES: Readonly<Record<Desfecho, readonly Reacao[]>> = {
  checada: [
    {
      autor: "Carlos",
      texto:
        "Caramba, quase passei vergonha repassando isso pros meus parentes. Valeu por mandar a matéria inteira!",
      atrasoMs: 2000,
    },
    {
      autor: "Dona Lúcia",
      texto: "Ai que alívio, minha filha. Já ia trancar a casa toda por nada.",
      atrasoMs: 3000,
    },
    {
      autor: "Marcos Admin",
      texto:
        "Excelente esclarecimento! O print que circulou omitiu a autorização da prefeitura. Mensagem fixada para evitar pânico no bairro.",
      atrasoMs: 2000,
    },
  ],
  ruido: [
    {
      autor: "Dona Lúcia",
      texto: "Meu Deus, vou trancar tudo! Então é verdade mesmo o que falaram.",
      atrasoMs: 2000,
    },
    {
      autor: "Seu Jorge",
      texto: "Isso não vai ficar assim! Vou mandar pro grupo da rua também.",
      atrasoMs: 3000,
    },
    {
      autor: "Marcos Admin",
      texto: "Gente, alguém tem a reportagem inteira? Só áudio repassado não dá para confirmar.",
      atrasoMs: 2000,
    },
  ],
  conflito: [
    {
      autor: "Carlos",
      texto: "Saiu do grupo? E a gente fica aqui sem entender nada do que aconteceu.",
      atrasoMs: 2000,
    },
    {
      autor: "Dona Lúcia",
      texto: "Não briguem, pelo amor de Deus. Eu só quero saber se posso sair de casa.",
      atrasoMs: 3000,
    },
    {
      autor: "Marcos Admin",
      texto: "Sem a fonte oficial a discussão só esquenta. Continuo esperando alguém confirmar.",
      atrasoMs: 2000,
    },
  ],
};

/** A comemoração de Amara no privado, depois do alfinete do Admin. */
export const AMARA_CELEBRA =
  "Você mandou muito bem! Mostrou que quem cortou o print manipulou a história toda. O grupo acalmou na hora!";

/** O cutucão por ociosidade — a única vez que Amara fala durante a investigação,
 *  e só depois de 4 minutos de tela parada. */
export const AMARA_CUTUCAO =
  "Conseguiu abrir o print? Veja o que cortaram no final da reportagem antes que o grupo pire!";

// ------------------------------------------------------ a sistematização

export interface CardDeSintese {
  id: string;
  titulo: string;
  corpo: string;
}

export const CARDS: readonly CardDeSintese[] = [
  {
    id: "enquadramento",
    titulo: "1. O Enquadramento Parcial",
    corpo:
      "Um print isolado mostra apenas uma fatia do fato. Ao recortar a imagem, quem compartilha escolhe o sentimento que quer provocar no leitor.",
  },
  {
    id: "contexto",
    titulo: "2. O Contexto Omitido",
    corpo:
      "A reportagem original continha a informação oficial sobre a autorização do evento. A omissão desse trecho gerou o falso alarme no grupo.",
  },
  {
    id: "rotulo",
    titulo: "3. O Rótulo de Encaminhamento",
    corpo:
      'O selo "Encaminhada com frequência" indica que a mensagem já perdeu o vínculo com a fonte original. Exige checagem redobrada antes de repassar.',
  },
];

export const TOTAL_DE_CARDS = CARDS.length;

// ---------------------------------------------------------- Meu percurso

export interface Estrategia {
  id: string;
  texto: string;
  /** GABARITO do "Meu percurso": as duas que a missão ensinou. */
  prioritaria: boolean;
}

export interface Justificativa {
  id: string;
  texto: string;
  /** GABARITO. */
  correta: boolean;
}

export type EstrategiaPublica = Omit<Estrategia, "prioritaria">;
export type JustificativaPublica = Omit<Justificativa, "correta">;

export const ESTRATEGIAS: readonly Estrategia[] = [
  {
    id: "buscar_fonte",
    texto: "Buscar a reportagem completa no portal original para ler o contexto inteiro.",
    prioritaria: true,
  },
  {
    id: "reparar_selo",
    texto: "Observar se há o selo de encaminhamento em massa e questionar a autoria.",
    prioritaria: true,
  },
  {
    id: "espalhar_rapido",
    texto: "Encaminhar imediatamente para parentes avisando sobre o perigo relatado.",
    prioritaria: false,
  },
  {
    id: "concordar_emocao",
    texto: "Repassar o áudio se a pessoa que gravou parecer brava e convincente.",
    prioritaria: false,
  },
];

export const JUSTIFICATIVAS: readonly Justificativa[] = [
  {
    id: "evidencia_desarma",
    texto:
      "Porque a evidência factual comprovada encerra o boato sem transformar a conversa em disputa pessoal.",
    correta: true,
  },
  {
    id: "vencer_grito",
    texto: "Porque quem manda mais mensagens primeiro convence a maioria dos membros do grupo.",
    correta: false,
  },
];

/** Quantas estratégias o formulário exige. A pergunta é "quais 2 ações são
 *  prioritárias" — uma lista de 1 ou de 3 mediria outra coisa. */
export const ESTRATEGIAS_EXIGIDAS = 2;

export const IDS_DE_ESTRATEGIA = ESTRATEGIAS.map((e) => e.id) as [string, ...string[]];
export const IDS_DE_JUSTIFICATIVA = JUSTIFICATIVAS.map((j) => j.id) as [string, ...string[]];

export function estrategiasSemGabarito(): EstrategiaPublica[] {
  return ESTRATEGIAS.map(({ prioritaria: _prioritaria, ...publica }) => publica);
}

export function justificativasSemGabarito(): JustificativaPublica[] {
  return JUSTIFICATIVAS.map(({ correta: _correta, ...publica }) => publica);
}

// ------------------------------------------------------------- autoria

/**
 * Autoria e revisão do gabarito pedagógico (critério PED-04 da banca).
 *
 * `[ABERTO]` é honesto e deliberado: o gate final de produto pediu os nomes das
 * pessoas físicas responsáveis, e eles não chegaram. Fica aqui, no servidor,
 * onde o gabarito mora — não numa planilha que ninguém abre.
 */
export const GABARITO_ASSINADO = {
  autor: "[ABERTO — responsável de produto: nomear autor]",
  revisor: "[ABERTO — responsável de produto: nomear revisor]",
  versaoDoInstrumento: "1.0.0",
} as const;

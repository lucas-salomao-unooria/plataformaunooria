import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de Quem Mandou Isso? (ADR-150) — o roteiro do
 * one-pager v2.2 (seção 11, "Podcast de recapitulação": Lucas e Camila, cerca
 * de 3m40s), com três ajustes que a missão pediu depois dos artefatos:
 *
 * - o grupo é no **Unoochat** (ADR-134), não no WhatsApp;
 * - a última fala do Bloco 4 dizia "foi essa regra que vocês construíram na
 *   tela final": a regra Se/Então saiu da missão (ADR-145), e a fala agora
 *   aponta o telão, onde a turma viu a revelação;
 * - a mensagem desesperada que era verdadeira perdeu os "emojis de fogo",
 *   que nenhuma mensagem do banco padrão tem.
 *
 * É do PROFESSOR, como o da A Seleção. As três falas que contam o que a turma
 * viu — o que o grupo trazia, o link formal que não era verdadeiro e a
 * mensagem desesperada que era — são as VAGAS: no banco padrão, as do sheet;
 * num tema da IA, a IA as reescreve e o professor revisa na customização.
 *
 * Puro — sem Nest e sem Prisma —, porque o contrato da aprovação lê as vagas
 * daqui. Quem liga a missão ao módulo `podcast` é `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da vivência",
  revelacao: "A revelação",
  provocacao: "Provocação e conexão com a vida real",
  encerramento: "Encerramento",
};

// ──────────────────────────────────────────── o texto aprovado

const ABERTURA: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "Fala, galera! Tá no ar o Recapitulação Unooria! Eu sou o Lucas..." },
  {
    falante: "Camila",
    texto:
      "...e eu sou a Camila! Se você acabou de sair do grupo da Turma 5ºB no Unoochat com aquela sensação de 'Espera aí, como assim eu caí nessa?', puxa a cadeira que a conversa hoje é com você!",
  },
  {
    falante: "Lucas",
    texto:
      "Caramba, Camila, a Nina jogou uma missão de responsa no nosso colo, hein? Encaminhar só três mensagens pro Mural da Turma pra resolver a confusão. Parecia fácil... até a gente ver o resultado no telão!",
  },
];

const RECAPITULACAO_DEDO: FalaDoPodcast = {
  falante: "Lucas",
  texto:
    "E o dedo coça pra encaminhar na hora, né? A gente bate o olho na palavra 'urgente' ou vê aquele amigo mandando e pensa: 'Nossa, tenho que avisar todo mundo antes que dê ruim!'.",
};

const RECAPITULACAO_SAIDA: FalaDoPodcast = {
  falante: "Camila",
  texto:
    "E aí você escolheu três, mandou pro Mural, votou na enquete achando que tinha feito a checagem perfeita. Mas aí... o professor acionou a revelação no telão da sala!",
};

const REVELACAO_SAIDA: readonly FalaDoPodcast[] = [
  {
    falante: "Lucas",
    texto:
      "A gente percebeu que o cérebro da gente é meio preguiçoso quando tá navegando rápido: a gente confunde 'tom sério' com verdade, e acha que 'urgência' é motivo pra sair repassando sem olhar de onde veio.",
  },
  {
    falante: "Camila",
    texto:
      "Exatamente. A verdade de uma notícia não tá na roupa que ela veste. Uma mentira pode ser escrita com muita calma e elegância pra te enganar, e uma verdade pode vir num grito de alerta. Encaminhar antes de checar é repassar a confusão pra frente.",
  },
];

const PROVOCACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Camila",
    texto:
      "E o que a gente faz quando sai da escola e abre o grupo da família? Quando chega aquele áudio apavorado de alguém que você adora dizendo que vai faltar água no bairro inteiro ou que amanhã não tem aula?",
  },
  {
    falante: "Lucas",
    texto:
      "Você respira fundo e aplica a sua regra de ouro! Se a mensagem pede urgência ou parece assustadora demais, você não repassa: você vai no site oficial, compara com outra fonte e pergunta onde aquilo saiu.",
  },
  {
    falante: "Camila",
    texto: "Quem checa primeiro protege todo mundo. Foi isso que a turma inteira descobriu junta no telão hoje!",
  },
];

const ENCERRAMENTO: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "É isso aí! Olho vivo no feed, dedo calmo no botão de encaminhar e até a próxima missão!" },
  { falante: "Camila", texto: "Valeu, turma! Até mais!" },
];

// ──────────────────────────────────────────── as vagas do tema

export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [
  {
    id: "grupo",
    falante: "Camila",
    sobre: "o que o grupo trazia",
    instrucao:
      'As oito mensagens do grupo como a turma as viu, pelos tipos e pelo jeito delas (mensagem urgente e emocionada, link com cara de notícia séria, imagem de aviso), sem dizer quais eram verdadeiras. Comece por "Parecia fácil demais, Lucas! A gente entra naquele feed com oito mensagens pipocando."',
  },
  {
    id: "falsaNeutra",
    falante: "Lucas",
    sobre: "a mensagem calma que não era verdadeira",
    instrucao:
      'Uma mensagem FALSA e de tom NEUTRO (calma, formal, com cara de oficial) do material — de preferência o link ou a imagem — e a surpresa de descobrir que ela não era verdadeira. Comece por "Aí veio o tombo da turma inteira!".',
  },
  {
    id: "verdadeiraEmocional",
    falante: "Camila",
    sobre: "a mensagem desesperada que era verdadeira",
    instrucao:
      'Uma mensagem VERDADEIRA e de tom EMOCIONAL (desesperada, cheia de exclamação) do material, que muita gente achou exagero, e a surpresa de descobrir que o fato aconteceu. Comece por "E aquela mensagem".',
  },
];

/** As três falas do banco padrão ("O Mistério do Passeio ao Museu") — as do sheet. */
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {
  grupo:
    "Parecia fácil demais, Lucas! A gente entra naquele feed com oito mensagens pipocando. Tinha mensagem com caixa alta e dez pontos de exclamação dizendo que era urgente, tinha link bonitão com cara de notícia séria, tinha foto de aviso com carimbo...",
  falsaNeutra:
    "Aí veio o tombo da turma inteira! Aquele link super formal, todo arrumadinho, com vocabulário difícil... era FALSO! Uma mentira fantasiada de comunicado oficial!",
  verdadeiraEmocional:
    "E aquela mensagem cheia de exclamação e com cara de desespero que muita gente ignorou achando que era exagero? Era VERDADEIRA! O fato tinha acontecido mesmo!",
};

/** O roteiro inteiro, com as três falas do tema no lugar delas. */
export function roteiroDoPodcast(tema: FalasDoTema): TrechoDoRoteiro[] {
  const fala = (id: string, falante: string): FalaDoPodcast => ({ falante, texto: (tema[id] ?? "").trim() });
  const falasDe: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
    abertura: ABERTURA,
    recapitulacao: [fala("grupo", "Camila"), RECAPITULACAO_DEDO, RECAPITULACAO_SAIDA],
    revelacao: [fala("falsaNeutra", "Lucas"), fala("verdadeiraEmocional", "Camila"), ...REVELACAO_SAIDA],
    provocacao: PROVOCACAO,
    encerramento: ENCERRAMENTO,
  };
  return BLOCOS_DO_PODCAST.map((bloco) => ({
    bloco,
    titulo: TITULOS[bloco],
    falas: falasDe[bloco].map((f) => ({ ...f })),
  }));
}

// ──────────────────────────────────────────── a voz

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Lucas", timbre: "jovem-masculino" },
  { nome: "Camila", timbre: "jovem-feminino" },
];

/** A direção de atuação, a do one-pager: Lucas curioso e enérgico, Camila reflexiva e articuladora. */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores de 20 a 25 anos que conversam direto com crianças de 10 e 11 anos do 5º ano que acabaram de fazer uma missão de letramento digital num grupo de mensagens da turma. " +
  "Conversa natural, ritmo animado e caloroso, sem tom de professor dando aula e sem voz infantilizada. " +
  "Lucas é curioso e enérgico. Camila é reflexiva e articuladora. " +
  "As falas se emendam como numa conversa de verdade, com pausas curtas entre uma e outra.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem (o hash do arquivo muda junto). */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};

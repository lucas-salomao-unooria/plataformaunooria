import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de O Efeito Amplificador (ADR-150, ADR-191) —
 * "Recapitulação Unooria: O Algoritmo Não Dorme", Alex e Sam, cerca de 3 min 30 s.
 *
 * O texto é o do one-pager aprovado (§11), LITERAL, com as rubricas de trilha
 * que o PO corrigiu em 2026-10-22 ("Batida eletrônica leve, moderna e curiosa"
 * na abertura, "Encerramento enérgico que esmaece gradualmente" no fim, e
 * nenhuma outra). A trilha não é fala: vai na DIREÇÃO de atuação, não no
 * roteiro sintetizado.
 *
 * FIXO, como o da Missão Tempestade (ADR-156): sem vaga, sem IA, sem edição do
 * professor — o mesmo áudio em toda turma, sintetizado uma vez por contrato.
 * Toca DEPOIS da missão (o aviso do one-pager): ele conta a virada.
 *
 * Puro — sem Nest e sem Prisma. Quem liga a missão ao módulo `podcast` é
 * `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da vivência",
  revelacao: "A revelação do mecanismo",
  provocacao: "Provocação e reflexão",
  encerramento: "Encerramento",
};

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
  abertura: [
    {
      falante: "Alex",
      texto:
        "Fala, pessoal! Bem-vindos ao podcast de recapitulação da missão Unooria. Hoje a conversa é sobre bastidores, métricas e algo que muita gente sente na pele, mas quase nunca percebe de onde vem.",
    },
    {
      falante: "Sam",
      texto:
        "E aí! Você foi lá, gastou tempo criando um post super responsável para a campanha do grêmio, tomou cuidado com as palavras... e de repente, o feed explodiu da pior forma possível. Mas a pergunta que fica é: por que isso aconteceu?",
    },
  ],
  recapitulacao: [
    {
      falante: "Alex",
      texto:
        "Vamos voltar para o começo. No UnooriaAI, você recebeu aquele primeiro rascunho. Parecia ótimo, mas quando a gente olha de perto... tinha dado inventado, citação de coluna sem dar crédito e até nome de colega exposto sem autorização.",
    },
    {
      falante: "Sam",
      texto:
        "Quem prestou atenção teve que agir como um verdadeiro editor digital: pedir fontes, tirar os dados pessoais e respeitar direitos autorais. Aí veio o momento da publicação no Unoovista. A expectativa era de uma campanha construtiva que ajudasse a escola inteira.",
    },
    {
      falante: "Alex",
      texto: "Só que o relógio da rede avançou. Veio a noite, veio a madrugada... e aí o cenário mudou completamente.",
    },
  ],
  revelacao: [
    {
      falante: "Sam",
      texto:
        "Pois é! Às duas e meia da manhã, o feed do Unoovista virou um campo de batalha. Notificações apitando, comentários agressivos, a Clara relatando dor de cabeça e falta de sono, o Tomás se sentindo péssimo...",
    },
    {
      falante: "Alex",
      texto:
        "E aqui vem a grande virada da nossa investigação: a culpa NÃO foi do que você escreveu. Mesmo quem publicou o texto mais pacífico do mundo viu a rede pinçar o trecho mais ambíguo e entregar de madrugada.",
    },
    {
      falante: "Sam",
      texto:
        "Sabe por quê? Porque o modelo de negócio da plataforma é a chamada Economia da Atenção. O algoritmo não é programado para espalhar a verdade ou proteger o sono de ninguém. O código dele busca uma única coisa: retenção. Minutos com a cara na tela. E infelizmente, o atrito e a raiva prendem a gente muito mais do que a paz.",
    },
  ],
  provocacao: [
    {
      falante: "Alex",
      texto:
        "As notificações noturnas não foram um acidente de percurso; foram uma estratégia deliberada para puxar quem estava quase dormindo de volta para o aplicativo, gerando impressões para anúncios.",
    },
    {
      falante: "Sam",
      texto:
        "E isso não afeta apenas o humor ou a saúde mental com a ansiedade dos comentários. Afeta a saúde física de forma concreta: privação de sono biológico, fadiga crônica e cansaço visual.",
    },
    {
      falante: "Alex",
      texto:
        "Agora que você viu os bastidores desse mecanismo, a pergunta que fica é: quando um aplicativo que você usa começa a mudar de repente para te manter acordado... o que você vai fazer a respeito?",
    },
  ],
  encerramento: [
    { falante: "Sam", texto: "Pense nisso e converse com sua turma e seu professor. Valeu, e até a próxima missão!" },
    { falante: "Alex", texto: "Até mais, galera! Desconectem-se e descansem!" },
  ],
};

/** A missão tem tema, mas o PODCAST é fixo: o roteiro não tem vaga. */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [];
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {};

export function roteiroDoPodcast(): TrechoDoRoteiro[] {
  return BLOCOS_DO_PODCAST.map((bloco) => ({ bloco, titulo: TITULOS[bloco], falas: FALAS[bloco].map((f) => ({ ...f })) }));
}

// ──────────────────────────────────────────── a voz

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Alex", timbre: "jovem-masculino" },
  { nome: "Sam", timbre: "jovem-feminino" },
];

/** A direção de atuação, com a trilha do one-pager §11 (a trilha não é fala). */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores, Alex e Sam, com tom investigativo, inteligente e dinâmico, falando direto com estudantes de 15 a 17 anos da 2ª série do Ensino Médio que acabaram de ver o próprio post ser amplificado de madrugada por uma rede social. " +
  "Trilha sonora na abertura: batida eletrônica leve, moderna e curiosa. Trilha sonora no fim: encerramento enérgico que esmaece gradualmente. " +
  "Conversa natural, ritmo firme e próximo, sem tom de professor dando aula e sem infantilizar; as falas se emendam com pausas curtas.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem. */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};

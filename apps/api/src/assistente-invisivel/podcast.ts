import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de O Assistente Invisível (ADR-150, ADR-185) —
 * "O que o relógio diz sobre você: Algoritmos e inferências", Alex e Sam,
 * cerca de 3 min 45 s, para ouvir DEPOIS da missão.
 *
 * O texto é o do one-pager do PO v1.5 (§11), LITERAL, sem troca nenhuma: o
 * roteiro já fala do UnooriaAI, que é o clone da missão.
 *
 * FIXO, como o da exp02em1b (ADR-156) e o da exp02ef1b: sem vaga, sem IA, sem
 * edição do professor — o mesmo áudio em toda turma, sintetizado uma vez por
 * contrato. O roteiro fala da Trilha Avançada sem citar o tema; a descoberta
 * (horário e conexão) é a mesma em qualquer pacote.
 *
 * Puro — sem Nest e sem Prisma. Quem liga a missão ao módulo `podcast` é
 * `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da experiência",
  revelacao: "A revelação conceitual",
  provocacao: "Provocação e mundo real",
  encerramento: "Encerramento",
};

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
  abertura: [
    {
      falante: "Alex",
      texto:
        "Fala, pessoal! Já reparou que quando você entra em um aplicativo, parece que ele já tem uma opinião pronta sobre você antes mesmo de você dar o primeiro clique?",
    },
    {
      falante: "Sam",
      texto:
        "Pois é, Alex. Na missão de hoje, a gente entrou nos bastidores do UnooriaAI na escola para entender por que dois estudantes que pediram exatamente os mesmos exercícios acabaram recebendo tratamentos totalmente diferentes.",
    },
  ],
  recapitulacao: [
    {
      falante: "Alex",
      texto:
        "Foi muito doido. A Beatriz e o Lucas preencheram a mesma opção no cadastro: queriam a Trilha Avançada. O Lucas entrou de manhã, num computador com fibra óptica rápida, e recebeu o avançado na hora. A Beatriz entrou às 23h45 da noite... e o sistema jogou ela no reforço básico!",
    },
    {
      falante: "Sam",
      texto:
        "E o Thiago, que estava com o 4G oscilando, teve o chat bloqueado na terceira mensagem com um aviso de limite de conexão. Muita gente na sala achou no começo que era bug do servidor ou erro do cadastro.",
    },
  ],
  revelacao: [
    {
      falante: "Alex",
      texto:
        "Mas não tinha bug nenhum! O código estava funcionando exatamente como mandaram ele funcionar. O sistema pegou o que a gente chama de 'dados observados' — a hora da mensagem e a estabilidade da rede — e fez uma inferência algorítmica.",
    },
    {
      falante: "Sam",
      texto:
        "Exatamente. O sistema calculou: 'Acessou tarde? Deve estar cansada e com sono, rebaixa o nível'. 'Sinal oscilou? Pode travar o sistema, corta o limite'. Ou seja, uma premissa preconceituosa virou uma regra técnica. E o que a Beatriz realmente queria e sabia foi completamente ignorado.",
    },
  ],
  provocacao: [
    {
      falante: "Alex",
      texto:
        "Isso na escola já é grave, mas imagina no mercado lá fora. Aplicativos de entrega, plataformas de emprego, bancos calculando crédito... Quantas vezes um algoritmo não deduz quem você é pelo bairro onde você mora ou pelo modelo do seu telefone?",
    },
    {
      falante: "Sam",
      texto:
        "É por isso que a LGPD não é só uma sigla burocrática. O direito à explicação existe justamente para que nenhum sistema possa tomar decisões que afetem a nossa vida sem que a gente saiba os critérios e tenha o direito de exigir uma revisão humana.",
    },
  ],
  encerramento: [
    {
      falante: "Alex",
      texto: "Fica ligado na sua pegada digital. Não é só o que você digita que fala sobre você; é tudo o que o sistema observa. Até a próxima missão!",
    },
    { falante: "Sam", texto: "Até mais, pessoal! Cuidem dos seus dados." },
  ],
};

/** A missão tem pacote, mas o PODCAST é fixo: o roteiro não tem vaga. */
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

/** A direção de atuação: Alex investigativo e curioso, Sam analítico e contextualizador (one-pager §11). */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores: Alex, com tom investigativo e curioso, e Sam, com tom analítico e contextualizador, falando direto com estudantes de 15 e 16 anos da 1ª série do Ensino Médio que acabaram de auditar um assistente de estudos que decidia pelo horário e pela conexão. " +
  "Conversa natural, ritmo firme e próximo, sem tom de professor dando aula e sem infantilizar; as falas se emendam com pausas curtas.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem. */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};

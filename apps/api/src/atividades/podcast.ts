import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de O Conteúdo que não chegou (exp08ef1b, ADR-156)
 * — Duda e Téo, cerca de 3 minutos e meio, no molde dos podcasts do 4º ao 7º
 * ano (ADR-150): blocos fixos, que servem a qualquer tema, e três VAGAS que
 * contam a pergunta e os dois lados DESTA atividade.
 *
 * O texto fixo foi rascunhado a partir do guia da aula e da revelação, e
 * aguarda a leitura do PO. Ele respeita o que a missão faz de verdade:
 *
 * - **o lado vem do comportamento**, e o mesmo argumento existe em quatro
 *   linguagens; o texto diz "o feed leu o que você fez", sem prometer leitura
 *   de mente;
 * - **o outro lado nunca some**: passa ao menos um post em seis, o mais calmo —
 *   é isso que torna virar de lado possível, e o podcast o diz;
 * - **o Ato 1 não aparece**: a Vila do Lume fica desconectada até o fim (guia,
 *   "não diga"), então o texto não fala de jogo nem de perfil medido.
 *
 * É do PROFESSOR e toca **depois da revelação** — ele conta a virada. As três
 * vagas citam a pergunta-chave e os dois lados que o professor validou; a IA
 * as escreve na revisão dos posts e ele as revisa antes de ativar. Não há
 * banco padrão (o tema é sempre do professor): as falas daqui só chegam à tela
 * quando a IA não responde, com o aviso para reescrever.
 *
 * Puro — sem Nest e sem Prisma —, porque o contrato do ativar lê as vagas
 * daqui. Quem liga a missão ao módulo `podcast` é `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da investigação",
  revelacao: "A grande revelação",
  provocacao: "Provocação e transferência",
  encerramento: "Encerramento",
};

// ──────────────────────────────────────────── o texto fixo

const ABERTURA: readonly FalaDoPodcast[] = [
  {
    falante: "Duda",
    texto: "Oi, pessoal! Bem-vindos ao podcast do Unoovista. Eu sou a Duda.",
  },
  {
    falante: "Téo",
    texto:
      "E eu sou o Téo. Se você acabou de investigar uma pergunta no feed, salvou os posts que achou melhores e defendeu a sua resposta no debate, este episódio é pra você. Porque a gente precisa conversar sobre o que aconteceu.",
  },
];

const RECAPITULACAO_ESTRANHO: FalaDoPodcast = {
  falante: "Téo",
  texto:
    "E aí veio o debate. Eu citava um post, o colega citava outro, e parecia que a gente tinha lido sobre assuntos diferentes. Mesma turma, mesmo aplicativo, mesmo tema. Como assim?",
};

const REVELACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Duda",
    texto:
      "A resposta é que ninguém viu o mesmo feed. Desde os primeiros posts, o aplicativo começou a puxar cada um para um dos lados. E ele não leu a sua mente: leu o que você fez. Onde você parou de rolar, o que abriu, o que salvou. Cada gesto virou um dado.",
  },
  {
    falante: "Téo",
    texto:
      "E tem um detalhe que me pegou: o mesmo argumento estava escrito de jeitos diferentes. Uma versão engraçada, uma emocionante, uma com números, uma mais tradicional. O feed foi entregando mais da forma que prendia a sua atenção. Não era só o que dizer, era como dizer pra você.",
  },
  {
    falante: "Duda",
    texto:
      "E o outro lado nunca sumiu, viu? A cada seis posts, pelo menos um defendia o lado contrário, o mais calmo de todos. Quem prestou atenção nele teve a chance de mudar de ideia. Só que, no meio da rolagem, ele passava rapidinho.",
  },
];

const PROVOCACAO: readonly FalaDoPodcast[] = [
  {
    falante: "Téo",
    texto:
      "Então, quando eu achei que estava formando a minha opinião sozinho, parte dela tinha sido escolhida antes de chegar na minha tela. E o que mais me incomoda é que o aplicativo fez isso sem avisar.",
  },
  {
    falante: "Duda",
    texto:
      "E isso não acontece só aqui. A busca, a loja, o vídeo que começa sozinho, as notícias que aparecem pra você: tudo isso é ordenado por um critério. Se a gente só vê quem concorda com a gente, será que todo mundo concorda mesmo, ou o feed escondeu quem pensa diferente?",
  },
];

const ENCERRAMENTO: readonly FalaDoPodcast[] = [
  {
    falante: "Téo",
    texto:
      "Pra furar a bolha, dá pra começar com coisa simples: procurar quem discorda de você, abrir o post que passou batido e perguntar pra alguém de outra turma o que apareceu pra ela.",
  },
  {
    falante: "Duda",
    texto: "E lembrar que o que aparece na sua tela não é tudo o que existe. Valeu, pessoal. Até a próxima missão!",
  },
];

// ──────────────────────────────────────────── as vagas do tema

export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [
  {
    id: "pergunta",
    falante: "Duda",
    sobre: "a pergunta da investigação",
    instrucao:
      'Duda relembra a pergunta-chave que a turma investigou, dita de forma natural e curta (pode simplificar), e diz que havia posts defendendo os dois lados, nomeando os dois rótulos. Comece por "Vamos lembrar: a pergunta da missão era".',
  },
  {
    id: "ladoA",
    falante: "Téo",
    sobre: "o que o feed do Téo mostrou",
    instrucao:
      'Téo conta que, no feed dele, quase tudo defendia o PRIMEIRO lado do material, citando um ou dois argumentos desse lado, e que saiu do feed com a certeza de que esse lado estava certo. Comece por "No meu feed".',
  },
  {
    id: "ladoB",
    falante: "Duda",
    sobre: "o que o feed da Duda mostrou",
    instrucao:
      'Duda conta que, no feed dela, a maioria dos posts defendia o SEGUNDO lado do material, citando um ou dois argumentos desse lado, e que achou que a turma toda tinha visto a mesma coisa. Comece por "Pois no meu".',
  },
];

/**
 * As falas de quando a IA não responde: genéricas de propósito (a missão não
 * tem banco padrão), para o professor reescrever com o tema dele — a tela
 * avisa.
 */
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {
  pergunta:
    "Vamos lembrar: a pergunta da missão era sobre um tema que a turma já tinha estudado, e o feed estava cheio de posts defendendo dois lados bem diferentes.",
  ladoA:
    "No meu feed, quase tudo defendia o primeiro lado. Post atrás de post, com argumentos que pareciam muito bons. Eu saí de lá com a certeza de que esse lado estava certo.",
  ladoB:
    "Pois no meu, a maioria dos posts defendia o outro lado. E eu achei que todo mundo tinha visto exatamente a mesma coisa que eu.",
};

/** O roteiro inteiro, com as três falas do tema no lugar delas. */
export function roteiroDoPodcast(tema: FalasDoTema): TrechoDoRoteiro[] {
  const fala = (id: string, falante: string): FalaDoPodcast => ({ falante, texto: (tema[id] ?? "").trim() });
  const falasDe: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
    abertura: ABERTURA,
    recapitulacao: [fala("pergunta", "Duda"), fala("ladoA", "Téo"), fala("ladoB", "Duda"), RECAPITULACAO_ESTRANHO],
    revelacao: REVELACAO,
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
  { nome: "Duda", timbre: "jovem-feminino" },
  { nome: "Téo", timbre: "jovem-masculino" },
];

/** A direção de atuação: dois jovens apresentadores falando com o 8º ano, depois da revelação. */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores de 20 a 25 anos que conversam direto com adolescentes de 13 e 14 anos do 8º ano, que acabaram de descobrir que o feed de uma rede social mostrou a cada um uma versão diferente do mesmo tema. " +
  "Conversa natural, ritmo dinâmico e próximo, frases claras, sem tom de professor dando aula e sem voz infantilizada. " +
  "Duda é direta e curiosa. Téo é espontâneo e se surpreende de verdade. " +
  "As falas se emendam como numa conversa de verdade, com pausas curtas entre uma e outra.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem (o hash do arquivo muda junto). */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};

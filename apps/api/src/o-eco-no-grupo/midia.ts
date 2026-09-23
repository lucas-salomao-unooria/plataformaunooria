import type { AiFalante, AiProporcao } from "../ai/provider";

/**
 * A mídia da exp07ef1b — as vozes e as fotos, com o roteiro de cada uma.
 *
 * Ela é GERADA, não autorada: o brief de assets pedia duas gravações de voz, um
 * podcast masterizado e três fotografias, e nenhuma delas existe. O que existe
 * aqui é o roteiro exato — a fala verbatim da copy, a direção de atuação e a
 * composição da cena — e o Vertex a produz uma vez por contrato.
 *
 * **A mídia é do CONTRATO, não da escola.** Toda a rede ouve a MESMA Dona Lúcia:
 * o instrumento é determinístico, e duas turmas discutindo vozes diferentes do
 * mesmo boato não estariam falando da mesma coisa.
 *
 * **Nada aqui é obrigatório para a missão rodar.** Sem mídia preparada, o áudio
 * cai na transcrição (que já está sempre na tela, por acessibilidade) e a foto
 * cai na ilustração procedural. É o mesmo princípio do `imageStatus: "fallback"`
 * da exp08ef1b.
 */

export const EXP_ID = "exp07ef1b";

/** As pessoas que falam, e o timbre de cada uma. */
const AMARA: AiFalante = { nome: "Amara", timbre: "jovem-feminino" };
const DONA_LUCIA: AiFalante = { nome: "Dona Lúcia", timbre: "idoso-feminino" };
const LUCAS: AiFalante = { nome: "Lucas", timbre: "jovem-masculino" };
const BIA: AiFalante = { nome: "Bia", timbre: "adulto-feminino" };

export interface MidiaDeVoz {
  tipo: "voz";
  /** Nome do arquivo no bucket, com extensão. */
  arquivo: string;
  falantes: AiFalante[];
  /** Monólogo. Exclusivo com `turnos`. */
  texto?: string;
  /** Diálogo, sintetizado numa chamada só. */
  turnos?: Array<{ falante: string; texto: string }>;
  /** Direção de atuação: é o que separa uma leitura de uma interpretação. */
  direcao: string;
  /**
   * Duração esperada, em segundos. Não é imposta ao modelo: o que se controla é
   * o texto (congelado) e o ritmo (pela direção de atuação).
   *
   * MEDIDO no `gemini-2.5-flash-tts`: com a direção pedindo ritmo pausado, as
   * duas falas do chat entram na tolerância do brief (14,0 s para os 15 s de
   * Amara; 17,2 s para os 18 s de Dona Lúcia) — sem ela ficavam 2 e 4 segundos
   * abaixo.
   *
   * **O podcast é a exceção, e ela é do ROTEIRO, não da síntese**: o episódio
   * sai em ~1 min 58 s, não nos 3 min 30 s que o brief previu. São 2,4 mil
   * caracteres; 3m30 exigiria uma cadência de 11 caracteres por segundo, que
   * não é ritmo de podcast — nem com a instrução de pausa (medido duas vezes, e
   * a duração não se moveu). Alongar exigiria escrever roteiro novo, e a copy
   * está congelada desde a passada 2. Fica declarado o que existe: o Bloco 4 da
   * Aula 2 ganha folga de um minuto e meio.
   */
  duracaoAlvoSeg: number;
}

export interface MidiaDeFoto {
  tipo: "foto";
  arquivo: string;
  prompt: string;
  proporcao: AiProporcao;
  /** Tamanho final no bucket, depois do webp. */
  largura: number;
  altura: number;
  /**
   * Quando presente, esta foto NÃO é gerada: ela é um RECORTE de outra.
   *
   * É o coração visual da missão. O print que circula no grupo é literalmente
   * um pedaço da foto da reportagem — mesma cena, mesmo instante, mesma luz —,
   * e é por isso que o recorte visual espelha o recorte textual que o estudante
   * vai descobrir no parágrafo suprimido. Gerar as duas em separado devolveria
   * duas cenas parecidas, e o par casado que o brief exige (mesma data, mesmo
   * enquadramento de origem) seria mentira.
   *
   * A janela vai em FRAÇÕES da origem, e a proporção dela tem de ser a mesma do
   * destino. Isso não é preciosismo: a publicação faz `cover` para o tamanho
   * final, e uma janela de outra proporção seria cortada DE NOVO ali — foi o
   * que aconteceu na primeira tentativa, em que o corte extra comeu justamente
   * a viatura e o print virou uma foto banal de ônibus.
   */
  recorteDe?: { origem: string; x: number; y: number; largura: number; altura: number };
}

export type Midia = MidiaDeVoz | MidiaDeFoto;

/**
 * O bloco de segurança que TODO prompt de foto carrega.
 *
 * Vem do `promptDeImagem` da exp08ef1b, com dois acréscimos que esta missão exige:
 * a cena tem polícia e aglomeração, e nenhuma das duas pode virar imagem de
 * confronto — o boato do grupo é justamente que houve confusão, e uma foto
 * violenta faria o print manipulado dizer a verdade.
 */
const GUARDRAIL_DA_FOTO = [
  "Fotografia realista de celular, luz natural de fim de tarde.",
  "Sem texto, sem letras, sem números, sem logotipos, sem marcas d'água.",
  "Nenhum rosto identificável em primeiro plano; pessoas de costas, de longe ou desfocadas.",
  "Nenhuma violência: sem confronto, sem agressão, sem arma visível, sem ninguém correndo em pânico.",
  "Adequado a adolescentes.",
].join(" ");

/**
 * O catálogo, por id. Os ids são os mesmos que `catalogo.ts` referencia em
 * `MensagemDoFeed.midia` e em `MATERIA.foto*` — uma lista só, e o teste cobra
 * que nenhuma das duas aponte para o que a outra não tem.
 */
export const MIDIA: Readonly<Record<string, Midia>> = {
  "amara-alerta": {
    tipo: "voz",
    arquivo: "amara-alerta.mp3",
    falantes: [AMARA],
    texto:
      "O pessoal tá apavorado no grupo Voz do Bairro. Repassaram um print dizendo que a prefeitura cancelou o festival por desordem. Meu tio tava lá e disse que correu tudo em paz!",
    direcao:
      "Fale como uma adolescente de 13 anos gravando um áudio de WhatsApp para uma amiga: tom confiante e indignado com a injustiça, sem drama exagerado. " +
      "Soe como microfone de celular perto da boca, num ambiente doméstico — nada de estúdio. " +
      "Ritmo natural e bem articulado, com pausa entre as frases: quem ouve tem 12 anos e precisa acompanhar sem voltar o áudio.",
    duracaoAlvoSeg: 15,
  },

  "dona-lucia-boato": {
    tipo: "voz",
    arquivo: "dona-lucia-boato.mp3",
    falantes: [DONA_LUCIA],
    texto:
      "Gente, me mandaram no outro grupo que teve briga feia na praça e que a polícia mandou fechar tudo! Ninguém sai de casa hoje!",
    direcao:
      "Fale como uma senhora idosa assustada, gravando um áudio para o grupo do bairro: voz trêmula, respiração curta antes de começar, urgência de quem acredita no que ouviu. " +
      "Sem interpretar de forma cômica — ela está genuinamente com medo, e o grupo leva o medo dela a sério. " +
      "Fale devagar, como quem tem pressa mas não corre nas palavras.",
    duracaoAlvoSeg: 18,
  },

  /**
   * O podcast é UMA chamada, não cinco: o modelo multi-falante ajusta o
   * revezamento entre Lucas e Bia, e costurar cinco arquivos devolveria dois
   * monólogos alternados em vez de uma conversa. O roteiro inteiro cabe no teto
   * de 4.000 bytes da síntese — `midia.spec.ts` mede isso, porque estourar o
   * teto só apareceria como 400 na hora de preparar.
   */
  "podcast-recapitulacao": {
    tipo: "voz",
    arquivo: "podcast-recapitulacao.mp3",
    falantes: [LUCAS, BIA],
    turnos: [
      {
        falante: "Lucas",
        texto:
          "Fala, galera ligada no Entre Redes! No último episódio, a gente entrou direto no olho do furacão: um grupo de mensagens do bairro pegando fogo por causa de um boato sobre a praça.",
      },
      {
        falante: "Bia",
        texto:
          'Pois é, Lucas! E todo mundo repassando aquele print com o selo de "Encaminhada com frequência", sem nem saber de onde a notícia saiu. Mas cada estudante aqui investigou a fundo antes de sair repassando, né?',
      },
      {
        falante: "Lucas",
        texto:
          "Vocês entraram no chat, ouviram os áudios e perceberam uma coisa fundamental: a mesma história estava sendo contada de dois jeitos opostos. De um lado, diziam que o festival tinha virado confusão. Do outro, testemunhas contavam que a manifestação foi pacífica.",
      },
      {
        falante: "Bia",
        texto:
          "Exatamente. E quando cada estudante abriu a matéria original completa, veio o estalo! Quem tirou o print cortou de propósito o parágrafo final, que explicava que o evento tinha autorização oficial e que a polícia só organizava os desvios de trânsito.",
      },
      {
        falante: "Lucas",
        texto:
          "Olha o Pensamento Computacional agindo: reconhecimento de padrões e decomposição pura! Uma mensagem viral muitas vezes funciona como um quebra-cabeça com peças escondidas de propósito.",
      },
      {
        falante: "Bia",
        texto:
          "E quem decide quais peças mostrar, decide o que o grupo vai sentir: medo, revolta ou tranquilidade. Isso é narrativa de poder: quem enquadra o print governa a memória de quem lê!",
      },
      {
        falante: "Lucas",
        texto:
          "Agora chegou a hora da decisão: como você vai responder no grupo? Vai só rebater no impulso ou vai colocar a evidência completa na mesa, citando a fonte oficial pra desarmar a mentira?",
      },
      {
        falante: "Bia",
        texto:
          "O administrador do grupo e a comunidade estão esperando. A escolha que cada estudante fizer agora pode acalmar o bairro ou espalhar mais pânico.",
      },
      { falante: "Lucas", texto: "Fones a postos, tela destravada." },
      {
        falante: "Bia",
        texto:
          "Entrem no chat, façam a checagem valer e mostrem a força de uma evidência real. Até já!",
      },
    ],
    direcao:
      "Dois apresentadores de podcast escolar para adolescentes, gravados em estúdio. Lucas é curioso e articulado; Bia é ágil e investigativa. " +
      "Ritmo de conversa real, com reação de um ao outro — não leitura alternada. Energia alta sem infantilizar: eles falam com estudantes de 12 e 13 anos, não com crianças pequenas. " +
      "Falem de forma pausada e bem articulada, com respiro entre as ideias: este episódio é material de recapitulação, e a turma precisa acompanhar o raciocínio ouvindo uma vez só.",
    duracaoAlvoSeg: 120,
  },

  /**
   * A foto da reportagem: a cena INTEIRA, e é dela que sai o print.
   *
   * A composição é pedida de propósito com a feira à esquerda e a viatura à
   * direita — é o que torna o recorte previsível e o par casado exato.
   */
  "praca-aberta": {
    tipo: "foto",
    arquivo: "praca-aberta.webp",
    prompt: [
      "Praça de bairro brasileiro numa tarde de sábado, vista de longe, em plano aberto.",
      "À esquerda, barracas coloridas de uma feira cultural com famílias caminhando tranquilamente entre elas.",
      "À direita, uma viatura de polícia parada junto ao meio-fio, com um agente orientando o trânsito de um ônibus.",
      "O clima geral é de evento comunitário tranquilo.",
      GUARDRAIL_DA_FOTO,
    ].join(" "),
    proporcao: "16:9",
    largura: 1280,
    altura: 720,
  },

  /**
   * O print viral: a METADE DIREITA da foto acima — só a viatura e o
   * aglomerado, sem a feira que explica a cena. O corte é a mentira, e ele é
   * feito com a mesma matemática que qualquer pessoa faria com o dedo na tela.
   */
  "praca-cerrada": {
    tipo: "foto",
    arquivo: "praca-cerrada.webp",
    prompt: "",
    proporcao: "16:9",
    largura: 720,
    altura: 480,
    // Canto inferior direito da praça: a viatura, o agente e o movimento — sem
    // a feira, que é justamente o contexto que o boato omite. 0,55 × 0,65 de
    // 1280×720 dá 704×468, proporção 3:2, a mesma do destino.
    recorteDe: { origem: "praca-aberta", x: 0.45, y: 0.35, largura: 0.55, altura: 0.65 },
  },

  "viatura-transito": {
    tipo: "foto",
    arquivo: "viatura-transito.webp",
    prompt: [
      "Vista da janela de uma casa para a esquina de uma rua residencial brasileira.",
      "Uma viatura de polícia com giroflex ligado está parada, e um agente faz sinal para um ônibus urbano manobrar na curva.",
      "Fim de tarde, movimento comum de trânsito, nada acontecendo além da manobra.",
      GUARDRAIL_DA_FOTO,
    ].join(" "),
    proporcao: "4:3",
    largura: 720,
    altura: 540,
  },
};

export const IDS_DE_MIDIA = Object.keys(MIDIA);

/**
 * A ordem de preparo. As fotos derivadas vêm DEPOIS da origem — o recorte lê os
 * bytes de quem já foi gerado, e inverter isso faria o print falhar sozinho num
 * preparo em que a matéria funcionou.
 */
export const ORDEM_DE_PREPARO = [...IDS_DE_MIDIA].sort(
  (a, b) => Number(ehDerivada(a)) - Number(ehDerivada(b)),
);

/** Esta mídia nasce de outra? (as fotos recortadas). */
export function ehDerivada(id: string): boolean {
  const midia = MIDIA[id];
  return midia?.tipo === "foto" && midia.recorteDe !== undefined;
}

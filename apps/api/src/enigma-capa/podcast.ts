import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de O Enigma da Capa da Rádio (ADR-150, ADR-184)
 * — Iara e Bento, cerca de 3 min 30 s, para ouvir DEPOIS da missão.
 *
 * O texto é o do one-pager do PO (§11), LITERAL, com UMA troca: "no
 * Instanooria" virou "no Unoovista" — o clone da missão é o Unoovista
 * (decisão do Lucas de 2026-10-26, que vence o one-pager), e o podcast não
 * pode nomear um app que a criança não viu. Os efeitos sonoros do roteiro
 * (vinheta, fita sintonizando, assinatura que esmaece) não são fala: vão na
 * DIREÇÃO de atuação.
 *
 * FIXO, como o da exp02em1b (ADR-156): sem vaga, sem IA, sem edição do
 * professor — o mesmo áudio em toda turma, sintetizado uma vez por contrato.
 * O roteiro fala da biblioteca (o banco padrão do PO) em qualquer cena; a
 * descoberta é a mesma.
 *
 * Puro — sem Nest e sem Prisma. Quem liga a missão ao módulo `podcast` é
 * `podcast-fonte.ts`.
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação da investigação",
  revelacao: "A grande revelação",
  provocacao: "Provocação e aprendizado",
  encerramento: "Encerramento",
};

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
  abertura: [
    {
      falante: "Bento",
      texto:
        "Alô, você que está ouvindo a Rádio Escola! Aqui é o Bento! Você não imagina o sufoco que eu passei essa semana com a capa do nosso programa!",
    },
    {
      falante: "Iara",
      texto:
        "Olá, detetive! Eu sou a Iara. E o Bento ficou de cabelo em pé porque achou que a nossa biblioteca tinha virado um mistério sem solução!",
    },
    {
      falante: "Bento",
      texto:
        "Eu tirei uma foto e todo mundo achou que a escola estava em silêncio absoluto feito um museu antigo! Mas eu estava lá e não era só isso!",
    },
  ],
  recapitulacao: [
    { falante: "Iara", texto: "Foi aí que você entrou em ação no Unoovista como detetive da imagem!" },
    {
      falante: "Bento",
      texto:
        "Você pegou a lupa digital e começou a vasculhar as fotos com muita atenção. Tinha a Foto 1, com as crianças compenetradas nos livros, e a Foto 2, com uma contação de histórias cheia de fantoches e risadas!",
    },
    {
      falante: "Iara",
      texto:
        "Você fez sua aposta: escolheu uma foto, arrastou para colocar o pedaço desejado na moldura, sem mudar o tamanho, e carimbou um selo com a legenda. Podia escolher “SILÊNCIO PARA LER” ou “CONTAÇÃO DE HISTÓRIAS”.",
    },
    {
      falante: "Bento",
      texto:
        "E o que a visitante conseguiu ver? Em uma foto, viu crianças lendo. Na outra, viu crianças contando histórias. Ela ainda não conhecia o que estava fora daquelas fotos!",
    },
  ],
  revelacao: [
    {
      falante: "Iara",
      texto: "Depois da conversa com o professor, veio a grande surpresa! A tela mostrou sua foto ao lado de outra imagem do acervo da missão!",
    },
    { falante: "Bento", texto: "Eu quase não acreditei quando vi as duas fotos juntas! Pareciam duas escolas de planetas diferentes!" },
    { falante: "Iara", texto: "Mas você olhou com atenção para o fundo das fotos. E o que estava lá atrás, Bento?" },
    { falante: "Bento", texto: "O mesmo relógio de parede marcando duas e quinze da tarde! E o mesmo cartaz amarelo da Semana do Livro!" },
    {
      falante: "Iara",
      texto:
        "E quando você deslizou o botão mágico do slider... Ploft! A parede do meio sumiu! A mesa de leitura e o tapete de brincadeiras estavam na mesma sala, no mesmo minuto, a dois passos de distância!",
    },
  ],
  provocacao: [
    { falante: "Bento", texto: "Caramba, Iara! Então nenhuma das fotos era mentirosa?" },
    {
      falante: "Iara",
      texto:
        "Nenhuma, Bento! Toda foto é uma escolha de quem segura a câmera. A gente escolhe o que entra no enquadramento e o que fica de fora. Quando você olha uma foto na rede social, você está vendo um pedaço do mundo, não o mundo inteiro!",
    },
    {
      falante: "Bento",
      texto: "Puxa vida... Agora eu entendi! Até quando alguém tira uma foto minha emburrado, não quer dizer que eu sou bravo o dia inteiro, né?",
    },
  ],
  encerramento: [
    { falante: "Iara", texto: "Exatamente! Olhe sempre além da moldura, detetive!" },
    { falante: "Bento", texto: "Até a próxima edição na Rádio Escola! Tchau, tchau!" },
  ],
};

/** A missão tem cena, mas o PODCAST é fixo: o roteiro não tem vaga. */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [];
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {};

export function roteiroDoPodcast(): TrechoDoRoteiro[] {
  return BLOCOS_DO_PODCAST.map((bloco) => ({ bloco, titulo: TITULOS[bloco], falas: FALAS[bloco].map((f) => ({ ...f })) }));
}

// ──────────────────────────────────────────── a voz

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Bento", timbre: "jovem-masculino" },
  { nome: "Iara", timbre: "jovem-feminino" },
];

/** A direção de atuação, com os efeitos sonoros do one-pager §11 (não são fala). */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil da Rádio Escola, apresentado por Bento, o locutor da rádio da escola, e Iara, a parceira dele, com tom empático, curioso, investigativo e infantil, falando direto com crianças de 7 e 8 anos do 2º ano que acabaram de descobrir que duas fotos do mesmo minuto mostravam a mesma sala. " +
  "Na abertura: vinheta animada da Rádio Escola, com som de fita sintonizando. No fim: a assinatura musical da rádio subindo até esmaecer. " +
  "Fala clara, alegre e sem pressa, com entusiasmo de quem conta uma descoberta; frases curtas, pausas curtas entre as falas, sem tom de aula.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem. */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};

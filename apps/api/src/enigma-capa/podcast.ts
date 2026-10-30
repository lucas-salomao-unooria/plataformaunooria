import type { AiFalante } from "../ai/provider";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";
import { conteudoPronto, type ChavePronta, type ConteudoDoPacote } from "./conteudo";

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
 * Desde a ADR-204 o podcast CONTA A CENA DA ATIVIDADE: as sete falas que
 * citam o espaço, as duas fotos, os selos, a visitante, os dois objetos do
 * fundo e o lugar inteiro são VAGAS do tema (`VAGAS_DO_PODCAST`). Na
 * Biblioteca valem as do PO (`FALAS_DO_TEMA_PADRAO`, o texto de antes, letra a
 * letra — o áudio já sintetizado não muda); na Horta e no Museu, as escritas
 * para eles (`FALAS_DOS_PRONTOS`); na cena da IA, as que a IA escreve e o
 * professor revisa na curadoria. Até a 2.2.2 era fixo e falava da biblioteca
 * em qualquer cena — o professor ouvia relógio e cartaz amarelo numa horta.
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

/** Uma fala que muda com a cena: o texto é o da vaga, preenchido por `roteiroDoPodcast`. */
type FalaDoRoteiro = FalaDoPodcast | { falante: string; vaga: string };
const vaga = (falante: string, id: string): FalaDoRoteiro => ({ falante, vaga: id });

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoRoteiro[]> = {
  abertura: [
    {
      falante: "Bento",
      texto:
        "Alô, você que está ouvindo a Rádio Escola! Aqui é o Bento! Você não imagina o sufoco que eu passei essa semana com a capa do nosso programa!",
    },
    vaga("Iara", "espaco"),
    vaga("Bento", "impressao"),
  ],
  recapitulacao: [
    { falante: "Iara", texto: "Foi aí que você entrou em ação no Unoovista como detetive da imagem!" },
    vaga("Bento", "fotos"),
    vaga("Iara", "selos"),
    vaga("Bento", "visitante"),
  ],
  revelacao: [
    {
      falante: "Iara",
      texto: "Depois da conversa com o professor, veio a grande surpresa! A tela mostrou sua foto ao lado de outra imagem do acervo da missão!",
    },
    { falante: "Bento", texto: "Eu quase não acreditei quando vi as duas fotos juntas! Pareciam duas escolas de planetas diferentes!" },
    { falante: "Iara", texto: "Mas você olhou com atenção para o fundo das fotos. E o que estava lá atrás, Bento?" },
    vaga("Bento", "objetos"),
    vaga("Iara", "lugar"),
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

// ──────────────────────────────────────────── as vagas do tema (ADR-204)

/** As sete falas que contam a cena, na ordem em que se ouvem. */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [
  {
    id: "espaco",
    falante: "Iara",
    sobre: "o espaço da escola",
    instrucao:
      "Iara se apresenta e diz que o Bento ficou de cabelo em pé porque achou que o espaço da cena (diga o nome dele, com artigo: a nossa horta, o nosso museu) tinha virado um mistério sem solução. Comece com \"Olá, detetive! Eu sou a Iara.\"",
  },
  {
    id: "impressao",
    falante: "Bento",
    sobre: "a primeira impressão da foto",
    instrucao:
      "Bento conta que tirou uma foto e todo mundo achou que o espaço era só UMA das duas atividades (diga qual, de um jeito divertido). Termine com \"Mas eu estava lá e não era só isso!\"",
  },
  {
    id: "fotos",
    falante: "Bento",
    sobre: "as duas fotos",
    instrucao:
      "Bento lembra que a turma pegou a lupa digital e vasculhou as duas fotos, e descreve a Foto 1 e a Foto 2: o que as crianças fazem em cada uma, com as palavras da cena.",
  },
  {
    id: "selos",
    falante: "Iara",
    sobre: "a aposta e os dois selos",
    instrucao:
      "Iara conta a aposta: escolher uma foto, arrastar para pôr o pedaço desejado na moldura, sem mudar o tamanho, e carimbar um selo com a legenda. Termine com \"Podia escolher “SELO 1” ou “SELO 2”.\", com os dois selos da cena em caixa alta, entre aspas curvas.",
  },
  {
    id: "visitante",
    falante: "Bento",
    sobre: "o que a visitante viu",
    instrucao:
      "Bento pergunta o que a visitante conseguiu ver e responde com o que ela disse de cada foto. Termine com \"Ela ainda não conhecia o que estava fora daquelas fotos!\"",
  },
  {
    id: "objetos",
    falante: "Bento",
    sobre: "os dois objetos iguais do fundo",
    instrucao:
      "Bento responde à Iara, com espanto, quais eram os dois objetos iguais que estavam no fundo das duas fotos: o mesmo primeiro objeto e o mesmo segundo objeto, com um detalhe de cada um que a criança reconhece.",
  },
  {
    id: "lugar",
    falante: "Iara",
    sobre: "o lugar inteiro",
    instrucao:
      "Iara conta que, quando a criança deslizou o botão mágico do slider, a divisão do meio sumiu (\"Ploft!\") e as duas atividades estavam no mesmo espaço, no mesmo minuto, a dois passos de distância. Diga as duas atividades e o espaço.",
  },
];

/** As falas da Biblioteca, o banco padrão: o §11 do PO, LITERAL (era o roteiro fixo até a 2.2.2). */
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {
  espaco: "Olá, detetive! Eu sou a Iara. E o Bento ficou de cabelo em pé porque achou que a nossa biblioteca tinha virado um mistério sem solução!",
  impressao:
    "Eu tirei uma foto e todo mundo achou que a escola estava em silêncio absoluto feito um museu antigo! Mas eu estava lá e não era só isso!",
  fotos:
    "Você pegou a lupa digital e começou a vasculhar as fotos com muita atenção. Tinha a Foto 1, com as crianças compenetradas nos livros, e a Foto 2, com uma contação de histórias cheia de fantoches e risadas!",
  selos:
    "Você fez sua aposta: escolheu uma foto, arrastou para colocar o pedaço desejado na moldura, sem mudar o tamanho, e carimbou um selo com a legenda. Podia escolher “SILÊNCIO PARA LER” ou “CONTAÇÃO DE HISTÓRIAS”.",
  visitante:
    "E o que a visitante conseguiu ver? Em uma foto, viu crianças lendo. Na outra, viu crianças contando histórias. Ela ainda não conhecia o que estava fora daquelas fotos!",
  objetos: "O mesmo relógio de parede marcando duas e quinze da tarde! E o mesmo cartaz amarelo da Semana do Livro!",
  lugar:
    "E quando você deslizou o botão mágico do slider... Ploft! A parede do meio sumiu! A mesa de leitura e o tapete de brincadeiras estavam na mesma sala, no mesmo minuto, a dois passos de distância!",
};

/**
 * As falas da Horta e do Museu, os outros dois prontos — escritas no molde das
 * do PO, com a cena de cada um (`conteudo.ts#PACOTES_PRONTOS`). A Biblioteca é
 * `FALAS_DO_TEMA_PADRAO`.
 */
export const FALAS_DOS_PRONTOS: Readonly<Record<Exclude<ChavePronta, "biblioteca">, FalasDoTema>> = {
  horta: {
    espaco: "Olá, detetive! Eu sou a Iara. E o Bento ficou de cabelo em pé porque achou que a nossa horta tinha virado um mistério sem solução!",
    impressao:
      "Eu tirei uma foto e todo mundo achou que na horta só tinha alface e regador! Mas eu estava lá e não era só isso!",
    fotos:
      "Você pegou a lupa digital e começou a vasculhar as fotos com muita atenção. Tinha a Foto 1, com crianças regando o canteiro de alfaces, e a Foto 2, com crianças mexendo na terra escura cheia de minhocas!",
    selos:
      "Você fez sua aposta: escolheu uma foto, arrastou para colocar o pedaço desejado na moldura, sem mudar o tamanho, e carimbou um selo com a legenda. Podia escolher “PLANTA CRESCENDO” ou “TERRA ADUBADA”.",
    visitante:
      "E o que a visitante conseguiu ver? Em uma foto, viu alfaces. Na outra, viu minhocas. Ela ainda não conhecia o que estava fora daquelas fotos!",
    objetos: "O mesmo espantalho de chapéu no muro! E o mesmo regador vermelho pendurado bem ao lado dele!",
    lugar:
      "E quando você deslizou o botão mágico do slider... Ploft! O muro do meio sumiu! O canteiro de alfaces e o canteiro das minhocas estavam na mesma horta, no mesmo minuto, a dois passos de distância!",
  },
  museu: {
    espaco: "Olá, detetive! Eu sou a Iara. E o Bento ficou de cabelo em pé porque achou que o nosso museu tinha virado um mistério sem solução!",
    impressao:
      "Eu tirei uma foto e todo mundo achou que o museu da escola só guardava coisas de antigamente! Mas eu estava lá e não era só isso!",
    fotos:
      "Você pegou a lupa digital e começou a vasculhar as fotos com muita atenção. Tinha a Foto 1, com crianças olhando uma vitrine de tinteiros e penas antigas, e a Foto 2, com crianças desenhando numa bancada cheia de canetas coloridas!",
    selos:
      "Você fez sua aposta: escolheu uma foto, arrastou para colocar o pedaço desejado na moldura, sem mudar o tamanho, e carimbou um selo com a legenda. Podia escolher “TEMPO ANTIGO” ou “TEMPO DE HOJE”.",
    visitante:
      "E o que a visitante conseguiu ver? Em uma foto, viu tinteiros. Na outra, viu canetas. Ela ainda não conhecia o que estava fora daquelas fotos!",
    objetos: "A mesma placa dourada na parede! E a mesma janela de madeira bem ao lado dela!",
    lugar:
      "E quando você deslizou o botão mágico do slider... Ploft! A parede do meio sumiu! A vitrine antiga e a bancada de desenho estavam no mesmo museu, no mesmo minuto, a dois passos de distância!",
  },
};

/** O roteiro inteiro, com as falas do tema no lugar das vagas. */
export function roteiroDoPodcast(tema: FalasDoTema): TrechoDoRoteiro[] {
  return BLOCOS_DO_PODCAST.map((bloco) => ({
    bloco,
    titulo: TITULOS[bloco],
    falas: FALAS[bloco].map((f) => ("vaga" in f ? { falante: f.falante, texto: tema[f.vaga] ?? "" } : { ...f })),
  }));
}

/**
 * Qual pronto este conteúdo é, INTOCADO — a cena de um pronto com os selos e as
 * falas da visitante como o catálogo os tem. A curadoria do pronto da
 * disciplina (o rascunho sem IA) deixa editar os selos e as falas: editado, o
 * podcast precisa contar o que a turma vai ver, e deixa de ser o do pronto.
 */
export function prontoIntocado(conteudo: Pick<ConteudoDoPacote, "cena">): ChavePronta | null {
  const chave = conteudo.cena.chave;
  if (chave !== "biblioteca" && chave !== "horta" && chave !== "museu") return null;
  const pronto = conteudoPronto(chave).cena;
  const selos = (c: Pick<ConteudoDoPacote["cena"], "selos" | "fotos">) => c.selos.map((s) => `${s.id}=${s.texto.trim()}`).join("|");
  const falas = (c: Pick<ConteudoDoPacote["cena"], "selos" | "fotos">) => c.fotos.map((f) => `${f.id}=${f.visitante.trim()}`).join("|");
  return selos(conteudo.cena) === selos(pronto) && falas(conteudo.cena) === falas(pronto) ? chave : null;
}

/** As falas do pronto intocado: as do PO na Biblioteca, as escritas para a Horta e o Museu. */
export function falasDoPronto(chave: ChavePronta): FalasDoTema {
  return { ...(chave === "biblioteca" ? FALAS_DO_TEMA_PADRAO : FALAS_DOS_PRONTOS[chave]) };
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

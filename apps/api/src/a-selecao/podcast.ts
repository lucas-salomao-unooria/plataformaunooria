import type { AiFalante } from "../ai/provider";
import {
  falasDoTemaSchema,
  nomeDoEpisodio as nomeDoEpisodioNaVoz,
  nomeDoTrecho as nomeDoTrechoNaVoz,
  problemasDasFalasDoTema as problemasDasVagas,
  type PedidoDeVoz,
  type VagaDoTema,
} from "../podcast/roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO da exp07ef1b — o roteiro, as réguas e os nomes
 * dos arquivos. Sem Nest, sem Prisma: é o que o teste exercita.
 *
 * O roteiro é o do sheet de copy aprovado (`design/04-copy-strings.md`, "Roteiro
 * do podcast de recapitulação"): cinco blocos, Lucas e Clara, cerca de 3m45s.
 * **É do PROFESSOR** (decisão do dono do produto, 2026-09-26): o texto fala com
 * o estudante, e é o professor quem decide tocar para a sala depois da aula.
 *
 * **Só três falas mudam com o tema.** O Bloco 2 descreve o que cada veículo
 * mostrou — na cobertura curada, as maquetes da Folha Oficial, a padaria da Voz
 * Coletiva, o orçamento por metro quadrado da Métrica Urbana. Com um tema
 * gerado por IA isso fica errado, então essas três falas são escritas pela IA
 * JUNTO COM O LOTE e revisadas pela professora antes de aprovar. A primeira e a
 * última fala do Bloco 2, e os Blocos 1, 3, 4 e 5 inteiros, servem a qualquer
 * tema e ficam como o sheet aprovou.
 */

export type FalanteDoPodcast = "Lucas" | "Clara";

export interface FalaDoPodcast {
  falante: FalanteDoPodcast;
  texto: string;
}

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;
export type BlocoDoPodcast = (typeof BLOCOS_DO_PODCAST)[number];

export const TITULOS_DOS_BLOCOS: Record<BlocoDoPodcast, string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação",
  revelacao: "A revelação",
  provocacao: "Provocação e transferência",
  encerramento: "Encerramento",
};

/** O que cada veículo mostrou — as três falas do Bloco 2 que mudam com o tema. */
export type FalasDoTema = {
  /** Lucas: o que a Folha Oficial (@folhaoficial_) mostrou. */
  institucional: string;
  /** Clara: o que a Voz Coletiva (@voz_coletiva) mostrou. */
  comunitario: string;
  /** Lucas: o que a Métrica Urbana (@metrica_urbana) mostrou. */
  estatistico: string;
};

// ──────────────────────────────────────────── o texto aprovado, sem mudança

const ABERTURA: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "E aí, pessoal da Unooria! Aqui é o Lucas." },
  { falante: "Clara", texto: "E aqui é a Clara! Se você acabou de sair da missão A Seleção, respira fundo." },
  { falante: "Lucas", texto: "Cara, a missão parecia simples demais, né? A Amara mandou aquele direct pedindo socorro pro grêmio: \"Olha o feed, escolhe 3 posts salvos sobre o evento de ontem e posta nos Stories pra escola ficar por dentro\"." },
  { falante: "Clara", texto: "Moleza, né? Você abriu o feed do Instagram simulado, começou a rolar a tela, viu foto de autoridade, viu morador indignado, viu planilha de custos... salvou os 3 que achou melhores, escreveu a legenda e mandou bala." },
  { falante: "Lucas", texto: "Parecia que todo mundo ia postar exatamente a mesma coisa. Só que não!" },
];

/** A primeira fala do Bloco 2 — apresenta os três veículos, e serve a qualquer tema. */
const RECAPITULACAO_ENTRADA: FalaDoPodcast = { falante: "Clara", texto: "Pois é. Quando o feed abriu, estavam lá três veículos cobrindo o mesmíssimo evento: a Folha Oficial, a Voz Coletiva e a Métrica Urbana." };

/** A última fala do Bloco 2 — a escolha, e a ponte para o Mural. */
const RECAPITULACAO_SAIDA: FalaDoPodcast = { falante: "Clara", texto: "Você fez sua escolha com a melhor das intenções: \"Vou escolher os 3 que mostram a verdade!\". E clicou em publicar nos Stories." };

const REVELACAO: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "E aí veio o choque do Mural da Turma! Quando o professor liberou as telas lado a lado, parecia que a turma estudava em cidades diferentes!" },
  { falante: "Clara", texto: "Total! Teve colega que montou um Stories parecendo anúncio oficial de inauguração de parque da Disney. E outro colega, sentado na mesma bancada, montou um Stories que parecia uma zona de desastre comunitário!" },
  { falante: "Lucas", texto: "E a grande pergunta explodiu na sala: quem mentiu? Quem inventou coisa?" },
  { falante: "Clara", texto: "E a resposta que a ficha técnica mostrou é genial: ninguém mentiu! Todos os 12 posts falavam fatos que realmente aconteceram." },
  { falante: "Lucas", texto: "O segredo não estava na mentira, tava na seleção! Quando a gente escolheu só os posts de autoridades, a gente apagou o problema dos vizinhos. Quando alguém escolheu só os relatos de revolta, apagou os dados e o projeto de longo prazo." },
  { falante: "Clara", texto: "É a ilusão da neutralidade. A gente acha que tá só \"mostrando o que aconteceu\", mas todo produto que a gente publica na rede — seja um Story, um carrossel ou um vídeo — constrói um enquadramento. Quem você decide ouvir decide o que a história vira!" },
];

const PROVOCACAO: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "E repara que isso tem tudo a ver com o livro que vocês estão lendo no bimestre, A Reportagem Que Não Saiu. O repórter da ficção deu a matéria como encerrada só porque ouviu o gabinete da prefeitura. Hoje, você foi o editor da matéria!" },
  { falante: "Clara", texto: "Agora leva isso pra sua vida real: quando você rola o seu feed de verdade no celular, quais são as lentes invisíveis das páginas que você segue? Será que você tá vendo a cidade inteira, ou tá preso no recorte editorial de alguém?" },
];

const ENCERRAMENTO: readonly FalaDoPodcast[] = [
  { falante: "Lucas", texto: "Pensar sobre o que ficou de fora é o maior superpoder do leitor digital." },
  { falante: "Clara", texto: "Missão cumprida com sucesso, time! Nos vemos na próxima jornada da Unooria. Até lá!" },
  { falante: "Lucas", texto: "Valeu!" },
];

/** As três falas do tema na cobertura CURADA (a Praça Central) — o sheet, verbatim. */
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {
  institucional: "A Folha Oficial vinha com aquelas fotos impecáveis de maquetes, o comunicado da secretaria, prazos de entrega tudo certinho... dava aquela sensação de: \"Nossa, que obra maravilhosa, vai ficar incrível!\".",
  comunitario: "Aí logo embaixo você rolava mais um pouco e via a Voz Coletiva: o dono da padaria da esquina falando que o trânsito fechado ia quebrar o comércio dele, moradores mostrando poeira na janela e faixas de protesto na praça.",
  estatistico: "E se não bastasse, tinha a Métrica Urbana com gráficos comparando o orçamento gasto por metro quadrado e o fluxo de pessoas antes e depois.",
};

// ──────────────────────────────────────────────────────────────── o roteiro

/** Um bloco do roteiro, na ordem em que é ouvido. */
export interface TrechoDoRoteiro {
  bloco: BlocoDoPodcast;
  titulo: string;
  falas: FalaDoPodcast[];
}

/** O roteiro inteiro, com as três falas do tema no lugar delas. */
export function roteiroDoPodcast(tema: FalasDoTema): TrechoDoRoteiro[] {
  const falasDe: Record<BlocoDoPodcast, readonly FalaDoPodcast[]> = {
    abertura: ABERTURA,
    recapitulacao: [
      RECAPITULACAO_ENTRADA,
      { falante: "Lucas", texto: tema.institucional.trim() },
      { falante: "Clara", texto: tema.comunitario.trim() },
      { falante: "Lucas", texto: tema.estatistico.trim() },
      RECAPITULACAO_SAIDA,
    ],
    revelacao: REVELACAO,
    provocacao: PROVOCACAO,
    encerramento: ENCERRAMENTO,
  };
  return BLOCOS_DO_PODCAST.map((bloco) => ({
    bloco,
    titulo: TITULOS_DOS_BLOCOS[bloco],
    falas: falasDe[bloco].map((f) => ({ ...f })),
  }));
}

// ────────────────────────────────────────────────── as réguas das três falas

/**
 * As três vagas do tema, na ordem do Bloco 2 — a régua é a do módulo
 * `podcast` (`roteiro.ts`), e `sobre` é o que as frases de erro dizem.
 */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [
  {
    id: "institucional",
    falante: "Lucas",
    sobre: "a Folha Oficial",
    instrucao: 'O que a Folha Oficial mostrou nos quatro posts dela, e a sensação que isso passava, começando por "A Folha Oficial vinha com".',
  },
  {
    id: "comunitario",
    falante: "Clara",
    sobre: "a Voz Coletiva",
    instrucao: 'O que a Voz Coletiva mostrou, começando por "Aí logo embaixo você rolava mais um pouco e via a Voz Coletiva:".',
  },
  {
    id: "estatistico",
    falante: "Lucas",
    sobre: "a Métrica Urbana",
    instrucao: 'O que a Métrica Urbana mostrou, começando por "E se não bastasse, tinha a Métrica Urbana com".',
  },
];

export { BYTES_DA_FALA_DO_TEMA, PALAVRAS_DA_FALA_DO_TEMA } from "../podcast/roteiro";

/**
 * TUDO que impede as três falas de irem para o áudio, em frases para a
 * PROFESSORA. Lista vazia = pode aprovar. Vale para o rascunho da IA e para o
 * que a professora editou.
 */
export function problemasDasFalasDoTema(tema: FalasDoTema): string[] {
  return problemasDasVagas(VAGAS_DO_PODCAST, { ...tema });
}

/** O Zod das três falas — entrada da homologação e saída do rascunho. */
export const FalasDoTemaSchema = falasDoTemaSchema(VAGAS_DO_PODCAST).transform((f) => f as unknown as FalasDoTema);

// ──────────────────────────────────────────────────── a voz e os arquivos

/** Quem fala: o nome do roteiro e o timbre neutro de vendor (`ai/provider.ts#AiTimbre`). */
export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Lucas", timbre: "jovem-masculino" },
  { nome: "Clara", timbre: "jovem-feminino" },
];

/**
 * A direção de atuação, a do brief de assets (`dev/01b-brief-assets.md`, §2.3):
 * dois jovens educadores, ritmo dinâmico, sem professoralismo e sem
 * infantilização. É a MESMA em todos os trechos — é ela que faz os cinco
 * soarem como um episódio, e não como cinco gravações.
 */
export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens educadores de 20 a 25 anos que conversam direto com estudantes de 11 a 13 anos que acabaram de fazer uma missão de letramento digital. " +
  "Conversa natural, ritmo dinâmico e caloroso, sem tom de professor dando aula e sem voz infantilizada. " +
  "Lucas é animado, ágil e ligado em redes sociais. Clara é reflexiva, analítica e investigativa. " +
  "As falas se emendam como numa conversa de verdade, com pausas curtas entre uma e outra.";

/**
 * A versão do PEDIDO de voz. Mudar a direção, os timbres ou o texto fixo muda
 * o som: subir este número faz todo trecho ser regerado (o nome do arquivo sai
 * do hash com ele), em vez de o contrato misturar gravações de dois pedidos.
 */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

/**
 * O pedido de voz da A Seleção. O prefixo `selecao/podcast` é o que os
 * contratos já têm no bucket desde a ADR-119 — o motor comum (ADR-150) manteve
 * os insumos do hash, e `tests/a-selecao-podcast.spec.ts` congela os nomes.
 */
export const VOZ_DO_PODCAST: PedidoDeVoz = {
  prefixo: "selecao/podcast",
  versao: VERSAO_DO_PEDIDO_DE_VOZ,
  direcao: DIRECAO_DO_PODCAST,
};

/** O arquivo de UM trecho, abaixo de `experiencias/exp07ef1b/`. */
export function nomeDoTrecho(trecho: TrechoDoRoteiro): string {
  return nomeDoTrechoNaVoz(VOZ_DO_PODCAST, trecho);
}

/** O episódio inteiro — os cinco trechos emendados —, nomeado pelos cinco. */
export function nomeDoEpisodio(roteiro: readonly TrechoDoRoteiro[]): string {
  return nomeDoEpisodioNaVoz(VOZ_DO_PODCAST, roteiro);
}

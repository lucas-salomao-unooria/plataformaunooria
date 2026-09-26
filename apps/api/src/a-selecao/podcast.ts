import { createHash } from "node:crypto";
import { z } from "zod";

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
export interface FalasDoTema {
  /** Lucas: o que a Folha Oficial (@folhaoficial_) mostrou. */
  institucional: string;
  /** Clara: o que a Voz Coletiva (@voz_coletiva) mostrou. */
  comunitario: string;
  /** Lucas: o que a Métrica Urbana (@metrica_urbana) mostrou. */
  estatistico: string;
}

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

/** Palavras por fala do tema. As do sheet têm de 26 a 38; a folga é para a professora. */
export const PALAVRAS_DA_FALA_DO_TEMA = { min: 12, max: 60 } as const;

/**
 * Bytes por fala do tema. O teto da síntese é de 4.000 bytes por chamada
 * (em pt-BR um acento conta 2), e o Bloco 2 inteiro — as cinco falas — vai numa
 * chamada só: três falas de 400 bytes mais as duas fixas cabem com folga.
 */
export const BYTES_DA_FALA_DO_TEMA = 400;

const CAMPOS_DO_TEMA: ReadonlyArray<{ campo: keyof FalasDoTema; veiculo: string }> = [
  { campo: "institucional", veiculo: "a Folha Oficial" },
  { campo: "comunitario", veiculo: "a Voz Coletiva" },
  { campo: "estatistico", veiculo: "a Métrica Urbana" },
];

/** Link, e-mail e menção não se leem em voz alta — e são o que um texto colado traria. */
const PROIBIDO_NA_FALA = [
  { re: /https?:\/\/|www\.|\.com\b|\.br\b/i, motivo: "tem um link" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, motivo: "tem um e-mail" },
  { re: /(^|\s)@\w/, motivo: "tem uma menção com @ (escreva o nome do veículo por extenso)" },
  { re: /<<<|>>>/, motivo: "tem um delimitador de instrução" },
];

function palavrasDe(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * TUDO que impede as três falas de irem para o áudio, em frases para a
 * PROFESSORA. Lista vazia = pode aprovar. Vale para o rascunho da IA e para o
 * que a professora editou.
 */
export function problemasDasFalasDoTema(tema: FalasDoTema): string[] {
  const erros: string[] = [];
  for (const { campo, veiculo } of CAMPOS_DO_TEMA) {
    const texto = (tema[campo] ?? "").trim();
    const n = palavrasDe(texto);
    if (n < PALAVRAS_DA_FALA_DO_TEMA.min || n > PALAVRAS_DA_FALA_DO_TEMA.max) {
      erros.push(
        `A fala do podcast sobre ${veiculo} tem ${n} palavra(s); precisa ter de ${PALAVRAS_DA_FALA_DO_TEMA.min} a ${PALAVRAS_DA_FALA_DO_TEMA.max}.`,
      );
    }
    if (Buffer.byteLength(texto, "utf8") > BYTES_DA_FALA_DO_TEMA) {
      erros.push(`A fala do podcast sobre ${veiculo} está longa demais para o áudio; encurte um pouco.`);
    }
    for (const { re, motivo } of PROIBIDO_NA_FALA) {
      if (re.test(texto)) erros.push(`A fala do podcast sobre ${veiculo} ${motivo}.`);
    }
  }
  return erros;
}

/** O Zod das três falas — entrada da homologação e saída do rascunho. */
export const FalasDoTemaSchema = z
  .object({
    institucional: z.string().trim().min(1).max(600),
    comunitario: z.string().trim().min(1).max(600),
    estatistico: z.string().trim().min(1).max(600),
  })
  .superRefine((tema, ctx) => {
    for (const problema of problemasDasFalasDoTema(tema)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
  });

// ──────────────────────────────────────────────────── a voz e os arquivos

/** Quem fala: o nome do roteiro e o timbre neutro de vendor (`ai/provider.ts#AiTimbre`). */
export const FALANTES_DO_PODCAST = [
  { nome: "Lucas", timbre: "jovem-masculino" as const },
  { nome: "Clara", timbre: "jovem-feminino" as const },
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

/** Custo estimado por trecho, em tokens (a síntese é cobrada por caractere e não devolve contagem). */
export const CUSTO_ESTIMADO_POR_TRECHO = 3_000;

function hashDe(partes: readonly string[]): string {
  return createHash("sha256").update(partes.join("\u0000")).digest("hex").slice(0, 32);
}

/**
 * O arquivo de UM trecho, abaixo de `experiencias/exp07ef1b/`. O hash é do
 * texto e do pedido: os blocos fixos saem com o mesmo nome em toda turma e são
 * gerados UMA vez por contrato; o Bloco 2 de um tema da IA é outro arquivo.
 */
export function nomeDoTrecho(trecho: TrechoDoRoteiro): string {
  const texto = trecho.falas.map((f) => `${f.falante}: ${f.texto}`);
  return `selecao/podcast/trecho-${hashDe([String(VERSAO_DO_PEDIDO_DE_VOZ), DIRECAO_DO_PODCAST, trecho.bloco, ...texto])}.mp3`;
}

/** O episódio inteiro — os cinco trechos emendados —, nomeado pelos cinco. */
export function nomeDoEpisodio(roteiro: readonly TrechoDoRoteiro[]): string {
  return `selecao/podcast/episodio-${hashDe(roteiro.map(nomeDoTrecho))}.mp3`;
}

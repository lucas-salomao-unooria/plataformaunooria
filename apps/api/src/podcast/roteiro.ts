import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * O PODCAST DE RECAPITULAÇÃO, sem Nest e sem Prisma: o formato do roteiro, a
 * régua das falas que mudam com o tema e os nomes dos arquivos. É o que o
 * teste exercita, e o que toda missão usa para declarar o seu roteiro
 * (`fonte.ts`).
 *
 * O roteiro de cada missão é o do sheet aprovado: blocos fixos, que servem a
 * qualquer tema, e as VAGAS DO TEMA — as falas que contam o que a turma viu
 * NESTA atividade. No banco padrão as vagas são as do sheet; num tema da IA a
 * IA as reescreve e o professor as revisa na customização (ADR-119, ADR-150).
 */

export interface FalaDoPodcast {
  falante: string;
  texto: string;
}

/** Um bloco do roteiro, na ordem em que é ouvido. É um trecho de áudio. */
export interface TrechoDoRoteiro {
  bloco: string;
  titulo: string;
  falas: FalaDoPodcast[];
}

/** As falas que mudam com o tema, pela vaga: `{ antiga: "…", semAssinatura: "…" }`. */
export type FalasDoTema = Record<string, string>;

/**
 * Uma fala que muda com o tema. `sobre` completa "Lucas, sobre …" na tela do
 * professor e "a fala do podcast sobre …" na mensagem de erro; `instrucao` é o
 * que a IA recebe para escrevê-la.
 */
export interface VagaDoTema {
  id: string;
  falante: string;
  sobre: string;
  instrucao: string;
}

// ──────────────────────────────────────────────────── a régua das vagas

/** Palavras por fala do tema. As do sheet têm de 20 a 45; a folga é para o professor. */
export const PALAVRAS_DA_FALA_DO_TEMA = { min: 12, max: 60 } as const;

/**
 * Bytes por fala do tema. O teto da síntese é de 4.000 bytes por chamada (em
 * pt-BR um acento conta 2), e um bloco inteiro vai numa chamada só: até três
 * vagas de 400 bytes e as falas fixas do bloco cabem com folga.
 */
export const BYTES_DA_FALA_DO_TEMA = 400;

/** Teto da síntese por chamada — um trecho do roteiro. */
export const BYTES_DO_TRECHO = 4000;

/** Link, e-mail e menção não se leem em voz alta — e são o que um texto colado traria. */
const PROIBIDO_NA_FALA = [
  { re: /https?:\/\/|www\.|\.com\b|\.br\b/i, motivo: "tem um link" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, motivo: "tem um e-mail" },
  { re: /(^|\s)@\w/, motivo: "tem uma menção com @ (escreva o nome por extenso)" },
  { re: /<<<|>>>/, motivo: "tem um delimitador de instrução" },
];

function palavrasDe(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * TUDO que impede as falas do tema de irem para o áudio, em frases para o
 * PROFESSOR. Lista vazia = pode aprovar. Vale para o rascunho da IA e para o
 * que o professor editou.
 */
export function problemasDasFalasDoTema(vagas: readonly VagaDoTema[], falas: FalasDoTema): string[] {
  const erros: string[] = [];
  for (const vaga of vagas) {
    const texto = (falas[vaga.id] ?? "").trim();
    const n = palavrasDe(texto);
    if (n < PALAVRAS_DA_FALA_DO_TEMA.min || n > PALAVRAS_DA_FALA_DO_TEMA.max) {
      erros.push(
        `A fala do podcast sobre ${vaga.sobre} tem ${n} palavra(s); precisa ter de ${PALAVRAS_DA_FALA_DO_TEMA.min} a ${PALAVRAS_DA_FALA_DO_TEMA.max}.`,
      );
    }
    if (Buffer.byteLength(texto, "utf8") > BYTES_DA_FALA_DO_TEMA) {
      erros.push(`A fala do podcast sobre ${vaga.sobre} está longa demais para o áudio; encurte um pouco.`);
    }
    for (const { re, motivo } of PROIBIDO_NA_FALA) {
      if (re.test(texto)) erros.push(`A fala do podcast sobre ${vaga.sobre} ${motivo}.`);
    }
  }
  return erros;
}

/**
 * O Zod das falas de UMA missão — entrada da homologação e saída da escrita
 * da IA. Só as vagas declaradas, todas elas; a régua vai no `superRefine`
 * (que some do OpenAPI: a nota do `@Contrato` repete).
 */
export function falasDoTemaSchema(vagas: readonly VagaDoTema[]) {
  const forma = Object.fromEntries(vagas.map((v) => [v.id, z.string().trim().min(1).max(600)]));
  return z
    .object(forma)
    .strict()
    .superRefine((falas, ctx) => {
      for (const problema of problemasDasFalasDoTema(vagas, falas as FalasDoTema)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
      }
    })
    .transform((falas) => falas as FalasDoTema);
}

/** As falas do tema, limpas das pontas — como vão ao banco e ao áudio. */
export function falasAparadas(vagas: readonly VagaDoTema[], falas: FalasDoTema): FalasDoTema {
  return Object.fromEntries(vagas.map((v) => [v.id, (falas[v.id] ?? "").trim()]));
}

/**
 * Lê as falas gravadas (JSONB) contra as vagas da missão: `null` quando falta
 * vaga ou alguma fere a régua. Quem lê decide o que fazer — nenhuma leitura
 * pode derrubar a tela por um registro torto.
 */
export function falasGravadas(vagas: readonly VagaDoTema[], bruto: unknown): FalasDoTema | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const falas: FalasDoTema = {};
  for (const vaga of vagas) {
    const texto = (bruto as Record<string, unknown>)[vaga.id];
    if (typeof texto !== "string") return null;
    falas[vaga.id] = texto.trim();
  }
  return problemasDasFalasDoTema(vagas, falas).length === 0 ? falas : null;
}

// ──────────────────────────────────────────────────── os nomes dos arquivos

function hashDe(partes: readonly string[]): string {
  return createHash("sha256").update(partes.join("\u0000")).digest("hex").slice(0, 32);
}

/**
 * O que define o SOM de um trecho além do texto: a versão do pedido de voz e
 * a direção de atuação. Mudou o timbre, a direção ou o texto fixo? Suba a
 * versão — senão o contrato mistura gravações de dois pedidos.
 */
export interface PedidoDeVoz {
  /** O prefixo do arquivo, abaixo de `experiencias/<expId>/` no bucket. */
  prefixo: string;
  versao: number;
  direcao: string;
}

/**
 * O arquivo de UM trecho. O nome é o hash do texto e do pedido: os blocos
 * fixos saem com o mesmo nome em toda turma e são gerados UMA vez por
 * contrato; o bloco com uma vaga reescrita é outro arquivo.
 *
 * A forma (`<prefixo>/trecho-<hash>.mp3`, e os insumos do hash nesta ordem) é
 * a que a A Seleção já gravou no bucket — mudá-la apaga o cache de todo
 * contrato. O teste congela os nomes.
 */
export function nomeDoTrecho(pedido: PedidoDeVoz, trecho: TrechoDoRoteiro): string {
  const texto = trecho.falas.map((f) => `${f.falante}: ${f.texto}`);
  return `${pedido.prefixo}/trecho-${hashDe([String(pedido.versao), pedido.direcao, trecho.bloco, ...texto])}.mp3`;
}

/** O episódio inteiro — os trechos emendados —, nomeado por eles. */
export function nomeDoEpisodio(pedido: PedidoDeVoz, roteiro: readonly TrechoDoRoteiro[]): string {
  return `${pedido.prefixo}/episodio-${hashDe(roteiro.map((t) => nomeDoTrecho(pedido, t)))}.mp3`;
}

/**
 * Os trechos que passam do teto da síntese, para o teste de cada missão: um
 * roteiro novo que não cabe falha AQUI, e não no meio da geração da turma.
 */
export function trechosAlemDoTeto(roteiro: readonly TrechoDoRoteiro[]): string[] {
  return roteiro
    .filter((t) => Buffer.byteLength(t.falas.map((f) => `${f.falante}: ${f.texto}`).join("\n"), "utf8") > BYTES_DO_TRECHO)
    .map((t) => t.bloco);
}

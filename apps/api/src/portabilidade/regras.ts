import { createHash } from "node:crypto";
import { z } from "zod";
import { cpfEhValido } from "../comum/cpf";
import { TIPO_DOCUMENTO, TIPOS_DE_RESULTADO, VERSAO_DOCUMENTO } from "./catalogo";

/**
 * Regras puras do perfil portátil: a forma do documento e o hash que a
 * assinatura cobre. Sem banco, sem rede — testável sozinho.
 */

const IsoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

const EscolaDaTrajetoria = z.object({
  nome: z.string().min(1).max(160),
  municipio: z.string().max(120).nullable(),
  uf: z.string().length(2).nullable(),
  entrada: IsoDate,
  saida: IsoDate.nullable(),
});

const TurmaDaTrajetoria = z.object({
  escola: z.string().min(1).max(160),
  turma: z.string().min(1).max(60),
  serie: z.string().max(10).nullable(),
  periodo: z.string().max(60).nullable(),
  entrada: IsoDate,
  saida: IsoDate.nullable(),
});

const Participacao = z.object({
  escola: z.string().min(1).max(160),
  expId: z.string().min(1).max(80),
  nome: z.string().max(120).nullable(),
  em: IsoDate,
});

/**
 * Um resultado é sempre `{ tipo, instrumento, versao, ... }`: a versão do
 * instrumento viaja JUNTO do número. Retrato sem a versão do mapeamento
 * pareceria comparável a um de outra geração, e não é.
 */
const LinhaDeValor = z.object({
  valor: z.string().min(1).max(40),
  nome: z.string().min(1).max(60),
  grau: z.enum(["scored", "indicative", "zero", "none"]),
  /* Só a variante `scored` tem número; as outras são `null` POR TIPO. É o mesmo
     invariante de `vila/leitura.ts`, e ele viaja com o documento de propósito:
     um importador que recebesse "Poder: 100" a partir de um sinal só imprimiria
     na tela o rótulo que este projeto existe para não produzir. */
  numero: z.number().nullable(),
});

const ResultadoPerfilDeValores = z.object({
  tipo: z.literal("perfil-de-valores"),
  expId: z.string().min(1).max(80),
  instrumento: z.string().min(1).max(120),
  versaoMapeamento: z.number().int().positive(),
  em: IsoDate,
  escola: z.string().min(1).max(160),
  amostraSuficiente: z.boolean(),
  /* NULO quando um dos polos não foi observado — eixo com polo não observado é
     indefinido, não zero. A distinção viaja com o documento porque é ela que
     impede o destino de desenhar um circumplexo que ninguém mediu. */
  aberturaVsConservacao: z.number().nullable(),
  transcendenciaVsAutopromocao: z.number().nullable(),
  linhas: z.array(LinhaDeValor).max(20),
  frase: z.string().max(400),
});

export const PerfilPortatilSchema = z.object({
  documento: z.literal(TIPO_DOCUMENTO),
  versao: z.number().int().positive(),
  emitidoEm: IsoDate,
  emissor: z.object({
    contrato: z.string().min(1).max(80),
    /* Origem HTTPS do hub que assinou — é onde o JWKS é procurado. */
    hub: z.string().url().max(200),
    nome: z.string().max(160).nullable(),
  }),
  titular: z.object({
    /* A identidade imutável. É por ela que o destino reconhece a criança, e é o
       único jeito de o documento significar alguma coisa numa base onde nenhum
       id daqui existe. */
    cpf: z.string().refine(cpfEhValido, "CPF inválido"),
    nome: z.string().min(1).max(160),
  }),
  trajetoria: z.object({
    escolas: z.array(EscolaDaTrajetoria).max(200),
    turmas: z.array(TurmaDaTrajetoria).max(400),
  }),
  participacoes: z.array(Participacao).max(500),
  resultados: z.array(ResultadoPerfilDeValores).max(50),
});

export type PerfilPortatil = z.infer<typeof PerfilPortatilSchema>;

export const ArquivoSchema = z.object({
  perfil: PerfilPortatilSchema,
  /* JWS compacto. O payload dele é `{ iss, iat, hash }` — o documento em si fica
     legível no arquivo, e a assinatura cobre o hash canônico dele. Assinar o
     documento como payload deixaria o arquivo ilegível para a família, que é
     quem tem direito a ele. */
  assinatura: z.string().min(20).max(8000),
});

export type ArquivoDePerfil = z.infer<typeof ArquivoSchema>;

/**
 * JSON canônico: chaves ordenadas, recursivamente.
 *
 * Sem isto o hash dependeria da ordem em que o `JSON.stringify` do emissor
 * escreveu as chaves, e uma ida e volta por `JSON.parse` no importador — que
 * preserva a ordem, mas nada garante que um proxy ou um editor de texto no meio
 * do caminho também preserve — quebraria a verificação de um documento
 * legítimo. Falha de verificação tem de significar adulteração, e nada mais.
 */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const entradas = Object.entries(valor as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${jsonCanonico(v)}`).join(",")}}`;
}

/** O que a assinatura cobre. */
export function hashDoPerfil(perfil: unknown): string {
  return createHash("sha256").update(jsonCanonico(perfil), "utf8").digest("hex");
}

/** Versão de formato que este código sabe ler. */
export function versaoSuportada(versao: number): boolean {
  return versao === VERSAO_DOCUMENTO;
}

/** Nome do arquivo oferecido no download — legível por quem recebe por e-mail. */
export function nomeDoArquivo(nome: string, emitidoEm: Date): string {
  const semAcento = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const dia = emitidoEm.toISOString().slice(0, 10);
  return `perfil-${semAcento || "aluno"}-${dia}.json`;
}

export const TIPOS = TIPOS_DE_RESULTADO;

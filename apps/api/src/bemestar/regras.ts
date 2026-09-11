import {
  CHECKINS_POR_CICLO,
  CORTES,
  FAIXAS,
  ITENS,
  ITENS_POR_CHECKIN,
  ITENS_SENTINELA,
  SUBESCALAS,
  VALOR_SENTINELA,
  type Faixa,
  type ItemDass,
  type Resposta,
  type Subescala,
} from "./catalogo";
import { fusoDaPlataforma } from "../comum/fuso";

/**
 * Regras do check-in — funções PURAS, sem Prisma nem HTTP (padrão de
 * `unootube/regras.ts`). O service lê o estado, aplica uma regra e persiste;
 * os testes unitários batem direto aqui.
 *
 *  - `montarOrdem`: a permutação dos 21 itens de um ciclo, de modo que CADA
 *    check-in tenha um item de cada subescala (7 × 3 = 21, sem repetição);
 *  - `pontuar` / `faixaDe`: a correção do DASS-21 (soma ×2, faixas de corte);
 *  - `sinalDeApoio`: itens sentinela e termos de risco no texto livre;
 *  - `validarTextoDaIa`: os GUARDRAILS do que a IA pode dizer.
 */

// -------------------------------------------------------------- ordem

/** PRNG determinístico (mulberry32) — a ordem do ciclo é reproduzível pelo seed. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed numérico a partir de uma string (FNV-1a 32 bits). */
export function seedDe(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function embaralhar<T>(lista: readonly T[], aleatorio: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/**
 * Permutação dos números 1..21 em que a posição `3k..3k+2` (check-in k+1)
 * tem exatamente um item de depressão, um de ansiedade e um de estresse, em
 * ordem embaralhada — o professor nunca vê três frases da mesma dimensão
 * seguidas, e cada check-in pesa igual nas três pontuações.
 */
export function montarOrdem(seed: number): number[] {
  const aleatorio = prng(seed);
  const porSubescala = Object.fromEntries(
    SUBESCALAS.map((s) => [s, embaralhar(ITENS.filter((i) => i.subescala === s).map((i) => i.numero), aleatorio)]),
  ) as Record<Subescala, number[]>;

  const ordem: number[] = [];
  for (let k = 0; k < CHECKINS_POR_CICLO; k += 1) {
    const trio = SUBESCALAS.map((s) => porSubescala[s][k]!);
    ordem.push(...embaralhar(trio, aleatorio));
  }
  return ordem;
}

/** Itens do check-in de número `numero` (1..7) dentro da ordem do ciclo. */
export function itensDoCheckin(ordem: readonly number[], numero: number): ItemDass[] {
  if (numero < 1 || numero > CHECKINS_POR_CICLO) throw new Error(`check-in fora do ciclo: ${numero}`);
  const inicio = (numero - 1) * ITENS_POR_CHECKIN;
  return ordem.slice(inicio, inicio + ITENS_POR_CHECKIN).map(itemPorNumero);
}

export function itemPorNumero(numero: number): ItemDass {
  const item = ITENS.find((i) => i.numero === numero);
  if (!item) throw new Error(`item DASS-21 inexistente: ${numero}`);
  return item;
}

/** As respostas cobrem EXATAMENTE os itens pedidos (nem a mais, nem repetidos). */
export function respostasCasamComItens(respostas: readonly Resposta[], itens: readonly number[]): boolean {
  if (respostas.length !== itens.length) return false;
  const vistos = new Set(respostas.map((r) => r.item));
  return vistos.size === itens.length && itens.every((n) => vistos.has(n));
}

// ---------------------------------------------------------- pontuação

export interface Pontuacao {
  depressao: number;
  ansiedade: number;
  estresse: number;
}

/**
 * Soma por subescala × 2 (a forma curta tem metade dos itens do DASS-42; o
 * dobro põe na escala em que as faixas de corte foram publicadas). Exige as
 * 21 respostas de um ciclo completo.
 */
export function pontuar(respostas: readonly Resposta[]): Pontuacao {
  const porItem = new Map(respostas.map((r) => [r.item, r.valor]));
  if (porItem.size !== ITENS.length) throw new Error(`ciclo incompleto: ${porItem.size} de ${ITENS.length} itens`);
  const soma = (s: Subescala) =>
    ITENS.filter((i) => i.subescala === s).reduce((acc, i) => acc + (porItem.get(i.numero) ?? 0), 0) * 2;
  return { depressao: soma("depressao"), ansiedade: soma("ansiedade"), estresse: soma("estresse") };
}

export function faixaDe(subescala: Subescala, pontos: number): Faixa {
  const cortes = CORTES[subescala];
  let indice = 0;
  for (const corte of cortes) if (pontos >= corte) indice += 1;
  return FAIXAS[indice]!;
}

export interface Resultado extends Pontuacao {
  faixas: Record<Subescala, Faixa>;
}

export function resultadoDe(pontuacao: Pontuacao): Resultado {
  return {
    ...pontuacao,
    faixas: {
      depressao: faixaDe("depressao", pontuacao.depressao),
      ansiedade: faixaDe("ansiedade", pontuacao.ansiedade),
      estresse: faixaDe("estresse", pontuacao.estresse),
    },
  };
}

// ---------------------------------------------------------- segurança

/**
 * Termos que, no texto livre, acendem o sinal de apoio. Deliberadamente
 * AMPLO (falso positivo custa uma mensagem de cuidado a mais; falso negativo
 * custa muito mais). Comparação sem acento e em minúsculas.
 */
const TERMOS_DE_RISCO: readonly RegExp[] = [
  /\bsuicid/,
  /\bme matar\b/,
  /\bacabar com (a minha|minha) vida\b/,
  /\btirar (a minha|minha) vida\b/,
  /\bnao aguento mais\b/,
  /\bnao quero mais viver\b/,
  /\bqueria (sumir|desaparecer|morrer)\b/,
  /\bvontade de (sumir|desaparecer|morrer)\b/,
  /\bsem saida\b/,
  /\bme machucar\b/,
  /\bautomutila/,
];

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Item sentinela (17 "sem valor como pessoa", 21 "a vida não tinha sentido") ≥ 2, ou termo de risco no texto. */
export function sinalDeApoio(respostas: readonly Resposta[], textoLivre?: string): boolean {
  const porItem = new Map(respostas.map((r) => [r.item, r.valor]));
  if (ITENS_SENTINELA.some((n) => (porItem.get(n) ?? 0) >= VALOR_SENTINELA)) return true;
  if (!textoLivre) return false;
  const texto = normalizar(textoLivre);
  return TERMOS_DE_RISCO.some((re) => re.test(texto));
}

// ---------------------------------------------------------- guardrails

/**
 * O que a IA NÃO pode escrever, em nenhum dos textos:
 *  - nomear quadros clínicos / diagnosticar (o instrumento não diagnostica e
 *    o texto do dia não pode induzir a resposta);
 *  - prescrever ou opinar sobre medicação/tratamento;
 *  - dar ordens ("você deve", "você precisa");
 *  - prometer ("vai passar", "tudo vai ficar bem");
 *  - falar em nome de terceiros (gestor, escola, rede) ou citar dados.
 * Comparação sem acento e em minúsculas.
 */
const TERMOS_PROIBIDOS: readonly RegExp[] = [
  /\bdepress(ao|ivo|iva)\b/,
  /\bansiedade\b/,
  /\bansios[oa]\b/,
  /\bestresse\b/,
  /\bestressad[oa]\b/,
  /\bburnout\b/,
  /\btranstorno/,
  /\bdiagnos/,
  /\bsintoma/,
  /\bdoenca\b/,
  /\bpanico\b/,
  /\bsuicid/,
  /\bterapia\b/,
  /\bterapeut/,
  /\bpsic[oó]log/,
  /\bpsiquiatr/,
  /\bmedic(a|o|amento|amentos|acao)\b/,
  /\bremedio/,
  /\btratamento/,
  /\bvoce (deve|precisa|tem que)\b/,
  /\bvai (passar|melhorar|ficar (tudo )?bem)\b/,
  /\btudo vai ficar bem\b/,
  /\b(gestor|gestao|coordenacao|coordenador|diretor|direcao|secretaria)\b/,
  /\b(pontuacao|resultado|nota|notas)\b/,
  /https?:\/\//,
  /[<>{}[\]]/,
];

export type TipoDeTexto = "abertura" | "pergunta" | "acolhimento";

const LIMITES: Record<TipoDeTexto, { min: number; max: number }> = {
  abertura: { min: 20, max: 160 },
  pergunta: { min: 15, max: 140 },
  acolhimento: { min: 30, max: 320 },
};

export type Veredito = { ok: true; texto: string } | { ok: false; motivo: string };

/** Aplica os guardrails; devolve o texto normalizado (espaços) ou o motivo da recusa. */
export function validarTextoDaIa(tipo: TipoDeTexto, bruto: unknown): Veredito {
  if (typeof bruto !== "string") return { ok: false, motivo: "não é texto" };
  const texto = bruto.replace(/\s+/g, " ").trim();
  const { min, max } = LIMITES[tipo];
  if (texto.length < min) return { ok: false, motivo: `curto demais (${texto.length} < ${min})` };
  if (texto.length > max) return { ok: false, motivo: `longo demais (${texto.length} > ${max})` };
  if (tipo === "pergunta" && !texto.endsWith("?")) return { ok: false, motivo: "a pergunta precisa terminar com ?" };
  if (tipo !== "pergunta" && (texto.match(/\?/g) ?? []).length > 1) {
    return { ok: false, motivo: "só a pergunta aberta pergunta" };
  }
  const normalizado = normalizar(texto);
  const proibido = TERMOS_PROIBIDOS.find((re) => re.test(normalizado));
  if (proibido) return { ok: false, motivo: `termo fora do escopo: ${proibido.source}` };
  return { ok: true, texto };
}

// ------------------------------------------------------------- tempo

/** YYYY-MM-DD do instante no fuso do contrato — o "dia" do check-in. */
export function diaDe(instante: Date, fuso: string = fusoDaPlataforma()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}

/** Dia da semana por extenso no fuso — contexto para a IA (não é PII). */
export function diaDaSemana(instante: Date, fuso: string = fusoDaPlataforma()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long" }).format(instante);
}

export function mesDoAno(instante: Date, fuso: string = fusoDaPlataforma()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, month: "long" }).format(instante);
}

/** Item fixo por número de check-in (1..7), sem estourar a lista. */
export function fixoPara<T>(lista: readonly T[], numero: number): T {
  return lista[(Math.max(1, numero) - 1) % lista.length]!;
}

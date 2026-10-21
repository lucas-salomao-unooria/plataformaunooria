import type { Nivel } from "../../evidencias/regras";
import type { MensagemDoPacote } from "../catalogo";

/**
 * O ALERTA DO GRUPO da EF05CO03: realizar operações de negação, conjunção e
 * disjunção sobre "verdadeiro" e "falso" (instrumento 2.5.0, substitui o
 * cartão de frases da 2.4.0).
 *
 * Depois dos crachás, o Mural revelado mostra o quadro das OITO mensagens com
 * os dois crachás de cada uma (as cinco que a criança não encaminhou também:
 * decisão de produto). A criança MONTA um filtro — uma condição, ou duas
 * ligadas por E ou OU, cada uma com o interruptor NÃO —, toca "Ver resultado"
 * e vê quais mensagens passam. Quando acha que o filtro atende o pedido, envia
 * o alerta ao grupo. São quatro pedidos fixos, um por vez.
 *
 * A habilidade está em MONTAR a operação: quem lê os crachás e escolhe a
 * expressão certa já na primeira execução opera sobre os valores; quem chega
 * lá testando, comparando o resultado com o pedido, ainda está em processo.
 *
 * O que fica no SERVIDOR, e nunca desce: a expressão esperada de cada pedido.
 * O cliente recebe o número e o texto do pedido; quem executa o filtro e diz
 * quais mensagens passam é o servidor (a tela só pinta).
 */

// ─────────────────────────────────────────────────────────── a expressão

/**
 * Os dois atributos que a criança liga no filtro. Sem "verdadeira" nem
 * "neutra": elas só existem com o NÃO (o Figma, 20/10). Os ids são os valores
 * do crachá que o chip nomeia.
 */
export const ATRIBUTOS = ["falsa", "emocional"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export const CONECTORES = ["E", "OU"] as const;
export type Conector = (typeof CONECTORES)[number];

/** Uma condição do filtro: o atributo e o interruptor NÃO antes dele. */
export interface CondicaoDoFiltro {
  attr: Atributo;
  nao: boolean;
}

/** Uma condição sozinha, ou duas ligadas por um conector (`op` e `b` juntos, ou nenhum). */
export interface Expressao {
  a: CondicaoDoFiltro;
  op?: Conector;
  b?: CondicaoDoFiltro;
}

export const TOTAL_DE_PEDIDOS = 4;

/** Quantas vezes a criança pode tocar "Ver resultado" em cada pedido. */
export const MAX_EXECUCOES = 3;

/** A soma dos quatro pedidos, de 0 a 8 (2 por pedido). */
export const PONTOS_MAXIMOS = 2 * TOTAL_DE_PEDIDOS;

const F = (nao = false): CondicaoDoFiltro => ({ attr: "falsa", nao });
const EMO = (nao = false): CondicaoDoFiltro => ({ attr: "emocional", nao });

export interface Pedido {
  n: number;
  texto: string;
  /** GABARITO — nunca desce ao estudante. */
  esperada: Expressao;
}

/**
 * Os quatro pedidos, fixos e nesta ordem (a proposta do PO, e4.alerta_*). Os
 * dois primeiros cobrem E e OU sobre os valores que os chips nomeiam; os dois
 * últimos exigem o NÃO, porque "verdadeira" e "neutra" não têm chip.
 *
 * Na matriz do pacote (2 por quadrante), o E de dois valores deixa passar 2
 * mensagens e o OU, 6 — o resultado não é pista: dois filtros diferentes dão
 * o mesmo número.
 */
export const PEDIDOS: readonly Pedido[] = [
  { n: 1, texto: "Destaque para o grupo as mensagens falsas e emocionais.", esperada: { a: F(), op: "E", b: EMO() } },
  { n: 2, texto: "Destaque para o grupo as mensagens falsas ou neutras.", esperada: { a: F(), op: "OU", b: EMO(true) } },
  { n: 3, texto: "Destaque para o grupo as mensagens verdadeiras ou emocionais.", esperada: { a: F(true), op: "OU", b: EMO() } },
  { n: 4, texto: "Destaque para o grupo as mensagens verdadeiras e neutras.", esperada: { a: F(true), op: "E", b: EMO(true) } },
];

export function pedidoDe(n: number): Pedido | null {
  return PEDIDOS.find((p) => p.n === n) ?? null;
}

function ehAtributo(v: unknown): v is Atributo {
  return (ATRIBUTOS as readonly unknown[]).includes(v);
}

function ehConector(v: unknown): v is Conector {
  return (CONECTORES as readonly unknown[]).includes(v);
}

function lerCondicao(bruto: unknown): CondicaoDoFiltro | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const c = bruto as Record<string, unknown>;
  if (!ehAtributo(c.attr) || typeof c.nao !== "boolean") return null;
  return { attr: c.attr, nao: c.nao };
}

/**
 * A forma da expressão, lida de JSON (corpo já validado pelo Zod, ou linha do
 * banco): `op` e `b` andam juntos. Devolve a forma CANÔNICA (sem chave
 * sobrando), que é o que se grava e o que se compara.
 */
export function conferirExpressao(bruto: unknown): Expressao | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const e = bruto as Record<string, unknown>;
  const a = lerCondicao(e.a);
  if (!a) return null;
  const temOp = e.op !== undefined && e.op !== null;
  const temB = e.b !== undefined && e.b !== null;
  if (temOp !== temB) return null;
  if (!temOp) return { a };
  const b = lerCondicao(e.b);
  if (!b || !ehConector(e.op)) return null;
  return { a, op: e.op, b };
}

/** A MESMA expressão, peça a peça (não a equivalente): é o que o "Enviar" exige da última executada. */
export function mesmaExpressao(x: Expressao, y: Expressao): boolean {
  const igual = (c?: CondicaoDoFiltro, d?: CondicaoDoFiltro) =>
    c === undefined || d === undefined ? c === d : c.attr === d.attr && c.nao === d.nao;
  return igual(x.a, y.a) && x.op === y.op && igual(x.b, y.b);
}

/** Os valores que o filtro lê de uma mensagem — o crachá dela. */
type Valores = Pick<MensagemDoPacote, "veracidade" | "tom">;

function valorDa(c: CondicaoDoFiltro, m: Valores): boolean {
  const tem = c.attr === "falsa" ? m.veracidade === "falsa" : m.tom === "emocional";
  return c.nao ? !tem : tem;
}

/** A mensagem passa no filtro? */
export function avaliar(e: Expressao, m: Valores): boolean {
  const a = valorDa(e.a, m);
  if (!e.op || !e.b) return a;
  const b = valorDa(e.b, m);
  return e.op === "E" ? a && b : a || b;
}

/** As quatro combinações de crachá, na ordem fixa da tabela-verdade. */
const COMBINACOES: readonly Valores[] = [
  { veracidade: "verdadeira", tom: "neutra" },
  { veracidade: "verdadeira", tom: "emocional" },
  { veracidade: "falsa", tom: "neutra" },
  { veracidade: "falsa", tom: "emocional" },
];

/** A tabela-verdade da expressão sobre as quatro combinações — é ela que decide a equivalência. */
export function tabelaVerdade(e: Expressao): boolean[] {
  return COMBINACOES.map((m) => avaliar(e, m));
}

/** Duas expressões são EQUIVALENTES se dão o mesmo resultado nas quatro combinações. */
export function equivalentes(x: Expressao, y: Expressao): boolean {
  const tx = tabelaVerdade(x);
  const ty = tabelaVerdade(y);
  return tx.every((v, i) => v === ty[i]);
}

/** As 36 expressões que o montador permite: 4 condições sozinhas + 4 × 2 × 4 compostas. */
export function todasAsExpressoes(): Expressao[] {
  const condicoes = ATRIBUTOS.flatMap((attr) => [false, true].map((nao) => ({ attr, nao })));
  return [
    ...condicoes.map((a) => ({ a })),
    ...condicoes.flatMap((a) => CONECTORES.flatMap((op) => condicoes.map((b) => ({ a, op, b })))),
  ];
}

/** Os ids das mensagens que passam, na ordem do pacote. */
export function passamNoFiltro(e: Expressao, mensagens: readonly (Valores & { id: string })[]): string[] {
  return mensagens.filter((m) => avaliar(e, m)).map((m) => m.id);
}

const ROTULO_DO_ATRIBUTO: Readonly<Record<Atributo, string>> = { falsa: "Falsa", emocional: "Emocional" };

/** A expressão como o montador a desenha ("NÃO Falsa OU Emocional") — para o guia e a folha. */
export function expressaoEmPalavras(e: Expressao): string {
  const c = (x: CondicaoDoFiltro) => `${x.nao ? "NÃO " : ""}${ROTULO_DO_ATRIBUTO[x.attr]}`;
  return e.op && e.b ? `${c(e.a)} ${e.op} ${c(e.b)}` : c(e.a);
}

/** O rótulo de cada mensagem no quadro — DERIVADO do remetente, sem campo novo no pacote. */
export function rotuloNoQuadro(m: Pick<MensagemDoPacote, "remetente">): string {
  return `Mensagem de ${m.remetente}`;
}

// ─────────────────────────────────────────────────────────────── a régua

/**
 * Os pontos de UM pedido enviado, de 0 a 2:
 *
 *   2 — a PRIMEIRA execução já era equivalente ao pedido, e a enviada também;
 *   1 — só a enviada é equivalente (chegou lá comparando o resultado);
 *   0 — a enviada não atende o pedido.
 *
 * A enviada é sempre a última executada (a rota exige), então há pelo menos
 * uma execução. Quem acertou de primeira e depois trocou por outra errada
 * enviou um alerta errado: 0.
 */
export function pontosDoPedido(pedido: Pedido, execucoes: readonly Expressao[], enviada: Expressao): 0 | 1 | 2 {
  if (!equivalentes(enviada, pedido.esperada)) return 0;
  const primeira = execucoes[0];
  return primeira && equivalentes(primeira, pedido.esperada) ? 2 : 1;
}

/**
 * A RÉGUA da EF05CO03 sobre a soma dos quatro pedidos (0 a 8): 6–8 atingiu,
 * 3–5 em processo, 0–2 não atingiu. Só é chamada com os QUATRO enviados —
 * quem enviou menos fica "Não avaliado", a ausência de marca. As chances no
 * chute estão cravadas em `tests/quem-mandou-isso-regras.spec.ts`.
 */
export function nivelCO03(pontos: number): Nivel {
  if (!Number.isInteger(pontos) || pontos < 0 || pontos > PONTOS_MAXIMOS) {
    throw new Error(`pontos fora de 0..${PONTOS_MAXIMOS}`);
  }
  if (pontos >= 6) return "atingiu";
  if (pontos >= 3) return "em_processo";
  return "nao_atingiu";
}

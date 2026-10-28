import { ETAPAS, PASSOS, type AcaoDoGate, type Etapa, type Passo } from "../vocabulario";

/**
 * Os passos da exp03ef1b e a regra que reconcilia A TURMA com O ESTUDANTE.
 *
 * Dois relógios, como nas outras missões de sala:
 *
 * - `exp03ef1b_gates_turma.etapa` (+ `pausada`) — o relógio da TURMA. Dois
 *   portões: "Liberar Filtro" (`aposta` → `filtro`) e "Liberar Inspeção"
 *   (`filtro` → `inspecao`); e "Pausar Turma"/"Retomar Turma".
 * - `exp03ef1b_sessoes.passo` — a tela daquele computador.
 *
 * Cada etapa tem um TETO de passo: `aposta` → `aposta` (quem travou a escolha
 * espera ali), `filtro` → `omissao` (quem confrontou espera ali), `inspecao` →
 * `fim`. O passo efetivo é `min(passo gravado, teto)`; quem tem o gravado ACIMA
 * do teto está AGUARDANDO a professora (o overlay de espera, sem botão).
 *
 * `passoEfetivo` mora aqui — puro e testável — porque a api e a experiência
 * precisam chegar à MESMA resposta num F5.
 */

const ORDEM: Record<Passo, number> = Object.fromEntries(PASSOS.map((p, i) => [p, i])) as Record<Passo, number>;
const ORDEM_DA_ETAPA: Record<Etapa, number> = Object.fromEntries(ETAPAS.map((e, i) => [e, i])) as Record<
  Etapa,
  number
>;

export const PASSO_INICIAL: Passo = "galeria";
export const ETAPA_INICIAL: Etapa = "aposta";

/** O passo mais adiantado que cada etapa deixa a criança VER. */
export const TETO_DA_ETAPA: Readonly<Record<Etapa, Passo>> = {
  aposta: "aposta",
  filtro: "omissao",
  inspecao: "fim",
};

export function ehPasso(valor: string): valor is Passo {
  return (PASSOS as readonly string[]).includes(valor);
}

export function ehEtapa(valor: string): valor is Etapa {
  return (ETAPAS as readonly string[]).includes(valor);
}

/** O CHECK da migração já restringe; o fallback existe porque o Prisma entrega `string`. */
export function normalizarPasso(valor: string | null | undefined): Passo {
  return valor && ehPasso(valor) ? valor : PASSO_INICIAL;
}

export function normalizarEtapa(valor: string | null | undefined): Etapa {
  return valor && ehEtapa(valor) ? valor : ETAPA_INICIAL;
}

export function ordemDoPasso(passo: Passo): number {
  return ORDEM[passo];
}

export function passoAntes(a: Passo, b: Passo): boolean {
  return ORDEM[a] < ORDEM[b];
}

export function passoNoMinimo(passo: Passo, piso: Passo): boolean {
  return ORDEM[passo] >= ORDEM[piso];
}

/** O passo que o estudante deve ver: `min(passo gravado, teto da etapa)`. */
export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  const teto = TETO_DA_ETAPA[etapa];
  return ORDEM[passo] > ORDEM[teto] ? teto : passo;
}

/**
 * O estudante espera a professora? Quando o gravado passou do teto: travou a
 * escolha antes do "Liberar Filtro", ou confrontou a omissão antes do
 * "Liberar Inspeção". (A PAUSA é outra coisa: `pausada` vem do gate.)
 */
export function aguardandoOProfessor(passo: Passo, etapa: Etapa): boolean {
  return ORDEM[passo] > ORDEM[TETO_DA_ETAPA[etapa]];
}

/** A etapa seguinte, ou `null` na última — é o rótulo do botão do painel. */
export function proximaEtapa(atual: Etapa): Etapa | null {
  return ETAPAS[ORDEM_DA_ETAPA[atual] + 1] ?? null;
}

/** O rótulo do botão que abre cada etapa (painel, E4-PROF-01). */
export const ROTULO_DA_LIBERACAO: Readonly<Record<Exclude<Etapa, "aposta">, string>> = {
  filtro: "Liberar Filtro",
  inspecao: "Liberar Inspeção",
};

export type EstadoDoGate = { etapa: Etapa; pausada: boolean };
export type PedidoDoGate = { acao: AcaoDoGate; para?: Etapa };
export type ResultadoDoGate =
  | { ok: true; estado: EstadoDoGate; mudou: boolean }
  | { ok: false; codigo: "transicao-de-etapa-invalida" };

/**
 * O clique da professora, sobre o gate atual.
 *
 * - `liberar` sem `para`: a próxima etapa; na última, recusado.
 * - `liberar` com `para`: a MESMA é aceita e não muda nada (o segundo clique,
 *   o retry da rede); a próxima anda uma; pular ou voltar é recusado.
 * - `pausar`/`retomar`: idempotentes. Liberar com a turma pausada é aceito e
 *   NÃO despausa: quem retoma é o botão "Retomar Turma".
 */
export function transicaoDoGate(atual: EstadoDoGate, pedido: PedidoDoGate): ResultadoDoGate {
  if (pedido.acao === "pausar") return { ok: true, estado: { ...atual, pausada: true }, mudou: !atual.pausada };
  if (pedido.acao === "retomar") return { ok: true, estado: { ...atual, pausada: false }, mudou: atual.pausada };
  const proxima = proximaEtapa(atual.etapa);
  const para = pedido.para ?? proxima;
  if (para === null) return { ok: false, codigo: "transicao-de-etapa-invalida" };
  if (para === atual.etapa) return { ok: true, estado: atual, mudou: false };
  if (para === proxima) return { ok: true, estado: { ...atual, etapa: para }, mudou: true };
  return { ok: false, codigo: "transicao-de-etapa-invalida" };
}

/**
 * Os passos que a própria criança PEDE (`POST passo`), sem dado: o "Confrontar
 * e Aguardar Turma ▶" (omissao → ficha), o "Continuar" do desfecho (→ ponte) e
 * o da ponte (→ rotina). Os outros nascem das rotas que os carimbam.
 */
export const PASSOS_PEDIDOS = ["ficha", "ponte", "rotina"] as const;
export type PassoPedido = (typeof PASSOS_PEDIDOS)[number];

const ORIGEM_DO_PEDIDO: Readonly<Record<PassoPedido, Passo>> = {
  ficha: "omissao",
  ponte: "desfecho",
  rotina: "ponte",
};

export type ResultadoDoPasso = { ok: true; passo: Passo } | { ok: false; codigo: "passo-invalido" };

/**
 * O passo que a criança PEDE, sobre o GRAVADO dela: do passo de origem anda
 * um; já no destino ou adiante, devolve o dela (o retry, o F5 — a escada é de
 * sentido único); antes da origem, recusado.
 */
export function pedirPasso(atual: Passo, para: PassoPedido): ResultadoDoPasso {
  if (atual === ORIGEM_DO_PEDIDO[para]) return { ok: true, passo: para };
  if (passoNoMinimo(atual, para)) return { ok: true, passo: atual };
  return { ok: false, codigo: "passo-invalido" };
}

export type ResultadoDaAcao =
  | { ok: true }
  | { ok: false; codigo: "turma-pausada" | "etapa-nao-liberada" | "passo-fora-de-ordem" };

/**
 * A criança pode fazer a jogada do passo `esperado` agora? Com a turma
 * pausada, nada se grava. Com o gravado acima do teto e a jogada além dele, a
 * etapa ainda não foi liberada (403). Fora isso, só a jogada do passo
 * EFETIVO vale (409).
 */
export function podeAgir(passo: Passo, gate: EstadoDoGate, esperado: Passo): ResultadoDaAcao {
  if (gate.pausada) return { ok: false, codigo: "turma-pausada" };
  const efetivo = passoEfetivo(passo, gate.etapa);
  if (efetivo === esperado) return { ok: true };
  if (ORDEM[esperado] > ORDEM[TETO_DA_ETAPA[gate.etapa]]) return { ok: false, codigo: "etapa-nao-liberada" };
  return { ok: false, codigo: "passo-fora-de-ordem" };
}

/**
 * Os passos da exp04ef1b e a regra que reconcilia A TURMA com O ESTUDANTE.
 *
 * Dois relógios, como nas outras missões de sala (exp05ef1b, exp07ef1b):
 *
 * - `exp04ef1b_gates_turma.etapa` — o relógio da TURMA. UM botão no painel,
 *   que sempre diz a próxima etapa: "Liberar resultado", depois "Liberar
 *   revisão" (decisão de 2026-09-25: o professor controla cada etapa).
 * - `exp04ef1b_sessoes.passo` — a tela daquele computador. Antes da primeira
 *   publicação cada um anda no seu ritmo; entre ela e a revisão, a turma anda
 *   junta; da Chave em diante, cada um anda de novo sozinho.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e a experiência precisam chegar à MESMA resposta num F5.
 *
 * O caminho de uma criança:
 *
 *   desafio → mesa ──(1ª publicação, LATCH)──→ motivo → publicada
 *     → [professor libera o resultado] → resultado
 *     → [professor libera a revisão]   → chave → revisao
 *     ──(2ª publicação, LATCH)──→ comparativo → transferencia → fim
 *
 * `resultado` e `chave` nunca são GRAVADOS: a etapa da turma os impõe a quem
 * está em `publicada`. O passo gravado sai de `publicada` só quando a Chave se
 * forma (`revisao`).
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "desafio",
  "mesa",
  "motivo",
  "publicada",
  "resultado",
  "chave",
  "revisao",
  "comparativo",
  "transferencia",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que o professor as abre. */
export const ETAPAS = ["exploracao", "resultado", "revisao"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "exploracao";
export const PASSO_INICIAL: Passo = "desafio";

/** Os passos ANTES da 1ª publicação: onde a criança ainda monta a página. */
export const PASSOS_ANTES_DA_PUBLICACAO: readonly Passo[] = ["desafio", "mesa"];

/**
 * Os passos em que a ETAPA manda: quem já publicou e respondeu o motivo espera
 * o resultado, vê o resultado, e é levado à Chave quando a revisão abre.
 */
const PASSOS_DA_TURMA: readonly Passo[] = ["publicada", "resultado", "chave"];

/**
 * Os passos que a própria criança pede, por `POST passo`. Os outros nascem das
 * rotas que os carimbam: `motivo` (o latch da 1ª), `publicada` (o motivo),
 * `revisao` (a Chave formada), `comparativo` (o latch da 2ª), `fim` (concluir).
 */
export const PASSOS_PEDIDOS = ["mesa", "transferencia"] as const;
export type PassoPedido = (typeof PASSOS_PEDIDOS)[number];

/** O passo que cada etapa impõe a quem está na zona da turma. */
const PASSO_DA_ETAPA: Record<Etapa, Passo> = {
  exploracao: "publicada",
  resultado: "resultado",
  revisao: "chave",
};

const ORDEM: Record<Passo, number> = Object.fromEntries(PASSOS.map((p, i) => [p, i])) as Record<Passo, number>;
const ORDEM_DA_ETAPA: Record<Etapa, number> = Object.fromEntries(ETAPAS.map((e, i) => [e, i])) as Record<
  Etapa,
  number
>;

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

export function passoAntes(a: Passo, b: Passo): boolean {
  return ORDEM[a] < ORDEM[b];
}

export function etapaAntes(a: Etapa, b: Etapa): boolean {
  return ORDEM_DA_ETAPA[a] < ORDEM_DA_ETAPA[b];
}

/** Já publicou a 1ª edição? É o latch que põe a criança sob o relógio da turma. */
export function publicouAPrimeira(passo: Passo): boolean {
  return !PASSOS_ANTES_DA_PUBLICACAO.includes(passo);
}

/**
 * O passo que o estudante deve ver, dado o dele e a etapa da turma.
 *
 * 1. Antes de publicar, a etapa não o toca: com o resultado liberado, quem
 *    ainda monta a página continua montando (a publicação atrasada é caminho
 *    previsto — ninguém vê o resultado de uma edição que não existe).
 * 2. O `motivo` é do estudante, com qualquer etapa: a pergunta vem logo depois
 *    do latch e ANTES de a criança ver o resultado, senão a resposta sai
 *    contaminada pela consequência.
 * 3. Na zona da turma (`publicada`), a etapa é piso e teto: espera, resultado,
 *    Chave. É o que sincroniza a sala na mediação.
 * 4. Da Chave formada em diante (`revisao`...`fim`) o passo é da criança, e
 *    nada o puxa de volta. O gate nunca volta dentro de uma rodada — e quando a
 *    rodada muda (zerar, pacote novo) a sessão é outra.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  if (!publicouAPrimeira(passo)) return passo;
  if (passo === "motivo") return passo;
  if (PASSOS_DA_TURMA.includes(passo)) return PASSO_DA_ETAPA[etapa];
  return passo;
}

/**
 * O estudante espera o professor? É o que a tela de espera lê. `resultado`
 * também espera: a criança lê as reações e aguarda a revisão abrir — o PRD põe
 * a mediação oral entre as duas coisas.
 */
export function aguardandoOProfessor(passo: Passo, etapa: Etapa): boolean {
  const efetivo = passoEfetivo(passo, etapa);
  return efetivo === "publicada" || efetivo === "resultado";
}

/** A etapa seguinte, ou `null` na última — é o rótulo do botão único do painel. */
export function proximaEtapa(atual: Etapa): Etapa | null {
  return ETAPAS[ORDEM_DA_ETAPA[atual] + 1] ?? null;
}

export type ResultadoDoGate = { ok: true; mudou: boolean } | { ok: false; codigo: "transicao-de-etapa-invalida" };

/**
 * A transição que o professor pede, pela etapa de DESTINO: a mesma é aceita e
 * não muda nada (o segundo clique, o retry da rede); a próxima anda uma;
 * qualquer outra — pular o resultado, voltar da revisão — é recusada. Pular
 * tiraria da sala a mediação que a revisão pressupõe.
 */
export function transicaoDoGate(atual: Etapa, para: Etapa): ResultadoDoGate {
  if (para === atual) return { ok: true, mudou: false };
  if (proximaEtapa(atual) === para) return { ok: true, mudou: true };
  return { ok: false, codigo: "transicao-de-etapa-invalida" };
}

export type ResultadoDoPasso = { ok: true; passo: Passo } | { ok: false; codigo: "passo-invalido" };

/**
 * O passo que a criança PEDE, sobre o passo GRAVADO dela.
 *
 * - `mesa`: do desafio para a mesa. Pedir de novo na mesa devolve a mesa; depois
 *   do latch, devolve o passo em que ela está (a escada é de sentido único, e um
 *   F5 não pode reabrir a 1ª edição).
 * - `transferencia`: só de quem está no comparativo (o "Avançar para o desafio
 *   final"). Depois dele, devolve o passo em que ela está.
 */
export function pedirPasso(atual: Passo, para: PassoPedido): ResultadoDoPasso {
  if (para === "mesa") {
    if (atual === "desafio" || atual === "mesa") return { ok: true, passo: "mesa" };
    return { ok: true, passo: atual };
  }
  if (atual === "comparativo") return { ok: true, passo: "transferencia" };
  if (atual === "transferencia" || atual === "fim") return { ok: true, passo: atual };
  return { ok: false, codigo: "passo-invalido" };
}

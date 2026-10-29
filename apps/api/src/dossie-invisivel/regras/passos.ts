import { ETAPAS_DO_GATE, type EtapaDoGate } from "../conteudo";

/**
 * O PASSO do estudante — DERIVADO dos carimbos da sessão e do gate da turma,
 * nunca guardado numa coluna (o desenho da exp02em1b e da exp03em1b):
 *
 *   abertura → conversa → espera1 → revelacao → espera2 → explicar → concluida
 *
 * - `conversa` (E1–E3): o chat com o assistente, a oferta dos cadernos, "Ver
 *   Projetos" e o painel de deliberação — fecha no "Registrar Decisão" (latch 1).
 * - `espera1`: decidiu e a turma ainda não teve a revelação liberada.
 * - `revelacao` (E4): os cadernos, a tabela e as pílulas; o 2º voto só abre com
 *   o gate em `revoto` (a trava do DEBATE, decisão do Lucas fiel ao PO) — a
 *   tela mostra a espera do debate até lá. Fecha no "Confirmar Decisão Final"
 *   (latch 2).
 * - `espera2`: revotou e a turma ainda não teve o Explicar liberado.
 * - `explicar` (E5): Amara, as âncoras e o Editor de Protocolo — fecha no
 *   "Enviar Proposta", que conclui.
 *
 * Quem chega atrasado a uma trava já aberta não espera: decidiu depois da
 * revelação liberada, vai direto à revelação.
 */
export const PASSOS = ["abertura", "conversa", "espera1", "revelacao", "espera2", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const ETAPA_INICIAL: EtapaDoGate = "exploracao";

export interface MarcosDaSessao {
  entrou: boolean;
  decidiu: boolean;
  revotou: boolean;
  concluiu: boolean;
}

export function normalizarEtapa(bruta: string | null | undefined): EtapaDoGate {
  return (ETAPAS_DO_GATE as readonly string[]).includes(bruta ?? "") ? (bruta as EtapaDoGate) : ETAPA_INICIAL;
}

export function etapaAtingiu(atual: EtapaDoGate | null, alvo: EtapaDoGate): boolean {
  return atual !== null && ETAPAS_DO_GATE.indexOf(atual) >= ETAPAS_DO_GATE.indexOf(alvo);
}

/** O gate só anda para a FRENTE: o clique repetido ou fora de ordem não volta nada. */
export function avancarEtapa(atual: EtapaDoGate, alvo: EtapaDoGate): EtapaDoGate {
  return etapaAtingiu(atual, alvo) ? atual : alvo;
}

export function passoEfetivo(m: MarcosDaSessao | null, etapa: EtapaDoGate | null): Passo {
  if (!m || !m.entrou) return "abertura";
  if (m.concluiu) return "concluida";
  if (!m.decidiu) return "conversa";
  if (!m.revotou) return etapaAtingiu(etapa, "revelacao") ? "revelacao" : "espera1";
  return etapaAtingiu(etapa, "explicar") ? "explicar" : "espera2";
}

/**
 * Uma ordem ESTÁVEL por sessão (o mesmo F5 vê a mesma ordem): o ranking da
 * E3 nasce embaralhado — sem sugerir "Regularidade" em 1º (plano G7) — e o
 * banco do Editor de Protocolo também, para a posição não entregar o gabarito.
 * Fisher-Yates com um gerador linear sobre o hash da semente.
 */
export function embaralhar<T>(itens: readonly T[], semente: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619) >>> 0;
  const saida = [...itens];
  for (let i = saida.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [saida[i], saida[j]] = [saida[j] as T, saida[i] as T];
  }
  return saida;
}

/** O 2º voto está aberto? Precisa da trava do debate (`revoto`) — a tela mostra a espera até lá. */
export function revotoAberto(etapa: EtapaDoGate | null): boolean {
  return etapaAtingiu(etapa, "revoto");
}

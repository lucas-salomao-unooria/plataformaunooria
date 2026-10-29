import { ETAPAS_DO_GATE, type EtapaDoGate } from "../conteudo";

/**
 * O PASSO do estudante — DERIVADO dos carimbos da sessão e do gate da turma,
 * nunca guardado numa coluna (o desenho da exp02em1b):
 *
 *   abertura → dados → compositor → feed → errata → laudo → pericia → concluida
 *
 * - `dados` (E2): o chat do Assistente aberto, a tabela e o anexo.
 * - `compositor` (E3): o compositor aberto, antes da 1ª publicação.
 * - `feed` (E4): publicou, e a turma ainda não teve a retomada liberada — o
 *   post, as reações, o post espelho da escola rival, e a pausa do debate.
 * - `errata` (E4b): publicou e o gate está `liberada`, sem decidir a errata.
 *   Quem publica DEPOIS da liberação cai direto aqui (decisão 7).
 * - `laudo` (E5): a errata decidida (publicada ou pulada).
 * - `pericia` (E6): a perícia aberta; `concluida`: parecer emitido ou pulado.
 *
 * A PAUSA não é passo: é camada sobre qualquer um deles até a conclusão, e as
 * jogadas respondem 409 `telas-pausadas` enquanto ela dura.
 */
export const PASSOS = ["abertura", "dados", "compositor", "feed", "errata", "laudo", "pericia", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const ETAPA_INICIAL: EtapaDoGate = "exploracao";

export interface MarcosDaSessao {
  chatAberto: boolean;
  compositorAberto: boolean;
  publicou: boolean;
  errataDecidida: boolean;
  periciaAberta: boolean;
  concluiu: boolean;
}

export function normalizarEtapa(bruta: string | null | undefined): EtapaDoGate {
  return (ETAPAS_DO_GATE as readonly string[]).includes(bruta ?? "") ? (bruta as EtapaDoGate) : ETAPA_INICIAL;
}

/** O gate só anda para a FRENTE: o clique repetido ou fora de ordem não volta nada. */
export function avancarEtapa(atual: EtapaDoGate, alvo: EtapaDoGate): EtapaDoGate {
  return ETAPAS_DO_GATE.indexOf(atual) >= ETAPAS_DO_GATE.indexOf(alvo) ? atual : alvo;
}

export function passoEfetivo(m: MarcosDaSessao | null, etapa: EtapaDoGate | null): Passo {
  if (!m) return "abertura";
  if (m.concluiu) return "concluida";
  if (m.periciaAberta) return "pericia";
  if (m.errataDecidida) return "laudo";
  if (m.publicou) return etapa === "liberada" ? "errata" : "feed";
  if (m.compositorAberto) return "compositor";
  if (m.chatAberto) return "dados";
  return "abertura";
}

/** A tela está congelada pelo professor? A conclusão não congela: já acabou. */
export function pausada(passo: Passo, etapa: EtapaDoGate | null): boolean {
  return etapa === "pausa" && passo !== "concluida";
}

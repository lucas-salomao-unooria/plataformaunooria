import { FASES, type Fase } from "../conteudo";

/**
 * O PASSO do estudante — DERIVADO dos carimbos da sessão e do gate da turma,
 * nunca guardado numa coluna (a terceira fonte de uma verdade que os carimbos
 * já dizem; o mesmo desenho da exp05ef1b).
 *
 *   abertura → conversa → feed → explicar → concluida
 *
 * `conversa` cobre as Etapas 1 a 3 (o chat, a prévia e a escolha da manchete):
 * a manchete é uma janela da conversa, e o PUBLICAR é o latch que a fecha.
 * `explicar` só abre com o gate em `explicar` ("Avançar Turma para Explicar").
 *
 * A PAUSA ("Pausar Telas para Debate") não é passo: é uma camada sobre
 * qualquer um deles (`pausada`), e as jogadas respondem 409 enquanto ela dura.
 *
 * A `etapa` é o nome do contrato no PRD (§6) para o mesmo estado — a tela e a
 * telemetria a usam; o servidor decide pelo passo.
 */
export const PASSOS = ["abertura", "conversa", "feed", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const ETAPAS = [
  "E1_DESAFIAR",
  "E2_NAVEGAR_CHAT",
  "E2_PREVIA_APROVADA",
  "E4_RESULTADO_AHA",
  "E4_MODERADO",
  "ESPERA_PROFESSOR",
  "E5_EXPLICAR",
  "E7_CONCLUIDO",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const FASE_INICIAL: Fase = "exploracao";

export interface MarcosDaSessao {
  publicou: boolean;
  concluiu: boolean;
}

export function normalizarFase(bruta: string | null | undefined): Fase {
  return (FASES as readonly string[]).includes(bruta ?? "") ? (bruta as Fase) : FASE_INICIAL;
}

export function faseAtingiu(atual: Fase, alvo: Fase): boolean {
  return FASES.indexOf(atual) >= FASES.indexOf(alvo);
}

/** O gate só anda para a FRENTE: o clique repetido ou fora de ordem não volta nada. */
export function avancarFase(atual: Fase, alvo: Fase): Fase {
  return faseAtingiu(atual, alvo) ? atual : alvo;
}

export function passoEfetivo(marcos: MarcosDaSessao | null, fase: Fase | null): Passo {
  if (!marcos) return "abertura";
  if (marcos.concluiu) return "concluida";
  if (!marcos.publicou) return "conversa";
  return fase === "explicar" ? "explicar" : "feed";
}

/** A tela está congelada pelo professor? A conclusão não congela: já acabou. */
export function pausada(passo: Passo, fase: Fase | null): boolean {
  return fase === "pausa" && passo !== "concluida";
}

/** A etapa do contrato (PRD §6) para o passo, a pausa e o que a sessão já fez. */
export function etapaDoContrato(passo: Passo, f: { pausada: boolean; previaAprovada: boolean; avisoFixado: boolean }): Etapa {
  if (passo === "concluida") return "E7_CONCLUIDO";
  if (f.pausada) return "ESPERA_PROFESSOR";
  switch (passo) {
    case "abertura":
      return "E1_DESAFIAR";
    case "conversa":
      return f.previaAprovada ? "E2_PREVIA_APROVADA" : "E2_NAVEGAR_CHAT";
    case "feed":
      return f.avisoFixado ? "E4_MODERADO" : "E4_RESULTADO_AHA";
    case "explicar":
      return "E5_EXPLICAR";
  }
}

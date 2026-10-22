import { FASES, type Fase } from "../conteudo";

/**
 * O PASSO do estudante — DERIVADO dos carimbos da sessão e da fase da turma,
 * nunca guardado numa coluna (a terceira fonte de uma verdade que os carimbos
 * já dizem; o mesmo desenho da exp05ef1b).
 *
 *   abertura → conversa → feed → explicar → concluida
 *
 * `conversa` cobre as Etapas 1 a 3 (o chat, a prévia e a escolha da manchete):
 * a manchete é uma janela da conversa, e o PUBLICAR é o latch que a fecha.
 * `explicar` só abre com a turma na fase `explicar` ("Liberar Etapa 5").
 *
 * A PAUSA ("Pausar Telas para Debate") não é passo: é uma camada sobre
 * qualquer um deles (`pausada`), e as jogadas respondem 409 enquanto ela dura.
 */
export const PASSOS = ["abertura", "conversa", "feed", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const FASE_INICIAL: Fase = "aberta";

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

/** A fase só anda para a FRENTE: o clique repetido ou fora de ordem não volta nada. */
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
  return fase === "debate" && passo !== "concluida";
}

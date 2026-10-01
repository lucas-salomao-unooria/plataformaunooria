import { dataHora, diaDaPlataforma, hora } from "@edu/sdk";

/**
 * Quando a conversa mudou, como a linha do histórico mostra: "Hoje, 14:32",
 * "Ontem, 09:10" ou "29/09/2026, 18:05".
 *
 * O `ChatHistory` do DS recebe a data JÁ formatada (o DS não formata data), e
 * quem formata é o `@edu/sdk`, com o fuso da plataforma (ADR-98, ADR-99) —
 * "hoje" é o dia NO FUSO DA REDE, não no do navegador nem no do contêiner.
 * `agora` entra por parâmetro para o teste não depender do relógio.
 */
export function quandoNaLista(iso: string, agora: Date = new Date()): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return "—";
  const dia = diaDaPlataforma(quando);
  if (dia === diaDaPlataforma(agora)) return `Hoje, ${hora(quando)}`;
  if (dia === diaDaPlataforma(new Date(agora.getTime() - 24 * 60 * 60 * 1000))) return `Ontem, ${hora(quando)}`;
  return dataHora(quando);
}

/** O título que a lista mostra enquanto o agente não deu um (fim do 1º turno). */
export const TITULO_PROVISORIO = "Nova conversa";

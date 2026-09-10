import type { BadgeProps } from "@edu/ui/ds";
import type { Faixa } from "./tipos";

/** Telas do app. O check-in é a entrada; `feito` é o pós-envio (ou o dia já respondido). */
export type Tela = "checkin" | "feito" | "historico";

/** Todos os itens do dia têm resposta (0..3). */
export function todasRespondidas(respostas: Readonly<Record<number, number | undefined>>, itens: readonly number[]): boolean {
  return itens.every((n) => {
    const v = respostas[n];
    return typeof v === "number" && v >= 0 && v <= 3;
  });
}

/** Cor do rótulo da faixa: sem alarme na faixa esperada, escalando até o vermelho. */
export function varianteDaFaixa(faixa: Faixa): NonNullable<BadgeProps["variant"]> {
  switch (faixa) {
    case "normal":
      return "success";
    case "leve":
      return "info";
    case "moderado":
      return "warning";
    default:
      return "error";
  }
}

export function percentual(respondidos: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((respondidos / total) * 100)));
}

/** `2026-08-25` → `25/08`. Sem `new Date(dia)`: o parse ISO-só-data é UTC e viraria o dia à noite. */
export function formatarDia(dia: string): string {
  const [ano, mes, d] = dia.split("-");
  if (!ano || !mes || !d) return dia;
  return `${d}/${mes}`;
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Mensagem que o professor lê para cada status HTTP de erro da api. */
export function mensagemDoStatus(status: number | null, padrao = "Não deu para enviar agora. Suas respostas continuam aqui — tente de novo."): string {
  switch (status) {
    case 400:
      return "Responda às três frases antes de enviar.";
    case 409:
      return "A resposta de hoje já foi registrada. Atualizamos a tela.";
    case 429:
      return "Muitas tentativas seguidas. Espere um instante e tente de novo.";
    case 404:
      return "Essa resposta não está mais disponível. Recarregue a página.";
    default:
      return padrao;
  }
}

/** Quantos check-ins faltam para fechar o ciclo. */
export function faltam(respondidos: number, total: number): number {
  return Math.max(0, total - respondidos);
}

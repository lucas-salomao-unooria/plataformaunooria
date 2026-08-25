import type { StatusPlano } from "./tipos";

/** Telas do app. `lista` é a entrada; o Stepper cobre as três do fluxo de criação. */
export type Tela = "lista" | "novo" | "gerando" | "resultado";

/** Para onde o polling leva a tela, a partir do status do plano. */
export function telaDoStatus(status: StatusPlano): Tela {
  if (status === "pronto") return "resultado";
  if (status === "erro") return "novo";
  return "gerando";
}

/** Mensagem que o professor lê para cada status HTTP de erro da api. */
export function mensagemDoStatus(status: number | null, padrao = "Não deu para concluir agora. Tente de novo."): string {
  switch (status) {
    case 400:
      return "Ainda não há material de referência para essa disciplina e série.";
    case 409:
      return "Você já tem um plano sendo gerado. Aguarde ele terminar.";
    case 429:
      return "Limite de gerações atingido por agora. Tente mais tarde.";
    case 404:
      return "Esse plano não está mais disponível.";
    default:
      return padrao;
  }
}

/** Rótulo curto e variante de Badge por status. */
export function rotuloDoStatus(status: StatusPlano): { texto: string; variante: "success" | "warning" | "error" | "info" } {
  switch (status) {
    case "pronto":
      return { texto: "Pronto", variante: "success" };
    case "erro":
      return { texto: "Erro", variante: "error" };
    case "gerando":
      return { texto: "Gerando", variante: "info" };
    default:
      return { texto: "Na fila", variante: "warning" };
  }
}

/** `2EF` → "2º ano", `2EM` → "2ª série EM" (o mesmo mapa de `comum/series.ts` da api). */
export function rotuloDaSerie(serie: string): string {
  const numero = serie[0];
  return serie.endsWith("EM") ? `${numero}ª série EM` : `${numero}º ano`;
}

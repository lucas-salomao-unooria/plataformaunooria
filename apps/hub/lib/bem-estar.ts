/**
 * **Como você está?** — check-in de bem-estar do professor (DASS-21 em
 * microdoses). É a experiência `exp-91-bem-estar` (Vite, estática,
 * `publico: "professor"`), embedada em `/professor/bem-estar` com a MESMA
 * sessão e o MESMO token da plataforma. O lado server é `apps/api/src/bemestar`.
 *
 * Só aparece em superfícies do professor; `/exp/exp-91-...` responde 404.
 * O card do hub lê `GET /bemestar/resumo` (leve, sem IA) para dizer se o
 * check-in de hoje já foi feito — o convite diário é o que sustenta o hábito.
 */
export const EXP_BEM_ESTAR = "exp-91-bem-estar";
export const ROTA_BEM_ESTAR = "/professor/bem-estar";

/** O que a api devolve em `GET /bemestar/resumo`. */
export type ResumoBemEstar = {
  hoje: "pendente" | "respondido";
  respondidos: number;
  total: number;
  cicloAberto: boolean;
};

/** Linha de estado do card, a partir do resumo (ou do silêncio da api). */
export function situacaoDoBemEstar(resumo: ResumoBemEstar | null): string {
  if (!resumo) return "Menos de 1 minuto por dia";
  if (resumo.hoje === "respondido") {
    return resumo.respondidos >= resumo.total
      ? "Check-in de hoje feito · ciclo fechado"
      : `Check-in de hoje feito · ${resumo.respondidos} de ${resumo.total}`;
  }
  return resumo.respondidos > 0
    ? `Check-in de hoje pendente · ${resumo.respondidos} de ${resumo.total}`
    : "Check-in de hoje pendente · ~40 segundos";
}

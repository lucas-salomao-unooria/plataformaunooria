/**
 * Séries no formato canônico do manifesto/CSV (`1EF..9EF`, `1EM..3EM`).
 * Zero imports: o middleware (edge) importa daqui via `papeis.ts`.
 */
export const SERIES = [
  "1EF", "2EF", "3EF", "4EF", "5EF", "6EF", "7EF", "8EF", "9EF",
  "1EM", "2EM", "3EM",
] as const;

export type Serie = (typeof SERIES)[number];

/** Como a série se escreve na tela ("8º ano", "2ª série EM"). */
export function rotuloDaSerie(serie: Serie): string {
  const numero = serie[0];
  return serie.endsWith("EM") ? `${numero}ª série EM` : `${numero}º ano`;
}

/**
 * Normaliza qualquer grafia de série para o enum; `null` se não reconhecer.
 * Hoje a sessão já carrega o enum (o CSV valida na entrada), mas o WSO2 pode
 * trazer "8º ano" e um aluno sem turma chega sem série — defensivo, não corretivo.
 */
export function normalizarSerie(bruta: string | null | undefined): Serie | null {
  if (!bruta) return null;
  const texto = bruta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[ºª°]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const canonicoEf = /^([1-9])\s?EF$/.exec(texto);
  if (canonicoEf) return `${canonicoEf[1]}EF` as Serie;
  const canonicoEm = /^([1-3])\s?EM$/.exec(texto);
  if (canonicoEm) return `${canonicoEm[1]}EM` as Serie;

  const medio = /^([1-3])\s?[OA]?\s?(SERIE|ANO)\s?(DO\s)?(EM|ENSINO MEDIO|MEDIO)$/.exec(texto);
  if (medio) return `${medio[1]}EM` as Serie;

  const fundamental = /^([1-9])\s?[OA]?\s?ANO(\s?(DO\s)?(EF|ENSINO FUNDAMENTAL|FUNDAMENTAL))?$/.exec(texto);
  if (fundamental) return `${fundamental[1]}EF` as Serie;

  return null;
}

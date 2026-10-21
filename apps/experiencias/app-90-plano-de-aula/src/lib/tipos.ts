/** Espelho do que a api devolve em `/planos/*` (apps/api/src/planos). */

export type StatusPlano = "pendente" | "gerando" | "pronto" | "erro";

export interface PlanoResumo {
  id: string;
  serie: string;
  serieRotulo: string;
  disciplina: string;
  disciplinaRotulo: string;
  titulo: string;
  status: StatusPlano;
  erro: string | null;
  tokensUsados: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Disponivel {
  disciplina: string;
  rotulo: string;
  series: string[];
}

export interface RespostaObter {
  plano: PlanoResumo;
  html: string | null;
}

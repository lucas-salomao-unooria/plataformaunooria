/**
 * Rótulos do ciclo de vida de uma atividade (`activities.status`, doc 06).
 *
 * Vive fora das páginas porque o mesmo mapa é lido pelo hub, pela lista da
 * missão e pela tela da atividade — antes eram três cópias com a chance de
 * divergirem no dia em que um estado novo aparecesse.
 */
export type VarianteDeStatus =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "disable";

export const STATUS_DA_ATIVIDADE: Record<
  string,
  { rotulo: string; variante: VarianteDeStatus }
> = {
  rascunho: { rotulo: "Rascunho", variante: "neutral" },
  antagonismo: { rotulo: "Aguardando validação", variante: "info" },
  gerando: { rotulo: "Gerando conteúdo", variante: "warning" },
  revisao: { rotulo: "Em revisão", variante: "info" },
  ativa: { rotulo: "Ativa", variante: "success" },
  encerrada: { rotulo: "Encerrada", variante: "disable" },
};

export function statusDaAtividade(status: string): {
  rotulo: string;
  variante: VarianteDeStatus;
} {
  return (
    STATUS_DA_ATIVIDADE[status] ?? { rotulo: status, variante: "neutral" }
  );
}

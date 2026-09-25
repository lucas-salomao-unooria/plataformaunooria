"use client";

import { FeedbackAlert } from "@edu/ui/ds";
import { ROTULO_DO_STATUS, STATUS_DA_EVIDENCIA } from "@/lib/evidencias";

export type Erro = { titulo: string; mensagem: string; erros: string[] };

/**
 * O erro de uma ação do painel: a `mensagem` da api e, no `ajuste-invalido`, a
 * lista INTEIRA de `erros` — a api já os escreve em frases para o professor.
 * Aparece dentro da janela aberta (é lá que o professor está olhando) ou, sem
 * janela, no topo da seção.
 */
export function ErroDoPainel({ erro }: { erro: Erro | null }) {
  if (!erro) return null;
  return (
    <FeedbackAlert type="error" title={erro.titulo} description={erro.mensagem}>
      {erro.erros.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px]">
          {erro.erros.map((item, indice) => (
            <li key={`${indice}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </FeedbackAlert>
  );
}

/**
 * As quatro escolhas das duas janelas de ajuste, na ordem da escala. "Não
 * participou" é o N/A EXPLÍCITO: ele diz o que faz, porque o efeito (barrar a
 * cópia da equipe) não é óbvio pelo nome.
 */
export const OPCOES_DE_NIVEL = STATUS_DA_EVIDENCIA.map((status) => ({
  value: status,
  label: ROTULO_DO_STATUS[status],
  ...(status === "nao_participou"
    ? { helperText: "Não recebe o resultado da equipe e não conta no perfil." }
    : {}),
}));

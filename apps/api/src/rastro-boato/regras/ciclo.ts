import { IDS_DE_BLOCO, ORDEM_CORRETA, type IdDeBloco } from "../catalogo";

/**
 * A validação do construtor da Etapa 5 — coerência sistêmica, **sem nota**.
 *
 * O que a regra devolve não é "acertou/errou" com pontos, é `coerente`: a
 * sequência descreve o ciclo de vida do boato ou não. Errar aqui não desconta
 * nada e não bloqueia a missão (RF-007); o que bloqueia é slot vazio, porque
 * um modelo incompleto não é um modelo.
 *
 * A ordem certa mora no catálogo do servidor. Enviá-la ao cliente junto com os
 * textos poria o gabarito no DevTools do estudante — e a Etapa 5 vira um
 * arrastar-até-encaixar sem pensamento nenhum.
 */

export type ResultadoDoCiclo =
  | { ok: true; coerente: boolean; ordem: IdDeBloco[] }
  | { ok: false; codigo: "blocos-incompletos" };

/**
 * Confere a sequência montada.
 *
 * Recusa três coisas, e as três são "modelo incompleto", não "resposta errada":
 * quantidade diferente de 4, bloco fora do catálogo e bloco repetido. Repetido
 * é o caso sutil — arrastar "gatilho" para dois slots deixa um slot logicamente
 * vazio, ainda que o array venha com 4 posições preenchidas.
 */
export function validarCiclo(ordem: readonly string[]): ResultadoDoCiclo {
  if (ordem.length !== IDS_DE_BLOCO.length) return { ok: false, codigo: "blocos-incompletos" };

  const conhecidos = new Set<string>(IDS_DE_BLOCO);
  if (ordem.some((id) => !conhecidos.has(id))) return { ok: false, codigo: "blocos-incompletos" };
  if (new Set(ordem).size !== ordem.length) return { ok: false, codigo: "blocos-incompletos" };

  const montada = ordem as readonly IdDeBloco[];
  const coerente = montada.every((id, i) => id === ORDEM_CORRETA[i]);
  return { ok: true, coerente, ordem: [...montada] };
}

import { AUDITORIAS_EXIGIDAS, ehMensagem } from "../catalogo";

/**
 * A cota de auditoria — a porta que a missão MEDE (EF06CO01).
 *
 * A regra inteira cabe numa frase: a crise da Etapa 3 só chega depois de o
 * estudante abrir os dados de **3 mensagens DISTINTAS**. Distintas é a palavra
 * que faz o trabalho — abrir o mesmo balão três vezes não é auditar três
 * fontes, e foi a primeira pergunta da banca ao PO.
 *
 * A dedupe é do SERVIDOR, não da tela: o cliente manda o `mensagemId` que
 * abriu, e quem conta o conjunto é aqui. Um contador incrementado no cliente
 * seria um número que o estudante controla.
 */

export interface EstadoDaAuditoria {
  /** Ids distintos já auditados, na ordem em que foram abertos. */
  auditadas: string[];
  total: number;
  cotaAtingida: boolean;
  faltam: number;
}

export function estadoDaAuditoria(ids: readonly string[]): EstadoDaAuditoria {
  const distintas = [...new Set(ids)];
  const total = distintas.length;
  return {
    auditadas: distintas,
    total,
    cotaAtingida: total >= AUDITORIAS_EXIGIDAS,
    faltam: Math.max(AUDITORIAS_EXIGIDAS - total, 0),
  };
}

export type ResultadoDeAuditar =
  | { ok: true; novo: boolean }
  | { ok: false; codigo: "mensagem-desconhecida" };

/**
 * Registrar a abertura de um balão.
 *
 * Repetir NÃO é erro: `ok: true, novo: false`. O estudante que reabre o mesmo
 * modal está relendo, e devolver 409 ali transformaria uma releitura em falha
 * na tela — pelo contrário, reler é o comportamento que a missão quer.
 * O que a repetição não faz é contar de novo.
 */
export function auditar(
  jaAuditadas: readonly string[],
  mensagemId: string,
): ResultadoDeAuditar {
  if (!ehMensagem(mensagemId)) return { ok: false, codigo: "mensagem-desconhecida" };
  return { ok: true, novo: !jaAuditadas.includes(mensagemId) };
}

/** O estudante pode enviar a intervenção? A cota é a única condição. */
export function podeDecidir(ids: readonly string[]): boolean {
  return estadoDaAuditoria(ids).cotaAtingida;
}

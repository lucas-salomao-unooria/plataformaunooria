import { PROMPTS_EXIGIDOS } from "../catalogo";

/**
 * A cota de auditoria da Etapa 2 — a porta que a missão MEDE.
 *
 * A regra de negócio PED-02: a Etapa 3 (o pico) só abre com pelo menos 2
 * prompts DISTINTOS enviados. O que ela impede é decidir a governança da
 * máquina antes de tê-la contradito — que é exatamente o hábito que a aula
 * tenta desfazer.
 *
 * Pura e sem banco de propósito: é a regra que o teste unitário prende, e o
 * service só a aplica.
 */

export interface EstadoDaAuditoria {
  enviados: string[];
  total: number;
  cotaAtingida: boolean;
  faltam: number;
}

export function estadoDaAuditoria(enviados: readonly string[]): EstadoDaAuditoria {
  const distintos = [...new Set(enviados)];
  return {
    enviados: distintos,
    total: distintos.length,
    cotaAtingida: distintos.length >= PROMPTS_EXIGIDOS,
    faltam: Math.max(0, PROMPTS_EXIGIDOS - distintos.length),
  };
}

export type ResultadoDoDisparo =
  | { ok: true; novo: boolean; enviados: string[] }
  | { ok: false; codigo: "prompt-desconhecido" | "prompt-ja-enviado" };

/**
 * Registra um disparo de prompt.
 *
 * Reenviar o MESMO prompt é recusado — e aqui, diferente da auditoria da
 * exp-06, com erro e não com `novo: false`. A diferença é o que a tela faz:
 * lá reabrir um balão é releitura legítima, e um 409 transformaria leitura em
 * erro; aqui o card já disparado fica DESABILITADO no seletor (critério de
 * aceite de `E2-ALU-02`), então um segundo disparo do mesmo id só chega por
 * clique duplo ou aba repetida — casos em que a resposta certa é recusar, para
 * a conversa não ganhar a mesma pergunta duas vezes.
 */
export function disparar(
  enviados: readonly string[],
  promptId: string,
  idsValidos: readonly string[],
): ResultadoDoDisparo {
  if (!idsValidos.includes(promptId)) return { ok: false, codigo: "prompt-desconhecido" };
  if (enviados.includes(promptId)) return { ok: false, codigo: "prompt-ja-enviado" };
  return { ok: true, novo: true, enviados: [...enviados, promptId] };
}

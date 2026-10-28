import type { ExperienciaHandle } from "@edu/sdk";
import type { EtapaDaTela } from "./regras";

/**
 * Telemetria ANALÍTICA da missão — `verbo:objeto`, o catálogo do PRD 2.1.0
 * (§ telemetria). O que a evidência mede (a fonte pedida, a manchete, o aviso,
 * a proteção) é gravado pela api, na rota de cada gesto: aqui ficam só os
 * sinais de produto.
 *
 * O que NUNCA sai daqui: o texto que o estudante escreveu no chat (texto livre
 * de menor — dele sai o TAMANHO, e só; o `prompt_tipo` do EVT-001 é
 * classificado no servidor), nome de colega, o nível. Contrato:
 * `track(verbo, objeto, { resultado?, contexto? })`.
 */
let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, resultado: Record<string, unknown>, etapa: EtapaDaTela) {
  exp?.track(verbo, objeto, { resultado, contexto: { etapa } });
}

export const telemetria = {
  /** EVT-U01 — a primeira tela, depois do handshake. */
  entrou: (retomada: boolean) => track("attempted", "missao:iniciar", { retomada }, "E1"),
  /** EVT-U02 — a entrada em cada etapa (E1…E6). */
  etapa: (etapa: EtapaDaTela) => track("progressed", "etapa:entrar", { etapa }, etapa),
  /** EVT-U03 — `concluir()`. */
  concluiu: () => track("completed", "exp02em1b", { concluido: true }, "E6"),
  /** EVT-U04 — a dica de 60 s sem ação no chat. */
  inatividade: () => track("interacted", "aviso:inatividade", { segundos_sem_acao: 60 }, "E2"),
  /** EVT-U05 — o banner de conexão instável. */
  erro: (codigo: string, etapa: EtapaDaTela) => track("attempted", "erro:exibir", { codigo }, etapa),
  /** EVT-001 — um prompt ao UnooriaAI: só o tamanho. */
  prompt: (caracteres: number) => track("interacted", "chat:prompt_enviar", { caracteres }, "E2"),
  /** EVT-002 — o latch 1 (a manchete é vocabulário fechado). */
  publicou: (manchete: string) => track("scored", "decisao:publicar", { manchete_tipo: manchete }, "E3"),
  /** EVT-003 — o aviso de cuidado fixado, com o motivo. */
  aviso: (motivo: string) => track("interacted", "aviso_cuidado:fixar", { motivo }, "E4"),
  /** EVT-004 — uma ação de proteção (o nome da ação, nunca o nível). */
  seguranca: (tipo: string) => track("interacted", "seguranca:acao_acionar", { tipo }, "E4"),
  /** EVT-005 — um cartão apontado nos bastidores. */
  evidencia: (elemento: string) => track("interacted", "evidencia:apontar", { elemento }, "E5"),
};

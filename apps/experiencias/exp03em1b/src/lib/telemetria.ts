import type { ExperienciaHandle } from "@edu/sdk";
import type { EtapaDaTela } from "./regras";
import type { Escala, Motivo, Parecer, Publicar } from "./tipos";

/**
 * Telemetria ANALÍTICA da missão — `verbo:objeto`, o catálogo do PRD §13.1
 * (EVT-U01..U05 e EVT-001..009; o EVT-004 é do professor e sai da api). O que
 * a evidência mede (o anexo antes do nudge, a publicação, a errata, o
 * parecer) é gravado pela api, na rota de cada gesto: aqui ficam os sinais de
 * produto, sem PII — `estudante_id` opaco é do SDK, e nenhum texto livre
 * existe nesta missão. Contrato: `track(verbo, objeto, { resultado, contexto })`.
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
  /** EVT-U02 — a entrada em cada etapa. */
  etapa: (etapa: EtapaDaTela) => track("progressed", "etapa:entrar", { etapa }, etapa),
  /** EVT-U03 — `concluir()`. */
  concluiu: () => track("completed", "exp03em1b", { sucesso: true }, "E6"),
  /** EVT-U04 — o nudge de 90 s (E1 e E2). */
  inatividade: (etapa: EtapaDaTela) => track("interacted", "aviso:inatividade", { segundos_sem_acao: 90 }, etapa),
  /** EVT-U05 — o banner de rede ou a falha do gráfico. */
  erro: (codigo: string, etapa: EtapaDaTela) => track("attempted", "erro:exibir", { codigo }, etapa),
  /** EVT-001 — a nota técnica aberta. */
  anexo: () => track("interacted", "anexo:nota_metodologica", { abriu: true }, "E2"),
  /** EVT-002 — a origem do eixo marcada no compositor. */
  escala: (eixo: Escala, etapa: EtapaDaTela) => track("configured", "escala:origem_y", { eixo_origem: eixo }, etapa),
  /** EVT-003 — o latch 1 (a 1ª publicação). */
  publicou: (p: Publicar) => track("scored", "decisao:publicar_boletim", { ...p, is_errata: false }, "E3"),
  /** EVT-005 — a errata publicada (slot 2). */
  errata: (p: Publicar) => track("submitted", "errata:segunda_chance", { ...p, is_errata: true }, "E4b"),
  /** EVT-006 — "Avançar sem publicar errata". */
  pulouErrata: () => track("skipped", "errata:pular", { pulou: true }, "E4b"),
  /** EVT-007 — o motivo de um cartão. */
  motivo: (cartao: "A" | "B", motivo: Motivo) => track("configured", "pericia:motivo", { cartao, motivo }, "E6"),
  /** EVT-008 — o parecer emitido. */
  parecer: (p: Parecer) =>
    track("submitted", "pericia:parecer_tecnico", { sinalizou_A: p.sinalizouA, motivo_A: p.motivoA, sinalizou_B: p.sinalizouB, motivo_B: p.motivoB }, "E6"),
  /** EVT-009 — "Avançar sem emitir parecer". */
  pulouPericia: () => track("skipped", "pericia:refletir", { pulou: true }, "E6"),
};

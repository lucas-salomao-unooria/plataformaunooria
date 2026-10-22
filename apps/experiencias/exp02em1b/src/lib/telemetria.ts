import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria ANALÍTICA da missão — `verbo:objeto`, e nada além disso. O que a
 * evidência mede (a fonte pedida, o post publicado, a moderação) é gravado pela
 * api, na rota de cada gesto: aqui ficam só os sinais de produto.
 *
 * O que NUNCA sai daqui: o texto que o estudante escreveu no chat (texto livre
 * de menor — dele sai o TAMANHO, e só), o nível, a categoria de saúde de um
 * comentário (é gabarito). Contrato: `track(verbo, objeto, { resultado?, contexto? })`.
 */
let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> }) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** EVT-U01 — a primeira tela, depois do handshake. */
  entrou: (retomada: boolean) => track("attempted", "missao:iniciar", { resultado: { retomada } }),
  /** EVT-U02 — a entrada em cada passo. */
  etapa: (passo: string) => track("progressed", "etapa:entrar", { contexto: { passo } }),
  /** Uma mensagem ao UnooriaAI: só o tamanho. */
  mensagem: (caracteres: number) => track("interacted", "chat:enviar", { resultado: { caracteres } }),
  /** EVT-U04 — o lembrete de 90 s sem ação no chat (D0-5). */
  inatividade: () => track("interacted", "aviso:inatividade", { resultado: { segundos_sem_acao: 90 } }),
  /** O latch, do lado do produto (a manchete é vocabulário fechado). */
  publicou: (manchete: string) => track("interacted", "post:publicar", { resultado: { manchete } }),
  /** EVT-005 — uma ferramenta do feed (o nome da ação, nunca o nível). */
  feed: (acao: string) => track("interacted", "ferramenta:feed", { resultado: { acao } }),
  /** EVT-007 — um indicador apontado no Explicar. */
  indicador: (indicador: string) => track("interacted", "evidencia:apontar", { resultado: { indicador } }),
  /** EVT-U05 — o banner de rede instável. */
  rede: () => track("attempted", "erro:exibir", { resultado: { codigo: "rede-instavel" } }),
  /** EVT-U03. */
  concluiu: () => track("completed", "missao:concluida"),
};

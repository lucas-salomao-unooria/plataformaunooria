import type { ExperienciaHandle } from "@edu/sdk";
import type { EtapaDaMissao } from "./regras";
import { EXP_ID, EXP_VERSION, type IdDeNoticia, type TipoDePista } from "./tipos";

/**
 * Telemetria analítica da missão — a tabela canônica do PRD §13 (EVT-U01 a
 * U05, EVT-001 a 004) com o que o Canal A da 3.0.0 acrescentou (EVT-005 e
 * EVT-006, ADR-168), e nada além disso.
 *
 * **O contrato do SDK é `track(verbo, objeto, { resultado?, contexto? })`**, e
 * os dois são OBJETOS. Não existe campo `dados`: chave desconhecida é
 * descartada em silêncio. Mandar string solta em `resultado` derruba o lote
 * inteiro com `eventos.N.resultado: invalid_type`.
 *
 * **Só ids e números** (regra 6): o id da notícia (`n1`…`n8`, a POSIÇÃO na
 * mesa), o tipo da pista, a edição, a quantidade. Nenhum texto, nome ou e-mail
 * — e a missão não tem texto livre de menor.
 *
 * **Os afastamentos do PRD, de propósito:**
 * - nenhum evento leva a ESCOLHA que vale nível — o veredito de uma pista, o
 *   lado de um cartão, os blocos da Chave, a decisão de publicar ou repassar.
 *   Cruzada com o gabarito, cada uma é o nível da habilidade, e esse mapa é
 *   segredo de servidor (regra 3); a fonte da verdade são as colunas da api. É
 *   a mesma razão de o antigo EVT-004 nunca ter levado a alternativa de P1/P2.
 * - EVT-002 sai no LATCH e não leva `verificadas`: a tela não sabe quantas
 *   estavam verificadas quando publica (o resultado só desce depois do portão
 *   do professor). O número vai num evento próprio, quando o resultado chega
 *   (`resultado:ver`); a fonte da verdade continua sendo a coluna da api.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle | null) {
  exp = handle;
}

type Valor = number | boolean | string | readonly string[];

function track(
  verbo: "attempted" | "interacted" | "progressed" | "completed" | "scored",
  objeto: string,
  dados?: { resultado?: Record<string, Valor>; contexto?: Record<string, Valor> },
) {
  exp?.track(verbo, objeto, dados);
}

/** O papel pedagógico de cada etapa, como o PRD o escreve no EVT-U02. */
const PAPEL: Record<EtapaDaMissao, string> = {
  E1: "desafio",
  E2: "core_action",
  E3: "core_action",
  E4: "resultado",
  E5: "core_action",
  EREV: "core_action",
  ESIM: "core_action",
  E6: "transferencia",
};

export const telemetria = {
  /** EVT-U01 — a primeira tela da missão, depois do handshake. `retomada`: não é a primeira vez. */
  iniciou: (retomada: boolean, etapa: EtapaDaMissao) =>
    track("attempted", "missao:iniciar", { resultado: { retomada }, contexto: { etapa } }),

  /** EVT-U02 — entrou numa etapa. */
  entrouNaEtapa: (etapa: EtapaDaMissao) =>
    track("progressed", "etapa:entrar", { resultado: { etapa }, contexto: { pedagogical_role: PAPEL[etapa] } }),

  /** EVT-001 — tocou num chip de pista. `fase` 1 = antes da 1ª edição, 2 = na revisão. */
  inspecionou: (noticiaId: IdDeNoticia, tipo: TipoDePista, fase: 1 | 2, abertas: number) =>
    track("interacted", "noticia:inspecionar", { resultado: { tipo, abertas }, contexto: { noticia_id: noticiaId, fase } }),

  /** EVT-002 — o LATCH de uma edição, confirmado pela api. */
  publicou: (edicao: 1 | 2, slots: readonly IdDeNoticia[]) =>
    track("scored", "edicao:publicar", { resultado: { edicao }, contexto: { slots } }),

  /** O resultado da 1ª edição chegou à tela (depois do portão). Só números. */
  viuOResultado: (verificadas: number, percentual: number) =>
    track("progressed", "resultado:ver", { resultado: { verificadas, percentual }, contexto: { etapa: "E4" } }),

  /**
   * EVT-005 — marcou "confio / não confio" numa pista da mesa. O PAR, nunca o
   * veredito; `novo: false` = o par já tinha marcação (vale a primeira).
   */
  julgou: (noticiaId: IdDeNoticia, tipo: TipoDePista, novo: boolean) =>
    track("interacted", "pista:julgar", { resultado: { tipo, novo }, contexto: { noticia_id: noticiaId, fase: 1 } }),

  /** EVT-003 — a Chave montada e enviada (um envio, sem correção). Sem os blocos nem os lados. */
  montouAChave: () => track("interacted", "chave:montar", { resultado: { enviada: true }, contexto: { etapa: "E5" } }),

  /** EVT-006 — a simulação enviada: quantas pistas ela abriu em cada matéria, sem vereditos nem decisões. */
  simulou: (pistasPorMateria: readonly number[]) =>
    track("interacted", "simulacao:enviar", {
      resultado: { pistas_s1: pistasPorMateria[0] ?? 0, pistas_s2: pistasPorMateria[1] ?? 0 },
      contexto: { etapa: "ESIM" },
    }),

  /** EVT-004 — decidiu diante do boato. Quantas pistas abriu ANTES, nunca a decisão. */
  transferiu: (pistasAntes: number) =>
    track("interacted", "transferencia:decidir", { resultado: { pistas_abertas: pistasAntes }, contexto: { etapa: "E6" } }),

  /** EVT-U03 — `concluir()`. O tempo é indicativo (desde a primeira abertura NESTA aba). */
  concluiu: (tempoTotalS: number) =>
    track("completed", EXP_ID, { resultado: { tempo_total_s: tempoTotalS }, contexto: { versao: EXP_VERSION } }),

  /** EVT-U04 — noventa segundos sem toque nem tecla numa tela em que a criança age. */
  ficouInativa: (etapa: EtapaDaMissao, segundos: number) =>
    track("interacted", "aviso:inatividade", { resultado: { segundos_sem_acao: segundos }, contexto: { etapa } }),

  /** EVT-U05 — um erro diegético apareceu (sem sinal, limite, sessão, rodada nova, imagem). */
  viuErro: (
    codigo: "sem-sinal" | "muitas-requisicoes" | "sessao-expirada" | "rodada-mudou" | "midia-indisponivel",
    etapa: EtapaDaMissao,
  ) =>
    track("attempted", "erro:exibir", { resultado: { codigo }, contexto: { etapa } }),
};

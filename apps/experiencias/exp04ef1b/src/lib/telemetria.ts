import type { ExperienciaHandle } from "@edu/sdk";
import type { EtapaDaMissao } from "./regras";
import { EXP_ID, EXP_VERSION, type IdDaPergunta, type IdDeNoticia, type TipoDePista } from "./tipos";

/**
 * Telemetria analítica da missão — a tabela canônica do PRD §13 (EVT-U01 a
 * U05, EVT-001 a 004), e nada além dela.
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
 * **Dois afastamentos do PRD, de propósito:**
 * - EVT-004 leva a PERGUNTA, nunca a alternativa (o PRD pedia `opcao_id`): o id
 *   da alternativa é o nível da habilidade para quem conhece a ficha, e esse
 *   mapa é segredo de servidor (regra 3). O mesmo que a exp07ef1b faz.
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

  /** EVT-003 — uma tentativa da Chave, com o que a api respondeu. */
  tentouAChave: (sucesso: boolean, tentativas: number) =>
    track("interacted", "algoritmo:ordenar", { resultado: { sucesso, tentativas }, contexto: { etapa: "E5" } }),

  /** EVT-004 — respondeu P1 ou P2. A PERGUNTA, nunca a alternativa. */
  respondeu: (questao: IdDaPergunta) =>
    track("interacted", "transferencia:responder", { resultado: { questao }, contexto: { etapa: "E6" } }),

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

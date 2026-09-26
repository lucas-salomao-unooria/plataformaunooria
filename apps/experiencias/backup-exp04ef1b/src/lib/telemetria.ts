import { experiencia } from "./api";
import { EXP_ID, type Tela } from "./tipos";

/**
 * Canal ANALÍTICO (SDK → batch → Pub/Sub). O estado da missão vai pelo canal
 * síncrono (`/unootube/*`); aqui só o rastro de uso. Nenhum evento carrega se
 * um vídeo é confiável — o cliente não sabe (regra 3).
 */
function track(verbo: string, objeto: string, dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> }) {
  try {
    experiencia().track(verbo, objeto, dados);
  } catch {
    // sem SDK (teste) — telemetria é best-effort
  }
}

export const telemetria = {
  abriu: () => track("attempted", EXP_ID),
  salvou: (videoId: string) => track("interacted", `salvar:${videoId}`),
  removeuSalvo: (videoId: string) => track("interacted", `remover-salvo:${videoId}`),
  curtiu: (videoId: string, curtido: boolean) => track("interacted", `${curtido ? "curtir" : "descurtir"}:${videoId}`),
  trocouTela: (tela: Tela) => track("interacted", `tela:${tela}`),
  expandiuDescricao: (videoId: string) => track("interacted", `descricao:${videoId}`),
  som: (ligado: boolean) => track("interacted", `som:${ligado ? "on" : "off"}`),
  ordenou: (modo: string) => track("interacted", `ordenar:${modo}`),
  buscaBloqueada: () => track("interacted", "busca-bloqueada"),
  /** Tocou em "Começar missão" na tela de entrada — leu (ou pulou) o briefing. */
  comecouMissao: () => track("interacted", "comecar-missao"),
  /**
   * Tocou em "Concluir missão" com os 3 favoritos escolhidos. É diferente de
   * `completouSalvos`: aquele marca o 3º salvo, este marca a DECISÃO de fechar.
   * A distância entre os dois é quanto tempo a criança levou revendo a escolha.
   */
  concluiuMissao: () => track("interacted", "concluir-missao"),
  /** Bateu no teto de 3 e viu o diálogo da troca. */
  limiteAtingido: () => track("interacted", "limite-atingido"),
  completouSalvos: (resultado: { inscritos: number; fontesConfiaveis: number }) =>
    track("progressed", "missao-3-salvos", { resultado }),
  reiniciou: () => track("interacted", "reiniciar"),
};

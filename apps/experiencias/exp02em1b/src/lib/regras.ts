import { TEXTOS } from "./textos";
import type { DestinoDoRelato, Estado, MotivoDoAviso, Passo } from "./tipos";

/**
 * A lógica PURA das telas — sem React, sem SDK —, para o teste prender o que
 * não se vê no typecheck: o que vai para o hub, que etapa a telemetria diz, que
 * texto o feed escreve para cada motivo e destino.
 */

/** A etapa do PRD em que a tela está (EVT-U02 e o `contexto` de todo evento). */
export type EtapaDaTela = "E1" | "E2" | "E3" | "E4" | "E5" | "E6";

const ETAPA_DO_PASSO: Record<Passo, EtapaDaTela> = {
  abertura: "E1",
  conversa: "E2",
  feed: "E4",
  explicar: "E5",
  concluida: "E6",
};

export function etapaDoPasso(passo: Passo): EtapaDaTela {
  return ETAPA_DO_PASSO[passo];
}

/**
 * O que o hub desenha FORA do aparelho (`exp:estado`). O TC-10 vale em toda
 * tela da Etapa 4 — o feed, as folhas, os diálogos, o relato e a pausa por cima
 * dele —, e em nenhuma outra: `{}` é o que o retira. O relógio (E3-SIS-01) já
 * tem o passo `feed`, mas ainda não é o feed.
 */
export function estadoParaOHub(estado: Pick<Estado, "passo" | "feed">, relogioTocando: boolean): Record<string, unknown> {
  if (estado.passo !== "feed" || !estado.feed || relogioTocando) return {};
  const { antes, destaque, depois } = estado.feed.instrucao;
  return { instrucao: { antes, destaque, depois } };
}

export function bannerDoAviso(motivo: MotivoDoAviso): string {
  return TEXTOS.aviso.motivos[motivo].banner;
}

export function confirmacaoDoRelato(destino: DestinoDoRelato): string {
  return TEXTOS.central.encaminhado[destino];
}

/**
 * A opção da copy é UMA frase ("Equipe do Unoovista: situações de abuso…"); a
 * linha da lista mostra o nome em cima e o resto embaixo. O nome acessível
 * continua sendo a frase inteira.
 */
export function partirOpcao(texto: string): [string, string] {
  const i = texto.indexOf(": ");
  return i < 0 ? [texto, ""] : [texto.slice(0, i), texto.slice(i + 2)];
}

/**
 * O índice da próxima opção num grupo de rádio pelas setas (WAI-ARIA: a seta
 * move E seleciona; o fim volta ao começo). `null` para tecla que não é seta.
 */
export function proximaOpcao(atual: number, tecla: string, total: number): number | null {
  if (total <= 0) return null;
  if (tecla === "ArrowDown" || tecla === "ArrowRight") return (Math.max(atual, -1) + 1) % total;
  if (tecla === "ArrowUp" || tecla === "ArrowLeft") return (Math.max(atual, 0) - 1 + total) % total;
  return null;
}

/** As iniciais do avatar de um comentário ("radar_escola_off" → "RE"). */
export function iniciais(nome: string): string {
  return nome
    .split(/[\s_.]+/)
    .filter(Boolean)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

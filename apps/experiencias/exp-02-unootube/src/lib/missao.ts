import type { EstadoMissao, Tela } from "./tipos";

/**
 * Onde a experiência abre.
 *
 * A tela de entrada explica a missão ANTES de o aluno agir — mas só faz sentido
 * uma vez. Recarregar a página no meio da missão (ou voltar depois de fechar o
 * iframe) tem de cair direto no feed: repetir o briefing a cada `F5` faria o
 * aluno pular a leitura justamente na vez em que ele leria.
 *
 * O critério é "nada aconteceu ainda", e inclui `curtidos` de propósito: curtir
 * não conta para a missão, mas conta como ter começado. O único caminho de
 * volta à entrada é reiniciar a missão pelo perfil.
 */
export function missaoNaoIniciada(estado: EstadoMissao): boolean {
  return (
    estado.salvos.length === 0 &&
    estado.curtidos.length === 0 &&
    !estado.rankingDesbloqueado &&
    !estado.credibilidadeAdicionada
  );
}

export function telaInicial(estado: EstadoMissao): Tela {
  return missaoNaoIniciada(estado) ? "entrada" : "feed";
}

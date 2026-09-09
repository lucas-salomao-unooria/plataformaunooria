import { HttpException } from "@nestjs/common";

/**
 * Erros do jogo com código legível para a experiência decidir o que mostrar.
 * O corpo `{codigo, mensagem}` é compatível com o `{mensagem}` que o resto da
 * api já usa. As mensagens são linguagem de app real — nada de "atividade",
 * "professor" ou "gabarito" na tela do estudante.
 */
export type CodigoErro =
  | "VIDEO_DESCONHECIDO"
  | "LIMITE_SALVOS"
  | "RANKING_BLOQUEADO"
  | "MISSAO_CONCLUIDA"
  | "TURMA_NAO_ENCONTRADA"
  | "ESCOLA_OBRIGATORIA";

const STATUS: Record<CodigoErro, number> = {
  VIDEO_DESCONHECIDO: 400,
  LIMITE_SALVOS: 409,
  RANKING_BLOQUEADO: 409,
  MISSAO_CONCLUIDA: 409,
  TURMA_NAO_ENCONTRADA: 404,
  ESCOLA_OBRIGATORIA: 400,
};

const MENSAGENS: Record<CodigoErro, string> = {
  VIDEO_DESCONHECIDO: "Esse vídeo não está mais disponível.",
  LIMITE_SALVOS: "Sua playlist está cheia. Remova um vídeo para salvar outro.",
  RANKING_BLOQUEADO: "O ranking abre quando você salvar 3 vídeos.",
  MISSAO_CONCLUIDA: "Você já fechou sua playlist. Reinicie a missão para trocar.",
  TURMA_NAO_ENCONTRADA: "Turma não encontrada nesta escola.",
  ESCOLA_OBRIGATORIA: "gestor_contrato: informe ?escolaId=",
};

export function erroDeJogo(codigo: CodigoErro): never {
  throw new HttpException({ codigo, mensagem: MENSAGENS[codigo] }, STATUS[codigo]);
}

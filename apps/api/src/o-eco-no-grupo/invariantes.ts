/**
 * Invariantes de produto verificáveis da exp-07. Esta lista vive em UM lugar só
 * e é importada pelo sanitizador da saída de IA, pela redaction do log e pelo
 * teste. Alterar aqui obriga a rodar a suíte da api.
 *
 * Molde: `apps/api/src/unoogpt/invariantes.ts`.
 */

/** Campos que NUNCA cruzam a fronteira do cliente nem entram em log. */
export const CAMPOS_SENSIVEIS = [
  // O gabarito da missão, nos três nomes que ele tem no catálogo.
  "correta",
  "desfecho",
  "prioritaria",
  // O texto que a criança escreveu para Amara. É o dado mais sensível daqui:
  // caixa livre de menor de idade. Não vai a log, não vai à telemetria, e
  // nenhuma rota de gestor o alcança.
  "texto",
  "passwordHash",
  "password_hash",
  "senhaHash",
  "senha_hash",
] as const;

/**
 * Termos que não podem aparecer em texto visível ao estudante — nem escritos
 * por nós, nem gerados pelo modelo.
 *
 * Dois grupos, com motivos diferentes:
 *
 * - **Quebra de ficção**: dentro do iframe quem fala é um app de conversa.
 *   "Atividade", "professor" e "experimento" na tela do grupo denunciam o
 *   exercício, e a experiência mede justamente o comportamento espontâneo.
 * - **Rótulo sobre a criança**: "você errou", "fake news", "ingênuo". A
 *   plataforma nunca rotula quem repassou o boato (PED-11, e a régua de copy do
 *   glossário). A consequência é diegética — o bairro entra em pânico —, não
 *   uma frase que julga.
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  "atividade",
  "professor",
  "professora",
  "gabarito",
  "experimento",
  "pesquisa",
  "dinamica pedagogica",
  "dinâmica pedagógica",
  "fake news",
  "voce errou",
  "você errou",
  "ingenuo",
  "ingênuo",
  "game over",
  "nota",
  "pontuacao",
  "pontuação",
  "ranking",
] as const;

/**
 * O que o painel do professor NÃO pode conter, por decisão pedagógica (PED-07).
 *
 * A visão dele é agregada e nominal-por-progresso, nunca nominal-por-acerto: a
 * tabela diz quem inspecionou a matéria e quem entregou o percurso, e não uma
 * coluna de pontos que ordene crianças.
 */
export const PROIBIDO_NO_PAINEL = ["score", "pontos", "nota", "estrelas", "posicao"] as const;

/**
 * Redige um texto que vai ao log. Nada de conteúdo de estudante: só o tamanho,
 * que é o que serve para diagnosticar um payload estranho.
 */
export function paraLog(texto: string): string {
  return `<${texto.length} caracteres>`;
}

/** Um texto gerado pelo modelo viola alguma invariante de tela? */
export function termosProibidosEm(texto: string): string[] {
  const alvo = texto.toLowerCase();
  return TERMOS_PROIBIDOS_NA_TELA.filter((t) => alvo.includes(t));
}

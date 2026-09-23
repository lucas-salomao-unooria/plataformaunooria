/**
 * Invariantes de produto verificáveis da exp06ef2b. Vivem em UM lugar só e são
 * importadas pela redaction do log, pelo painel e pelo teste. Alterar aqui
 * obriga a rodar a suíte da api.
 *
 * Molde: `apps/api/src/o-eco-no-grupo/invariantes.ts`.
 */

/** Campos que NUNCA cruzam a fronteira do cliente nem entram em log. */
export const CAMPOS_SENSIVEIS = [
  // O gabarito, nos nomes que ele tem no catálogo e nas regras.
  "desfecho",
  "reacao",
  "ordemCorreta",
  "alcance",
  // A reflexão que a criança escreveu. É o dado mais sensível daqui: caixa
  // livre de menor de idade. Não vai a log, não vai à telemetria e nenhuma
  // rota de gestor o alcança — só o professor da turma dela.
  "texto",
  "passwordHash",
  "password_hash",
  "senhaHash",
  "senha_hash",
] as const;

/**
 * Termos que não podem aparecer em texto visível ao estudante DENTRO do
 * disfarce. Dois grupos, com motivos diferentes:
 *
 * - **Quebra de ficção**: no iframe quem fala é um app de mensagens.
 *   "Atividade", "professor" e "experimento" na tela do grupo denunciam o
 *   exercício, e a missão mede comportamento espontâneo.
 * - **Rótulo sobre a criança**: "você errou", "fake news", "ingênuo". Quem
 *   encaminhou o boato não é rotulado (PED-11, e o guardrail 3.2 do PRD): a
 *   consequência é a curva no mapa, não uma frase que julga.
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  "atividade",
  "professor",
  "professora",
  "gabarito",
  "experimento",
  "pesquisa",
  "fake news",
  "voce errou",
  "você errou",
  "ingenuo",
  "ingênuo",
  "game over",
  // "nota" SOZINHA não entra, e a ausência é deliberada: "nota oficial" e "nota
  // da direção" são o vocabulário central desta missão — é o desmentido que o
  // estudante procura. Proibir a palavra faria a régua reprovar a própria copy
  // aprovada. O que se proíbe é a nota ESCOLAR, e ela vem sempre acompanhada.
  "sua nota",
  "nota final",
  "tirou nota",
  "pontuacao",
  "pontuação",
  "ranking",
] as const;

/**
 * O que o painel do professor NÃO pode conter (PED-07, e a lista de métricas
 * proibidas do handoff).
 *
 * A visão dele é agregada, e nominal apenas por PROGRESSO: quem auditou, quem
 * entregou o percurso. Nunca uma coluna de pontos que ordene crianças — a
 * missão não tem nota, e uma tabela ordenável a inventaria na leitura.
 */
export const PROIBIDO_NO_PAINEL = [
  "score",
  "nivel",
  "pontos",
  "nota",
  "estrelas",
  "posicao",
  "ranking",
] as const;

/**
 * Redige um texto que vai ao log. Nada de conteúdo de estudante: só o tamanho,
 * que é o que serve para diagnosticar um payload estranho.
 */
export function paraLog(texto: string): string {
  return `<${texto.length} caracteres>`;
}

/** Um texto visível ao estudante viola alguma invariante de tela? */
export function termosProibidosEm(texto: string): string[] {
  const alvo = texto.toLowerCase();
  return TERMOS_PROIBIDOS_NA_TELA.filter((t) => alvo.includes(t));
}

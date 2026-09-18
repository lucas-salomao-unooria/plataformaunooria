/**
 * Invariantes de produto verificáveis da exp-05. Vivem em UM lugar só e são
 * importadas pela redaction do log, pelo preparo e pelo teste. Alterar aqui
 * obriga a rodar a suíte da api.
 *
 * Molde: `apps/api/src/rastro-boato/invariantes.ts`.
 */

/** Campos que NUNCA cruzam a fronteira do cliente antes da revelação, nem entram em log. */
export const CAMPOS_SENSIVEIS = [
  // O gabarito, nos nomes que ele tem no catálogo. Os três só descem ao
  // estudante DEPOIS de a professora acender o telão — e só dentro de
  // `revelacao`, nunca no lote.
  "veracidade",
  "tom",
  "explicacao",
  // A reflexão que a criança escreveu ao dilema do tio. É o dado mais sensível
  // daqui: caixa livre de menor de idade. Não vai a log, não vai à telemetria,
  // e no painel só é preenchido para quem leciona a turma — gestor e admin
  // recebem `null` no lugar (`painel`, em `quem-mandou-isso.service.ts`).
  "texto",
  "passwordHash",
  "password_hash",
  "senhaHash",
  "senha_hash",
] as const;

/**
 * Termos que não podem aparecer no CONTEÚDO do grupo — o que a IA escreve e o
 * que a criança lê antes de decidir. Dois grupos, com motivos diferentes:
 *
 * - **Quebra de ficção**: no iframe quem fala é um app de mensagens.
 *   "Atividade", "experimento" e "gabarito" numa mensagem do grupo denunciam
 *   o exercício, e a missão mede comportamento espontâneo. **"Professor" NÃO
 *   entra**, e a ausência é deliberada — diferente da exp-06: aqui o grupo é o
 *   da TURMA, e mensagens de estudante sobre "os professores" ou de um "Prof."
 *   escrevendo no grupo são o WhatsApp real. Proibir a palavra faria a régua
 *   reprovar a própria copy homologada (a `msg-3` e a `msg-7` do banco).
 * - **Rótulo sobre a criança**: "você errou", "fake news", "ingênuo". Quem
 *   encaminhou o boato não é rotulado (PED-11): o selo diz o que a MENSAGEM é,
 *   nunca o que a criança fez.
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  "atividade",
  "gabarito",
  "experimento",
  "pesquisa",
  "fake news",
  "voce errou",
  "você errou",
  "ingenuo",
  "ingênuo",
  "propagador",
  "game over",
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
 * A visão dele é agregada, e nominal apenas por PROGRESSO: quem confirmou, quem
 * entregou a reflexão. Nunca uma coluna de pontos que ordene crianças — a
 * missão não tem nota, e uma tabela ordenável a inventaria na leitura. Aqui a
 * tentação é específica: com o gabarito à mão, "quantas falsas cada um
 * encaminhou" é a coluna natural de quem chegar depois, e ela é ranking de
 * quem caiu no boato. O que existe é o histograma da SALA, por mensagem.
 */
export const PROIBIDO_NO_PAINEL = [
  "score",
  "nivel",
  "pontos",
  "nota",
  "estrelas",
  "posicao",
  "ranking",
  "acerto",
  "taxa",
  "qtdFalsas",
  "falsasEncaminhadas",
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

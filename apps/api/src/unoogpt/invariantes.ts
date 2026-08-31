/**
 * Invariantes de produto verificaveis (15.4). Esta lista vive em UM lugar so e
 * e importada pelo sanitizador, pela redaction do log, pelo guardrail do prompt
 * e pelo teste. Alterar aqui obriga a rodar `npm test`.
 */

/** Campos que NUNCA cruzam a fronteira do cliente nem entram em log. */
export const CAMPOS_SENSIVEIS = [
  'lacuna',
  'passwordHash',
  'password_hash',
  'senhaHash',
  'senha_hash',
  'sessionVersion',
] as const;

/**
 * Termos que nao podem aparecer em texto visivel ao estudante. Nomear o mecanismo
 * muda o comportamento: quem sabe que esta sendo ensinado sobre vies procura o
 * vies em vez de decidir. A mesma constante alimenta o prompt (doc 04 §3).
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  'lacuna',
  'vies',
  'viés',
  'experimento',
  'pesquisa',
  'algoritmo',
  'dinamica pedagogica',
] as const;

/** Vocabulario permitido em mensagem de erro visivel (10.3). */
export const MENSAGENS_PERMITIDAS = [
  'Confira os campos do formulario.',
  'Sessao expirada. Entre de novo.',
  'Nao conseguimos abrir agora.',
  'Essa acao nao vale agora.',
  'Algo deu errado. Tente de novo.',
  'Muitas tentativas. Espere um pouco.',
  'Nao consegui simular agora. Tente de novo - isso nao gastou sua simulacao.',
] as const;

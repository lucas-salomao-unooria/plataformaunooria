/**
 * Invariantes de produto verificáveis da exp-08. Vivem em UM lugar só e são
 * importadas pela redaction, pelo painel e pelo teste. Alterar aqui obriga a
 * rodar a suíte da api.
 *
 * Molde: `apps/api/src/rastro-boato/invariantes.ts`.
 */

/**
 * Campos que NUNCA cruzam a fronteira do cliente nem entram em log.
 *
 * Note o que NÃO está aqui e por quê: esta missão **não tem gabarito**. As
 * quatro cláusulas são igualmente válidas sob governança de direitos, e a
 * tabela de métricas proibidas do handoff veda calcular acerto entre elas. O
 * que se protege é outra coisa — o texto que a criança escreveu e o material
 * de mediação do professor.
 */
export const CAMPOS_SENSIVEIS = [
  // O parágrafo autoral da Etapa 5. É o dado mais sensível daqui: caixa livre
  // de menor de idade. Não vai a log, não vai à telemetria analítica, e a
  // única rota que o devolve é a do professor DA TURMA dela (LGPD art. 14).
  "justificativaTexto",
  "justificativa_texto",
  // O argumento pronto de cada cláusula. Não é segredo de segurança: é que
  // mostrá-lo ao estudante antes de ele escrever transforma autoria em cópia.
  "justificativaSugerida",
  // A defesa da máquina antes de o estudante perguntar. Ver a réplica antes
  // do prompt desmonta a cena da auditoria.
  "replicaIa",
  "passwordHash",
  "password_hash",
  "senhaHash",
  "senha_hash",
] as const;

/**
 * Termos que não podem aparecer em texto visível ao estudante DENTRO do clone
 * do ChatGPT.
 *
 * Só o primeiro grupo é sobre disfarce, e ele é MENOR que o da exp-06 por um
 * motivo de desenho: aqui o estudante SABE que está numa aula. O clone é o
 * ambiente da tarefa (auditar um sistema escolar), não uma armadilha — não há
 * revelação a proteger. O que ainda quebraria a cena é o vocabulário de
 * ANDAIME pedagógico dentro da conversa: "atividade", "exercício" e "gabarito"
 * fazem a máquina falar como uma apostila, e a tese de neutralidade que ela
 * defende precisa soar corporativa para ser derrubada.
 *
 * O segundo grupo é ROTULAR A CRIANÇA, e este vale em toda a missão: nenhuma
 * cláusula é a certa, então "você errou" e "resposta correta" descrevem uma
 * regra que não existe. Ranking e pontuação entram junto (PED-07).
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  // "atividade" SOZINHA não entra, e a ausência é deliberada: "atividades em
  // redes sociais" é o vocabulário da cláusula de anonimização — o objeto que a
  // criança está protegendo do cruzamento de dados. Proibir a palavra faria a
  // régua reprovar a própria copy homologada, e foi EXATAMENTE o que ela fez
  // quando este teste rodou pela primeira vez. É o mesmo caso que a exp-06
  // registrou com "nota". O que se proíbe é a atividade ESCOLAR, e ela vem
  // sempre acompanhada.
  "esta atividade",
  "nesta atividade",
  "na atividade",
  "atividade proposta",
  "exercicio",
  "exercício",
  "gabarito",
  "apostila",
  "voce errou",
  "você errou",
  "resposta correta",
  "resposta errada",
  "ranking",
  "pontuacao",
  "pontuação",
  "sua nota",
  "nota final",
  "game over",
] as const;

/**
 * O que o painel do professor NÃO pode conter (PED-07 / D6b, e a lista de
 * métricas proibidas do handoff).
 *
 * A visão dele é nominal por PROGRESSO e por ESCOLHA — quem votou o quê, quem
 * já assinou. Nunca uma coluna de pontos: a missão não tem nota, e uma tabela
 * ordenável a inventaria na leitura. `acerto` e `taxa` entram porque nesta
 * missão a tentação é específica: com quatro cláusulas e uma "mais votada",
 * calcular percentual de acerto é o erro natural de quem chegar depois.
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

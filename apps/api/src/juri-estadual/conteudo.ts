/**
 * O ESQUELETO fixo da exp06ef1b — o que não é gerado pelo professor: as peças
 * da regra (EF06CO03) e as perguntas da plenária. Os quarenta estandes do
 * banco padrão moram em `banco-padrao.ts`.
 *
 * As perguntas são LITERAIS do Anexo (one-pager §9). As peças da regra são da
 * 0.6.0 (ADR-174, o Canal A puro), escritas aqui e levadas ao PO no card da
 * missão. O caso Mariana e os cinco cartões (a transferência do PRD v2 §10.1)
 * SAÍRAM na 0.7.0, a pedido do time que rodou a missão (ADR-176): a regra
 * conclui. As colunas `mecanismo`/`atitude` das sessões antigas ficam no banco.
 *
 * O que é GABARITO aqui (a peça certa) nunca desce: o estudante recebe as
 * peças embaralhadas pela sessão, com ids OPACOS, e quem confere é o servidor.
 */

// -------------------------------------------- EF06CO03: a regra SE … ENTÃO

/**
 * As peças da regra que o programa do feed executou: três para o SE (a
 * condição) e três para o ENTÃO (a ação), uma certa em cada. Montar a regra é
 * o "construir o programa que implementa a solução" do texto oficial da
 * EF06CO03 — a cadeia de quatro blocos da 0.5.0 só pedia para reconhecer a
 * ordem.
 *
 * As erradas são equívocos de verdade sobre recomendação, não absurdos: o
 * perfil popular, o "adivinhou pela foto", o mais curtido da turma, o rodízio
 * neutro. "Ficar muito tempo" NÃO é distrator de propósito: o motor PESA a
 * permanência (`PESO_DA_PERMANENCIA`), e seria uma peça meio certa.
 */
export const PECAS_DO_SE = [
  { id: "se-curtir", texto: "o jurado curtir 2 ou mais posts do mesmo tema", certa: true },
  { id: "se-seguidores", texto: "o jurado tiver muitos seguidores", certa: false },
  { id: "se-foto", texto: "a foto de perfil do jurado mostrar um tema", certa: false },
] as const;

export const PECAS_DO_ENTAO = [
  { id: "entao-tema", texto: "mostrar mais projetos desse tema nas próximas posições", certa: true },
  { id: "entao-turma", texto: "mostrar os projetos mais curtidos pela turma inteira", certa: false },
  { id: "entao-rodizio", texto: "mostrar um projeto de cada tema, em rodízio", certa: false },
] as const;

export type PecaDaRegra = { readonly id: string; readonly texto: string; readonly certa: boolean };

// --------------------------------------------- a plenária (guia do professor)

/** As quatro perguntas do debate mediado — verbatim do Anexo (one-pager §9). */
export const PERGUNTAS_DA_PLENARIA = [
  "Quando vocês abriram o aplicativo, vocês sentiram que estavam vendo a feira inteira ou apenas uma parte dela?",
  "Olhem para a projeção da sala: como é possível que parte da turma tenha votado em robôs e outra parte em projetos de meio ambiente, se estávamos todos no mesmo aplicativo da mesma mostra?",
  "O que as nossas primeiras curtidas disseram para o algoritmo? Foi o sistema que 'adivinhou' ou fomos nós que demos o mapa do que ele deveria repetir?",
  "Se isso aconteceu numa feira escolar simulada, o que vocês acham que acontece nas redes sociais de verdade quando a gente curte apenas um tipo de notícia, opinião ou vídeo de influenciador?",
] as const;

// ------------------------------------------------ o teto de palavras (RNF-USA-001)

/** Teto de palavras dos textos curtos da missão (RNF-USA-001); era o dos cartões do caso Mariana, que saiu. */
export const MAX_PALAVRAS_DO_CARTAO = 25;

/**
 * Textos LITERAIS aprovados que passam do teto — melhoria 5: entram aqui, por
 * chave da copy, e o teste de invariantes os aceita pelo nome. Texto gerado por
 * IA continua barrado pela régua (`invariantes.ts`); esta lista não vale para ele.
 */
export const EXCECOES_DE_TETO: Readonly<Record<string, { palavras: number; motivo: string }>> = {
  "e1.narrativa.corpo_cracha": { palavras: 36, motivo: "crachá literal da copy revisada (vive na experiência)" },
};

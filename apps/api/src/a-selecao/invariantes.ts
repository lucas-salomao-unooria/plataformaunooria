/**
 * Invariantes de produto verificáveis da exp07ef1b. Vivem em UM lugar só e são
 * importadas pelo preparo (que rejeita o lote de IA que as fere), pela
 * homologação e pelos testes. Alterar aqui obriga a rodar a suíte da api.
 *
 * Molde: o `quem-mandou-isso/invariantes.ts` da v1 da exp05ef1b (no histórico
 * do git desde a ADR-114).
 */

/**
 * Campos que NUNCA cruzam a fronteira do cliente antes de a professora acender
 * as fichas — e que não entram em log.
 */
export const CAMPOS_SENSIVEIS = [
  // O gabarito, nos nomes que ele tem no catálogo. Os três só descem ao
  // estudante na etapa `fichas`, e só dentro da ficha técnica do Mural.
  "enquadramento",
  "tagFonte",
  "tagAngulo",
  "autoridadeCitada",
  // A matriz é o gabarito somado: "2 institucionais e 1 estatístico" é a
  // ficha inteira em três números.
  "matriz",
  // A reflexão é caixa livre de menor de idade: só o professor da turma a lê
  // (o recorte da ADR-108 no painel), e ela não vai a log nem à telemetria.
  "texto",
  // O "por quê?" da marcação (ADR-170): a mesma caixa de menor, só do professor.
  "marcacaoPorque",
] as const;

/**
 * Termos que não podem aparecer no CONTEÚDO que a criança lê antes do Mural:
 * os posts do feed (legenda, comentários, descrição da imagem), os colegas
 * virtuais e as enquetes da DM. Três grupos, com motivos diferentes:
 *
 * - **O gap cognitivo** (critério 8 do brief de assets, reprovação sumária):
 *   "viés", "enquadramento", "manipulação", "lado da história", "fake news".
 *   A missão existe para a criança DESCOBRIR que escolher é enquadrar; um post
 *   que diga a palavra antes do Mural entrega a descoberta. Somam-se os que o
 *   prompt do preparo já proíbe ao gerador ("parcial", "positivo",
 *   "negativo"), para que a proibição tenha uma trava além da instrução.
 * - **A ficção**: "aluno" (o sheet troca por "estudante" ou "colega" em toda
 *   tela) e "gabarito". "Atividade" e "pesquisa" NÃO entram, e a ausência é
 *   deliberada — diferente da v1 da exp05ef1b: aqui o feed é de veículos de notícia
 *   cobrindo um polo cultural, e "atividades culturais" e "pesquisa de fluxo"
 *   (o `post_c_3` do banco curado) são o jornalismo real. Proibi-los faria a
 *   régua reprovar a própria copy homologada.
 * - **Rótulo sobre a criança** (8.4/8.5 do PRD): a plataforma rotula o objeto
 *   editorial, nunca quem escolheu — "você errou", "alienado", "ingênuo", e
 *   nada de nota ou ranking.
 *
 * A comparação é por PALAVRA INTEIRA, sem caixa e sem acento
 * (`termosProibidosEm`): "positivo" não pode reprovar "dispositivo", e
 * "manipulacao" sem til é a mesma palavra.
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  "viés",
  "enquadramento",
  "enquadramentos",
  "manipulação",
  "manipulado",
  "manipulada",
  "lado da história",
  "fake news",
  "notícia falsa",
  "parcial",
  "parcialidade",
  "positivo",
  "negativo",
  "aluno",
  "alunos",
  "gabarito",
  "você errou",
  "alienado",
  "alienada",
  "ingênuo",
  "ingênua",
  "sua nota",
  "nota final",
  "pontuação",
  "ranking",
  "game over",
] as const;

/**
 * O que o painel do professor NÃO pode conter (a lista de métricas proibidas
 * do PRD, §14: "proibido placares de pontuação").
 *
 * A visão dele é nominal só por PROGRESSO: quem publicou, quem entregou a
 * reflexão, com quem foi pareado. A matriz de cada tríade aparece porque é o
 * objeto editorial, não a criança — "2 institucionais" descreve os Stories, e
 * não ordena ninguém. O nível da EF07CO11 que a IA gradua NÃO está aqui: ele
 * mora no painel de habilidades (`/evidencias`), com a origem e o ajuste do
 * professor, e uma segunda cópia neste painel seria a coluna ordenável.
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
  "classificacao",
] as const;

/** Sem caixa, sem acento, espaços colapsados — a forma em que a régua compara. */
export function normalizarParaRegua(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const REGUAS = TERMOS_PROIBIDOS_NA_TELA.map((termo) => {
  const alvo = normalizarParaRegua(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { termo, re: new RegExp(`(^|[^a-z0-9])${alvo}($|[^a-z0-9])`) };
});

/** Um texto visível ao estudante fere alguma invariante de tela? Devolve os termos. */
export function termosProibidosEm(texto: string): string[] {
  const alvo = normalizarParaRegua(texto);
  return REGUAS.filter((r) => r.re.test(alvo)).map((r) => r.termo);
}

/**
 * Redige um texto que vai ao log. Nada de conteúdo de estudante: só o tamanho,
 * que é o que serve para diagnosticar um payload estranho.
 */
export function paraLog(texto: string): string {
  return `<${[...texto].length} caracteres>`;
}

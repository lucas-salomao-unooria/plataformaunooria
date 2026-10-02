/**
 * O vocabulário da exp06ef1b — O Júri Estadual de Projetos (6º ano EF,
 * unidade 1). Os valores fechados que o contrato, as regras, o conteúdo e os
 * CHECKs da migração repetem; aqui eles existem UMA vez.
 *
 * A experiência e o hub têm um espelho declarado destas listas (a experiência
 * não importa a api); o teste de cada lado compara o espelho com o que a api
 * devolve, porque uma segunda lista de valores é a que ninguém atualiza junto.
 */

export const EXP_ID = "exp06ef1b";

/**
 * As quatro ÁREAS da mostra. O nome de cada uma (Robótica, Meio Ambiente...)
 * vem do pacote que o professor gerou: o slug é fixo, o rótulo é da aula.
 */
export const AREAS = ["area_a", "area_b", "area_c", "area_d"] as const;
export type Area = (typeof AREAS)[number];

/** Quatro projetos por área: dezesseis estandes na mostra. */
export const PROJETOS_POR_AREA = 4;
export const TOTAL_DE_PROJETOS = AREAS.length * PROJETOS_POR_AREA;

/**
 * Os ids dos projetos são `proj-<letra da área><n>`. A letra diz a área — e a
 * área NÃO é gabarito: cada post leva a hashtag dela, à vista. O que não desce
 * antes da galeria é o ACERVO: o estudante só recebe os posts que o feed serviu.
 */
export const IDS_DE_PROJETO = AREAS.flatMap((area) =>
  Array.from({ length: PROJETOS_POR_AREA }, (_, i) => `proj-${area.slice(-1)}${i + 1}`),
) as readonly string[];
export const ID_DE_PROJETO_RE = /^proj-[a-d][1-4]$/;

export function areaDoProjeto(projetoId: string): Area {
  return `area_${projetoId.charAt(5)}` as Area;
}

/**
 * Cada projeto tem DOIS posts: a apresentação (o estande) e o bastidor (o
 * protótipo sendo testado). O bastidor existe para o feed afunilado fechar as
 * dez rolagens com a área líder (decisão de 2026-10-02: a invisibilidade é o
 * número REAL, e a área líder repete o projeto com outro post).
 *
 * O id do post é `<projeto>:<tipo>` — `proj-b2:bastidor`.
 */
export const TIPOS_DE_POST = ["apresentacao", "bastidor"] as const;
export type TipoDePost = (typeof TIPOS_DE_POST)[number];
export const ID_DE_POST_RE = /^proj-[a-d][1-4]:(apresentacao|bastidor)$/;

export function idDoPost(projetoId: string, tipo: TipoDePost): string {
  return `${projetoId}:${tipo}`;
}

export function projetoDoPost(postId: string): string {
  return postId.split(":")[0] ?? postId;
}

/**
 * O MOTOR do feed (`regras/afunilamento.ts`). Os números são do PRD e são
 * PARÂMETRO pedagógico: a regra que a Etapa 5 ensina ("SE curtir duas da mesma
 * área...") tem de ser a que o feed executou.
 *
 * - O feed tem DEZ posts; a cédula abre quando o décimo chega à tela.
 * - Os quatro primeiros são um de cada área (o estudante vê que existe
 *   variedade antes de a bolha fechar).
 * - Curtir vale 3; ficar mais de 5 s num post vale 1 (uma vez por post).
 *   Descurtir devolve os 3.
 * - Com 6 ou mais numa área, o resto do feed é só dela.
 */
export const POSTS_NO_FEED = 10;
export const POSTS_DE_ABERTURA = AREAS.length;
export const PESO_DA_CURTIDA = 3;
export const PESO_DA_PERMANENCIA = 1;
export const PERMANENCIA_MS = 5_000;
export const LIMIAR_DA_BOLHA = 6;

/**
 * A convicção declarada na cédula. As DUAS afirmam certeza, de propósito: é a
 * aposta comprometida que a galeria vai confrontar (o estudante não tem como
 * dizer "não vi tudo" antes de saber que não viu).
 */
export const CONVICCOES = ["examinei_bem", "vi_tudo"] as const;
export type Conviccao = (typeof CONVICCOES)[number];

/** A revisão do voto, depois da galeria: manter o voto ou trocar de projeto. */
export const ACOES_DA_REVISAO = ["manter", "trocar"] as const;
export type AcaoDaRevisao = (typeof ACOES_DA_REVISAO)[number];

/**
 * A busca da galeria. O TEXTO digitado pelo estudante nunca é gravado (é texto
 * livre de menor): fica só se foi por hashtag ou por texto, e a área que
 * casou — ou `null`, a busca vazia.
 */
export const TIPOS_DE_BUSCA = ["hashtag", "texto"] as const;
export type TipoDeBusca = (typeof TIPOS_DE_BUSCA)[number];

/** Origem do pacote: só `ia` — a missão não tem acervo padrão (decisão de 2026-10-02). */
export const ORIGENS_DO_PACOTE = ["ia"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];

/**
 * As disciplinas do preparo (a missão é transversal: qualquer professor
 * parametriza o recorte da mostra).
 */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "ciencias",
  "historia",
  "geografia",
  "matematica",
  "arte",
  "educacao-fisica",
  "lingua-inglesa",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/** A versão do instrumento gravada em cada sessão (reprocessamento posterior). */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";

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
 * Cada projeto tem QUATRO formatos de post: a apresentação (o estande), o
 * bastidor (o protótipo sendo testado), o protótipo de perto e o depoimento da
 * equipe. Os formatos existem para a SATURAÇÃO (melhoria 1 aprovada pelo dono,
 * 2026-10-10): depois que a área líder vence, os posts 5 a 10 vêm SÓ dela,
 * repetindo os projetos dela em formatos diferentes — e a mostra fica com 11 ou
 * 12 dos 16 estandes fora do feed (69–75%), o número REAL que a galeria mostra.
 *
 * O id do post é `<projeto>:<formato>` — `proj-b2:depoimento`.
 */
export const TIPOS_DE_POST = ["apresentacao", "bastidor", "prototipo", "depoimento"] as const;
export type TipoDePost = (typeof TIPOS_DE_POST)[number];
export const ID_DE_POST_RE = /^proj-[a-d][1-4]:(apresentacao|bastidor|prototipo|depoimento)$/;

export function idDoPost(projetoId: string, tipo: TipoDePost): string {
  return `${projetoId}:${tipo}`;
}

export function projetoDoPost(postId: string): string {
  return postId.split(":")[0] ?? postId;
}

export function tipoDoPost(postId: string): TipoDePost {
  const tipo = postId.split(":")[1];
  return (TIPOS_DE_POST as readonly string[]).includes(tipo ?? "") ? (tipo as TipoDePost) : "apresentacao";
}

/**
 * O MOTOR do feed (`regras/afunilamento.ts`). Os números são do PRD (§5.1,
 * §6.3) e são PARÂMETRO pedagógico: a regra que a Etapa 5 ensina ("SE curtir
 * duas da mesma área...") tem de ser a que o feed executou.
 *
 * - O feed tem DEZ posts, ou OITO MINUTOS contados pelo SERVIDOR desde a
 *   primeira rolagem (melhoria 9: recarregar não zera) — o que vier primeiro
 *   abre a cédula.
 * - Os quatro primeiros são um de cada área.
 * - Curtir vale 3; ficar mais de 5 s num post vale 1 (uma vez por post).
 *   Descurtir devolve o peso. SALVAR não pesa (melhoria 6): grava o evento e
 *   responde na tela, como comentar e compartilhar.
 * - Com 6 ou mais numa área, ela é a LÍDER e o resto do feed é só dela. Sem
 *   curtida nenhuma, a permanência sozinha elege a líder.
 */
export const POSTS_NO_FEED = 10;
export const POSTS_DE_ABERTURA = AREAS.length;
export const PESO_DA_CURTIDA = 3;
export const PESO_DA_PERMANENCIA = 1;
export const PERMANENCIA_MS = 5_000;
export const LIMIAR_DA_BOLHA = 6;
/** O teto de tempo do feed (RNF-USA-002), contado no servidor desde a 1ª rolagem. */
export const MINUTOS_NO_FEED = 8;
export const TETO_DO_FEED_MS = MINUTOS_NO_FEED * 60_000;

/**
 * A convicção declarada na cédula ("Sim" / "Com certeza"). As DUAS afirmam
 * certeza, de propósito: é a aposta comprometida que a galeria vai confrontar.
 */
export const CONVICCOES = ["examinei_bem", "vi_tudo"] as const;
export type Conviccao = (typeof CONVICCOES)[number];

/**
 * A revisão do voto, depois da galeria — dois botões (melhoria 6): "Manter meu
 * voto inicial" ou "Confirmar Voto Revisado". Manter só vale depois de abrir ao
 * menos UM estande oculto (`galeria-sem-inspecao`). O `complementar` da 0.3.0
 * saiu; a coluna e o valor no CHECK ficam para as sessões antigas.
 */
export const ACOES_DA_REVISAO = ["manter", "trocar"] as const;
export type AcaoDaRevisao = (typeof ACOES_DA_REVISAO)[number];

/**
 * A OCIOSIDADE da cédula (melhoria 8): com a cédula aberta, a tela manda um
 * batimento a cada 15 s dizendo há quantos segundos não há toque nela; o
 * servidor marca, e o painel do professor mostra o ícone ao lado do nome de
 * quem passou de 60 s. Sem batimento por 40 s (a cédula fechou, o voto foi),
 * a marca some sozinha.
 */
export const SEGUNDOS_PARA_OCIOSO = 60;
export const BATIMENTO_VALIDO_MS = 40_000;

/**
 * A busca da galeria. O TEXTO digitado pelo estudante nunca é gravado (é texto
 * livre de menor): fica só se foi por hashtag ou por texto, e a área que
 * casou — ou `null`, a busca vazia.
 */
export const TIPOS_DE_BUSCA = ["hashtag", "texto"] as const;
export type TipoDeBusca = (typeof TIPOS_DE_BUSCA)[number];

/**
 * Origem do pacote: `ia` (gerado e curado pelo professor) ou `padrao` — o BANCO
 * PADRÃO dos dezesseis projetos do PRD (`banco-padrao.ts`, 01e), o caminho curto
 * do professor ("Usar Banco Padrão Oficial") e o fallback quando falta cota de
 * IA (RF-007, §12.2). A decisão de 2026-10-02 ("sem acervo padrão") caiu com o
 * PRD v2.
 */
export const ORIGENS_DO_PACOTE = ["ia", "padrao"] as const;
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

/**
 * A versão do instrumento gravada em cada sessão (reprocessamento posterior).
 * 1.1.0 (2026-10-07): o ciclo do voto da 0.3.0. 2.0.0 (2026-10-10, PRD v2): o
 * salvar não pesa, saturação por formatos, teto de 8 min, revisão de dois
 * botões, sem justificativa nem rodada de desvio.
 */
export const VERSAO_DO_INSTRUMENTO = "2.0.0";

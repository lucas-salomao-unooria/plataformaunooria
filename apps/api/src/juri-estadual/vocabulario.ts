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

/**
 * DEZ projetos por área: quarenta estandes na mostra (aprovado pelo PO em
 * 2026-10-14; até a 0.4.x eram quatro por área, dezesseis). Com quarenta, o
 * feed de dez posts deixa 30 de fora para TODA criança — o total oculto vira
 * constante, e o que a galeria prova passa a ser O QUE sumiu: a contagem por
 * área e o contrafactual "sem as suas curtidas".
 */
export const PROJETOS_POR_AREA = 10;
export const TOTAL_DE_PROJETOS = AREAS.length * PROJETOS_POR_AREA;

/**
 * O pacote de DEZESSEIS (quatro por área) da 0.4.x. Continua LEGÍVEL — a turma
 * que tem um em andamento termina a aula com ele —, mas não se ESCREVE mais:
 * homologar, o preparo e o banco padrão exigem os quarenta.
 */
export const PROJETOS_POR_AREA_LEGADO = 4;
export const TOTAL_DE_PROJETOS_LEGADO = AREAS.length * PROJETOS_POR_AREA_LEGADO;
/** Os tamanhos de pacote que a LEITURA aceita (e o CHECK da migração repete). */
export const TOTAIS_DE_PROJETOS_LIDOS = [TOTAL_DE_PROJETOS_LEGADO, TOTAL_DE_PROJETOS] as const;

function idsComAte(porArea: number): readonly string[] {
  return AREAS.flatMap((area) => Array.from({ length: porArea }, (_, i) => `proj-${area.slice(-1)}${i + 1}`));
}

/**
 * Os ids dos projetos são `proj-<letra da área><n>`, com `n` de 1 a 10 — o
 * `proj-a10` vem DEPOIS do `proj-a9` (ordem numérica, nunca a de texto). A letra
 * diz a área — e a área NÃO é gabarito: cada post leva a hashtag dela, à vista.
 * O que não desce antes da galeria é o ACERVO: o estudante só recebe os posts
 * que o feed serviu.
 */
export const IDS_DE_PROJETO = idsComAte(PROJETOS_POR_AREA);
/** Os dezesseis ids do pacote legado (`proj-a1`…`proj-d4`), um subconjunto dos quarenta. */
export const IDS_DE_PROJETO_LEGADOS = idsComAte(PROJETOS_POR_AREA_LEGADO);
export const ID_DE_PROJETO_RE = /^proj-[a-d](10|[1-9])$/;

/** Os ids que um pacote com `total` projetos tem, na ordem do vocabulário — ou `null` para um total desconhecido. */
export function idsDoPacoteCom(total: number): readonly string[] | null {
  if (total === TOTAL_DE_PROJETOS) return IDS_DE_PROJETO;
  if (total === TOTAL_DE_PROJETOS_LEGADO) return IDS_DE_PROJETO_LEGADOS;
  return null;
}

export function areaDoProjeto(projetoId: string): Area {
  return `area_${projetoId.charAt(5)}` as Area;
}

/** O número do projeto dentro da área: `proj-a10` → 10. */
export function numeroDoProjeto(projetoId: string): number {
  return Number.parseInt(projetoId.slice(6), 10) || 0;
}

/** A ordem do vocabulário: área a área, e dentro dela a NUMÉRICA (`proj-a9` antes de `proj-a10`). */
export function compararIdsDeProjeto(x: string, y: string): number {
  return AREAS.indexOf(areaDoProjeto(x)) - AREAS.indexOf(areaDoProjeto(y)) || numeroDoProjeto(x) - numeroDoProjeto(y);
}

/**
 * O FORMATO do post. Desde a 0.5.0 (instrumento 3.0.0) o motor serve SÓ a
 * `apresentacao`, e nenhum post se repete: a área em foco recebe projetos NOVOS
 * dela, que agora tem dez. O `bastidor` continua como TEXTO do projeto (a
 * lâmina do carrossel do próprio post e o resumo da ficha técnica da galeria),
 * mas não é mais servido como post separado.
 *
 * Os outros três formatos (`bastidor`, `prototipo`, `depoimento`) são da
 * saturação da 0.4.x e ficam só para a LEITURA: as sessões 2.0.0 têm posts
 * deles no feed gravado, e a tela continua desenhando esses posts.
 *
 * O id do post é `<projeto>:<formato>` — `proj-b10:apresentacao`.
 */
export const TIPOS_DE_POST = ["apresentacao"] as const;
export type TipoServido = (typeof TIPOS_DE_POST)[number];
/** Os formatos da saturação da 0.4.x — só nas sessões 2.0.0. */
export const TIPOS_DE_POST_LEGADOS = ["bastidor", "prototipo", "depoimento"] as const;
/** Todo formato que a leitura aceita: o servido hoje e os legados. */
export const TIPOS_DE_POST_LIDOS = [...TIPOS_DE_POST, ...TIPOS_DE_POST_LEGADOS] as const;
export type TipoDePost = (typeof TIPOS_DE_POST_LIDOS)[number];
export const ID_DE_POST_RE = /^proj-[a-d](10|[1-9]):(apresentacao|bastidor|prototipo|depoimento)$/;

export function idDoPost(projetoId: string, tipo: TipoDePost): string {
  return `${projetoId}:${tipo}`;
}

export function projetoDoPost(postId: string): string {
  return postId.split(":")[0] ?? postId;
}

export function tipoDoPost(postId: string): TipoDePost {
  const tipo = postId.split(":")[1];
  return (TIPOS_DE_POST_LIDOS as readonly string[]).includes(tipo ?? "") ? (tipo as TipoDePost) : "apresentacao";
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
 * - Com 6 ou mais numa área, ela é a LÍDER e o resto do feed é só dela —
 *   projetos NOVOS dela, sem repetir post. Sem curtida nenhuma, a permanência
 *   sozinha elege a líder.
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
 * PADRÃO dos quarenta projetos (`banco-padrao.ts`: os dezesseis do 01e e mais
 * vinte e quatro no mesmo molde), o caminho curto
 * do professor ("Usar Banco Padrão Oficial") e o fallback quando falta cota de
 * IA (RF-007, §12.2). A decisão de 2026-10-02 ("sem acervo padrão") caiu com o
 * PRD v2.
 */
export const ORIGENS_DO_PACOTE = ["ia", "padrao"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];

/**
 * As disciplinas do preparo (a missão é transversal: qualquer professor
 * parametriza o recorte da mostra). Cobre TODO o 6º ano da matriz da
 * plataforma (`curriculo/componentes.ts#componentesDoAno("6EF")`, na ordem do
 * catálogo), mais Computação (o complemento de 2022 à BNCC) e o projeto
 * interdisciplinar no fim — migração
 * `20261026230000_componentes_bncc_nas_missoes`. Só se ACRESCENTA: há linhas
 * gravadas com cada valor, e um CHECK mais estreito quebraria a migração.
 * `tests/juri-estadual-regras.spec.ts` confere a lista contra o catálogo.
 */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "arte",
  "educacao-fisica",
  "lingua-inglesa",
  "matematica",
  "ciencias",
  "geografia",
  "historia",
  "ensino-religioso",
  "computacao",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/**
 * A versão do instrumento gravada em cada sessão (reprocessamento posterior).
 * 1.1.0 (2026-10-07): o ciclo do voto da 0.3.0. 2.0.0 (2026-10-10, PRD v2): o
 * salvar não pesa, saturação por formatos, teto de 8 min, revisão de dois
 * botões, sem justificativa nem rodada de desvio. 3.0.0 (2026-10-14): quarenta
 * projetos, só o formato `apresentacao`, nenhum post repetido; a galeria conta
 * por área e mostra o contrafactual sem curtidas. 4.0.0 (2026-10-18, ADR-174):
 * o Canal A puro — a separação depois do voto (EF06CO01) e a regra SE … ENTÃO
 * no lugar da cadeia (EF06CO03); sem enquetes, e a galeria não marca nada.
 * 5.0.0 (2026-10-20, ADR-176): a separação vira as PASTAS do salvar no feed
 * (corrigida no voto), o caso Mariana sai (a regra conclui) e a galeria deixa
 * de mostrar a contagem por área e o contrafactual.
 */
export const VERSAO_DO_INSTRUMENTO = "5.0.0";

import type {
  Area,
  Categoria,
  Etapa,
  Gate,
  Passo,
  PostPublico,
  ProjetoDaGaleria,
  Sessao,
  TipoDeBusca,
  VistosPorArea,
} from "./tipos";
import { AREAS } from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que VALE (o motor do feed, a contagem dos ocultos e o
 * contrafactual "sem as suas curtidas", a
 * área de cada estande da separação, a peça certa da regra, o cartão certo,
 * o relógio da turma) mora no servidor, em `apps/api/src/juri-estadual/`. O que
 * sobra aqui é o que a tela decide sozinha, sem ida à api: qual tela o passo
 * pede, quais estandes entram na cédula, o que a busca da galeria mostra, se a
 * separação está completa — e o que o servidor não tem como saber (o tempo de
 * um post na tela).
 *
 * Quando uma regra daqui ESPELHA uma do servidor (`passoEfetivo`), ela é cópia
 * declarada, e o teste compara as duas.
 */

// ──────────────────────────────────────────────────────────── os relógios

/** De quanto em quanto a espera pergunta se a professora liberou a galeria. */
export const INTERVALO_DO_GATE_MS = 3_000;

/** Sem toque com a cédula ABERTA: o aviso da comissão no topo dela (`e3.erro.toast_inatividade`). */
export const SEGUNDOS_DE_INATIVIDADE = 60;

/**
 * O batimento da cédula aberta (`POST cedula/batimento`, melhoria 8): a cada
 * 15 s, há quantos segundos não há toque nela. O servidor marca o ocioso para
 * o painel do professor (> 60 s), e a marca some sozinha sem batimento.
 */
export const SEGUNDOS_DO_BATIMENTO = 15;

/**
 * Quanto esperar até reler o feed por TEMPO (os 8 minutos são do servidor).
 * O relógio do aparelho pode estar adiantado ou atrasado: a resposta do
 * servidor manda, e quem chega cedo demais só agenda de novo.
 */
export function esperaAteEncerrar(encerraEm: string | null, agora: number): number | null {
  if (!encerraEm) return null;
  const fim = Date.parse(encerraEm);
  if (Number.isNaN(fim)) return null;
  return Math.max(1_000, fim - agora + 1_000);
}

/**
 * A permanência que conta, espelho de `vocabulario.ts#PERMANENCIA_MS`: mais de
 * 5 s com ≥ 60% do post na tela, uma vez por post. Quem soma o peso é o servidor.
 */
export const PERMANENCIA_MS = 5_000;
export const FRACAO_VISIVEL = 0.6;

/** Espera entre as tentativas de uma chamada que caiu na rede. */
export function esperaDaTentativa(tentativa: number): number {
  const passos = [2_000, 4_000, 8_000];
  return passos[tentativa] ?? 15_000;
}

// ──────────────────────────────────────────── o passo e a tela que ele pede

const ORDEM: Record<Passo, number> = {
  credencial: 0,
  feed: 1,
  classificacao: 2,
  lacrada: 3,
  galeria: 4,
  revisada: 5,
  cadeia: 6,
  mariana: 7,
  enquetes: 8,
  fim: 9,
};

/**
 * Espelho de `passoEfetivo` da api (`regras/passos.ts`). A api já devolve o
 * passo reconciliado em toda resposta — este espelho existe para o TESTE provar
 * que a tela e o servidor chegam à mesma resposta num F5.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  if (passo === "lacrada" || passo === "galeria") return etapa === "exploracao" ? "lacrada" : "galeria";
  return passo;
}

export function passoNoMinimo(passo: Passo, piso: Passo): boolean {
  return ORDEM[passo] >= ORDEM[piso];
}

/**
 * As telas da missão. `lacrada` é a ESPERA (E3-ALU-02: o carimbo e o latch).
 * `revisada` é a passagem para a regra: a tela pede `POST passo
 * {para:"cadeia"}` sozinha (o "avançar" do PRD, §6.3), e num F5 também. O
 * passo `cadeia` é a tela da REGRA desde a 0.6.0, e ela conclui desde a 0.7.0
 * (ADR-176). Três passagens só de sessão ANTIGA: `classificacao` (a separação
 * da 0.6.0, que saiu — a tela pede `POST passo {para:"lacrada"}` sozinha), e
 * `mariana` e `enquetes` (a tela pede `POST concluir` sozinha).
 */
export type Tela =
  | "credencial"
  | "feed"
  | "saindoDaSeparacao"
  | "espera"
  | "galeria"
  | "avancando"
  | "regra"
  | "concluindo"
  | "fim";

export const TELA_DO_PASSO: Record<Passo, Tela> = {
  credencial: "credencial",
  feed: "feed",
  classificacao: "saindoDaSeparacao",
  lacrada: "espera",
  galeria: "galeria",
  revisada: "avancando",
  cadeia: "regra",
  mariana: "concluindo",
  enquetes: "concluindo",
  fim: "fim",
};

/**
 * Quem FALA em cada tela — e, por isso, em que seção do DS o aviso de rede
 * sai. PRD §10.1: a regra (E5) é a Unooria. As pastas são da comissão: estão
 * no feed, com o disfarce de pé.
 */
export function vozDaTela(tela: Tela): "clone" | "escola" {
  return tela === "regra" ? "escola" : "clone";
}

/**
 * O gate mudou alguma coisa que a tela mostra? Então ela relê a sessão.
 * `etapa` é a professora liberando a galeria; `rodada` e `pacoteId` são o
 * "Zerar" e a atividade nova — a sessão passa a ser OUTRA.
 */
export function gateMudou(sessao: Pick<Sessao, "etapa" | "rodada" | "pacoteId">, gate: Gate): boolean {
  return gate.etapa !== sessao.etapa || gate.rodada !== sessao.rodada || gate.pacoteId !== sessao.pacoteId;
}

// ─────────────────────────────────────────────── o feed e a cédula

/** O nome da conta como o app escreve sobre o post: sem o `@`. */
export function nomeDaConta(perfil: string): string {
  return perfil.replace(/^@/, "");
}

/** Duas letras para o avatar (o DS desenha a inicial quando não há foto). */
export function iniciais(texto: string): string {
  const letras = texto.replace(/^@/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/);
  const duas = letras.length > 1 ? `${letras[0]?.[0] ?? ""}${letras[1]?.[0] ?? ""}` : (letras[0] ?? "").slice(0, 2);
  return duas.toUpperCase();
}

/** Um estande que passou pelo feed — o que a cédula oferece. */
export interface EstandeDoFeed {
  projetoId: string;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  imagem: PostPublico["imagem"];
}

/**
 * Os estandes que APARECERAM no feed, na ordem em que apareceram e sem
 * repetição (desde a 0.5.0 o motor não repete post; o feed gravado de uma
 * sessão 2.0.0 ainda repete o projeto em outros formatos). É a lista da cédula:
 * a api recusa voto fora dela (`projeto-fora-do-feed`), e a cédula não pode
 * oferecer o que o feed não serviu.
 */
export function estandesDoFeed(posts: readonly PostPublico[]): EstandeDoFeed[] {
  const vistos = new Map<string, EstandeDoFeed>();
  for (const p of posts) {
    if (vistos.has(p.projetoId)) continue;
    vistos.set(p.projetoId, {
      projetoId: p.projetoId,
      area: p.area,
      titulo: p.titulo,
      escola: p.escola,
      perfil: p.perfil,
      imagem: p.imagem,
    });
  }
  return [...vistos.values()];
}

/**
 * O que a tela mostra marcado (curtidas ou salvos): o que o servidor devolveu,
 * com o que ainda está na fila. A curtida e o salvo são ESTADO, e o servidor
 * devolve a lista inteira a cada ida.
 */
export function curtidosNaTela(doServidor: readonly string[], pendentes: ReadonlyMap<string, boolean>): Set<string> {
  const saida = new Set(doServidor);
  for (const [postId, curtiu] of pendentes) {
    if (curtiu) saida.add(postId);
    else saida.delete(postId);
  }
  return saida;
}

/** Um número de protocolo estável para o lacre (só ficção: a api não o guarda). */
export function protocoloDoVoto(pacoteId: string, rodada: number, projetoId: string): string {
  let h = 2166136261;
  for (const c of `${pacoteId}:${rodada}:${projetoId}`) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return `PR-${String((h >>> 0) % 9000 + 1000)}`;
}

// ───────────────────────────────────── o carrossel do post: fotos e bastidor

/** As fotos do carrossel: a capa do estande e as fotos técnicas 2 e 3 (`e2.instrucao.carrossel_contador`). */
export const FOTOS_DO_POST = 3;

/**
 * Quantas lâminas o carrossel de um post tem: as três fotos e, quando o estande
 * tem bastidor, a lâmina de TEXTO dele no fim (o protótipo em teste). O
 * bastidor deixou de ser um post separado na 0.5.0 e virou parte do post.
 */
export function laminasDoPost(post: Pick<PostPublico, "bastidor">): number {
  return FOTOS_DO_POST + (temBastidor(post) ? 1 : 0);
}

/** O post tem a lâmina do bastidor? (Texto vazio não vira lâmina.) */
export function temBastidor(post: Pick<PostPublico, "bastidor">): boolean {
  return typeof post.bastidor === "string" && post.bastidor.trim() !== "";
}

// ─────────────────────────────────────────── a galeria: por área e o contraste

/**
 * A área que a grade dos ocultos mostra ao abrir: a que MAIS ficou fora do
 * feed (empate: a ordem das áreas). Com quarenta estandes são ~30 ocultos —
 * soltos num 375 px, a grade vira um mural sem fim; por área, cabem.
 */
export function areaComMaisOcultos(porArea: readonly VistosPorArea[]): Area | null {
  let melhor: VistosPorArea | null = null;
  for (const a of porArea) if (!melhor || a.total - a.vistos > melhor.total - melhor.vistos) melhor = a;
  return melhor?.area ?? null;
}

/** Os estandes OCULTOS de uma área, na ordem da galeria. */
export function ocultosDaArea(projetos: readonly ProjetoDaGaleria[], area: Area): ProjetoDaGaleria[] {
  return projetos.filter((p) => p.area === area && !p.exibidoNoSeuFeed);
}

/** As opções da troca do voto numa área: todos os estandes dela, menos o votado. */
export function opcoesDaTroca(
  projetos: readonly ProjetoDaGaleria[],
  area: Area,
  votoId: string | null,
): ProjetoDaGaleria[] {
  return projetos.filter((p) => p.area === area && p.id !== votoId);
}

// ─────────────────────────────────────────────── a busca da galeria

/** Caixa baixa, sem acento, sem `#` e sem espaço sobrando. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** O estande casa com o texto buscado? Título, escola, perfil, legenda, hashtag ou nome da área. */
export function casaComABusca(projeto: ProjetoDaGaleria, texto: string, categorias: readonly Categoria[]): boolean {
  const alvo = normalizar(texto);
  if (!alvo) return true;
  const area = categorias.find((c) => c.area === projeto.area);
  const campos = [projeto.titulo, projeto.escola, projeto.perfil, projeto.legenda, projeto.resumo, ...projeto.hashtags, area?.nome ?? "", area?.hashtag ?? ""];
  return campos.some((c) => normalizar(c).includes(alvo));
}

/**
 * O que a busca é, para a api — o TIPO e a área que casou, NUNCA o texto
 * (texto livre de menor não sai do aparelho; `AcaoDaGaleriaSchema`).
 *
 * - `hashtag`: o texto é a hashtag (ou o nome) de uma área — ou foi o chip.
 * - `texto`: qualquer outra coisa. A área é a dos resultados quando todos são
 *   da mesma; com resultados de áreas diferentes, ou nenhum, `null`.
 *
 * Texto vazio não é busca: `null`.
 */
export function classificarBusca(
  texto: string,
  categorias: readonly Categoria[],
  projetos: readonly ProjetoDaGaleria[],
): { busca: TipoDeBusca; area: Area | null } | null {
  const alvo = normalizar(texto);
  if (!alvo) return null;
  const daArea = categorias.find((c) => normalizar(c.hashtag) === alvo || normalizar(c.nome) === alvo);
  if (daArea) return { busca: "hashtag", area: daArea.area };
  const areas = new Set(projetos.filter((p) => casaComABusca(p, texto, categorias)).map((p) => p.area));
  const [unica] = [...areas];
  return { busca: "texto", area: areas.size === 1 && unica ? unica : null };
}

/** A hashtag como o chip a escreve: com `#`, uma vez só. */
export function comCerquilha(hashtag: string): string {
  return `#${hashtag.replace(/^#+/, "")}`;
}

// ──────────────────────────────────────── as pastas do salvar (ADR-176)

/** Um salvamento ainda na fila: salvou (com a pasta) ou tirou dos salvos. */
export type SalvamentoPendente = { salvou: boolean; pasta?: Area };

/**
 * As pastas que a tela mostra: as do servidor, com o que ainda está na fila
 * por cima — a pasta é estado, como a curtida, e o servidor devolve o mapa
 * inteiro a cada ida.
 */
export function pastasNaTela(
  doServidor: Partial<Record<string, Area>>,
  pendentes: ReadonlyMap<string, SalvamentoPendente>,
): Partial<Record<string, Area>> {
  const saida: Partial<Record<string, Area>> = { ...doServidor };
  for (const [postId, s] of pendentes) {
    if (!s.salvou) delete saida[postId];
    else if (s.pasta) saida[postId] = s.pasta;
  }
  return saida;
}

/**
 * Quantos estandes vistos ainda não estão em pasta nenhuma, contado na TELA
 * (com a fila por cima): a cédula não espera a ida ao servidor para destravar.
 * Quem decide no voto continua sendo a api (`semPasta`, 409 `estandes-sem-pasta`).
 */
export function semPastaNaTela(
  posts: readonly Pick<PostPublico, "id" | "projetoId">[],
  pastas: Partial<Record<string, Area>>,
): number {
  const projetos = new Set(posts.map((p) => p.projetoId));
  const guardados = new Set(posts.filter((p) => pastas[p.id]).map((p) => p.projetoId));
  return projetos.size - guardados.size;
}

/** Quantos estandes cada pasta guarda — a aba Jurado. Um estande conta uma vez, na pasta do último post dele. */
export function estandesPorPasta(
  posts: readonly Pick<PostPublico, "id" | "projetoId">[],
  pastas: Partial<Record<string, Area>>,
): Record<Area, number> {
  const doProjeto = new Map<string, Area>();
  for (const p of posts) {
    const pasta = pastas[p.id];
    if (pasta) doProjeto.set(p.projetoId, pasta);
  }
  const contagem = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const pasta of doProjeto.values()) contagem[pasta] += 1;
  return contagem;
}

// ─────────────────────────────────────────────── o gesto na mídia do post

/** Arrasto horizontal mínimo para trocar de lâmina (e máximo de deriva vertical). */
export const DESLIZE_PX = 40;
/** Até onde o ponteiro pode andar e ainda ser um TOQUE (o toque duplo curte). */
export const TOQUE_PX = 10;

export type Gesto = "proxima" | "anterior" | "toque" | "nada";

/**
 * O que um gesto na mídia quis dizer, pelo deslocamento entre o `pointerdown`
 * e o `pointerup` — o mesmo para o dedo e para o MOUSE. Arrastar para a
 * esquerda mostra a próxima lâmina (como no app real); andar pouco é toque;
 * o resto (rolagem vertical, arrasto torto) não é nada.
 */
export function lerGesto(dx: number, dy: number): Gesto {
  if (Math.abs(dx) >= DESLIZE_PX && Math.abs(dy) < DESLIZE_PX) return dx < 0 ? "proxima" : "anterior";
  if (Math.abs(dx) <= TOQUE_PX && Math.abs(dy) <= TOQUE_PX) return "toque";
  return "nada";
}

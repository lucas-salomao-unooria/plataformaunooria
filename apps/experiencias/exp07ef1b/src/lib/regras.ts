import type { Estado, Etapa, Passo, RespostaGate } from "./tipos";

/**
 * As poucas regras que são do CLIENTE — e por que são tão poucas.
 *
 * Tudo o que decide o que VALE (o latch da publicação, a matriz da tríade, o
 * pareamento, o relógio da turma, o nível das ações) mora no servidor, em
 * `apps/api/src/a-selecao/regras/`. O que sobra aqui é o que a tela precisa
 * decidir sozinha, sem ida à api: qual tela o passo pede, se o botão de
 * publicar pode acender, quanto falta na reflexão, para onde vai o toque no
 * Story — e o que o servidor não tem como saber (o tempo desta tela aberta).
 *
 * Quando uma regra daqui ESPELHA uma do servidor (a contagem por code points,
 * `passoEfetivo`), ela é cópia declarada, e o teste compara as duas.
 */

// ──────────────────────────────────────────────────────────── os relógios

/** De quanto em quanto a tela pergunta em que etapa a turma está (ADR-93). */
export const INTERVALO_DO_GATE_MS = 5_000;

/** Ocioso na entrada do feed: a demonstração do gesto de rolar ([D0-2]). */
export const SEGUNDOS_ATE_A_DEMONSTRACAO = 10;

/** Três minutos no feed sem salvar nada: a dica do marcador (caminho degenerado 1). */
export const SEGUNDOS_ATE_A_DICA = 180;

/** A trava de leitura de cada card da Etapa 5. */
export const SEGUNDOS_POR_CARD = 8;

/** Quantos cards conceituais a Etapa 5 tem. */
export const TOTAL_DE_CARDS = 3;

/** O teto do tempo de feed que a api aceita (`TEMPO_DE_FEED_MAX_S`). */
export const TEMPO_DE_FEED_MAX_S = 3600;

/** Com quantos posts salvos a pílula "Ir para aba Salvos" aparece. */
export const SALVOS_PARA_A_PILULA = 3;

// ──────────────────────────────────────────── o passo e a tela que ele pede

/**
 * Espelho de `passoEfetivo` da api (`regras/passos.ts`): o passo que a tela
 * mostra, dado o gravado e a etapa da turma. A api já devolve o passo
 * reconciliado em toda resposta — este espelho existe para o TESTE provar que
 * a tela e o servidor chegam à mesma resposta num F5, e para a leitura do
 * código dizer em voz alta a regra que manda na tela.
 */
const ORDEM: Record<Passo, number> = {
  desafio: 0,
  feed: 1,
  salvos: 2,
  publicado: 3,
  mural: 4,
  marcacao: 5,
  fichas: 6,
  explicacao: 7,
  reflexao: 8,
  enquetes: 9,
  fim: 10,
};
const PASSO_DA_ETAPA: Record<Etapa, Passo> = {
  exploracao: "publicado",
  mural: "mural",
  marcacao: "marcacao",
  fichas: "fichas",
  explicacao: "explicacao",
};

const ORDEM_DA_ETAPA: Record<Etapa, number> = { exploracao: 0, mural: 1, marcacao: 2, fichas: 3, explicacao: 4 };

/** A etapa `a` vem antes de `b` no relógio da turma? */
export function etapaAntes(a: Etapa, b: Etapa): boolean {
  return ORDEM_DA_ETAPA[a] < ORDEM_DA_ETAPA[b];
}

export function publicou(passo: Passo): boolean {
  return ORDEM[passo] >= ORDEM.publicado;
}

export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  if (!publicou(passo)) return passo;
  if (ORDEM[passo] >= ORDEM.reflexao) return passo;
  return PASSO_DA_ETAPA[etapa];
}

/**
 * As telas da missão. O Mural é UMA tela nos dois passos (`mural` e
 * `fichas`): a revelação é a gaveta que acende sobre o Story que a criança já
 * está olhando, não uma troca de tela — trocar de tela no instante da
 * revelação faria ela perder o post em que estava.
 *
 * A MARCAÇÃO (ADR-170) é tela própria, depois de um botão da professora: o
 * Mural continua nu (o não-negociável 2), e a pergunta só aparece quando a
 * conversa da sala já aconteceu. O passo `enquetes` é do Canal B, que saiu:
 * a sessão antiga parada nele vai para o fim.
 */
export type Tela =
  | "desafio"
  | "feed"
  | "salvos"
  | "espera"
  | "mural"
  | "marcacao"
  | "explicacao"
  | "reflexao"
  | "fim";

export function telaDoPasso(passo: Passo): Tela {
  switch (passo) {
    case "desafio":
      return "desafio";
    case "feed":
      return "feed";
    case "salvos":
      return "salvos";
    case "publicado":
      return "espera";
    case "mural":
    case "fichas":
      return "mural";
    case "marcacao":
      return "marcacao";
    case "explicacao":
      return "explicacao";
    case "reflexao":
      return "reflexao";
    case "enquetes":
    case "fim":
      return "fim";
  }
}

/** A tela deste passo lê o Mural (`GET /a-selecao/mural`)? */
export function precisaDoMural(passo: Passo): boolean {
  return passo === "mural" || passo === "marcacao" || passo === "fichas";
}

/**
 * O gate mudou alguma coisa que a tela mostra? Então ela relê a sessão.
 *
 * Quatro comparações, e nenhuma é redundante: `passoEfetivo` é a professora
 * abrindo o Mural; `etapa` é a revelação das fichas chegando a quem já está
 * no Mural (o passo efetivo muda junto, mas a comparação explícita não depende
 * disso); `rodada` e `coberturaId` são o "Zerar" e o tema novo — a sessão
 * passa a ser OUTRA, e continuar na tela velha faria a criança publicar numa
 * rodada que já acabou.
 */
export function gateMudou(estado: Estado, gate: RespostaGate): boolean {
  return (
    gate.passoEfetivo !== estado.passo ||
    gate.etapa !== estado.etapa ||
    (gate.rodada !== null && gate.rodada !== estado.rodada) ||
    (gate.coberturaId !== null && gate.coberturaId !== estado.coberturaId)
  );
}

// ─────────────────────────────────────────── a contagem (code points, como a api)

/**
 * Quantos caracteres o SERVIDOR conta. `"😀".length` é 2 em JavaScript e 1 no
 * Postgres; a api conta code points dos dois lados (`regras/sessao.ts`), e a
 * tela conta igual — senão um emoji no limite acenderia o botão para um texto
 * que a api recusa.
 */
export function codePoints(texto: string): number {
  return [...texto].length;
}

/** A legenda como a api a GRAVA: sem quebra de linha e sem espaço sobrando. */
export function normalizarLegenda(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** A reflexão como a api a grava: só sem as pontas — parágrafo é da criança. */
export function normalizarReflexao(texto: string): string {
  return texto.trim();
}

/** A legenda passa na régua da api? (10 a 140 code points, já normalizada.) */
export function legendaValida(texto: string, min: number, max: number): boolean {
  const n = codePoints(normalizarLegenda(texto));
  return n >= min && n <= max;
}

/**
 * O aviso de legenda curta só aparece DEPOIS que a criança começou a
 * escrever: acender "escreva ao menos 10 caracteres" num campo vazio, antes de
 * ela escolher os posts, é bronca por uma coisa que ela ainda nem tentou.
 */
export function legendaCurta(texto: string, min: number): boolean {
  const n = codePoints(normalizarLegenda(texto));
  return n > 0 && n < min;
}

/** Quantos caracteres faltam para a reflexão chegar ao mínimo (0 = pode enviar). */
export function faltamNaReflexao(texto: string, min: number): number {
  return Math.max(0, min - codePoints(normalizarReflexao(texto)));
}

export function reflexaoValida(texto: string, min: number, max: number): boolean {
  const n = codePoints(normalizarReflexao(texto));
  return n >= min && n <= max;
}

// ──────────────────────────────────────────────────── a poda na aba Salvos

export type SituacaoDaSelecao =
  | { tipo: "pronta" }
  | { tipo: "insuficiente"; faltam: number }
  | { tipo: "excesso"; excesso: number };

/**
 * Exatamente três. Menos trava a publicação com o aviso operacional; mais
 * trava com o aviso de atrito editorial ("Remova N posts") — a poda é a
 * decisão que a missão mede, e ela tem de ser da criança.
 */
export function situacaoDaSelecao(selecionados: number, tamanho: number): SituacaoDaSelecao {
  if (selecionados === tamanho) return { tipo: "pronta" };
  if (selecionados < tamanho) return { tipo: "insuficiente", faltam: tamanho - selecionados };
  return { tipo: "excesso", excesso: selecionados - tamanho };
}

/**
 * A seleção da aba Salvos, DERIVADA: todo post salvo entra selecionado, menos
 * os que a criança desmarcou ali. Guardar duas listas independentes faria um
 * post salvo de novo no feed voltar desmarcado sem ninguém ter pedido — e a
 * ordem é a do salvamento, que é a que numera os círculos da grade.
 */
export function selecionados(salvos: readonly string[], desmarcados: ReadonlySet<string>): string[] {
  return salvos.filter((id) => !desmarcados.has(id));
}

/** Liga ou desliga um id numa lista ordenada, preservando a ordem dos demais. */
export function alternar(lista: readonly string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
}

/**
 * Os ids salvos que ainda valem nesta cobertura. Os salvos do F5 vêm do
 * `sessionStorage`, e uma aba velha pode trazer ids de um tema que a
 * professora já trocou — publicá-los daria 400 `selecao-invalida`.
 */
export function salvosValidos(salvos: readonly unknown[], idsDaCobertura: ReadonlySet<string>): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const id of salvos) {
    if (typeof id !== "string" || !idsDaCobertura.has(id) || vistos.has(id)) continue;
    vistos.add(id);
    saida.push(id);
  }
  return saida;
}

// ──────────────────────────────────────────────────────── o feed e as dicas

export type DicaDoFeed = "inatividade" | null;

/**
 * A dica do feed, e o silêncio antes dela. SOME no primeiro salvamento: é
 * sobre o gesto (onde fica o marcador), nunca sobre QUAL post salvar — uma
 * dica de conteúdo entregaria a curadoria que a missão mede. A segunda dica, a
 * das cinco curtidas sem salvar, saiu com o botão de curtir (ADR-146).
 */
export function dicaDoFeed(salvos: number, segundosNoFeed: number): DicaDoFeed {
  if (salvos > 0) return null;
  if (segundosNoFeed >= SEGUNDOS_ATE_A_DICA) return "inatividade";
  return null;
}

/** Segundos decorridos, sem negativo e sem passar do teto que a api aceita. */
export function segundosDesde(inicioMs: number, agoraMs: number): number {
  return Math.min(TEMPO_DE_FEED_MAX_S, Math.max(0, Math.floor((agoraMs - inicioMs) / 1000)));
}

/**
 * O tema dentro da frase do placeholder: "…informam melhor a escola sobre a
 * reforma da praça". O tema chega escrito como título ("A reforma…"), e só o
 * ARTIGO de abertura desce para minúscula — a primeira palavra pode ser nome
 * próprio ("Praça Central…"), e rebaixá-la estragaria o nome.
 */
export function temaNaFrase(tema: string): string {
  const limpo = tema.trim();
  return /^(A|O|As|Os|Um|Uma) /.test(limpo) ? limpo.charAt(0).toLowerCase() + limpo.slice(1) : limpo;
}

/** A conta sem o `@`, como o app mostra no cabeçalho do post. */
export function nomeDaConta(perfil: string): string {
  return perfil.replace(/^@/, "");
}

// ────────────────────────────────────────────────── o Mural: o toque no Story

export type Lado = "minha" | "par";
export interface PosicaoNoMural {
  lado: Lado;
  /** 0, 1 ou 2 — o segmento da tríade. */
  indice: number;
}

/**
 * O toque na direita do Story. Como no app real, depois do último segmento
 * vem o Story da PRÓXIMA pessoa: da publicação da criança para a do colega. No
 * fim da do colega, fica — não há terceira pessoa, e voltar sozinho ao começo
 * faria o contraste piscar na frente dela.
 */
export function avancar(p: PosicaoNoMural, total: number): PosicaoNoMural {
  if (p.indice < total - 1) return { lado: p.lado, indice: p.indice + 1 };
  if (p.lado === "minha") return { lado: "par", indice: 0 };
  return p;
}

/** O toque na esquerda: o inverso, e do primeiro segmento do colega volta ao último da criança. */
export function voltar(p: PosicaoNoMural, total: number): PosicaoNoMural {
  if (p.indice > 0) return { lado: p.lado, indice: p.indice - 1 };
  if (p.lado === "par") return { lado: "minha", indice: total - 1 };
  return p;
}

// ──────────────────────────────────────────────────── a espera entre tentativas

/**
 * Quanto esperar antes da próxima tentativa de uma chamada que caiu na rede:
 * 2 s, 4 s, 8 s e daí 15 s para sempre. Numa sala de trinta máquinas no mesmo
 * Wi-Fi, repetir em rajada é o que derruba o roteador de vez; esperar demais é
 * a criança achando que o botão quebrou.
 */
export function esperaDaTentativa(tentativa: number): number {
  const passos = [2_000, 4_000, 8_000];
  return passos[tentativa] ?? 15_000;
}

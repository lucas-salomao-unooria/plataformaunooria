import type { Estado, Etapa, Passo } from "./tipos";

/**
 * A MÁQUINA DE ESTADOS DA TELA — pura, sem React e sem rede.
 *
 * O que ela responde é uma pergunta só: **dado o estado que a api devolveu, o
 * que a tela mostra e o que está habilitado?** Ela não decide nada de negócio
 * (a cota, o latch e o filtro de PII são do servidor); ela evita que a decisão
 * do servidor seja recalculada em quinze lugares do componente.
 *
 * Existe separada por dois motivos medidos no repo:
 *
 * 1. **O `vitest` é a única rede sobre isto.** Um `if` errado num componente
 *    React passa no typecheck e aparece como botão morto na aula.
 * 2. **A api e a tela têm de concordar.** `passoEfetivo` já vem resolvido do
 *    servidor; o que mora aqui é o que DEPENDE dele, e derivar em vez de
 *    duplicar impede as duas versões divergirem.
 *
 * As transições que ela cobre são as 41 arestas do grafo de fluxo do insumo,
 * incluindo os 5 caminhos degenerados.
 */

/** As telas que a experiência sabe desenhar. */
export type Tela =
  | "briefing"
  | "conversa"
  | "decisao"
  | "processando"
  | "manifesto"
  | "pausa"
  | "percurso"
  | "confirmacao"
  | "podcast"
  | "fim";

/**
 * A tela, a partir do passo e do congelamento da turma.
 *
 * `aguardandoATurma` vence o passo: o Checkpoint A é a única coisa que
 * atravessa o ritmo individual, e é a razão de ele existir.
 */
export function telaDo(estado: Pick<Estado, "passo" | "aguardandoATurma">): Tela {
  if (estado.aguardandoATurma) return "pausa";
  switch (estado.passo) {
    case "briefing":
      return "briefing";
    case "chat":
      return "conversa";
    case "decisao":
      return "decisao";
    case "manifesto":
      return "manifesto";
    case "percurso":
      return "percurso";
    case "podcast":
      return "podcast";
    case "fim":
      return "fim";
  }
}

/**
 * O seletor de questionamentos está aberto?
 *
 * Fechado enquanto a máquina "digita" — e a razão é de cena, não de regra: um
 * seletor vivo durante o streaming convida a atropelar a resposta que a criança
 * precisa ler para chegar à contradição.
 */
export function seletorAberto(passo: Passo, streaming: boolean, bloqueado: boolean): boolean {
  return passo === "chat" && !streaming && !bloqueado;
}

/** Os questionamentos que ainda podem ser disparados. */
export function promptsDisponiveis<T extends { id: string }>(
  prompts: readonly T[],
  enviados: readonly string[],
): T[] {
  return prompts.filter((p) => !enviados.includes(p.id));
}

/**
 * O botão de submeter a cláusula está habilitado?
 *
 * Três condições em série, e cada uma corresponde a uma regra da spec: a cota
 * de auditoria (PED-02), uma cláusula selecionada (cardinalidade = 1) e o latch
 * ainda aberto. A api recusa de qualquer forma — este cálculo existe para o
 * botão não CONVIDAR ao 409.
 */
export function podeSubmeterClausula(
  estado: Pick<Estado, "cotaAtingida" | "clausulaId">,
  selecionada: string | null,
  enviando: boolean,
): boolean {
  return estado.cotaAtingida && selecionada !== null && !estado.clausulaId && !enviando;
}

/**
 * O botão de registrar o percurso está habilitado?
 *
 * Exatamente 2 tags DISTINTAS e o piso de caracteres no texto já aparado. O
 * `trim` aqui não é cosmético: sem ele, vinte espaços habilitariam o botão e a
 * api responderia 400 — um erro que a criança não tem como entender, porque a
 * tela dizia que estava pronto.
 */
export function podeRegistrarPercurso(
  tags: readonly string[],
  justificativa: string,
  piso: number,
  exigidas: number,
  enviando: boolean,
): boolean {
  const distintas = new Set(tags).size;
  return (
    distintas === exigidas &&
    tags.length === exigidas &&
    justificativa.trim().length >= piso &&
    !enviando
  );
}

/**
 * Pode marcar mais uma tag?
 *
 * O teto é rígido (2), e a tela IMPEDE a terceira em vez de aceitar e reclamar
 * depois: o formulário tem quatro caixas, e a criança que marcou três descobre
 * pelo botão desabilitado — sem saber qual desmarcar.
 */
export function podeMarcarTag(
  tags: readonly string[],
  id: string,
  exigidas: number,
): boolean {
  return tags.includes(id) || tags.length < exigidas;
}

// ───────────────────────────────────────────── os caminhos degenerados

/** Segundos sem ação na Etapa 2 para o balão de apoio de Amara aparecer. */
export const SEGUNDOS_ATE_O_APOIO = 120;

/**
 * Intervalo mínimo entre disparos, em milissegundos.
 *
 * Abaixo dele a máquina entra em latência forçada de 15s — o caminho degenerado
 * "cliques rápidos aleatórios" da spec. O objetivo é fazer a criança LER a
 * réplica: sem isso, três cliques em cinco segundos levam ao pico com a
 * contradição na tela e nenhum olho nela.
 */
export const INTERVALO_MINIMO_MS = 10_000;

/** Quanto tempo a latência forçada dura. */
export const LATENCIA_FORCADA_MS = 15_000;

/**
 * Segundos de tela abaixo dos quais a submissão da cláusula pede confirmação.
 *
 * O caminho degenerado "exploração mínima": o sistema ACEITA a escolha (não
 * frustrar é regra), mas a máquina devolve uma réplica provocativa e pede
 * confirmação. A escolha vale igual — o que muda é que a criança a fez duas
 * vezes.
 */
export const SEGUNDOS_DE_LEITURA_MINIMA = 5;

export function precisaConfirmarEscolha(segundosNaTela: number, jaConfirmou: boolean): boolean {
  return segundosNaTela < SEGUNDOS_DE_LEITURA_MINIMA && !jaConfirmou;
}

export function deveForcarLatencia(ultimoDisparoMs: number | null, agoraMs: number): boolean {
  if (ultimoDisparoMs === null) return false;
  return agoraMs - ultimoDisparoMs < INTERVALO_MINIMO_MS;
}

/**
 * O polling do Checkpoint A deve estar ligado?
 *
 * Só nas telas em que o congelamento tem efeito: a partir da decisão e até a
 * assinatura. Antes disso a turma não vai ser congelada (a professora aciona o
 * botão ao fim da Etapa 3), e depois a criança já assinou — e o latch é dela,
 * não da turma.
 *
 * Ligar sempre custaria 7 req/s por turma durante os 50 minutos inteiros em
 * vez de durante a Etapa 4. É a diferença entre polling e polling barato.
 */
export function deveObservarOGate(passo: Passo, temTurma: boolean): boolean {
  if (!temTurma) return false;
  return passo === "decisao" || passo === "manifesto" || passo === "percurso";
}

export const INTERVALO_DO_POLLING_MS = 5_000;

/** A turma congelou depois da última leitura? */
export function congelou(anterior: Etapa, atual: Etapa): boolean {
  return anterior !== "debate" && atual === "debate";
}

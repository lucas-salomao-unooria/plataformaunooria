import type { Estado, MensagemDoFeed, Passo, Reacao } from "./tipos";

/**
 * Regras de TELA — puras, testáveis, e sem nenhuma decisão de correção.
 *
 * O que decide resultado (qual opção é a checada, quanto vale o percurso, se a
 * turma passou de etapa) mora na api. O que mora aqui é o que a tela precisa
 * saber sozinha: qual superfície desenhar, quanto tempo a cascata leva, se o
 * estudante está parado tempo demais.
 */

/** As telas da missão, do ponto de vista de quem desenha. */
export type Superficie =
  /** A casca do mensageiro: quem fala é o app. */
  | "clone"
  /** As telas da escola: breakpoint, podcast, cards, percurso. */
  | "plataforma";

/**
 * Onde cada passo é desenhado — e esta é a fronteira da REVELAÇÃO.
 *
 * Enquanto o estudante está dentro do grupo, quem fala é o aplicativo. Quando
 * ele sai do mensageiro, a escola assume. Um componente da plataforma dentro do
 * chat quebraria a ilusão que a missão está medindo; e o contrário — o clone
 * desenhando a tela do percurso — faria a escola parecer parte da ficção.
 */
export function superficieDo(passo: Passo): Superficie {
  return passo === "breakpoint" || passo === "podcast" || passo === "sintese" ||
    passo === "reflexao" || passo === "fim"
    ? "plataforma"
    : "clone";
}

/** O tempo total da cascata, somando os atrasos que o servidor mandou. */
export function duracaoDaCascata(reacoes: readonly Reacao[]): number {
  return reacoes.reduce((total, r) => total + r.atrasoMs, 0);
}

/**
 * Quantas reações já apareceram, dado o tempo decorrido.
 *
 * A cadência 2s → 3s → 2s é não-negociável de ofício: a espera É o pico da
 * missão. Esta função existe para o componente não recalcular o acumulado a
 * cada quadro e para o teste conseguir afirmar o ritmo sem esperar 7 segundos.
 */
export function reacoesVisiveis(reacoes: readonly Reacao[], decorridoMs: number): number {
  let acumulado = 0;
  let visiveis = 0;
  for (const r of reacoes) {
    acumulado += r.atrasoMs;
    if (decorridoMs >= acumulado) visiveis += 1;
  }
  return visiveis;
}

/** Quem está "digitando..." agora — os que ainda não falaram. */
export function digitando(reacoes: readonly Reacao[], decorridoMs: number): string[] {
  return reacoes.slice(reacoesVisiveis(reacoes, decorridoMs)).map((r) => r.autor);
}

/** Minutos de tela parada até Amara cutucar. */
export const MINUTOS_ATE_O_CUTUCAO = 4;

/**
 * O cutucão só existe na investigação, e só depois de 4 minutos.
 *
 * Fora dali ele seria Amara falando durante a análise — e o silêncio dela na
 * Etapa 2 é não-negociável: se ela apontasse qual mensagem é falsa, o
 * reconhecimento de padrão que a missão mede deixaria de acontecer.
 */
export function deveCutucar(estado: Estado, msParado: number): boolean {
  return (
    estado.passo === "grupo" &&
    !estado.inspecionouMateria &&
    msParado >= MINUTOS_ATE_O_CUTUCAO * 60_000
  );
}

/** A mensagem que abre o visualizador da matéria — a que a missão inteira gira em torno. */
export function mensagemChave(feed: readonly MensagemDoFeed[]): MensagemDoFeed | undefined {
  return feed.find((m) => m.abreMateria);
}

/**
 * O estudante pode enviar a resposta?
 *
 * A api recusa de qualquer forma (é lá que a regra vale). Aqui a mesma condição
 * existe para o botão poder explicar o que falta, em vez de deixar a criança
 * tocar num alvo que vai responder erro.
 */
export function podeEnviar(estado: Estado, opcaoMarcada: string | null): boolean {
  return Boolean(opcaoMarcada) && estado.inspecionouMateria && estado.ouviuPodcast;
}

/** O que falta para enviar, na voz do app. `null` quando não falta nada. */
export function oQueFaltaParaEnviar(estado: Estado, opcaoMarcada: string | null): string | null {
  if (!estado.ouviuPodcast) return "Ouça o episódio até o fim para responder no grupo.";
  if (!estado.inspecionouMateria) return "Abra a matéria completa antes de responder.";
  if (!opcaoMarcada) return "Escolha uma das respostas.";
  return null;
}

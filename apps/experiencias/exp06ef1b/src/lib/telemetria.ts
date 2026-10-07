import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — verbo xAPI + objeto `dominio:acao`, e nada
 * além disso. Molde: `apps/experiencias/exp07ef1b/src/lib/telemetria.ts`.
 *
 * **O contrato do SDK é `track(verbo, objeto, { resultado?, contexto? })`**, e
 * os dois são OBJETOS com número, booleano ou vocabulário fechado. Mandar
 * string solta em `resultado` derruba o lote inteiro com
 * `eventos.N.resultado: invalid_type`, e o único rastro é um 400 no console.
 *
 * **O que NUNCA sai daqui** (regra 6): nome, e-mail, o TEXTO buscado na
 * galeria (texto livre de menor — sai o tipo da busca, como na api). E das
 * enquetes sai QUAL pergunta foi respondida, nunca QUAL alternativa: o id da
 * alternativa é o nível da habilidade para quem conhece a ficha (regra 3). O
 * VOTO também não sai daqui: ele é dado de servidor, gravado no latch, e o
 * painel do professor é que decide o que mostrar dele (e o que não mostra).
 *
 * Todo evento da missão nasce NESTE arquivo: é daqui que sai a tabela do
 * `README.md` e o `verbos` do manifesto.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

type Valor = number | boolean | string;

function track(
  verbo: "attempted" | "interacted" | "progressed" | "completed",
  objeto: string,
  dados?: { resultado?: Record<string, Valor>; contexto?: Record<string, Valor> },
) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** Depois do handshake e da primeira leitura: a criança abriu a missão. */
  entrou: (passo: string) => track("progressed", "missao:entrada", { contexto: { passo } }),

  // E1
  /** Tocou "Acessar Feed da Mostra" no crachá. */
  acessouOFeed: () => track("progressed", "credencial:acessar-feed"),

  // E2
  /** Curtiu ou descurtiu (`gesto`: o coração ou o toque duplo). */
  curtiu: (postId: string, curtiu: boolean, gesto: "coracao" | "toque-duplo") =>
    track("interacted", "feed:curtir", { resultado: { curtiu }, contexto: { postId, gesto } }),
  /** Salvou ou tirou dos salvos — o segundo sinal do feed (`desvio`: na rodada de desvio). */
  salvou: (postId: string, salvou: boolean, desvio = false) =>
    track("interacted", desvio ? "desvio:salvar" : "feed:salvar", { resultado: { salvou }, contexto: { postId } }),
  /** Tocou comentar ou compartilhar: a comissão avisou que estão fechados (não pesa no feed). */
  tocouFechado: (acao: "comentar" | "compartilhar") => track("interacted", "feed:fechado", { contexto: { acao } }),
  /** Deslizou o carrossel de um post. */
  deslizou: (postId: string, lamina: number) => track("interacted", "feed:carrossel", { contexto: { postId, lamina } }),
  /** Abriu a legenda inteira ("...mais"). */
  expandiu: (postId: string) => track("interacted", "feed:legenda", { contexto: { postId } }),
  /** Um post chegou à tela. `posicao` é 1..10. */
  recebeuPost: (posicao: number) => track("interacted", "feed:post", { contexto: { posicao } }),
  /** O décimo post chegou: a barra da cédula acendeu. */
  completouOFeed: () => track("progressed", "feed:completo"),

  // E3
  /** Abriu a cédula. */
  abriuACedula: () => track("interacted", "cedula:abrir"),
  /** O aviso de inatividade da comissão acendeu. */
  ficouParado: () => track("interacted", "cedula:inatividade"),
  /** O LATCH 1, confirmado pela api. A convicção e o cartão são vocabulário fechado; o projeto e a frase não saem. */
  votou: (conviccao: string, motivo: string, estandes: number) =>
    track("attempted", "cedula:votar", { resultado: { estandes }, contexto: { conviccao, motivo } }),

  // E4
  /** Entrou na espera da plenária. */
  esperou: () => track("progressed", "plenaria:espera"),
  /** A galeria abriu. `ocultos` é a taxa real da sessão (número, não nome). */
  abriuAGaleria: (ocultos: number, percentual: number) =>
    track("progressed", "galeria:abrir", { resultado: { ocultos, percentual } }),
  /** Abriu a ficha de um estande na galeria. */
  inspecionou: (projetoId: string, oculto: boolean) =>
    track("interacted", "galeria:inspecionar", { contexto: { projetoId, oculto } }),
  /** Buscou. Só o TIPO e a área — nunca o texto. */
  buscou: (busca: string, area: string | null) =>
    track("interacted", "galeria:buscar", { contexto: { busca, area: area ?? "nenhuma" } }),
  /** O LATCH 2, confirmado pela api. A ação e o cartão; o projeto e a frase não saem. */
  revisou: (acao: "manter" | "trocar" | "complementar", motivo: string) =>
    track("progressed", "galeria:revisar", { contexto: { acao, motivo } }),

  // A rodada de desvio
  /** Curtiu ou descurtiu na rodada de desvio. */
  curtiuNoDesvio: (postId: string, curtiu: boolean) =>
    track("interacted", "desvio:curtir", { resultado: { curtiu }, contexto: { postId } }),
  /** A rodada de desvio abriu para esta criança. */
  entrouNoDesvio: () => track("progressed", "desvio:entrada"),
  /** Encerrou a rodada de desvio, confirmado pela api. */
  concluiuODesvio: (interacoes: number) => track("progressed", "desvio:concluido", { resultado: { interacoes } }),

  // E5
  /** Conferiu a cadeia. */
  montouACadeia: (correta: boolean, tentativas: number) =>
    track("attempted", "cadeia:validar", { resultado: { correta, tentativas } }),

  // E6
  /** Registrou os dois cartões (sem dizer quais: não vira nota). */
  escolheuOsCartoes: () => track("progressed", "mariana:cartoes"),
  /** Respondeu uma enquete. A PERGUNTA, nunca a alternativa — ver a nota do topo. */
  respondeuEnquete: (perguntaId: string) => track("interacted", "enquete:responder", { contexto: { perguntaId } }),
  /** A enquete falhou (409, rede, 404) e a tela pulou para o encerramento. */
  pulouEnquete: (perguntaId: string, status: number) =>
    track("interacted", "enquete:pulada", { contexto: { perguntaId, status } }),

  /** O crachá homologado, depois do `POST /juri-estadual/concluir`. */
  concluiu: (enquetes: number) => track("completed", "missao:concluida", { resultado: { enquetes } }),

  /** Um aviso global acendeu (rede ou sessão). Sem detalhe: é diagnóstico de sala. */
  caiu: (motivo: "rede" | "sessao") => track("interacted", "conexao:aviso", { contexto: { motivo } }),
};

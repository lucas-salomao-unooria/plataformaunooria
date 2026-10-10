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
  /** Salvou ou tirou dos salvos. O servidor grava e NÃO pesa no feed (PRD v2). */
  salvou: (postId: string, salvou: boolean) =>
    track("interacted", "feed:salvar", { resultado: { salvou }, contexto: { postId } }),
  /** Tocou comentar, compartilhar ou a aba Busca: a comissão avisou que estão fechados (não pesa no feed). */
  tocouFechado: (acao: "comentar" | "compartilhar" | "buscar") => track("interacted", "feed:fechado", { contexto: { acao } }),
  /** Trocou de aba na barra do app (Início, Busca, Notificações, Jurado). */
  trocouDeAba: (aba: string) => track("interacted", "feed:aba", { contexto: { aba } }),
  /** Deslizou o carrossel de um post. */
  deslizou: (postId: string, lamina: number) => track("interacted", "feed:carrossel", { contexto: { postId, lamina } }),
  /** Abriu a legenda inteira ("...mais"). */
  expandiu: (postId: string) => track("interacted", "feed:legenda", { contexto: { postId } }),
  /** Um post chegou à tela. `posicao` é 1..10. */
  recebeuPost: (posicao: number) => track("interacted", "feed:post", { contexto: { posicao } }),
  /** A cédula foi liberada pelo servidor: o décimo post chegou OU os 8 minutos acabaram. */
  completouOFeed: (porTempo: boolean) => track("progressed", "feed:completo", { contexto: { porTempo } }),

  // E3
  /** Abriu a cédula. */
  abriuACedula: () => track("interacted", "cedula:abrir"),
  /** O aviso de inatividade da comissão acendeu (60 s sem toque com a cédula aberta). */
  ficouParado: () => track("interacted", "cedula:inatividade"),
  /** O LATCH 1, confirmado pela api. A convicção é vocabulário fechado; o projeto não sai. */
  votou: (conviccao: string, estandes: number) =>
    track("attempted", "cedula:votar", { resultado: { estandes }, contexto: { conviccao } }),

  // E4
  /** Entrou na espera (o latch do voto). */
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
  /** O LATCH 2, confirmado pela api. A ação; o projeto não sai. */
  revisou: (acao: "manter" | "trocar") => track("progressed", "galeria:revisar", { contexto: { acao } }),

  // E5
  /** Conferiu a cadeia (a errada é o 422 `ordem-incorreta`, e a tentativa conta). */
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

import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — verbo xAPI + objeto `dominio:acao`, e nada
 * além disso. Molde: `apps/experiencias/exp05ef1b/src/lib/telemetria.ts`.
 *
 * **O contrato do SDK é `track(verbo, objeto, { resultado?, contexto? })`**, e
 * os dois são OBJETOS com número, booleano ou vocabulário fechado. Mandar
 * string solta em `resultado` derruba o lote inteiro com
 * `eventos.N.resultado: invalid_type`, e o único rastro é um 400 no console.
 * Não existe campo `dados`: chave desconhecida é descartada em silêncio.
 *
 * **O que NUNCA sai daqui** (regra 6 e RNF-PRIV-002): a legenda dos Stories, a
 * reflexão, nome, e-mail. De um texto autoral sai o TAMANHO, em code points, e
 * só. E da marcação (ADR-170) sai se foi um post ou "nada", nunca QUAL post: o
 * id do post do colega, para quem conhece a cobertura, é o enquadramento — e o
 * enquadramento é o nível da EF07CO08, segredo de servidor (regra 3).
 *
 * O id do POST salvo sai, e é de propósito: ele é o objeto editorial, não a
 * criança — o painel da professora já mostra a tríade e a matriz de cada
 * publicação, e saber quais posts a sala salvou e depois podou é o dado de
 * curadoria que a missão existe para produzir.
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
  entrou: (passo: string) => track("attempted", "missao:entrada", { contexto: { passo } }),

  // E1
  /** Tocou "Abrir Feed da Cobertura" na DM da Amara. */
  abriuOFeed: () => track("progressed", "desafio:abrir-feed"),

  // E2
  /** Salvou um post. `salvos` é o total depois do toque. */
  salvou: (postId: string, salvos: number) =>
    track("interacted", "feed:salvar", { resultado: { salvos }, contexto: { postId } }),
  /** Tirou um post dos salvos, ainda no feed. */
  desfezSalvar: (postId: string, salvos: number) =>
    track("interacted", "feed:remover", { resultado: { salvos }, contexto: { postId } }),
  /** A imagem do post falhou e a criança tocou "Tentar novamente". */
  recarregouMidia: (postId: string) => track("interacted", "feed:recarregar-midia", { contexto: { postId } }),
  /** O andaime do feed apareceu: o gesto de rolar ou a dica do marcador. */
  viuAndaime: (motivo: "demonstracao" | "inatividade") =>
    track("interacted", "feed:andaime", { contexto: { motivo } }),
  /** Saiu do feed para a aba Salvos. O tempo é indicativo, nunca mérito. */
  foiParaSalvos: (salvos: number, tempoFeedS: number) =>
    track("progressed", "feed:ir-salvos", { resultado: { salvos }, contexto: { tempoFeedS } }),

  // E3
  /** Desmarcou um salvo na grade — a poda. */
  podou: (postId: string, selecionados: number) =>
    track("interacted", "salvos:remover", { resultado: { selecionados }, contexto: { postId } }),
  /** Marcou de novo um salvo que tinha desmarcado. */
  remarcou: (postId: string, selecionados: number) =>
    track("interacted", "salvos:selecionar", { resultado: { selecionados }, contexto: { postId } }),
  /** Voltou da aba Salvos para garimpar mais. */
  voltouAoFeed: () => track("interacted", "salvos:voltar-feed"),
  /** Abriu o alerta "Publicar no perfil do grêmio?". */
  pediuParaPublicar: () => track("interacted", "stories:confirmar"),
  /** Cancelou no alerta. */
  desistiuDePublicar: () => track("interacted", "stories:cancelar"),
  /** O LATCH, confirmado pela api. Da legenda, só o tamanho. */
  publicou: (chars: number) => track("attempted", "stories:publicar", { resultado: { itens: 3 }, contexto: { chars } }),
  /** O sanitizador da api recusou a legenda (422). */
  legendaRecusada: () => track("interacted", "stories:recusada"),

  // E3-SIS e E4
  /** Entrou na espera da turma depois de publicar. */
  esperou: () => track("progressed", "gate:espera"),
  /** O Mural abriu para ela. `virtual`: o par é Tomás ou Malu. */
  viuOMural: (virtual: boolean) => track("progressed", "mural:abrir", { contexto: { virtual } }),
  /** Trocou entre a própria publicação e a do colega. */
  alternou: (para: "minha" | "par") => track("interacted", "mural:alternar", { contexto: { para } }),
  /** As fichas técnicas acenderam na tela dela. */
  viuAsFichas: () => track("progressed", "mural:fichas"),
  /** Abriu ou recolheu a ficha técnica. */
  mexeuNaFicha: (aberta: boolean) => track("interacted", "mural:ficha", { contexto: { aberta } }),

  // E5
  /** Leu um card conceitual até o fim da trava. `card` é 1, 2 ou 3. */
  leuCard: (card: number, segundos: number) =>
    track("progressed", "explicar:card", { contexto: { card, segundos } }),
  /** Tocou "Ir para a Reflexão". */
  foiParaReflexao: () => track("progressed", "explicar:ir-reflexao"),

  // E4-ALU-01B, E6 e o fim
  /** Entregou a reflexão (o latch dela). Só o TAMANHO — nunca o texto. */
  enviouReflexao: (chars: number) => track("completed", "reflexao:enviar", { contexto: { chars } }),
  /**
   * Marcou na E4-ALU-01B (ADR-170): SÓ se foi um post ou "nada" — nunca QUAL
   * post (o id, para quem conhece a cobertura, é o enquadramento, e o
   * enquadramento é o nível). E o "por quê?" nunca: só o tamanho.
   */
  marcou: (tipo: "post" | "nenhum") => track("interacted", "mural:marcacao", { contexto: { tipo } }),
  explicouAMarcacao: (caracteres: number) =>
    track("interacted", "mural:marcacao-porque", { resultado: { caracteres } }),

  /** "Missão concluída!" — desde a ADR-170, a reflexão enviada encerra a missão. */
  concluiu: () => track("completed", "missao:concluida"),

  /** Um aviso global acendeu (rede ou sessão). Sem detalhe: é diagnóstico de sala. */
  caiu: (motivo: "rede" | "sessao") => track("interacted", "conexao:aviso", { contexto: { motivo } }),
};

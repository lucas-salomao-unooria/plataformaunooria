/**
 * Os passos da exp07ef1b e a regra que reconcilia A TURMA com O ESTUDANTE.
 *
 * Dois relógios, como nas outras missões de sala (exp05ef1b, exp06ef2b):
 *
 * - `exp07ef1b_gates_turma.etapa` — o relógio da TURMA. UM botão no painel,
 *   que sempre diz a próxima etapa: "Liberar Mural", "Revelar fichas",
 *   "Liberar conclusão". São as três pausas do PRD.
 * - `exp07ef1b_sessoes.passo` — a tela daquele estudante. Antes da publicação
 *   cada um anda no seu ritmo (um ainda rola o feed enquanto o colega já podou
 *   os salvos); depois dela, a turma anda junta até a explicação.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e a experiência precisam chegar à MESMA resposta num F5.
 *
 * **A etapa só mexe em quem PUBLICOU.** Quem ainda não publicou continua no
 * feed ou nos salvos, com o Mural aberto ou não: a publicação atrasada é um
 * caminho previsto (ela recebe o colega virtual), e empurrar a criança para o
 * Mural sem tríade seria mostrar a ela a comparação sem o que comparar.
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "desafio",
  "feed",
  "salvos",
  "publicado",
  "mural",
  "fichas",
  "explicacao",
  "reflexao",
  "enquetes",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que a professora as abre. */
export const ETAPAS = ["exploracao", "mural", "fichas", "explicacao"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "exploracao";
export const PASSO_INICIAL: Passo = "desafio";

/** Os passos ANTES do latch: é onde a criança ainda pode mudar de ideia. */
export const PASSOS_ANTES_DA_PUBLICACAO: readonly Passo[] = ["desafio", "feed", "salvos"];

/**
 * Os passos que a própria criança pede, por `POST passo`. Os do meio
 * (`publicado`, `mural`, `fichas`, `explicacao`) são da TURMA: ninguém os pede,
 * a etapa os impõe. `enquetes` e `fim` nascem das rotas que os carimbam
 * (`reflexao`, `concluir`).
 */
export const PASSOS_PEDIDOS = ["feed", "salvos", "reflexao"] as const;
export type PassoPedido = (typeof PASSOS_PEDIDOS)[number];

/** O passo que cada etapa impõe a quem publicou. */
const PASSO_DA_ETAPA: Record<Etapa, Passo> = {
  exploracao: "publicado",
  mural: "mural",
  fichas: "fichas",
  explicacao: "explicacao",
};

const ORDEM: Record<Passo, number> = Object.fromEntries(PASSOS.map((p, i) => [p, i])) as Record<Passo, number>;
const ORDEM_DA_ETAPA: Record<Etapa, number> = Object.fromEntries(ETAPAS.map((e, i) => [e, i])) as Record<
  Etapa,
  number
>;

export function ehPasso(valor: string): valor is Passo {
  return (PASSOS as readonly string[]).includes(valor);
}

export function ehEtapa(valor: string): valor is Etapa {
  return (ETAPAS as readonly string[]).includes(valor);
}

/**
 * Traduz qualquer valor de `passo` para um passo conhecido. O CHECK da
 * migration já restringe; o fallback existe porque o Prisma entrega `string`.
 */
export function normalizarPasso(valor: string | null | undefined): Passo {
  return valor && ehPasso(valor) ? valor : PASSO_INICIAL;
}

export function normalizarEtapa(valor: string | null | undefined): Etapa {
  return valor && ehEtapa(valor) ? valor : ETAPA_INICIAL;
}

export function passoAntes(a: Passo, b: Passo): boolean {
  return ORDEM[a] < ORDEM[b];
}

export function etapaAntes(a: Etapa, b: Etapa): boolean {
  return ORDEM_DA_ETAPA[a] < ORDEM_DA_ETAPA[b];
}

/** Já publicou? É o latch, e é ele que põe a criança sob o relógio da turma. */
export function publicou(passo: Passo): boolean {
  return !PASSOS_ANTES_DA_PUBLICACAO.includes(passo);
}

/**
 * O passo que o estudante deve ver, dado o dele e a etapa da turma.
 *
 * 1. Antes de publicar, a etapa não o toca: ele segue no feed ou nos salvos.
 * 2. Entre a publicação e a explicação, a etapa MANDA — é piso e teto ao mesmo
 *    tempo. Quem publicou espera o Mural; com o Mural aberto, todos veem o
 *    Mural; com as fichas, todos veem as fichas. É o que sincroniza a sala.
 * 3. Da reflexão em diante o passo é da criança (`reflexao`, `enquetes`,
 *    `fim`): ela chegou lá sozinha, depois de a professora liberar a
 *    explicação, e nada a puxa de volta. O gate nunca volta dentro de uma
 *    rodada — e quando a rodada muda (zerar, tema novo) a sessão é outra.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  if (!publicou(passo)) return passo;
  if (!passoAntes(passo, "reflexao")) return passo;
  return PASSO_DA_ETAPA[etapa];
}

/**
 * O estudante espera a professora? É o que a tela de espera lê ("Aguardando o
 * professor liberar…"): o passo efetivo está na zona da turma e a etapa ainda
 * não é a da explicação, a única em que a criança avança sozinha.
 */
export function aguardandoOProfessor(passo: Passo, etapa: Etapa): boolean {
  const efetivo = passoEfetivo(passo, etapa);
  return efetivo === "publicado" || efetivo === "mural" || efetivo === "fichas";
}

/** A etapa seguinte, ou `null` na última — é o rótulo do botão único do painel. */
export function proximaEtapa(atual: Etapa): Etapa | null {
  return ETAPAS[ORDEM_DA_ETAPA[atual] + 1] ?? null;
}

export type ResultadoDoGate = { ok: true; mudou: boolean } | { ok: false; codigo: "transicao-de-etapa-invalida" };

/**
 * A transição que a professora pede, pela etapa de DESTINO.
 *
 * - O destino igual à etapa atual é aceito e não muda nada: é o segundo clique
 *   no mesmo botão (a docente nervosa, o retry da rede), e ele não pode dar
 *   erro nem parear a sala de novo.
 * - O destino é a PRÓXIMA etapa: anda uma.
 * - Qualquer outro — pular a revelação das fichas, voltar ao Mural depois da
 *   explicação — é recusado. Pular deixaria o debate sem a ficha; voltar
 *   reabriria para a turma inteira uma cena que ela já deixou.
 */
export function transicaoDoGate(atual: Etapa, para: Etapa): ResultadoDoGate {
  if (para === atual) return { ok: true, mudou: false };
  if (proximaEtapa(atual) === para) return { ok: true, mudou: true };
  return { ok: false, codigo: "transicao-de-etapa-invalida" };
}

export type ResultadoDoPasso =
  | { ok: true; passo: Passo }
  | { ok: false; codigo: "passo-invalido" | "latch-ja-confirmado" | "stories-nao-publicados" | "reflexao-nao-liberada" };

/**
 * O passo que a criança PEDE, sobre o passo GRAVADO dela e a etapa da turma.
 *
 * - `feed`: do desafio para o feed, ou de volta dos salvos (a aba Salvos tem
 *   "voltar", e ir e vir é curadoria). Depois do latch, não há feed.
 * - `salvos`: só de quem está no feed (o FAB aparece lá).
 * - `reflexao`: só de quem publicou, e só com a explicação liberada. Pedir de
 *   novo, ou depois de já ter enviado, devolve o passo em que ela está — a
 *   escada é de sentido único, e um F5 não pode devolver a criança à reflexão
 *   que ela já mandou.
 */
export function pedirPasso(atual: Passo, etapa: Etapa, para: PassoPedido): ResultadoDoPasso {
  if (para === "feed" || para === "salvos") {
    if (publicou(atual)) return { ok: false, codigo: "latch-ja-confirmado" };
    if (para === "salvos" && atual === "desafio") return { ok: false, codigo: "passo-invalido" };
    return { ok: true, passo: para };
  }
  if (!publicou(atual)) return { ok: false, codigo: "stories-nao-publicados" };
  if (!passoAntes(atual, "reflexao")) return { ok: true, passo: atual };
  if (etapa !== "explicacao") return { ok: false, codigo: "reflexao-nao-liberada" };
  return { ok: true, passo: "reflexao" };
}

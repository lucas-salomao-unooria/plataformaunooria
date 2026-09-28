/**
 * Os passos da exp06ef2b e a regra que reconcilia **a turma** com **o estudante**.
 *
 * Dois relógios, como na exp07ef1b:
 *
 * - `exp06ef2b_gates_turma.etapa` — o relógio da TURMA, que a professora controla.
 *   É o que fecha a Aula 1 em 30 telas ao mesmo tempo.
 * - `exp06ef2b_sessoes.passo` — a tela daquele estudante. Dentro do mesmo momento
 *   eles andam em ritmos diferentes: um ainda audita o terceiro balão enquanto
 *   o outro já decidiu.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e o cliente precisam chegar à MESMA resposta. Duas
 * implementações divergentes seriam a tela discordando do servidor.
 *
 * **Duas etapas, não quatro.** A exp07ef1b tem quatro porque a professora congela
 * o debate e libera a reflexão em momentos separados. Aqui o PRD pede UM botão
 * ("Liberar Aula 2") e o seu inverso ("Pausar simulação"): inventar gates que
 * ninguém aperta encheria o painel de controles mortos.
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "contexto",
  "chats",
  "decisao",
  "breakpoint",
  "resultado",
  "ciclo",
  "percurso",
  "fim",
] as const;

export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que a professora as abre. */
export const ETAPAS = ["aula1", "aula2"] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "aula1";
export const PASSO_INICIAL: Passo = "contexto";

/** Onde cada etapa da turma coloca, no MÍNIMO, a tela do estudante. */
const PISO: Record<Etapa, Passo> = {
  aula1: "contexto",
  aula2: "resultado",
};

/**
 * Onde cada etapa coloca, no MÁXIMO.
 *
 * `aula1` para em `breakpoint`: a Aula 1 acaba depois da decisão, e o card de
 * pausa é o que diz que o progresso está salvo. Sem esse teto, quem decide cedo
 * veria o mapa da rede sozinho — e o Aha! da Etapa 4 foi desenhado para a turma
 * chegar junto, com a professora orientando a leitura dos nós.
 */
const TETO: Record<Etapa, Passo> = {
  aula1: "breakpoint",
  aula2: "fim",
};

const ordem = (passo: Passo) => PASSOS.indexOf(passo);

export function ehPasso(valor: string): valor is Passo {
  return (PASSOS as readonly string[]).includes(valor);
}

export function ehEtapa(valor: string): valor is Etapa {
  return (ETAPAS as readonly string[]).includes(valor);
}

/**
 * Traduz qualquer valor de `passo` para um passo conhecido.
 *
 * O fallback ingênuo seria o começo, e uma linha gravada por uma versão futura
 * mandaria a criança de volta à tela de contexto no meio do construtor.
 */
export function normalizarPasso(valor: string): Passo {
  return ehPasso(valor) ? valor : PASSO_INICIAL;
}

export function normalizarEtapa(valor: string): Etapa {
  return ehEtapa(valor) ? valor : ETAPA_INICIAL;
}

/**
 * O passo que o estudante deve ver, dado o dele e a etapa da turma.
 *
 * 1. A etapa é PISO: quem está adiantado não é puxado para trás.
 * 2. A etapa é TETO: quem decidiu espera no breakpoint. É o que sincroniza.
 * 3. `fim` NÃO é revisitado: quem entregou o percurso está em modo leitura, e
 *    uma volta de etapa (a professora aperta "Pausar simulação") não o traz de
 *    novo para a reflexão. O latch é do estudante, não da turma.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa | null): Passo {
  if (passo === "fim") return "fim";
  /* Estudante SEM TURMA não tem gate: não há quem dê a largada, e prendê-lo no
     breakpoint deixaria a missão inalcançável para quem chegou à rede sem
     enturmação. Ele corre no próprio ritmo, e o painel não o vê porque ele não
     está em turma nenhuma. */
  if (etapa === null) return passo;

  const piso = PISO[etapa];
  const teto = TETO[etapa];

  if (ordem(passo) < ordem(piso)) return piso;
  if (ordem(passo) > ordem(teto)) return teto;
  return passo;
}

/** O passo seguinte na ordem; `null` no último. */
export function proximoPasso(passo: Passo): Passo | null {
  const i = ordem(passo);
  return i >= 0 && i < PASSOS.length - 1 ? (PASSOS[i + 1] ?? null) : null;
}

/**
 * O estudante está esperando a turma?
 *
 * O cliente usa isto para escolher a tela de espera. `true` só quando a etapa
 * o SEGURA (teto), nunca quando ela o empurra (piso): ser levado adiante não é
 * esperar.
 */
export function aguardandoATurma(passo: Passo, etapa: Etapa | null): boolean {
  const efetivo = passoEfetivo(passo, etapa);
  return efetivo !== passo && ordem(efetivo) < ordem(passo);
}

/** As ações do painel da professora, e a etapa que cada uma abre. */
export const ETAPA_DA_ACAO = {
  "liberar-aula2": "aula2",
  "pausar-simulacao": "aula1",
} as const satisfies Record<string, Etapa>;

export type AcaoDoGate = keyof typeof ETAPA_DA_ACAO;

export const ACOES_DO_GATE = Object.keys(ETAPA_DA_ACAO) as [AcaoDoGate, ...AcaoDoGate[]];

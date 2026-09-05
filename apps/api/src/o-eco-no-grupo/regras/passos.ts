/**
 * Os passos da missão e a regra que reconcilia **a turma** com **o estudante**.
 *
 * A exp-07 tem dois relógios, como a exp-01:
 *
 * - `exp_07_gates_turma.etapa` — o relógio da TURMA, que a professora controla.
 *   É o que permite fechar a Aula 1 em 30 telas ao mesmo tempo e congelar todas
 *   no debate.
 * - `exp_07_sessoes.passo` — a tela daquele estudante. Dentro de um mesmo
 *   momento eles andam em ritmos diferentes: um ainda ouve o áudio da Dona
 *   Lúcia enquanto o outro já abriu a matéria íntegra.
 *
 * `passoEfetivo` resolve os dois num só valor, e mora aqui — puro e testável —
 * porque a api e o cliente precisam chegar à MESMA resposta. Duas
 * implementações divergentes disso seriam a tela do estudante discordando do
 * que o servidor acha que ele está vendo.
 *
 * A diferença em relação à exp-01: lá a etapa é só PISO. Aqui há TETO de
 * verdade, porque a missão é de DUAS AULAS — quem termina a investigação não
 * pode simplesmente entrar na decisão e acabar a missão sozinho antes da
 * segunda aula. O breakpoint é o teto da Aula 1, e é ele que faz a turma chegar
 * junto ao podcast.
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "chat_amara",
  "grupo",
  "breakpoint",
  "podcast",
  "intervencao",
  "desfecho",
  "sintese",
  "reflexao",
  "fim",
] as const;

export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que a professora as abre. */
export const ETAPAS = ["investigacao", "aula2", "debate", "reflexao"] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "investigacao";
export const PASSO_INICIAL: Passo = "chat_amara";

/** Onde cada etapa da turma coloca, no MÍNIMO, a tela do estudante. */
const PISO: Record<Etapa, Passo> = {
  investigacao: "chat_amara",
  aula2: "podcast",
  debate: "sintese",
  reflexao: "reflexao",
};

/**
 * Onde cada etapa da turma coloca, no MÁXIMO.
 *
 * `investigacao` para em `breakpoint`: a Aula 1 acaba ali, e o card de pausa é
 * o que diz que o progresso está salvo. `aula2` para em `sintese` — o estudante
 * decide, vê o bairro reagir e leva os cards até o fim, mas a reflexão é depois
 * do debate. `debate` é o congelamento: piso e teto no mesmo passo.
 */
const TETO: Record<Etapa, Passo> = {
  investigacao: "breakpoint",
  aula2: "sintese",
  debate: "sintese",
  reflexao: "fim",
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
 * Existe pela mesma razão do `normalizarFase` da exp-01: o fallback ingênuo
 * seria o começo, e uma linha gravada por uma versão futura mandaria a criança
 * de volta ao chat de Amara no meio da síntese.
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
 * Três regras, e a diferença entre elas é o ponto pedagógico:
 *
 * 1. A etapa é PISO: quem está adiantado não é puxado para trás — puxar seria
 *    punir quem leu mais rápido.
 * 2. A etapa é TETO: quem terminou a Aula 1 espera no breakpoint, e quem
 *    terminou os cards espera o debate. É o que sincroniza a turma.
 * 3. `fim` NÃO é revisitado: quem já entregou o percurso está em modo leitura,
 *    e nenhuma volta de etapa o traz de novo para a reflexão. O latch é do
 *    estudante, não da turma.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa | null): Passo {
  if (passo === "fim") return "fim";
  // Estudante SEM TURMA não tem gate: não há quem dê a largada, e prendê-lo no
  // breakpoint seria um beco sem saída — a missão inteira ficaria inalcançável
  // para quem chegou na rede sem enturmação. Ele corre no próprio ritmo, e o
  // painel do professor não o vê porque ele não está em turma nenhuma.
  if (etapa === null) return passo;

  const piso = PISO[etapa];
  const teto = TETO[etapa];

  if (ordem(passo) < ordem(piso)) return piso;
  if (ordem(passo) > ordem(teto)) return teto;
  return passo;
}

/** O passo seguinte na ordem; `null` no último. Usado pelas transições. */
export function proximoPasso(passo: Passo): Passo | null {
  const i = ordem(passo);
  return i >= 0 && i < PASSOS.length - 1 ? (PASSOS[i + 1] ?? null) : null;
}

/**
 * A turma está esperando o estudante, ou o estudante está esperando a turma?
 *
 * O cliente usa isso para escolher a tela de espera certa: no breakpoint ele
 * mostra "Aguardando liberação da professora"; no debate, a tela congelada.
 * Sem isso o estudante veria a mesma tela de bloqueio nos dois momentos, que
 * são pedagogicamente opostos.
 */
export function aguardandoATurma(passo: Passo, etapa: Etapa | null): boolean {
  const efetivo = passoEfetivo(passo, etapa);
  return efetivo !== passo && ordem(efetivo) < ordem(passo);
}

/** As ações do painel da professora, e a etapa que cada uma abre. */
export const ETAPA_DA_ACAO = {
  "liberar-aula2": "aula2",
  "congelar-debate": "debate",
  "liberar-reflexao": "reflexao",
  redefinir: "investigacao",
} as const satisfies Record<string, Etapa>;

export type AcaoDoGate = keyof typeof ETAPA_DA_ACAO;

export const ACOES_DO_GATE = Object.keys(ETAPA_DA_ACAO) as [AcaoDoGate, ...AcaoDoGate[]];

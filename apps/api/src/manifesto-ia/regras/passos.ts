/**
 * Os passos da exp-08 e a regra que reconcilia **a turma** com **o estudante**.
 *
 * Dois relógios, como na exp-06 e na exp-07:
 *
 * - `exp_08_gates_turma.etapa` — o relógio da TURMA, que a professora controla
 *   pelo painel. É o Checkpoint A: ela congela 30 telas ao mesmo tempo para o
 *   debate oral de 10 minutos.
 * - `exp_08_sessoes.passo` — a tela daquele estudante. Dentro do mesmo momento
 *   eles andam em ritmos diferentes: um ainda lê a segunda réplica da máquina
 *   enquanto o outro já escolheu a cláusula.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e o cliente precisam chegar à MESMA resposta. Duas
 * implementações divergentes seriam a tela discordando do servidor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A DIFERENÇA DESTA MISSÃO: o gate é OPCIONAL e por isso o piso não sobe.
 *
 * Na exp-06 a Aula 2 é uma porta que a professora ABRE — sem o clique dela
 * ninguém passa. Aqui é o contrário: a missão corre inteira sozinha, e o
 * congelamento é uma interrupção que ela PODE aplicar (gatilho de handoff 3 do
 * handoff: "caso a sessão seja assíncrona/individual, a ausência de comando
 * docente permite transição direta para a Etapa 5").
 *
 * A consequência de desenho é que `debate` mexe só no TETO, nunca no piso.
 * Se `debate` também subisse o piso, apertar "Pausar para Debate" empurraria
 * para a frente quem ainda estava auditando a máquina — a professora perderia
 * exatamente as crianças que o debate tenta alcançar.
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "briefing",
  "chat",
  "decisao",
  "manifesto",
  "percurso",
  "podcast",
  "fim",
] as const;

export type Passo = (typeof PASSOS)[number];

/**
 * Etapas da turma. `missao` é o normal; `debate` é o Checkpoint A ativo.
 *
 * Duas, não três: o roteiro do professor tem UM botão e o inverso dele
 * (`Pausar para Debate` / `Retomar Missão`). Um terceiro gate seria controle
 * morto no painel, e controle morto no meio de uma aula é pior que controle
 * nenhum (a mesma leitura que a exp-06 registrou).
 */
export const ETAPAS = ["missao", "debate"] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "missao";
export const PASSO_INICIAL: Passo = "briefing";

/** As ações do painel docente, e a etapa a que cada uma leva. */
export const ACOES_DO_GATE = ["pausar-para-debate", "retomar-missao"] as const;

export type AcaoDoGate = (typeof ACOES_DO_GATE)[number];

export const ETAPA_DA_ACAO: Record<AcaoDoGate, Etapa> = {
  "pausar-para-debate": "debate",
  "retomar-missao": "missao",
};

const ORDEM: Record<Passo, number> = PASSOS.reduce(
  (acc, passo, indice) => ({ ...acc, [passo]: indice }),
  {} as Record<Passo, number>,
);

/** Onde o congelamento começa: quem leu o manifesto é quem o debate alcança. */
const PRIMEIRO_CONGELADO: Passo = "manifesto";
/** E onde ele termina: quem já assinou não é mais alcançado. */
const ULTIMO_CONGELADO: Passo = "percurso";

/**
 * O Checkpoint A alcança ESTE estudante?
 *
 * É uma JANELA (`manifesto`..`percurso`), e não um teto, e a diferença foi
 * medida: com teto, quem estava exatamente em `manifesto` não era considerado
 * congelado — `passoEfetivo` devolvia o próprio passo, `aguardandoATurma` dava
 * `false`, e **o overlay de pausa não aparecia justamente para quem tinha
 * acabado de ler o documento**, que é quem o debate existe para reunir. A suíte
 * de Postgres pegou isso; o typecheck e os testes de regra pura, não.
 *
 * As duas bordas são regra de produto, não arredondamento:
 *
 * - **Antes de `manifesto` ninguém é tocado.** Pausar não empurra para a frente
 *   quem ainda audita a máquina — são justamente essas crianças que o debate
 *   tenta alcançar, e puxá-las para o documento as faria pular a auditoria.
 * - **Depois de `percurso` ninguém é tocado.** Quem já assinou terminou: o
 *   latch é do estudante, não da turma. Congelá-lo tiraria da tela um percurso
 *   que já está protocolado.
 */
export function congeladoParaDebate(passo: Passo, etapa: Etapa | null): boolean {
  if (etapa !== "debate") return false;
  return ORDEM[passo] >= ORDEM[PRIMEIRO_CONGELADO] && ORDEM[passo] <= ORDEM[ULTIMO_CONGELADO];
}

export function normalizarPasso(bruto: string | null | undefined): Passo {
  return (PASSOS as readonly string[]).includes(bruto ?? "")
    ? (bruto as Passo)
    : PASSO_INICIAL;
}

export function normalizarEtapa(bruta: string | null | undefined): Etapa {
  return (ETAPAS as readonly string[]).includes(bruta ?? "")
    ? (bruta as Etapa)
    : ETAPA_INICIAL;
}

/**
 * O passo que a tela deve mostrar, dado o passo do estudante e a etapa da
 * turma.
 *
 * Estudante SEM turma não tem gate: `etapa` nula devolve o passo dele intacto.
 * É o certo — sem sala não há quem aperte o botão, e prendê-lo num
 * congelamento que ninguém vai soltar seria um beco sem saída.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa | null): Passo {
  return congeladoParaDebate(passo, etapa) ? PRIMEIRO_CONGELADO : passo;
}

/**
 * A turma está segurando este estudante? É o que acende o overlay de pausa.
 *
 * É a MESMA condição do congelamento, e não `passoEfetivo !== passo` como era
 * antes: as duas divergiam exatamente no estudante parado em `manifesto`, e ele
 * é o caso mais comum do Checkpoint A.
 */
export function aguardandoATurma(passo: Passo, etapa: Etapa | null): boolean {
  return congeladoParaDebate(passo, etapa);
}

/** O passo seguinte, ou o próprio se já é o último. */
export function proximoPasso(passo: Passo): Passo {
  /* `?? passo` para o `noUncheckedIndexedAccess`: o `Math.min` já garante o
     índice dentro do array, mas o compilador não sabe disso — e um `!` aqui
     seria a asserção que esconde o dia em que `PASSOS` esvaziar. */
  return PASSOS[Math.min(ORDEM[passo] + 1, PASSOS.length - 1)] ?? passo;
}

/**
 * Avança o passo apenas para a FRENTE.
 *
 * A missão é uma escada de sentido único: um F5 na Etapa 5 não pode devolver a
 * criança ao briefing de Amara que ela já leu, e uma requisição fora de ordem
 * (duas abas, retry de rede) não pode puxar o passo para trás e reabrir uma
 * tela latch.
 */
export function avancarAte(atual: Passo, alvo: Passo): Passo {
  return ORDEM[alvo] > ORDEM[atual] ? alvo : atual;
}

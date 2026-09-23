/**
 * Os passos da exp05ef1b e a regra que reconcilia **a turma** com **o estudante**.
 *
 * Dois relógios, como na exp06ef2b, na exp07ef1b e na exp08ef4b:
 *
 * - `exp05ef1b_gates_turma.etapa` — o relógio da TURMA, que a professora controla
 *   pelo painel. São os dois botões mestres do PRD: "Iniciar revelação
 *   coletiva" e "Liberar reflexão final".
 * - `exp05ef1b_sessoes.passo` — a tela daquele estudante. Dentro do mesmo momento
 *   eles andam em ritmos diferentes: um ainda lê o áudio do Pedro enquanto o
 *   outro já confirmou o Mural e espera.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e o cliente precisam chegar à MESMA resposta. Duas
 * implementações divergentes seriam a tela discordando do servidor.
 *
 * **Três etapas, e a revelação é PISO e TETO ao mesmo tempo.** O PRD separa
 * "revelado" de "explicação" por um avanço docente a mais; aqui o card de
 * síntese entra junto da revelação, ao fim do Mural — um terceiro botão seria
 * controle morto no painel (a mesma leitura da exp06ef2b e da exp08ef4b).
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = ["contexto", "curadoria", "espera", "revelado", "reflexao", "fim"] as const;

export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que a professora as abre. */
export const ETAPAS = ["exploracao", "revelacao", "reflexao"] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "exploracao";
export const PASSO_INICIAL: Passo = "contexto";

/**
 * Onde cada etapa da turma coloca, no MÍNIMO, a tela do estudante.
 *
 * `revelacao` sobe o piso para `revelado` de propósito: quando o telão acende,
 * a janela da curadoria impulsiva acabou. Quem ainda não tinha confirmado vê o
 * próprio Mural com os selos — sem o carimbo de confirmação, e sem entrar na
 * conta da turma (`regras/curadoria.ts`). Deixá-lo continuar encaminhando com
 * o gabarito projetado na parede mediria outra coisa.
 *
 * `reflexao` NÃO empurra para `reflexao`: quem chega atrasado vê o Mural
 * revelado primeiro, e é dele que o botão para a reflexão sai. Pular direto
 * para a pergunta do tio seria responder sobre uma cena que a criança não viu.
 */
const PISO: Record<Etapa, Passo> = {
  exploracao: "contexto",
  revelacao: "revelado",
  reflexao: "revelado",
};

/**
 * Onde cada etapa coloca, no MÁXIMO.
 *
 * `exploracao` para em `espera`: confirmar o Mural é o latch, e a espera ativa
 * com Nina é o que faz a turma chegar junta à revelação. `revelacao` para em
 * `revelado`: o card de síntese está lá, e a reflexão é depois do debate.
 */
const TETO: Record<Etapa, Passo> = {
  exploracao: "espera",
  revelacao: "revelado",
  reflexao: "fim",
};

const ORDEM: Record<Passo, number> = Object.fromEntries(
  PASSOS.map((passo, indice) => [passo, indice]),
) as Record<Passo, number>;

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
 * mandaria a criança de volta à fala de Nina no meio da curadoria.
 */
export function normalizarPasso(valor: string | null | undefined): Passo {
  return valor && ehPasso(valor) ? valor : PASSO_INICIAL;
}

export function normalizarEtapa(valor: string | null | undefined): Etapa {
  return valor && ehEtapa(valor) ? valor : ETAPA_INICIAL;
}

/**
 * O passo que o estudante deve ver, dado o dele e a etapa da turma.
 *
 * 1. A etapa é PISO: quem está adiantado não é puxado para trás.
 * 2. A etapa é TETO: quem confirmou espera. É o que sincroniza.
 * 3. `fim` NÃO é revisitado: quem entregou a reflexão está em modo leitura, e
 *    uma volta de etapa (a professora reabre a exploração por engano) não o
 *    traz de novo para a pergunta. O latch é do estudante, não da turma.
 *
 * Estudante SEM TURMA não tem gate (`etapa === null`): a guarda de liberação já
 * o recusou antes de chegar aqui (sem sala não há missão), então o ramo existe
 * pela mesma razão das outras missões — um beco sem saída nunca pode nascer de
 * um `null` que ninguém previu.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa | null): Passo {
  if (passo === "fim") return "fim";
  if (etapa === null) return passo;

  const piso = PISO[etapa];
  const teto = TETO[etapa];

  if (ORDEM[passo] < ORDEM[piso]) return piso;
  if (ORDEM[passo] > ORDEM[teto]) return teto;
  return passo;
}

/**
 * O estudante está esperando a turma?
 *
 * `true` só quando a etapa o SEGURA (teto), nunca quando ela o empurra (piso):
 * ser levado adiante não é esperar.
 *
 * ARMADILHA DE LEITURA, e ela não é defeito: na `espera` depois do latch — o
 * momento em que a criança mais espera — isto é `false`. Quem confirmou está
 * EXATAMENTE no teto da exploração (`espera`), e não há nada para puxar de
 * volta. Quem desenha a tela de espera lê `passo === "espera"`, e é o que a
 * experiência faz; esta bandeira responde outra pergunta, "a turma me puxou
 * para trás?", e ela só é `true` depois de um `voltar-exploracao` (ou de uma
 * revelação ainda sem reflexão liberada), com o passo do estudante à frente do
 * teto da etapa. `quem-mandou-isso-regras.spec.ts` enumera os três pares.
 */
export function aguardandoATurma(passo: Passo, etapa: Etapa | null): boolean {
  const efetivo = passoEfetivo(passo, etapa);
  return efetivo !== passo && ORDEM[efetivo] < ORDEM[passo];
}

/**
 * Avança o passo apenas para a FRENTE.
 *
 * A missão é uma escada de sentido único: um F5 na Etapa 6 não pode devolver a
 * criança à fala de Nina que ela já leu, e uma requisição fora de ordem (duas
 * abas, retry de rede) não pode puxar o passo para trás e reabrir um latch.
 */
export function avancarAte(atual: Passo, alvo: Passo): Passo {
  return ORDEM[alvo] > ORDEM[atual] ? alvo : atual;
}

/** `a` vem antes de `b` na ordem das etapas? */
export function etapaAntesDe(a: Etapa, b: Etapa): boolean {
  return ETAPAS.indexOf(a) < ETAPAS.indexOf(b);
}

/**
 * As ações do painel da professora, e a etapa que cada uma abre.
 *
 * `voltar-exploracao` é o inverso dos dois botões, para quem revelou antes da
 * hora. Não é um "zerar": nada é apagado, os snapshots confirmados continuam
 * confirmados, e quem já entregou a reflexão fica em `fim`.
 */
export const ETAPA_DA_ACAO = {
  "iniciar-revelacao": "revelacao",
  "liberar-reflexao": "reflexao",
  "voltar-exploracao": "exploracao",
} as const satisfies Record<string, Etapa>;

export type AcaoDoGate = keyof typeof ETAPA_DA_ACAO;

export const ACOES_DO_GATE = Object.keys(ETAPA_DA_ACAO) as [AcaoDoGate, ...AcaoDoGate[]];

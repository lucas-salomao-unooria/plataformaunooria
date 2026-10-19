/**
 * Os passos da exp06ef1b e a regra que reconcilia A TURMA com O ESTUDANTE.
 *
 * Dois relógios, como nas outras missões de sala (exp04ef1b, exp07ef1b):
 *
 * - `exp06ef1b_gates_turma.etapa` — o relógio da TURMA. UM botão no painel:
 *   "Liberar Auditoria" (a Galeria Oculta).
 * - `exp06ef1b_sessoes.passo` — a tela daquele computador. Antes do voto cada
 *   um anda no seu ritmo; entre o voto e a galeria a turma espera junta (é o
 *   PICO: a lousa com a dispersão de votos); da galeria em diante, cada um anda
 *   sozinho de novo.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e a experiência precisam chegar à MESMA resposta num F5.
 *
 * O caminho de uma criança (PRD v2, §6.3, com o Canal A da ADR-174):
 *
 *   credencial → feed ──(voto, LATCH 1)──→ classificacao ──(separou)──→ lacrada
 *     → [professor libera a auditoria] → galeria
 *     ──(revisão do voto, LATCH 2)──→ revisada
 *     ──("Avançar", POST passo)──→ cadeia (a REGRA SE … ENTÃO) → mariana → fim
 *
 * `galeria` nunca é GRAVADO: a etapa da turma o impõe a quem está em `lacrada`.
 * `classificacao` é da criança, não da turma: com a galeria já liberada, ela
 * termina de separar e só então cai na galeria — a medida da EF06CO01 vem
 * ANTES da galeria, que mostra o que ficou fora por área.
 *
 * O passo `cadeia` guarda o nome (CHECKs e F5), mas desde a 0.6.0 é a tela da
 * regra. `enquetes` saiu do caminho (os cartões levam direto a `fim`) e só
 * existe para LER as sessões antigas que pararam ali.
 *
 * A RODADA DE DESVIO da 0.3.0 SAIU (melhoria 6 do PRD v2): a etapa `desvio`, o
 * passo `desvio` e as rotas dela. As colunas `desvio_*` ficam no banco, sem uso.
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "credencial",
  "feed",
  "classificacao",
  "lacrada",
  "galeria",
  "revisada",
  "cadeia",
  "mariana",
  "enquetes",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que o professor as abre. */
export const ETAPAS = ["exploracao", "galeria"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "exploracao";
export const PASSO_INICIAL: Passo = "credencial";

/** Os passos ANTES do voto: onde a criança ainda navega no feed. */
export const PASSOS_ANTES_DO_VOTO: readonly Passo[] = ["credencial", "feed"];

/**
 * Os passos que a própria criança pede, por `POST passo`: o `feed` (o toque em
 * "Acessar Feed da Mostra") e a `cadeia` (o "avançar" depois da revisão). Os
 * outros nascem das rotas que os carimbam: `classificacao` (o voto), `lacrada`
 * (a separação), `revisada` (a revisão), `mariana` (a regra) e `fim` (os
 * cartões; `concluir` só tira de `enquetes` as sessões antigas).
 */
export const PASSOS_PEDIDOS = ["feed", "cadeia"] as const;
export type PassoPedido = (typeof PASSOS_PEDIDOS)[number];

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

/** O CHECK da migração já restringe; o fallback existe porque o Prisma entrega `string`. */
export function normalizarPasso(valor: string | null | undefined): Passo {
  return valor && ehPasso(valor) ? valor : PASSO_INICIAL;
}

/** A etapa `desvio` das linhas antigas virou `galeria` na migração; o fallback cobre o resto. */
export function normalizarEtapa(valor: string | null | undefined): Etapa {
  return valor && ehEtapa(valor) ? valor : valor === "desvio" ? "galeria" : ETAPA_INICIAL;
}

export function passoAntes(a: Passo, b: Passo): boolean {
  return ORDEM[a] < ORDEM[b];
}

export function passoNoMinimo(passo: Passo, piso: Passo): boolean {
  return ORDEM[passo] >= ORDEM[piso];
}

export function etapaAntes(a: Etapa, b: Etapa): boolean {
  return ORDEM_DA_ETAPA[a] < ORDEM_DA_ETAPA[b];
}

/** Já votou? É o LATCH que põe a criança sob o relógio da turma. */
export function votou(passo: Passo): boolean {
  return !PASSOS_ANTES_DO_VOTO.includes(passo);
}

/**
 * O passo que o estudante deve ver, dado o dele e a etapa da turma.
 *
 * 1. Antes de votar, a etapa não o toca: com a galeria liberada, quem ainda
 *    navega continua navegando (o voto atrasado é caminho previsto).
 * 2. Em `lacrada`, a etapa manda: espera na exploração, galeria quando o
 *    professor libera.
 * 3. Da revisão em diante o passo é da criança, e nada o puxa de volta.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  if (passo === "lacrada" || passo === "galeria") return etapaAntes(etapa, "galeria") ? "lacrada" : "galeria";
  return passo;
}

/** O estudante espera o professor? Só na plenária (o PICO). */
export function aguardandoOProfessor(passo: Passo, etapa: Etapa): boolean {
  return passoEfetivo(passo, etapa) === "lacrada";
}

/** A etapa seguinte, ou `null` na última — é o rótulo do botão único do painel. */
export function proximaEtapa(atual: Etapa): Etapa | null {
  return ETAPAS[ORDEM_DA_ETAPA[atual] + 1] ?? null;
}

export type ResultadoDoGate = { ok: true; mudou: boolean } | { ok: false; codigo: "transicao-de-etapa-invalida" };

/**
 * A transição que o professor pede, pela etapa de DESTINO: a mesma é aceita e
 * não muda nada (o segundo clique, o retry da rede); a próxima anda uma;
 * voltar é recusado.
 */
export function transicaoDoGate(atual: Etapa, para: Etapa): ResultadoDoGate {
  if (para === atual) return { ok: true, mudou: false };
  if (proximaEtapa(atual) === para) return { ok: true, mudou: true };
  return { ok: false, codigo: "transicao-de-etapa-invalida" };
}

export type ResultadoDoPasso = { ok: true; passo: Passo } | { ok: false; codigo: "passo-invalido" };

/**
 * O passo que a criança PEDE, sobre o passo GRAVADO dela.
 *
 * - `feed`: da credencial para o feed. Pedir de novo no feed devolve o feed;
 *   depois do voto, devolve o passo em que ela está (a escada é de sentido
 *   único, e um F5 não pode reabrir a cédula).
 * - `cadeia`: de `revisada` para a cadeia (o "avançar" do PRD, §6.3). Já na
 *   cadeia ou adiante, devolve o passo dela; antes da revisão, recusado.
 */
export function pedirPasso(atual: Passo, para: PassoPedido): ResultadoDoPasso {
  if (para === "feed") {
    if (atual === "credencial" || atual === "feed") return { ok: true, passo: "feed" };
    return { ok: true, passo: atual };
  }
  if (atual === "revisada") return { ok: true, passo: "cadeia" };
  if (passoNoMinimo(atual, "cadeia")) return { ok: true, passo: atual };
  return { ok: false, codigo: "passo-invalido" };
}

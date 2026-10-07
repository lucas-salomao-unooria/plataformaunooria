/**
 * Os passos da exp06ef1b e a regra que reconcilia A TURMA com O ESTUDANTE.
 *
 * Dois relógios, como nas outras missões de sala (exp04ef1b, exp07ef1b):
 *
 * - `exp06ef1b_gates_turma.etapa` — o relógio da TURMA. UM botão no painel:
 *   "Liberar a Galeria Oculta".
 * - `exp06ef1b_sessoes.passo` — a tela daquele computador. Antes do voto cada
 *   um anda no seu ritmo; entre o voto e a galeria a turma espera junta (é o
 *   PICO: a lousa com a dispersão de votos); da galeria em diante, cada um anda
 *   sozinho de novo.
 *
 * `passoEfetivo` resolve os dois num só valor e mora aqui — puro e testável —
 * porque a api e a experiência precisam chegar à MESMA resposta num F5.
 *
 * O caminho de uma criança:
 *
 *   credencial → feed ──(voto, LATCH 1)──→ lacrada
 *     → [professor libera a galeria] → galeria
 *     ──(revisão do voto, LATCH 2)──→ revisada
 *     → [professor libera a rodada de desvio] → desvio
 *     ──(concluir o desvio)──→ cadeia → mariana → enquetes → fim
 *
 * `galeria` e `desvio` nunca são GRAVADOS: a etapa da turma os impõe a quem
 * está em `lacrada` e em `revisada`, as duas esperas. O passo gravado sai de
 * `lacrada` na revisão do voto (`revisada`) e de `revisada` quando a criança
 * conclui a rodada de desvio (`cadeia`).
 *
 * A RODADA DE DESVIO (2026-10-07, pedido do PO que a spec perdeu) é a segunda
 * espera de propósito: o professor a libera quando a turma terminou a galeria,
 * e ela vem ANTES da explicação (a cadeia), porque é a vivência que a explicação
 * nomeia.
 *
 * Até a 0.1.x havia um passo `pacotes` (a curtida remontada em pacotes, a
 * EF06CO07) entre a revisão e a cadeia. O PO o tirou com a habilidade
 * (2026-10-06): a migração `20261006120000_exp06ef1b_ajustes_do_po` moveu para
 * `cadeia` as sessões que estavam nele.
 */

/** Passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "credencial",
  "feed",
  "lacrada",
  "galeria",
  "revisada",
  "desvio",
  "cadeia",
  "mariana",
  "enquetes",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** Etapas da turma, na ordem em que o professor as abre. */
export const ETAPAS = ["exploracao", "galeria", "desvio"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_INICIAL: Etapa = "exploracao";
export const PASSO_INICIAL: Passo = "credencial";

/** Os passos ANTES do voto: onde a criança ainda navega no feed. */
export const PASSOS_ANTES_DO_VOTO: readonly Passo[] = ["credencial", "feed"];

/**
 * Os passos que a própria criança pede, por `POST passo`. Os outros nascem das
 * rotas que os carimbam: `lacrada` (o voto), `revisada` (a revisão), `cadeia`
 * (concluir o desvio), `mariana` (a cadeia), `enquetes` (os cartões), `fim`
 * (concluir).
 */
export const PASSOS_PEDIDOS = ["feed"] as const;
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

export function normalizarEtapa(valor: string | null | undefined): Etapa {
  return valor && ehEtapa(valor) ? valor : ETAPA_INICIAL;
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
 *    navega continua navegando (o voto atrasado é caminho previsto — ninguém
 *    abre a galeria de um feed que não terminou, e a taxa dele precisa do voto).
 * 2. Em `lacrada`, a etapa manda: espera na exploração, galeria quando o
 *    professor libera (e também com o desvio já liberado: quem votou atrasado
 *    passa pela galeria antes do desvio — a ordem da criança não pula etapa).
 * 3. Em `revisada`, de novo a etapa: espera até o professor liberar o desvio.
 * 4. Do desvio concluído em diante (`cadeia`...`fim`) o passo é da criança, e
 *    nada o puxa de volta. O gate nunca volta dentro de uma rodada — e quando a
 *    rodada muda (zerar, atividade nova) a sessão é outra.
 */
export function passoEfetivo(passo: Passo, etapa: Etapa): Passo {
  if (passo === "lacrada" || passo === "galeria") return etapaAntes(etapa, "galeria") ? "lacrada" : "galeria";
  if (passo === "revisada" || passo === "desvio") return etapa === "desvio" ? "desvio" : "revisada";
  return passo;
}

/** O estudante espera o professor? São as duas esperas: a plenária (o PICO) e a do desvio. */
export function aguardandoOProfessor(passo: Passo, etapa: Etapa): boolean {
  const efetivo = passoEfetivo(passo, etapa);
  return efetivo === "lacrada" || efetivo === "revisada";
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
 * - `feed`: da credencial para o feed (o toque em "Acessar o feed da mostra").
 *   Pedir de novo no feed devolve o feed; depois do voto, devolve o passo em
 *   que ela está (a escada é de sentido único, e um F5 não pode reabrir a
 *   cédula).
 */
export function pedirPasso(atual: Passo, para: PassoPedido): ResultadoDoPasso {
  if (para === "feed") {
    if (atual === "credencial" || atual === "feed") return { ok: true, passo: "feed" };
    return { ok: true, passo: atual };
  }
  return { ok: false, codigo: "passo-invalido" };
}

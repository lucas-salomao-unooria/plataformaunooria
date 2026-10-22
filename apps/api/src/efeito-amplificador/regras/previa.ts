import type { ConteudoDoPacote, Intencao, No, ParagrafoDoRascunho } from "../conteudo";

/**
 * A PRÉVIA DA PUBLICAÇÃO — o que o estudante deixou de cada parágrafo do
 * rascunho. Puro.
 *
 * Duas mãos mexem nela: o UnooriaAI, quando o estudante PEDE (a correção de um
 * nó, pelo chat), e o próprio estudante, que tira ou devolve um parágrafo na
 * prévia. "Editar livremente" o texto ficou de fora de propósito: o servidor
 * teria de ADIVINHAR se um texto qualquer ainda expõe o colega, e a régua da
 * evidência passaria a depender de uma heurística sobre texto livre de menor.
 */

export interface EstadoDoParagrafoNaPrevia {
  corrigido: boolean;
  removido: boolean;
}

export interface Previa {
  /** O UnooriaAI já mandou o rascunho? Antes disso a prévia está vazia. */
  gerada: boolean;
  /** O estudante perguntou a fonte da estatística (EM13CO14). */
  pediuFonte: boolean;
  /** A última fala do UnooriaAI ofereceu substituir o dado (um "sim" aceita). */
  ofertaDeSubstituicao: boolean;
  paragrafos: Record<string, EstadoDoParagrafoNaPrevia>;
}

export function previaVazia(rascunho: readonly ParagrafoDoRascunho[]): Previa {
  return {
    gerada: false,
    pediuFonte: false,
    ofertaDeSubstituicao: false,
    paragrafos: Object.fromEntries(rascunho.map((p) => [p.id, { corrigido: false, removido: false }])),
  };
}

/** Leitura defensiva do JSONB: linha de outra versão não derruba a tela. */
export function lerPrevia(bruto: unknown, rascunho: readonly ParagrafoDoRascunho[]): Previa {
  const base = previaVazia(rascunho);
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return base;
  const b = bruto as Record<string, unknown>;
  const paragrafos = (typeof b.paragrafos === "object" && b.paragrafos !== null ? b.paragrafos : {}) as Record<string, unknown>;
  for (const p of rascunho) {
    const e = paragrafos[p.id] as Record<string, unknown> | undefined;
    if (e) base.paragrafos[p.id] = { corrigido: e.corrigido === true, removido: e.removido === true };
  }
  return { ...base, gerada: b.gerada === true, pediuFonte: b.pediuFonte === true, ofertaDeSubstituicao: b.ofertaDeSubstituicao === true };
}

function paragrafoDoNo(rascunho: readonly ParagrafoDoRascunho[], no: No): ParagrafoDoRascunho | undefined {
  return rascunho.find((p) => p.no === no);
}

/** O nó está resolvido: o estudante pediu a correção OU tirou o parágrafo do post. */
export function noResolvido(previa: Previa, rascunho: readonly ParagrafoDoRascunho[], no: No): boolean {
  const p = paragrafoDoNo(rascunho, no);
  if (!p) return false;
  const e = previa.paragrafos[p.id];
  return Boolean(e && (e.corrigido || e.removido));
}

/** Os nós que uma intenção corrige. A fonte só PERGUNTA: quem corrige é a substituição. */
const NOS_DA_INTENCAO: Partial<Record<Intencao, readonly No[]>> = {
  substituir_dado: ["alucinacao"],
  auditar_lgpd: ["lgpd"],
  auditar_autoral: ["plagio"],
  revisao_geral: ["alucinacao", "plagio", "lgpd"],
};

export interface Efeito {
  previa: Previa;
  /** A intenção não mudou nada porque o nó já estava resolvido. */
  jaCorrigido: boolean;
}

/** Aplica uma intenção já classificada. Pressupõe a prévia GERADA (o serviço confere). */
export function aplicarIntencao(previa: Previa, rascunho: readonly ParagrafoDoRascunho[], intencao: Intencao): Efeito {
  const nova: Previa = {
    ...previa,
    ofertaDeSubstituicao: intencao === "auditar_fonte",
    paragrafos: Object.fromEntries(Object.entries(previa.paragrafos).map(([k, v]) => [k, { ...v }])),
  };
  if (intencao === "gerar_rascunho") nova.gerada = true;
  if (intencao === "auditar_fonte") nova.pediuFonte = true;
  const nos = NOS_DA_INTENCAO[intencao] ?? [];
  let mudou = false;
  for (const no of nos) {
    const p = paragrafoDoNo(rascunho, no);
    const e = p ? nova.paragrafos[p.id] : undefined;
    if (e && !e.corrigido && !e.removido) {
      e.corrigido = true;
      mudou = true;
    }
  }
  return { previa: nova, jaCorrigido: nos.length > 0 && !mudou };
}

/** Tirar ou devolver um parágrafo da prévia — a mão do estudante. */
export function alternarParagrafo(previa: Previa, paragrafoId: string, removido: boolean): Previa | null {
  const e = previa.paragrafos[paragrafoId];
  if (!e) return null;
  return { ...previa, paragrafos: { ...previa.paragrafos, [paragrafoId]: { ...e, removido } } };
}

/** O texto de cada parágrafo como está na prévia (o corrigido, se pedido). */
export function paragrafosVisiveis(previa: Previa, rascunho: readonly ParagrafoDoRascunho[]) {
  return rascunho.map((p) => {
    const e = previa.paragrafos[p.id] ?? { corrigido: false, removido: false };
    return {
      id: p.id,
      texto: e.corrigido && p.corrigido ? p.corrigido : p.texto,
      corrigido: e.corrigido,
      removido: e.removido,
    };
  });
}

/** O texto que vai ao feed: os parágrafos que ficaram, na ordem. */
export function textoPublicado(previa: Previa, rascunho: readonly ParagrafoDoRascunho[]): string {
  return paragrafosVisiveis(previa, rascunho)
    .filter((p) => !p.removido)
    .map((p) => p.texto)
    .join("\n\n");
}

/**
 * O TRECHO QUE O ALGORITMO PINÇA para o banner do feed — a virada. Sempre há
 * um: o incentivo é da rede, não do texto.
 *
 * 1. A estatística inventada, se ficou (o erro vira munição no feed — one-pager §7);
 * 2. senão, o RECORTE do pacote, se ele está no post (sobrevive à correção do plágio);
 * 3. senão, a manchete escolhida — que nenhum cuidado tira da capa.
 */
export function trechoPincado(
  previa: Previa,
  conteudo: Pick<ConteudoDoPacote, "rascunho" | "recorte">,
  manchete: string,
): string {
  const alucinacao = paragrafoDoNo(conteudo.rascunho, "alucinacao");
  if (alucinacao && !noResolvido(previa, conteudo.rascunho, "alucinacao")) return alucinacao.texto;
  const publicado = textoPublicado(previa, conteudo.rascunho).toLowerCase();
  if (conteudo.recorte && publicado.includes(conteudo.recorte.toLowerCase())) return conteudo.recorte;
  return manchete;
}

import type { ConteudoDoPacote, Intencao, No, ParagrafoDoRascunho } from "../conteudo";

/**
 * A PRÉVIA DO POST — o que o UnooriaAI já corrigiu em cada parágrafo do
 * rascunho, e se o estudante a aprovou. Puro.
 *
 * Só uma mão mexe nela: o UnooriaAI, quando o estudante PEDE (ADR-191). O
 * estudante não edita o texto nem tira parágrafo — a gaveta do protótipo só
 * aponta as pendências e aprova; o servidor teria de ADIVINHAR se um texto
 * livre ainda expõe o colega, e a régua dependeria de uma heurística sobre
 * texto de menor. Exportar NÃO é bloqueado por pendência (o dilema é do
 * estudante, e a régua o mede no Publicar).
 */

export interface EstadoDoParagrafoNaPrevia {
  corrigido: boolean;
  /** Só em sessões da 2.0.x, quando o estudante tirava parágrafos: lido para o histórico. */
  removido: boolean;
}

export interface Previa {
  /** O UnooriaAI já mandou o rascunho? Antes disso a prévia está vazia. */
  gerada: boolean;
  /** O estudante perguntou a fonte da estatística (EM13CO14). */
  pediuFonte: boolean;
  /** A última fala do UnooriaAI ofereceu atualizar o dado (um "sim" aceita). */
  ofertaDeSubstituicao: boolean;
  /** "Aprovar Prévia" (E2_PREVIA_APROVADA). Um ajuste pedido depois a reabre. */
  aprovada: boolean;
  paragrafos: Record<string, EstadoDoParagrafoNaPrevia>;
}

export function previaVazia(rascunho: readonly ParagrafoDoRascunho[]): Previa {
  return {
    gerada: false,
    pediuFonte: false,
    ofertaDeSubstituicao: false,
    aprovada: false,
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
  return {
    ...base,
    gerada: b.gerada === true,
    pediuFonte: b.pediuFonte === true,
    ofertaDeSubstituicao: b.ofertaDeSubstituicao === true,
    aprovada: b.aprovada === true,
  };
}

function paragrafoDoNo(rascunho: readonly ParagrafoDoRascunho[], no: No): ParagrafoDoRascunho | undefined {
  return rascunho.find((p) => p.no === no);
}

/** O nó está resolvido: o UnooriaAI o corrigiu (ou, numa sessão da 2.0.x, o estudante o tirou). */
export function noResolvido(previa: Previa, rascunho: readonly ParagrafoDoRascunho[], no: No): boolean {
  const p = paragrafoDoNo(rascunho, no);
  if (!p) return false;
  const e = previa.paragrafos[p.id];
  return Boolean(e && (e.corrigido || e.removido));
}

/** Os nós que uma intenção corrige. A fonte só PERGUNTA: quem corrige é o "sim" ou a revisão ampla. */
const NOS_DA_INTENCAO: Partial<Record<Intencao, readonly No[]>> = {
  substituir_dado: ["alucinacao"],
  auditar_direito_digital: ["plagio", "lgpd"],
  auditar_autoral: ["plagio"],
  auditar_lgpd: ["lgpd"],
  revisao_ampla: ["alucinacao", "plagio", "lgpd"],
};

export interface Efeito {
  previa: Previa;
  /** A intenção não mudou nada porque os nós dela já estavam resolvidos. */
  jaCorrigido: boolean;
}

/** Aplica uma intenção já classificada. Pressupõe a prévia GERADA (o serviço confere). */
export function aplicarIntencao(previa: Previa, rascunho: readonly ParagrafoDoRascunho[], intencao: Intencao): Efeito {
  const nova: Previa = {
    ...previa,
    ofertaDeSubstituicao: intencao === "auditar_fontes",
    paragrafos: Object.fromEntries(Object.entries(previa.paragrafos).map(([k, v]) => [k, { ...v }])),
  };
  if (intencao === "gerar_rascunho_inicial") nova.gerada = true;
  if (intencao === "auditar_fontes") nova.pediuFonte = true;
  if (intencao === "aprovar_previa") nova.aprovada = true;
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
  // "Solicita ajustes no chat" (PRD §6): a prévia aprovada que muda volta a ser rascunho.
  if (mudou) nova.aprovada = false;
  return { previa: nova, jaCorrigido: nos.length > 0 && !mudou };
}

/** "Aprovar Prévia" / "Solicitar revisão" — os dois botões da gaveta. */
export function marcarAprovacao(previa: Previa, aprovada: boolean): Previa {
  return { ...previa, aprovada, ofertaDeSubstituicao: false };
}

/** As pendências que a gaveta aponta (copy `e2.feedback.aviso_*`): cada nó ainda não corrigido. */
export function pendencias(previa: Previa, rascunho: readonly ParagrafoDoRascunho[]) {
  return {
    fonte: !noResolvido(previa, rascunho, "alucinacao"),
    autoria: !noResolvido(previa, rascunho, "plagio"),
    privacidade: !noResolvido(previa, rascunho, "lgpd"),
  };
}

/** O texto de cada parágrafo como está na prévia (o corrigido, se pedido). */
export function paragrafosVisiveis(previa: Previa, rascunho: readonly ParagrafoDoRascunho[]) {
  return rascunho
    .map((p) => {
      const e = previa.paragrafos[p.id] ?? { corrigido: false, removido: false };
      return { id: p.id, texto: e.corrigido && p.corrigido ? p.corrigido : p.texto, corrigido: e.corrigido, removido: e.removido };
    })
    .filter((p) => !p.removido)
    .map(({ id, texto, corrigido }) => ({ id, texto, corrigido }));
}

/** O texto que vai ao feed: os parágrafos da prévia, na ordem. */
export function textoPublicado(previa: Previa, rascunho: readonly ParagrafoDoRascunho[]): string {
  return paragrafosVisiveis(previa, rascunho)
    .map((p) => p.texto)
    .join("\n\n");
}

/**
 * O TRECHO QUE O ALGORITMO PINÇA para o feed — a virada. Sempre há um: o
 * incentivo é da rede, não do texto.
 *
 * 1. A estatística inventada, se ficou (o erro vira munição no feed);
 * 2. senão, o RECORTE do pacote, se ele está no post (a régua o obriga a
 *    sobreviver às correções);
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

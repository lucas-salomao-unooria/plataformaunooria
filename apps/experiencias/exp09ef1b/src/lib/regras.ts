import type { BlocoId, Criterio, Passo } from "./tipos";

/**
 * As regras PURAS da tela — o que a tela faz sozinha entre uma rota e outra
 * (mover um critério, pôr um bloco numa verificação) e o que ela decide
 * mostrar. Nada daqui MEDE: a régua é do servidor (regra 3). Testadas em
 * `regras.test.ts`.
 */

/** Move o item da posição `de` para a posição `para` (arrastar, ou Subir/Descer). Fora da faixa: igual. */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return [...lista];
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item as T);
  return nova;
}

/** O "Registrar Decisão" habilita com o projeto marcado e o ranking tocado ao menos uma vez (protótipo E3-ALU-01). */
export function podeRegistrar(projeto: string | null, rankingTocado: boolean): boolean {
  return projeto !== null && rankingTocado;
}

// ─────────────────────────────────────────── o Editor de Protocolo (E5)

export interface Editor {
  /** As três verificações; `null` = vazia. */
  slots: (BlocoId | null)[];
  descarte: BlocoId[];
}

export const EDITOR_VAZIO: Editor = { slots: [null, null, null], descarte: [] };

/** Tira o bloco de onde estiver (verificação ou descarte). */
function tirar(e: Editor, bloco: BlocoId): Editor {
  return { slots: e.slots.map((b) => (b === bloco ? null : b)), descarte: e.descarte.filter((b) => b !== bloco) };
}

/** Põe o bloco numa verificação. Se ela tinha outro, o outro volta ao banco. */
export function porNaVerificacao(e: Editor, bloco: BlocoId, vaga: number): Editor {
  const limpo = tirar(e, bloco);
  return { ...limpo, slots: limpo.slots.map((b, i) => (i === vaga ? bloco : b)) };
}

/** "Mover para Lixeira". */
export function descartar(e: Editor, bloco: BlocoId): Editor {
  const limpo = tirar(e, bloco);
  return { ...limpo, descarte: [...limpo.descarte, bloco] };
}

/** Devolve o bloco ao banco. */
export function devolver(e: Editor, bloco: BlocoId): Editor {
  return tirar(e, bloco);
}

/** "Subir"/"Descer" de um bloco já na esteira: troca de lugar com a verificação vizinha. */
export function moverNaEsteira(e: Editor, vaga: number, delta: -1 | 1): Editor {
  const alvo = vaga + delta;
  if (alvo < 0 || alvo >= e.slots.length) return e;
  const slots = [...e.slots];
  [slots[vaga], slots[alvo]] = [slots[alvo] ?? null, slots[vaga] ?? null];
  return { ...e, slots };
}

/** Os blocos que ainda estão no banco, na ordem embaralhada que o servidor mandou. */
export function noBanco(banco: readonly BlocoId[], e: Editor): BlocoId[] {
  return banco.filter((b) => !e.slots.includes(b) && !e.descarte.includes(b));
}

/** Sem trava no cliente (correção do PO de 29/10): ≥ 1 bloco na esteira e o "Enviar Proposta" acende. */
export function podeEnviar(e: Editor): boolean {
  return e.slots.some((b) => b !== null);
}

// ─────────────────────────────────────────── o OCR simulado (2 s: 0,8 + 1,2)

export const OCR_MS = { estagio1: 800, estagio2: 1200 } as const;

/** O nome da etapa da telemetria para cada passo (o contrato da spec). */
export function etapaDoPasso(passo: Passo): string {
  switch (passo) {
    case "abertura":
      return "E1";
    case "conversa":
      return "E2";
    case "espera1":
      return "E3_ESPERA";
    case "revelacao":
      return "E4";
    case "espera2":
      return "E4_ESPERA";
    case "explicar":
      return "E5";
    case "concluida":
      return "CONCLUIDA";
  }
}

/** A urgência acima da regularidade? Só para a tela dizer "Critério 1" — a régua é do servidor. */
export function primeiroCriterio(ranking: readonly Criterio[]): Criterio | null {
  return ranking[0] ?? null;
}

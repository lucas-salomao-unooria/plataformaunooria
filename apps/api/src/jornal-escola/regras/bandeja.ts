import { IDS_DE_BLOCO, type IdDeBloco } from "../vocabulario";

/**
 * A ORDEM DA BANDEJA da Chave — os seis blocos embaralhados POR SESSÃO, e
 * estáveis num F5.
 *
 * Por sessão, e não fixa, porque uma ordem fixa viraria dica na sala ("os três
 * primeiros"), e o colega de computador ao lado veria a mesma. Estável, e não
 * nova a cada leitura, porque a criança monta a Chave em vários toques: a
 * bandeja que se reordena depois de um F5 é a que parece ter perdido o bloco.
 *
 * Puro e determinístico: a semente é o id da sessão, o hash é FNV-1a de 32
 * bits, e o gerador é o mulberry32 — sem `Math.random`, então o teste compara.
 */

function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Os seis blocos na ordem da bandeja desta sessão (Fisher–Yates semeado). */
export function ordemDaBandeja(semente: string): IdDeBloco[] {
  const aleatorio = mulberry32(fnv1a(`exp04ef1b:bandeja:${semente}`));
  const ordem: IdDeBloco[] = [...IDS_DE_BLOCO];
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j] as IdDeBloco, ordem[i] as IdDeBloco];
  }
  return ordem;
}

/**
 * A ORDEM DOS DOIS CARTÕES de condição de um bloco nesta sessão (3.0.0,
 * ADR-168): `[0, 1]` ou `[1, 0]`, os índices canônicos do bloco. Embaralhada
 * pela mesma razão da bandeja — "o de cima aprova" seria dica —, e estável num F5.
 */
export function ordemDosCartoes(semente: string, bloco: IdDeBloco): [0 | 1, 0 | 1] {
  const aleatorio = mulberry32(fnv1a(`exp04ef1b:cartoes:${semente}:${bloco}`));
  return aleatorio() < 0.5 ? [0, 1] : [1, 0];
}

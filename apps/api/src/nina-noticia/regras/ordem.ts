import { createHash } from "node:crypto";

/**
 * Ids OPACOS e a ordem sorteada por SESSÃO — puros e determinísticos pela
 * semente (o id da sessão + a rodada): estáveis num F5, diferentes entre duas
 * crianças.
 *
 * O id não diz o que o item é. Para as reportagens (`rp-`) e as etiquetas
 * (`et-`) isso é higiene (o suporte e o rótulo estão à vista na tela); para os
 * BLOCOS da rotina (`bl-`) é o que segura o gabarito: um id `bl-1…bl-7` na
 * ordem certa entregaria a sequência a quem abre o DevTools.
 */

const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

export const PREFIXOS_OPACOS = ["rp", "et", "bl"] as const;
export type PrefixoOpaco = (typeof PREFIXOS_OPACOS)[number];

/** A forma de um id opaco: `rp-a1b`, `et-zz9`, `bl-0k3`. */
export const ID_OPACO_RE: Readonly<Record<PrefixoOpaco, RegExp>> = {
  rp: /^rp-[a-z0-9]{3}$/,
  et: /^et-[a-z0-9]{3}$/,
  bl: /^bl-[a-z0-9]{3}$/,
};

/**
 * `quantos` ids opacos e DIFERENTES, na ordem dos itens (o índice 0 é o item
 * 0). Colisão (1 em ~46 mil) é resolvida com outro sal.
 */
export function idsOpacos(semente: string, prefixo: PrefixoOpaco, quantos: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < quantos; i++) {
    for (let sal = 0; ; sal++) {
      const h = createHash("sha256").update(`${semente}:${prefixo}:${i}:${sal}`).digest();
      const id = `${prefixo}-${[0, 1, 2].map((k) => ALFABETO[(h[k] ?? 0) % ALFABETO.length]).join("")}`;
      if (!ids.includes(id)) {
        ids.push(id);
        break;
      }
    }
  }
  return ids;
}

/** Um gerador pseudoaleatório em [0, 1) pela semente (mulberry32 sobre o sha256). */
export function gerador(semente: string, rotulo: string): () => number {
  let a = createHash("sha256").update(`${semente}:${rotulo}`).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates com o gerador da sessão. Não muda a lista recebida. */
export function embaralhar<T>(lista: readonly T[], semente: string, rotulo: string): T[] {
  const copia = [...lista];
  const aleatorio = gerador(semente, rotulo);
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    const tmp = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = tmp;
  }
  return copia;
}

/** A semente de uma sessão numa rodada: o "Zerar" da professora sorteia tudo de novo. */
export function sementeDaSessao(sessaoId: string, rodada: number): string {
  return `${sessaoId}:r${rodada}`;
}

import { createHash } from "node:crypto";
import { embaralhar } from "./afunilamento";

/**
 * Ids OPACOS por sessão — puros e determinísticos pela semente. Servem às duas
 * tarefas da 0.6.0 (ADR-174): os estandes da separação (`cl-`) e as peças da
 * regra (`rg-`). (Os blocos da cadeia, `bl-`, saíram com ela; os pacotes da
 * curtida, `pk-`, com a EF06CO07.)
 *
 * O id não diz o que o item é: um id que dissesse a área (`proj-a3`) ou a peça
 * certa (`se-curtir`) entregaria a resposta a quem abre o DevTools. Estável num
 * F5, porque a semente é da sessão.
 */

const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

export type PrefixoOpaco = "cl" | "rg";

/**
 * `quantos` ids opacos e DIFERENTES, na ordem dos itens recebidos (o índice 0
 * é o item 0). Colisão (1 em ~46 mil) é resolvida com outro sal. `rotulo`
 * separa listas da mesma sessão que usam o mesmo prefixo.
 */
export function idsOpacos(semente: string, prefixo: PrefixoOpaco, quantos: number, rotulo = ""): string[] {
  const ids: string[] = [];
  for (let i = 0; i < quantos; i++) {
    for (let sal = 0; ; sal++) {
      const h = createHash("sha256").update(`${semente}:${prefixo}:${rotulo}:${i}:${sal}`).digest();
      const id = `${prefixo}-${[0, 1, 2].map((k) => ALFABETO[(h[k] ?? 0) % ALFABETO.length]).join("")}`;
      if (!ids.includes(id)) {
        ids.push(id);
        break;
      }
    }
  }
  return ids;
}

/**
 * Os itens com ids opacos, embaralhados pela semente: a posição na tela não
 * diz nada. Devolve o par (opaco → original) para quem corrige.
 */
export function opacosEmbaralhados<T>(
  itens: readonly T[],
  semente: string,
  prefixo: PrefixoOpaco,
  rotulo: string,
): { opaco: string; item: T }[] {
  const ids = idsOpacos(semente, prefixo, itens.length, rotulo);
  const pares = itens.map((item, i) => ({ opaco: ids[i] as string, item }));
  return embaralhar(pares, semente, `${prefixo}:${rotulo}`);
}

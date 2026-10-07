import { createHash } from "node:crypto";
import { BLOCOS_DA_CADEIA } from "../conteudo";
import { embaralhar } from "./afunilamento";

/**
 * Os blocos da cadeia (EF06CO03) como a SESSÃO os vê — puro e determinístico
 * pela semente. (Os pacotes da curtida, `pk-`, saíram com a EF06CO07.)
 *
 * A ordem certa é gabarito (regra 3), então duas coisas descem diferentes do
 * que está em `conteudo.ts`:
 *
 * 1. **O id é OPACO** (`bl-3fa`): sai da semente, não da posição. Um id que
 *    dissesse a posição (`bloco-2`) entregaria a resposta a
 *    quem abre o DevTools. Estável num F5, porque a semente é da sessão.
 * 2. **A ordem de chegada NUNCA coincide com a certa**: o embaralhamento que
 *    cai na ordem certa é refeito com outro rótulo. Chegar já montado seria uma
 *    tentativa grátis, e a régua das tentativas mediria sorte.
 */

const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * `quantos` ids opacos e DIFERENTES, na ordem do item certo (o índice 0 é o
 * bloco 1). Colisão (1 em ~46 mil) é resolvida com outro sal.
 */
export function idsOpacos(semente: string, prefixo: "bl", quantos: number): string[] {
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

/**
 * Embaralha pela semente garantindo que o resultado NÃO é a ordem recebida (a
 * certa). Oito rótulos cobrem o caso com folga (a chance de coincidir é 1/24
 * por tentativa); a rotação final é a garantia matemática, nunca o caminho.
 */
export function embaralharForaDeOrdem<T>(certa: readonly T[], semente: string, rotulo: string): T[] {
  if (certa.length < 2) return [...certa];
  for (let k = 0; k < 8; k++) {
    const r = embaralhar(certa, semente, k === 0 ? rotulo : `${rotulo}:${k}`);
    if (r.some((x, i) => x !== certa[i])) return r;
  }
  return [...certa.slice(1), certa[0] as T];
}

export type BlocoDaSessao = { id: string; rotulo: string };

/** Os quatro blocos da cadeia, embaralhados por esta sessão. */
export function blocosDaSessao(semente: string): BlocoDaSessao[] {
  const ids = idsOpacos(semente, "bl", BLOCOS_DA_CADEIA.length);
  const certos = BLOCOS_DA_CADEIA.map((b, i) => ({ id: ids[i] as string, rotulo: b.rotulo }));
  return embaralharForaDeOrdem(certos, semente, "cadeia");
}

/** A cadeia certa: Interações → Dados → Algoritmo → Bolha, em ids opacos. */
export function ordemCertaDaCadeia(semente: string): string[] {
  return idsOpacos(semente, "bl", BLOCOS_DA_CADEIA.length);
}

/** A ordem montada é exatamente a certa? A resposta é só sim ou não: nunca qual vaga errou. */
export function ordemConfere(enviada: readonly string[], certa: readonly string[]): boolean {
  return enviada.length === certa.length && enviada.every((id, i) => id === certa[i]);
}

/** Todos os ids enviados são desta sessão? Id de outra sessão é corpo inválido, não tentativa. */
export function idsDaSessao(enviada: readonly string[], certa: readonly string[]): boolean {
  const conhecidos = new Set(certa);
  return enviada.every((id) => conhecidos.has(id));
}

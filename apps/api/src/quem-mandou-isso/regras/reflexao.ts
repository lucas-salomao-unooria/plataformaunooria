import { ENTAO_MAX_CARACTERES, ENTAO_MIN_CARACTERES } from "../catalogo";
import { normalizar } from "./pacote";

/**
 * O `Então` do construtor Se/Então (Etapa 6): o único texto livre da missão, e
 * escrito por menor de idade.
 *
 * O servidor NÃO corrige a regra (decisão do Lucas: o professor lê e ajusta a
 * EF05CO04 pelo painel da E14 — a evidência dela vem da P2). O que ele recusa
 * é o que não é resposta: curto demais, longo demais, ou texto sem sentido
 * digitado só para passar do piso (RF-013: "aaaa…", "12345…").
 */

export type ProblemaDoEntao = "entao-curto" | "entao-longo" | "entao-sem-sentido";

/** Proporção máxima de UM caractere entre os não-espaço: "kkkkkkkkkkkkkkkk", "aaaaaaaaaaaaaaab". */
const MAX_DE_UM_CARACTERE = 0.4;
/** Proporção máxima de dígitos: "123456789012345", "vou 1234567890123". */
const MAX_DE_DIGITOS = 0.4;
/** Mínimo de LETRAS DIFERENTES: "abcabcabcabcabc" tem três, "asasasasasasasas", duas. */
const MIN_DE_LETRAS_DIFERENTES = 5;
/** Mínimo de vogais entre as letras: "asdfghjklasdfghjkl" (o teclado amassado) tem 11%. */
const MIN_DE_VOGAIS = 0.2;

/**
 * TEXTO SEM SENTIDO? Quatro sinais simples, cada um com o caso que o motivou —
 * e todos longe o bastante de um texto real para não barrar uma criança de 10
 * anos que escreve curto, com gíria ou com "kkk":
 *
 *   - um caractere domina (> 40% dos não-espaço) — repetição;
 *   - dígitos dominam (> 40%) — sequência numérica;
 *   - menos de 5 letras diferentes — pouca variedade;
 *   - menos de 20% de vogais entre as letras — teclado amassado.
 *
 * Um texto em português tem a letra mais comum perto de 15% e vogais perto de
 * 45%: os limiares são folgados de propósito. Recusar uma resposta de verdade
 * custa mais que aceitar uma fraca — a fraca o professor vê no painel.
 */
export function textoSemSentido(texto: string): boolean {
  const semEspaco = normalizar(texto).replace(/\s+/g, "");
  if (semEspaco.length === 0) return true;

  const contagem = new Map<string, number>();
  for (const c of semEspaco) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  const maisComum = Math.max(...contagem.values());
  if (maisComum / semEspaco.length > MAX_DE_UM_CARACTERE) return true;

  const digitos = (semEspaco.match(/[0-9]/g) ?? []).length;
  if (digitos / semEspaco.length > MAX_DE_DIGITOS) return true;

  const letras = semEspaco.match(/[a-z]/g) ?? [];
  if (new Set(letras).size < MIN_DE_LETRAS_DIFERENTES) return true;

  const vogais = letras.filter((l) => "aeiou".includes(l)).length;
  return vogais / letras.length < MIN_DE_VOGAIS;
}

/**
 * Valida o `Então` e devolve o texto como ele é gravado: com `trim` e sem
 * espaço repetido. O piso e o teto valem DEPOIS do `trim` — quinze espaços não
 * são uma regra, e contariam como entregue no painel.
 */
export function validarEntao(
  bruto: string,
): { ok: true; texto: string } | { ok: false; codigo: ProblemaDoEntao } {
  const texto = bruto.replace(/\s+/g, " ").trim();
  if (texto.length < ENTAO_MIN_CARACTERES) return { ok: false, codigo: "entao-curto" };
  if (texto.length > ENTAO_MAX_CARACTERES) return { ok: false, codigo: "entao-longo" };
  if (textoSemSentido(texto)) return { ok: false, codigo: "entao-sem-sentido" };
  return { ok: true, texto };
}

import { FICHAS_TESTE } from "../conteudo";
import { BLOCOS, SEQUENCIA_CERTA, type Bloco, type MarcaDaRotina } from "../vocabulario";
import { embaralhar, idsOpacos } from "./ordem";

/**
 * A ROTINA (E5-ALU-01, EF03CO02): sete blocos, embaralhados por sessão e com
 * ids opacos (`bl-xxx`), que a dupla monta na esteira. Válida = a sequência
 * EXATA de `SEQUENCIA_CERTA` (ENQUANTO, Pegar, SE, ok, SENÃO, revisar, FIM);
 * qualquer outra ordem completa é a rotina que "não para" (E5-SIS-01) e conta
 * uma tentativa.
 *
 * Por que só a exata: os sete blocos são DISTINTOS e a esteira tem as sete
 * vagas com indentação fixa (ENQUANTO > Pegar, SE > ok, SENÃO > revisar, FIM),
 * então a única montagem que respeita o laço e a condição é essa — trocar `ok`
 * e `revisar` inverte a regra, tirar o FIM do fim é a repetição sem parada.
 */

export type BlocoDaSessao = { id: string; bloco: Bloco };

/** A ordem da bandeja é a CERTA? (O embaralhamento nunca a entrega pronta.) */
export function ehASequenciaCerta(blocos: readonly Bloco[]): boolean {
  return blocos.length === SEQUENCIA_CERTA.length && blocos.every((b, i) => b === SEQUENCIA_CERTA[i]);
}

/**
 * Os sete blocos da sessão, na ordem da BANDEJA: ids opacos e ordem sorteada
 * pela semente, GARANTIDO que a ordem não é a certa (re-sorteia com outro
 * rótulo; nas sementes que insistirem, gira uma posição). Estável num F5. O
 * service grava a ordem em `rotina_ordem_bandeja` para auditoria.
 */
export function bandejaDaSessao(semente: string): BlocoDaSessao[] {
  const ids = idsOpacos(semente, "bl", BLOCOS.length);
  const itens = BLOCOS.map((bloco, i) => ({ id: ids[i] as string, bloco }));
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const ordem = embaralhar(itens, semente, `bandeja:${tentativa}`);
    if (!ehASequenciaCerta(ordem.map((i) => i.bloco))) return ordem;
  }
  const [primeiro, ...resto] = itens;
  return [...resto, primeiro as BlocoDaSessao];
}

export type ResultadoDaRotina =
  | { ok: true; valida: boolean; blocos: Bloco[] }
  | { ok: false; codigo: "rotina-incompleta" | "bloco-desconhecido" };

/**
 * Confere a sequência montada (ids da sessão, na ordem da esteira). Id que a
 * sessão não tem ou repetido é `bloco-desconhecido`; menos de sete é
 * `rotina-incompleta` — nenhum dos dois conta tentativa (o botão "Testar
 * Rotina" só acende com a esteira cheia).
 */
export function corrigirRotina(semente: string, sequencia: readonly string[]): ResultadoDaRotina {
  const porId = new Map(bandejaDaSessao(semente).map((b) => [b.id, b.bloco]));
  const blocos: Bloco[] = [];
  for (const id of sequencia) {
    const bloco = porId.get(id);
    if (!bloco || blocos.includes(bloco)) return { ok: false, codigo: "bloco-desconhecido" };
    blocos.push(bloco);
  }
  if (blocos.length !== BLOCOS.length) return { ok: false, codigo: "rotina-incompleta" };
  return { ok: true, valida: ehASequenciaCerta(blocos), blocos };
}

export type PassoDaSimulacao = { manchete: string; marca: MarcaDaRotina; pendentes: number };

/**
 * A SIMULAÇÃO da rotina válida (o contador 3 → 0): ficha a ficha, `ok` se o
 * campo Onde tem ícone, `revisar` se está vazio — o Clube de Xadrez recebe a
 * bandeira. Só desce depois de uma rotina válida.
 */
export function simularRotina(): PassoDaSimulacao[] {
  return FICHAS_TESTE.map((f, i) => ({
    manchete: f.manchete,
    marca: f.ficha.onde !== null ? "ok" : "revisar",
    pendentes: FICHAS_TESTE.length - i - 1,
  }));
}

import type { Nivel } from "../../evidencias/regras";
import { PECAS_DO_ENTAO, PECAS_DO_SE, type PecaDaRegra } from "../conteudo";
import type { Area } from "../vocabulario";
import { areaEmFoco, type EstadoDoFeed } from "./afunilamento";
import { opacosEmbaralhados } from "./ordem";

/**
 * A REGRA SE … ENTÃO (EF06CO03, ADR-174): depois da revisão do voto, a criança
 * monta a instrução que o programa do feed executou — uma condição e uma ação,
 * cada uma entre três peças. Uma tentativa só: o nível é o que ela sabia ANTES
 * de ver a regra certa, que vem logo depois, ligada ao feed DELA.
 *
 * Puro. As peças descem com id OPACO (`rg-xxx`), embaralhadas pela semente; a
 * peça certa só existe aqui.
 */

export type PecaPublica = { id: string; texto: string };

export type PecasDaSessao = {
  se: { opaco: string; peca: PecaDaRegra }[];
  entao: { opaco: string; peca: PecaDaRegra }[];
};

/** As seis peças desta sessão, com ids opacos e embaralhadas (a certa não é sempre a primeira). */
export function pecasDaSessao(semente: string): PecasDaSessao {
  const lado = (pecas: readonly PecaDaRegra[], rotulo: string) =>
    opacosEmbaralhados(pecas, semente, "rg", rotulo).map((p) => ({ opaco: p.opaco, peca: p.item }));
  return { se: lado(PECAS_DO_SE, "se"), entao: lado(PECAS_DO_ENTAO, "entao") };
}

/** O que desce para a tela: id opaco e texto, nunca `certa`. */
export function pecasPublicas(pecas: PecasDaSessao): { se: PecaPublica[]; entao: PecaPublica[] } {
  const publica = (p: { opaco: string; peca: PecaDaRegra }) => ({ id: p.opaco, texto: p.peca.texto });
  return { se: pecas.se.map(publica), entao: pecas.entao.map(publica) };
}

export type EscolhaDaRegra = { se: string; entao: string };

/**
 * Corrige a regra: quais dos dois lados estão certos. `null` quando um id não
 * é desta sessão (ou do lado errado) — corpo inválido (400), nunca "errou".
 */
export function corrigirRegra(
  pecas: PecasDaSessao,
  escolha: EscolhaDaRegra,
): { se: PecaDaRegra; entao: PecaDaRegra; acertos: number } | null {
  const se = pecas.se.find((p) => p.opaco === escolha.se)?.peca;
  const entao = pecas.entao.find((p) => p.opaco === escolha.entao)?.peca;
  if (!se || !entao) return null;
  return { se, entao, acertos: Number(se.certa) + Number(entao.certa) };
}

/** **EF06CO03**: as duas peças certas = atingiu; uma = em processo; nenhuma = não atingiu. Chute: 1 em 9 atinge. */
export function nivelDaRegra(acertos: number): Nivel {
  if (acertos >= 2) return "atingiu";
  if (acertos === 1) return "em_processo";
  return "nao_atingiu";
}

/** Os ids opacos das peças certas — a revelação, que só desce DEPOIS do envio. */
export function pecasCertas(pecas: PecasDaSessao): EscolhaDaRegra {
  const certa = (lado: PecasDaSessao["se"]) => lado.find((p) => p.peca.certa)?.opaco ?? "";
  return { se: certa(pecas.se), entao: certa(pecas.entao) };
}

/**
 * O que a regra fez NO FEED DESTA CRIANÇA, para a tela da revelação ligar a
 * regra certa ao que ela viveu (o tom pedido pelo time pedagógico em 02/10:
 * uma recomendação que PODE deixar o feed menos variado, não uma bolha
 * inevitável):
 *
 * - `curtidas`: com curtida, o feed puxou para a área em foco;
 * - `permanencia`: sem curtida, o tempo parado elegeu a área (o motor pesa a
 *   permanência — a regra é simples, o programa de verdade olha mais coisas);
 * - `variado`: nada puxou, e o feed seguiu variado — a regra não disparou.
 *
 * Lê o motor no servidor; o motor continua sem descer.
 */
export type MotivoDaRegra = "curtidas" | "permanencia" | "variado";

export function revelacaoDaRegra(feed: EstadoDoFeed): { motivo: MotivoDaRegra; area: Area | null } {
  const foco = areaEmFoco(feed);
  if (!foco) return { motivo: "variado", area: null };
  return { motivo: feed.curtidos.length > 0 ? "curtidas" : "permanencia", area: foco };
}

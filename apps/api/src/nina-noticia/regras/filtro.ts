import type { Ficha } from "../conteudo";
import { LUGAR_DO_EVENTO, VALORES_DO_FILTRO, type Campo, type Suporte } from "../vocabulario";

/**
 * A BUSCA do Unoojornal (E3-ALU-01) — booleana, por CAMPO da ficha, sobre o
 * pacote. É o modelo que a missão ensina (EF15CO08): o filtro consulta a
 * gaveta do campo, não a foto. Por isso o telão, com Onde VAZIO, não aparece
 * em "Onde: Pátio" mesmo mostrando o pátio.
 *
 * Os valores de Quem e Quando oferecidos na tela (`VALORES_DO_FILTRO`) não são
 * os da feira, então toda busca fora de Onde = Pátio devolve ZERO de forma
 * honesta (decisão 8 da spec): a dupla fica na E3 e tenta de novo, e a tentativa
 * conta em `filtro_tentativas`.
 */

export type ReportagemComFicha = { suporte: Suporte; ficha: Ficha };

/** O valor pertence à pastilha daquele campo? (O Zod do contrato repete a regra.) */
export function valorDoCampo(campo: Campo, valor: string): boolean {
  return (VALORES_DO_FILTRO[campo] as readonly string[]).includes(valor);
}

/** As reportagens cuja ficha tem `campo = valor`, na ordem do pacote. Campo vazio nunca casa. */
export function buscar(reportagens: readonly ReportagemComFicha[], campo: Campo, valor: string): Suporte[] {
  return reportagens.filter((r) => r.ficha[campo] !== null && r.ficha[campo] === valor).map((r) => r.suporte);
}

/** A busca que a E3 pede: o LOCAL do evento. Só ela leva à omissão. */
export function ehABuscaDoLocal(campo: Campo, valor: string): boolean {
  return campo === "onde" && valor === LUGAR_DO_EVENTO;
}

export type ResultadoDoFiltro = {
  encontradas: Suporte[];
  /** A busca foi a do local (Onde = Pátio): o passo vai a `omissao`. */
  resolveu: boolean;
  /** A tentativa entra em `filtro_tentativas` (só as anteriores à certa). */
  contaComoTentativa: boolean;
};

export function aplicarFiltro(
  reportagens: readonly ReportagemComFicha[],
  campo: Campo,
  valor: string,
): ResultadoDoFiltro {
  const resolveu = ehABuscaDoLocal(campo, valor);
  return { encontradas: buscar(reportagens, campo, valor), resolveu, contaComoTentativa: !resolveu };
}

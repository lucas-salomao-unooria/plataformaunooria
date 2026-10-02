import {
  ligadoPorPadrao,
  partesDoRecurso,
  recursoDaExperiencia,
  recursoDoProduto,
  type Produto,
} from "./catalogo";

/**
 * A CADEIA DE PRECEDÊNCIA da disponibilidade — puro, sem banco.
 *
 * Duas regras, e as duas são decisão de produto (ADR-87):
 *
 *   1. O ESCOPO MAIS ESPECÍFICO GANHA: escola → regional → contrato → padrão.
 *   2. O PRODUTO É UM TETO: produto desligado no escopo que vale ⇒ nada dentro
 *      dele liga, mesmo com linha própria dizendo `ligado`.
 *
 * A alternativa da regra 2 — deixar a experiência sobrepor o produto — foi
 * descartada porque faz "desliguei o Entre Redes para a rede" não significar o
 * que diz: o operador teria de caçar exceções antes de confiar na tela. Na
 * interface isso aparece como o interruptor da experiência DESABILITADO com o
 * motivo ao lado (`tetoDoProduto`), nunca sumindo — controle que desaparece
 * parece defeito.
 *
 * O PADRÃO É LIGADO, e isto é o CONTRÁRIO de `liberacoes` de propósito. Lá a
 * ausência de linha é o bloqueio ("o mundo nasce fechado de graça"); aqui a
 * ausência é o mundo normal, porque este interruptor é mecanismo de EXCEÇÃO
 * (não foi contratado, ou quebrou no deploy) e não de liberação. Nascer
 * desligado exigiria uma linha por recurso a cada contrato provisionado, e toda
 * experiência nova ficaria invisível até alguém lembrar de ligá-la — a falha
 * silenciosa que o painel existe para eliminar.
 */

/** Uma linha de `disponibilidades`, como ela sai do banco. */
export interface LinhaDeDisponibilidade {
  recursoId: string;
  /** `null` = o CONTRATO inteiro (a stack). Preenchido = uma linha de `escolas`,
   *  que pode ser `tipo='escola'` OU `tipo='regional'`. */
  escolaId: string | null;
  ligado: boolean;
  /** Só faz sentido em `experiencia:*` (CHECK na migration). */
  versaoFixa: string | null;
  motivo: string | null;
}

/**
 * Do mais específico ao menos: `["esc-7", "regional-3"]`. O contrato é sempre o
 * último e NÃO entra na lista — ele é o `escolaId: null`, e representá-lo aqui
 * como `null` faria o laço ter de distinguir "fim da cadeia" de "escopo nulo".
 *
 * Vazia = a pergunta é do próprio contrato (o token de `admin`/`gestor_contrato`
 * não tem escola).
 */
export type CadeiaDeEscopos = readonly string[];

export interface Efetivo {
  ligado: boolean;
  /** A versão que vale aqui. `null` = segue `experiencias.versao_ativa`. */
  versaoFixa: string | null;
  /**
   * Onde a decisão foi tomada: id da escola/regional, `null` para o contrato, e
   * `undefined` quando NINGUÉM decidiu e valeu o padrão do código.
   *
   * Os três estados existem porque a tela precisa dos três: "ligado aqui",
   * "herdado de lá" e "ninguém mexeu" são coisas diferentes, e sem distingui-las
   * é impossível desfazer uma exceção — um interruptor de dois estados faz
   * "ligado na escola" parecer idêntico a "herdado ligado".
   */
  decididoEm?: string | null;
  /** `true` quando quem desligou foi o TETO do produto, não a experiência. */
  tetoDoProduto?: boolean;
  motivo?: string | null;
}

/** A linha que vale para um recurso, subindo a cadeia. `null` = ninguém decidiu. */
function maisEspecifica(
  linhas: readonly LinhaDeDisponibilidade[],
  recursoId: string,
  cadeia: CadeiaDeEscopos,
): LinhaDeDisponibilidade | null {
  for (const escopo of cadeia) {
    const daqui = linhas.find((l) => l.recursoId === recursoId && l.escolaId === escopo);
    if (daqui) return daqui;
  }
  return linhas.find((l) => l.recursoId === recursoId && l.escolaId === null) ?? null;
}

/**
 * A LINHA INTEIRA É A DECISÃO — `ligado` e `versaoFixa` não se resolvem em
 * cadeias separadas.
 *
 * Resolver campo por campo daria mais flexibilidade ("desligado na escola, mas
 * herdando a versão do contrato") e produziria estados que ninguém consegue
 * explicar olhando a tela: a linha que o operador gravou deixaria de ser o que
 * está valendo. Aqui a linha da escola É a decisão daquela escola, e a tela
 * mostra exatamente a linha que vale.
 */
export function resolverProduto(
  linhas: readonly LinhaDeDisponibilidade[],
  produto: Produto,
  cadeia: CadeiaDeEscopos = [],
): Efetivo {
  const linha = maisEspecifica(linhas, recursoDoProduto(produto), cadeia);
  /* Ninguém decidiu: vale o padrão do produto — ligado, salvo os que estão em
     teste interno (`PRODUTOS_DESLIGADOS_POR_PADRAO`). */
  if (!linha) return { ligado: ligadoPorPadrao(produto), versaoFixa: null };
  return {
    ligado: linha.ligado,
    versaoFixa: null,
    decididoEm: linha.escolaId,
    motivo: linha.motivo,
  };
}

/**
 * A disponibilidade de uma experiência, já com o teto do produto aplicado.
 *
 * `produto` vem de `experiencias.produto` (o manifesto declara). `null` ali é
 * experiência sem produto — não é erro: é uma linha antiga, de antes da coluna,
 * e ela responde só pelo próprio interruptor. O teste dos manifestos é que
 * impede uma experiência NOVA de nascer assim.
 */
export function resolverExperiencia(
  linhas: readonly LinhaDeDisponibilidade[],
  expId: string,
  produto: Produto | null,
  cadeia: CadeiaDeEscopos = [],
): Efetivo {
  if (produto) {
    const teto = resolverProduto(linhas, produto, cadeia);
    if (!teto.ligado) {
      return {
        ligado: false,
        versaoFixa: null,
        decididoEm: teto.decididoEm,
        tetoDoProduto: true,
        motivo: teto.motivo,
      };
    }
  }

  const linha = maisEspecifica(linhas, recursoDaExperiencia(expId), cadeia);
  if (!linha) return { ligado: true, versaoFixa: null };
  return {
    ligado: linha.ligado,
    versaoFixa: linha.versaoFixa,
    decididoEm: linha.escolaId,
    motivo: linha.motivo,
  };
}

/**
 * Descarta linha com `recurso_id` fora do vocabulário.
 *
 * Não é paranoia: o CHECK só vale para o que entra DEPOIS dele, e um id escrito
 * à mão em SQL durante um incidente é o caso real. Linha ilegível tratada como
 * "não decidido" é o único jeito de ela não mudar resposta nenhuma — o
 * contrário seria o resolvedor dependendo da ordem do `findMany`.
 */
export function linhasLegiveis(
  linhas: readonly LinhaDeDisponibilidade[],
): LinhaDeDisponibilidade[] {
  return linhas.filter((l) => partesDoRecurso(l.recursoId) !== null);
}

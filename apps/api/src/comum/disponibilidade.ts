import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ProdutoSchema, type Produto } from "../recursos/catalogo";
import {
  linhasLegiveis,
  resolverExperiencia,
  resolverProduto,
  type Efetivo,
  type LinhaDeDisponibilidade,
} from "../recursos/regras";

/**
 * O INTERRUPTOR DA REDE: este recurso existe nesta rede? (ADR-87)
 *
 * TERCEIRO eixo, e o nome é próprio para não se confundir com os outros dois:
 * o catálogo (`experiencias`) diz que FORMA a experiência tem; a liberação
 * (`liberacoes`, ADR-69) diz se ela está aberta NAQUELA TURMA; esta diz se ela
 * EXISTE NESTA REDE. Disponibilidade é PRÉ-CONDIÇÃO de liberação.
 *
 * Molde de `liberacao.ts` de propósito — funções livres recebendo `tx`, e não
 * um serviço injetado: quem precisa disto está DENTRO de uma transação de
 * tenancy, e um serviço obrigaria a passar o `tx` por construtor ou a abrir uma
 * segunda transação.
 *
 * SEM CACHE, e isto é decisão. São duas idas ao banco (a escola e as linhas
 * que valem), as duas por índice, numa tabela de dezenas de linhas — e a regra
 * da casa é não acrescentar estado sem gargalo medido. O gatilho para
 * reavaliar: latência medida em `GET /salas/minhas` ou na home do professor,
 * que são as duas superfícies que resolvem isto a cada render.
 */

/** O código que o cliente vê. Estável: é por ele que a tela e o log decidem. */
export const RECURSO_INDISPONIVEL = "recurso-indisponivel";

/**
 * A cadeia de escopos de uma escola, do mais específico ao menos:
 * `[escola, regional]`. O CONTRATO não entra na lista — ele é a linha com
 * `escola_id` nulo, e representá-lo aqui obrigaria o laço do resolvedor a
 * distinguir "fim da cadeia" de "escopo nulo".
 *
 * Só um nível acima: a hierarquia do produto é rede \seta regional \seta escola,
 * e `escolas.pai_id` de uma unidade aponta para a regional dela (CHECK da
 * ADR-79). Subir recursivamente cobriria uma árvore que este produto não tem.
 */
export async function cadeiaDaEscola(
  tx: Prisma.TransactionClient,
  escolaId: string,
): Promise<string[]> {
  const escola = await tx.escola.findUnique({
    where: { id: escolaId },
    select: { paiId: true },
  });
  return escola?.paiId ? [escolaId, escola.paiId] : [escolaId];
}

/** As linhas que podem valer nesta cadeia: o contrato mais cada nível dela. */
async function linhasDoEscopo(
  tx: Prisma.TransactionClient,
  cadeia: readonly string[],
): Promise<LinhaDeDisponibilidade[]> {
  const linhas = await tx.disponibilidade.findMany({
    where: { OR: [{ escolaId: null }, { escolaId: { in: [...cadeia] } }] },
    select: { recursoId: true, escolaId: true, ligado: true, versaoFixa: true, motivo: true },
  });
  return linhasLegiveis(linhas);
}

/**
 * `experiencias.produto` é `TEXT` no banco, e o resolvedor quer o vocabulário.
 * Valor fora dele (linha escrita à mão antes do CHECK) vira `null` — a
 * experiência responde só pelo próprio interruptor, sem teto. Tratar como erro
 * faria uma linha velha derrubar a missão inteira.
 */
function produtoConhecido(valor: string | null | undefined): Produto | null {
  const lido = ProdutoSchema.safeParse(valor);
  return lido.success ? lido.data : null;
}

/**
 * TODO o catálogo de uma vez — é o que a grade da sala precisa, e é por isso que
 * existe além da função de uma só: resolver experiência por experiência faria a
 * grade de uma turma ir ao banco duas vezes por missão.
 */
export async function disponibilidadeDoCatalogo(
  tx: Prisma.TransactionClient,
  escolaId: string,
  experiencias: ReadonlyArray<{ expId: string; produto: string | null }>,
): Promise<Map<string, Efetivo>> {
  const cadeia = await cadeiaDaEscola(tx, escolaId);
  const linhas = await linhasDoEscopo(tx, cadeia);
  return new Map(
    experiencias.map((e) => [
      e.expId,
      resolverExperiencia(linhas, e.expId, produtoConhecido(e.produto), cadeia),
    ]),
  );
}

/** A disponibilidade de um PRODUTO nesta escola — o que monta os cards do hub. */
export async function disponibilidadeDoProduto(
  tx: Prisma.TransactionClient,
  escolaId: string,
  produto: Produto,
): Promise<Efetivo> {
  const cadeia = await cadeiaDaEscola(tx, escolaId);
  const linhas = await linhasDoEscopo(tx, cadeia);
  return resolverProduto(linhas, produto, cadeia);
}

/** A mensagem das ferramentas de PROFESSOR: sem disfarce a proteger, ela diz o que houve. */
const INDISPONIVEL_PARA_A_REDE = "Este recurso não está disponível para a sua rede.";

/**
 * Recusa a entrada quando o PRODUTO está desligado nesta escola — a porta do
 * produto SEM experiência (`agente-professor`), que não tem linha em
 * `experiencias` para o `exigirRecursoDisponivel` resolver.
 *
 * Mesma cadeia (escola → regional → contrato → padrão) e mesma regra de
 * ausência de linha = LIGADO, porque é o MESMO resolvedor
 * (`disponibilidadeDoProduto` → `resolverProduto`). Uma segunda leitura da
 * tabela, com regra própria, seria o painel dizendo "desligado" e a porta
 * abrindo.
 */
export async function exigirProdutoDisponivel(
  tx: Prisma.TransactionClient,
  escolaId: string,
  produto: Produto,
): Promise<void> {
  const efetivo = await disponibilidadeDoProduto(tx, escolaId, produto);
  if (efetivo.ligado) return;
  throw new ForbiddenException({ codigo: RECURSO_INDISPONIVEL, mensagem: INDISPONIVEL_PARA_A_REDE });
}

/**
 * Recusa a entrada quando o recurso não está disponível nesta rede.
 *
 * A MENSAGEM DO ESTUDANTE É A MESMA de `missao-nao-liberada`, e isso é
 * deliberado: quem lê é uma criança dentro de um app disfarçado, onde
 * "este produto foi desativado para a sua rede" quebra a ficção que a
 * experiência está medindo. Quem distingue os dois casos é o `codigo` — que é o
 * que o log e a tela leem, e é por ele que se diagnostica.
 *
 * A ferramenta de PROFESSOR não tem disfarce a proteger, então ali a mensagem
 * pode dizer o que aconteceu.
 *
 * SEM LINHA em `experiencias` não tranca nada: numa stack de dev ou nova, antes
 * do primeiro publish do CI, aquela tabela está VAZIA — e o hub já sabe cair no
 * `experiencia.json` do bundle nesse caso. Recusar aqui faria TODA missão morrer
 * num ambiente recém-provisionado, com um 403 que não explica nada.
 */
export async function exigirRecursoDisponivel(
  tx: Prisma.TransactionClient,
  escolaId: string,
  expId: string,
): Promise<void> {
  const experiencia = await tx.experiencia.findUnique({
    where: { expId },
    select: { produto: true, publico: true },
  });

  const cadeia = await cadeiaDaEscola(tx, escolaId);
  const linhas = await linhasDoEscopo(tx, cadeia);
  const efetivo = resolverExperiencia(
    linhas,
    expId,
    produtoConhecido(experiencia?.produto),
    cadeia,
  );
  if (efetivo.ligado) return;

  throw new ForbiddenException({
    codigo: RECURSO_INDISPONIVEL,
    mensagem:
      experiencia?.publico === "professor" ? INDISPONIVEL_PARA_A_REDE : "Esta missão não está aberta agora.",
  });
}

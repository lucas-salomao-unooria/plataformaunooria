import type { Prisma } from "@prisma/client";
import type { EquipeDoMapa } from "./regras";

/**
 * AS LEITURAS DAS EQUIPES que outros módulos fazem — o painel do UnooTube, o do
 * unooGPT, a sala do professor.
 *
 * Molde de `comum/liberacao.ts` de propósito: funções livres recebendo `tx`, e
 * não um provider injetado. Quem precisa disto já está DENTRO de uma transação
 * de tenancy, e um serviço obrigaria a passar o `tx` por construtor ou a abrir
 * uma segunda transação — e cada módulo de experiência teria de importar o
 * `EquipesModule`, uma dependência que, esquecida, falha em silêncio.
 *
 * ARMADILHA: as três tabelas têm RLS. Fora de `comTenancy` tudo aqui volta
 * VAZIO, em silêncio — e o painel voltaria a contar por criança sem ninguém
 * saber por quê.
 */

/** Uma equipe com os membros e a posição dela na montagem. */
export type EquipeDaMissao = EquipeDoMapa & { ordem: number };

/**
 * Só quem AINDA É estudante da turma entra como membro.
 *
 * A linha de `equipes_membros` não some quando a criança muda de turma (ela não
 * foi apagada, só se mudou), e sem este filtro a tela do professor mostraria na
 * equipe alguém que nem está mais na sala — e o `PUT` seguinte, devolvendo a
 * mesma equipe, seria recusado por "alguém que não é desta turma". A fonte é
 * `users.turma_id`, a MESMA dos painéis de missão (o `resultadosDaTurma` da
 * exp04ef1b):
 * `users` está fora da RLS, então o `escolaId` aqui é a tranca, não redundância.
 */
function membrosAtuais(escolaId: string, turmaId: string) {
  return {
    where: { escolaId, estudante: { escolaId, turmaId, role: "estudante" } },
    select: { estudante: { select: { id: true, displayName: true } } },
    orderBy: { estudante: { displayName: "asc" } },
  } satisfies Prisma.Equipe$membrosArgs;
}

async function carregarEquipes(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  where: Prisma.EquipeWhereInput,
): Promise<EquipeDaMissao[]> {
  const linhas = await tx.equipe.findMany({
    where: { ...where, escolaId, turmaId },
    select: { id: true, nome: true, ordem: true, membros: membrosAtuais(escolaId, turmaId) },
    orderBy: { ordem: "asc" },
  });
  return linhas.map((e) => ({
    id: e.id,
    nome: e.nome,
    ordem: e.ordem,
    membros: e.membros.map((m) => ({ id: m.estudante.id, nome: m.estudante.displayName })),
  }));
}

/** As equipes de uma missão nesta turma, na ordem da montagem. */
export function equipesDaMissao(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
): Promise<EquipeDaMissao[]> {
  return carregarEquipes(tx, escolaId, turmaId, { expId });
}

/**
 * ESTUDANTE → EQUIPE, para a missão nesta turma. É o que
 * `regras.ts#colapsarEmUnidades` recebe para contar o painel por computador.
 *
 * Quem não está no mapa não tem equipe — e é contado sozinho, que é o certo:
 * sem montagem, o painel continua exatamente como era antes das equipes.
 */
export async function mapaDeEquipes(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
): Promise<Map<string, EquipeDoMapa>> {
  const equipes = await equipesDaMissao(tx, escolaId, turmaId, expId);
  const mapa = new Map<string, EquipeDoMapa>();
  for (const { id, nome, membros } of equipes) {
    const equipe: EquipeDoMapa = { id, nome, membros };
    for (const m of membros) mapa.set(m.id, equipe);
  }
  return mapa;
}

/** A equipe deste estudante nesta missão e turma, ou `null`. */
export async function equipeDoEstudante(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
  estudanteId: string,
): Promise<EquipeDoMapa | null> {
  const linha = await tx.equipeMembro.findFirst({
    where: { escolaId, turmaId, expId, estudanteId },
    select: { equipeId: true },
  });
  if (!linha) return null;
  const [equipe] = await carregarEquipes(tx, escolaId, turmaId, { id: linha.equipeId, expId });
  return equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros } : null;
}

/**
 * Quantos computadores a montagem desta missão diz que a sala tem, ou `null`
 * sem montagem. É o que a evidência pedagógica (E14) lê para saber se uma
 * equipe é a PROJEÇÃO — um computador só, a turma inteira diante do telão.
 */
export async function computadoresDaMontagem(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
): Promise<number | null> {
  const montagem = await tx.equipesMontagem.findUnique({
    where: { escolaId_turmaId_expId: { escolaId, turmaId, expId } },
    select: { computadores: true },
  });
  return montagem?.computadores ?? null;
}

/**
 * Quantas equipes cada missão tem nesta turma — o número que a grade da sala
 * mostra ao lado da missão. Um `groupBy`, e não uma consulta por missão: a
 * grade tem dezenas delas, e é lida a cada abertura da sala.
 */
export async function contarEquipesDaTurma(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
): Promise<Map<string, number>> {
  const grupos = await tx.equipe.groupBy({
    by: ["expId"],
    where: { escolaId, turmaId },
    _count: { _all: true },
  });
  return new Map(grupos.map((g) => [g.expId, g._count._all]));
}

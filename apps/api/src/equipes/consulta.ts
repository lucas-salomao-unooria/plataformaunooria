import type { Prisma } from "@prisma/client";
import { atividadeEmAndamento } from "./atividades";
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
 *
 * TODA leitura é de UMA ATIVIDADE (ADR-130): a equipe é da atividade, e o
 * painel que pergunta já sabe qual está lendo (o `coberturaId` do gate, o
 * `pacoteId` da sessão). A missão sem atividade passa `ATIVIDADE_DA_TURMA`.
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

/** As equipes de uma atividade nesta turma, na ordem da montagem. */
export function equipesDaMissao(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
  atividadeId: string,
): Promise<EquipeDaMissao[]> {
  return carregarEquipes(tx, escolaId, turmaId, { expId, atividadeId });
}

/**
 * ESTUDANTE → EQUIPE, para a atividade nesta turma. É o que
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
  atividadeId: string,
): Promise<Map<string, EquipeDoMapa>> {
  const equipes = await equipesDaMissao(tx, escolaId, turmaId, expId, atividadeId);
  const mapa = new Map<string, EquipeDoMapa>();
  for (const { id, nome, membros } of equipes) {
    const equipe: EquipeDoMapa = { id, nome, membros };
    for (const m of membros) mapa.set(m.id, equipe);
  }
  return mapa;
}

/** A equipe deste estudante nesta atividade e turma, ou `null`. */
export async function equipeDoEstudante(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
  atividadeId: string,
  estudanteId: string,
): Promise<EquipeDoMapa | null> {
  const linha = await tx.equipeMembro.findFirst({
    where: { escolaId, turmaId, expId, atividadeId, estudanteId },
    select: { equipeId: true },
  });
  if (!linha) return null;
  const [equipe] = await carregarEquipes(tx, escolaId, turmaId, { id: linha.equipeId, expId, atividadeId });
  return equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros } : null;
}

/**
 * Quantos computadores a montagem desta atividade diz que a sala tem, ou
 * `null` sem montagem — e também no modo `individual`, em que o número não é
 * dito (são tantos quantas crianças): quem lê volta a contar por criança, como
 * sem montagem. É o que a evidência pedagógica (E14) lê para saber se uma
 * equipe é a PROJEÇÃO — um computador só, a turma inteira diante do telão.
 */
export async function computadoresDaMontagem(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
  atividadeId: string,
): Promise<number | null> {
  const montagem = await tx.equipesMontagem.findUnique({
    where: { escolaId_turmaId_expId_atividadeId: { escolaId, turmaId, expId, atividadeId } },
    select: { computadores: true },
  });
  return montagem?.computadores ?? null;
}

/**
 * Quantas equipes cada missão tem nesta turma — o número que a grade da sala
 * mostra ao lado da missão. Conta a atividade EM ANDAMENTO de cada missão
 * (ADR-130): a sala responde "a aula de hoje está pronta?", e a montagem de
 * uma atividade que o professor ainda não pôs no ar não é a de hoje.
 *
 * Um `groupBy` só, e não uma consulta de equipes por missão: a grade tem
 * dezenas delas e é lida a cada abertura da sala. A atividade em andamento é
 * perguntada só às missões que TÊM montagem na turma — as poucas do `groupBy`.
 */
export async function contarEquipesDaTurma(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
): Promise<Map<string, number>> {
  const grupos = await tx.equipe.groupBy({
    by: ["expId", "atividadeId"],
    where: { escolaId, turmaId },
    _count: { _all: true },
  });
  const missoes = [...new Set(grupos.map((g) => g.expId))];
  const emAndamento = new Map(
    await Promise.all(
      missoes.map(async (expId) => [expId, await atividadeEmAndamento(tx, escolaId, turmaId, expId)] as const),
    ),
  );
  const contagem = new Map<string, number>();
  for (const g of grupos) {
    if (emAndamento.get(g.expId) === g.atividadeId) contagem.set(g.expId, g._count._all);
  }
  return contagem;
}

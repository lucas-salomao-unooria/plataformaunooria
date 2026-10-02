import type { Prisma } from "@prisma/client";
import { ORDEM_DA_ATIVIDADE_DO_ESTUDANTE, ondeAAtividadeVale } from "../motor/guardas";
import { ATIVIDADE_DA_TURMA, temAtividades, type EXPERIENCIAS_COM_ATIVIDADE } from "./regras";

/**
 * QUAL ATIVIDADE ESTÁ EM ANDAMENTO NA TURMA, e se uma atividade é desta turma —
 * as duas perguntas que a montagem por atividade (ADR-130) faz à missão.
 *
 * A atividade é da MISSÃO (a cobertura da exp07ef1b, o pacote da exp04ef1b, da
 * exp05ef1b e da exp06ef1b, a `activity` da exp08ef1b), e este é o único lugar do módulo de
 * equipes que lê as tabelas delas. Leitura direta, e não um registro que cada
 * módulo de missão preenche na subida: o registro esquecido falharia MUDO (a
 * faixa da equipe sumindo da tela do aluno sem erro nenhum), e este `Record` é
 * exaustivo — missão nova em `EXPERIENCIAS_COM_ATIVIDADE` sem fonte aqui não
 * compila.
 *
 * "Em andamento" é a que o PROFESSOR escolheu na lista de atividades: criar não
 * coloca no ar. Uma por turma, e nenhuma quando ele ainda não escolheu.
 *
 * ARMADILHA: as tabelas das missões têm RLS. Fora de `comTenancy`, tudo aqui
 * volta `null`/`false`, em silêncio.
 */
type ExperienciaComAtividade = (typeof EXPERIENCIAS_COM_ATIVIDADE)[number];

interface FonteDeAtividades {
  emAndamento(tx: Prisma.TransactionClient, escolaId: string, turmaId: string): Promise<string | null>;
  daTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, atividadeId: string): Promise<boolean>;
}

/** O id da cobertura e do pacote é UUID: um texto qualquer no `where` seria 500 do Postgres. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FONTES: Record<ExperienciaComAtividade, FonteDeAtividades> = {
  exp07ef1b: {
    async emAndamento(tx, escolaId, turmaId) {
      const ativa = await tx.exp07ef1bCobertura.findFirst({
        where: { escolaId, turmaId, ativa: true },
        select: { id: true },
      });
      return ativa?.id ?? null;
    },
    async daTurma(tx, escolaId, turmaId, atividadeId) {
      if (!UUID_RE.test(atividadeId)) return false;
      return (await tx.exp07ef1bCobertura.count({ where: { id: atividadeId, escolaId, turmaId } })) > 0;
    },
  },
  exp04ef1b: {
    async emAndamento(tx, escolaId, turmaId) {
      const ativo = await tx.exp04ef1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true },
      });
      return ativo?.id ?? null;
    },
    async daTurma(tx, escolaId, turmaId, atividadeId) {
      if (!UUID_RE.test(atividadeId)) return false;
      return (await tx.exp04ef1bPacote.count({ where: { id: atividadeId, escolaId, turmaId } })) > 0;
    },
  },
  exp06ef1b: {
    async emAndamento(tx, escolaId, turmaId) {
      const ativo = await tx.exp06ef1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true },
      });
      return ativo?.id ?? null;
    },
    async daTurma(tx, escolaId, turmaId, atividadeId) {
      if (!UUID_RE.test(atividadeId)) return false;
      return (await tx.exp06ef1bPacote.count({ where: { id: atividadeId, escolaId, turmaId } })) > 0;
    },
  },
  exp05ef1b: {
    async emAndamento(tx, escolaId, turmaId) {
      const ativo = await tx.exp05ef1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true },
      });
      return ativo?.id ?? null;
    },
    /* O RASCUNHO (`aprovado_em` nulo) ainda não é atividade: é a curadoria em
       andamento, e some quando o professor gera outro. */
    async daTurma(tx, escolaId, turmaId, atividadeId) {
      if (!UUID_RE.test(atividadeId)) return false;
      return (
        (await tx.exp05ef1bPacote.count({
          where: { id: atividadeId, escolaId, turmaId, aprovadoEm: { not: null } },
        })) > 0
      );
    },
  },
  /* O Instanooria escolhe a atividade da criança pela regra do motor — a mesma
     de `POST /runs` e do `boot`. A atividade antiga SEM turma vale para a escola
     inteira, e por isso é "desta turma" também: a montagem dela é por turma. */
  exp08ef1b: {
    async emAndamento(tx, escolaId, turmaId) {
      const ativa = await tx.activity.findFirst({
        where: ondeAAtividadeVale(escolaId, turmaId),
        orderBy: ORDEM_DA_ATIVIDADE_DO_ESTUDANTE,
        select: { id: true },
      });
      return ativa?.id ?? null;
    },
    async daTurma(tx, escolaId, turmaId, atividadeId) {
      if (!UUID_RE.test(atividadeId)) return false;
      return (
        (await tx.activity.count({
          where: { id: atividadeId, escolaId, OR: [{ turmaId }, { turmaId: null }] },
        })) > 0
      );
    },
  },
};

/**
 * A atividade em andamento da missão nesta turma, ou `null`. A missão SEM
 * atividade responde o fixo `turma`: a montagem dela é uma só por turma.
 */
export async function atividadeEmAndamento(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
): Promise<string | null> {
  if (!temAtividades(expId)) return ATIVIDADE_DA_TURMA;
  return FONTES[expId as ExperienciaComAtividade].emAndamento(tx, escolaId, turmaId);
}

/** A atividade existe, e é desta turma? A missão sem atividade só aceita o fixo `turma`. */
export async function atividadeDaTurma(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  expId: string,
  atividadeId: string,
): Promise<boolean> {
  if (!temAtividades(expId)) return atividadeId === ATIVIDADE_DA_TURMA;
  return FONTES[expId as ExperienciaComAtividade].daTurma(tx, escolaId, turmaId, atividadeId);
}

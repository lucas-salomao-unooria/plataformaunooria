import "server-only";
import { apiDoServidor } from "./api-servidor";

/**
 * A SALA DE AULA no hub (ADR-69): o que a api responde em `/salas/*`.
 *
 * O contrato é o Zod de `apps/api/src/salas/contrato-de-rotas.ts`; estes tipos
 * são a leitura dele do lado do hub, como `unootube-tipos.ts` e `eco-tipos.ts`.
 */

/** `bloqueada` não é estado do banco — é a ausência de linha em `liberacoes`. */
export type EstadoDaMissao = "liberada" | "encerrada" | "bloqueada";

export interface TurmaDaSala {
  id: string;
  nome: string;
  serie: string;
  turno: string | null;
  /** regular | componente — o mesmo estudante pode cursar as duas em paralelo. */
  tipo: string;
  periodo: string;
}

export interface MissaoNaGrade {
  expId: string;
  nome: string;
  estado: EstadoDaMissao;
  transversal: boolean;
  deOutraSerie: boolean;
}

export interface SalaDoEstudante {
  turma: TurmaDaSala;
  missoes: MissaoNaGrade[];
}

export interface MissaoDaSalaDoProfessor extends MissaoNaGrade {
  liberadaPor: string | null;
  liberadaEm: string | null;
  encerradaEm: string | null;
}

export interface SalaDoProfessor {
  turma: TurmaDaSala & { estudantes: number };
  missoes: MissaoDaSalaDoProfessor[];
}

/**
 * As salas do estudante logado.
 *
 * `null` (api fora do ar) e `[]` (sem turma) são coisas DIFERENTES na tela: a
 * primeira é falha e a segunda é "você ainda não está enturmado". Por isso o
 * retorno preserva o `null` em vez de virar lista vazia.
 */
export async function minhasSalas(): Promise<SalaDoEstudante[] | null> {
  const resposta = await apiDoServidor<{ salas: SalaDoEstudante[] }>("/salas/minhas");
  return resposta?.salas ?? null;
}

export async function salaDaTurma(turmaId: string, todas = false): Promise<SalaDoProfessor | null> {
  const query = todas ? "?todas=1" : "";
  return apiDoServidor<SalaDoProfessor>(`/salas/turma/${encodeURIComponent(turmaId)}${query}`);
}

/** A missão está aberta para entrar? É a mesma pergunta que a api faz na porta. */
export function podeEntrar(estado: EstadoDaMissao): boolean {
  return estado === "liberada";
}

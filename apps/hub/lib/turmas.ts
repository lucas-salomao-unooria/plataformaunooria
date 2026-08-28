import "server-only";
import { apiDoServidor } from "./api-servidor";

/**
 * As turmas de quem está pedindo. Para o professor são as turmas em que ele tem
 * MATRÍCULA — o vínculo que passou a existir com o enturmamento; para gestor e
 * admin-contrato, a escola inteira.
 */
export interface TurmaDoProfessor {
  id: string;
  nome: string;
  serie: string;
  turno: string | null;
  tipo: string;
  periodo: string | null;
  alunos: number;
  professores: number;
}

export interface PessoaDaTurma {
  matriculaId: string;
  id: string;
  nome: string;
  usuario: string;
  matricula: string | null;
  ativo: boolean;
  senhaProvisoria: boolean;
}

export interface TurmaComPessoas {
  turma: { id: string; nome: string; serie: string; turno: string | null; periodo: string };
  alunos: PessoaDaTurma[];
  professores: PessoaDaTurma[];
}

export async function minhasTurmas(): Promise<TurmaDoProfessor[]> {
  return (await apiDoServidor<TurmaDoProfessor[]>("/turmas/minhas")) ?? [];
}

export async function turmaComPessoas(turmaId: string): Promise<TurmaComPessoas | null> {
  return apiDoServidor<TurmaComPessoas>(`/turmas/${turmaId}`);
}

const TURNOS: Record<string, string> = {
  manha: "manhã",
  tarde: "tarde",
  noite: "noite",
  integral: "integral",
};

export function rotuloDoTurno(turno: string | null): string | null {
  return turno ? (TURNOS[turno] ?? turno) : null;
}

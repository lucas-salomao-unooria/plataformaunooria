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
  estudantes: number;
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
  estudantes: PessoaDaTurma[];
  professores: PessoaDaTurma[];
}

export async function minhasTurmas(): Promise<TurmaDoProfessor[]> {
  return (await apiDoServidor<TurmaDoProfessor[]>("/turmas/minhas")) ?? [];
}

export async function turmaComPessoas(turmaId: string): Promise<TurmaComPessoas | null> {
  return apiDoServidor<TurmaComPessoas>(`/turmas/${turmaId}`);
}

/**
 * A turma que a FICHA da missão está conduzindo (ADR-100), vinda do `?turmaId=`
 * com que a sala de aula chama.
 *
 * Resolve pela lista de turmas DO PROFESSOR, e não por `GET /turmas/:id`, por
 * dois motivos: é uma resposta pequena que as telas do professor já pedem, e um
 * id de turma alheia simplesmente não está nela — então a ficha não tem como
 * nomear na tela uma turma que não é dele. `null` quando não veio turma, quando
 * o id não é dele, ou quando a api não respondeu: nos três casos a ficha abre
 * como sempre abriu, sem contexto de turma, e nada nela mente.
 */
export async function turmaDaConducao(
  turmaId: string | undefined,
): Promise<TurmaDoProfessor | null> {
  const id = turmaId?.trim();
  if (!id) return null;
  return (await minhasTurmas()).find((turma) => turma.id === id) ?? null;
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

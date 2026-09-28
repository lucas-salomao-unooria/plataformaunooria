/**
 * Shapes de LEITURA do UnooTube — exatamente o que a api devolve em
 * `GET /unootube/turmas` e `GET /unootube/turmas/:turmaId/resultados`
 * (`apps/api/src/unootube/unootube.service.ts`). Datas chegam como string.
 *
 * Uma linha é UM COMPUTADOR (E13): sem equipes, o estudante; com equipes, a
 * linha de quem entrou, com `equipe` preenchida (`lib/equipe-no-painel.ts`).
 */
import type { EquipeNoPainel } from "./equipe-no-painel";

export interface TurmaResumo {
  id: string;
  nome: string;
  serie: string;
  estudantes: number;
}

export interface LinhaEstudanteUnootube {
  estudanteId: string;
  nome: string;
  usuario: string;
  iniciou: boolean;
  salvos: number;
  fontesConfiaveis: number;
  inscritos: number;
  rankingDesbloqueado: boolean;
  credibilidadeAdicionada: boolean;
  concluidoEm: string | null;
  /** `null` = sem equipe nesta missão. Com equipe, os campos acima são de quem entrou. */
  equipe: EquipeNoPainel | null;
}


export interface ResumoTurmaUnootube {
  total: number;
  iniciaram: number;
  desbloquearamRanking: number;
  concluiram: number;
  /** Só entre os que concluíram. */
  distribuicaoFontes: Record<"0" | "1" | "2" | "3", number>;
  mediaFontesConcluidos: number | null;
  /** A turma tem equipes nesta missão: os números contam computadores, não estudantes. */
  porComputador: boolean;
}

export interface ResultadosDaTurma {
  turma: { id: string; nome: string; serie: string };
  estudantes: LinhaEstudanteUnootube[];
  resumo: ResumoTurmaUnootube;
}

/** "—" ou `dd/mm hh:mm` no fuso do navegador/servidor que formata. */
export function formatarQuando(iso: string | null, agora: Date = new Date()): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  const dd = String(data.getDate()).padStart(2, "0");
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const hh = String(data.getHours()).padStart(2, "0");
  const mi = String(data.getMinutes()).padStart(2, "0");
  const ano = data.getFullYear() === agora.getFullYear() ? "" : `/${data.getFullYear()}`;
  return `${dd}/${mm}${ano} ${hh}:${mi}`;
}

/** Situação legível de uma linha — usada na tabela e nos testes. */
export function situacaoDoEstudante(l: Pick<LinhaEstudanteUnootube, "iniciou" | "credibilidadeAdicionada">): "concluiu" | "em-andamento" | "nao-iniciou" {
  if (l.credibilidadeAdicionada) return "concluiu";
  if (l.iniciou) return "em-andamento";
  return "nao-iniciou";
}


/**
 * Concluídos primeiro, depois em andamento, depois quem não iniciou; dentro do
 * grupo, pelo nome que a primeira célula MOSTRA — o da equipe, quando há — em
 * ordem pt-BR, com número como número ("Equipe 2" antes de "Equipe 10").
 */
export function ordenarEstudantes(estudantes: readonly LinhaEstudanteUnootube[]): LinhaEstudanteUnootube[] {
  const peso = { concluiu: 0, "em-andamento": 1, "nao-iniciou": 2 } as const;
  const rotulo = (l: LinhaEstudanteUnootube) => l.equipe?.nome ?? l.nome;
  return [...estudantes].sort(
    (a, b) =>
      peso[situacaoDoEstudante(a)] - peso[situacaoDoEstudante(b)] ||
      rotulo(a).localeCompare(rotulo(b), "pt-BR", { sensitivity: "base", numeric: true }),
  );
}


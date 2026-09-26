/**
 * Uma turma no `SeletorDeTurma` dos resultados das missões. O componente é
 * compartilhado entre as missões, e é ele que define o contrato — por isso o
 * tipo mora aqui, e não nos tipos de uma missão. Morava em `unootube-tipos.ts`
 * até o UnooTube ser ARQUIVADO (ADR-116): tipo compartilhado dentro dos tipos de
 * uma missão é o que prende as outras à existência dela.
 */
export interface TurmaResumo {
  id: string;
  nome: string;
  serie: string;
  estudantes: number;
}

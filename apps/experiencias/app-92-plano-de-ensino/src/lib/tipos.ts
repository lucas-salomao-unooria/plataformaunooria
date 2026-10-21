/**
 * Espelho do contrato de `/planejamento/*` (`apps/api/src/planejamento/
 * contrato-de-rotas.ts`). Só o que a tela usa.
 *
 * É cópia manual e não gerada — mesma escolha da app-90. O que protege contra
 * divergência é o OpenAPI derivado do Zod: quando um campo muda de nome na api,
 * o typecheck daqui não acusa, mas a tela quebra no primeiro `undefined`. Por
 * isso os campos que a tela DECIDE algo com (status, habilidadesPorArea,
 * gradeCoerente) estão todos obrigatórios aqui.
 */

export type Status = "pendente" | "gerando" | "pronto" | "erro";
export type Divisao = "bimestral" | "trimestral" | "semestral";

export interface ComponenteDoCatalogo {
  slug: string;
  rotulo: string;
  area: string;
  areaRotulo: string;
  totalDeHabilidades: number;
  aulasSemanaisDeReferencia: number | null;
  /** As habilidades são da ÁREA, não do componente (Biologia no EM). */
  habilidadesPorArea: boolean;
  opcional: boolean;
  observacao: string | null;
}

export interface CatalogoDeComponentes {
  ano: string;
  etapa: "EF" | "EM";
  componentes: ComponenteDoCatalogo[];
  referenciaDaMatriz: {
    aulasSemanais: number;
    horasRelogio: number;
    minimoLegal: number;
    cumpreMinimo: boolean;
  };
}

export interface Habilidade {
  codigo: string;
  descricao: string;
  objetoDeConhecimento: string | null;
  organizador: string | null;
  competenciaEspecifica: number | null;
  /** Só na Computação: texto pedagógico do anexo oficial. */
  explicacao: string | null;
  exemplos: string | null;
}

export interface HabilidadesDoComponente {
  ano: string;
  componente: string;
  componenteRotulo: string;
  /** A BNCC usa três nomes para o agrupador; o servidor manda o certo. */
  rotuloDoOrganizador: string;
  habilidadesPorArea: boolean;
  grupos: { organizador: string; habilidades: Habilidade[] }[];
  total: number;
  computacao: Habilidade[];
}

export interface FaixaDeHorario {
  diaDaSemana: number;
  horarios: string[];
}

export interface Configuracao {
  id: string;
  anoLetivo: number;
  serie: string;
  serieRotulo: string;
  componente: string;
  componenteRotulo: string;
  turmaId: string | null;
  turmaNome: string | null;
  divisaoDoAno: Divisao;
  minutosPorAula: number;
  aulasSemanais: number;
  grade: FaixaDeHorario[];
  incluirComputacao: boolean;
  inicioDoAnoLetivo: string;
  dimensionamento: {
    aulasNoAno: number;
    horasRelogio: number;
    semanasLetivas: number;
    gradeCoerente: boolean;
    aulasNaGrade: number;
  };
  criadoEm: string;
  atualizadoEm: string;
}

export type Distribuicao = Record<string, string[]>;

export interface PlanoAnual {
  id: string;
  configuracaoId: string;
  titulo: string;
  status: Status;
  erro: string | null;
  tokensUsados: number;
  distribuicao: Distribuicao;
  distribuicaoComputacao: Distribuicao;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PeriodoDeAvaliacao {
  ordem: number;
  rotulo: string;
  inicio: string;
  fim: string;
  aulasEstimadas: number;
}

export interface PlanoAnualComConteudo {
  plano: PlanoAnual;
  configuracao: Configuracao;
  periodos: PeriodoDeAvaliacao[];
  html: string | null;
}

/** Uma das 40 semanas do ano letivo. O passo é sempre semanal (ADR-76). */
export interface Semana {
  ordem: number;
  /** `"3ª Semana"` — vem do servidor, e é o que sai no cabeçalho do documento. */
  rotulo: string;
  inicio: string;
  fim: string;
  periodoDeAvaliacao: number;
  aulasPrevistas: number;
  planoId: string | null;
  status: Status | null;
}

export interface CalendarioDoAno {
  periodos: PeriodoDeAvaliacao[];
  semanas: Semana[];
}

export interface Momento {
  o_que: string;
  minutos: number;
}

export interface Aula {
  numero: number;
  data: string;
  diaDaSemana: number;
  horario: string;
  tema: string;
  objetivo: string;
  habilidades: string[];
  conteudo: string;
  momentos: {
    retomada: Momento;
    desenvolvimento: Momento;
    sistematizacao: Momento;
    fechamento: Momento;
  };
  recursos: string[];
  avaliacao: string;
  tarefaDeCasa: string;
  adaptacoes: string;
  /** Preenchidos pelo professor DEPOIS da aula. Não vêm da IA. */
  cumprida: boolean;
  observacaoDoProfessor: string;
}

export interface PlanoDePeriodo {
  id: string;
  planoAnualId: string;
  ordem: number;
  rotulo: string;
  inicio: string;
  fim: string;
  periodoDeAvaliacao: number;
  status: Status;
  erro: string | null;
  tokensUsados: number;
  aulas: Aula[];
  criadoEm: string;
  atualizadoEm: string;
}

/** `1EF`..`3EM`, na ordem da escolaridade. */
export const ANOS = [
  "1EF", "2EF", "3EF", "4EF", "5EF", "6EF", "7EF", "8EF", "9EF",
  "1EM", "2EM", "3EM",
] as const;

export function rotuloDoAno(ano: string): string {
  const n = ano[0];
  return ano.endsWith("EM") ? `${n}ª série — Ensino Médio` : `${n}º ano — Ensino Fundamental`;
}

export const DIAS = [
  { valor: 1, curto: "Seg", longo: "segunda-feira" },
  { valor: 2, curto: "Ter", longo: "terça-feira" },
  { valor: 3, curto: "Qua", longo: "quarta-feira" },
  { valor: 4, curto: "Qui", longo: "quinta-feira" },
  { valor: 5, curto: "Sex", longo: "sexta-feira" },
] as const;

/** `2026-02-03` → `03/02`. Data civil não passa por `new Date()`: em UTC-3 o
 *  `toLocaleDateString` de uma data sem hora volta o dia anterior. */
export function dataCurta(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

export function dataLonga(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

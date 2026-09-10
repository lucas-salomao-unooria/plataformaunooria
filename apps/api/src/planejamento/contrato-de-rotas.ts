import { z } from "zod";
import { SERIES } from "../comum/series";

/**
 * O contrato de `/planejamento/*`. Zod é a fonte: o OpenAPI é derivado dele
 * (`scripts/gerar-openapi.ts`), e é isso que impede a documentação de divergir
 * da rota.
 *
 * Tudo que entra é validado aqui — inclusive o que "vem da nossa própria tela".
 * A exp-92 é um bundle estático e público: `POST /planejamento/configuracoes`
 * é endereço adivinhável, e um `aulasSemanais: 999` que passasse contaminaria a
 * conversão de carga horária do plano inteiro.
 */

const Uuid = z.string().uuid();

/** `YYYY-MM-DD`. Recusa `2026-02-30` — o `Date` do JS a aceitaria como 02/03. */
export const DataCivilSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato YYYY-MM-DD")
  .refine((valor) => {
    const [a = 0, m = 0, d = 0] = valor.split("-").map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d, 12));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "data inexistente no calendário");

export const HorarioSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário no formato HH:MM (24h)");

/** Código de habilidade da BNCC. O formato é fechado; a existência é conferida
 *  contra o catálogo no service — regex não sabe se `EF67LP42` existe. */
export const CodigoDeHabilidadeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^E[FM]\d{2}[A-Z]{2,3}\d{2,3}[A-Z]?$/, "código de habilidade da BNCC (ex.: EF67LP08)");

export const DIVISOES = ["bimestral", "trimestral", "semestral"] as const;
export const STATUS = ["pendente", "gerando", "pronto", "erro"] as const;

// ------------------------------------------------------- catálogo curricular

export const ComponenteDoCatalogoSchema = z.object({
  slug: z.string(),
  rotulo: z.string(),
  area: z.string(),
  areaRotulo: z.string(),
  /** Quantas habilidades da BNCC o professor tem naquele ano. Um zero aqui é
   *  bug de dado, e é melhor a tela poder mostrá-lo do que esconder. */
  totalDeHabilidades: z.number().int().nonnegative(),
  /** Aulas semanais da matriz mediana de referência; `null` = a matriz não
   *  opina, e a tela pede o número ao professor sem pré-preencher. */
  aulasSemanaisDeReferencia: z.number().int().positive().nullable(),
  /** `true` = as habilidades são da ÁREA, não do componente (o caso de
   *  Biologia no EM). A tela DIZ isso ao professor. */
  habilidadesPorArea: z.boolean(),
  opcional: z.boolean(),
  observacao: z.string().nullable(),
});

export const CatalogoDeComponentesSchema = z.object({
  ano: z.enum(SERIES),
  etapa: z.enum(["EF", "EM"]),
  componentes: z.array(ComponenteDoCatalogoSchema),
  /** Soma das aulas de referência do ano, com a conversão para hora-relógio e
   *  o mínimo legal da etapa. É o aviso de matriz que não fecha as 800h/1.000h. */
  referenciaDaMatriz: z.object({
    aulasSemanais: z.number().int().nonnegative(),
    horasRelogio: z.number(),
    minimoLegal: z.number().int(),
    cumpreMinimo: z.boolean(),
  }),
});

export const HabilidadeSchema = z.object({
  codigo: z.string(),
  descricao: z.string(),
  objetoDeConhecimento: z.string().nullable(),
  organizador: z.string().nullable(),
  competenciaEspecifica: z.number().int().nullable(),
  /** Só na Computação: o texto pedagógico do anexo do Parecer CNE/CEB 2/2022. */
  explicacao: z.string().nullable(),
  exemplos: z.string().nullable(),
});

export const HabilidadesDoComponenteSchema = z.object({
  ano: z.enum(SERIES),
  componente: z.string(),
  componenteRotulo: z.string(),
  /** Como chamar o agrupador na tela: a BNCC usa três nomes diferentes. */
  rotuloDoOrganizador: z.string(),
  habilidadesPorArea: z.boolean(),
  grupos: z.array(
    z.object({ organizador: z.string(), habilidades: z.array(HabilidadeSchema) }),
  ),
  total: z.number().int().nonnegative(),
  /** A camada transversal, separada porque é sugestão e não currículo do
   *  componente — não existe crosswalk normativo (Res. CNE/CEB 1/2022 art. 2º). */
  computacao: z.array(HabilidadeSchema),
});

// ------------------------------------------------------------- configuração

export const FaixaDeHorarioSchema = z.object({
  diaDaSemana: z.number().int().min(1).max(5),
  horarios: z.array(HorarioSchema).min(1).max(10),
});

export const GradeSchema = z
  .array(FaixaDeHorarioSchema)
  .max(5)
  .refine(
    (g) => new Set(g.map((f) => f.diaDaSemana)).size === g.length,
    "cada dia da semana aparece no máximo uma vez",
  );

export const CriarConfiguracaoSchema = z.object({
  anoLetivo: z.number().int().min(2025).max(2100),
  serie: z.enum(SERIES),
  componente: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug de componente")
    .max(60),
  turmaId: Uuid.nullable().optional(),
  divisaoDoAno: z.enum(DIVISOES).default("bimestral"),
  minutosPorAula: z.number().int().min(30).max(60).default(50),
  aulasSemanais: z.number().int().min(1).max(20),
  grade: GradeSchema.default([]),
  incluirComputacao: z.boolean().default(false),
  /** Início do ano letivo. Dele saem os períodos e todas as semanas. */
  inicioDoAnoLetivo: DataCivilSchema,
});
export type CriarConfiguracao = z.infer<typeof CriarConfiguracaoSchema>;

export const AtualizarConfiguracaoSchema = CriarConfiguracaoSchema.partial().omit({
  anoLetivo: true,
  serie: true,
  componente: true,
});

export const ConfiguracaoSchema = z.object({
  id: Uuid,
  anoLetivo: z.number().int(),
  serie: z.string(),
  serieRotulo: z.string(),
  componente: z.string(),
  componenteRotulo: z.string(),
  turmaId: Uuid.nullable(),
  turmaNome: z.string().nullable(),
  divisaoDoAno: z.enum(DIVISOES),
  minutosPorAula: z.number().int(),
  aulasSemanais: z.number().int(),
  grade: GradeSchema,
  incluirComputacao: z.boolean(),
  inicioDoAnoLetivo: DataCivilSchema,
  /** O dimensionamento que sai da configuração: é o que o plano anual usa. */
  dimensionamento: z.object({
    aulasNoAno: z.number().int(),
    horasRelogio: z.number(),
    semanasLetivas: z.number().int(),
    /** `false` = a grade não soma as aulas semanais declaradas. Aviso, não erro:
     *  o professor pode estar configurando aos poucos. */
    gradeCoerente: z.boolean(),
    aulasNaGrade: z.number().int(),
  }),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const ListaDeConfiguracoesSchema = z.object({
  configuracoes: z.array(ConfiguracaoSchema),
});

// -------------------------------------------------------------- plano anual

/** `{ "1": ["EF67LP08"], "2": [...] }` — a decisão do professor. */
export const DistribuicaoSchema = z.record(
  z.string().regex(/^[1-4]$/, "ordem do período de avaliação (1 a 4)"),
  z.array(CodigoDeHabilidadeSchema).max(200),
);

export const SalvarDistribuicaoSchema = z.object({
  distribuicao: DistribuicaoSchema,
  distribuicaoComputacao: DistribuicaoSchema.default({}),
});

export const PeriodoDeAvaliacaoSchema = z.object({
  ordem: z.number().int(),
  rotulo: z.string(),
  inicio: DataCivilSchema,
  fim: DataCivilSchema,
  aulasEstimadas: z.number().int().nonnegative(),
});

export const PlanoAnualSchema = z.object({
  id: Uuid,
  configuracaoId: Uuid,
  titulo: z.string(),
  status: z.enum(STATUS),
  erro: z.string().nullable(),
  tokensUsados: z.number().int().nonnegative(),
  distribuicao: DistribuicaoSchema,
  distribuicaoComputacao: DistribuicaoSchema,
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const ListaDePlanosAnuaisSchema = z.object({ planos: z.array(PlanoAnualSchema) });
export const PlanoAnualCriadoSchema = z.object({ id: Uuid });

export const PlanoAnualComConteudoSchema = z.object({
  plano: PlanoAnualSchema,
  configuracao: ConfiguracaoSchema,
  periodos: z.array(PeriodoDeAvaliacaoSchema),
  /** `null` enquanto o status não for `pronto` — é assim que a tela sabe que
   *  deve continuar o polling. */
  html: z.string().nullable(),
});

/** Teto do HTML salvo: um plano anual tem 40–200 KB; 1 MB já é abuso. */
export const MAX_HTML_BYTES = 1_000_000;
export const SalvarConteudoSchema = z.object({
  html: z.string().min(1).max(MAX_HTML_BYTES),
});

// --------------------------------------------------------- plano de período

export const MomentoSchema = z.object({
  o_que: z.string().max(4000),
  minutos: z.number().int().min(0).max(120),
});

export const AulaSchema = z.object({
  numero: z.number().int().positive(),
  data: DataCivilSchema,
  diaDaSemana: z.number().int().min(1).max(5),
  horario: HorarioSchema,
  tema: z.string().max(200),
  objetivo: z.string().max(2000),
  habilidades: z.array(CodigoDeHabilidadeSchema).max(20),
  conteudo: z.string().max(4000),
  momentos: z.object({
    retomada: MomentoSchema,
    desenvolvimento: MomentoSchema,
    sistematizacao: MomentoSchema,
    fechamento: MomentoSchema,
  }),
  recursos: z.array(z.string().max(200)).max(20),
  avaliacao: z.string().max(2000),
  tarefaDeCasa: z.string().max(2000),
  adaptacoes: z.string().max(2000),
  /**
   * Marcado pelo professor DEPOIS da aula. Não é campo da IA: é o registro do
   * que aconteceu, e é ele que faz o plano deixar de ser intenção. Fica aqui
   * junto da aula porque é sobre esta aula — separá-lo numa tabela de execução
   * criaria um join para uma informação que nunca é lida sozinha.
   */
  cumprida: z.boolean().default(false),
  observacaoDoProfessor: z.string().max(4000).default(""),
});
export type Aula = z.infer<typeof AulaSchema>;

export const SemanaSchema = z.object({
  ordem: z.number().int(),
  /** `"3ª Semana"` — o mesmo rótulo que sai no cabeçalho do documento. */
  rotulo: z.string(),
  inicio: DataCivilSchema,
  fim: DataCivilSchema,
  periodoDeAvaliacao: z.number().int(),
  aulasPrevistas: z.number().int().nonnegative(),
  /** O plano daquela semana, se já existe. */
  planoId: Uuid.nullable(),
  status: z.enum(STATUS).nullable(),
});

export const CalendarioDoAnoSchema = z.object({
  periodos: z.array(PeriodoDeAvaliacaoSchema),
  semanas: z.array(SemanaSchema),
});

export const PlanoDePeriodoSchema = z.object({
  id: Uuid,
  planoAnualId: Uuid,
  ordem: z.number().int(),
  rotulo: z.string(),
  inicio: DataCivilSchema,
  fim: DataCivilSchema,
  periodoDeAvaliacao: z.number().int(),
  status: z.enum(STATUS),
  erro: z.string().nullable(),
  tokensUsados: z.number().int().nonnegative(),
  aulas: z.array(AulaSchema),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const PlanoDePeriodoCriadoSchema = z.object({ id: Uuid });
export const ListaDePlanosDePeriodoSchema = z.object({
  periodos: z.array(PlanoDePeriodoSchema),
});

/** Filtro de `GET /planos-anuais/:id/periodos`: um período de avaliação. */
export const FiltroDePeriodosSchema = z.object({
  periodoDeAvaliacao: z.coerce.number().int().min(1).max(4).optional(),
});
export const SalvarAulasSchema = z.object({ aulas: z.array(AulaSchema).max(60) });

/** Feriados e dias sem aula, na geração de uma janela. Removem a aula da grade
 *  em vez de deslocá-la: repor é decisão do professor. */
export const GerarPeriodoSchema = z.object({
  feriados: z.array(DataCivilSchema).max(30).default([]),
});

export const OkSchema = z.object({ ok: z.literal(true) });

import { z } from "zod";
import { SerieSchema } from "../comum/series";
import { ARQUIVOS_ONEROSTER, TURNOS } from "./catalogo";

/** Um uuid v4 gerado pelo banco. Nem todo id da api é uuid — `Escola.id` vem
 *  da rede e é string livre —, então isto só vale onde o schema diz `@db.Uuid`. */
const Uuid = z.string().uuid();

// ------------------------------------------------------------------- entrada

export const NovaTurmaSchema = z.object({
  nome: z.string().trim().min(1).max(40),
  serie: SerieSchema,
  turno: z.enum(TURNOS).optional(),
  periodoLetivoId: Uuid.optional(),
});

export const EditarTurmaSchema = z.object({
  nome: z.string().trim().min(1).max(40).optional(),
  serie: SerieSchema.optional(),
  turno: z.enum(TURNOS).nullable().optional(),
});

export const MatricularSchema = z.object({
  usuarioId: Uuid,
  papel: z.enum(["estudante", "professor"]),
});

export const AjustarMatriculaSchema = z
  .object({
    turmaDestinoId: Uuid.optional(),
    principal: z.literal(true).optional(),
  })
  .refine((d) => Boolean(d.turmaDestinoId) !== Boolean(d.principal), {
    message: "informe turmaDestinoId OU principal",
  });

export const NovoPeriodoSchema = z.object({
  tipo: z.enum(["ano_letivo", "semestre", "bimestre", "trimestre"]).default("ano_letivo"),
  titulo: z.string().trim().min(1).max(80),
  ano: z.number().int().min(2020).max(2100),
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
});

/** `?escolaId=` — só `gestor_contrato` pode apontar para outra escola; para os
 *  demais o valor é ignorado em favor da escola do token (`escolaAlvo`). */
export const EscolaAlvoQuery = z.object({ escolaId: z.string().optional() });

/** O nome do arquivo do binding CSV, nas rotas que o levam no caminho. */
export const ArquivoOneRosterParam = z.object({ arquivo: z.enum(ARQUIVOS_ONEROSTER) });

// -------------------------------------------------------------------- saída

export const OkSchema = z.object({ ok: z.literal(true) });

/**
 * A turma como ela aparece em LISTA — com as contagens, que é o que o gestor
 * olha para saber se o enturmamento acabou.
 *
 * `periodo` é o TÍTULO, não o id: "8A de 2026" e "8A de 2027" são turmas
 * diferentes, e sem o período na tela as duas parecem a mesma linha.
 */
export const TurmaEmListaSchema = z.object({
  id: Uuid,
  nome: z.string(),
  serie: z.string(),
  turno: z.string().nullable(),
  tipo: z.string(),
  periodo: z.string().nullable(),
  estudantes: z.number().int().nonnegative(),
  professores: z.number().int().nonnegative(),
});

export const TurmasSchema = z.array(TurmaEmListaSchema);

/** A linha de `turmas` como o Prisma a devolve — o retorno de criar e editar. */
export const TurmaCruaSchema = z.object({
  id: Uuid,
  escolaId: z.string(),
  periodoLetivoId: Uuid,
  nome: z.string(),
  serie: z.string(),
  tipo: z.string(),
  turno: z.string().nullable(),
  codigo: z.string().nullable(),
  fonteId: z.string().nullable(),
  atualizadoEm: z.string().datetime(),
});

/** Uma pessoa matriculada. `matriculaId` é da MATRÍCULA e `id` é da PESSOA —
 *  mover de turma e encerrar operam sobre o primeiro. */
export const PessoaMatriculadaSchema = z.object({
  matriculaId: Uuid,
  id: Uuid,
  nome: z.string(),
  usuario: z.string(),
  /** O RA da rede. Nulo em conta que nasceu sem planilha (conta de assento). */
  matricula: z.string().nullable(),
  ativo: z.boolean(),
  /** Turma de REFERÊNCIA da pessoa; só significa algo para estudante. */
  principal: z.boolean(),
  /** Ainda não fez o primeiro acesso. */
  senhaProvisoria: z.boolean(),
  desde: z.string().datetime(),
});

export const PessoasDaTurmaSchema = z.object({
  turma: z.object({
    id: Uuid,
    nome: z.string(),
    serie: z.string(),
    turno: z.string().nullable(),
    periodo: z.string(),
  }),
  estudantes: z.array(PessoaMatriculadaSchema),
  professores: z.array(PessoaMatriculadaSchema),
});
export const EstudantesDaTurmaSchema = PessoasDaTurmaSchema;

export const PeriodoLetivoSchema = z.object({
  id: Uuid,
  tipo: z.string(),
  titulo: z.string(),
  ano: z.number().int(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
  paiId: Uuid.nullable(),
  fonteId: z.string().nullable(),
  atualizadoEm: z.string().datetime(),
});

export const PeriodoComTurmasSchema = PeriodoLetivoSchema.extend({
  /** DERIVADO das datas, nunca coluna: estado que ninguém atualiza mente mais
   *  do que ajuda. Vem calculado para a tela não repetir a regra. */
  vigente: z.boolean(),
  /** Quantas turmas dependem dele — é o que impede apagar um por engano. */
  turmas: z.number().int().nonnegative(),
});

export const PeriodosSchema = z.array(PeriodoComTurmasSchema);

// ============================================================ escolas e rede

/** O id da escola circula no claim do token e no `set_config` da RLS: nada de
 *  espaço, acento ou barra — um id legível (`sp-035001`) vale mais que um uuid. */
export const IdDeEscola = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,63}$/,
    "id: 3–64 caracteres [a-z 0-9 . _ -], começando por letra ou número",
  );

/** Vocabulário FECHADO, com trigger no banco recusando pai que seja `escola`.
 *  `regional` é o nível que agrupa (Diretoria de Ensino, polo, secretaria
 *  municipal) e `rede` é a raiz — nenhuma das duas recebe lotação. */
export const TIPOS_DE_ESCOLA = ["escola", "regional", "rede"] as const;

const CamposDeEscola = z.object({
  id: IdDeEscola,
  nome: z.string().trim().min(1).max(160),
  tipo: z.enum(TIPOS_DE_ESCOLA).default("escola"),
  codigoInep: z
    .union([z.literal(""), z.string().trim().regex(/^\d{8}$/, "código INEP: 8 dígitos")])
    .optional(),
  municipio: z.string().trim().max(120).optional(),
  uf: z.union([z.literal(""), z.string().trim().length(2).toUpperCase()]).optional(),
  paiId: z.union([z.literal(""), IdDeEscola]).optional(),
});

/** A mensagem é a do produto e sai daqui: é o Zod que reprova antes do banco, e
 *  o texto do 400 é o que a tela mostra sem traduzir nada. */
export const SEM_REGIONAL = "Selecione uma regional para cadastrar a escola.";

/**
 * Escola exige regional (ADR-79); regional não tem pai obrigatório.
 *
 * O refine mora no schema de ENTRADA e não no service porque é a fronteira que
 * o OpenAPI publica — e porque `paiId: ""`, que a tela manda quando o seletor
 * fica vazio, precisa reprovar igual a `paiId` ausente.
 */
export const NovaEscolaSchema = CamposDeEscola.superRefine((v, ctx) => {
  if (v.tipo === "escola" && !v.paiId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paiId"], message: SEM_REGIONAL });
  }
});

/** `tipo` fica fora: ele circula em token e em RLS, e trocar o tipo de uma linha
 *  existente reescreveria a hierarquia por baixo de quem já depende dela.
 *  `paiId` pode vir, mas o service recusa ESVAZIÁ-LO numa escola. */
export const EditarEscolaSchema = CamposDeEscola.partial().omit({ id: true, tipo: true });

/** A exclusão de regional aceita o DESTINO das escolas no mesmo passo:
 *  transferir e excluir em duas chamadas deixaria a janela em que as escolas já
 *  mudaram de regional e a antiga continua na lista. */
export const ExcluirRegionalQuery = z.object({
  transferirPara: IdDeEscola.optional(),
});

export const RegionalExcluidaSchema = z.object({
  ok: z.literal(true),
  /** Quantas escolas mudaram de regional antes da exclusão. */
  transferidas: z.number().int().nonnegative(),
});

export const LotarSchema = z.object({
  usuarioId: Uuid,
  papel: z.enum(["professor", "gestor_escola"]),
});

export const LotarEmLoteSchema = z.object({
  usuarioId: Uuid,
  papel: z.enum(["professor", "gestor_escola"]),
  /** A LISTA, não o critério: quem confirma precisa ver quantas e quais escolas
   *  antes de dar acesso a cinquenta unidades de uma vez. */
  escolaIds: z.array(IdDeEscola).min(1).max(1000),
});

export const ListarEscolasSchema = z.object({
  busca: z.string().trim().max(80).optional(),
  tipo: z.enum(TIPOS_DE_ESCOLA).optional(),
  /** Só as unidades desta regional — é o insumo da lotação em lote. */
  paiId: IdDeEscola.optional(),
  municipio: z.string().trim().max(120).optional(),
});

export const TransferirSchema = z.object({
  escolaDestinoId: IdDeEscola,
  turmaDestinoId: Uuid.optional(),
});

export const PapelDeLotacaoQuery = z.object({
  papel: z.enum(["estudante", "professor", "gestor_escola"]).optional(),
});

// -------------------------------------------------------------------- saída

/** Uma escola do contrato, com contagem. `pai` é o NOME da regional. */
export const EscolaDaRedeSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: z.string(),
  codigoInep: z.string().nullable(),
  municipio: z.string().nullable(),
  uf: z.string().nullable(),
  paiId: z.string().nullable(),
  pai: z.string().nullable(),
  estudantes: z.number().int().nonnegative(),
  professores: z.number().int().nonnegative(),
  turmas: z.number().int().nonnegative(),
  /** Quantas escolas esta REGIONAL agrupa. Sempre 0 numa `escola` — é o número
   *  que a tela de Regionais mostra por linha, e o que diz se a exclusão dela
   *  precisa de transferência antes. */
  unidades: z.number().int().nonnegative(),
  /** A regional criada pela plataforma para a rede sem divisão administrativa. */
  regionalPadrao: z.boolean(),
});

export const EscolasDaRedeSchema = z.array(EscolaDaRedeSchema);

/** A linha crua de `escolas`, como sai de criar e editar. */
export const EscolaCruaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  codigoInep: z.string().nullable(),
  tipo: z.string(),
  paiId: z.string().nullable(),
  regionalPadrao: z.boolean(),
  municipio: z.string().nullable(),
  uf: z.string().nullable(),
  fonteId: z.string().nullable(),
  atualizadoEm: z.string().datetime(),
});

/** O que o LOGIN devolve e o seletor do cabeçalho consome. Barato de propósito:
 *  está no caminho do login. Sem contagens — para isso existe o resumo. */
export const EscolaDaPessoaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  municipio: z.string().nullable(),
  uf: z.string().nullable(),
  papel: z.string(),
  principal: z.boolean(),
});

export const EscolasDaPessoaSchema = z.array(EscolaDaPessoaSchema);

/**
 * O panorama do supervisor de diretoria. **LISTA, não soma**: uma linha por
 * unidade. Somar escolas numa métrica só seria autorizar por hierarquia, que é
 * exatamente o que a ADR-34 recusa.
 */
export const ResumoDaEscolaSchema = EscolaDaPessoaSchema.extend({
  regional: z.string().nullable(),
  estudantes: z.number().int().nonnegative(),
  professores: z.number().int().nonnegative(),
  turmas: z.number().int().nonnegative(),
  /** Quantos ainda não fizeram o primeiro acesso — o que falta fazer ali. */
  semPrimeiroAcesso: z.number().int().nonnegative(),
});

export const ResumoDasEscolasSchema = z.array(ResumoDaEscolaSchema);

/** Quem está lotado numa escola. O CPF vem FORMATADO: o gestor confere
 *  identidade contra o sistema da rede e atende a família no balcão (ADR-33). */
export const PessoaLotadaSchema = z.object({
  lotacaoId: Uuid,
  id: Uuid,
  nome: z.string(),
  usuario: z.string(),
  ativo: z.boolean(),
  cpf: z.string().nullable(),
  principal: z.boolean(),
  desde: z.string().datetime(),
});

export const PessoasLotadasSchema = z.array(PessoaLotadaSchema);

export const LoteDeLotacoesSchema = z.object({
  lotadas: z.number().int().nonnegative(),
  /** Ids que não viraram lotação: não existem, ou são `regional`/`rede` — que
   *  não recebem lotação porque virariam escola fantasma no seletor. */
  ignoradas: z.array(z.string()),
});

export const TransferenciaSchema = z.object({
  ok: z.literal(true),
  /** A escola de onde saiu; `null` quando o estudante não tinha lotação ativa. */
  origem: z.string().nullable(),
  /** `true` quando o destino já era a escola atual — nada foi movido. */
  jaEstava: z.boolean(),
});

/**
 * O histórico do estudante ATRAVESSANDO escolas.
 *
 * Devolve PARTICIPAÇÕES — em que experiência, em que turma, em que escola,
 * quando —, **nunca o conteúdo dos instrumentos**: o retrato de valores da Vila
 * e a transcrição do unooGPT continuam atrás das telas de quem tem a posse
 * pedagógica na escola onde aquilo aconteceu.
 */
export const HistoricoDoEstudanteSchema = z.object({
  estudante: z
    .object({
      id: Uuid,
      nome: z.string(),
      usuario: z.string(),
      cpf: z.string().nullable(),
    })
    .optional(),
  escolas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      municipio: z.string().nullable(),
      uf: z.string().nullable(),
      entrada: z.string().datetime(),
      saida: z.string().datetime().nullable(),
      /** A escola de HOJE vem PRIMEIRO na lista — é a que o adulto lê como
       *  "a escola dela". */
      atual: z.boolean(),
    }),
  ),
  turmas: z.array(
    z.object({
      escola: z.string(),
      turma: z.string(),
      serie: z.string(),
      periodo: z.string(),
      entrada: z.string().datetime(),
      saida: z.string().datetime().nullable(),
    }),
  ),
  participacoes: z.array(
    z.object({
      escola: z.string(),
      expId: z.string(),
      em: z.string().datetime(),
    }),
  ),
});

// ========================================================= importação de pessoas

export const ImportarQuery = z.object({
  escolaId: z.string().min(1).optional(),
  /** Senha única do lote, escolhida na TELA — a planilha não tem coluna de
   *  senha (ADR-29). Vale só para quem NASCE nesta importação. */
  senhaPadrao: z.string().min(8).max(200).optional(),
  /** "1" = uma senha diferente por pessoa (recomendado para estudantes). */
  gerarSenhas: z.enum(["0", "1"]).optional(),
});

export const OneRosterQuery = ImportarQuery.extend({
  modo: z.enum(["bulk", "delta"]).optional(),
});

export const ErroDeLinhaSchema = z.object({
  linha: z.number().int(),
  campo: z.string(),
  mensagem: z.string(),
});

/** Devolvidas UMA vez, para o gestor imprimir. Não ficam em coluna nem em log. */
export const CredencialSchema = z.object({
  id: Uuid,
  nome: z.string(),
  usuario: z.string(),
  senha: z.string(),
  turma: z.string().nullable(),
});

export const RelatorioDeImportacaoSchema = z.object({
  criados: z.number().int().nonnegative(),
  atualizados: z.number().int().nonnegative(),
  matriculados: z.number().int().nonnegative(),
  /** `status = tobedeleted`: desativado, nunca apagado. */
  desativados: z.number().int().nonnegative(),
  /** Em `bulk`, quem existe aqui e NÃO veio no arquivo. Ausência de linha num
   *  lote completo não é ordem de exclusão — mas também não passa em silêncio,
   *  senão a rede some da plataforma por omissão. */
  candidatosAInativacao: z.number().int().nonnegative(),
  /** Estudantes que já existiam em OUTRA escola da rede, reconhecidos pelo CPF.
   *  Sem ele cada um nasceria de novo, com o histórico partido em duas pessoas. */
  transferidos: z.number().int().nonnegative(),
  /** Professores e gestores que ganharam lotação NESTA escola sem perder a de lá. */
  lotacoesNovas: z.number().int().nonnegative(),
  turmasCriadas: z.array(z.string()),
  erros: z.array(ErroDeLinhaSchema),
  avisos: z.array(ErroDeLinhaSchema),
  credenciais: z.array(CredencialSchema),
});

export const ContasDeAssentoSchema = z.object({
  total: z.number().int().nonnegative(),
  /** Teto de 200 linhas, dito na resposta em vez de silenciosamente cortado. */
  truncado: z.boolean(),
  contas: z.array(
    z.object({
      id: Uuid,
      usuario: z.string(),
      nome: z.string(),
      papel: z.string(),
      ativo: z.boolean(),
      /** Quanto a conta já acumulou de dado — é o que decide se dá para desativar. */
      dados: z.number().int().nonnegative(),
    }),
  ),
});

/** O modelo e o exemplo saem em `text/csv`, com BOM. */
export const CsvSchema = z.string();

import { z } from "zod";

const Uuid = z.string().uuid();
const LadoSchema = z.enum(["A", "B"]);

export const EscolaQuery = z.object({ escolaId: z.string().trim().min(1).max(64) });
export const NivelQuery = EscolaQuery.extend({ nivel: z.enum(["run", "evento"]).optional() });

/** As duas planilhas saem com BOM UTF-8 e `;` como separador. */
export const CsvSchema = z.string();

// --------------------------------------------------------- nível pedagógico

const TempoSchema = z.object({
  sessaoMs: z.number(),
  feedMs: z.number(),
  ativoMs: z.number(),
  ociosoMs: z.number(),
  vaosOciosos: z.number(),
  porLadoMs: z.object({ A: z.number(), B: z.number(), neutro: z.number() }),
  porPerfilMs: z.record(z.number()),
});

/** O total NUNCA aparece sem os componentes — regra escrita no doc, e vale para
 *  o relatório, o monitor e a análise. */
const ImersaoSchema = z.object({
  total: z.number(),
  componentes: z.array(
    z.object({
      chave: z.enum(["continuidade", "atencao", "gestos", "voluntariedade", "exploracao"]),
      rotulo: z.string(),
      pontos: z.number(),
      detalhe: z.string(),
    }),
  ),
});

const InvestigacaoSchema = z.object({
  usosDaBusca: z.number(),
  termosBuscados: z.array(z.string()),
  postsPelaBusca: z.number(),
  comentariosLidos: z.number(),
  revisitas: z.number(),
  perdasDeFoco: z.number(),
  coberturaDosLados: z.object({
    A: z.object({ posts: z.number(), segundos: z.number() }),
    B: z.object({ posts: z.number(), segundos: z.number() }),
  }),
  /** Posts do lado OPOSTO ao semeado em que ele realmente parou. */
  consideracaoDoOposto: z.number(),
});

export const MetricasDaRunSchema = z.object({
  runId: Uuid,
  estudante: z.object({ username: z.string(), displayName: z.string() }),
  aluno: z.object({ username: z.string(), displayName: z.string() }),
  fase: z.string(),
  iniciadaEm: z.string().datetime(),
  encerradaEm: z.string().datetime().nullable(),
  perfilJogo: z.object({ dominante: z.string(), origem: z.string() }).nullable(),
  /** O perfil que o FEED observou, normalizado pela exposição. */
  perfilObservado: z.object({
    normalizado: z.record(z.number()),
    dominante: z.string().nullable(),
    margem: z.number(),
    veredito: z.enum(["reforcou", "divergiu", "sem_referencia"]),
  }),
  bolha: z.object({
    ladoInicial: LadoSchema,
    ladoOrigem: z.string(),
    inverteu: z.boolean(),
    blocoDaInversao: z.number().nullable(),
  }),
  ladoDominante: z.enum(["A", "B", "indefinido"]),
  dominio: z.number(),
  postsConsumidos: z.number(),
  blocos: z.number(),
  escada: z.object({ A: z.number(), B: z.number() }),
  tempo: TempoSchema,
  ritmo: z.object({ postsPorMinuto: z.number(), variacaoDoRitmo: z.number() }),
  imersao: ImersaoSchema,
  investigacao: InvestigacaoSchema,
  interacoes: z.object({
    curtidas: z.number(),
    comentarios: z.number(),
    salvos: z.number(),
    compartilhados: z.number(),
    seguidos: z.number(),
    naoInteressa: z.number(),
    publicou: z.boolean(),
  }),
  /** Diferente de `interacoes.salvos`, que conta EVENTOS: aqui o último evento
   *  por post decide, então salvar e dessalvar se anulam. */
  colecao: z.object({
    total: z.number(),
    doLadoSemeado: z.number(),
    doOutroLado: z.number(),
    neutros: z.number(),
    comentados: z.number(),
  }),
  /** No fluxo v2 a conclusão é só a escolha de um lado — `texto` fica nulo. */
  conclusao: z
    .object({
      inclinacao: z.enum(["A", "B", "duvida"]),
      texto: z.string().nullable(),
      caracteres: z.number(),
    })
    .nullable(),
  reflexao: z.object({ texto: z.string(), caracteres: z.number() }).nullable(),
  /** `null` quando a run já acabou: ninguém precisa ser cutucado por estar
   *  "ocioso" num relatório. */
  ociosoHaMs: z.number().nullable(),
});

const CelulaSchema = z.object({ A: z.number(), duvida: z.number(), B: z.number() });

export const AnaliseDaTurmaSchema = z.object({
  atividade: z.object({
    id: Uuid,
    titulo: z.string(),
    perguntaChave: z.string(),
    ladoALabel: z.string(),
    ladoBLabel: z.string(),
  }),
  /** **A tabela que vale a aula**: linhas = lado semeado, colunas = conclusão.
   *  Se o lado em que o feed nasceu prevê a conclusão que o estudante escreveu, o
   *  resultado experimental da turma está nessa grade. */
  conclusaoPorLadoSemeado: z.object({ semeadoEmA: CelulaSchema, semeadoEmB: CelulaSchema }),
  poderDoViesSemeado: z.object({
    seguiram: z.number(),
    viraram: z.number(),
    /** A dúvida não conta nem a favor nem contra. */
    emDuvida: z.number(),
    taxa: z.number().nullable(),
    /** Mexeram na resposta depois da primeira escolha ("vale a última"). */
    trocaramDeIdeia: z.number(),
    /** E terminaram num lado diferente do que marcaram de cara. */
    terminaramNoutroLado: z.number(),
  }),
  turma: z.object({
    total: z.number(),
    naMissao: z.number(),
    concluiram: z.number(),
    semConcluir: z.array(
      z.object({ username: z.string(), displayName: z.string(), fase: z.string() }),
    ),
    inverteram: z.array(
      z.object({
        username: z.string(),
        displayName: z.string(),
        de: z.string(),
        para: z.string(),
        bloco: z.number().nullable(),
      }),
    ),
  }),
  /** Auditoria da largada: de onde veio o lado de cada um. */
  largada: z.object({
    porLado: z.object({ A: z.number(), B: z.number() }),
    porOrigem: z.record(z.number()),
  }),
  busca: z.object({
    usaram: z.number(),
    naoUsaram: z.number(),
    termos: z.array(z.string()),
  }),
  imersao: z.object({
    media: z.number().nullable(),
    porComponente: z.array(
      z.object({ chave: z.string(), rotulo: z.string(), media: z.number() }),
    ),
  }),
  estudantes: z.array(MetricasDaRunSchema).optional(),
  alunos: z.array(MetricasDaRunSchema),
});

// ------------------------------------------------------------ nível produto

export const ResumoDeAtividadeSchema = z.object({
  id: Uuid,
  titulo: z.string(),
  status: z.string(),
  criadaEm: z.string().datetime(),
  runs: z.number(),
  concluidas: z.number(),
  imersao: z.object({ media: z.number().nullable(), porComponente: z.record(z.number()) }),
  tempoMedioDeFeedMs: z.number().nullable(),
  taxaDeInversao: z.number().nullable(),
  /** P(conclusão = lado semeado): o poder do viés que a plataforma plantou. */
  poderDoViesSemeado: z.number().nullable(),
  descobertaDaBusca: z.number().nullable(),
  /** Posts aprovados que nunca foram servidos a ninguém. */
  conteudoMorto: z.object({
    posts: z.number(),
    total: z.number(),
    fracao: z.number().nullable(),
  }),
  taxaDeImagensOk: z.number().nullable(),
});

export const ResumoDeProdutoSchema = z.object({
  atividades: z.array(ResumoDeAtividadeSchema),
});

/**
 * **A métrica que valida — ou refuta — a premissa do projeto.**
 *
 * `delta` = dwell médio dos posts do perfil P entre estudantes de perfil P menos o
 * dwell médio dos MESMOS posts entre estudantes de outro perfil, sempre com a
 * exposição no denominador. Sem isso mediria o próprio viés do feed e
 * "confirmaria" a premissa por construção.
 *
 * Se for consistentemente positivo, as fichas de linguagem funcionam. **Se for
 * zero, elas não funcionam** — e a gente descobre com número, não com achismo.
 */
export const AnaliseDeProdutoSchema = z.object({
  atividade: z.object({ id: Uuid, titulo: z.string(), status: z.string() }),
  resumo: ResumoDeAtividadeSchema,
  eficaciaDaEscrita: z.array(
    z.object({
      perfil: z.string(),
      rotulo: z.string(),
      dwellDosDoPerfil: z.number().nullable(),
      dwellDosOutros: z.number().nullable(),
      delta: z.number().nullable(),
      amostra: z.object({
        estudantesDoPerfil: z.number().optional(),
        alunosDoPerfil: z.number(),
        estudantesDeOutros: z.number().optional(),
        alunosDeOutros: z.number(),
      }),
    }),
  ),
  /** Média dos deltas com amostra suficiente — o veredito em um número. */
  eficaciaMedia: z.number().nullable(),
});

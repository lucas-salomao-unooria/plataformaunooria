import { z } from "zod";
import { COMPLEXIDADES, ETAPAS, MARCAS, OPCOES_REFLEXAO, TEMAS } from "./catalogo";

/**
 * Contrato Zod das rotas `/foto-conta/*` (exp-04-o-que-a-foto-conta).
 *
 * O OpenAPI deriva daqui (ADR-36) e as respostas são conferidas contra estes
 * schemas nos testes. A fronteira que este arquivo desenha:
 *
 * - `PacotePublicoSchema` NÃO tem `comentarios` — a matriz causal do Aha é a
 *   surpresa da missão, e ela só sai na resposta de `POST /publicar`, uma
 *   linha por vez. O tipo torna o vazamento impossível, não só ausente.
 * - Nenhum schema de estudante carrega nome de criança; o único que carrega
 *   (`PainelSchema.hesitando[].nome`) é resposta de rota `@Roles` de
 *   professor, hidratada da matrícula na própria rota (DAD-07).
 */

export const TemaSchema = z.enum(TEMAS);
export const ComplexidadeSchema = z.enum(COMPLEXIDADES);
export const MarcaSchema = z.enum(MARCAS);
export const EtapaSchema = z.enum(ETAPAS);
export const OpcaoReflexaoSchema = z.enum(OPCOES_REFLEXAO);

/* ------------------------------- o pacote -------------------------------- */

const PostDoFeedSchema = z.object({
  id: z.string().min(1).max(30),
  fotoId: z.string().min(1).max(30),
  /** CAIXA ALTA, máx. 8 palavras (teto da faixa etária) — o `.refine` não
   *  atravessa para o OpenAPI, então o teto duro é de caracteres. */
  legenda: z.string().min(1).max(60),
});

const LegendaDoParSchema = z.object({
  id: z.enum(["legenda_1", "legenda_2"]),
  texto: z.string().min(1).max(60),
  icone: z.enum(["bloco", "vassoura"]),
});

export const ComentariosDoParSchema = z.object({
  fotoId: z.string().min(1).max(30),
  legendaId: z.string().min(1).max(30),
  leo: z.string().min(1).max(60),
  sofia: z.string().min(1).max(60),
  audioLeo: z.string().max(60).optional(),
  audioSofia: z.string().max(60).optional(),
});

/** O pacote COMPLETO — o shape que a IA tem de produzir, que o professor
 *  aprova e que `exp_04_turma_config.pacote` guarda. */
export const PacoteDaTurmaSchema = z.object({
  tema: TemaSchema,
  feed: z.array(PostDoFeedSchema).length(3),
  par: z.object({ fotoAId: z.string().min(1).max(30), fotoBId: z.string().min(1).max(30) }),
  legendas: z.tuple([LegendaDoParSchema, LegendaDoParSchema]),
  /** As 4 combinações (2 fotos × 2 legendas), cada uma com Leo e Sofia. */
  comentarios: z.array(ComentariosDoParSchema).length(4),
});
export type PacoteDaTurmaValido = z.infer<typeof PacoteDaTurmaSchema>;

/** O que o ESTUDANTE recebe: o pacote sem a matriz causal. */
export const PacotePublicoSchema = PacoteDaTurmaSchema.omit({ comentarios: true });

/* --------------------------- rotas do estudante --------------------------- */

export const MarcaBodySchema = z.object({ marcaId: MarcaSchema });

export const FeedBodySchema = z.object({
  curtidas: z.number().int().min(0).max(1000),
  permanenciaMs: z.number().int().min(0).max(7_200_000),
});

export const PublicarBodySchema = z.object({
  fotoId: z.string().min(1).max(30),
  legendaId: z.string().min(1).max(30),
  /** Cronometrada pelo CLIENTE (é o tempo de decisão da criança, não a
   *  latência da api). Teto de 2h = aba esquecida. */
  latenciaMs: z.number().int().min(0).max(7_200_000).optional(),
});

export const ReflexaoBodySchema = z.object({ escolha: OpcaoReflexaoSchema });

const PostDaGaleriaSchema = z.object({
  marcaId: MarcaSchema,
  fotoId: z.string(),
  legendaTexto: z.string(),
  curtidas: z.number().int().nonnegative(),
  criadoEm: z.string(),
});

export const SessaoSchema = z.object({
  etapa: EtapaSchema,
  tentativa: z.number().int().positive(),
  marcaId: MarcaSchema.nullable(),
  fotoEscolhidaId: z.string().nullable(),
  legendaEscolhidaId: z.string().nullable(),
  tentativasReflexao: z.number().int().nonnegative(),
  /** O pacote SEM a matriz do Aha (ver o cabeçalho do arquivo). */
  pacote: PacotePublicoSchema,
  latchLiberado: z.boolean(),
  versaoInstrumento: z.string(),
});

export const PublicacaoSchema = z.object({
  etapa: EtapaSchema,
  post: PostDaGaleriaSchema,
  /** SÓ a linha do par escolhido — nunca a matriz. */
  comentarios: ComentariosDoParSchema,
});

/** Resposta do polling do latch (3s) — leve de propósito, como o gate do
 *  o-eco-no-grupo. `agora` é o instante do SERVIDOR. */
export const LatchSchema = z.object({
  liberado: z.boolean(),
  etapa: EtapaSchema,
  agora: z.string(),
});

export const ReflexaoRespostaSchema = z.object({
  /** `true` = Lupa: a missão conclui e o cliente celebra. `false` = Globo:
   *  retry formativo, sem penalidade (o gabarito nunca sai daqui). */
  conclui: z.boolean(),
  tentativas: z.number().int().nonnegative(),
  etapa: EtapaSchema,
});

export const GaleriaSchema = z.object({
  posts: z.array(PostDaGaleriaSchema),
});

/* --------------------------- rotas do professor --------------------------- */

export const ConfigBodySchema = z.object({
  tema: TemaSchema,
  complexidade: ComplexidadeSchema,
});

export const AprovarBodySchema = z.object({
  /** O pacote conferido (e possivelmente editado) no preview. A api revalida
   *  inteiro: aprovação não é carimbo, é o último portão antes da turma. */
  pacote: PacoteDaTurmaSchema,
  /** A tela informa a origem do pacote que o professor conferiu (auditoria do
   *  painel). Default `false`: sem informação, não se afirma IA. */
  daIa: z.boolean().default(false),
});

/** Resposta da geração: o pacote completo para o PREVIEW do professor (aqui os
 *  comentários aparecem — são o material da mediação dele). */
export const GeracaoSchema = z.object({
  pacote: PacoteDaTurmaSchema,
  /** `false` = a IA não respondeu (sem saldo, provider fora, saída inválida) e
   *  este é o banco curado padrão — a tela diz isso ao professor. */
  daIa: z.boolean(),
});

const TurmaDoPainelSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  serie: z.string(),
  estudantes: z.number().int().nonnegative(),
});

export const TurmasSchema = z.object({ turmas: z.array(TurmaDoPainelSchema) });

export const PainelSchema = z.object({
  turma: z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string() }),
  tema: TemaSchema,
  complexidade: ComplexidadeSchema,
  statusPacote: z.enum(["pendente", "pronto"]),
  pacoteDaIa: z.boolean(),
  latchLiberado: z.boolean(),
  tentativa: z.number().int().positive(),
  resumo: z.object({
    conectados: z.number().int().nonnegative(),
    publicaram: z.number().int().nonnegative(),
    noLatch: z.number().int().nonnegative(),
    concluiram: z.number().int().nonnegative(),
    porFoto: z.record(z.string(), z.number().int().nonnegative()),
    porLegenda: z.record(z.string(), z.number().int().nonnegative()),
  }),
  /** Hesitação de leitura (> 60s na decisão). O nome entra AQUI, hidratado da
   *  matrícula na rota do professor — o modelo e o polling só têm o id. */
  hesitando: z.array(z.object({ id: z.string().uuid(), nome: z.string() })),
});

/** A projeção da lousa (E5-PROF-01): o par lado a lado, os rótulos, as 3
 *  perguntas e o termômetro do latch. */
export const ProjecaoSchema = z.object({
  fotoAId: z.string(),
  fotoBId: z.string(),
  legendas: z.tuple([LegendaDoParSchema, LegendaDoParSchema]),
  rotulos: z.object({ meio: z.string(), fora: z.string() }),
  perguntas: z.array(z.string()).length(3),
  tema: TemaSchema,
  latchLiberado: z.boolean(),
  conectados: z.number().int().nonnegative(),
  noLatch: z.number().int().nonnegative(),
});

export const LiberarRespostaSchema = z.object({
  liberado: z.literal(true),
  /** Quantas runs estavam no latch no instante da liberação — a "contagem de
   *  tablets" da confirmação visual. */
  tabletsNoLatch: z.number().int().nonnegative(),
});

export const ResetRespostaSchema = z.object({
  tentativa: z.number().int().positive(),
  runsArquivadas: z.number().int().nonnegative(),
  /** O latch volta armado e o pacote continua o aprovado — trocar o TEMA na
   *  reaplicação é recomendação do guia (PED-13), não automatismo. */
  latchLiberado: z.literal(false),
});

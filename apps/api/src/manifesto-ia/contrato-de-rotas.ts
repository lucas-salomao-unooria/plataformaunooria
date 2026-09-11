import { z } from "zod";
import {
  IDS_DE_TAG,
  PISO_DA_JUSTIFICATIVA,
  TAGS_EXIGIDAS,
  TETO_DA_JUSTIFICATIVA,
} from "./catalogo";
import { ACOES_DO_GATE, ETAPAS, PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp-08 — só schemas Zod, nenhum decorator.
 *
 * Os enums vêm do catálogo e das regras, nunca reescritos aqui: uma segunda
 * lista de valores é a que ninguém atualiza junto.
 *
 * A saída é ALLOWLIST explícita, e o que ela protege nesta missão **não é
 * gabarito** — não existe resposta certa entre as quatro cláusulas. O que não
 * pode vazar é (a) a réplica da máquina antes de o estudante perguntar, (b) a
 * `justificativaSugerida` de cada cláusula, que é material do professor, e (c)
 * o parágrafo autoral de qualquer estudante que não seja o próprio. Nenhum
 * schema público tem campo para eles.
 */

// -------------------------------------------------------------- entrada

/** O disparo de um questionamento na Etapa 2. */
export const DisparoSchema = z.object({
  promptId: z.string().min(1).max(64),
  /**
   * Segundos entre o seletor abrir e o envio. Teto de 1h: acima disso é aba
   * esquecida aberta, não leitura, e a calibragem de fluxo mentiria.
   *
   * É calibragem, NUNCA medida de mérito — ninguém é avaliado por ler rápido.
   */
  latenciaSeg: z.number().int().min(0).max(3600).default(0),
});

/**
 * A submissão da cláusula na Etapa 3 — o PICO, e latch irreversível.
 *
 * `confirmouProvocacao` existe por causa do caminho degenerado da spec: clique
 * em menos de 5 segundos de tela recebe a réplica provocativa do bot e precisa
 * de um segundo toque. Quem confirma manda `true`, e o servidor grava. O campo
 * não muda a regra (a escolha vale igual) — ele registra que a criança passou
 * pela provocação, que é o dado do playtest.
 */
export const ClausulaSchema = z.object({
  clausulaId: z.string().min(1).max(64),
  latenciaSeg: z.number().int().min(0).max(7200),
  confirmouProvocacao: z.boolean().default(false),
});

/**
 * O formulário do "Meu Percurso" (Etapa 5).
 *
 * `trim` antes do `min`: um campo com vinte espaços passaria o piso de 20
 * caracteres e contaria como entregue no painel da professora.
 *
 * As tags são exatamente 2, e o `.refine` cobra distintas — marcar "Justiça"
 * duas vezes deixaria um slot logicamente vazio dentro de um array cheio, o
 * mesmo defeito que a ordem de blocos repetida produziu na exp-06.
 */
export const PercursoSchema = z.object({
  tags: z
    .array(z.enum(IDS_DE_TAG))
    .length(TAGS_EXIGIDAS)
    .refine((t) => new Set(t).size === t.length, "as duas palavras-chave têm de ser diferentes"),
  justificativa: z
    .string()
    .trim()
    .min(PISO_DA_JUSTIFICATIVA)
    .max(TETO_DA_JUSTIFICATIVA),
});

export const GateSchema = z.object({ acao: z.enum(ACOES_DO_GATE) });

/**
 * Os parâmetros da preparação docente (E0-PROF-01).
 *
 * 50 caracteres no nome da escola é o teto do `TextField` da tela. Os outros
 * dois são texto curto porque alimentam um prompt: campo longo aqui é injeção
 * de instrução no gerador, e o teto é a primeira barreira (a segunda é o
 * `system` do `prompts.ts`, que fixa o formato da saída).
 */
export const ParametrosDoPreparoSchema = z.object({
  nomeEscola: z.string().trim().min(2).max(50),
  casoContextual: z.string().trim().min(3).max(120),
  focoPrioritario: z.string().trim().min(3).max(120),
});

/**
 * A homologação do pacote da turma.
 *
 * O professor pode editar QUALQUER texto antes de aprovar — é a exigência 8.2
 * (curadoria obrigatória), e é por isso que o corpo carrega o pacote inteiro em
 * vez de um `{ aprovado: true }`. Aprovar sem editar manda de volta o que a
 * tela recebeu, o que também é curadoria: ela passou pelos olhos dele.
 */
export const HomologacaoSchema = z.object({
  contexto: z.object({
    escola: z.string().trim().min(2).max(80),
    casoUsoTitulo: z.string().trim().min(3).max(200),
    premissaIaAutoritaria: z.string().trim().min(10).max(600),
  }),
  prompts: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        rotuloBotao: z.string().trim().min(2).max(60),
        textoPrompt: z.string().trim().min(5).max(300),
        replicaIa: z.string().trim().min(10).max(600),
      }),
    )
    .length(3),
  clausulas: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        tituloClausula: z.string().trim().min(3).max(80),
        artigoTexto: z.string().trim().min(10).max(600),
        justificativaSugerida: z.string().trim().min(10).max(400),
      }),
    )
    .length(4),
});

// --------------------------------------------------------------- saída

const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);

/** Um prompt como o estudante o recebe — **sem `replicaIa`**. */
export const PromptPublicoSchema = z.object({
  id: z.string(),
  rotuloBotao: z.string(),
  textoPrompt: z.string(),
});

/** Uma cláusula como o estudante a recebe — **sem `justificativaSugerida`**. */
export const ClausulaPublicaSchema = z.object({
  id: z.string(),
  tituloClausula: z.string(),
  artigoTexto: z.string(),
});

/** Uma fala já dita na conversa. Só o que JÁ aconteceu entra aqui. */
export const FalaSchema = z.object({
  papel: z.enum(["user", "assistant"]),
  texto: z.string(),
  /** O prompt que originou o par. Ausente na fala de abertura da máquina. */
  promptId: z.string().optional(),
});

export const EstadoSchema = z.object({
  /** O passo do estudante, já reconciliado com a etapa da turma. */
  passo: PassoSchema,
  /** O passo cru dele. Divergente do de cima = a turma o está segurando. */
  passoDoEstudante: PassoSchema,
  aguardandoATurma: z.boolean(),
  promptsEnviados: z.array(z.string()),
  totalAuditorias: z.number().int().min(0),
  cotaAtingida: z.boolean(),
  faltamAuditorias: z.number().int().min(0),
  clausulaId: z.string().nullable(),
  /**
   * O documento promulgado. `null` até a cláusula ser fixada — antes disso não
   * existe manifesto, e devolver um esqueleto entregaria a cena da Etapa 4.
   */
  manifestoMarkdown: z.string().nullable(),
  registrouPercurso: z.boolean(),
  concluidoEm: z.string().nullable(),
  turma: z.object({ etapa: EtapaSchema }),
});

export const DisparoRespostaSchema = EstadoSchema.extend({
  /** A defesa da máquina — só AGORA, depois de a pergunta ter sido feita. */
  replica: z.string(),
});

export const ClausulaRespostaSchema = EstadoSchema.extend({
  manifestoMarkdown: z.string(),
  /** O delay diegético que o cliente tem de respeitar antes de renderizar. */
  delayMs: z.number().int().positive(),
});

const PodcastSchema = z.object({
  titulo: z.string(),
  blocos: z.array(z.object({ rotulo: z.string(), falas: z.array(z.string()) })),
});

export const SessaoSchema = EstadoSchema.extend({
  catalogo: z.object({
    contexto: z.object({
      escola: z.string(),
      casoUsoTitulo: z.string(),
      premissaIaAutoritaria: z.string(),
    }),
    /** Quem parametrizou: o pacote da turma ou o curado da Unooria. */
    origemDoConteudo: z.enum(["turma", "default"]),
    prompts: z.array(PromptPublicoSchema),
    clausulas: z.array(ClausulaPublicaSchema),
    promptsExigidos: z.number().int().positive(),
    concessaoDoBot: z.string(),
    principiosEmDisputa: z.string(),
    tags: z.array(z.object({ id: z.string(), rotulo: z.string() })),
    tagsExigidas: z.number().int().positive(),
    pisoDaJustificativa: z.number().int().positive(),
    tetoDaJustificativa: z.number().int().positive(),
    perguntaDaReflexao: z.string(),
    insignia: z.string(),
    podcast: PodcastSchema,
    delayDaGovernancaMs: z.number().int().positive(),
  }),
  /** A conversa reconstituída — é o que faz o F5 devolver a tela exata. */
  falas: z.array(FalaSchema),
  /** O percurso do PRÓPRIO estudante. Nunca o de outro. */
  percurso: z
    .object({ tags: z.array(z.string()), justificativa: z.string() })
    .nullable(),
  estudante: z.object({ nome: z.string() }),
});

export const GatePublicoSchema = z.object({
  etapa: EtapaSchema,
  passoEfetivo: PassoSchema,
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: z.string(),
});

// ------------------------------------------------------ saída do professor

export const TurmasSchema = z.object({
  turmas: z.array(
    z.object({
      id: z.string().uuid(),
      nome: z.string(),
      serie: z.string().nullable(),
      estudantes: z.number().int().min(0),
    }),
  ),
});

/**
 * Uma linha do painel.
 *
 * **Sem `score`, sem `nivel` e sem taxa de acerto** — `PROIBIDO_NO_PAINEL` em
 * `invariantes.ts` tem o teste que cobra a ausência. Nesta missão a tentação é
 * específica: com quatro cláusulas e uma "mais votada", calcular percentual de
 * acerto é o erro natural de quem chegar depois — e as quatro são válidas.
 *
 * `justificativaTexto` está AQUI e só aqui: é caixa livre de menor, e a rota é
 * a do professor da turma dela.
 */
const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  iniciou: z.boolean(),
  passo: PassoSchema,
  auditorias: z.number().int().min(0),
  auditouOMinimo: z.boolean(),
  clausulaId: z.string().nullable(),
  tags: z.array(z.string()),
  registrouPercurso: z.boolean(),
  justificativaTexto: z.string().nullable(),
  ociosoMin: z.number().int().nullable(),
});

export const PainelSchema = z.object({
  turma: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    serie: z.string().nullable(),
    etapa: EtapaSchema,
  }),
  estudantes: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    iniciaram: z.number().int().min(0),
    auditaram: z.number().int().min(0),
    fixaramClausula: z.number().int().min(0),
    assinaram: z.number().int().min(0),
    concluiram: z.number().int().min(0),
    ociosos: z.number().int().min(0),
    /** Votos por cláusula. É o material do debate, não um placar. */
    distribuicao: z.record(z.string(), z.number().int().min(0)),
    /** A nuvem agregada de palavras-chave da sala. */
    tags: z.record(z.string(), z.number().int().min(0)),
  }),
});

/** O pacote da turma, COM o material de mediação. Professor-only. */
export const ConteudoDaTurmaSchema = z.object({
  contexto: z.object({
    escola: z.string(),
    casoUsoTitulo: z.string(),
    premissaIaAutoritaria: z.string(),
  }),
  prompts: z.array(
    z.object({
      id: z.string(),
      rotuloBotao: z.string(),
      textoPrompt: z.string(),
      /** A defesa da máquina. O professor a lê ANTES da aula, de propósito. */
      replicaIa: z.string(),
    }),
  ),
  clausulas: z.array(
    z.object({
      id: z.string(),
      tituloClausula: z.string(),
      artigoTexto: z.string(),
      /** Material de mediação — nunca chega ao estudante. */
      justificativaSugerida: z.string(),
    }),
  ),
  aprovadoPorProfessor: z.boolean(),
  usouBancoDefault: z.boolean(),
  atualizadoEm: z.string().nullable(),
});

export const GateDaTurmaSchema = z.object({
  turma: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    serie: z.string().nullable(),
  }),
  etapa: EtapaSchema,
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  sucesso: z.literal(true),
  registrosApagados: z.number().int().min(0),
});

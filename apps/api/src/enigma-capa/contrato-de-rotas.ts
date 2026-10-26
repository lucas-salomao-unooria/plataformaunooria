import { z } from "zod";
import {
  CHAVES_DE_CENA,
  CHAVES_PRONTAS,
  CRACHAS,
  DISCIPLINAS,
  ELEMENTOS_DA_SEGUNDA_FOTO,
  FASES,
  FOTOS,
  INVARIANTES,
  MOTIVOS_DO_PAR,
  NOTA_MAX,
  ORIGENS,
  PALAVRAS,
  SELOS,
  TEMA,
  TOQUES_FORA_MAX,
  VOTOS,
} from "./conteudo";
import { PASSOS } from "./regras/passos";

/**
 * O CONTRATO HTTP da exp02ef1b — O Enigma da Capa da Rádio (ADR-184), em Zod.
 * O OpenAPI é derivado daqui (ADR-36), e os vocabulários vêm do catálogo.
 *
 * **A experiência (`apps/experiencias/exp02ef1b`) e o hub ESPELHAM estes
 * tipos** (`z.infer` de cada `…Schema`): mudar a forma aqui sem avisar quebra
 * os dois.
 *
 * Prefixo `/enigma-capa`. Rotas do ESTUDANTE (todas pelo funil da porta da
 * sala, ADR-69):
 *
 *   GET  /enigma-capa/sessao           → SessaoSchema
 *   GET  /enigma-capa/gate             → GateDoEstudanteSchema   (polling 3 s)
 *   POST /enigma-capa/cracha           CrachaSchema       → EstadoSchema
 *   POST /enigma-capa/lupa             LupaSchema         → RespostaDaLupaSchema
 *   POST /enigma-capa/publicar         PublicarSchema     → RespostaDoPublicarSchema   (LATCH 1)
 *   POST /enigma-capa/invariantes      ToqueSchema        → RespostaDoToqueSchema      (só depois da virada)
 *   POST /enigma-capa/slider           —                  → EstadoSchema
 *   POST /enigma-capa/fora             ForaSchema         → EstadoSchema
 *   POST /enigma-capa/pares            ParesSchema        → EstadoSchema
 *   POST /enigma-capa/segunda-foto     SegundaFotoSchema  → EstadoSchema
 *   POST /enigma-capa/transferencia    TransferenciaSchema → EstadoSchema              (LATCH 2, conclui)
 *
 * Toda resposta de POST de estudante É um `Estado` (as que têm resultado
 * próprio o ESTENDEM): a tela troca o estado inteiro a cada resposta.
 * Jogada fora do passo = 409 `passo-invalido`; repetir uma jogada já feita
 * devolve o estado atual (200) — o duplo toque e a fila de reenvio da tela são
 * inofensivos. Os dois latches com OUTRA escolha respondem 409 (`ja-publicado`,
 * `ja-enviado`).
 *
 * **O gabarito NÃO desce**: a cena vai sem `nucleo`, sem `visitante`, sem
 * `seloCoerente`, sem os alvos dos invariantes NÃO achados (o do achado desce
 * em `invariantes.achados`; todos, depois da AJUDA, para o pulso) e sem os
 * `marcaveis`; as cartas da E5 vão só com id e imagem.
 *
 * **COORDENADAS**: tudo em 0–100 da PANORÂMICA 16:9 (x em % da largura, y em %
 * da altura). A foto N é o recorte `geometria.recortes[N]` da panorâmica — UMA
 * imagem serve as duas fotos e a revelação. O `deslocamento` é a fração da
 * folga da moldura (0 a 1), não pixel. A segunda foto (E5) tem coordenadas
 * próprias (0–100 sobre `leitura.webp`, 4:3).
 *
 * **IMAGENS**: `{ tipo: "bundle", nome }` é um arquivo do `public/` da própria
 * experiência (`cenas/biblioteca.webp`, `fixas/carta-a.webp`) — a tela monta
 * `${import.meta.env.BASE_URL}${nome}`; `{ tipo: "url", url }` é absoluta (a
 * cena da IA, no bucket de mídia) e vai como veio.
 */

// ─────────────────────────────────────────────────────────── peças

const n100 = z.number().finite().min(0).max(100);
export const RetanguloSchema = z.object({ x: n100, y: n100, w: n100, h: n100 });
export const PontoSchema = z.object({ x: n100, y: n100 });
export const AlvoSchema = z.object({ x: n100, y: n100, r: z.number().finite().positive().max(50) });
/** A fração da folga da moldura: `{0,0}` = encostada no canto superior esquerdo, `{1,1}` no inferior direito. */
export const DeslocamentoSchema = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) });
export const ImagemSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("bundle"), nome: z.string().min(1).max(120) }),
  z.object({ tipo: z.literal("url"), url: z.string().min(1).max(2000) }),
]);

export const FaseSchema = z.enum(FASES);
export const PassoSchema = z.enum(PASSOS);
export const CrachaIdSchema = z.enum(CRACHAS);
export const FotoIdSchema = z.enum(FOTOS);
export const SeloIdSchema = z.enum(SELOS);
export const InvarianteIdSchema = z.enum(INVARIANTES);
export const DisciplinaSchema = z.enum(DISCIPLINAS);
export const OrigemSchema = z.enum(ORIGENS);
export const ChaveDeCenaSchema = z.enum(CHAVES_DE_CENA);
export const VotoSchema = z.enum(VOTOS);
export const MotivoSchema = z.enum(MOTIVOS_DO_PAR);
export const ElementoSchema = z.enum(ELEMENTOS_DA_SEGUNDA_FOTO);
/** Um invariante achado numa foto: `"inv-1:foto-1"`. */
export const AchadoSchema = z.string().regex(/^inv-[12]:foto-[12]$/);

// ─────────────────────────────────────────────────────────── o pacote (COM gabarito — professor)

const texto = (max: number) => z.string().trim().min(1).max(max);

export const ConteudoBaseSchema = z.object({
  versao: z.literal(1),
  cena: z.object({
    chave: ChaveDeCenaSchema,
    espaco: texto(60),
    espacoCurto: texto(40),
    hora: z.string().regex(/^\d{2}:\d{2}$/),
    imagem: ImagemSchema,
    alt: texto(400),
    fotos: z
      .array(
        z.object({
          id: FotoIdSchema,
          recorte: RetanguloSchema,
          nucleo: RetanguloSchema,
          acao: texto(80),
          visitante: texto(80),
          seloCoerente: SeloIdSchema,
        }),
      )
      .length(2),
    selos: z.array(z.object({ id: SeloIdSchema, texto: texto(40), emoji: texto(16) })).length(2),
    invariantes: z.array(z.object({ id: InvarianteIdSchema, nome: texto(30), alvo: AlvoSchema.nullable() })).length(2),
    fundo: RetanguloSchema,
    /* O `nome` cabe a AÇÃO inteira (80): na cena gerada pela IA, os marcáveis SÃO as duas
       ações em caixa alta (`prompts.ts#conteudoDaCenaGerada`). Com 40, uma ação de seis
       palavras passava na régua, era gravada, e o pacote não voltava legível — 500. */
    marcaveis: z.array(z.object({ id: z.string().min(1).max(40), nome: texto(80), area: RetanguloSchema })).min(1).max(10),
  }),
});
export type ConteudoDoPacoteDoContrato = z.infer<typeof ConteudoBaseSchema>;

// ─────────────────────────────────────────────────────────── entrada (estudante)

/** E1: o crachá — abre a sessão desta rodada. */
export const CrachaSchema = z.object({ cracha: CrachaIdSchema });

/**
 * E2: o relato da lupa. `foto1Ms`/`foto2Ms` = o tempo ACUMULADO da lente sobre
 * cada foto; `fundo1`/`fundo2` = a lente já passou pelo `cena.fundo` de cada
 * uma. Mande de tempos em tempos (`avancar: false`) e no toque do botão de
 * avançar (`avancar: true`). O servidor guarda o máximo, limita ao tempo desde
 * a entrada e, com `avancar`, confere o piso (3 s em cada foto + o fundo das duas).
 */
export const LupaSchema = z.object({
  foto1Ms: z.number().int().min(0).max(3_600_000),
  foto2Ms: z.number().int().min(0).max(3_600_000),
  fundo1: z.boolean(),
  fundo2: z.boolean(),
  avancar: z.boolean(),
});

/** E3: PUBLICAR CAPA — a foto, o selo e a posição da foto na moldura. LATCH 1. */
export const PublicarSchema = z.object({ fotoId: FotoIdSchema, seloId: SeloIdSchema, deslocamento: DeslocamentoSchema });

/** E4, Momento 4: um toque na foto `fotoId`, no ponto (x, y) DA PANORÂMICA. */
export const ToqueSchema = z.object({ fotoId: FotoIdSchema, x: n100, y: n100 });

/** E4, Momento 5: os toques na cena inteira ("o que ficou fora"), em coordenadas da panorâmica. Zero toques vale. */
export const ForaSchema = z.object({ toques: z.array(PontoSchema).max(TOQUES_FORA_MAX) });

/** E5: o par de cartas e o motivo. */
export const ParesSchema = z.object({
  cartas: z.tuple([z.string().min(1).max(20), z.string().min(1).max(20)]),
  motivo: MotivoSchema,
});

/** E5: a segunda foto — o elemento escolhido e a posição na moldura fixa. */
export const SegundaFotoSchema = z.object({ elemento: ElementoSchema, deslocamento: DeslocamentoSchema });

/** E6: o voto. LATCH 2 — conclui a missão. */
export const TransferenciaSchema = z.object({ opcao: VotoSchema });

// ─────────────────────────────────────────────────────────── saída (estudante)

const AtividadeSchema = z.object({ pacoteId: z.string(), rodada: z.number().int() });

/** O estado da missão do estudante — a resposta de TODO POST de estudante. Allowlist: nada do gabarito. */
export const EstadoSchema = z.object({
  passo: PassoSchema,
  /** A fase da TURMA (`aberta` | `virada`); `null` sem pacote no ar. */
  fase: FaseSchema.nullable(),
  /** Há pacote no ar? Sem ele a tela é de espera (a missão nasce vazia). */
  preparada: z.boolean(),
  /** Publicou e a turma ainda está na fase `aberta`: "AGUARDE O PROFESSOR". */
  aguardandoVirada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  cracha: CrachaIdSchema.nullable(),
  lupa: z
    .object({
      foto1Ms: z.number().int(),
      foto2Ms: z.number().int(),
      fundo1: z.boolean(),
      fundo2: z.boolean(),
      alertas: z.number().int(),
      liberada: z.boolean(),
    })
    .nullable(),
  /** A capa publicada (LATCH 1). `visivel` é o retângulo da panorâmica que a moldura mostrou. */
  capa: z
    .object({
      fotoId: FotoIdSchema,
      /** A outra foto do banco — a da direita/esquerda no split da virada. */
      outraFotoId: FotoIdSchema,
      seloId: SeloIdSchema,
      deslocamento: DeslocamentoSchema,
      visivel: RetanguloSchema,
      /** A fala da visitante ("Na foto, vi crianças lendo!" ou "Na foto, vi a biblioteca!"). */
      visitante: z.string(),
      publicadaEm: z.string(),
    })
    .nullable(),
  /** A busca dos invariantes — só depois da virada. */
  invariantes: z
    .object({
      encontrados: z.array(AchadoSchema),
      erros: z.number().int(),
      /** Três erros: a ajuda acendeu, e `alvos` desce para o pulso amarelo. */
      ajuda: z.boolean(),
      alvos: z.array(z.object({ id: InvarianteIdSchema, x: z.number(), y: z.number(), r: z.number() })).nullable(),
      /**
       * O alvo de cada invariante JÁ ACHADO (em ao menos uma foto): deixou de
       * ser gabarito, e é o que a tela precisa para redesenhar os círculos e as
       * linhas douradas depois de um F5. O não achado só desce em `alvos`, com a ajuda.
       */
      achados: z.array(z.object({ id: InvarianteIdSchema, x: z.number(), y: z.number(), r: z.number() })),
      completo: z.boolean(),
    })
    .nullable(),
  panoramicaAberta: z.boolean(),
  /** Os toques que o estudante deu no "o que ficou fora" (o eco do que ele mandou — sem o gabarito). */
  fora: z.object({ toques: z.array(PontoSchema) }).nullable(),
  pares: z.object({ cartas: z.array(z.string()), motivo: MotivoSchema }).nullable(),
  segundaFoto: z.object({ elemento: ElementoSchema, deslocamento: DeslocamentoSchema }).nullable(),
  transferencia: z.object({ voto: VotoSchema }).nullable(),
  concluido: z.boolean(),
});

/** A cena SEM o gabarito — o que a tela desenha. */
export const CenaDoEstudanteSchema = z.object({
  chave: ChaveDeCenaSchema,
  espaco: z.string(),
  espacoCurto: z.string(),
  hora: z.string(),
  imagem: ImagemSchema,
  alt: z.string(),
  /** Sem `nucleo`, `visitante` e `seloCoerente`. Rótulo da tela: `FOTO 1 — {ESPACO} {hora}`. */
  fotos: z.array(z.object({ id: FotoIdSchema, recorte: RetanguloSchema, acao: z.string() })),
  /** Sem a coerência. */
  selos: z.array(z.object({ id: SeloIdSchema, texto: z.string(), emoji: z.string() })),
  /** Só os nomes — o alvo é gabarito (desce em `estado.invariantes.alvos` depois da ajuda). */
  invariantes: z.array(z.object({ id: InvarianteIdSchema, nome: z.string() })),
  /** A parede comum: onde a lupa pulsa (a dica, não o gabarito). */
  fundo: RetanguloSchema,
});

/**
 * As constantes de geometria (não são gabarito): a tela as recebe daqui e não
 * as duplica. As molduras são FRAÇÃO do recorte (`w: 0.8` = 80% da largura da foto).
 */
export const GeometriaSchema = z.object({
  proporcaoDaPanoramica: z.number(),
  recortes: z.object({ "foto-1": RetanguloSchema, "foto-2": RetanguloSchema }),
  faixaComum: z.object({ de: z.number(), ate: z.number() }),
  molduraDaCapa: z.object({ w: z.number(), h: z.number() }),
  segundaFoto: z.object({ proporcao: z.number(), moldura: z.object({ w: z.number(), h: z.number() }) }),
  pisoDaLupaMs: z.number().int(),
  toquesForaMax: z.number().int(),
});

/**
 * O material FIXO da missão (igual em todo pacote): os crachás, a E5 e a E6.
 * Fica em `material` e não no topo porque o `Estado` já usa `segundaFoto` e
 * `transferencia` para o que o estudante FEZ.
 */
export const MaterialFixoSchema = z.object({
  crachas: z.array(z.object({ id: CrachaIdSchema, rotulo: z.string(), emoji: z.string() })),
  /** E5, os pares: SÓ id e imagem (a atividade e a cor são o gabarito). */
  cartas: z.array(z.object({ id: z.string(), imagem: ImagemSchema })),
  motivos: z.array(z.object({ id: MotivoSchema, rotulo: z.string() })),
  segundaFoto: z.object({ imagem: ImagemSchema, elementos: z.array(z.object({ id: ElementoSchema, rotulo: z.string() })) }),
  transferencia: z.object({ imagem: ImagemSchema, opcoes: z.array(z.object({ id: VotoSchema, rotulo: z.string(), emoji: z.string() })) }),
});

/** `GET /enigma-capa/sessao`: o estado, a cena SEM gabarito, a geometria, o material fixo e os textos. */
export const SessaoSchema = EstadoSchema.extend({
  /** `null` sem pacote no ar. */
  cena: CenaDoEstudanteSchema.nullable(),
  geometria: GeometriaSchema,
  material: MaterialFixoSchema,
  textos: z.record(z.string(), z.record(z.string(), z.string())),
  tempos: z.object({ toqueLiberadoMs: z.number(), inatividadeMs: z.number(), esperaDoProfessorMs: z.number(), pollingMs: z.number() }),
});

/** O polling de 3 s: leve. `rodada` muda quando o professor zera; `fase` quando libera a virada. */
export const GateDoEstudanteSchema = z.object({
  preparada: z.boolean(),
  fase: FaseSchema.nullable(),
  rodada: z.number().int().nullable(),
  atividade: AtividadeSchema.nullable(),
  passo: PassoSchema,
  /** O instante do SERVIDOR (ISO). */
  agora: z.string(),
});

export const RespostaDaLupaSchema = EstadoSchema.extend({
  /** O piso foi cumprido e o avanço liberado (passo `decidir`). */
  liberado: z.boolean(),
  /** Tentou avançar sem o piso: a tela vibra e mostra "OLHE O FUNDO" (o alerta contou). */
  alerta: z.boolean(),
});

export const RespostaDoPublicarSchema = EstadoSchema.extend({ visitante: z.string() });

export const RespostaDoToqueSchema = EstadoSchema.extend({
  toque: z.object({
    /** O invariante acertado, ou `null` (a ondulação cinza neutra). */
    acerto: InvarianteIdSchema.nullable(),
    encontrados: z.array(AchadoSchema),
    erros: z.number().int(),
    /** A ajuda está acesa (acendeu agora ou antes). */
    ajuda: z.boolean(),
    /** Só com a ajuda acesa: os alvos para o pulso amarelo. */
    alvos: z.array(z.object({ id: InvarianteIdSchema, x: z.number(), y: z.number(), r: z.number() })).optional(),
    /** O alvo dos invariantes já achados (o mesmo de `estado.invariantes.achados`). */
    achados: z.array(z.object({ id: InvarianteIdSchema, x: z.number(), y: z.number(), r: z.number() })),
    /** Os quatro achados: os círculos dourados unem os pares e o slider aparece. */
    completo: z.boolean(),
  }),
});

// ─────────────────────────────────────────────────────────── entrada (professor)

/** O recorte da aula que o professor pede à IA (one-pager §9a). */
export const GerarSchema = z.object({
  disciplina: DisciplinaSchema,
  tema: z.string().trim().min(TEMA.min).max(TEMA.max),
  palavras: z.array(z.string().trim().min(2).max(PALAVRAS.maxCaracteres)).min(PALAVRAS.min).max(PALAVRAS.max),
  nota: z.string().trim().max(NOTA_MAX).optional().nullable(),
});

/** O professor toca nos dois objetos iguais na imagem do rascunho (coordenadas da panorâmica). */
export const AlvosDoRascunhoSchema = z.object({
  alvos: z
    .array(z.object({ id: InvarianteIdSchema, x: n100, y: n100 }))
    .length(2)
    .refine((a) => new Set(a.map((x) => x.id)).size === 2, "um toque para cada objeto"),
});

/**
 * "Aprovar": o rascunho vira atividade PRONTA. `rascunhoId` é o que o
 * professor VIU (outra aba que gerou de novo dá 409). `selos` e `falas`
 * opcionais: a edição dos textos curtos que o one-pager §9a permite.
 */
export const HomologarSchema = z.object({
  rascunhoId: z.string().uuid(),
  selos: z.array(z.object({ id: SeloIdSchema, texto: texto(40), emoji: texto(16) })).length(2).optional(),
  falas: z.array(z.object({ fotoId: FotoIdSchema, visitante: texto(80) })).length(2).optional(),
});

export const BancoPadraoSchema = z.object({ chave: z.enum(CHAVES_PRONTAS) });
export const GateSchema = z.object({ para: z.literal("virada") });
export const NovaRodadaSchema = z.object({ rodada: z.number().int().min(1) });
export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────────── saída (professor)

const TurmaSchema = z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() });

export const TurmasSchema = z.object({ turmas: z.array(TurmaSchema.extend({ estudantes: z.number().int() })) });

/** O pacote como o professor o vê: COM o gabarito (é o roteiro dele). */
export const PacoteDoProfessorSchema = z.object({
  id: z.string(),
  disciplina: DisciplinaSchema,
  tema: z.string(),
  palavras: z.array(z.string()),
  nota: z.string().nullable(),
  chaveDaCena: ChaveDeCenaSchema,
  origem: OrigemSchema,
  conteudo: ConteudoBaseSchema,
  aprovadoEm: z.string().nullable(),
  ativo: z.boolean(),
  rodadaAtual: z.number().int(),
  /** Para o rascunho: o que ainda falta para aprovar (vazio = pode aprovar). */
  pendencias: z.array(z.string()),
});

const ProntoSchema = z.object({ chave: z.enum(CHAVES_PRONTAS), nome: z.string(), disciplina: DisciplinaSchema, tema: z.string(), conteudo: ConteudoBaseSchema });

export const PacoteDaTurmaSchema = z.object({
  turma: TurmaSchema,
  ativo: PacoteDoProfessorSchema.nullable(),
  rascunho: PacoteDoProfessorSchema.nullable(),
  prontos: z.array(ProntoSchema),
  disciplinas: z.array(z.object({ slug: DisciplinaSchema, rotulo: z.string() })),
});

export const RascunhoSchema = z.object({ rascunho: PacoteDoProfessorSchema.nullable() });

export const GerarRespostaSchema = z.object({
  rascunho: PacoteDoProfessorSchema,
  usouIa: z.boolean(),
  motivo: z.enum(["sem-saldo", "indisponivel"]).nullable(),
});

export const GateDaTurmaSchema = z.object({ fase: FaseSchema, atividade: AtividadeSchema, atualizadoEm: z.string() });
export const NovaRodadaRespostaSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema });
export const EmAndamentoSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema, mudou: z.boolean() });

export const PacotesDaTurmaSchema = z.object({
  emAndamento: AtividadeSchema.nullable(),
  historico: z.array(
    z.object({
      id: z.string(),
      disciplina: DisciplinaSchema,
      tema: z.string(),
      chaveDaCena: ChaveDeCenaSchema,
      origem: OrigemSchema,
      ativo: z.boolean(),
      aprovadoEm: z.string(),
      rodadas: z.number().int(),
    }),
  ),
});

export const PacoteDetalheSchema = PacoteDoProfessorSchema.extend({ rodadas: z.number().int() });

/** Uma linha do painel: o progresso e as escolhas de UM estudante (ou de um computador, com equipe). */
export const LinhaDoPainelSchema = z.object({
  estudanteId: z.string(),
  nome: z.string(),
  equipe: z.object({ id: z.string(), nome: z.string(), membros: z.array(z.object({ id: z.string(), nome: z.string() })) }).nullable(),
  passo: PassoSchema,
  /** Publicou e a turma ainda não virou. */
  aguardandoVirada: z.boolean(),
  cracha: CrachaIdSchema.nullable(),
  lupa: z.object({ foto1Ms: z.number().int(), foto2Ms: z.number().int(), alertas: z.number().int(), liberada: z.boolean() }).nullable(),
  capa: z
    .object({ fotoId: FotoIdSchema, seloId: SeloIdSchema, seloCoerente: z.boolean(), visitante: z.string(), nucleoVisivel: z.boolean() })
    .nullable(),
  invariantes: z
    .object({ encontrados: z.number().int(), erros: z.number().int(), ajuda: z.boolean(), errosPosAjuda: z.number().int(), completo: z.boolean() })
    .nullable(),
  /** O que marcou "fora da foto" (nomes), e quantas coisas ficaram fora de verdade. */
  fora: z.object({ itens: z.array(z.object({ id: z.string(), nome: z.string() })), possiveis: z.number().int() }).nullable(),
  par: z.object({ cartas: z.array(z.string()), motivo: MotivoSchema, correto: z.boolean() }).nullable(),
  segundaFoto: z.object({ elemento: ElementoSchema, essencialVisivel: z.boolean() }).nullable(),
  voto: VotoSchema.nullable(),
});

export const PainelSchema = z.object({
  turma: TurmaSchema,
  atividade: z.object({ pacoteId: z.string(), rodada: z.number().int(), tema: z.string(), espaco: z.string() }).nullable(),
  fase: FaseSchema.nullable(),
  porComputador: z.boolean(),
  resumo: z.object({
    unidades: z.number().int(),
    entraram: z.number().int(),
    publicaram: z.number().int(),
    aguardandoVirada: z.number().int(),
    concluiram: z.number().int(),
    votos: z.object({ "so-um-pedaco": z.number().int(), "mostra-tudo": z.number().int() }),
  }),
  linhas: z.array(LinhaDoPainelSchema),
  roteiro: z.object({
    introducao: z.string(),
    regraDoArraste: z.string(),
    pausa: z.string(),
    cartoes: z.array(z.string()),
    perguntas: z.array(z.string()),
    ponte: z.string(),
    liberar: z.string(),
  }),
});

export const MaterialSchema = z.object({
  prontos: z.array(ProntoSchema),
  roteiro: PainelSchema.shape.roteiro,
  cartas: z.array(z.object({ id: z.string(), descricao: z.string(), atividade: z.string(), cor: z.string() })),
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
});

// ─────────────────────────────────────────────────────────── os tipos que a tela e o hub importam

export type Estado = z.infer<typeof EstadoSchema>;
export type Sessao = z.infer<typeof SessaoSchema>;
export type GateDoEstudante = z.infer<typeof GateDoEstudanteSchema>;
export type RespostaDaLupa = z.infer<typeof RespostaDaLupaSchema>;
export type RespostaDoPublicar = z.infer<typeof RespostaDoPublicarSchema>;
export type RespostaDoToque = z.infer<typeof RespostaDoToqueSchema>;
export type CenaDoEstudante = z.infer<typeof CenaDoEstudanteSchema>;
export type Geometria = z.infer<typeof GeometriaSchema>;
export type Painel = z.infer<typeof PainelSchema>;
export type LinhaDoPainel = z.infer<typeof LinhaDoPainelSchema>;
export type PacoteDoProfessor = z.infer<typeof PacoteDoProfessorSchema>;
export type PacoteDaTurma = z.infer<typeof PacoteDaTurmaSchema>;
export type GerarResposta = z.infer<typeof GerarRespostaSchema>;

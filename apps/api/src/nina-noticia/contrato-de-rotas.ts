import { z } from "zod";
import { FERRAMENTAS_DO_CASO } from "./conteudo";
import { problemasDoPacote } from "./invariantes";
import { ID_OPACO_RE } from "./regras/ordem";
import { PASSOS_PEDIDOS } from "./regras/passos";
import {
  ACOES_DO_GATE,
  BLOCOS,
  CAMPOS,
  CARIMBOS,
  CARTOES,
  CHAVES_DAS_CENAS_FIXAS,
  CHAVES_DAS_IMAGENS,
  DESFECHOS,
  DIAS,
  DISCIPLINAS,
  ETAPAS,
  ETIQUETAS,
  LUGARES,
  MARCAS_DA_ROTINA,
  ORIGENS_DO_PACOTE,
  PASSOS,
  PESSOAS,
  SUPORTES,
  VALORES_DO_FILTRO,
} from "./vocabulario";

/**
 * O contrato HTTP da exp03ef1b — só schemas Zod, nenhum decorator. O OpenAPI é
 * derivado daqui (ADR-36), e os controllers declaram `@Contrato` com estes
 * nomes. Os enums vêm do vocabulário e das regras, nunca reescritos.
 *
 * A saída do ESTUDANTE é ALLOWLIST explícita. O que não desce:
 *
 * - o GABARITO: o certo dos cartões K1–K6, a sequência certa da rotina e a
 *   regra do reparo ficam no servidor (regra 3). A criança recebe o desfecho
 *   do reparo (E4-04/E4-05) e a validade da rotina DEPOIS de enviar — a tela é
 *   esse retorno; os carimbos não têm retorno nenhum;
 * - a FICHA antes da hora: nenhuma ficha desce antes do passo `ficha` — em
 *   especial o Onde VAZIO do telão, que é o que a busca vai revelar;
 * - a identidade dos itens: reportagens (`rp-`), etiquetas (`et-`) e blocos
 *   (`bl-`) têm ids OPACOS por sessão, e os blocos descem embaralhados.
 *
 * A seção ROTAS, no fim, lista método + caminho + schemas de cada rota: é o
 * índice que a experiência e o hub consultam.
 */

// ------------------------------------------------------------------ comuns

export const PassoSchema = z.enum(PASSOS);
export const EtapaSchema = z.enum(ETAPAS);
export const SuporteSchema = z.enum(SUPORTES);
export const CampoSchema = z.enum(CAMPOS);
export const CarimboSchema = z.enum(CARIMBOS);
export const CartaoSchema = z.enum(CARTOES);
export const EtiquetaSchema = z.enum(ETIQUETAS);
export const BlocoSchema = z.enum(BLOCOS);
export const DesfechoSchema = z.enum(DESFECHOS);
export const DisciplinaSchema = z.enum(DISCIPLINAS);
export const OrigemDoPacoteSchema = z.enum(ORIGENS_DO_PACOTE);
export const ChaveDaImagemSchema = z.enum(CHAVES_DAS_IMAGENS);
export const ChaveDaCenaFixaSchema = z.enum(CHAVES_DAS_CENAS_FIXAS);
/** As chaves das imagens do BANCO PADRÃO (admin): as do pacote e as cenas fixas. */
export const ChaveDoBancoSchema = z.enum([...CHAVES_DAS_IMAGENS, ...CHAVES_DAS_CENAS_FIXAS]);

/** Ids opacos por sessão: não dizem o que o item é. */
export const IdDeReportagemSchema = z.string().regex(ID_OPACO_RE.rp);
export const IdDeEtiquetaSchema = z.string().regex(ID_OPACO_RE.et);
export const IdDeBlocoSchema = z.string().regex(ID_OPACO_RE.bl);

/** Uma ficha: os três campos, `null` = campo VAZIO. */
export const FichaSchema = z.object({
  quem: z.enum(PESSOAS).nullable(),
  onde: z.enum(LUGARES).nullable(),
  quando: z.enum(DIAS).nullable(),
});

const ImagemPublicaSchema = z.object({
  /** `null` enquanto a imagem não existe (ou falhou): a tela desenha a ilustração SVG local. */
  url: z.string().nullable(),
  alt: z.string(),
});

// -------------------------------------------------------- entrada: estudante

/** Os selos da E1 ("Mesma feira" em cada cartão). Com os três, o passo vai a `aposta`. */
export const SelosSchema = z.object({ reportagens: z.array(IdDeReportagemSchema).min(1).max(SUPORTES.length) });

/**
 * O "Travar Escolha" da E2 — o LATCH. Sem `min`: a caixa vazia é o 409
 * `previsao-vazia`, com a frase da tela.
 */
export const PrevisaoSchema = z.object({ itens: z.array(IdDeReportagemSchema).max(SUPORTES.length) });

/**
 * A busca da E3: um campo e um valor DA PASTILHA dele. Onde = Pátio leva à
 * omissão; o resto devolve zero e conta uma tentativa.
 */
export const FiltroSchema = z.discriminatedUnion("campo", [
  z.object({ campo: z.literal("quem"), valor: z.enum(VALORES_DO_FILTRO.quem) }),
  z.object({ campo: z.literal("onde"), valor: z.enum(VALORES_DO_FILTRO.onde) }),
  z.object({ campo: z.literal("quando"), valor: z.enum(VALORES_DO_FILTRO.quando) }),
]);

/** A ficha do telão aberta (E4-01). `dica` = o pulso de 15 s disparou antes de abrir. */
export const FichaAbertaSchema = z.object({ dica: z.boolean() });

const carimbosDe = <K extends string>(cartoes: readonly [K, ...K[]]) =>
  z.object(Object.fromEntries(cartoes.map((k) => [k, CarimboSchema])) as Record<K, typeof CarimboSchema>).strict();

/** Os carimbos de uma etapa: os três cartões dela, cada um com ✔ (`v`), ✖ (`x`) ou ? (`duvida`). */
export const CarimbosSchema = z.discriminatedUnion("etapa", [
  z.object({ etapa: z.literal("e4"), carimbos: carimbosDe(["k1", "k2", "k3"]) }),
  z.object({ etapa: z.literal("e6"), carimbos: carimbosDe(["k4", "k5", "k6"]) }),
]);

/**
 * O "Concluir" do reparo (E4-03, spec §7.6): a ficha do telão MONTADA — o id
 * da etiqueta em cada campo, as três posicionadas, uma por campo (a mesma em
 * dois campos é 409 `reparo-incompleto`). O servidor decide o desfecho.
 */
export const ReparoSchema = z.object({
  ficha: z.object({ quem: IdDeEtiquetaSchema, onde: IdDeEtiquetaSchema, quando: IdDeEtiquetaSchema }),
});

/** Os avanços sem dado: "Confrontar e Aguardar Turma ▶" (→ ficha), o "Continuar" do desfecho (→ ponte) e o da ponte (→ rotina). */
export const PedirPassoSchema = z.object({ para: z.enum(PASSOS_PEDIDOS) });

/** O "Testar Rotina": os ids na ordem da esteira (os sete). */
export const RotinaSchema = z.object({ sequencia: z.array(IdDeBlocoSchema).max(BLOCOS.length) });

/** O fim: exige os carimbos da E6 gravados. Sem corpo. */
export const ConcluirSchema = z.object({}).strict();

// --------------------------------------------------------- saída: estudante

/** Uma reportagem do jornal — ALLOWLIST: sem ficha. */
export const ReportagemPublicaSchema = z.object({
  id: IdDeReportagemSchema,
  suporte: SuporteSchema,
  /** O kicker do cartão: "Mural Impresso", "Portal da Escola", "Telão do Corredor". */
  kicker: z.string(),
  manchete: z.string(),
  legenda: z.string(),
  /** O rótulo do ícone de lugar ("Pátio escolar") — o que a FOTO mostra, igual nas três. */
  lugar: z.string(),
  imagem: ImagemPublicaSchema,
});

export const CartazPublicoSchema = z.object({ texto: z.string(), imagem: ImagemPublicaSchema });

/** O estado de passo e portão, que toda jogada devolve. */
export const EstadoSchema = z.object({
  /** Já reconciliado com a etapa da turma (`passoEfetivo`). */
  passo: PassoSchema,
  etapa: EtapaSchema,
  pausada: z.boolean(),
  /** O gravado passou do teto da etapa: o overlay de espera, sem botão. */
  aguardandoOProfessor: z.boolean(),
});

/** O `GET gate` do polling de 3 s: o relógio da turma e o passo efetivo DESTE computador. */
export const GatePublicoSchema = EstadoSchema.extend({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
});

export const BlocoPublicoSchema = z.object({ id: IdDeBlocoSchema, bloco: BlocoSchema, rotulo: z.string() });
export const EtiquetaPublicaSchema = z.object({ id: IdDeEtiquetaSchema, etiqueta: EtiquetaSchema, rotulo: z.string() });

export const PassoDaSimulacaoSchema = z.object({
  manchete: z.string(),
  marca: z.enum(MARCAS_DA_ROTINA),
  /** A pilha depois desta ficha: 2, 1, 0. */
  pendentes: z.number().int().min(0),
});

const MateriaDoCasoPublicaSchema = z.object({
  id: z.enum(["a", "b"]),
  titulo: z.string(),
  ficha: FichaSchema,
  imagem: ImagemPublicaSchema,
});

const FerramentaPublicaSchema = z.object({
  id: z.enum(FERRAMENTAS_DO_CASO),
  rotulo: z.string(),
  /** O retorno NEUTRO da ferramenta (não é gabarito). */
  retorno: z.string(),
  aviso: z.string().nullable(),
});

/** O "Painel da Investigação" (E6-03): o resumo da PRÓPRIA sessão, em quatro colunas. */
export const ResumoDaInvestigacaoSchema = z.object({
  suportes: z.object({ escolhidas: z.number().int().min(0).max(SUPORTES.length) }),
  omissao: z.object({ encontradas: z.number().int().min(0), deFora: SuporteSchema }),
  reparo: z.object({ desfecho: DesfechoSchema }),
  automacao: z.object({ testes: z.number().int().min(0) }),
});

/**
 * O estado do estudante. Cada bloco só aparece do passo dele em diante —
 * `null` antes. O passo usado para decidir é o EFETIVO.
 */
export const SessaoSchema = EstadoSchema.extend({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  /** O gravado. */
  passoDoEstudante: PassoSchema,
  /** O jornal (E1): o tema, o cartaz comum e as três reportagens, SEM ficha. */
  jornal: z.object({
    tema: z.string(),
    cartaz: CartazPublicoSchema,
    reportagens: z.array(ReportagemPublicaSchema).length(SUPORTES.length),
  }),
  /** Os cartões com "Mesma feira" aceso. */
  selos: z.array(IdDeReportagemSchema),
  /** A escolha da E2: os itens na caixa e se já está travada. */
  previsao: z.object({ itens: z.array(IdDeReportagemSchema), travada: z.boolean() }),
  /** Do passo `omissao` em diante: o que a busca certa encontrou (as duas do pátio). */
  filtro: z.object({ encontradas: z.array(IdDeReportagemSchema) }).nullable(),
  /** Do passo `ficha` em diante: a ficha do TELÃO, com o Onde vazio, e se já foi aberta. */
  ficha: z.object({ reportagemId: IdDeReportagemSchema, ficha: FichaSchema, aberta: z.boolean() }).nullable(),
  /** Os carimbos que ESTA criança deu (sem correção). */
  carimbos: z.object({
    e4: z.record(CartaoSchema, CarimboSchema).nullable(),
    e6: z.record(CartaoSchema, CarimboSchema).nullable(),
  }),
  /** Do passo `reparo` em diante: a bandeja, a ficha enviada (por etiqueta) e o desfecho. */
  reparo: z
    .object({
      etiquetas: z.array(EtiquetaPublicaSchema).length(ETIQUETAS.length),
      enviada: z.record(CampoSchema, IdDeEtiquetaSchema).nullable(),
      desfecho: DesfechoSchema.nullable(),
    })
    .nullable(),
  /** Do passo `rotina` em diante: os blocos na ordem da BANDEJA (embaralhada) e a validade. */
  rotina: z
    .object({
      blocos: z.array(BlocoPublicoSchema).length(BLOCOS.length),
      valida: z.boolean(),
      /** A simulação, depois da rotina válida (F5 na tela de sucesso). */
      simulacao: z.array(PassoDaSimulacaoSchema).nullable(),
    })
    .nullable(),
  /** Do passo `caso` em diante: o Festival de Ciências e as três ferramentas. */
  caso: z
    .object({
      tema: z.string(),
      materias: z.array(MateriaDoCasoPublicaSchema).length(2),
      ferramentas: z.array(FerramentaPublicaSchema).length(FERRAMENTAS_DO_CASO.length),
    })
    .nullable(),
  /** No `fim`: o Painel da Investigação (só leitura). O Desafio Extra saiu (ADR-201). */
  fim: z
    .object({
      resumo: ResumoDaInvestigacaoSchema,
    })
    .nullable(),
  concluida: z.boolean(),
});

export const RespostaDosSelosSchema = EstadoSchema.extend({ selos: z.array(IdDeReportagemSchema) });

/** A busca: as encontradas (ids da sessão). Zero = a dupla fica na E3 e tenta de novo. */
export const RespostaDoFiltroSchema = EstadoSchema.extend({
  encontradas: z.array(IdDeReportagemSchema),
  total: z.number().int().min(0),
});

export const RespostaDaFichaSchema = EstadoSchema.extend({
  ficha: z.object({ reportagemId: IdDeReportagemSchema, ficha: FichaSchema }),
});

/** O reparo: o desfecho decide a tela (E4-04 sucesso | E4-05 erro), as duas com "Continuar". */
export const RespostaDoReparoSchema = EstadoSchema.extend({ desfecho: DesfechoSchema });

/** A rotina: válida → a simulação; inválida → E5-SIS-01 ("A rotina não para."). */
export const RespostaDaRotinaSchema = EstadoSchema.extend({
  valida: z.boolean(),
  simulacao: z.array(PassoDaSimulacaoSchema).nullable(),
});

export const RespostaDoConcluirSchema = EstadoSchema.extend({ resumo: ResumoDaInvestigacaoSchema });

// ----------------------------------------------------- entrada: professora

export const ParametrosDoPreparoSchema = z.object({
  disciplina: DisciplinaSchema,
  /** "Tema do Evento" (≤ 60). */
  tema: z.string().trim().min(3).max(60),
  /** "Assunto da matéria" (spec §7.2). */
  assuntos: z.string().trim().min(3).max(300),
  contexto: z.string().trim().max(120).optional(),
});

const ImagemDescritaSchema = z.object({
  descricao: z.string().trim().min(10).max(300),
  alt: z.string().trim().min(3).max(160),
});

/** Uma reportagem do pacote como ela é ESCRITA — a estrutura é conferida por `problemasDoPacote`. */
export const ReportagemDoPacoteSchema = z.object({
  suporte: SuporteSchema,
  manchete: z.string().trim().min(2).max(40),
  legenda: z.string().trim().min(5).max(140),
  lugar: z.enum(LUGARES),
  ficha: FichaSchema,
  imagem: ImagemDescritaSchema,
});

const CartazDoPacoteSchema = z.object({ texto: z.string().trim().min(3).max(60), imagem: ImagemDescritaSchema });

/** O pacote como ele é ESCRITO (homologar, preparo, banco padrão), com a régua inteira. */
export const ConteudoDoPacoteSchema = z
  .object({
    tema: z.string().trim().min(3).max(60),
    cartaz: CartazDoPacoteSchema,
    reportagens: z.array(ReportagemDoPacoteSchema).length(SUPORTES.length),
  })
  .superRefine((conteudo, ctx) => {
    for (const problema of problemasDoPacote(conteudo)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
  });

/**
 * O que a IA DEVOLVE (só texto): o servidor põe a estrutura por cima
 * (`conteudo.ts#aplicarEstrutura`) e só então a régua vale. O que a IA mandar
 * de ficha ou lugar é descartado pelo `strip` do Zod.
 */
export const TextosGeradosSchema = z.object({
  tema: z.string().trim().min(3).max(60),
  cartaz: CartazDoPacoteSchema,
  reportagens: z
    .array(
      z.object({
        suporte: SuporteSchema,
        manchete: z.string().trim().min(2).max(40),
        legenda: z.string().trim().min(5).max(140),
        imagem: ImagemDescritaSchema,
      }),
    )
    .length(SUPORTES.length),
});

export const HomologacaoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
  /** Quando a professora ABRIU o preparo; o servidor aceita só as últimas 24 h. */
  preparoIniciadoEm: z.string().datetime().optional(),
});

/** "Regenerar Notícia": UMA reportagem, sobre o rascunho como está na tela. */
export const RegenerarReportagemSchema = ParametrosDoPreparoSchema.extend({
  conteudo: ConteudoDoPacoteSchema,
  suporte: SuporteSchema,
});

/**
 * O clique da professora: `liberar` (a próxima etapa; `para` opcional, tem de
 * ser a próxima — a mesma é no-op), `pausar` ou `retomar`.
 */
export const GateSchema = z
  .object({ acao: z.enum(ACOES_DO_GATE), para: EtapaSchema.optional() })
  .refine((g) => g.acao === "liberar" || g.para === undefined, { message: "`para` só com `liberar`" });

/** "Usar Banco Padrão" (E0-PROF-02). `porNoAr` faz o "usar e pôr no ar" de um toque. */
export const BancoPadraoSchema = z.object({ porNoAr: z.boolean().default(false) });

/** `?pacoteId=` das rotas de imagem: a atividade PRONTA sendo preparada. */
export const QueryDoPacoteSchema = z.object({
  escolaId: z.string().optional(),
  pacoteId: z.string().uuid().optional(),
});

// ------------------------------------------------------ saída: professora

const TurmaResumoSchema = z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() });

export const TurmasSchema = z.object({
  turmas: z.array(TurmaResumoSchema.extend({ estudantes: z.number().int().min(0) })),
});

const PacoteResumoSchema = z.object({
  id: z.string().uuid(),
  disciplina: DisciplinaSchema,
  tema: z.string(),
  origem: OrigemDoPacoteSchema,
});

const MidiaResumoSchema = z.object({ total: z.number().int().min(0), prontas: z.number().int().min(0) });

/**
 * O rascunho do preparo (E0-PROF-03/04) — não persiste; só `homologar` grava.
 * `usouIa: false` é o FALLBACK: sem cota ou com a IA fora do ar, o conteúdo é
 * o banco padrão, e `motivo` diz por quê.
 */
export const RascunhoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
  usouIa: z.boolean(),
  origem: OrigemDoPacoteSchema,
  motivo: z.enum(["sem-saldo-de-ia", "ia-indisponivel"]).nullable(),
  /** As URLs que o rascunho JÁ tem, por chave (só o banco padrão traz). */
  imagens: z.record(ChaveDaImagemSchema, z.string()),
});

export const ReportagemRegeneradaSchema = z.object({ reportagem: ReportagemDoPacoteSchema, usouIa: z.boolean() });

/** O pacote como as telas da professora o mostram. */
const PacoteNaTelaSchema = PacoteResumoSchema.extend({
  assuntos: z.string(),
  conteudo: ConteudoDoPacoteSchema,
  midia: MidiaResumoSchema,
  imagens: z.record(ChaveDaImagemSchema, z.string()),
});

/** A atividade criada: nasce PRONTA (ADR-130). */
export const PacoteHomologadoSchema = PacoteResumoSchema.extend({ ativo: z.boolean() });

export const PacotesSchema = z.object({
  /** A atividade EM ANDAMENTO, ou `null`. */
  ativo: PacoteNaTelaSchema.extend({ rodada: z.number().int().positive(), etapa: EtapaSchema }).nullable(),
  historico: z.array(
    PacoteResumoSchema.extend({
      ativo: z.boolean(),
      criadoEm: z.string(),
      rodadas: z.number().int().min(0),
      imagensAprovadas: z.boolean(),
    }),
  ),
});

export const PacoteDetalheSchema = PacoteNaTelaSchema.extend({
  ativo: z.boolean(),
  rodada: z.number().int().positive().nullable(),
  etapa: EtapaSchema.nullable(),
  criadoEm: z.string(),
  rodadas: z.number().int().min(0),
  /** `null` = a segunda fase não passou, e a atividade não vai ao ar. */
  imagensAprovadasEm: z.string().nullable(),
});

export const ImagensAprovadasSchema = z.object({ pacoteId: z.string().uuid(), imagensAprovadasEm: z.string() });

/** "Refazer imagem" de UMA chave (a do telão é a que a tela destaca). */
export const ImagemRefeitaSchema = z.object({
  pacoteId: z.string().uuid(),
  chave: ChaveDaImagemSchema,
  url: z.string(),
});

export const ProgressoDaMidiaSchema = z.object({
  pacoteId: z.string().uuid(),
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.number().int().min(0),
  geradas: z.array(ChaveDaImagemSchema),
  /** As que falharam NESTA chamada — seguem com a ilustração local. */
  falharam: z.array(ChaveDaImagemSchema),
  completo: z.boolean(),
  imagens: z.record(ChaveDaImagemSchema, z.string()),
});

export const EmAndamentoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  mudou: z.boolean(),
});

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não. **Só progresso e alerta** (`PROIBIDO_NA_LINHA_DO_PAINEL`,
 * com teste): nem a escolha, nem acerto, nem nível.
 */
export const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  equipe: z.object({ id: z.string().uuid(), nome: z.string() }).nullable(),
  entrou: z.boolean(),
  passo: PassoSchema,
  /** A etapa visível (1–6) do passo. */
  etapaVisivel: z.number().int().min(1).max(6),
  aguardando: z.boolean(),
  concluiu: z.boolean(),
  alertas: z.object({ semParada: z.boolean(), uniformes: z.boolean() }),
});

export const PainelSchema = z.object({
  turma: TurmaResumoSchema,
  pacote: PacoteResumoSchema.extend({ midia: MidiaResumoSchema }),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  pausada: z.boolean(),
  /** O próximo portão ("Liberar Filtro" / "Liberar Inspeção"), ou `null` depois do último. */
  proximaEtapa: EtapaSchema.nullable(),
  /** Ordem alfabética, sem ordenação por desempenho. */
  linhas: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    entraram: z.number().int().min(0),
    concluiram: z.number().int().min(0),
    porComputador: z.boolean(),
    /** "Equipes na etapa N" — chaves "1" a "6". */
    porEtapa: z.record(z.enum(["1", "2", "3", "4", "5", "6"]), z.number().int().min(0)),
    /** "Escolhas da Etapa 2": quantos escolheram 1/2/3 e qual ficou de fora. */
    escolhas: z.object({
      travadas: z.number().int().min(0),
      uma: z.number().int().min(0),
      duas: z.number().int().min(0),
      tres: z.number().int().min(0),
      deFora: z.record(SuporteSchema, z.number().int().min(0)),
    }),
    /** "Alertas da sala": quantos computadores com cada alerta (vazio = "Nenhum alerta crítico ativo"). */
    alertas: z.object({ semParada: z.number().int().min(0), uniformes: z.number().int().min(0) }),
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: TurmaResumoSchema,
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  pausada: z.boolean(),
  proximaEtapa: EtapaSchema.nullable(),
  mudou: z.boolean(),
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
});

/**
 * O material da professora (guia da aula): o esqueleto COM gabarito — os
 * cartões com o certo, a sequência da rotina, as fichas-teste, a regra do
 * reparo — o roteiro de mediação e os gatilhos de condução.
 */
export const MaterialSchema = z.object({
  pacote: z.object({ tema: z.string(), reportagens: z.array(ReportagemDoPacoteSchema) }).nullable(),
  cartoes: z.array(z.object({ id: CartaoSchema, figura: z.string(), pergunta: z.string(), certo: CarimboSchema })),
  rotina: z.object({ sequencia: z.array(z.object({ bloco: BlocoSchema, rotulo: z.string() })) }),
  fichasTeste: z.array(z.object({ manchete: z.string(), ficha: FichaSchema })),
  reparo: z.object({ regra: z.string() }),
  mediacao: z.array(z.object({ pergunta: z.string(), cuidado: z.string() })),
  gatilhos: z.array(z.string()),
});

// ───────────────────────────────────── admin: as imagens do banco padrão

/** As imagens do BANCO PADRÃO: as do pacote padrão e as cenas fixas (as duas do caso novo). */
export const ImagensDoBancoPadraoSchema = z.object({
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.array(ChaveDoBancoSchema),
  completo: z.boolean(),
  imagens: z.record(ChaveDoBancoSchema, z.string()),
});

export const GeracaoDoBancoPadraoSchema = ImagensDoBancoPadraoSchema.extend({
  geradas: z.array(ChaveDoBancoSchema),
  falharam: z.array(ChaveDoBancoSchema),
});

// ───────────────────────────────────────────────────────────── as ROTAS

type Rota = {
  metodo: "GET" | "POST" | "PUT";
  /** Relativo a `/nina-noticia`. */
  caminho: string;
  papel: "estudante" | "professor" | "admin";
  entrada: z.ZodTypeAny | null;
  saida: z.ZodTypeAny;
};

/**
 * O ÍNDICE das rotas: método, caminho (sob `/nina-noticia`), papel e os
 * schemas. Os controllers seguem esta lista; o teste confere que toda rota tem
 * saída e que nenhum caminho se repete.
 */
export const ROTAS = {
  // estudante
  sessao: { metodo: "GET", caminho: "sessao", papel: "estudante", entrada: null, saida: SessaoSchema },
  gate: { metodo: "GET", caminho: "gate", papel: "estudante", entrada: null, saida: GatePublicoSchema },
  selos: { metodo: "POST", caminho: "selos", papel: "estudante", entrada: SelosSchema, saida: RespostaDosSelosSchema },
  previsao: { metodo: "POST", caminho: "previsao", papel: "estudante", entrada: PrevisaoSchema, saida: EstadoSchema },
  filtro: { metodo: "POST", caminho: "filtro", papel: "estudante", entrada: FiltroSchema, saida: RespostaDoFiltroSchema },
  ficha: { metodo: "POST", caminho: "ficha", papel: "estudante", entrada: FichaAbertaSchema, saida: RespostaDaFichaSchema },
  carimbos: { metodo: "POST", caminho: "carimbos", papel: "estudante", entrada: CarimbosSchema, saida: EstadoSchema },
  reparo: { metodo: "POST", caminho: "reparo", papel: "estudante", entrada: ReparoSchema, saida: RespostaDoReparoSchema },
  passo: { metodo: "POST", caminho: "passo", papel: "estudante", entrada: PedirPassoSchema, saida: EstadoSchema },
  rotina: { metodo: "POST", caminho: "rotina", papel: "estudante", entrada: RotinaSchema, saida: RespostaDaRotinaSchema },
  concluir: {
    metodo: "POST",
    caminho: "concluir",
    papel: "estudante",
    entrada: ConcluirSchema,
    saida: RespostaDoConcluirSchema,
  },
  // professora
  turmas: { metodo: "GET", caminho: "turmas", papel: "professor", entrada: null, saida: TurmasSchema },
  painel: { metodo: "GET", caminho: "turmas/:turmaId/painel", papel: "professor", entrada: null, saida: PainelSchema },
  gateDaTurma: {
    metodo: "POST",
    caminho: "turmas/:turmaId/gate",
    papel: "professor",
    entrada: GateSchema,
    saida: GateDaTurmaSchema,
  },
  zerar: { metodo: "POST", caminho: "turmas/:turmaId/zerar", papel: "professor", entrada: null, saida: ZerarTurmaSchema },
  material: {
    metodo: "GET",
    caminho: "turmas/:turmaId/material",
    papel: "professor",
    entrada: null,
    saida: MaterialSchema,
  },
  bancoPadrao: {
    metodo: "POST",
    caminho: "turmas/:turmaId/banco-padrao",
    papel: "professor",
    entrada: BancoPadraoSchema,
    saida: PacoteHomologadoSchema,
  },
  gerarConteudo: {
    metodo: "POST",
    caminho: "turmas/:turmaId/gerar-conteudo",
    papel: "professor",
    entrada: ParametrosDoPreparoSchema,
    saida: RascunhoSchema,
  },
  regenerarReportagem: {
    metodo: "POST",
    caminho: "turmas/:turmaId/regenerar-reportagem",
    papel: "professor",
    entrada: RegenerarReportagemSchema,
    saida: ReportagemRegeneradaSchema,
  },
  homologar: {
    metodo: "POST",
    caminho: "turmas/:turmaId/homologar",
    papel: "professor",
    entrada: HomologacaoSchema,
    saida: PacoteHomologadoSchema,
  },
  pacotes: { metodo: "GET", caminho: "turmas/:turmaId/pacotes", papel: "professor", entrada: null, saida: PacotesSchema },
  pacote: {
    metodo: "GET",
    caminho: "turmas/:turmaId/pacotes/:pacoteId",
    papel: "professor",
    entrada: null,
    saida: PacoteDetalheSchema,
  },
  gerarMidia: {
    metodo: "POST",
    caminho: "turmas/:turmaId/pacotes/:pacoteId/gerar-midia",
    papel: "professor",
    entrada: null,
    saida: ProgressoDaMidiaSchema,
  },
  refazerImagem: {
    metodo: "POST",
    caminho: "turmas/:turmaId/pacotes/:pacoteId/imagens/:chave/refazer",
    papel: "professor",
    entrada: null,
    saida: ImagemRefeitaSchema,
  },
  aprovarImagens: {
    metodo: "POST",
    caminho: "turmas/:turmaId/pacotes/:pacoteId/aprovar-imagens",
    papel: "professor",
    entrada: null,
    saida: ImagensAprovadasSchema,
  },
  emAndamento: {
    metodo: "POST",
    caminho: "turmas/:turmaId/pacotes/:pacoteId/em-andamento",
    papel: "professor",
    entrada: null,
    saida: EmAndamentoSchema,
  },
  // admin
  imagensDoBanco: {
    metodo: "GET",
    caminho: "banco-padrao/imagens",
    papel: "admin",
    entrada: null,
    saida: ImagensDoBancoPadraoSchema,
  },
  gerarImagensDoBanco: {
    metodo: "POST",
    caminho: "banco-padrao/imagens",
    papel: "admin",
    entrada: null,
    saida: GeracaoDoBancoPadraoSchema,
  },
} as const satisfies Record<string, Rota>;

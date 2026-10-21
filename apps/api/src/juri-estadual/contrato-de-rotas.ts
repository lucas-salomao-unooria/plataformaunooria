import { z } from "zod";
import { falasDoTemaSchema } from "../podcast/roteiro";
import { VAGAS_DO_PODCAST } from "./podcast";
import { problemasDoPacote } from "./invariantes";
import { LAMINAS, ehChaveDaMidia } from "./regras/laminas";
import { ETAPAS, PASSOS, PASSOS_PEDIDOS } from "./regras/passos";
import { PECAS_DO_ENTAO, PECAS_DO_SE } from "./conteudo";
import {
  ACOES_DA_REVISAO,
  AREAS,
  CONVICCOES,
  DISCIPLINAS,
  ID_DE_POST_RE,
  ID_DE_PROJETO_RE,
  ORIGENS_DO_PACOTE,
  POSTS_NO_FEED,
  TIPOS_DE_BUSCA,
  TIPOS_DE_POST_LIDOS,
  TOTAIS_DE_PROJETOS_LIDOS,
  TOTAL_DE_PROJETOS,
} from "./vocabulario";

/**
 * O contrato HTTP da exp06ef1b — só schemas Zod, nenhum decorator. O OpenAPI é
 * derivado daqui (ADR-36). Os enums vêm do vocabulário, das regras e do
 * conteúdo, nunca reescritos.
 *
 * A saída do ESTUDANTE é allowlist explícita (`PostPublicoSchema`,
 * `ProjetoDaGaleriaSchema`). O que não pode vazar antes da hora:
 *
 * - o ACERVO: antes da galeria, o estudante só recebe os posts que o feed
 *   serviu — os outros projetos existem só no servidor. A galeria (com todos os
 *   quarenta, a contagem por área e o contrafactual sem curtidas) desce no
 *   `GET galeria`, com a etapa `galeria` liberada pelo professor;
 * - a REGRA do motor: nenhum peso, nenhuma área líder. O contrafactual é
 *   CALCULADO no servidor e desce pronto: o motor nunca vai ao bundle;
 * - o GABARITO das duas tarefas do Canal A (ADR-174): o acerto da separação
 *   (as pastas do feed, ADR-176) nunca desce, e as peças da regra descem sem
 *   `certa`, com ids OPACOS e embaralhados pela sessão — quem corrige é o
 *   servidor (regra 3). A regra certa só desce DEPOIS do envio.
 */

// ------------------------------------------------------------------ comuns

export const AreaSchema = z.enum(AREAS);
export const PassoSchema = z.enum(PASSOS);
export const EtapaSchema = z.enum(ETAPAS);
export const IdDeProjetoSchema = z.string().regex(ID_DE_PROJETO_RE);
export const IdDePostSchema = z.string().regex(ID_DE_POST_RE);
/** A chave de uma imagem na `midia` do pacote: `proj-a1` (a capa) ou `proj-a1:detalhe` (ADR-178). */
export const ChaveDaMidiaSchema = z.string().refine(ehChaveDaMidia, "chave de imagem desconhecida");
export const LaminaSchema = z.enum(LAMINAS);
/** Ids opacos por sessão (`cl-` os estandes da separação, só no servidor; `rg-` as peças da regra): não dizem o que o item é. */
export const IdDeItemSchema = z.string().regex(/^cl-[a-z0-9]{3}$/);
export const IdDePecaSchema = z.string().regex(/^rg-[a-z0-9]{3}$/);

// -------------------------------------------------------- entrada: estudante

export const PedirPassoSchema = z.object({ para: z.enum(PASSOS_PEDIDOS) });

/**
 * O que o cliente MEDIU desde a última chamada, e se quer o próximo post.
 * Curtida e salvo são estado (true/false), permanência é fato (uma por post).
 * Salvar é gravado e NÃO pesa no motor. Desde a 0.7.0 (ADR-176) o salvar leva
 * a PASTA — a área em que a criança guardou o post, a separação da EF06CO01;
 * salvar de novo com outra pasta MOVE o post. Sem `pasta` (bundle anterior),
 * o post é salvo sem pasta. O teto de 20 é folga: o feed inteiro tem dez
 * posts. O primeiro `proximo: true` é a 1ª ROLAGEM: liga o relógio de 8
 * minutos do servidor.
 */
export const EventosDoFeedSchema = z.object({
  curtidas: z.array(z.object({ postId: IdDePostSchema, curtiu: z.boolean() })).max(20).default([]),
  salvamentos: z
    .array(z.object({ postId: IdDePostSchema, salvou: z.boolean(), pasta: AreaSchema.optional() }))
    .max(20)
    .default([]),
  permanencias: z.array(IdDePostSchema).max(20).default([]),
  /** `true` quando a tela chegou ao último post servido: o servidor serve o próximo. */
  proximo: z.boolean().default(false),
});

/**
 * A cédula — quatro elementos (melhoria 6): o título, um projeto do feed, a
 * certeza ("Sim" = `examinei_bem`, "Com certeza" = `vi_tudo`) e o botão. Sem
 * justificativa, sem frase grifada. É o LATCH 1.
 */
export const VotoSchema = z.object({
  projetoId: IdDeProjetoSchema,
  conviccao: z.enum(CONVICCOES),
});

/**
 * O BATIMENTO da cédula aberta (melhoria 8): a cada 15 s, há quantos segundos
 * não há toque nela. `aberta: false` (fechou sem votar) apaga a marca na hora.
 */
export const BatimentoDaCedulaSchema = z.object({
  aberta: z.boolean(),
  segundosSemToque: z.number().int().min(0).max(3600).default(0),
});

/**
 * O que o estudante faz na galeria — abrir a ficha de um estande ou buscar.
 * Da busca, só o TIPO e a área que casou: o texto digitado nunca sai do
 * aparelho (texto livre de menor).
 */
export const AcaoDaGaleriaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("abrir"), projetoId: IdDeProjetoSchema }),
  z.object({ tipo: z.literal("buscar"), busca: z.enum(TIPOS_DE_BUSCA), area: AreaSchema.nullable() }),
]);

/**
 * A revisão do voto depois da galeria — o LATCH 2, dois botões (melhoria 6):
 * "Manter meu voto inicial" (`manter`, só depois de abrir ao menos UM estande
 * oculto) ou "Confirmar Voto Revisado" (`trocar`, com o estande novo). Sem
 * justificativa.
 */
export const RevisaoDoVotoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal(ACOES_DA_REVISAO[0]) }),
  z.object({ acao: z.literal(ACOES_DA_REVISAO[1]), projetoId: IdDeProjetoSchema }),
]);

/** A REGRA (EF06CO03): a peça do SE e a do ENTÃO, ids opacos da sessão. */
export const RegraSchema = z.object({ se: IdDePecaSchema, entao: IdDePecaSchema });

// --------------------------------------------------------- saída: estudante

export const CategoriaSchema = z.object({
  area: AreaSchema,
  nome: z.string(),
  hashtag: z.string(),
});

const ImagemPublicaSchema = z.object({
  /** `null` enquanto o professor não gerou (ou a geração falhou): a tela desenha a arte procedural. */
  url: z.string().nullable(),
  alt: z.string(),
});

/**
 * As fotos 2 e 3 do carrossel e a dos bastidores (0.8.0, ADR-178). `null` é a
 * lâmina sem imagem: a tela desenha a arte procedural (e, nos bastidores, só o
 * texto). O `alt` delas a tela monta do título — não há descrição por lâmina.
 */
const LaminasPublicasSchema = z.object({
  detalhe: z.string().nullable(),
  equipe: z.string().nullable(),
  bastidor: z.string().nullable(),
});

/**
 * Um post do feed — ALLOWLIST. A área é pública (a hashtag está no post).
 *
 * O motor serve só `apresentacao` (instrumento 3.0.0); `bastidor`, `prototipo`
 * e `depoimento` só chegam no feed gravado de uma sessão 2.0.0, e a tela
 * continua sabendo desenhá-los.
 */
export const PostPublicoSchema = z.object({
  id: IdDePostSchema,
  projetoId: IdDeProjetoSchema,
  tipo: z.enum(TIPOS_DE_POST_LIDOS),
  area: AreaSchema,
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  /** O texto do FORMATO: a legenda na apresentação (nas sessões 2.0.0, o do formato legado). */
  texto: z.string(),
  /** A legenda do ESTANDE, em qualquer formato (o "...mais" da apresentação). */
  legenda: z.string(),
  /** O resumo técnico do estande (o bastidor): a última lâmina do carrossel do post ("Bastidores do estande"). */
  bastidor: z.string(),
  hashtags: z.array(z.string()),
  imagem: ImagemPublicaSchema,
  laminas: LaminasPublicasSchema,
});

export const FeedSchema = z.object({
  posts: z.array(PostPublicoSchema).max(POSTS_NO_FEED),
  curtidos: z.array(IdDePostSchema),
  salvos: z.array(IdDePostSchema),
  /** A pasta (área) de cada post salvo — a separação da EF06CO01 (ADR-176). Post salvo sem pasta não aparece. */
  pastas: z.record(IdDePostSchema, AreaSchema),
  /** Quantos estandes vistos ainda não estão numa pasta: o voto só lacra com zero. */
  semPasta: z.number().int().min(0),
  /** Os dez chegaram. */
  completo: z.boolean(),
  /** Os 8 minutos do servidor, desde a 1ª rolagem, acabaram: o feed não serve mais. */
  tempoEsgotado: z.boolean(),
  /** Quando o feed encerra por tempo (ISO), ou `null` antes da 1ª rolagem. */
  encerraEm: z.string().nullable(),
  /** A cédula pode abrir: `completo` OU `tempoEsgotado`. */
  cedulaLiberada: z.boolean(),
});

/** Um estande na galeria: a apresentação e se ele chegou ao feed DESTE estudante. */
export const ProjetoDaGaleriaSchema = z.object({
  id: IdDeProjetoSchema,
  area: AreaSchema,
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  legenda: z.string(),
  /** O resumo técnico da ficha de inspeção (E4-ALU-02). */
  resumo: z.string(),
  hashtags: z.array(z.string()),
  imagem: ImagemPublicaSchema,
  laminas: LaminasPublicasSchema,
  exibidoNoSeuFeed: z.boolean(),
});

/** Um pacote tem 40 projetos (ou 16, o legado da 0.4.x, só na leitura). */
const comTotalLido = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .refine((lista) => (TOTAIS_DE_PROJETOS_LIDOS as readonly number[]).includes(lista.length), {
      message: `o pacote tem ${TOTAIS_DE_PROJETOS_LIDOS.join(" ou ")} projetos`,
    });

/**
 * "30 de 40": os estandes que o feed nunca mostrou e o total da mostra. Com
 * quarenta e um feed de dez posts sem repetição, o número é o MESMO para toda
 * criança que viu os dez — o que muda entre elas é QUAIS ficaram fora
 * (`porArea`, `semCurtidas`).
 */
export const InvisibilidadeSchema = z.object({
  ocultos: z.number().int().min(0),
  total: z.number().int().min(0),
});

/** Quantos projetos DISTINTOS de cada área chegaram ao feed, sobre os da área no pacote. */
export const VistosPorAreaSchema = z.object({
  area: AreaSchema,
  vistos: z.number().int().min(0),
  total: z.number().int().min(0),
});

/** Uma área do CONTRAFACTUAL: os projetos que o feed teria mostrado dela, na ordem do pacote. */
export const AreaSemCurtidasSchema = z.object({
  area: AreaSchema,
  posts: z.array(IdDeProjetoSchema),
});

export const GaleriaSchema = z.object({
  /** O número do badge e da grade: "{ocultos} de {total} projetos ficaram fora do seu feed". */
  invisibilidade: InvisibilidadeSchema,
  /** Projetos distintos vistos por área, nas quatro áreas e na ordem delas. */
  porArea: z.array(VistosPorAreaSchema).length(AREAS.length),
  /**
   * O CONTRAFACTUAL, nas quatro áreas: o feed que ESTA sessão teria tido sem
   * nenhuma curtida e nenhuma permanência — a mesma semente, o mesmo motor, o
   * mesmo número de posts que a criança viu (o feed pode ter parado antes de
   * dez pelos 8 minutos). Cada post é um projeto (só `apresentacao`).
   */
  semCurtidas: z.array(AreaSemCurtidasSchema).length(AREAS.length),
  /** Os quarenta (ou dezesseis, no pacote legado), os que NÃO chegaram primeiro (é a grade da Galeria Oculta). */
  projetos: comTotalLido(ProjetoDaGaleriaSchema),
  /** Quantos estandes ocultos a criança já abriu. */
  ocultosAbertos: z.number().int().min(0),
  /** "Manter meu voto inicial" está liberado (abriu ao menos um oculto). */
  podeManter: z.boolean(),
});

export const PecaPublicaSchema = z.object({ id: IdDePecaSchema, texto: z.string() });

/**
 * A REVELAÇÃO da regra, só depois do envio: as peças escolhidas e as certas, e
 * o que a regra fez no feed DESTA criança (`curtidas`, `permanencia` ou
 * `variado`, com a área em foco).
 */
export const RevelacaoDaRegraSchema = z.object({
  escolha: z.object({ se: z.string(), entao: z.string() }),
  certa: z.object({ se: IdDePecaSchema, entao: IdDePecaSchema }),
  motivo: z.enum(["curtidas", "permanencia", "variado"]),
  area: AreaSchema.nullable(),
});

/** O estado do estudante. Cada bloco só aparece do passo dele em diante. */
export const SessaoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  /** Já reconciliado com a etapa da turma (`passoEfetivo`). */
  passo: PassoSchema,
  /** O gravado. */
  passoDoEstudante: PassoSchema,
  etapa: EtapaSchema,
  aguardandoOProfessor: z.boolean(),
  tema: z.string(),
  categorias: z.array(CategoriaSchema).length(AREAS.length),
  feed: FeedSchema,
  voto: z.object({ projetoId: IdDeProjetoSchema, conviccao: z.enum(CONVICCOES) }).nullable(),
  revisao: z
    .object({
      /** `complementar` só nas sessões da 0.3.0. */
      acao: z.enum(["manter", "trocar", "complementar"]),
      /** O estande da troca; `null` ao manter. */
      projetoId: IdDeProjetoSchema.nullable(),
    })
    .nullable(),
  /**
   * A REGRA (o passo guarda o nome `cadeia`), do passo dela em diante: as
   * peças embaralhadas e, depois do envio, a revelação. `enviada` sem
   * `revelacao` = a cadeia antiga da 0.5.0, já montada.
   */
  cadeia: z
    .object({
      se: z.array(PecaPublicaSchema).length(PECAS_DO_SE.length),
      entao: z.array(PecaPublicaSchema).length(PECAS_DO_ENTAO.length),
      enviada: z.boolean(),
      revelacao: RevelacaoDaRegraSchema.nullable(),
    })
    .nullable(),
  concluida: z.boolean(),
});

export const GatePublicoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
});

/** A resposta das rotas que só mudam o passo (voto, revisão, concluir). */
export const EstadoSchema = z.object({ passo: PassoSchema, etapa: EtapaSchema });

/** A resposta da regra: o estado e a revelação, que só existe depois do envio. */
export const RespostaDaRegraSchema = EstadoSchema.extend({ revelacao: RevelacaoDaRegraSchema.nullable() });

// ----------------------------------------------------- entrada: professor

export const ParametrosDoPreparoSchema = z.object({
  disciplina: z.enum(DISCIPLINAS),
  tema: z.string().trim().min(3).max(60),
  assuntos: z.string().trim().min(10).max(600),
  contexto: z.string().trim().max(120).optional(),
});

/**
 * Um projeto do pacote como ele é LIDO. `prototipo` e `depoimento` só existem
 * nos pacotes da 0.4.x (os formatos da saturação); o pacote novo não os tem
 * (`ProjetoDoPacoteEscritaSchema`).
 */
export const ProjetoDoPacoteSchema = z.object({
  id: IdDeProjetoSchema,
  area: AreaSchema,
  titulo: z.string().trim().min(3).max(60),
  escola: z.string().trim().min(3).max(60),
  perfil: z.string().trim(),
  legenda: z.string().trim().min(10).max(420),
  /** O resumo técnico (a ficha de inspeção da galeria e a última lâmina do carrossel do post). */
  bastidor: z.string().trim().min(10).max(280),
  /** Só nos pacotes da 0.4.x (os formatos da saturação): lidos, nunca escritos. */
  prototipo: z.string().trim().min(10).max(280).optional(),
  depoimento: z.string().trim().min(10).max(280).optional(),
  hashtags: z.array(z.string()).min(2).max(4),
  imagem: z.object({ descricao: z.string().trim().min(10).max(240), alt: z.string().trim().min(3).max(140) }),
});

/** Um projeto como ele é ESCRITO (homologar, preparo, banco padrão): sem os formatos da 0.4.x. */
export const ProjetoDoPacoteEscritaSchema = ProjetoDoPacoteSchema.omit({ prototipo: true, depoimento: true });

const CategoriasDoPacoteSchema = z
  .array(z.object({ area: AreaSchema, nome: z.string().trim().min(2).max(30), hashtag: z.string().trim() }))
  .length(AREAS.length);

/** O pacote como ele é ESCRITO: os quarenta, com a régua inteira (`problemasDoPacote`). */
export const ConteudoDoPacoteSchema = z
  .object({
    tema: z.string().trim().min(3).max(60),
    categorias: CategoriasDoPacoteSchema,
    projetos: z.array(ProjetoDoPacoteEscritaSchema).length(TOTAL_DE_PROJETOS),
  })
  .superRefine((conteudo, ctx) => {
    for (const problema of problemasDoPacote(conteudo)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
  });

/**
 * O pacote como as telas do professor o RECEBEM: 40 projetos, ou 16 no pacote
 * da 0.4.x (que continua legível até a turma trocar de atividade). Sem a régua:
 * ela valeu na escrita.
 */
export const ConteudoDoPacoteLidoSchema = z.object({
  tema: z.string(),
  categorias: CategoriasDoPacoteSchema,
  projetos: comTotalLido(ProjetoDoPacoteSchema),
});

export const HomologacaoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
  /**
   * Quando o professor ABRIU o preparo (EVT-P01): a tela de criação guarda o
   * instante e manda aqui. Opcional; o servidor aceita só as últimas 24 h, e
   * sem ele vale o instante da homologação.
   */
  preparoIniciadoEm: z.string().datetime().optional(),
  /**
   * As três falas do podcast de recapitulação que o professor revisou na
   * criação (ADR-150, ADR-151): os dois estandes de áreas diferentes, o que o
   * feed do Rafa mostrou e o que o da mesa ao lado mostrou.
   */
  podcast: falasDoTemaSchema(VAGAS_DO_PODCAST),
});

export const RegenerarProjetoSchema = ParametrosDoPreparoSchema.extend({
  /** O rascunho como está na tela — a IA escreve um projeto que caiba nele. */
  conteudo: ConteudoDoPacoteSchema,
  projetoId: IdDeProjetoSchema,
});

export const GateSchema = z.object({ para: EtapaSchema });

/** `?pacoteId=` da rota de imagens: a atividade PRONTA sendo preparada. */
export const QueryDoPacoteSchema = z.object({
  escolaId: z.string().optional(),
  pacoteId: z.string().uuid().optional(),
});

// ------------------------------------------------------ saída: professor

const TurmaResumoSchema = z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() });

export const TurmasSchema = z.object({
  turmas: z.array(TurmaResumoSchema.extend({ estudantes: z.number().int().min(0) })),
});

const PacoteResumoSchema = z.object({
  id: z.string().uuid(),
  disciplina: z.enum(DISCIPLINAS),
  tema: z.string(),
  origem: z.enum(ORIGENS_DO_PACOTE),
});

const MidiaResumoSchema = z.object({ total: z.number().int().min(0), prontas: z.number().int().min(0) });

/**
 * O rascunho do preparo — não persiste; só `homologar` grava. `usouIa: false`
 * é o FALLBACK (RF-007, §12.2): sem cota ou com a IA fora do ar, o conteúdo é
 * o BANCO PADRÃO, e `motivo` diz por quê.
 */
export const RascunhoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
  usouIa: z.boolean(),
  origem: z.enum(ORIGENS_DO_PACOTE),
  motivo: z.enum(["sem-saldo-de-ia", "ia-indisponivel"]).nullable(),
  /**
   * As URLs das imagens que o rascunho JÁ tem, por id de projeto. Só o banco
   * padrão (o fallback) as traz — as imagens do banco que já existem no
   * storage; o rascunho da IA vem vazio (as imagens dele se geram depois de
   * criar a atividade).
   */
  imagens: z.record(z.string()),
});

/**
 * "Usar Banco Padrão Oficial" (E0-PROF-02): o caminho curto, sem IA. `porNoAr`
 * faz o "Usar Banco Padrão e Pôr no ar" de um toque (a contagem do Anexo §9a).
 */
export const BancoPadraoSchema = z.object({ porNoAr: z.boolean().default(false) });

export const ProjetoRegeneradoSchema = z.object({ projeto: ProjetoDoPacoteEscritaSchema, usouIa: z.boolean() });

/** O pacote como as telas do professor o mostram. */
const PacoteNaTelaSchema = PacoteResumoSchema.extend({
  assuntos: z.string(),
  conteudo: ConteudoDoPacoteLidoSchema,
  midia: MidiaResumoSchema,
  /** As URLs já geradas, por id de projeto. */
  imagens: z.record(z.string()),
});

/** A atividade criada: nasce PRONTA (ADR-130). */
export const PacoteHomologadoSchema = PacoteResumoSchema.extend({ ativo: z.boolean() });

export const PacotesSchema = z.object({
  /** A atividade EM ANDAMENTO, ou `null`: a plataforma não cria atividade (ADR-130). */
  ativo: PacoteNaTelaSchema.extend({ rodada: z.number().int().positive(), etapa: EtapaSchema }).nullable(),
  historico: z.array(
    PacoteResumoSchema.extend({
      ativo: z.boolean(),
      criadoEm: z.string(),
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: z.number().int().min(0),
      /** A segunda fase da aprovação passou? Sem ela, a atividade não vai ao ar. */
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
  /** Quando o professor aprovou as imagens; `null` = a segunda fase não passou, e a atividade não vai ao ar. */
  imagensAprovadasEm: z.string().nullable(),
});

/** `POST :turmaId/pacotes/:pacoteId/aprovar-imagens`. */
export const ImagensAprovadasSchema = z.object({
  pacoteId: z.string().uuid(),
  imagensAprovadasEm: z.string(),
});

/** A query do refazer: qual lâmina (sem ela, a capa — o contrato de antes da 0.8.0). */
export const LaminaDoRefazerSchema = z.object({ lamina: LaminaSchema.default("capa") });

/** `POST :turmaId/pacotes/:pacoteId/imagens/:projetoId/refazer?lamina=` — a imagem nova de UMA lâmina de um estande. */
export const ImagemRefeitaSchema = z.object({
  pacoteId: z.string().uuid(),
  projetoId: IdDeProjetoSchema,
  lamina: LaminaSchema,
  /** A chave na `midia` (`proj-a1`, `proj-a1:detalhe`). */
  chave: ChaveDaMidiaSchema,
  url: z.string(),
});

export const EmAndamentoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  mudou: z.boolean(),
});

export const ProgressoDaMidiaSchema = z.object({
  pacoteId: z.string().uuid(),
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.number().int().min(0),
  geradas: z.array(ChaveDaMidiaSchema),
  /** As que falharam NESTA chamada — seguem com a arte procedural. */
  falharam: z.array(ChaveDaMidiaSchema),
  completo: z.boolean(),
  imagens: z.record(z.string()),
});

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não. **Só progresso**: nem o voto, nem a taxa, nem nível
 * (`PROIBIDO_NA_LINHA_DO_PAINEL`, com teste). O painel é PROJETADO na lousa no
 * pico (PED-07: sem nome ligado a escolha). O nível de cada habilidade mora no
 * painel de habilidades (E14).
 */
export const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  equipe: z.object({ id: z.string().uuid(), nome: z.string() }).nullable(),
  entrou: z.boolean(),
  passo: PassoSchema,
  votou: z.boolean(),
  /** O SINALIZADOR DE OCIOSOS: cédula aberta e mais de 60 s sem toque (o ícone ao lado do nome). */
  ocioso: z.boolean(),
  /** Já separou os estandes nas áreas (EF06CO01). Progresso: quantos acertou NÃO vai à lousa. */
  separou: z.boolean(),
  abriuAGaleria: z.boolean(),
  buscou: z.boolean(),
  revisou: z.boolean(),
  concluiu: z.boolean(),
});

export const PainelSchema = z.object({
  turma: TurmaResumoSchema,
  pacote: PacoteResumoSchema.extend({ midia: MidiaResumoSchema }),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  proximaEtapa: EtapaSchema.nullable(),
  /** Ordem alfabética, sem ordenação por desempenho. */
  linhas: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    entraram: z.number().int().min(0),
    votaram: z.number().int().min(0),
    separaram: z.number().int().min(0),
    revisaram: z.number().int().min(0),
    concluiram: z.number().int().min(0),
    /** Quantos estão ociosos na cédula agora. */
    ociosos: z.number().int().min(0),
    /** "X de Y computadores votaram". Y sai da montagem das equipes quando há. */
    computadores: z.object({ votaram: z.number().int().min(0), total: z.number().int().min(0) }),
    porComputador: z.boolean(),
    /** A lousa do PICO: os votos da turma por área (o voto inicial, lacrado). */
    votosPorArea: z.array(CategoriaSchema.extend({ votos: z.number().int().min(0) })).length(AREAS.length),
    /**
     * A CONCENTRAÇÃO do feed (a lousa do contraste): entre os computadores que
     * votaram, a média da fração do feed (0–100) que caiu na área mais vista —
     * separada entre quem curtiu algum post (`curtiram`) e quem não curtiu
     * nenhum (`naoCurtiram`). `null` = ninguém naquele grupo. Só agregado: a
     * linha não diz de quem é (PED-07).
     */
    concentracao: z.object({
      curtiram: z.number().int().min(0).max(100).nullable(),
      naoCurtiram: z.number().int().min(0).max(100).nullable(),
    }),
    /** Depois da galeria: quantos mantiveram ou trocaram o voto. */
    revisao: z.object({
      mantiveram: z.number().int().min(0),
      trocaram: z.number().int().min(0),
    }),
    /** Os votos REVISADOS por área — a lousa depois da galeria. */
    votosRevisadosPorArea: z.array(CategoriaSchema.extend({ votos: z.number().int().min(0) })).length(AREAS.length),
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: TurmaResumoSchema,
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  proximaEtapa: EtapaSchema.nullable(),
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
});

/**
 * O material do professor (guia da aula): o esqueleto fixo COM gabarito — as
 * peças da regra com a certa marcada — e a plenária. O caso Mariana saiu na
 * 0.7.0 (ADR-176).
 */
const PecaComGabaritoSchema = z.object({ texto: z.string(), certa: z.boolean() });

export const MaterialSchema = z.object({
  pecas: z.object({ se: z.array(PecaComGabaritoSchema), entao: z.array(PecaComGabaritoSchema) }),
  plenaria: z.array(z.string()),
  regra: z.object({
    pesoDaCurtida: z.number().int(),
    pesoDaPermanencia: z.number().int(),
    limiar: z.number().int(),
    postsNoFeed: z.number().int(),
    minutosNoFeed: z.number().int(),
  }),
});

// ───────────────────────────────────── admin: as imagens do banco padrão

/**
 * As imagens do BANCO PADRÃO (`GET /juri-estadual/banco-padrao/imagens`): quatro
 * por projeto (as lâminas, ADR-178), com o MESMO nome determinístico da
 * customização (o hash do pedido), então o arquivo que existe no storage serve
 * a todo pacote `padrao`. `faltam` são as chaves sem arquivo.
 */
export const ImagensDoBancoPadraoSchema = z.object({
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.array(ChaveDaMidiaSchema),
  completo: z.boolean(),
  imagens: z.record(z.string()),
});

/** `POST /juri-estadual/banco-padrao/imagens`: o progresso, e o que ESTA chamada gerou ou não conseguiu. */
export const GeracaoDoBancoPadraoSchema = ImagensDoBancoPadraoSchema.extend({
  geradas: z.array(ChaveDaMidiaSchema),
  /** As que falharam NESTA chamada — chame de novo. */
  falharam: z.array(ChaveDaMidiaSchema),
});

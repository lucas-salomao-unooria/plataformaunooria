import { z } from "zod";
import { BOLHAS } from "./catalogo";
import { VALORES } from "./mapeamento";

const Uuid = z.string().uuid();
const BolhaSchema = z.enum(BOLHAS);
const ValorSchema = z.enum(VALORES as unknown as [string, ...string[]]);

export const AbrirSchema = z.object({
  /** A versão do bundle que está jogando. Fica na linha porque quem estava com
   *  a aba aberta durante um publish termina a partida com a anterior — e uma
   *  partida dura 15–25 min. */
  expVersion: z.string().min(1).max(32),
});

/** Um cartão como o ESTUDANTE o recebe: **sem `legitima`** e sem `aceita`. O
 *  gabarito fica no servidor (regra 3). */
export const CartaoPublicoSchema = z.object({
  id: z.string(),
  /** Quando o cartão chega. Metade do desenho é o MOMENTO — e nenhum gatilho
   *  revela nada sobre legitimidade. */
  gatilho: z.string(),
  tag: z.string(),
  beats: z.array(z.object({ name: z.string(), text: z.string() })),
  options: z.array(z.object({ text: z.string(), reply: z.string().optional() })),
});

/**
 * A partida aberta. A BOLHA vem do SERVIDOR — era `estudanteSlot % 3` no navegador,
 * o que punha no bundle a condição do próprio instrumento e deixava as três
 * versões legíveis antes da aula.
 */
export const SessaoAbertaSchema = z.object({
  sessaoId: Uuid,
  bolha: BolhaSchema,
  /** Só os desta criança, e sem gabarito: a explicação final da missão depende
   *  de ser a primeira vez que a turma vê as outras versões. */
  cartoes: z.array(CartaoPublicoSchema),
});

export const SessaoConcluidaSchema = z.object({
  /** `jaEstava` = idempotência: a criança recarrega, e o `pagehide` dispara duas vezes. */
  status: z.enum(["gravada", "jaEstava"]),
  perfilId: z.string().nullable(),
});

/**
 * Uma linha do retrato Schwartz.
 *
 * **`grau` é invariante de API, não regra de tela**: valor com UMA fonte de
 * medida não recebe número. Só a variante `scored` tem `numero: number`; as
 * outras têm `null` POR TIPO — o hub fica estruturalmente incapaz de imprimir
 * "Poder 100" a partir de um sinal só.
 *
 * E `zero` ("teve a chance e não foi", entra na média) não é `none` ("a
 * oportunidade não chegou", sai da conta).
 */
export const LinhaDeLeituraSchema = z.union([
  z.object({
    valor: ValorSchema,
    nome: z.string(),
    texto: z.string(),
    comportamento: z.string(),
    grau: z.literal("scored"),
    numero: z.number(),
  }),
  z.object({
    valor: ValorSchema,
    nome: z.string(),
    texto: z.string(),
    comportamento: z.string(),
    grau: z.enum(["indicative", "zero", "none"]),
    numero: z.null(),
  }),
]);

export const CartaoRecebidoSchema = z.object({
  id: z.string(),
  nivel: z.enum(["comum", ...BOLHAS]),
  legitima: z.boolean(),
  emMs: z.number(),
  viuOpcoes: z.boolean(),
  escolha: z.number().nullable(),
  /** `null` = não respondeu. DERIVADO da escolha, nunca recebido do cliente. */
  aceitou: z.boolean().nullable(),
  decisaoMs: z.number().nullable(),
});

export const LeituraMensagensSchema = z.object({
  bolha: BolhaSchema,
  golpeAceito: z.number().int().nonnegative(),
  golpeRecusado: z.number().int().nonnegative(),
  legitimaAceita: z.number().int().nonnegative(),
  legitimaRecusada: z.number().int().nonnegative(),
  /** Apareceu e ela nunca chegou a ver as opções. */
  nemViu: z.number().int().nonnegative(),
  /** Viu as opções e deixou passar. */
  deixouPassar: z.number().int().nonnegative(),
  cartoes: z.array(CartaoRecebidoSchema),
  /** Frase única, e nunca sobre quem a criança é. */
  leitura: z.string(),
});

export const RelatorioDaPartidaSchema = z.object({
  sessaoId: Uuid,
  abertaEm: z.string().datetime(),
  concluidaEm: z.string().datetime().nullable(),
  status: z.string(),
  duracaoSeg: z.number().nullable(),
  bolha: BolhaSchema,
  /** Quantos a api ENTREGOU — não é o mesmo que quantos apareceram. */
  cartoesServidos: z.number().int().nonnegative(),
  resumo: z.object({
    fogueirasAcesas: z.number(),
    pedrasQuebradas: z.number(),
    aldeoesAjudados: z.number(),
    lampioesAcesos: z.number(),
    tochasAcesas: z.number(),
    dilemasVistos: z.number(),
    dilemasResolvidos: z.number(),
    distanciaM: z.number(),
  }),
  /** `null` enquanto a partida não fechou, ou quando foi abandonada. */
  perfil: z
    .object({
      versaoMapeamento: z.number().int(),
      linhas: z.array(LinhaDeLeituraSchema),
      aberturaVsConservacao: z.number().nullable(),
      transcendenciaVsAutopromocao: z.number().nullable(),
      amostraSuficiente: z.boolean(),
      frase: z.string(),
    })
    .nullable(),
  /** `null` quando NENHUM cartão chegou a aparecer — e isso **não** é "ela
   *  ignorou tudo". A tela diz "as mensagens não chegaram nesta partida". */
  mensagens: LeituraMensagensSchema.nullable(),
});

export const RelatorioDoEstudanteSchema = z.object({
  /** `null` é resposta legítima: o estudante existe e não jogou. Um 404 faria a tela
   *  do professor dizer "não encontrado" para uma criança da turma dele. */
  relatorio: RelatorioDaPartidaSchema.nullable(),
});


export const TurmasDaVilaSchema = z.object({
  turmas: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      serie: z.string(),
      estudantes: z.number().int().nonnegative().optional(),
    }),
  ),
});

/** O AGREGADO — nenhum campo aqui identifica uma criança, e isso é o desenho. */
export const ResumoDaTurmaSchema = z.object({
  resumo: z.object({
    estudantes: z.number().int().nonnegative().optional(),
    jogaram: z.number().int().nonnegative(),
    concluiram: z.number().int().nonnegative(),
    abandonaram: z.number().int().nonnegative(),
    /** Quantas partidas concluídas sustentam leitura (`amostraSuficiente`). */
    comAmostra: z.number().int().nonnegative(),
    porBolha: z.record(z.number().int().nonnegative()),
    mensagens: z.object({
      comLeitura: z.number().int().nonnegative(),
      golpeAceito: z.number().int().nonnegative(),
      golpeRecusado: z.number().int().nonnegative(),
      legitimaRecusada: z.number().int().nonnegative(),
      naoResponderam: z.number().int().nonnegative(),
    }),
  }),
});

export const EstudanteDaTurmaSchema = z.object({
  estudanteId: Uuid.optional(),
  id: Uuid.optional(),
  nome: z.string(),
  partidas: z.number().int().nonnegative(),
  ultimaEm: z.string().datetime().nullable(),
  bolha: BolhaSchema.nullable(),
  fogueirasAcesas: z.number().nullable(),
  amostraSuficiente: z.boolean().nullable(),
});

/**
 * Uma linha por estudante. **Sem valor de Schwartz nenhum**: listagem é ordenável, e
 * uma coluna "Poder" viraria ranking de crianças. Os valores vivem na tela
 * individual, uma criança por vez, com o grau ao lado.
 */
export const EstudantesDaTurmaSchema = z.object({
  estudantes: z.array(EstudanteDaTurmaSchema).optional(),
});


export const TurmaZeradaSchema = z.object({
  partidas: z.number().int().nonnegative(),
  perfis: z.number().int().nonnegative(),
  /** As BOLHAS somem junto: rodar de novo com a mesma bolha serviria à criança o
   *  mesmo golpe — ela reconhece, e a segunda rodada não mede nada. */
  bolhas: z.number().int().nonnegative(),
});

/** Os cartões COM gabarito — professor only. É a revelação da missão. */
export const CartoesDoProfessorSchema = z.object({
  /** `null` = nenhuma turma escolhida; a tela mostra as três e avisa. */
  bolhasDaTurma: z.array(BolhaSchema).nullable(),
  cartoes: z.array(
    z.object({
      id: z.string(),
      nivel: z.enum(["comum", ...BOLHAS]),
      legitima: z.boolean(),
      tag: z.string(),
      beats: z.array(z.object({ name: z.string(), text: z.string() })),
      opcoes: z.array(z.object({ texto: z.string(), aceita: z.boolean() })),
    }),
  ),
  bolhas: z.record(z.object({ titulo: z.string(), texto: z.string() })),
});

import { z } from "zod";
import { FAIXAS, SUBESCALAS } from "./catalogo";

const Uuid = z.string().uuid();
const SubescalaSchema = z.enum(SUBESCALAS as unknown as [string, ...string[]]);

/** O card do hub. Leve de propósito: sem abrir ciclo e sem chamar IA. */
export const ResumoSchema = z.object({
  hoje: z.enum(["respondido", "pendente"]),
  respondidos: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  cicloAberto: z.boolean(),
});

/** Um dos 21 itens do DASS-21, **verbatim**. A IA nunca reescreve: reformular
 *  quebra a validação psicométrica e as faixas de corte. */
export const ItemSchema = z.object({
  numero: z.number().int().min(1).max(21),
  texto: z.string(),
});

export const RespostaSchema = z.object({
  item: z.number().int().min(1).max(21),
  valor: z.number().int().min(0).max(3),
});

export const CheckinSchema = z.object({
  id: Uuid,
  numero: z.number().int().positive(),
  total: z.number().int().positive(),
  /** O dia em `America/Sao_Paulo` — 1 check-in por dia. */
  dia: z.string(),
  status: z.enum(["pendente", "respondido"]),
  itens: z.array(ItemSchema),
  /** Gerado pela IA (ou o texto fixo do catálogo). É o ENTORNO, nunca o item. */
  abertura: z.string(),
  pergunta: z.string(),
  respostas: z.array(RespostaSchema).nullable(),
  textoLivre: z.string().nullable(),
  acolhimento: z.string().nullable(),
  sinalDeApoio: z.boolean(),
  respondidoEm: z.string().datetime().nullable(),
});

export const ProgressoDoCicloSchema = z.object({
  id: Uuid,
  status: z.enum(["aberto", "concluido", "expirado"]),
  respondidos: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  iniciadoEm: z.string().datetime(),
  /** O ciclo expira em 21 dias sem fechar. */
  expiraEm: z.string().datetime(),
});

/**
 * O resultado das três subescalas — **correção server-side** (regra 3): a api
 * soma por subescala (×2) e classifica pelas faixas publicadas.
 */
export const ResultadoSchema = z.object({
  dimensoes: z.array(
    z.object({
      subescala: SubescalaSchema,
      rotulo: z.string(),
      pontos: z.number().int().nonnegative(),
      faixa: z.enum(FAIXAS),
      faixaRotulo: z.string(),
      leitura: z.string(),
    }),
  ),
  aviso: z.string(),
});

/** Mensagem FIXA, nunca gerada: item 17 ou 21 ≥ 2, ou termo de risco no texto.
 *  Nesse caminho a IA **não é chamada**. */
export const ApoioSchema = z.object({
  titulo: z.string(),
  texto: z.string(),
  recursos: z.array(z.object({ nome: z.string(), detalhe: z.string() })),
});

export const EscalaSchema = z.array(
  z.object({
    valor: z.number().int().min(0).max(3),
    rotulo: z.string(),
    curto: z.string(),
  }),
);

export const HojeSchema = z.object({
  checkin: CheckinSchema,
  ciclo: ProgressoDoCicloSchema.nullable(),
  /** Só no 7º check-in, quando o ciclo fecha. */
  resultado: ResultadoSchema.nullable(),
  apoio: ApoioSchema.nullable(),
  escala: EscalaSchema,
  instrucao: z.string(),
  aviso: z.string(),
});

export const RespondidoSchema = z.object({
  checkin: CheckinSchema,
  acolhimento: z.string(),
  sinalDeApoio: z.boolean(),
  apoio: ApoioSchema.nullable(),
  ciclo: ProgressoDoCicloSchema,
  resultado: ResultadoSchema.nullable(),
});

export const HistoricoSchema = z.object({
  ciclos: z.array(
    z.object({
      id: Uuid,
      iniciadoEm: z.string().datetime(),
      concluidoEm: z.string().datetime().nullable(),
      resultado: ResultadoSchema,
    }),
  ),
  anotacoes: z.array(
    z.object({
      id: Uuid,
      dia: z.string(),
      numero: z.number().int().positive(),
      cicloId: Uuid,
      textoLivre: z.string().nullable(),
      acolhimento: z.string().nullable(),
      sinalDeApoio: z.boolean(),
    }),
  ),
  aviso: z.string(),
});

/** LGPD, direito de eliminação: some tudo, e a resposta diz quanto sumiu. */
export const ApagadoSchema = z.object({
  ok: z.literal(true),
  checkins: z.number().int().nonnegative(),
  ciclos: z.number().int().nonnegative(),
});

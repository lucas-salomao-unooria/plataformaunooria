import { z } from "zod";
import { NOMES_DE_VITAL } from "./metricas";
import { EXP_ID_RE } from "../comum/codigo-da-experiencia";

/**
 * Contratos das rotas de observabilidade — os sinais que nascem no NAVEGADOR
 * e entram pela api (ADR-58): erro de cliente, Web Vitals e o lote OTLP de
 * spans da experiência. Todos com `.strict()` e tetos: são rotas que recebem
 * o que um bundle público quiser mandar, e o que passa daqui vira log,
 * métrica ou span num projeto do Google.
 */
export const EXP_ID_OU_HUB = new RegExp(`^(${EXP_ID_RE.source.slice(1, -1)}|hub)$`);
const HEX32 = /^[0-9a-f]{32}$/i;
const HEX16 = /^[0-9a-f]{16}$/i;
const NANOS = /^\d{1,20}$/;

/**
 * O que o NAVEGADOR sabe do aparelho (ADR-84) — o mínimo que responde "trava
 * no Chromebook?" e "está lento no 4G da escola?", e nada além disso.
 *
 * Campo nenhum aqui identifica uma pessoa, mas a COMBINAÇÃO de memória,
 * núcleos e tela é impressão digital de aparelho. Duas consequências, que a
 * ADR registra: ela entra na conversa de DPA com a rede, e o que vira RÓTULO
 * de métrica é só a classificação fechada do `dispositivo.ts` — nunca estes
 * números, que ficam no log do erro, onde já há contexto para investigar um.
 */
export const DispositivoSchema = z
  .object({
    /** Viewport em CSS px. O teto é folgado de propósito: acima dele é lixo, não tela grande. */
    largura: z.number().int().min(0).max(20_000),
    altura: z.number().int().min(0).max(20_000),
    dpr: z.number().min(0).max(8).optional(),
    /** `navigator.connection.effectiveType` — só o Chromium implementa; ausente no Safari e no Firefox. */
    conexao: z.enum(["slow-2g", "2g", "3g", "4g"]).optional(),
    /** `navigator.deviceMemory`, que o próprio navegador já arredonda para 0.25–8 — o teto aqui é só sanidade. */
    memoriaGb: z.number().min(0).max(1_024).optional(),
    nucleos: z.number().int().min(0).max(512).optional(),
  })
  .strict();
export type DispositivoDoCliente = z.infer<typeof DispositivoSchema>;

export const ErroClienteSchema = z
  .object({
    expId: z.string().regex(EXP_ID_OU_HUB),
    /**
     * 64, não 32: a versão do HUB é o SHA do build, e o `max(32)` recusava o
     * SHA de 40 do `github.sha` — todo erro de cliente do hub voltou 400 de
     * 2026-09-02 a 2026-09-08, sem um único registro no Cloud Logging. O CI
     * passou a mandar o SHA curto (12), e o teto aqui deixou de ser o que
     * decide se um erro existe. Semver de experiência não chega perto disto.
     */
    versao: z.string().min(1).max(64),
    mensagem: z.string().min(1).max(2_048),
    stack: z.string().max(8_192).optional(),
    /** Origem + caminho, sem query string: a query carrega id e às vezes texto. */
    url: z.string().max(512).refine((u) => !u.includes("?") && !u.includes("#"), "sem query string nem fragmento"),
    userAgent: z.string().max(256).optional(),
    dispositivo: DispositivoSchema.optional(),
    sessaoId: z.string().uuid(),
    /** Do span ativo no navegador quando o OTel Web está ligado: liga o erro à linha do tempo. */
    traceId: z.string().regex(HEX32).optional(),
    spanId: z.string().regex(HEX16).optional(),
  })
  .strict();
export type ErroCliente = z.infer<typeof ErroClienteSchema>;

export const VitalSchema = z
  .object({
    nome: z.enum(NOMES_DE_VITAL),
    /** ms (LCP, INP, TTFB) ou unidade de CLS. 10 min é o teto: acima é relógio errado, não lentidão. */
    valor: z.number().nonnegative().max(600_000),
    /** `pathname` do hub ou `expId` da experiência; normalizado na api. */
    rota: z.string().max(128),
    superficie: z.enum(["hub", "exp"]),
    dispositivo: DispositivoSchema.optional(),
  })
  .strict();
export type Vital = z.infer<typeof VitalSchema>;

// --- OTLP/JSON (subconjunto de ExportTraceServiceRequest) ---------------------
const ValorOtlpSchema = z.union([
  z.object({ stringValue: z.string().max(256) }).strict(),
  z.object({ intValue: z.union([z.string().regex(/^-?\d{1,20}$/), z.number().int()]) }).strict(),
  z.object({ doubleValue: z.number() }).strict(),
  z.object({ boolValue: z.boolean() }).strict(),
]);
export const AtributoOtlpSchema = z.object({ key: z.string().min(1).max(64), value: ValorOtlpSchema });
export type AtributoOtlp = z.infer<typeof AtributoOtlpSchema>;

const EventoOtlpSchema = z.object({
  timeUnixNano: z.string().regex(NANOS),
  name: z.string().min(1).max(128),
  attributes: z.array(AtributoOtlpSchema).max(8).optional(),
});

/** Chaves desconhecidas (links, traceState, flags) são REMOVIDAS pelo default do z.object. */
export const SpanOtlpSchema = z.object({
  traceId: z.string().regex(HEX32),
  spanId: z.string().regex(HEX16),
  parentSpanId: z.union([z.string().regex(HEX16), z.literal("")]).optional(),
  name: z.string().min(1).max(128),
  kind: z.number().int().min(0).max(5).optional(),
  startTimeUnixNano: z.string().regex(NANOS),
  endTimeUnixNano: z.string().regex(NANOS),
  attributes: z.array(AtributoOtlpSchema).max(24).optional(),
  status: z.object({ code: z.number().int().min(0).max(2).optional(), message: z.string().max(256).optional() }).optional(),
  events: z.array(EventoOtlpSchema).max(8).optional(),
});
export type SpanOtlp = z.infer<typeof SpanOtlpSchema>;

export const LIMITE_SPANS_POR_LOTE = 64;

export const OtlpTracesSchema = z.object({
  resourceSpans: z
    .array(
      z.object({
        /** O resource do CLIENTE não é confiável; o proxy o substitui. Só `service.name`/`service.version` são lidos, validados. */
        resource: z.object({ attributes: z.array(AtributoOtlpSchema).max(32).optional() }).optional(),
        scopeSpans: z
          .array(
            z.object({
              scope: z.object({ name: z.string().max(128).optional(), version: z.string().max(64).optional() }).optional(),
              spans: z.array(SpanOtlpSchema).max(LIMITE_SPANS_POR_LOTE),
            }),
          )
          .max(4),
      }),
    )
    .min(1)
    .max(1),
});
export type OtlpTraces = z.infer<typeof OtlpTracesSchema>;

/** 204 sem corpo. */
export const SemCorpoSchema = z.void();

export const CotaExcedidaSchema = z.object({ codigo: z.literal("cota-excedida"), retryAfterSeconds: z.number().int() });

import { Inject, Injectable, Optional } from "@nestjs/common";
import { rateLimit } from "../comum/rate-limit";
import { logger } from "./logger";
import { Metricas } from "./metricas";
import { redigirTexto } from "./redaction";
import { EXP_ID_OU_HUB, LIMITE_SPANS_POR_LOTE, type AtributoOtlp, type OtlpTraces, type SpanOtlp } from "./contrato-de-rotas";
// IMPORT DE VALOR, nunca `import type`: a classe é o TOKEN de injeção do
// construtor. Com `import type` o identificador some do escopo de valor, o
// `emitDecoratorMetadata` grava `Function` no `design:paramtypes`, o Nest não
// acha provider para esse token e o `@Optional()` injeta `undefined` — sem erro
// nenhum. Foi assim de 2026-09-02 a 2026-09-14: TODO span de navegador virava
// `sem-projeto` mesmo com `GCP_PROJECT_ID` no ambiente, nos três ambientes, com
// a rota respondendo 204. A rede é `tests/observabilidade-injecao.spec.ts`.
import { ClienteOtlpGoogle } from "./otlp-google";

/**
 * Recebe o lote OTLP que a SDK exportou do navegador, o torna INOFENSIVO e o
 * reexporta para a Telemetry API do Google (cap. 17, ADR-58: o browser nunca
 * fala com o Cloud Trace direto — não tem credencial, e o que ele manda é
 * entrada não confiável).
 *
 * Inofensivo quer dizer três coisas:
 *  - o `resource` do cliente é SUBSTITUÍDO: `service.name` = expId (ou `hub`),
 *    `service.version` = versão do manifesto — os dois validados por regex; o
 *    resto (user agent, hostname, o que o SDK web quiser) cai fora;
 *  - atributos passam por ALLOWLIST; `http.url`/`url.full` perdem query e
 *    fragmento (é neles que mora id, token e texto digitado);
 *  - `links`, `traceState` e chaves desconhecidas já foram removidos pelo Zod.
 */
export interface IdentidadeDoLote {
  expId: string;
  versao: string;
  superficie: "hub" | "exp";
}

const ATRIBUTOS_PERMITIDOS: ReadonlySet<string> = new Set([
  "http.method",
  "http.request.method",
  "http.status_code",
  "http.response.status_code",
  "http.url",
  "url.full",
  "http.host",
  "server.address",
  "http.scheme",
  "url.scheme",
  "http.response_content_length",
  "http.response.body.size",
  "component",
  "document.load.type",
]);
const ATRIBUTOS_DE_URL: ReadonlySet<string> = new Set(["http.url", "url.full"]);
/** 64 pela mesma razão do `versao` do `ErroClienteSchema`: o SHA do hub não cabia em 32, o lote inteiro virava `sem-identidade` — e a rota respondia 204. */
const VERSAO = /^[0-9A-Za-z._-]{1,64}$/;

function valorTexto(a: AtributoOtlp): string | undefined {
  return "stringValue" in a.value ? a.value.stringValue : undefined;
}

/** `service.name`/`service.version` do resource do cliente — só se tiverem a forma esperada. */
export function identidadeDoLote(lote: OtlpTraces): IdentidadeDoLote | undefined {
  const atributos = lote.resourceSpans[0]?.resource?.attributes ?? [];
  const nome = atributos.find((a) => a.key === "service.name");
  const versao = atributos.find((a) => a.key === "service.version");
  const expId = nome ? valorTexto(nome) : undefined;
  const v = versao ? valorTexto(versao) : undefined;
  if (!expId || !EXP_ID_OU_HUB.test(expId) || !v || !VERSAO.test(v)) return undefined;
  return { expId, versao: v, superficie: expId === "hub" ? "hub" : "exp" };
}

function semQuery(url: string): string {
  return url.split("?")[0]?.split("#")[0] ?? url;
}

export function limparSpan(span: SpanOtlp): SpanOtlp {
  const attributes = (span.attributes ?? [])
    .filter((a) => ATRIBUTOS_PERMITIDOS.has(a.key))
    .map((a) => {
      if (ATRIBUTOS_DE_URL.has(a.key) && "stringValue" in a.value) {
        return { key: a.key, value: { stringValue: redigirTexto(semQuery(a.value.stringValue)) } };
      }
      return a;
    });
  const events = span.events?.map((e) => ({ ...e, attributes: e.attributes?.filter((a) => ATRIBUTOS_PERMITIDOS.has(a.key)) }));
  return {
    ...span,
    name: redigirTexto(span.name),
    attributes,
    events,
    status: span.status ? { ...span.status, message: span.status.message ? redigirTexto(span.status.message) : undefined } : undefined,
  };
}

/** O lote pronto para o Google: resource reescrito, spans limpos. Devolve também quantos spans tem. */
export function reescreverLote(lote: OtlpTraces, identidade: IdentidadeDoLote): { corpo: OtlpTraces; spans: number } {
  let spans = 0;
  const scopeSpans = (lote.resourceSpans[0]?.scopeSpans ?? []).map((sc) => {
    spans += sc.spans.length;
    return { scope: sc.scope ? { name: sc.scope.name, version: sc.scope.version } : undefined, spans: sc.spans.map(limparSpan) };
  });
  const corpo: OtlpTraces = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: identidade.expId } },
            { key: "service.version", value: { stringValue: identidade.versao } },
            { key: "service.namespace", value: { stringValue: "unooria-navegador" } },
            { key: "telemetry.sdk.language", value: { stringValue: "webjs" } },
          ],
        },
        scopeSpans,
      },
    ],
  };
  return { corpo, spans };
}

@Injectable()
export class ProxyOtlpService {
  constructor(
    private readonly metricas: Metricas,
    // `@Inject` EXPLÍCITO: o token deixa de depender do metadata que o
    // compilador emite, então a próxima "limpeza de imports" não volta a
    // desligar a reexportação em silêncio.
    @Optional() @Inject(ClienteOtlpGoogle) private readonly cliente?: ClienteOtlpGoogle,
  ) {}

  /** Cota por (escola, usuário): laço de export num cliente não pode virar custo. */
  static readonly LOTES_POR_MINUTO = 30;

  async receber(lote: OtlpTraces, chaveDeCota: string): Promise<"aceito" | "cota" | "sem-identidade" | "descartado"> {
    const cota = rateLimit(`otlp:${chaveDeCota}`, ProxyOtlpService.LOTES_POR_MINUTO, 60_000);
    if (!cota.ok) {
      this.metricas.spansDescartados.add(1, { motivo: "cota" });
      return "cota";
    }
    const identidade = identidadeDoLote(lote);
    if (!identidade) {
      this.metricas.spansDescartados.add(1, { motivo: "sem-identidade" });
      return "sem-identidade";
    }
    const { corpo, spans } = reescreverLote(lote, identidade);
    if (spans === 0 || spans > LIMITE_SPANS_POR_LOTE) {
      this.metricas.spansDescartados.add(1, { motivo: "tamanho" });
      return "descartado";
    }
    this.metricas.spansRecebidos.add(spans, { superficie: identidade.superficie });

    if (!this.cliente) {
      // dev sem GCP_PROJECT_ID: contado, não enviado.
      this.metricas.spansDescartados.add(spans, { motivo: "sem-projeto" });
      logger.debug({ codigo: "otlp.sem-projeto", spans, expId: identidade.expId }, "lote de spans do navegador descartado: sem projeto GCP");
      return "descartado";
    }
    try {
      const r = await this.cliente.enviar("v1/traces", JSON.stringify(corpo));
      if (!r.ok) {
        this.metricas.spansDescartados.add(spans, { motivo: "upstream" });
        // Uma linha por minuto, não uma por lote: o upstream fora do ar não
        // pode virar inundação de log.
        if (rateLimit("log:otlp-upstream", 1, 60_000).ok) {
          logger.warn({ codigo: "otlp.upstream-recusou", status: r.status, detalhe: r.detalhe }, "a Telemetry API recusou o lote de spans");
        }
        return "descartado";
      }
      return "aceito";
    } catch (erro) {
      this.metricas.spansDescartados.add(spans, { motivo: "upstream" });
      if (rateLimit("log:otlp-upstream", 1, 60_000).ok) {
        logger.warn({ codigo: "otlp.upstream-falhou", err: erro }, "a Telemetry API não respondeu");
      }
      return "descartado";
    }
  }
}

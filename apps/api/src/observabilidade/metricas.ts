import { Inject, Injectable, Optional } from "@nestjs/common";
import { metrics, type Counter, type Histogram, type MeterProvider } from "@opentelemetry/api";

/**
 * As métricas da aplicação — o que só o processo sabe (cap. 17). Um provider
 * global, injetado onde a medida acontece; os instrumentos vêm do
 * `MeterProvider` global que o `otel.ts` registrou antes do Nest. Sem SDK
 * (dev, teste) a API do OpenTelemetry devolve instrumentos no-op: registrar
 * custa uma chamada vazia. Os testes passam um `MeterProvider` em memória.
 *
 * REGRA DE CARDINALIDADE: nenhum rótulo com `escola_id`, `estudante_id`, id de
 * sessão ou URL crua. Cem escolas multiplicam cada série por cem e a franquia
 * de 150 MiB acaba na primeira semana. Rótulos são conjuntos FECHADOS e
 * pequenos: `modelo` (2–3 valores de env), `operacao`, `resultado`, `perfil`,
 * `motivo`, `finishReason` (allowlist), `rota` (normalizada), `superficie`.
 * Escola vai para o log (que se filtra) e para a telemetria (que se agrega em SQL).
 */
export const NOMES_DE_VITAL = ["LCP", "INP", "CLS", "TTFB"] as const;
export type NomeDeVital = (typeof NOMES_DE_VITAL)[number];

/** Token do MeterProvider: ninguém o provê no container (vale o global do `otel.ts`); os testes passam um em memória. */
export const METER_PROVIDER = "METER_PROVIDER";

/** `finishReason` é string do vendor: fora da allowlist vira `outro`, senão cada valor novo é uma série. */
const FINISH_REASONS = new Set(["STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "MALFORMED_FUNCTION_CALL"]);

export function rotuloDeFinishReason(bruto: string | undefined): string {
  if (!bruto) return "desconhecido";
  return FINISH_REASONS.has(bruto) ? bruto : "outro";
}

@Injectable()
export class Metricas {
  // --- IA: o custo variável da plataforma e o sinal de que menos se sabia ---
  readonly iaLatencia: Histogram;
  readonly iaTokens: Counter;
  readonly iaRespostas: Counter;
  readonly iaVoltas: Histogram;
  readonly iaTentativas: Histogram;
  readonly iaQuotaRecusas: Counter;
  // --- telemetria analítica: o pipeline SDK → Pub/Sub → banco ---
  readonly telemetriaRecebidos: Counter;
  readonly telemetriaPublicados: Counter;
  readonly telemetriaGravados: Counter;
  readonly telemetriaDescartados: Counter;
  // --- sinais do navegador que entram pela api ---
  readonly errosDeClienteRecebidos: Counter;
  readonly errosDeClienteRecusados: Counter;
  readonly vitaisRecusados: Counter;
  readonly spansRecebidos: Counter;
  readonly spansDescartados: Counter;
  private readonly vitais: Record<NomeDeVital, Histogram>;

  constructor(@Optional() @Inject(METER_PROVIDER) provider?: MeterProvider) {
    const meter = (provider ?? metrics).getMeter("unooria-api");

    this.iaLatencia = meter.createHistogram("unooria.ia.latencia", {
      unit: "ms",
      description: "Latência de uma chamada ao provider de IA, por modelo, operação e resultado",
    });
    this.iaTokens = meter.createCounter("unooria.ia.tokens", { description: "Tokens consumidos por modelo e direção (entrada|saida|total)" });
    this.iaRespostas = meter.createCounter("unooria.ia.respostas", { description: "Respostas do provider por modelo e finishReason" });
    this.iaVoltas = meter.createHistogram("unooria.ia.voltas", { description: "Voltas de ferramenta numa conversa (conversar)" });
    this.iaTentativas = meter.createHistogram("unooria.ia.tentativas", { description: "Em que tentativa a validação passou" });
    this.iaQuotaRecusas = meter.createCounter("unooria.ia.quota_recusas", { description: "Chamadas recusadas por quota diária esgotada, por perfil" });

    this.telemetriaRecebidos = meter.createCounter("unooria.telemetria.recebidos", { description: "Eventos recebidos da SDK, por canal (batch|beacon)" });
    this.telemetriaPublicados = meter.createCounter("unooria.telemetria.publicados", { description: "Eventos publicados no Pub/Sub (ou logados, sem tópico)" });
    this.telemetriaGravados = meter.createCounter("unooria.telemetria.gravados", { description: "Eventos gravados em telemetria_eventos pelo ingest" });
    this.telemetriaDescartados = meter.createCounter("unooria.telemetria.descartados", {
      description: "Lotes descartados, por motivo — o sinal contável dos caminhos que antes eram console.warn",
    });

    this.errosDeClienteRecebidos = meter.createCounter("unooria.observabilidade.erros_cliente", { description: "Erros de cliente registrados, por superfície (hub|exp)" });
    this.errosDeClienteRecusados = meter.createCounter("unooria.observabilidade.erros_recusados", {
      description: "Erros de cliente recusados, por motivo (cota|invalido) e superfície — `invalido` é o corpo que o Zod barrou, e existir foi o que faltou em 2026-09: um `versao` grande demais recusou TODO erro do hub por seis dias, com o único vestígio numa linha de log que ninguém tinha motivo para procurar",
    });
    this.vitaisRecusados = meter.createCounter("unooria.observabilidade.vitais_recusados", { description: "Web Vitals recusados, por motivo (cota|invalido)" });
    this.spansRecebidos = meter.createCounter("unooria.observabilidade.spans_recebidos", { description: "Spans OTLP recebidos do navegador, por superfície" });
    this.spansDescartados = meter.createCounter("unooria.observabilidade.spans_descartados", {
      description: "Spans OTLP descartados, por motivo (cota|sem-identidade|tamanho|sem-projeto|upstream)",
    });

    this.vitais = {
      LCP: meter.createHistogram("unooria.web.lcp", { unit: "ms", description: "Largest Contentful Paint" }),
      INP: meter.createHistogram("unooria.web.inp", { unit: "ms", description: "Interaction to Next Paint" }),
      CLS: meter.createHistogram("unooria.web.cls", { description: "Cumulative Layout Shift" }),
      TTFB: meter.createHistogram("unooria.web.ttfb", { unit: "ms", description: "Time to First Byte" }),
    };
  }

  vital(nome: NomeDeVital): Histogram {
    return this.vitais[nome];
  }
}

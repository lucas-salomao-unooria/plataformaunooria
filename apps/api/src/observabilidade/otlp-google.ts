import { GoogleAuth } from "google-auth-library";
import { Agent, fetch as fetchDoUndici } from "undici";

/**
 * O cliente OTLP/HTTP para a Telemetry API do Google
 * (`telemetry.googleapis.com`): é por aqui que saem as MÉTRICAS da api e os
 * SPANS que as experiências mandam do navegador (depois de validados e
 * reescritos pelo `ProxyOtlpService`).
 *
 * Por que não os exportadores `@google-cloud/opentelemetry-*` para tudo: o de
 * métricas arrasta o pacote `googleapis` inteiro — 202 MB medidos em
 * `node_modules` — para chamar um método. O de traces (gRPC) fica, é leve.
 * E por que não o `exporter-*-otlp-http` do OpenTelemetry: ele recebe
 * cabeçalhos ESTÁTICOS, e o token OAuth da service account expira em uma
 * hora. Aqui o token é pedido ao `google-auth-library` a cada envio (ele
 * cacheia e renova sozinho), a mesma cadeia ADC que já autentica o Vertex.
 *
 * `undici` importado explicitamente, com `Agent` próprio (ADR-45): misturar o
 * `fetch` global com um `Agent` do undici quebra com `invalid onError method`.
 */
export type CaminhoOtlp = "v1/traces" | "v1/metrics";

export interface RespostaOtlp {
  ok: boolean;
  status: number;
  detalhe?: string;
}

export interface OpcoesDoClienteOtlp {
  auth?: Pick<GoogleAuth, "getAccessToken">;
  fetch?: typeof fetchDoUndici;
  base?: string;
  timeoutMs?: number;
}

export const BASE_TELEMETRY_API = "https://telemetry.googleapis.com";
const TIMEOUT_PADRAO_MS = 5_000;
const dispatcher = new Agent({ headersTimeout: 15_000, bodyTimeout: 15_000 });

export class ClienteOtlpGoogle {
  private readonly auth: Pick<GoogleAuth, "getAccessToken">;
  private readonly fetch: typeof fetchDoUndici;
  private readonly base: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly projeto: string,
    opcoes: OpcoesDoClienteOtlp = {},
  ) {
    this.auth = opcoes.auth ?? new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    this.fetch = opcoes.fetch ?? fetchDoUndici;
    this.base = opcoes.base ?? BASE_TELEMETRY_API;
    this.timeoutMs = opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS;
  }

  async enviar(caminho: CaminhoOtlp, corpo: Uint8Array | string): Promise<RespostaOtlp> {
    const token = await this.auth.getAccessToken();
    if (!token) return { ok: false, status: 0, detalhe: "sem credencial ADC" };
    const res = await this.fetch(`${this.base}/${caminho}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        // O projeto que paga a cota: exige `roles/serviceusage.serviceUsageConsumer`.
        "x-goog-user-project": this.projeto,
      },
      body: corpo,
      dispatcher,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, detalhe: (await res.text().catch(() => "")).slice(0, 300) };
  }
}

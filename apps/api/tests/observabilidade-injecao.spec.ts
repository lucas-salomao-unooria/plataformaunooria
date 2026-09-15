import { Module, type Provider } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { OtlpTracesSchema } from "../src/observabilidade/contrato-de-rotas";
import { Metricas } from "../src/observabilidade/metricas";
import { PROVIDER_DO_CLIENTE_OTLP } from "../src/observabilidade/observabilidade.module";
import { ClienteOtlpGoogle } from "../src/observabilidade/otlp-google";
import { ProxyOtlpService } from "../src/observabilidade/otlp-proxy.service";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * A rede do defeito de 2026-09-14: o proxy recebia `undefined` no lugar do
 * `ClienteOtlpGoogle` e descartava TODO span de navegador como `sem-projeto`,
 * com `GCP_PROJECT_ID` presente nos ambientes e a rota respondendo 204.
 *
 * A causa era `import type { ClienteOtlpGoogle }`: o identificador sai do
 * escopo de valor, o `emitDecoratorMetadata` grava `Function` no
 * `design:paramtypes`, o Nest não acha provider para esse token e o
 * `@Optional()` engole a falha.
 *
 * Por que as suítes existentes não pegaram: todas fazem
 * `new ProxyOtlpService(metricas, cliente)`, e injeção manual não passa pelo
 * container — é justamente o caminho onde o bug não aparece. Aqui o service e o
 * cliente saem do CONTAINER, com a factory REAL do módulo (`@nestjs/testing`
 * não é dependência deste projeto; `createApplicationContext` do `core`, que
 * já é, monta o mesmo grafo).
 */
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

function lote(): unknown {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "hub" } },
            { key: "service.version", value: { stringValue: "a1b2c3d" } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "@opentelemetry/instrumentation-document-load", version: "0.222.0" },
            spans: [
              {
                traceId: TRACE,
                spanId: "00f067aa0ba902b7",
                name: "documentLoad",
                kind: 1,
                startTimeUnixNano: "1757808000000000000",
                endTimeUnixNano: "1757808000500000000",
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

async function contexto(providers: Provider[]) {
  @Module({ providers })
  class ModuloDeTeste {}
  return NestFactory.createApplicationContext(ModuloDeTeste, { logger: false });
}

describe("ProxyOtlpService sai do CONTAINER com o cliente injetado", () => {
  const projetoOriginal = process.env.GCP_PROJECT_ID;

  afterEach(() => {
    if (projetoOriginal === undefined) delete process.env.GCP_PROJECT_ID;
    else process.env.GCP_PROJECT_ID = projetoOriginal;
  });

  it("com GCP_PROJECT_ID, o lote é REEXPORTADO — nada de `sem-projeto`", async () => {
    process.env.GCP_PROJECT_ID = "projeto-de-teste";
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctx = await contexto([{ provide: Metricas, useValue: metricas }, ProxyOtlpService, PROVIDER_DO_CLIENTE_OTLP]);

    // A instância que a factory do módulo criou é a MESMA que o construtor
    // recebeu — é isso que o espião prova, e era isso que estava quebrado.
    const cliente = ctx.get(ClienteOtlpGoogle);
    expect(cliente).toBeInstanceOf(ClienteOtlpGoogle);
    const espiao = jest.spyOn(cliente, "enviar").mockResolvedValue({ ok: true, status: 200 });

    const proxy = ctx.get(ProxyOtlpService);
    await expect(proxy.receber(OtlpTracesSchema.parse(lote()), "e1:u-injecao")).resolves.toBe("aceito");

    expect(espiao).toHaveBeenCalledWith("v1/traces", expect.stringContaining('"service.name"'));
    // O resource carrega o projeto do PRÓPRIO cliente. Sem ele a Telemetry API
    // recusa o lote com 400 e o contador soma em `motivo=upstream` — o segundo
    // defeito do mesmo caminho, que só apareceu depois de consertar o primeiro.
    expect(espiao.mock.calls[0]?.[1]).toContain('{"key":"gcp.project_id","value":{"stringValue":"projeto-de-teste"}}');
    // O ponto de virada: com o token do construtor perdido, esta lista tem uma
    // linha `motivo: sem-projeto` e o espião acima nunca é chamado.
    expect(await pontos("unooria.observabilidade.spans_descartados")).toEqual([]);

    await ctx.close();
    await encerrar();
  });

  it("sem GCP_PROJECT_ID segue contando e descartando, sem lançar", async () => {
    delete process.env.GCP_PROJECT_ID;
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctx = await contexto([{ provide: Metricas, useValue: metricas }, ProxyOtlpService, PROVIDER_DO_CLIENTE_OTLP]);

    const proxy = ctx.get(ProxyOtlpService);
    await expect(proxy.receber(OtlpTracesSchema.parse(lote()), "e1:u-sem-projeto-container")).resolves.toBe("descartado");
    expect((await pontos("unooria.observabilidade.spans_descartados"))[0]?.attributes).toEqual({ motivo: "sem-projeto" });

    await ctx.close();
    await encerrar();
  });
});

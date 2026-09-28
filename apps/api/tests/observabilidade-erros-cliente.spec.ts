import { HttpException } from "@nestjs/common";
import type { AuthClaims } from "../src/auth/claims";
import { TIPO_ERRO_REPORTADO } from "../src/observabilidade/filtro-de-excecao";
import { logger } from "../src/observabilidade/logger";
import { ERROS_DE_CLIENTE_POR_MINUTO, ObservabilidadeController } from "../src/observabilidade/observabilidade.controller";
import { ProxyOtlpService } from "../src/observabilidade/otlp-proxy.service";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * O erro de cliente vira UMA linha ERROR agrupável, com serviceContext = a
 * experiência e a versão, redigida, com o id opaco do token — e a cota fecha o
 * laço de erro antes de virar inundação.
 */
const UA_CHROMEBOOK = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function req(
  usuarioId = "u1",
  perfil: AuthClaims["perfil"] = "estudante",
  userAgent: string = UA_CHROMEBOOK,
): { auth: AuthClaims; headers: Record<string, unknown> } {
  return { auth: { usuarioId, escolaId: "e1", perfil }, headers: { "user-agent": userAgent } };
}
const CORPO = {
  expId: "exp04ef1b",
  versao: "0.3.1",
  mensagem: "Cannot read properties of undefined (reading 'video') — maria@escola.gov.br",
  stack: "TypeError: Cannot read properties of undefined\n    at feed.tsx:42:11 cpf 12345678909",
  url: "https://exp/exp04ef1b/0.3.1/index.html",
  sessaoId: "6f1a1d1e-9c2b-4a4e-8f1e-1234567890ab",
};

let erro: jest.SpyInstance;
beforeEach(() => {
  erro = jest.spyOn(logger, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /observabilidade/erros-cliente", () => {
  it("emite UMA linha ERROR com @type, serviceContext da experiência e texto redigido", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadeController(metricas, new ProxyOtlpService(metricas));
    ctrl.errosCliente(CORPO, req("u-erro-1"));
    expect(erro).toHaveBeenCalledTimes(1);
    const [obj, mensagem] = erro.mock.calls[0] as [Record<string, unknown>, string];
    expect(obj).toMatchObject({
      "@type": TIPO_ERRO_REPORTADO,
      serviceContext: { service: "exp04ef1b", version: "0.3.1" },
      codigo: "erro-cliente",
      usuarioId: "u-erro-1",
      sessaoId: CORPO.sessaoId,
    });
    expect(JSON.stringify(obj)).not.toContain("maria@");
    expect(JSON.stringify(obj)).not.toContain("12345678909");
    expect(mensagem).not.toContain("maria@");
    expect(obj.stack_trace).toContain("TypeError");
    expect((await pontos("unooria.observabilidade.erros_cliente"))[0]?.attributes).toEqual({ superficie: "exp" });
    await encerrar();
  });

  it("corpo com campo extra ou url com query é recusado pelo Zod (vira 400 no filtro)", () => {
    const { metricas } = metricasEmMemoria();
    const ctrl = new ObservabilidadeController(metricas, new ProxyOtlpService(metricas));
    expect(() => ctrl.errosCliente({ ...CORPO, extra: 1 }, req("u-erro-2"))).toThrow();
    expect(() => ctrl.errosCliente({ ...CORPO, url: "https://exp/x?cpf=1" }, req("u-erro-2"))).toThrow();
    expect(() => ctrl.errosCliente({ ...CORPO, expId: "qualquer" }, req("u-erro-2"))).toThrow();
    expect(erro).not.toHaveBeenCalled();
  });

  it("a 6ª no minuto responde 429 e conta, sem log", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadeController(metricas, new ProxyOtlpService(metricas));
    for (let i = 0; i < ERROS_DE_CLIENTE_POR_MINUTO; i++) ctrl.errosCliente(CORPO, req("u-erro-3"));
    expect(erro).toHaveBeenCalledTimes(ERROS_DE_CLIENTE_POR_MINUTO);
    let capturado: unknown;
    try {
      ctrl.errosCliente(CORPO, req("u-erro-3"));
    } catch (e) {
      capturado = e;
    }
    expect(capturado).toBeInstanceOf(HttpException);
    expect((capturado as HttpException).getStatus()).toBe(429);
    expect(erro).toHaveBeenCalledTimes(ERROS_DE_CLIENTE_POR_MINUTO);
    expect((await pontos("unooria.observabilidade.erros_recusados"))[0]?.attributes).toEqual({ motivo: "cota", superficie: "autenticado" });
    // outro usuário não é afetado
    expect(() => ctrl.errosCliente(CORPO, req("u-erro-4"))).not.toThrow();
    await encerrar();
  });
});

describe("POST /observabilidade/vitals", () => {
  it("registra no histograma com rota normalizada e perfil do token; nunca loga", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadeController(metricas, new ProxyOtlpService(metricas));
    ctrl.vitals({ nome: "LCP", valor: 1832, rota: "/professor/turmas/abc", superficie: "hub" }, req("u-vital", "professor"));
    ctrl.vitals({ nome: "CLS", valor: 0.04, rota: "exp04ef1b", superficie: "exp" }, req("u-vital"));
    const lcp = await pontos("unooria.web.lcp");
    expect(lcp[0]?.attributes).toEqual({ superficie: "hub", rota: "/professor/:secao", perfil: "professor", tipo_dispositivo: "desktop" });
    expect((await pontos("unooria.web.cls"))[0]?.attributes).toEqual({ superficie: "exp", rota: "exp04ef1b", perfil: "estudante", tipo_dispositivo: "desktop" });
    expect(erro).not.toHaveBeenCalled();
    expect(() => ctrl.vitals({ nome: "FID", valor: 1, rota: "/", superficie: "hub" }, req("u-vital"))).toThrow();
    await encerrar();
  });
});

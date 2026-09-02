import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ArgumentsHost, HttpServer } from "@nestjs/common";
import { z } from "zod";
import { FiltroDeExcecao, TIPO_ERRO_REPORTADO } from "../src/observabilidade/filtro-de-excecao";
import { logger } from "../src/observabilidade/logger";
import { abrirContexto } from "../src/tenancy/tenancy-context";

/**
 * O filtro global: HttpException mantém o corpo de hoje; ZodError que escapou
 * do handler vira 400 sem o valor recebido; qualquer outra coisa vira 500 com
 * `requestId` no corpo e UMA linha ERROR agrupável pelo Error Reporting.
 */
function montar() {
  const reply = jest.fn();
  const adaptador = { reply, isHeadersSent: () => false, end: jest.fn() } as unknown as HttpServer;
  const req = { method: "POST", originalUrl: "/usuarios?cpf=123", route: { path: "/usuarios" } };
  const res = {};
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getArgByIndex: (i: number) => (i === 1 ? res : req),
  } as unknown as ArgumentsHost;
  return { filtro: new FiltroDeExcecao(adaptador), reply, host, res };
}

let erro: jest.SpyInstance;
let debug: jest.SpyInstance;
beforeEach(() => {
  erro = jest.spyOn(logger, "error").mockImplementation(() => undefined);
  debug = jest.spyOn(logger, "debug").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("FiltroDeExcecao", () => {
  it("HttpException 4xx: corpo intacto, sem linha ERROR", () => {
    const { filtro, reply, host, res } = montar();
    const excecao = new NotFoundException("turma não encontrada");
    filtro.catch(excecao, host);
    expect(reply).toHaveBeenCalledWith(res, excecao.getResponse(), 404);
    expect(erro).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("HttpException 5xx: corpo intacto E uma linha ERROR com stack", () => {
    const { filtro, reply, host, res } = montar();
    const excecao = new ServiceUnavailableException("banco indisponível");
    filtro.catch(excecao, host);
    expect(reply).toHaveBeenCalledWith(res, excecao.getResponse(), 503);
    expect(erro).toHaveBeenCalledTimes(1);
    expect(erro.mock.calls[0]?.[0]).toMatchObject({ status: 503, codigo: "http-5xx", rota: "POST /usuarios" });
  });

  it("ZodError que escapou vira 400 com `path: code`, nunca com o valor recebido", () => {
    const { filtro, reply, host } = montar();
    const resultado = z.object({ nome: z.string(), cpf: z.string().length(11) }).safeParse({ nome: 123, cpf: "12345678909-SEGREDO" });
    if (resultado.success) throw new Error("o fixture devia falhar");
    abrirContexto({ requestId: "r1" }, () => filtro.catch(resultado.error, host));
    const [, corpo, status] = reply.mock.calls[0] as [unknown, { codigo: string; problemas: string; requestId: string }, number];
    expect(status).toBe(400);
    expect(corpo.codigo).toBe("corpo-invalido");
    expect(corpo.requestId).toBe("r1");
    expect(corpo.problemas).toContain("nome: invalid_type");
    expect(corpo.problemas).toContain("cpf: too_big");
    expect(JSON.stringify(corpo)).not.toContain("SEGREDO");
    expect(erro).not.toHaveBeenCalled();
  });

  it("erro não previsto vira 500 com requestId e EXATAMENTE uma linha ERROR agrupável", () => {
    const { filtro, reply, host, res } = montar();
    const boom = new Error("boom");
    abrirContexto({ requestId: "r2", escolaId: "e1" }, () => filtro.catch(boom, host));
    expect(reply).toHaveBeenCalledWith(res, { codigo: "erro-interno", requestId: "r2" }, 500);
    expect(erro).toHaveBeenCalledTimes(1);
    const [obj, mensagem] = erro.mock.calls[0] as [Record<string, unknown>, string];
    expect(obj).toMatchObject({ err: boom, codigo: "erro-interno", "@type": TIPO_ERRO_REPORTADO, rota: "POST /usuarios" });
    expect(mensagem).toContain("Error: boom");
  });

  it("valor lançado que não é Error também vira 500 (e não derruba o filtro)", () => {
    const { filtro, reply, host } = montar();
    expect(() => filtro.catch("string solta", host)).not.toThrow();
    expect(reply.mock.calls[0]?.[2]).toBe(500);
  });

  it("sem template de rota, usa o caminho sem query (e redigido)", () => {
    const reply = jest.fn();
    const adaptador = { reply, isHeadersSent: () => false, end: jest.fn() } as unknown as HttpServer;
    const req = { method: "GET", originalUrl: "/estudantes/12345678909?x=1" };
    const host = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
      getArgByIndex: () => req,
    } as unknown as ArgumentsHost;
    new FiltroDeExcecao(adaptador).catch(new Error("x"), host);
    expect((erro.mock.calls[0]?.[0] as { rota: string }).rota).toBe("GET /estudantes/[redigido]");
  });
});

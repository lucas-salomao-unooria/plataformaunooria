import { HttpException } from "@nestjs/common";
import { TIPO_ERRO_REPORTADO } from "../src/observabilidade/filtro-de-excecao";
import { logger } from "../src/observabilidade/logger";
import {
  ERROS_PUBLICOS_POR_IP_POR_MINUTO,
  ObservabilidadePublicoController,
  ipDoCliente,
} from "../src/observabilidade/observabilidade-publico.controller";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * A rota sem sessão (ADR-84): é ela que faz "ninguém consegue entrar" deixar
 * rastro. O que se cobra aqui é o que a distingue da autenticada — nenhum id de
 * pessoa na linha, `expId` sempre `hub`, e recusa que CONTA sem logar.
 */
const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function req(ip: string, userAgent = UA_ANDROID): { headers: Record<string, unknown> } {
  return { headers: { "x-forwarded-for": `${ip}, 34.107.180.186`, "user-agent": userAgent } };
}

const CORPO = {
  expId: "hub",
  versao: "b14c92178106",
  mensagem: "TypeError: undefined is not a function",
  stack: "TypeError: undefined is not a function\n    at login.tsx:12:3",
  url: "https://entreredes.unooria.com/login",
  sessaoId: "6f1a1d1e-9c2b-4a4e-8f1e-1234567890ab",
};

let erro: jest.SpyInstance;
beforeEach(() => {
  erro = jest.spyOn(logger, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("ipDoCliente", () => {
  it("pega o PRIMEIRO elemento do X-Forwarded-For — o cliente, antes dos proxies", () => {
    expect(ipDoCliente({ "x-forwarded-for": "203.0.113.7, 34.107.180.186" })).toBe("203.0.113.7");
  });

  it("sem cabeçalho, com cabeçalho vazio ou com lixo enorme, devolve `desconhecido` em vez de lançar", () => {
    expect(ipDoCliente({})).toBe("desconhecido");
    expect(ipDoCliente({ "x-forwarded-for": "" })).toBe("desconhecido");
    expect(ipDoCliente({ "x-forwarded-for": "x".repeat(500) })).toBe("desconhecido");
  });
});

describe("POST /observabilidade/publico/erros-cliente", () => {
  it("registra o erro de quem NÃO tem sessão, sem id de pessoa e marcado como não autenticado", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    ctrl.errosCliente(CORPO, req("203.0.113.10"));

    expect(erro).toHaveBeenCalledTimes(1);
    const [obj] = erro.mock.calls[0] as [Record<string, unknown>, string];
    expect(obj).toMatchObject({
      "@type": TIPO_ERRO_REPORTADO,
      serviceContext: { service: "hub", version: "b14c92178106" },
      codigo: "erro-cliente",
      autenticado: false,
      navegador: "chrome",
      so: "android",
      tipoDeDispositivo: "mobile",
    });
    // O que esta rota NÃO pode ter: identidade que ela não tem como conhecer.
    expect(obj).not.toHaveProperty("usuarioId");
    expect(obj).not.toHaveProperty("estudanteId");
    expect(obj).not.toHaveProperty("perfilDoToken");
    expect((await pontos("unooria.observabilidade.erros_cliente"))[0]?.attributes).toEqual({ superficie: "publico" });
    await encerrar();
  });

  it("IGNORA o expId do corpo: antes do hub:init nenhuma experiência conhece a api", () => {
    const { metricas } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    ctrl.errosCliente({ ...CORPO, expId: "exp-01-instanooria" }, req("203.0.113.11"));
    const [obj] = erro.mock.calls[0] as [Record<string, unknown>, string];
    expect(obj).toMatchObject({ expId: "hub", serviceContext: { service: "hub", version: CORPO.versao } });
  });

  it("redige e-mail e CPF da mensagem, como a rota autenticada", () => {
    const { metricas } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    ctrl.errosCliente(
      { ...CORPO, mensagem: "falhou para maria@escola.gov.br cpf 123.456.789-09" },
      req("203.0.113.12"),
    );
    const [, mensagem] = erro.mock.calls[0] as [Record<string, unknown>, string];
    expect(mensagem).not.toContain("maria@escola.gov.br");
    expect(mensagem).not.toContain("123.456.789-09");
    expect(mensagem).toContain("[redigido]");
  });

  it("aceita o SHA de 40 caracteres — a regressão que deixou o hub sem um único erro por seis dias", () => {
    const { metricas } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    const sha = "b14c921781066534cc38d956d0616b67ff86c567";
    expect(sha).toHaveLength(40);
    expect(() => ctrl.errosCliente({ ...CORPO, versao: sha }, req("203.0.113.13"))).not.toThrow();
    expect(erro).toHaveBeenCalledTimes(1);
  });

  it(`a ${ERROS_PUBLICOS_POR_IP_POR_MINUTO + 1}ª do mesmo IP no minuto responde 429, CONTA e não loga`, async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    const de = req("203.0.113.20");
    for (let i = 0; i < ERROS_PUBLICOS_POR_IP_POR_MINUTO; i += 1) ctrl.errosCliente(CORPO, de);
    expect(erro).toHaveBeenCalledTimes(ERROS_PUBLICOS_POR_IP_POR_MINUTO);

    expect(() => ctrl.errosCliente(CORPO, de)).toThrow(HttpException);
    expect(erro).toHaveBeenCalledTimes(ERROS_PUBLICOS_POR_IP_POR_MINUTO); // a recusa não vira linha
    expect((await pontos("unooria.observabilidade.erros_recusados"))[0]?.attributes).toEqual({
      motivo: "cota",
      superficie: "publico",
    });
    await encerrar();
  });

  it("outro IP não paga a cota do primeiro", () => {
    const { metricas } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    const cheio = req("203.0.113.30");
    for (let i = 0; i < ERROS_PUBLICOS_POR_IP_POR_MINUTO; i += 1) ctrl.errosCliente(CORPO, cheio);
    expect(() => ctrl.errosCliente(CORPO, req("203.0.113.31"))).not.toThrow();
  });

  it("corpo inválido vira 400 e CONTA — o contador que faltava quando o schema recusava tudo", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    expect(() => ctrl.errosCliente({ expId: "hub" }, req("203.0.113.40"))).toThrow(HttpException);
    expect(erro).not.toHaveBeenCalled();
    expect((await pontos("unooria.observabilidade.erros_recusados"))[0]?.attributes).toEqual({
      motivo: "invalido",
      superficie: "publico",
    });
    await encerrar();
  });
});

describe("POST /observabilidade/publico/vitals", () => {
  it("registra o vital da tela de login com perfil anônimo e o tipo de aparelho", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const ctrl = new ObservabilidadePublicoController(metricas);
    ctrl.vitals({ nome: "TTFB", valor: 812, rota: "/login", superficie: "hub" }, req("203.0.113.50"));
    expect((await pontos("unooria.web.ttfb"))[0]?.attributes).toEqual({
      superficie: "hub",
      rota: "/login",
      perfil: "anonimo",
      tipo_dispositivo: "mobile",
    });
    expect(erro).not.toHaveBeenCalled();
    await encerrar();
  });
});

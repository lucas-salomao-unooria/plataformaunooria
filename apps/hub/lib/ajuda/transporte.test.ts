import { describe, expect, it, vi } from "vitest";

import { abrirSessao, encerrarSessao, lerConfiguracao, recusaParaTela } from "./transporte";

/**
 * Abrir a Ajuda visto do NAVEGADOR: a resposta do BFF, montada à mão. O que
 * importa é a frase da tela e se ela oferece "Tentar de novo".
 */

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

const SESSAO = {
  atendente: "avatar",
  id: "00000000-0000-4000-8000-000000000001",
  tokenDaSessao: "token",
  duracaoMaximaS: 600,
  segundosRestantesHoje: 1200,
};

describe("abrir a Ajuda", () => {
  it("devolve a sessão quando o BFF aceita", async () => {
    const f = vi.fn(async () => resposta(201, SESSAO));
    await expect(abrirSessao(undefined, f as unknown as typeof fetch)).resolves.toEqual({ ok: true, sessao: SESSAO });
    expect(f).toHaveBeenCalledWith("/api/plataforma/ajuda/sessoes", expect.objectContaining({ method: "POST" }));
  });

  it("sem minutos: a frase da api, sem 'Tentar de novo'", async () => {
    const f = async () => resposta(429, { codigo: "SEM_MINUTOS", mensagem: "Você já usou todos os minutos de Ajuda de hoje." });
    await expect(abrirSessao(undefined, f as unknown as typeof fetch)).resolves.toEqual({
      ok: false,
      mensagem: "Você já usou todos os minutos de Ajuda de hoje.",
      podeRepetir: false,
    });
  });

  it("vendor fora do ar (502) oferece tentar de novo", async () => {
    const f = async () => resposta(502, { codigo: "AVATAR_FALHOU", mensagem: "Não conseguimos chamar o atendente agora." });
    const r = await abrirSessao(undefined, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, podeRepetir: true });
  });

  it("rede caída vira a frase de conexão", async () => {
    const f = async () => {
      throw new TypeError("Failed to fetch");
    };
    const r = await abrirSessao(undefined, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, podeRepetir: true });
  });

  it("resposta fora do contrato não abre a sala", async () => {
    const f = async () => resposta(201, { id: "não-é-uuid" });
    await expect(abrirSessao(undefined, f as unknown as typeof fetch)).resolves.toMatchObject({ ok: false });
  });

  it("produto desligado (403) diz que não está disponível", () => {
    expect(recusaParaTela(403, { codigo: "recurso-indisponivel" }).mensagem).toMatch(/não está disponível/);
  });
});

describe("encerrar a Ajuda", () => {
  it("usa keepalive — o aviso sobrevive ao fechamento da aba", () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    encerrarSessao("abc", f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith(
      "/api/plataforma/ajuda/sessoes/abc/encerrar",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });
});

describe("o mascote (ADR-158)", () => {
  const MASCOTE = {
    atendente: "mascote",
    id: "00000000-0000-4000-8000-000000000002",
    bilhete: "a.b.c-bilhete-de-entrada",
    duracaoMaximaS: 600,
    segundosRestantesHoje: 1200,
    ajustes: { voz: "Leda", modelo: "gemini-3.8-live", sensibilidade: 0.5, suavizacao: 0.5, antecipacaoMs: 60, bocaRepouso: 0.5 },
  };

  it("abre o mascote e manda o atendente pedido no corpo", async () => {
    const f = vi.fn(async () => resposta(201, MASCOTE));
    await expect(abrirSessao("mascote", f as unknown as typeof fetch)).resolves.toEqual({ ok: true, sessao: MASCOTE });
    expect(f).toHaveBeenCalledWith(
      "/api/plataforma/ajuda/sessoes",
      expect.objectContaining({ body: JSON.stringify({ atendente: "mascote" }) }),
    );
  });

  it("lê quem atende; resposta fora do formato vira null", async () => {
    const config = { atendente: "mascote", podeTrocar: true, modeloDoMascote: "http://localhost:3001/assets/ajuda/mascote/mascote-v1.glb" };
    const ok = vi.fn(async () => resposta(200, config));
    await expect(lerConfiguracao(ok as unknown as typeof fetch)).resolves.toEqual(config);
    const torto = vi.fn(async () => resposta(200, { atendente: "robo" }));
    await expect(lerConfiguracao(torto as unknown as typeof fetch)).resolves.toBeNull();
  });
});

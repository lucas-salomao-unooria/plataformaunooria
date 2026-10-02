import { describe, expect, test } from "vitest";
import { concluirCriacao } from "./criar-atividade";

/**
 * O fim da criação (ADR-130) com um `fetch` falso: a ordem das chamadas e a
 * versão com que as equipes são gravadas. O caso que motivou o teste: a
 * atividade que JÁ tinha equipes (o "Criar atividade" idempotente devolve o
 * mesmo pacote) respondia 409 porque o PUT ia sempre com `versao: 0`.
 */

type Chamada = { url: string; method: string; corpo: unknown };

function buscaFalsa(montagemExistente: { versao: number } | null) {
  const chamadas: Chamada[] = [];
  const busca = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const corpo = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    chamadas.push({ url, method, corpo });
    if (method === "GET") {
      return new Response(JSON.stringify({ permitida: true, montagem: montagemExistente, equipes: [] }), { status: 200 });
    }
    if (url.endsWith("/sugestao")) {
      return new Response(JSON.stringify({ equipes: [{ nome: "Equipe 1", membros: [{ id: "a", nome: "A" }] }] }), {
        status: 200,
      });
    }
    return new Response("{}", { status: 200 });
  };
  return { busca, chamadas };
}

const ARGS = { expId: "exp05ef1b" as const, turmaId: "t1", atividadeId: "at1", porNoAr: false };

describe("concluirCriacao: a versão das equipes", () => {
  test("atividade nova: grava com versão 0", async () => {
    const { busca, chamadas } = buscaFalsa(null);
    const fim = await concluirCriacao({ ...ARGS, equipes: { modo: "individual" } }, busca);
    expect(fim.avisos).toEqual([]);
    const put = chamadas.find((c) => c.method === "PUT");
    expect(put?.corpo).toMatchObject({ versao: 0, modo: "individual" });
  });

  test("atividade que já tinha equipes: grava com a versão atual, sem 409", async () => {
    const { busca, chamadas } = buscaFalsa({ versao: 3 });
    const fim = await concluirCriacao({ ...ARGS, equipes: { modo: "individual" } }, busca);
    expect(fim.avisos).toEqual([]);
    expect(chamadas.find((c) => c.method === "PUT")?.corpo).toMatchObject({ versao: 3 });
  });

  test("sorteio: a sugestão vem antes, e o PUT leva a versão atual", async () => {
    const { busca, chamadas } = buscaFalsa({ versao: 2 });
    await concluirCriacao({ ...ARGS, equipes: { modo: "sorteio", computadores: 4 } }, busca);
    const ordem = chamadas.map((c) => `${c.method} ${c.url.endsWith("/sugestao") ? "sugestao" : "montagem"}`);
    expect(ordem).toEqual(["GET montagem", "POST sugestao", "PUT montagem"]);
    expect(chamadas.at(-1)?.corpo).toMatchObject({ versao: 2, modo: "sorteio", computadores: 4 });
  });

  test("manual não grava equipe nenhuma", async () => {
    const { busca, chamadas } = buscaFalsa(null);
    await concluirCriacao({ ...ARGS, equipes: { modo: "manual", computadores: 3 } }, busca);
    expect(chamadas).toEqual([]);
  });
});

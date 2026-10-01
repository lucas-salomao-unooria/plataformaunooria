import { describe, expect, it, vi } from "vitest";

import type { EventoDoTurno } from "./contrato";
import { recusaParaTela, transmitirTurno } from "./transporte";

/**
 * O turno visto do NAVEGADOR: o `fetch` POST e a leitura do stream, com um
 * `Response` montado à mão. O que importa provar é o desfecho — terminou,
 * recusou, foi interrompido, caiu — porque é dele que a tela decide o que
 * mostrar e se oferece "Tentar de novo".
 */

const encoder = new TextEncoder();

/** Um corpo SSE que entrega os pedaços na ordem, e (opcionalmente) fica pendurado no fim. */
function corpoSse(pedacos: string[], opcoes: { pendurar?: boolean; falhar?: boolean; signal?: AbortSignal } = {}) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    start(controlador) {
      /* O `fetch` de verdade liga o sinal ao corpo: o abort ERRA o stream, e a
         leitura pendurada rejeita. Aqui a ligação é à mão. */
      opcoes.signal?.addEventListener("abort", () => controlador.error(new DOMException("aborted", "AbortError")));
    },
    pull(controlador) {
      if (i < pedacos.length) {
        controlador.enqueue(encoder.encode(pedacos[i]!));
        i += 1;
        return;
      }
      if (opcoes.falhar) return controlador.error(new TypeError("network error"));
      if (!opcoes.pendurar) controlador.close();
      // Pendurado: nunca fecha — só o abort tira a leitura daqui.
      return new Promise<void>(() => {});
    },
  });
}

function respostaSse(pedacos: string[], opcoes?: { pendurar?: boolean; falhar?: boolean; signal?: AbortSignal }) {
  return new Response(corpoSse(pedacos, opcoes), {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

async function turno(resposta: Response | (() => Promise<Response>), signal = new AbortController().signal) {
  const eventos: EventoDoTurno[] = [];
  const buscar = vi.fn(typeof resposta === "function" ? resposta : async () => resposta);
  const desfecho = await transmitirTurno({
    conversaId: "c1",
    texto: "Quais habilidades?",
    signal,
    aoEvento: (e) => eventos.push(e),
    fetch: buscar as unknown as typeof fetch,
  });
  return { desfecho, eventos, buscar };
}

describe("transmitirTurno", () => {
  it("POST pelo hub, com a pergunta no corpo — nunca direto na api", async () => {
    const { buscar } = await turno(respostaSse(["event: fim\ndata: {}\n\n"]));
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/plataforma/agente-professor/conversas/c1/mensagens");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ texto: "Quais habilidades?" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("entrega os eventos na ordem, com frames partidos entre pedaços, e termina no `fim`", async () => {
    const { desfecho, eventos } = await turno(
      respostaSse([
        'event: delta\ndata: {"tex',
        'to":"Encontrei "}\n\nevent: delta\ndata: {"texto":"EF06MA01"}\n',
        '\n: ping\n\nevent: fontes\ndata: {"fontes":[{"titulo":"BNCC — Ensino Fundamental","paginaInicio":300,"paginaFim":301}]}\n\n',
        'event: titulo\ndata: {"titulo":"Números naturais no 6º ano"}\n\nevent: fim\ndata: {}\n\n',
      ]),
    );
    expect(desfecho).toEqual({ tipo: "terminou", evento: "fim" });
    expect(eventos.map((e) => e.tipo)).toEqual(["delta", "delta", "fontes", "titulo", "fim"]);
    expect(eventos[1]).toEqual({ tipo: "delta", texto: "EF06MA01" });
  });

  it("um caractere multibyte partido entre pedaços chega inteiro (`TextDecoder` em modo stream)", async () => {
    const bytes = encoder.encode('event: delta\ndata: {"texto":"6º ano"}\n\nevent: fim\ndata: {}\n\n');
    const corte = bytes.indexOf(0xc2) + 1; // no meio do "º"
    const corpo = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, corte));
        c.enqueue(bytes.slice(corte));
        c.close();
      },
    });
    const { eventos } = await turno(
      new Response(corpo, { headers: { "content-type": "text/event-stream" } }),
    );
    expect(eventos[0]).toEqual({ tipo: "delta", texto: "6º ano" });
  });

  it("`erro` depois de deltas encerra o turno, e o que vier depois é descartado", async () => {
    const { desfecho, eventos } = await turno(
      respostaSse([
        'event: delta\ndata: {"texto":"Começo"}\n\n',
        'event: erro\ndata: {"codigo":"TEMPO_ESGOTADO","mensagem":"Demorou."}\n\n',
        'event: delta\ndata: {"texto":"não pode chegar"}\n\n',
      ]),
    );
    expect(desfecho).toEqual({ tipo: "terminou", evento: "erro" });
    expect(eventos.map((e) => e.tipo)).toEqual(["delta", "erro"]);
  });

  it("recusa JSON antes do stream (429 QUOTA): sem evento, com a frase da api e SEM repetir", async () => {
    const { desfecho, eventos } = await turno(
      new Response(JSON.stringify({ codigo: "QUOTA", mensagem: "Você usou toda a cota de IA de hoje." }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(eventos).toEqual([]);
    expect(desfecho).toEqual({
      tipo: "recusado",
      recusa: { status: 429, codigo: "QUOTA", mensagem: "Você usou toda a cota de IA de hoje.", podeRepetir: false },
    });
  });

  it("\"Parar\": o abort no meio do stream devolve `interrompido`", async () => {
    const controle = new AbortController();
    const resposta = respostaSse(['event: delta\ndata: {"texto":"Meia"}\n\n'], {
      pendurar: true,
      signal: controle.signal,
    });
    const pendente = turno(resposta, controle.signal);
    await new Promise((r) => setTimeout(r, 10));
    controle.abort();
    const { desfecho, eventos } = await pendente;
    expect(eventos).toEqual([{ tipo: "delta", texto: "Meia" }]);
    expect(desfecho).toEqual({ tipo: "interrompido" });
  });

  it("abort ANTES da resposta (o `fetch` rejeita) também é `interrompido`, não erro", async () => {
    const controle = new AbortController();
    controle.abort();
    const { desfecho } = await turno(async () => {
      throw new DOMException("aborted", "AbortError");
    }, controle.signal);
    expect(desfecho).toEqual({ tipo: "interrompido" });
  });

  it("conexão que cai no meio, ou que fecha sem `fim`, é `caiu`", async () => {
    expect((await turno(respostaSse(['event: delta\ndata: {"texto":"x"}\n\n'], { falhar: true }))).desfecho).toEqual({
      tipo: "caiu",
    });
    expect((await turno(respostaSse(['event: delta\ndata: {"texto":"x"}\n\n']))).desfecho).toEqual({ tipo: "caiu" });
  });

  it("rede fora (o `fetch` rejeita sem abort) é recusa com repetir", async () => {
    const { desfecho } = await turno(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(desfecho).toMatchObject({ tipo: "recusado", recusa: { status: 0, podeRepetir: true } });
  });
});

describe("recusaParaTela", () => {
  it("cada recusa da api vira a frase da tela e a decisão de oferecer repetir", () => {
    expect(recusaParaTela(429, { codigo: "RATE_LIMIT", mensagem: "Muitas mensagens." })).toMatchObject({
      mensagem: "Muitas mensagens.",
      podeRepetir: true,
    });
    expect(recusaParaTela(503, { codigo: "AGENTE_INDISPONIVEL", mensagem: "Fora do ar." })).toMatchObject({
      mensagem: "Fora do ar.",
      podeRepetir: true,
    });
    expect(recusaParaTela(403, { codigo: "recurso-indisponivel", mensagem: "x" })).toMatchObject({
      mensagem: "O agente de IA do professor não está disponível nesta escola.",
      podeRepetir: false,
    });
    expect(recusaParaTela(404, { codigo: "conversa-inexistente" }).podeRepetir).toBe(false);
    expect(recusaParaTela(401, null).podeRepetir).toBe(false);
    expect(recusaParaTela(400, { codigo: "corpo-invalido", mensagem: "Escreva de 1 a 4.000." }).mensagem).toBe(
      "Escreva de 1 a 4.000.",
    );
    // Sem corpo: a frase padrão, nunca vazia.
    expect(recusaParaTela(502, null).mensagem).toMatch(/não respondeu/);
  });
});

import { describe, expect, it } from "vitest";

import { LeitorDeSse, type FrameSse } from "./sse";

/**
 * O leitor de frames do turno do agente. O stream chega em pedaços que NÃO
 * respeitam a fronteira dos frames (o TCP, o proxy e o `TextDecoder` cortam
 * onde quiserem): cada caso aqui é um corte que já quebra parser ingênuo.
 */

/** Empurra os pedaços um a um e junta tudo o que sair, até o fim do stream. */
function ler(...pedacos: string[]): FrameSse[] {
  const leitor = new LeitorDeSse();
  return [...pedacos.flatMap((p) => leitor.empurrar(p)), ...leitor.terminar()];
}

const TURNO =
  'event: delta\ndata: {"texto":"Olá"}\n\n' +
  ": ping\n\n" +
  'event: fontes\ndata: {"fontes":[]}\n\n' +
  "event: fim\ndata: {}\n\n";

describe("LeitorDeSse", () => {
  it("lê um turno inteiro num pedaço só, e o comentário `: ping` não vira frame", () => {
    expect(ler(TURNO)).toEqual([
      { evento: "delta", dados: '{"texto":"Olá"}' },
      { evento: "fontes", dados: '{"fontes":[]}' },
      { evento: "fim", dados: "{}" },
    ]);
  });

  it("frame partido em qualquer ponto dá o MESMO resultado (caractere a caractere)", () => {
    const inteiro = ler(TURNO);
    expect(ler(...TURNO.split(""))).toEqual(inteiro);
    // E cortes no meio do nome do campo, do JSON e da linha em branco.
    expect(ler(TURNO.slice(0, 9), TURNO.slice(9, 23), TURNO.slice(23, 31), TURNO.slice(31))).toEqual(inteiro);
  });

  it("aceita CRLF, inclusive com o \\r e o \\n em pedaços diferentes", () => {
    const crlf = TURNO.replace(/\n/g, "\r\n");
    expect(ler(crlf)).toEqual(ler(TURNO));
    const corte = crlf.indexOf("\r\n") + 1; // termina exatamente no \r
    expect(crlf[corte - 1]).toBe("\r");
    expect(ler(crlf.slice(0, corte), crlf.slice(corte))).toEqual(ler(TURNO));
  });

  it("aceita \\r sozinho como fim de linha", () => {
    expect(ler(TURNO.replace(/\n/g, "\r"))).toEqual(ler(TURNO));
  });

  it("várias linhas `data:` viram uma, juntas por \\n; e o espaço depois dos dois-pontos é opcional", () => {
    expect(ler("event:delta\ndata:linha 1\ndata: linha 2\n\n")).toEqual([
      { evento: "delta", dados: "linha 1\nlinha 2" },
    ]);
  });

  it("evento SEM `data:` é despachado com dados vazios (o `fim` não pode se perder)", () => {
    expect(ler("event: fim\n\n")).toEqual([{ evento: "fim", dados: "" }]);
  });

  it("`erro` depois de deltas chega na ordem, como o último frame", () => {
    const frames = ler(
      'event: delta\ndata: {"texto":"Começo "}\n\n',
      'event: delta\ndata: {"texto":"da resposta"}\n\n',
      'event: erro\ndata: {"codigo":"TEMPO_ESGOTADO","mensagem":"Demorou."}\n\n',
    );
    expect(frames.map((f) => f.evento)).toEqual(["delta", "delta", "erro"]);
    expect(JSON.parse(frames[2]!.dados)).toEqual({ codigo: "TEMPO_ESGOTADO", mensagem: "Demorou." });
  });

  it("o stream que acaba sem a linha em branco final ainda entrega o último frame", () => {
    expect(ler('event: delta\ndata: {"texto":"fim cortado"}')).toEqual([
      { evento: "delta", dados: '{"texto":"fim cortado"}' },
    ]);
  });

  it("descarta o BOM do começo do stream e ignora `id:`/`retry:`", () => {
    expect(ler("﻿id: 7\nretry: 1000\nevent: fim\ndata: {}\n\n")).toEqual([{ evento: "fim", dados: "{}" }]);
  });

  it("linha em branco sozinha (sem campo nenhum) não produz frame", () => {
    expect(ler("\n\n\n: ping\n\n")).toEqual([]);
  });
});

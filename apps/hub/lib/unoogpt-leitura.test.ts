import { describe, expect, test } from "vitest";

import { envioEmTexto, envioNoCartao } from "./unoogpt-leitura";

/**
 * O que este teste segura é uma coisa só: **frase voltar para dentro de um
 * `MetricCard`**.
 *
 * O cartão do DS é de KPI. `.unooria-metric-card__value` é `white-space: nowrap`
 * a `clamp(26px, 4vw, 36px)` dentro de um cartão de `height: 128px` e
 * `max-width: 301px` — 267px úteis, medidos na tela. Valor maior VAZA por fora
 * do cartão, por cima do que está ao lado, e nada acusa: não é erro de CSS nem
 * de tipo, é o componente usado para o que ele não é.
 *
 * Foi assim que "Ao confirmar" mostrou `estourou — a chuva chegou` (496px)
 * derramado sobre a página. A saída foi separar as duas leituras, e é essa
 * separação que aqui se defende — o `envioEmTexto` continua podendo crescer,
 * porque o lugar dele é texto corrido.
 *
 * O limite é em PIXEL, não em caractere, então o teste não conta letras: ele
 * prende a lista fechada dos rótulos já medidos. Rótulo novo obriga a medir de
 * novo, que é justamente o passo que se pula. A receita da medida está no
 * `AGENTS.md` do hub.
 */
const JA_MEDIDOS: Record<string, number> = {
  esgotado: 164,
  "sem relógio": 208,
};

describe("envioNoCartao — o que cabe num MetricCard", () => {
  test("o relógio fechado vira rótulo curto, não frase", () => {
    const valor = envioNoCartao({
      em: "2026-09-15T20:00:00.000Z",
      minuto: 42,
      segundosRestantes: null,
      motivoDoFim: "tempo",
      estourou: true,
    });
    expect(valor).toBe("esgotado");
    expect(JA_MEDIDOS[valor]).toBeLessThan(267);
  });

  test("o modo livre não carrega a explicação junto", () => {
    const valor = envioNoCartao({
      em: "2026-09-15T20:00:00.000Z",
      minuto: 42,
      segundosRestantes: null,
      motivoDoFim: null,
      estourou: false,
    });
    expect(valor).toBe("sem relógio");
    expect(JA_MEDIDOS[valor]).toBeLessThan(267);
  });

  test("o tempo restante é só o cronômetro — sem o 'faltavam'", () => {
    expect(
      envioNoCartao({
        em: "2026-09-15T20:00:00.000Z",
        minuto: 42,
        segundosRestantes: 100,
        motivoDoFim: null,
        estourou: false,
      }),
    ).toBe("1:40");
  });

  test("nenhum rótulo do cartão é uma frase", () => {
    for (const estourou of [true, false]) {
      for (const segundosRestantes of [null, 0, 100, 3599]) {
        for (const motivoDoFim of ["tempo", "professor", null] as const) {
          const valor = envioNoCartao({
            em: "2026-09-15T20:00:00.000Z",
            minuto: 42,
            segundosRestantes,
            motivoDoFim,
            estourou,
          });
          /* Travessão e parêntese são o rastro de explicação enfiada no valor —
             foi exatamente assim que a frase chegou lá. */
          expect(valor).not.toMatch(/[—(]/);
          expect(valor in JA_MEDIDOS || /^\d+:\d{2}$/.test(valor)).toBe(true);
        }
      }
    }
  });
});

describe("envioEmTexto — o texto corrido, que pode crescer", () => {
  test("diz POR QUE o tempo acabou, que é o que não cabe no cartão", () => {
    const base = { em: "2026-09-15T20:00:00.000Z", minuto: 42, segundosRestantes: null };
    expect(envioEmTexto({ ...base, motivoDoFim: "tempo", estourou: true })).toBe(
      "tempo esgotado — a chuva chegou",
    );
    expect(envioEmTexto({ ...base, motivoDoFim: "professor", estourou: true })).toBe(
      "tempo esgotado — o professor encerrou",
    );
  });

  test("sem estouro, continua dizendo o relógio por extenso", () => {
    const base = { em: "2026-09-15T20:00:00.000Z", minuto: 42, motivoDoFim: null, estourou: false };
    expect(envioEmTexto({ ...base, segundosRestantes: 100 })).toBe("faltavam 1:40");
    expect(envioEmTexto({ ...base, segundosRestantes: null })).toBe("sem cronômetro (modo livre)");
  });
});

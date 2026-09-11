import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  FUSO_DA_PLATAFORMA,
  data,
  dataCurta,
  dataCurtaHora,
  dataHora,
  diaDaPlataforma,
  hora,
  horaComSegundos,
} from "./fuso";

/**
 * O instante que expõe o defeito: **22h de Brasília**, que já é o dia seguinte
 * em UTC. É a janela das 21h à meia-noite — a única em que servidor e navegador
 * discordam, e por isso a única em que alguém percebe.
 */
const NOITE_DE_BRASILIA = "2026-09-11T01:30:00.000Z"; // 10/09 22:30 em São Paulo

describe("o fuso da plataforma", () => {
  test("é uma constante, e é ela que a ADR-98 manda mudar", () => {
    expect(FUSO_DA_PLATAFORMA).toBe("America/Sao_Paulo");
  });

  /**
   * A REGRESSÃO, e o motivo deste arquivo existir.
   *
   * O processo roda em UTC aqui dentro — como o container do Cloud Run. Se as
   * funções lessem o fuso do ambiente, este bloco devolveria `11/09` e a tela
   * da professora, `10/09`. O React chamaria isso de "hydration failed",
   * regeneraria a árvore e engoliria o clique dela.
   */
  describe("com o processo em UTC, como o container", () => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "UTC";
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    test("uma data da noite de Brasília NÃO vira o dia seguinte", () => {
      expect(data(NOITE_DE_BRASILIA)).toBe("10/09/2026");
      expect(dataCurta(NOITE_DE_BRASILIA)).toBe("10/09");
      expect(diaDaPlataforma(NOITE_DE_BRASILIA)).toBe("2026-09-10");
    });

    test("e a hora é a do relógio da escola, não a do servidor", () => {
      expect(hora(NOITE_DE_BRASILIA)).toBe("22:30");
      expect(dataHora(NOITE_DE_BRASILIA)).toBe("10/09/2026, 22:30");
      expect(dataCurtaHora(NOITE_DE_BRASILIA)).toBe("10/09, 22:30");
    });
  });

  /**
   * O outro lado do mesmo teste: o navegador da professora. Os dois blocos
   * afirmam o MESMO texto de propósito — é essa igualdade que impede a
   * hidratação de quebrar, e ela é o produto desta correção.
   */
  describe("com o processo em America/Sao_Paulo, como o navegador dela", () => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "America/Sao_Paulo";
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    test("devolve exatamente o mesmo texto que devolveu em UTC", () => {
      expect(data(NOITE_DE_BRASILIA)).toBe("10/09/2026");
      expect(dataCurta(NOITE_DE_BRASILIA)).toBe("10/09");
      expect(dataHora(NOITE_DE_BRASILIA)).toBe("10/09/2026, 22:30");
      expect(diaDaPlataforma(NOITE_DE_BRASILIA)).toBe("2026-09-10");
    });
  });

  /**
   * Um fuso MAIS a oeste que o da plataforma. Serve de lembrete escrito do que
   * a ADR-98 assume: a plataforma mostra a hora de Brasília para todo mundo, e
   * para uma rede em Rio Branco (UTC-5) isso está errado em 2 horas. O teste
   * fixa o comportamento atual; o gatilho de reavaliação é a primeira rede de
   * fora.
   */
  test("um relógio no Acre vê a hora de Brasília — é a decisão, não um bug", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Rio_Branco";
    try {
      expect(hora(NOITE_DE_BRASILIA)).toBe("22:30");
    } finally {
      process.env.TZ = original;
    }
  });

  test("segundos só onde a ordem dentro do minuto importa", () => {
    expect(horaComSegundos("2026-09-11T01:30:07.000Z")).toBe("22:30:07");
  });

  describe("o que não é data vira travessão, nunca 'Invalid Date'", () => {
    test.each([
      ["nulo", null],
      ["ausente", undefined],
      ["texto que não é data", "ontem à tarde"],
      ["vazio", ""],
    ])("%s", (_rotulo, entrada) => {
      expect(data(entrada as string | null | undefined)).toBe("—");
      expect(dataHora(entrada as string | null | undefined)).toBe("—");
      expect(hora(entrada as string | null | undefined)).toBe("—");
    });
  });

  test("aceita `Date` além de string — a api devolve ISO, o código local não", () => {
    expect(data(new Date(NOITE_DE_BRASILIA))).toBe("10/09/2026");
  });
});

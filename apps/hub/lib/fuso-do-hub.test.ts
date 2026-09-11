import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  ENV_DO_FUSO,
  FUSO_PADRAO,
  META_DO_FUSO,
  dataHora,
  esquecerFusoDaPlataforma,
} from "@edu/sdk";

import { metadadosDoFuso } from "./fuso-do-hub";

/** 22h30 em São Paulo, 01h30 do dia seguinte em UTC — a janela do defeito. */
const NOITE_DE_BRASILIA = "2026-09-11T01:30:00.000Z";

function comFuso(valor: string | undefined): void {
  if (valor === undefined) delete process.env[ENV_DO_FUSO];
  else process.env[ENV_DO_FUSO] = valor;
  // O módulo memoriza o fuso resolvido; sem isto o primeiro caso decide o resto.
  esquecerFusoDaPlataforma();
}

const original = process.env[ENV_DO_FUSO];
beforeEach(() => comFuso(undefined));
afterEach(() => comFuso(original));

describe("o hub entrega o fuso ao navegador (ADR-99)", () => {
  /**
   * **A prova de que é configurável, do lado do hub.** O servidor lê a env e o
   * navegador lê este `<meta>`: se o valor não descesse, a professora veria a
   * hora de Brasília numa rede do Acre e nada acusaria.
   */
  test.each(["America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "UTC"])(
    "com %s na env, o <meta> do layout raiz carrega esse valor",
    (fuso) => {
      comFuso(fuso);
      expect(metadadosDoFuso()).toEqual({ [META_DO_FUSO]: fuso });
    },
  );

  test("sem a env, o <meta> sai com o padrão — nada quebra por falta dela", () => {
    expect(metadadosDoFuso()).toEqual({ [META_DO_FUSO]: FUSO_PADRAO });
  });

  test("o nome do <meta> é o que o SDK procura no navegador", () => {
    expect(Object.keys(metadadosDoFuso())).toEqual([META_DO_FUSO]);
    expect(META_DO_FUSO).toBe("unooria-fuso");
  });

  /**
   * O outro lado da mesma env: o texto que uma tela do hub renderiza NO
   * SERVIDOR. Os dois têm de andar juntos — é a igualdade entre eles que
   * impede a hidratação de quebrar (ADR-98).
   */
  test.each([
    ["America/Sao_Paulo", "10/09/2026, 22:30"],
    ["America/Rio_Branco", "10/09/2026, 20:30"],
    ["UTC", "11/09/2026, 01:30"],
  ])("com %s, a tela renderiza %s — e o <meta> diz o mesmo fuso", (fuso, esperado) => {
    comFuso(fuso);
    expect(dataHora(NOITE_DE_BRASILIA)).toBe(esperado);
    expect(metadadosDoFuso()[META_DO_FUSO]).toBe(fuso);
  });

  test("um typo na env não derruba a tela: cai no padrão", () => {
    comFuso("America/SaoPaulo");
    expect(metadadosDoFuso()).toEqual({ [META_DO_FUSO]: FUSO_PADRAO });
    expect(dataHora(NOITE_DE_BRASILIA)).toBe("10/09/2026, 22:30");
  });
});

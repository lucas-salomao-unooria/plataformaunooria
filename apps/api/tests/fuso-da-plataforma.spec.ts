import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ENV_DO_FUSO,
  FUSO_PADRAO,
  diaDaPlataforma,
  fusoDaPlataforma,
  fusoEhValido,
} from "../src/comum/fuso";
import { fusoDaPlataforma as FUSO_DO_BEMESTAR } from "../src/bemestar/catalogo";
import { diaDe } from "../src/bemestar/regras";
import { validarEnv } from "../src/config/env";

/**
 * O que este arquivo segura é **a cópia entre a api e o SDK**.
 *
 * `apps/api/src/comum/fuso.ts` e `packages/sdk/src/fuso.ts` declaram o mesmo
 * padrão e leem a mesma variável de ambiente, porque a api não consome pacote
 * de workspace (`packages/AGENTS.md`). A cópia da copy da exp-01 é guardada por
 * um comentário e nada mais; esta é guardada por este teste — a diferença
 * importa, porque divergir aqui devolve exatamente o defeito que a ADR-98
 * fechou, só que entre api e hub.
 *
 * Desde a ADR-99 há uma segunda coisa a amarrar, e ela é pior de errar: **o
 * NOME da variável**. Com nomes diferentes, configurar a plataforma acertaria
 * uma superfície e deixaria a outra no padrão — e o sintoma seria a api e o hub
 * discordando do dia, que é o defeito original de volta.
 */
const FUSO_NO_SDK = join(__dirname, "../../../packages/sdk/src/fuso.ts");

/** Um ambiente mínimo que o `EnvSchema` aceita, para exercer só o fuso. */
const ENV_MINIMA = {
  DATABASE_URL: "postgresql://postgres:pass@localhost:5432/unooria",
  OIDC_ISSUER: "http://localhost:3000",
  OIDC_JWKS_URI: "http://localhost:3000/.well-known/jwks.json",
  AI_PROVIDER: "mock",
};

describe("o fuso da plataforma", () => {
  const original = process.env[ENV_DO_FUSO];
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_DO_FUSO];
    else process.env[ENV_DO_FUSO] = original;
  });

  describe("as duas cópias são amarradas, não confiadas", () => {
    const fonte = readFileSync(FUSO_NO_SDK, "utf8");

    it("o PADRÃO é o mesmo no SDK e na api", () => {
      const declarado = /export const FUSO_PADRAO = "([^"]+)"/.exec(fonte)?.[1];
      expect(declarado).toBeDefined();
      expect(FUSO_PADRAO).toBe(declarado);
    });

    it("o NOME DA VARIÁVEL é o mesmo — nomes diferentes configuram meia plataforma", () => {
      const declarado = /export const ENV_DO_FUSO = "([^"]+)"/.exec(fonte)?.[1];
      expect(declarado).toBeDefined();
      expect(ENV_DO_FUSO).toBe(declarado);
    });

    it("o bem-estar reexporta, não redeclara", () => {
      expect(FUSO_DO_BEMESTAR).toBe(fusoDaPlataforma);
    });
  });

  describe("é CONFIGURÁVEL, e a prova é o dia mudar (ADR-99)", () => {
    /**
     * O "dia" não é texto de tela: é a chave com que o check-in de bem-estar
     * decide "você já respondeu hoje". Se configurar o fuso não mexesse nele, a
     * rede no Acre gravaria o dia de Brasília — e a criança que responde às 21h
     * do Acre (meia-noite em Brasília) seria recusada no dia seguinte.
     */
    it.each([
      ["America/Sao_Paulo", "2026-09-10"],
      ["America/Manaus", "2026-09-10"],
      ["America/Rio_Branco", "2026-09-10"],
      ["UTC", "2026-09-11"], // o fuso do contêiner: outro dia
      ["Asia/Tokyo", "2026-09-11"],
    ])("com %s, 22h30 de Brasília cai no dia %s", (fuso, esperado) => {
      process.env[ENV_DO_FUSO] = fuso;
      const noiteDeBrasilia = new Date("2026-09-11T01:30:00.000Z");

      expect(fusoDaPlataforma()).toBe(fuso);
      expect(diaDaPlataforma(noiteDeBrasilia)).toBe(esperado);
      expect(diaDe(noiteDeBrasilia)).toBe(esperado);
    });

    it("ausente = o padrão; nada quebra por falta da variável", () => {
      delete process.env[ENV_DO_FUSO];
      expect(fusoDaPlataforma()).toBe(FUSO_PADRAO);
    });

    it("vazia conta como ausente — env em branco no compose é o caso comum", () => {
      process.env[ENV_DO_FUSO] = "";
      expect(fusoDaPlataforma()).toBe(FUSO_PADRAO);
    });
  });

  describe("o BOOT barra o typo, que é o ponto de validar aqui", () => {
    /**
     * Um `America/SaoPaulo` não tem sintoma nenhum até alguém renderizar uma
     * data, dias depois do deploy — e aí sai uma exceção do `Intl` no meio de
     * uma requisição. Na subida ele é barato.
     */
    it("recusa um fuso que o Intl não conhece, e diz qual variável é", () => {
      expect(() => validarEnv({ ...ENV_MINIMA, [ENV_DO_FUSO]: "America/SaoPaulo" })).toThrow(
        new RegExp(ENV_DO_FUSO),
      );
    });

    it("aceita os fusos do Brasil que uma rede pode ter", () => {
      for (const fuso of [
        "America/Sao_Paulo",
        "America/Manaus",
        "America/Rio_Branco",
        "America/Belem",
        "America/Noronha",
      ]) {
        expect(validarEnv({ ...ENV_MINIMA, [ENV_DO_FUSO]: fuso })[ENV_DO_FUSO]).toBe(fuso);
      }
    });

    it("ausente vira o padrão, não erro", () => {
      const semFuso = { ...ENV_MINIMA };
      expect(validarEnv(semFuso)[ENV_DO_FUSO]).toBe(FUSO_PADRAO);
    });

    /**
     * A api falha ALTO; o hub e as experiências caem no padrão com aviso no
     * console. A assimetria é decisão da ADR-99: derrubar a subida de um
     * processo é barato, derrubar a tela de uma rede inteira não é.
     */
    it("o valor inválido que o boot barra também não explode em runtime", () => {
      process.env[ENV_DO_FUSO] = "America/SaoPaulo";
      expect(fusoDaPlataforma()).toBe(FUSO_PADRAO);
      expect(() => diaDaPlataforma(new Date("2026-09-11T01:30:00.000Z"))).not.toThrow();
    });
  });

  describe("a regressão da ADR-98: o fuso de QUEM EXECUTA não decide nada", () => {
    /**
     * 22h30 de Brasília já é o dia seguinte em UTC. Com o processo do Cloud Run
     * em UTC e sem fuso explícito, o check-in da noite gravaria o dia de amanhã
     * — e o de amanhã seria recusado com "você já respondeu hoje".
     */
    it("22h30 de Brasília é o dia 10, não o 11, mesmo com o processo em UTC", () => {
      const originalTz = process.env.TZ;
      process.env.TZ = "UTC";
      delete process.env[ENV_DO_FUSO];
      try {
        const noiteDeBrasilia = new Date("2026-09-11T01:30:00.000Z");
        expect(diaDaPlataforma(noiteDeBrasilia)).toBe("2026-09-10");
        expect(diaDe(noiteDeBrasilia)).toBe("2026-09-10");
      } finally {
        process.env.TZ = originalTz;
      }
    });
  });

  describe("o que `fusoEhValido` aceita", () => {
    it.each([
      ["America/Sao_Paulo", true],
      ["UTC", true],
      // Alias legado: o `Intl` aceita e `Intl.supportedValuesOf` não lista —
      // é por isso que a validação constrói o formatador em vez de olhar a lista.
      ["Brazil/East", true],
      // Offset FIXO passa, e é armadilha declarada: congela o deslocamento.
      ["-03:00", true],
      ["America/SaoPaulo", false],
      ["", false],
      ["Marte/Olympus", false],
    ])("%s → %s", (fuso, esperado) => {
      expect(fusoEhValido(fuso)).toBe(esperado);
    });
  });
});

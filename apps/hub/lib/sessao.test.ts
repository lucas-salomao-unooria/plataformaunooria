import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SESSAO_TTL_SEGUNDOS, TTL_DE_PRODUCAO_SEGUNDOS, ttlDoAmbiente } from "./sessao";

describe("TTL da sessão", () => {
  it("é de 2 horas em produção", () => {
    expect(TTL_DE_PRODUCAO_SEGUNDOS).toBe(60 * 60 * 2);
  });

  it("usa o padrão quando a env não existe", () => {
    expect(ttlDoAmbiente({})).toBe(TTL_DE_PRODUCAO_SEGUNDOS);
    expect(SESSAO_TTL_SEGUNDOS).toBeGreaterThanOrEqual(60);
  });

  it("aceita a env FORA de produção — é o que a suíte usa para não esperar 2h", () => {
    expect(ttlDoAmbiente({ SESSAO_TTL_SEGUNDOS: "120" })).toBe(120);
  });

  it("IGNORA a env em produção, porque /privacidade afirma o prazo à família", () => {
    expect(ttlDoAmbiente({ SESSAO_TTL_SEGUNDOS: "120", NODE_ENV: "production" })).toBe(
      TTL_DE_PRODUCAO_SEGUNDOS,
    );
  });

  it("recusa valor inválido, fora de faixa ou não numérico, caindo no padrão", () => {
    for (const bruto of ["0", "30", "abc", "-1", String(60 * 60 * 13), ""]) {
      expect(ttlDoAmbiente({ SESSAO_TTL_SEGUNDOS: bruto })).toBe(TTL_DE_PRODUCAO_SEGUNDOS);
    }
  });
});

/**
 * O acoplamento que a ADR-96 assume: `/privacidade` diz o prazo em TEXTO para a
 * família, e texto legal só pode afirmar o que o código faz (ADR-70). Nada no
 * typecheck liga os dois, então liga este teste — mudar o TTL de produção sem
 * mudar a frase passa a ser vermelho, e não uma página mentindo em silêncio.
 */
describe("a frase de /privacidade e o TTL não divergem", () => {
  it("a página afirma as MESMAS horas que o código aplica", () => {
    const pagina = readFileSync(new URL("../app/privacidade/page.tsx", import.meta.url), "utf8");
    const horas = TTL_DE_PRODUCAO_SEGUNDOS / 3600;
    expect(horas).toBe(Math.trunc(horas));
    expect(pagina).toContain(`${horas} horas sem uso`);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ANOS, ETAPAS, UNIDADES_POR_ANO, buscarMissao } from "./catalogo";

describe("grade do Entre Redes", () => {
  test("cobre a Educação Básica inteira: 9 anos do EF + 3 séries do EM", () => {
    expect(ANOS.map((ano) => ano.slug)).toEqual([
      "1-ano", "2-ano", "3-ano", "4-ano", "5-ano", "6-ano", "7-ano", "8-ano", "9-ano",
      "1-serie", "2-serie", "3-serie",
    ]);
    expect(ETAPAS.map((etapa) => etapa.anos.length)).toEqual([5, 4, 3]);
  });

  test("todo ano tem as 4 unidades, publicadas ou não", () => {
    for (const ano of ANOS) {
      expect(ano.missoes).toHaveLength(UNIDADES_POR_ANO);
      expect(ano.missoes.map((m) => m.unidade)).toEqual([1, 2, 3, 4]);
    }
  });

  test("as missões publicadas continuam no lugar delas", () => {
    expect(buscarMissao("1-ano", "unidade-1")?.missao.expId).toBe("exp01ef1b");
    expect(buscarMissao("4-ano", "unidade-1")?.missao.expId).toBe("exp04ef1b");
    expect(buscarMissao("5-ano", "unidade-1")?.missao.expId).toBe("exp05ef1b");
    expect(buscarMissao("6-ano", "unidade-1")?.missao.expId).toBe("exp06ef1b");
    expect(buscarMissao("6-ano", "unidade-2")?.missao.expId).toBe("exp06ef2b");
    expect(buscarMissao("8-ano", "unidade-1")?.missao.expId).toBe("exp08ef1b");
    expect(buscarMissao("1-serie", "unidade-1")?.missao.expId).toBe("exp01em1b");
    expect(buscarMissao("2-serie", "unidade-1")?.missao.expId).toBe("exp02em1b");
    expect(buscarMissao("3-serie", "unidade-1")?.missao.expId).toBe("exp03em1b");
  });

  /* O UnooTube foi arquivado (ADR-116) e o Jornal da Escola tomou o código e a
     unidade dele. O registro da ficha antiga continua no catálogo — e não pode
     voltar à grade por engano, com o mesmo lugar da missão nova. */
  test("a unidade 1 do 4º ano é o Jornal da Escola, e o UnooTube arquivado não volta à grade", () => {
    const quartoAno = buscarMissao("4-ano", "unidade-1")?.missao;
    expect(quartoAno?.status).toBe("disponivel");
    expect(quartoAno?.titulo).toBe("Jornal da Escola: A Edição de Bento");
    expect(ANOS.flatMap((ano) => ano.missoes).some((m) => m.expId === "backup-exp04ef1b")).toBe(false);
  });

  /* A ficha do Júri cita as habilidades da ficha 5 (ADR-174): a EF06CO01 é o
     foco, com a EF06CO03 — e a EF06CO10 e a EF06CO07 saíram. O texto é o
     OFICIAL, lido da fonte única do currículo. E o que a galeria e a lousa
     contam (por área, a concentração) são números REAIS de cada sessão:
     nenhum percentual cravado. */
  test("o Júri Estadual cita EF06CO01 e EF06CO03 com o texto oficial, e nenhum percentual cravado", () => {
    const juri = buscarMissao("6-ano", "unidade-1")?.missao;
    expect(juri?.titulo).toBe("O Júri Estadual de Projetos");
    const competencia = juri?.ficha?.competencia ?? "";
    const curriculo = readFileSync(join(__dirname, "../../../api/src/curriculo/dados/habilidades-computacao.ts"), "utf8");
    for (const codigo of ["EF06CO01", "EF06CO03"]) {
      expect(competencia).toContain(codigo);
      const oficial = new RegExp(`"codigo": "${codigo}",\\s*"descricao": "([^"]+)"`).exec(curriculo)?.[1] ?? "";
      expect(oficial, codigo).not.toBe("");
      /* O ponto final do documento fica de fora: a frase continua no catálogo. */
      expect(competencia.toLowerCase()).toContain(oficial.replace(/\.$/, "").toLowerCase());
    }
    expect(competencia.indexOf("EF06CO01")).toBeLessThan(competencia.indexOf("EF06CO03"));
    const texto = JSON.stringify(juri);
    expect(texto).not.toContain("EF06CO07");
    expect(texto).not.toContain("EF06CO10");
    expect(texto).not.toMatch(/\d+\s?%/);
  });
});

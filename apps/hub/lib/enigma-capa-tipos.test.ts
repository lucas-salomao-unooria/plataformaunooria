import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CHAVES_DE_CENA,
  CHAVES_PRONTAS,
  CRACHAS,
  DISCIPLINAS,
  ELEMENTOS_DA_SEGUNDA_FOTO,
  FAIXA_COMUM,
  FASES,
  FOTOS,
  INVARIANTES,
  MOTIVOS_DO_PAR,
  ORIGENS,
  PASSOS,
  RAIO_PADRAO,
  SELOS,
  VOTOS,
  alvoNaFaixaComum,
  mudouAEvidencia,
  palavrasDoTexto,
  pontoNaPanoramica,
  problemasDoRecorte,
  urlDaImagem,
  type PainelDaTurma,
} from "./enigma-capa-tipos";

/**
 * O espelho do hub contra a api (lida como TEXTO: o hub não importa a api).
 * Uma lista de valores a mais é a que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/enigma-capa");
const conteudo = readFileSync(join(API, "conteudo.ts"), "utf8");
const passos = readFileSync(join(API, "regras/passos.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome} = \\[([^\\]]+)\\] as const`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["DISCIPLINAS", DISCIPLINAS, conteudo],
    ["ORIGENS", ORIGENS, conteudo],
    ["CHAVES_DE_CENA", CHAVES_DE_CENA, conteudo],
    ["CHAVES_PRONTAS", CHAVES_PRONTAS, conteudo],
    ["FASES", FASES, conteudo],
    ["CRACHAS", CRACHAS, conteudo],
    ["FOTOS", FOTOS, conteudo],
    ["SELOS", SELOS, conteudo],
    ["INVARIANTES", INVARIANTES, conteudo],
    ["MOTIVOS_DO_PAR", MOTIVOS_DO_PAR, conteudo],
    ["ELEMENTOS_DA_SEGUNDA_FOTO", ELEMENTOS_DA_SEGUNDA_FOTO, conteudo],
    ["VOTOS", VOTOS, conteudo],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });

  test("PASSOS", () => {
    const m = /export const PASSOS = \[([\s\S]+?)\] as const/.exec(passos);
    expect(m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null).toEqual([...PASSOS]);
  });

  test("a faixa comum e o raio padrão são os da api", () => {
    expect(conteudo).toContain(`FAIXA_COMUM = { de: ${FAIXA_COMUM.de}, ate: ${FAIXA_COMUM.ate} }`);
    expect(conteudo).toContain(`RAIO_PADRAO = ${RAIO_PADRAO};`);
  });
});

describe("a curadoria", () => {
  test("o toque vira coordenada 0–100 da panorâmica, saturada na borda", () => {
    const caixa = { left: 100, top: 50, width: 800, height: 450 };
    expect(pontoNaPanoramica({ x: 500, y: 275 }, caixa)).toEqual({ x: 50, y: 50 });
    expect(pontoNaPanoramica({ x: 100, y: 50 }, caixa)).toEqual({ x: 0, y: 0 });
    expect(pontoNaPanoramica({ x: 2000, y: -10 }, caixa)).toEqual({ x: 100, y: 0 });
  });

  test("o alvo só vale na faixa que aparece nas duas fotos", () => {
    expect(alvoNaFaixaComum(50)).toBe(true);
    expect(alvoNaFaixaComum(36)).toBe(false);
    expect(alvoNaFaixaComum(64)).toBe(false);
  });

  test("imagem do bundle precisa da base; a da IA vai como veio", () => {
    expect(urlDaImagem({ tipo: "bundle", nome: "cenas/horta.webp" }, "http://localhost:5187/")).toBe("http://localhost:5187/cenas/horta.webp");
    expect(urlDaImagem({ tipo: "bundle", nome: "cenas/horta.webp" }, null)).toBeNull();
    expect(urlDaImagem({ tipo: "url", url: "https://cdn/x.webp" }, null)).toBe("https://cdn/x.webp");
  });

  test("o recorte segue o Zod da api", () => {
    expect(palavrasDoTexto("horta, plantas\n adubo ,")).toEqual(["horta", "plantas", "adubo"]);
    expect(problemasDoRecorte({ disciplina: "ciencias", tema: "A horta", palavras: ["horta", "plantas", "adubo"], nota: "" })).toEqual([]);
    expect(problemasDoRecorte({ disciplina: "", tema: "x", palavras: ["a"], nota: "" })).toHaveLength(4);
  });
});

test("a evidência muda nos invariantes completos e no voto, não no resto", () => {
  const linha = {
    estudanteId: "e1",
    nome: "Ana",
    equipe: null,
    passo: "feed",
    aguardandoVirada: true,
    cracha: "fone-azul",
    lupa: null,
    capa: null,
    invariantes: null,
    fora: null,
    par: null,
    segundaFoto: null,
    voto: null,
  } as const;
  const base = { linhas: [linha] } as unknown as PainelDaTurma;
  const andou = { linhas: [{ ...linha, passo: "invariantes" }] } as unknown as PainelDaTurma;
  const achou = { linhas: [{ ...linha, invariantes: { encontrados: 4, erros: 0, ajuda: false, errosPosAjuda: 0, completo: true } }] } as unknown as PainelDaTurma;
  const votou = { linhas: [{ ...linha, voto: "so-um-pedaco" }] } as unknown as PainelDaTurma;
  expect(mudouAEvidencia(base, andou)).toBe(false);
  expect(mudouAEvidencia(base, achou)).toBe(true);
  expect(mudouAEvidencia(base, votou)).toBe(true);
});

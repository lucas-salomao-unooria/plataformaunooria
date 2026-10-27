import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CHAVES_DE_CENA,
  CHAVES_PRONTAS,
  ELEMENTOS_DA_SEGUNDA_FOTO,
  FAIXA_COMUM,
  FASES,
  FOTOS,
  INVARIANTES,
  MOTIVOS_DO_PAR,
  ORIGENS,
  AREA_DO_ALVO,
  PASSOS,
  PEDIDO_DA_IMAGEM,
  ROTULO_DA_DISCIPLINA,
  SELOS,
  areaDoArraste,
  areaDoToque,
  areasSeSobrepoem,
  ehArraste,
  problemasDaArea,
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
const componentes = readFileSync(join(__dirname, "../../api/src/curriculo/componentes.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome} = \\[([^\\]]+)\\] as const`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["ORIGENS", ORIGENS, conteudo],
    ["CHAVES_DE_CENA", CHAVES_DE_CENA, conteudo],
    ["CHAVES_PRONTAS", CHAVES_PRONTAS, conteudo],
    ["FASES", FASES, conteudo],
    ["FOTOS", FOTOS, conteudo],
    ["SELOS", SELOS, conteudo],
    ["INVARIANTES", INVARIANTES, conteudo],
    ["MOTIVOS_DO_PAR", MOTIVOS_DO_PAR, conteudo],
    ["ELEMENTOS_DA_SEGUNDA_FOTO", ELEMENTOS_DA_SEGUNDA_FOTO, conteudo],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });

  test("PASSOS", () => {
    const m = /export const PASSOS = \[([\s\S]+?)\] as const/.exec(passos);
    expect(m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null).toEqual([...PASSOS]);
  });

  test("o rótulo do componente cobre o DISCIPLINAS da api, com o rótulo do catálogo de componentes", () => {
    expect(Object.keys(ROTULO_DA_DISCIPLINA)).toEqual(lista(conteudo, "DISCIPLINAS"));
    for (const [slug, rotulo] of Object.entries(ROTULO_DA_DISCIPLINA)) {
      if (slug === "outra") continue;
      expect(componentes).toMatch(new RegExp(`slug: "${slug}",\\s*rotulo: "${rotulo}"`));
    }
  });

  test("a faixa comum, os limites da área e o tamanho do pedido são os da api", () => {
    expect(conteudo).toContain(`FAIXA_COMUM = { de: ${FAIXA_COMUM.de}, ate: ${FAIXA_COMUM.ate} }`);
    expect(conteudo).toContain(
      `AREA_DO_ALVO = { minW: ${AREA_DO_ALVO.minW}, minH: ${AREA_DO_ALVO.minH}, maxW: ${AREA_DO_ALVO.maxW}, maxH: ${AREA_DO_ALVO.maxH} }`,
    );
    expect(conteudo).toContain(`PEDIDO_DA_IMAGEM = { min: ${PEDIDO_DA_IMAGEM.min}, max: ${PEDIDO_DA_IMAGEM.max} }`);
  });
});

describe("a curadoria", () => {
  test("o toque vira coordenada 0–100 da panorâmica, saturada na borda", () => {
    const caixa = { left: 100, top: 50, width: 800, height: 450 };
    expect(pontoNaPanoramica({ x: 500, y: 275 }, caixa)).toEqual({ x: 50, y: 50 });
    expect(pontoNaPanoramica({ x: 100, y: 50 }, caixa)).toEqual({ x: 0, y: 0 });
    expect(pontoNaPanoramica({ x: 2000, y: -10 }, caixa)).toEqual({ x: 100, y: 0 });
  });

  test("a área do arraste: em qualquer direção, PRESA à faixa que aparece nas duas fotos", () => {
    expect(areaDoArraste({ x: 40, y: 20 }, { x: 50, y: 50 })).toEqual({ x: 40, y: 20, w: 10, h: 30 });
    expect(areaDoArraste({ x: 50, y: 50 }, { x: 40, y: 20 })).toEqual({ x: 40, y: 20, w: 10, h: 30 });
    /* Arrastou para fora da faixa: a caixa para na borda dela. */
    expect(areaDoArraste({ x: 20, y: 20 }, { x: 80, y: 40 })).toEqual({ x: 32, y: 20, w: 36, h: 20 });
  });

  test("um clique vira uma caixa média centrada nele, dentro da faixa", () => {
    expect(ehArraste({ x: 40, y: 20, w: 0.5, h: 1 })).toBe(false);
    expect(ehArraste({ x: 40, y: 20, w: 10, h: 1 })).toBe(true);
    expect(areaDoToque({ x: 50, y: 40 })).toEqual({ x: 45, y: 31, w: 10, h: 18 });
    expect(areaDoToque({ x: 33, y: 2 })).toEqual({ x: 32, y: 0, w: 10, h: 18 });
  });

  test("o aviso da área: pequena, grande e sobreposta (a api decide; isto avisa)", () => {
    expect(problemasDaArea("RELÓGIO", { x: 40, y: 20, w: 10, h: 18 })).toEqual([]);
    expect(problemasDaArea("RELÓGIO", { x: 40, y: 20, w: 2, h: 18 })[0]).toMatch(/pequena demais/);
    expect(problemasDaArea("RELÓGIO", { x: 32, y: 0, w: 36, h: 18 })[0]).toMatch(/grande demais/);
    expect(areasSeSobrepoem({ x: 35, y: 20, w: 10, h: 20 }, { x: 44, y: 20, w: 10, h: 20 })).toBe(true);
    expect(areasSeSobrepoem({ x: 35, y: 20, w: 10, h: 20 }, { x: 45, y: 20, w: 10, h: 20 })).toBe(false);
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

test("a evidência muda nos invariantes completos e no \"Pronto\" do que ficou fora, não no resto", () => {
  const linha = {
    estudanteId: "e1",
    nome: "Ana",
    equipe: null,
    passo: "feed",
    aguardandoVirada: true,
    lupa: null,
    capa: null,
    invariantes: null,
    fora: null,
    par: null,
    segundaFoto: null,
  } as const;
  const base = { linhas: [linha] } as unknown as PainelDaTurma;
  const andou = { linhas: [{ ...linha, passo: "invariantes" }] } as unknown as PainelDaTurma;
  const achou = { linhas: [{ ...linha, invariantes: { encontrados: 4, erros: 0, ajuda: false, errosPosAjuda: 0, completo: true } }] } as unknown as PainelDaTurma;
  const marcouFora = { linhas: [{ ...linha, fora: { itens: [{ id: "m1", nome: "Estante" }], possiveis: 3 } }] } as unknown as PainelDaTurma;
  expect(mudouAEvidencia(base, andou)).toBe(false);
  expect(mudouAEvidencia(base, achou)).toBe(true);
  expect(mudouAEvidencia(base, marcouFora)).toBe(true);
});

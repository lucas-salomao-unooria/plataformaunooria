import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { CONTAS, E1, E2, E3, E4, E6, ESCOLA, MARCACAO, ESPERA, GLOBAL } from "./textos";
import { E5 } from "./textos-da-explicacao";
import { FICHA } from "./textos-da-ficha";

/**
 * Todas as strings de um grupo de copy — as fixas e as montadas (as funções
 * são chamadas com um valor de amostra: a régua é sobre as PALAVRAS da moldura,
 * não sobre o número que entra nela).
 */
function textosDo(grupo: Record<string, unknown>): string[] {
  const saida: string[] = [];
  for (const valor of Object.values(grupo)) {
    if (typeof valor === "string") saida.push(valor);
    else if (typeof valor === "function") saida.push(String((valor as (...a: unknown[]) => unknown)(3, 2)));
    else if (valor && typeof valor === "object") saida.push(...textosDo(valor as Record<string, unknown>));
  }
  return saida;
}

/**
 * Tudo o que a tela escreve ANTES do carrossel: E1 a E4, a ficha técnica e os
 * avisos globais. A ficha entra: ela é a revelação da E4, e a régua vale para
 * ela também — as palavras que NOMEIAM a descoberta só chegam na E5.
 */
function textosAntesDaRevelacao(): string[] {
  return [CONTAS, GLOBAL, E1, E2, E3, ESPERA, E4, FICHA].flatMap((g) => textosDo(g));
}

/**
 * O GAP COGNITIVO, cobrado sobre o que a TELA escreve.
 *
 * A missão existe para a criança DESCOBRIR que escolher é enquadrar; uma tela
 * que diga "viés", "enquadramento" ou "manipulação" antes do Mural entrega a
 * descoberta de graça — reprovação sumária no critério 8 do brief. A api já
 * cobra o mesmo do CONTEÚDO (os posts, os colegas virtuais, as enquetes); este
 * teste cobra da moldura: E1 a E4 e os avisos globais.
 *
 * A lista de termos NÃO é copiada: é lida de `apps/api/src/a-selecao/invariantes.ts`
 * (`TERMOS_PROIBIDOS_NA_TELA`), a fonte única. Uma segunda lista aqui seria a
 * que ninguém atualiza quando a pedagogia acrescentar um termo. A régua é a
 * mesma da api: palavra inteira, sem caixa e sem acento.
 */
const INVARIANTES = "../../api/src/a-selecao/invariantes.ts";

function termosProibidos(): string[] {
  const fonte = readFileSync(INVARIANTES, "utf8");
  const bloco = /export const TERMOS_PROIBIDOS_NA_TELA = \[([\s\S]*?)\] as const/.exec(fonte);
  if (!bloco?.[1]) throw new Error(`TERMOS_PROIBIDOS_NA_TELA não encontrado em ${INVARIANTES}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

/** A mesma normalização de `normalizarParaRegua` da api. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function termosEm(texto: string, termos: string[]): string[] {
  const alvo = normalizar(texto);
  return termos.filter((termo) => {
    const t = normalizar(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${t}($|[^a-z0-9])`).test(alvo);
  });
}

describe("nada de E1 a E4 entrega a descoberta antes da revelação", () => {
  const termos = termosProibidos();

  test("a régua foi lida da api (e não está vazia)", () => {
    expect(termos.length).toBeGreaterThanOrEqual(10);
    expect(termos).toContain("viés");
    expect(termos).toContain("enquadramento");
    expect(termos).toContain("fake news");
  });

  test("a lista da moldura não está vazia (o teste não passa por vacuidade)", () => {
    expect(textosAntesDaRevelacao().length).toBeGreaterThan(40);
  });

  test("nenhuma string da moldura antes do carrossel tem termo proibido", () => {
    const achados = textosAntesDaRevelacao()
      .map((t) => ({ texto: t, termos: termosEm(t, termos) }))
      .filter((a) => a.termos.length > 0);
    expect(achados).toEqual([]);
  });

  test("a régua pega o que tem de pegar (o teste não passa por vacuidade)", () => {
    expect(termosEm("Isso é Manipulação pura", termos)).toContain("manipulação");
    expect(termosEm("um dispositivo positivo", termos)).toEqual(["positivo"]);
  });
});

describe("as telas depois da revelação também não rotulam a criança", () => {
  /* A E5 PODE dizer "neutra" e "lente" — é onde o conceito chega. O que nenhuma
     tela pode, em momento nenhum, é rotular quem escolheu (8.4/8.5 do PRD):
     "você errou", "alienado", "ingênuo", nota, ranking. */
  const rotulos = ["você errou", "alienado", "alienada", "ingênuo", "ingênua", "sua nota", "nota final", "pontuação", "ranking", "aluno", "alunos"];

  test("E5, E6, a marcação e o fim", () => {
    const depois = [
      ...E5.cards.flatMap((c) => [c.titulo, c.corpo]),
      ...textosDo({ ...E5, cards: {} }),
      ...textosDo(E6),
      ...textosDo(MARCACAO),
      ...textosDo(ESCOLA),
    ];
    const achados = depois.filter((t) => termosEm(t, rotulos).length > 0);
    expect(achados).toEqual([]);
  });
});

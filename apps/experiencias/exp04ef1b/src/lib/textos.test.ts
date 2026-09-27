import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import * as TEXTOS from "./textos";

/**
 * Todas as strings que a TELA escreve — as fixas e as montadas (as funções são
 * chamadas com valores de amostra: a régua é sobre as PALAVRAS da moldura).
 */
function textosDo(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (typeof valor === "function") return [String((valor as (...a: unknown[]) => unknown)(1, 2))];
  if (Array.isArray(valor)) return valor.flatMap(textosDo);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDo);
  return [];
}

const TODOS = Object.values(TEXTOS).flatMap(textosDo);

/**
 * A régua da api sobre o que a CRIANÇA lê (`TERMOS_PROIBIDOS_NA_TELA` de
 * `apps/api/src/jornal-escola/invariantes.ts`): sem carimbo na notícia
 * ("falsa", "mentira", "fake news") e sem rótulo na criança ("você errou",
 * nota, ranking, "aluno"). A api cobra do CONTEÚDO; este teste cobra da
 * MOLDURA. A lista não é copiada: é lida do arquivo da api, a fonte única.
 */
const INVARIANTES = "../../api/src/jornal-escola/invariantes.ts";

function termosProibidos(): string[] {
  const fonte = readFileSync(INVARIANTES, "utf8");
  const bloco = /export const TERMOS_PROIBIDOS_NA_TELA = \[([\s\S]*?)\] as const/.exec(fonte);
  if (!bloco?.[1]) throw new Error(`TERMOS_PROIBIDOS_NA_TELA não encontrado em ${INVARIANTES}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

/** A mesma normalização de `normalizarParaRegua` da api: sem caixa, sem acento, palavra inteira. */
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

describe("a moldura não carimba a notícia nem rotula a criança", () => {
  const termos = termosProibidos();

  test("a régua foi lida da api (e não está vazia)", () => {
    expect(termos).toContain("falsa");
    expect(termos).toContain("você errou");
    expect(termos).toContain("aluno");
  });

  test("a lista da moldura não está vazia (o teste não passa por vacuidade)", () => {
    expect(TODOS.length).toBeGreaterThan(50);
  });

  test("nenhuma string da tela tem termo proibido", () => {
    const achados = TODOS.map((t) => ({ texto: t, termos: termosEm(t, termos) })).filter((a) => a.termos.length > 0);
    expect(achados).toEqual([]);
  });

  test("a régua pega o que tem de pegar", () => {
    expect(termosEm("Essa notícia é FALSA", termos)).toContain("falsa");
    expect(termosEm("uma falsificação", termos)).toEqual([]);
  });
});

describe("as duas decisões que mudaram o sheet", () => {
  test("o modal de publicar não tem a pergunta de motivo", () => {
    const modal = [TEXTOS.E3.modalTitulo, TEXTOS.E3.modalDescricao(1), TEXTOS.E3.distribuir, TEXTOS.E3.revisarMais];
    for (const t of modal) expect(t).not.toContain("Como a dupla escolheu");
    expect(TEXTOS.MOTIVO.pergunta).toBe("Como a dupla escolheu essas três matérias para a capa?");
  });

  test("a síntese é ÚNICA: só a `sintese_inicial` do sheet está na tela", () => {
    expect(TEXTOS.E6.sintese).toBe(
      "Antes de repassar qualquer aviso, pare e procure a fonte, a data e o autor para não espalhar enganos na escola.",
    );
    expect(TODOS.some((t) => t.includes("Você comprovou") || t.includes("Você começou a identificar"))).toBe(false);
  });
});

describe("a copy literal do sheet (as chaves que a e2e casa por texto exato)", () => {
  test.each([
    [TEXTOS.E1.explorarMesa, "Explorar Mesa de Notícias"],
    [TEXTOS.E2.adicionar, "Adicionar ao Jornal"],
    [TEXTOS.E2.voltarParaMesa, "Voltar para a Mesa"],
    [TEXTOS.E3.trocar, "Trocar Matéria"],
    [TEXTOS.E3.publicar1, "Publicar 1ª Edição"],
    [TEXTOS.E3.distribuir, "Distribuir Jornal Agora"],
    [TEXTOS.E4.indicador(2, 67), "2 de 3 notícias verificadas nesta edição (67%)"],
    [TEXTOS.EREV.publicar2, "Publicar 2ª Edição Revisada"],
    [TEXTOS.EREV.contraste(1, 3), "1ª Edição: 1 de 3 verificadas ➔ 2ª Edição: 3 de 3 verificadas!"],
    [TEXTOS.E6.concluir, "Concluir Missão"],
    [TEXTOS.ERROS.semSinal, "Conexão com a gráfica oscilou. Suas matérias continuam salvas na mesa editorial!"],
  ])("%s", (texto, esperado) => {
    expect(texto).toBe(esperado);
  });
});

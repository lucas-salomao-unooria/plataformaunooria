import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { CONTAS, E1, E2, E3, E4, E5, ESCOLA, FIM, GLOBAL, PASTAS } from "./textos";

/**
 * Todas as strings de um grupo de copy — as fixas e as montadas (as funções são
 * chamadas com valores de amostra: a régua é sobre as PALAVRAS da moldura).
 */
function textosDo(grupo: unknown): string[] {
  if (typeof grupo === "string") return [grupo];
  if (typeof grupo === "function") {
    const f = grupo as (...a: unknown[]) => unknown;
    try {
      return [String(f(9, 16, 56))];
    } catch {
      return [String(f(["Celular", "Wi-Fi da escola"]))];
    }
  }
  if (Array.isArray(grupo)) return grupo.flatMap((g) => textosDo(g));
  if (grupo && typeof grupo === "object") return Object.values(grupo).flatMap((g) => textosDo(g));
  return [];
}

const TODOS = [CONTAS, GLOBAL, ESCOLA, E1, E2, PASTAS, E3, E4, E5, FIM];
/* As pastas estão no feed, ANTES da galeria (ADR-176): também não nomeiam a descoberta. */
const ANTES_DA_GALERIA = [CONTAS, GLOBAL, E1, E2, PASTAS, E3];

/** O teto de palavras da copy (RNF-USA-001) e as exceções NOMEADAS da melhoria 5 (literais do PO). */
const TETO_DE_PALAVRAS = 25;
/* O crachá (`e1.narrativa.corpo_cracha`, a copy diz 36 palavras; são 37) e o infográfico (`e6.conclusao.infografico_corpo`, 33). */
const EXCECOES_DE_TETO = new Set<string>([E1.corpo, FIM.infograficoCorpo]);
const palavras = (t: string) => t.split(/\s+/).filter(Boolean).length;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

describe("a copy da missão", () => {
  test("UMA exclamação na missão inteira — a do Léo", () => {
    const comExclamacao = TODOS.flatMap((g) => textosDo(g)).filter((t) => t.includes("!"));
    expect(comExclamacao).toEqual([E5.ponteLeo]);
    expect([...E5.ponteLeo.matchAll(/!/g)]).toHaveLength(1);
  });

  test("nenhuma taxa cravada: a moldura é \"X de Y\", os dois números REAIS da sessão", () => {
    const tudo = TODOS.flatMap((g) => textosDo(g)).join("\n");
    expect(tudo).not.toMatch(/75\s*%/);
    expect(tudo).not.toMatch(/12 projetos/);
    /* Sem porcentagem nenhuma (0.5.0): com 40 estandes o total escondido é igual para todos. */
    expect(tudo).not.toMatch(/%/);
    expect(E4.badge(30, 40)).toBe("30 de 40 estandes nunca chegaram ao seu feed");
    expect(E4.badge(12, 16)).toBe("12 de 16 estandes nunca chegaram ao seu feed");
    expect(E4.subtitulo(9)).toBe("Estes 9 projetos concorrentes nunca foram entregues à sua tela.");
    expect(E4.subtitulo(1)).toBe("Este projeto concorrente nunca foi entregue à sua tela.");
    expect(E4.subtitulo(0)).toBe("Nenhum projeto desta área ficou fora do seu feed.");
  });

  test("a galeria sem a contagem por área nem o contraste (ADR-176); as pastas na voz da comissão", () => {
    expect(E4).not.toHaveProperty("porArea");
    expect(E4).not.toHaveProperty("semCurtidas");
    expect(PASTAS.salvarEm).toBe("Salvar em");
    expect(PASTAS.salvoEm("Tecnologia")).toBe("Salvo em Tecnologia");
    expect(PASTAS.faltam(3)).toBe("Antes de votar, salve cada estande na pasta da área dele: faltam 3.");
    expect(PASTAS.faltam(1)).toMatch(/o estande que ainda falta/);
    expect(PASTAS.quantos(1)).toBe("1 estande");
  });

  test("a copy literal do PRD v2 nas chaves que a e2e e o PO conferem", () => {
    expect(E2.marca).toBe("Unoovista");
    expect(CONTAS.jurado).toBe("@jurado_oficial");
    expect([E2.abaInicio, E2.abaBusca, E2.abaNotificacoes, E2.abaJurado]).toEqual(["Início", "Busca", "Notificações", "Jurado"]);
    expect(E2.foto(2)).toBe("Foto 2 de 3");
    expect(E3.conviccao).toEqual({ examinei_bem: "Sim", vi_tudo: "Com certeza" });
    expect(E4.manter).toBe("Manter meu voto inicial");
    expect(E4.confirmarRevisao).toBe("Confirmar Voto Revisado");
    expect(E5.enviar).toBe("Enviar a Regra");
    expect(E5.avancar).toBe("Concluir o Julgamento");
  });

  test("a revelação da regra diz o que ela fez NESTE feed, no tom de \"pode\", não de certeza", () => {
    expect(E5.revelacao.curtidas("#robotica")).toContain("#robotica");
    expect(E5.revelacao.curtidas("#robotica")).toMatch(/pode deixar o feed menos variado/);
    expect(E5.revelacao.permanencia("#saude")).toContain("#saude");
    expect(E5.revelacao.variado).toMatch(/não disparou/);
  });

  test("o teto de palavras vale para a moldura, menos as exceções nomeadas", () => {
    for (const texto of TODOS.flatMap((g) => textosDo(g))) {
      if (EXCECOES_DE_TETO.has(texto)) continue;
      expect(palavras(texto), texto).toBeLessThanOrEqual(TETO_DE_PALAVRAS);
    }
    for (const literal of EXCECOES_DE_TETO) expect(palavras(literal)).toBeGreaterThan(TETO_DE_PALAVRAS);
  });

  /**
   * As marcas que não entram num estande (`TERMOS_PROIBIDOS` da api) também não
   * entram na moldura: o app é o Unoovista, e a lista é lida da fonte única.
   */
  test("nenhuma marca real na tela", () => {
    const fonte = readFileSync("../../api/src/juri-estadual/invariantes.ts", "utf8");
    const bloco = /export const TERMOS_PROIBIDOS = \[([\s\S]*?)\] as const/.exec(fonte)?.[1] ?? "";
    const marcas = [...bloco.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(marcas.length).toBeGreaterThan(5);
    for (const texto of TODOS.flatMap((g) => textosDo(g))) {
      const palavras = new Set(semAcento(texto).split(/[^a-z0-9]+/));
      for (const marca of marcas) expect(palavras.has(marca), `"${marca}" em "${texto}"`).toBe(false);
    }
  });

  /**
   * O GAP COGNITIVO: antes da galeria, a tela não nomeia a descoberta. O guia
   * do professor pede o mesmo da fala dele ("não mencione algoritmo, bolha ou
   * filtro"); este teste cobra da moldura: o crachá, o feed, a cédula, a
   * plenária e os avisos globais.
   */
  test("antes da galeria, nenhuma palavra entrega o mecanismo", () => {
    const proibidas = ["algoritmo", "bolha", "filtro", "oculto", "oculta", "ocultos", "escondido", "invisivel"];
    for (const texto of ANTES_DA_GALERIA.flatMap((g) => textosDo(g))) {
      const palavras = new Set(semAcento(texto).split(/[^a-z0-9]+/));
      for (const p of proibidas) expect(palavras.has(p), `"${p}" em "${texto}"`).toBe(false);
    }
  });
});

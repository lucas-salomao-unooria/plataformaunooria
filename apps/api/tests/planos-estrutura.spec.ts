import { PLANO_MOCK } from "../src/ai/mock.provider";
import { habilidadesEf } from "../src/curriculo/dados/habilidades-ef";
import {
  LIMITES,
  SECAO_OPCIONAL_DO_BIMESTRE,
  SECOES_DO_BIMESTRE,
  SECOES_DO_PLANO,
  SECOES_QUE_SAIRAM,
} from "../src/planos/estrutura-do-plano";
import { PROMPT_PLANO_DE_AULA } from "../src/planos/prompt-plano-de-aula";
import { TEMPLATE_PLANO } from "../src/planos/template-plano";

/**
 * A ESTRUTURA DO PLANO É UMA SÓ (ADR-123).
 *
 * Antes, o prompt pedia nove blocos, o template mostrava seis e a mensagem ao
 * modelo mandava "seguir RIGOROSAMENTE o template": a IA escolhia a quem
 * obedecer, e o plano mudava de forma de uma geração para outra. O template
 * ainda trazia código de habilidade com o texto de OUTRA habilidade — num
 * prompt que proíbe inventar código.
 *
 * Este teste não roda a IA (não há como medir o Gemini num teste unitário): ele
 * garante que as três peças escritas à mão — prompt, exemplo e mock — dizem a
 * mesma coisa, e que o exemplo não ensina o erro que o prompt proíbe. Sem
 * banco: roda em qualquer máquina.
 */

const CODIGO = /EF\d{2}[A-Z]{2}\d{2}/g;

/** Títulos de um nível (`#` ou `##`) do texto, na ordem. */
const titulos = (texto: string, nivel: 1 | 2) =>
  [...texto.matchAll(new RegExp(`^${"#".repeat(nivel)} (.+)$`, "gm"))].map((m) => m[1]!.trim());

/** Os blocos `# Nº bimestre — …` do texto, cada um com o próprio corpo. */
function bimestresDo(texto: string): Array<{ titulo: string; corpo: string }> {
  return texto
    .split(/^# /m)
    .slice(1)
    .map((p) => ({ titulo: p.split("\n")[0]!.trim(), corpo: p }))
    .filter((p) => /^\d+º bimestre/.test(p.titulo));
}

/** Itens (`- …`) que vêm sob um título, até o próximo título de nível 1 ou 2. */
function itensSob(texto: string, cabecalho: string): string[] {
  const ini = texto.indexOf(`${cabecalho}\n`);
  if (ini < 0) return [];
  const resto = texto.slice(ini + cabecalho.length + 1);
  const fim = resto.search(/^#{1,2} /m);
  return (fim < 0 ? resto : resto.slice(0, fim)).split("\n").filter((l) => l.startsWith("- "));
}

describe("prompt de sistema: a autoridade sobre a estrutura", () => {
  test.each([...SECOES_DO_PLANO, ...SECOES_DO_BIMESTRE, SECAO_OPCIONAL_DO_BIMESTRE])(
    "descreve a seção «%s»",
    (secao) => {
      expect(PROMPT_PLANO_DE_AULA).toMatch(new RegExp(`^#{1,2} ${secao}$`, "m"));
    },
  );

  test.each([...SECOES_QUE_SAIRAM])("não pede mais «%s»", (secao) => {
    expect(PROMPT_PLANO_DE_AULA).not.toContain(secao);
  });

  test("declara que o template é só exemplo e que a estrutura é a dele", () => {
    expect(PROMPT_PLANO_DE_AULA).toMatch(/ÚNICA definição da estrutura/);
    expect(PROMPT_PLANO_DE_AULA).toMatch(/EXEMPLO de outra disciplina/);
  });

  test("os limites que a IA lê são os de LIMITES", () => {
    const { objetivos, conteudos, estrategias, avaliacao } = LIMITES;
    expect(PROMPT_PLANO_DE_AULA).toContain(`de ${objetivos.min} a ${objetivos.max} objetivos`);
    expect(PROMPT_PLANO_DE_AULA).toContain(`de ${conteudos.min} a ${conteudos.max} itens`);
    expect(PROMPT_PLANO_DE_AULA).toContain(`entre ${estrategias.min} e ${estrategias.max} estratégias`);
    expect(PROMPT_PLANO_DE_AULA).toContain(`de ${avaliacao.min} a ${avaliacao.max} evidências`);
    expect(PROMPT_PLANO_DE_AULA).not.toMatch(/undefined|\$\{/);
  });

  test("usa \\n como quebra de linha (o \\r\\n do porte original saiu)", () => {
    expect(PROMPT_PLANO_DE_AULA).not.toContain("\r");
  });
});

describe("template de exemplo: mostra a estrutura, não a define", () => {
  test.each([...SECOES_DO_PLANO])("traz a seção «%s»", (secao) => {
    expect(titulos(TEMPLATE_PLANO, 1)).toContain(secao);
  });

  test.each([...SECOES_QUE_SAIRAM])("não traz «%s»", (secao) => {
    expect(TEMPLATE_PLANO).not.toContain(secao);
  });

  test("as seções vêm na ordem do prompt", () => {
    const presentes = titulos(TEMPLATE_PLANO, 1).filter((t) => (SECOES_DO_PLANO as readonly string[]).includes(t));
    expect(presentes).toEqual([...SECOES_DO_PLANO]);
  });

  test("tem quatro bimestres, e cada um traz todas as seções do bimestre", () => {
    const bimestres = bimestresDo(TEMPLATE_PLANO);
    expect(bimestres).toHaveLength(4);
    for (const b of bimestres) {
      expect(titulos(b.corpo, 2)).toEqual(
        expect.arrayContaining([...SECOES_DO_BIMESTRE, SECAO_OPCIONAL_DO_BIMESTRE]),
      );
    }
  });

  test("respeita os limites de itens que o prompt declara", () => {
    const { objetivos, conteudos, estrategias, avaliacao } = LIMITES;
    const dentro = (n: number, l: { min: number; max: number }) => n >= l.min && n <= l.max;

    expect(dentro(itensSob(TEMPLATE_PLANO, "# Objetivos gerais").length, objetivos)).toBe(true);
    for (const b of bimestresDo(TEMPLATE_PLANO)) {
      expect(dentro(itensSob(b.corpo, "## Conteúdos").length, conteudos)).toBe(true);
      expect(dentro(itensSob(b.corpo, "## Estratégias metodológicas").length, estrategias)).toBe(true);
      expect(dentro(itensSob(b.corpo, "## Formas de avaliação").length, avaliacao)).toBe(true);
    }
  });

  test("o Percurso do ano tem uma linha por bimestre, com a mesma pergunta do bimestre", () => {
    const bimestres = bimestresDo(TEMPLATE_PLANO);
    const tabela = TEMPLATE_PLANO.split("\n").filter((l) => /^\| \d+º bimestre \|/.test(l));
    expect(tabela).toHaveLength(bimestres.length);

    bimestres.forEach((b, i) => {
      const pergunta = b.corpo.split("## Questão norteadora\n")[1]!.trim().split("\n")[0]!;
      expect(tabela[i]).toContain(pergunta);
    });
  });

  test("cada evidência de avaliação se liga a uma habilidade do próprio bimestre", () => {
    for (const b of bimestresDo(TEMPLATE_PLANO)) {
      const doBimestre = new Set(itensSob(b.corpo, "## Habilidades mobilizadas").join("\n").match(CODIGO));
      const evidencias = itensSob(b.corpo, "## Formas de avaliação");

      // um item pode ser transversal (a autoavaliação), mas no máximo um por bimestre
      expect(evidencias.filter((e) => !(e.match(CODIGO) ?? []).length).length).toBeLessThanOrEqual(1);
      for (const e of evidencias) {
        for (const c of e.match(CODIGO) ?? []) expect(doBimestre.has(c)).toBe(true);
      }
    }
  });
});

describe("template de exemplo: nenhuma habilidade inventada", () => {
  const base = new Map(habilidadesEf.map((h) => [h.codigo, h.descricao]));
  const linhas = TEMPLATE_PLANO.split("\n").filter((l) => /^- EF\d{2}[A-Z]{2}\d{2} — /.test(l));

  test("o exemplo lista habilidades", () => {
    expect(linhas.length).toBeGreaterThanOrEqual(10);
  });

  test.each(linhas.map((l) => [l.slice(2, 10), l] as const))(
    "%s: código e texto são os da BNCC do repositório",
    (codigo, linha) => {
      const texto = linha.replace(/^- EF\d{2}[A-Z]{2}\d{2} — /, "").replace(/ \(retomada\)$/, "");
      expect(base.has(codigo)).toBe(true);
      expect(texto).toBe(base.get(codigo));
    },
  );
});

describe("mock do provider: a mesma anatomia, para o smoke visual", () => {
  test.each([...SECOES_DO_PLANO])("traz a seção «%s»", (secao) => {
    expect(titulos(PLANO_MOCK, 1)).toContain(secao);
  });

  test("o primeiro bimestre traz as seções do bimestre", () => {
    const [b1] = bimestresDo(PLANO_MOCK);
    expect(titulos(b1!.corpo, 2)).toEqual(expect.arrayContaining([...SECOES_DO_BIMESTRE]));
  });
});

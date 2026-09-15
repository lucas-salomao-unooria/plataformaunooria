import { CONJUNTOS, fontesParaOProfessor } from "../../src/unoogpt/modelo/conjuntos";
import { CAMPOS_SENSIVEIS } from "../../src/unoogpt/invariantes";

/**
 * `fontesParaOProfessor()` alimenta o GUIA DA AULA do hub — a única superfície
 * em que o viés de cada fonte é dito com todas as letras.
 *
 * O que estes testes seguram é a derivação: o viés sai da própria `instrucao`,
 * a mesma string que o agente recebe, cortada na marca `VIÉS:`. Se alguém
 * recalibrar o cenário e a marca sumir de uma das oito, a função lança — melhor
 * quebrar o build do que servir ao professor a instrução inteira (que começa com
 * "Você passa a enxergar…") como se fosse o viés, e ele contar isso à turma.
 */
describe("as 8 fontes como o professor precisa vê-las", () => {
  const fontes = fontesParaOProfessor();

  test("uma por conjunto, na mesma ordem", () => {
    expect(fontes).toHaveLength(CONJUNTOS.length);
    expect(fontes.map((f) => f.slug)).toEqual(CONJUNTOS.map((c) => c.slug));
  });

  test("toda fonte tem viés, e ele é a parte DEPOIS da marca", () => {
    for (const fonte of fontes) {
      expect(fonte.vies.length).toBeGreaterThan(20);
      // A instrução começa com "Você passa a enxergar…"; se isso vazasse para o
      // viés, a derivação teria pegado a string inteira.
      expect(fonte.vies).not.toContain("Você passa a enxergar");
      expect(fonte.vies).not.toContain("VIÉS:");
    }
  });

  test("a cobertura vem ordenada do bairro mais coberto ao menos", () => {
    for (const fonte of fontes) {
      const conjunto = CONJUNTOS.find((c) => c.slug === fonte.slug)!;
      const fracoes = fonte.cobre.map((bairro) => conjunto.cobertura[bairro]!);
      expect(fracoes).toEqual([...fracoes].sort((a, b) => b - a));
      // Bairro com cobertura 0 (ou ausente) não entra: no jogo ele fica branco,
      // e branco é "não sabemos", nunca "coberto com zero".
      expect(fracoes.every((f) => f > 0)).toBe(true);
    }
  });

  test("o estudo acadêmico cobre um bairro só — é a troca entre profundidade e largura", () => {
    const estudo = fontes.find((f) => f.slug === "estudo")!;
    expect(estudo.cobre).toEqual(["ribeirinha"]);
  });

  /*
   * Esta saída é PROFESSOR-ONLY, e o campo `lacuna` do modelo está em
   * `CAMPOS_SENSIVEIS` — o que ela devolve é uma DERIVAÇÃO em prosa, não o
   * campo. O teste registra a forma: se alguém acrescentar aqui um campo com
   * nome de campo sensível, a redação de log e o sanitizador passariam a
   * apagá-lo em silêncio, e o guia sairia com a coluna vazia.
   */
  test("nenhum campo tem nome de campo sensível", () => {
    for (const fonte of fontes) {
      for (const chave of Object.keys(fonte)) {
        expect(CAMPOS_SENSIVEIS).not.toContain(chave);
      }
    }
  });

  test("quebra alto se a marca do viés sumir de um conjunto", () => {
    const original = CONJUNTOS[0]!.instrucao;
    CONJUNTOS[0]!.instrucao = "Você passa a enxergar o histórico de chamados.";
    try {
      expect(() => fontesParaOProfessor()).toThrow(/perdeu a marca/);
    } finally {
      CONJUNTOS[0]!.instrucao = original;
    }
  });
});

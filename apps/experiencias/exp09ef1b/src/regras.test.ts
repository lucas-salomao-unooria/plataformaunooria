import { describe, expect, test } from "vitest";
import { EDITOR_VAZIO, descartar, devolver, etapaDoPasso, mover, moverNaEsteira, noBanco, podeEnviar, podeRegistrar, porNaVerificacao } from "./lib/regras";
import { PASSOS, type BlocoId } from "./lib/tipos";

const BANCO: BlocoId[] = ["desclassificar-sem-pdf", "auditar-fontes", "sinalizar-pendencias", "normalizar-impacto"];

describe("o ranking", () => {
  test("mover leva o item para a posição, e fora da faixa não mexe", () => {
    expect(mover(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(mover(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], 0, 5)).toEqual(["a", "b", "c"]);
  });
  test("Registrar Decisão: o projeto marcado e o ranking tocado", () => {
    expect(podeRegistrar(null, true)).toBe(false);
    expect(podeRegistrar("nuvem", false)).toBe(false);
    expect(podeRegistrar("nuvem", true)).toBe(true);
  });
});

describe("o Editor de Protocolo", () => {
  test("abre limpo: tudo no banco, na ordem do servidor, e o Enviar apagado", () => {
    expect(noBanco(BANCO, EDITOR_VAZIO)).toEqual(BANCO);
    expect(podeEnviar(EDITOR_VAZIO)).toBe(false);
  });
  test("um bloco na esteira acende o Enviar — sem trava no cliente (PO, 29/10)", () => {
    const e = porNaVerificacao(EDITOR_VAZIO, "desclassificar-sem-pdf", 0);
    expect(podeEnviar(e)).toBe(true);
    expect(noBanco(BANCO, e)).not.toContain("desclassificar-sem-pdf");
  });
  test("pôr numa verificação ocupada devolve o outro ao banco; descartar e devolver", () => {
    let e = porNaVerificacao(EDITOR_VAZIO, "auditar-fontes", 0);
    e = porNaVerificacao(e, "normalizar-impacto", 0);
    expect(e.slots).toEqual(["normalizar-impacto", null, null]);
    expect(noBanco(BANCO, e)).toContain("auditar-fontes");
    e = descartar(e, "normalizar-impacto");
    expect(e).toEqual({ slots: [null, null, null], descarte: ["normalizar-impacto"] });
    expect(devolver(e, "normalizar-impacto")).toEqual(EDITOR_VAZIO);
  });
  test("Subir e Descer trocam com a vizinha", () => {
    const e = porNaVerificacao(porNaVerificacao(EDITOR_VAZIO, "auditar-fontes", 0), "sinalizar-pendencias", 1);
    expect(moverNaEsteira(e, 1, -1).slots).toEqual(["sinalizar-pendencias", "auditar-fontes", null]);
    expect(moverNaEsteira(e, 0, -1)).toBe(e);
  });
});

test("todo passo tem a etapa da telemetria", () => {
  for (const p of PASSOS) expect(etapaDoPasso(p)).toMatch(/^E\d|CONCLUIDA/);
});

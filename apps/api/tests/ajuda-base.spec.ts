import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { BASE_DA_AJUDA } from "../src/ajuda/base/base-da-ajuda.gerada";

/**
 * A BASE DE CONHECIMENTO da Ajuda (ADR-132) é GERADA da documentação de produto
 * (`scripts/gerar-base-da-ajuda.mjs`). Duas coisas que só um teste segura:
 *
 *   1. ela está EM DIA — quem muda o mapa de produto ou um guia da aula e
 *      esquece de regerar deixa o atendente explicando a tela de ontem;
 *   2. ela não carrega vocabulário de ENGENHARIA — o atendente fala com
 *      professor e coordenação, e o vendor do avatar vê o prompt.
 */

const RAIZ = join(__dirname, "../../..");

describe("a base de conhecimento da Ajuda", () => {
  it("está em dia com o mapa de produto, os guias e os manifestos", () => {
    const r = spawnSync(process.execPath, ["--no-warnings", "scripts/gerar-base-da-ajuda.mjs", "--verificar"], {
      cwd: RAIZ,
      encoding: "utf8",
    });
    expect(`${r.stdout}${r.stderr}`).toContain("está em dia");
    expect(r.status).toBe(0);
  });

  it("não tem vocabulário técnico nem endereço interno", () => {
    for (const termo of [/escola_id/i, /\bRLS\b/, /\bJWT\b/, /\bBearer\b/, /gs:\/\//, /unooria\.com/i, /\bprisma\b/i]) {
      expect(BASE_DA_AJUDA).not.toMatch(termo);
    }
  });

  it("só tem o que JÁ existe: nenhuma história nem feature A FAZER", () => {
    // "Programar a abertura e o fechamento" é A FAZER no épico E04.
    expect(BASE_DA_AJUDA).not.toContain("Programar a abertura e o fechamento");
    expect(BASE_DA_AJUDA).toContain("Liberar uma missão para a turma");
  });

  it("traz os guias da aula das missões do registro, e não o arquivado", () => {
    expect(BASE_DA_AJUDA).toContain("# Os guias da aula das missões");
    expect(BASE_DA_AJUDA).toContain("Guia da aula: Unoovista");
    // O mapa CITA o UnooTube (para dizer que foi arquivado); o que não pode entrar é o guia dele.
    expect(BASE_DA_AJUDA).not.toMatch(/Guia da aula: (UnooTube|backup-)/);
  });
});

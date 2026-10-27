import type { ExperienciaHandle } from "@edu/sdk";
import { describe, expect, it } from "vitest";
import { api, definirExperiencia, naAtividade } from "./api";

/** A jogada leva a atividade do GESTO — inclusive no reenvio da fila depois de o professor zerar. */
describe("a atividade no corpo dos POSTs", () => {
  const corpos: unknown[] = [];
  definirExperiencia({
    api: {
      post: async (_rota: string, corpo: unknown) => {
        corpos.push(corpo);
        return {};
      },
    },
  } as unknown as ExperienciaHandle);

  const rodada1 = { pacoteId: "p1", rodada: 1 };
  const rodada2 = { pacoteId: "p1", rodada: 2 };

  it("vai junto com a jogada", async () => {
    corpos.length = 0;
    await naAtividade(rodada1, () => api.aposta("a"));
    expect(corpos).toEqual([{ aposta: "a", atividade: rodada1 }]);
  });

  it("o reenvio usa a do gesto, mesmo com outra jogada no meio", async () => {
    corpos.length = 0;
    const jogada = () => api.aposta("b");
    await naAtividade(rodada2, () => api.iniciar());
    await naAtividade(rodada1, jogada);
    expect(corpos).toEqual([{ atividade: rodada2 }, { aposta: "b", atividade: rodada1 }]);
  });

  it("sem atividade, o corpo vai como a tela mandou", async () => {
    corpos.length = 0;
    await naAtividade(null, () => api.navegar(["exercicios"]));
    expect(corpos).toEqual([{ abertas: ["exercicios"] }]);
  });
});

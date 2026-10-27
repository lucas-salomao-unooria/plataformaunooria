import { describe, expect, test, vi } from "vitest";
import { FilaDeEnvio } from "./fila";

const deRede = new Error("Failed to fetch");
const ehDeRede = (e: unknown) => e === deRede;

describe("a fila de envio em memória (one-pager §8)", () => {
  test("a jogada fica até a rede voltar, e sai depois do sucesso", async () => {
    const fila = new FilaDeEnvio(ehDeRede);
    let online = false;
    const tarefa = vi.fn(async () => {
      if (!online) throw deRede;
    });
    fila.enfileirar("publicar", tarefa);
    await fila.tentar();
    expect(fila.tem("publicar")).toBe(true);
    online = true;
    await fila.tentar();
    expect(fila.pendentes).toBe(0);
    expect(tarefa).toHaveBeenCalledTimes(2);
  });

  test("uma jogada por rota: a mais nova substitui a pendente", async () => {
    const fila = new FilaDeEnvio(ehDeRede);
    const velha = vi.fn(async () => {});
    const nova = vi.fn(async () => {});
    fila.enfileirar("cartoes", velha);
    fila.enfileirar("cartoes", nova);
    await fila.tentar();
    expect(velha).not.toHaveBeenCalled();
    expect(nova).toHaveBeenCalledOnce();
  });

  test("erro que NÃO é de rede sai da fila e é reportado (não fica tentando para sempre)", async () => {
    const reportar = vi.fn();
    const fila = new FilaDeEnvio(ehDeRede, reportar);
    const erro = new Error("API POST /x → 500");
    fila.enfileirar("criterios", async () => {
      throw erro;
    });
    await fila.tentar();
    expect(fila.pendentes).toBe(0);
    expect(reportar).toHaveBeenCalledWith(erro);
  });

  test("a rede ainda caída para a rodada: as seguintes esperam, na ordem", async () => {
    const fila = new FilaDeEnvio(ehDeRede);
    const segunda = vi.fn(async () => {});
    fila.enfileirar("a", async () => {
      throw deRede;
    });
    fila.enfileirar("b", segunda);
    await fila.tentar();
    expect(segunda).not.toHaveBeenCalled();
    expect(fila.pendentes).toBe(2);
  });
});

import { describe, expect, test } from "vitest";
import {
  INTERVALO_MINIMO_MS,
  SEGUNDOS_DE_LEITURA_MINIMA,
  congelou,
  deveForcarLatencia,
  deveObservarOGate,
  podeMarcarTag,
  podeRegistrarPercurso,
  podeSubmeterClausula,
  precisaConfirmarEscolha,
  promptsDisponiveis,
  seletorAberto,
  telaDo,
} from "./maquina-estados";
import type { Passo } from "./tipos";

/**
 * A máquina de estados da tela.
 *
 * Cada bloco corresponde a um critério de aceite do insumo. O que estes testes
 * pegam é a classe de defeito que o typecheck não vê: botão habilitado quando
 * não devia (que convida ao 409) e botão morto (que a criança não tem como
 * diagnosticar no meio da aula).
 */

describe("qual tela mostrar", () => {
  const base = { aguardandoATurma: false };

  test("cada passo tem uma tela", () => {
    const passos: Passo[] = [
      "briefing",
      "chat",
      "decisao",
      "manifesto",
      "percurso",
      "podcast",
      "fim",
    ];
    for (const passo of passos) {
      expect(telaDo({ ...base, passo })).toBeTruthy();
    }
  });

  test("o congelamento da turma VENCE o passo individual", () => {
    // É a única coisa que atravessa o ritmo de cada criança, e é a razão de o
    // Checkpoint A existir.
    expect(telaDo({ passo: "percurso", aguardandoATurma: true })).toBe("pausa");
    expect(telaDo({ passo: "podcast", aguardandoATurma: true })).toBe("pausa");
  });
});

describe("o seletor de questionamentos", () => {
  test("fecha durante o streaming da máquina", () => {
    // Um seletor vivo durante a resposta convida a atropelar o texto que a
    // criança precisa ler para chegar à contradição.
    expect(seletorAberto("chat", true, false)).toBe(false);
    expect(seletorAberto("chat", false, false)).toBe(true);
  });

  test("fecha durante a latência forçada", () => {
    expect(seletorAberto("chat", false, true)).toBe(false);
  });

  test("não existe fora da Etapa 2", () => {
    expect(seletorAberto("decisao", false, false)).toBe(false);
    expect(seletorAberto("briefing", false, false)).toBe(false);
  });

  test("o card já disparado sai da lista", () => {
    const prompts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(promptsDisponiveis(prompts, ["b"])).toEqual([{ id: "a" }, { id: "c" }]);
    expect(promptsDisponiveis(prompts, ["a", "b", "c"])).toEqual([]);
  });
});

describe("submeter a cláusula (o PICO)", () => {
  test("exige a cota de auditoria — a porta que a missão mede", () => {
    expect(
      podeSubmeterClausula({ cotaAtingida: false, clausulaId: null }, "clausula_veto_humano", false),
    ).toBe(false);
    expect(
      podeSubmeterClausula({ cotaAtingida: true, clausulaId: null }, "clausula_veto_humano", false),
    ).toBe(true);
  });

  test("exige uma cláusula selecionada (cardinalidade = 1)", () => {
    expect(podeSubmeterClausula({ cotaAtingida: true, clausulaId: null }, null, false)).toBe(false);
  });

  test("o latch fecha o botão de vez", () => {
    expect(
      podeSubmeterClausula(
        { cotaAtingida: true, clausulaId: "clausula_transparencia" },
        "clausula_veto_humano",
        false,
      ),
    ).toBe(false);
  });

  test("enviando desabilita — o clique duplo não manda duas vezes", () => {
    expect(
      podeSubmeterClausula({ cotaAtingida: true, clausulaId: null }, "clausula_veto_humano", true),
    ).toBe(false);
  });
});

describe("o formulário do percurso", () => {
  const texto = "Sem revisão humana a máquina decide sozinha sobre a vida de alguém.";

  test("exige exatamente 2 tags e o piso de caracteres", () => {
    expect(podeRegistrarPercurso(["autonomia", "justica"], texto, 20, 2, false)).toBe(true);
    expect(podeRegistrarPercurso(["autonomia"], texto, 20, 2, false)).toBe(false);
    expect(
      podeRegistrarPercurso(["autonomia", "justica", "privacidade"], texto, 20, 2, false),
    ).toBe(false);
  });

  test("recusa tags repetidas", () => {
    expect(podeRegistrarPercurso(["justica", "justica"], texto, 20, 2, false)).toBe(false);
  });

  test("o `trim` vem antes do piso", () => {
    // Sem isto, vinte espaços habilitariam o botão e a api responderia 400 — um
    // erro que a criança não tem como entender, porque a tela dizia que estava
    // pronto.
    expect(podeRegistrarPercurso(["autonomia", "justica"], " ".repeat(30), 20, 2, false)).toBe(
      false,
    );
  });

  test("a terceira tag é IMPEDIDA, não aceita-e-reclamada", () => {
    // A criança que marcou três descobriria pelo botão desabilitado, sem saber
    // qual desmarcar.
    expect(podeMarcarTag(["autonomia", "justica"], "privacidade", 2)).toBe(false);
    // Desmarcar a que já está marcada continua permitido.
    expect(podeMarcarTag(["autonomia", "justica"], "justica", 2)).toBe(true);
    expect(podeMarcarTag(["autonomia"], "privacidade", 2)).toBe(true);
  });
});

describe("caminhos degenerados", () => {
  test("clique em menos de 5s pede confirmação — uma vez só", () => {
    expect(precisaConfirmarEscolha(SEGUNDOS_DE_LEITURA_MINIMA - 1, false)).toBe(true);
    expect(precisaConfirmarEscolha(SEGUNDOS_DE_LEITURA_MINIMA - 1, true)).toBe(false);
    expect(precisaConfirmarEscolha(SEGUNDOS_DE_LEITURA_MINIMA + 1, false)).toBe(false);
  });

  test("disparos em menos de 10s acionam a latência forçada", () => {
    const agora = 1_000_000;
    expect(deveForcarLatencia(agora - 3_000, agora)).toBe(true);
    expect(deveForcarLatencia(agora - INTERVALO_MINIMO_MS - 1, agora)).toBe(false);
  });

  test("o primeiro disparo nunca sofre latência", () => {
    expect(deveForcarLatencia(null, 1_000_000)).toBe(false);
  });
});

describe("o polling do Checkpoint A (ADR-93)", () => {
  test("só liga nas telas em que o congelamento tem efeito", () => {
    // Ligar sempre custaria 7 req/s por turma durante os 50 minutos inteiros em
    // vez de durante a Etapa 4.
    expect(deveObservarOGate("decisao", true)).toBe(true);
    expect(deveObservarOGate("manifesto", true)).toBe(true);
    expect(deveObservarOGate("percurso", true)).toBe(true);
    expect(deveObservarOGate("briefing", true)).toBe(false);
    expect(deveObservarOGate("chat", true)).toBe(false);
    expect(deveObservarOGate("fim", true)).toBe(false);
  });

  test("estudante sem turma não faz polling — não há quem o solte", () => {
    expect(deveObservarOGate("manifesto", false)).toBe(false);
  });

  test("detecta a borda do congelamento, não o estado", () => {
    // O overlay entra numa transição; ficar reagindo a `etapa === "debate"` a
    // cada 5s reabriria a animação a cada leitura.
    expect(congelou("missao", "debate")).toBe(true);
    expect(congelou("debate", "debate")).toBe(false);
    expect(congelou("debate", "missao")).toBe(false);
  });
});

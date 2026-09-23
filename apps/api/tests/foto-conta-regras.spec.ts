import {
  ETAPAS,
  GABARITO_REFLEXAO,
  HESITACAO_MS,
  PACOTE_PADRAO,
} from "../src/foto-conta/catalogo";
import { PacoteDaTurmaSchema, PacotePublicoSchema } from "../src/foto-conta/contrato-de-rotas";
import {
  comentariosDe,
  escolhaValida,
  podeAvancar,
  reflexaoConclui,
  resumoDaTurma,
  type RunParaPainel,
} from "../src/foto-conta/regras";

/** Regras puras da exp01ef1b — sem banco. */

describe("a máquina de etapas anda um passo, sempre para a frente", () => {
  test("cada etapa avança só para a seguinte", () => {
    for (let i = 0; i < ETAPAS.length - 1; i++) {
      const de = ETAPAS[i];
      const para = ETAPAS[i + 1];
      if (!de || !para) throw new Error("índice fora da ordem canônica");
      expect(podeAvancar(de, para)).toBe(true);
    }
  });

  test("pulo e retrocesso são recusados", () => {
    expect(podeAvancar("feed", "aha")).toBe(false);
    expect(podeAvancar("decidir", "roda")).toBe(false);
    expect(podeAvancar("aha", "decidir")).toBe(false);
    expect(podeAvancar("concluida", "desafiar")).toBe(false);
  });
});

describe("o banco curado padrão é um pacote completo", () => {
  test("passa no MESMO schema que valida a IA e a aprovação", () => {
    expect(() => PacoteDaTurmaSchema.parse(PACOTE_PADRAO)).not.toThrow();
  });

  test("a matriz causal cobre as 4 combinações (2 fotos × 2 legendas)", () => {
    const fotos = [PACOTE_PADRAO.par.fotoAId, PACOTE_PADRAO.par.fotoBId];
    const legendas = PACOTE_PADRAO.legendas.map((l) => l.id);
    for (const foto of fotos) {
      for (const legenda of legendas) {
        expect(comentariosDe(PACOTE_PADRAO, foto, legenda)).not.toBeNull();
      }
    }
  });

  test("todo texto do estudante está em CAIXA ALTA e dentro do teto de palavras", () => {
    const textos = [
      ...PACOTE_PADRAO.feed.map((p) => p.legenda),
      ...PACOTE_PADRAO.legendas.map((l) => l.texto),
      ...PACOTE_PADRAO.comentarios.flatMap((c) => [c.leo, c.sofia]),
    ];
    for (const t of textos) {
      expect(t).toBe(t.toUpperCase());
      expect(t.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });
});

describe("a fronteira do pacote público (a surpresa do Aha)", () => {
  test("o schema público NÃO aceita a matriz de comentários", () => {
    const publico = PacotePublicoSchema.parse(PACOTE_PADRAO);
    expect("comentarios" in publico).toBe(false);
    // E o texto de comentário não aparece serializado em lugar nenhum do que
    // o estudante recebe antes de publicar.
    const serializado = JSON.stringify(publico);
    for (const c of PACOTE_PADRAO.comentarios) {
      expect(serializado).not.toContain(c.leo);
      expect(serializado).not.toContain(c.sofia);
    }
  });
});

describe("escolha do par", () => {
  test("aceita só foto E legenda do pacote", () => {
    expect(escolhaValida(PACOTE_PADRAO, "par_a", "legenda_1")).toBe(true);
    expect(escolhaValida(PACOTE_PADRAO, "par_b", "legenda_2")).toBe(true);
    expect(escolhaValida(PACOTE_PADRAO, "gato", "legenda_1")).toBe(false);
    expect(escolhaValida(PACOTE_PADRAO, "par_a", "legenda_3")).toBe(false);
  });
});

describe("a reflexão final decide no servidor", () => {
  test("a Lupa conclui; o Globo é retry", () => {
    expect(reflexaoConclui(GABARITO_REFLEXAO)).toBe(true);
    expect(reflexaoConclui("globo")).toBe(false);
  });
});

describe("o resumo do painel", () => {
  const base = new Date("2026-09-10T12:00:00Z");
  const run = (sobre: Partial<RunParaPainel>): RunParaPainel => ({
    estudanteId: "00000000-0000-0000-0000-000000000001",
    etapa: "feed",
    fotoEscolhidaId: null,
    legendaEscolhidaId: null,
    atualizadoEm: base,
    ...sobre,
  });

  test("conta distribuição, latch e conclusão sem inventar categoria", () => {
    const agora = new Date(base.getTime() + 1_000);
    const resumo = resumoDaTurma(
      [
        run({ estudanteId: "00000000-0000-0000-0000-000000000001" }),
        run({
          estudanteId: "00000000-0000-0000-0000-000000000002",
          etapa: "roda",
          fotoEscolhidaId: "par_b",
          legendaEscolhidaId: "legenda_1",
        }),
        run({
          estudanteId: "00000000-0000-0000-0000-000000000003",
          etapa: "concluida",
          fotoEscolhidaId: "par_a",
          legendaEscolhidaId: "legenda_2",
        }),
      ],
      agora,
    );
    expect(resumo.conectados).toBe(3);
    expect(resumo.publicaram).toBe(2);
    expect(resumo.noLatch).toBe(1);
    expect(resumo.concluiram).toBe(1);
    expect(resumo.porFoto).toEqual({ par_b: 1, par_a: 1 });
    expect(resumo.porLegenda).toEqual({ legenda_1: 1, legenda_2: 1 });
  });

  test("hesitação é run parada na DECISÃO além do limiar — e só o id opaco sai", () => {
    const agora = new Date(base.getTime() + HESITACAO_MS + 1_000);
    const parado = run({
      estudanteId: "00000000-0000-0000-0000-00000000000a",
      etapa: "decidir",
    });
    const rapido = run({
      estudanteId: "00000000-0000-0000-0000-00000000000b",
      etapa: "decidir",
      atualizadoEm: new Date(agora.getTime() - 5_000),
    });
    const noFeed = run({
      estudanteId: "00000000-0000-0000-0000-00000000000c",
      etapa: "feed",
    });
    const resumo = resumoDaTurma([parado, rapido, noFeed], agora);
    expect(resumo.hesitando).toEqual(["00000000-0000-0000-0000-00000000000a"]);
    // Nome não existe neste nível por desenho (DAD-07): o shape é só o UUID.
    expect(JSON.stringify(resumo)).not.toContain("nome");
  });
});

import { COLEGAS, VIDEOS, VIDEO_IDS, semGabarito } from "../src/unootube/catalogo";
import {
  ESTADO_INICIAL,
  aplicarCredibilidade,
  aplicarRemover,
  aplicarSalvar,
  alternarCurtida,
  derivados,
  inscritosDoColega,
  montarRanking,
  ordenarPorFontes,
  ordenarPorInscritos,
  posicaoDoAluno,
  resumirTurma,
  type EstadoSessao,
  type LinhaTurma,
} from "../src/unootube/regras";

/** Regras puras da missão — sem banco. Mecânica herdada do UnooTube original. */

const FAKES = VIDEOS.filter((v) => !v.factual).map((v) => v.id);
const CONFIAVEIS = VIDEOS.filter((v) => v.factual).map((v) => v.id);

function estadoCom(salvos: string[], extra: Partial<EstadoSessao> = {}): EstadoSessao {
  return { ...ESTADO_INICIAL, salvos, curtidos: [], ...extra };
}

function ok(r: ReturnType<typeof aplicarSalvar>): EstadoSessao {
  if (!r.ok) throw new Error(`esperava sucesso, veio ${r.codigo}`);
  return r.estado;
}

describe("catálogo", () => {
  test("21 vídeos com ids únicos, arquivo derivado do id, 11 confiáveis e 10 fakes", () => {
    expect(VIDEOS).toHaveLength(21);
    expect(new Set(VIDEO_IDS).size).toBe(21);
    for (const v of VIDEOS) expect(v.arquivo).toBe(`${v.id}.mp4`);
    expect(CONFIAVEIS).toHaveLength(11);
    expect(FAKES).toHaveLength(10);
  });

  test("39 colegas fictícios com 0..3 fontes", () => {
    expect(COLEGAS).toHaveLength(39);
    expect(new Set(COLEGAS.map((c) => c.id)).size).toBe(39);
    for (const c of COLEGAS) expect([0, 1, 2, 3]).toContain(c.fontesConfiaveis);
  });

  test("semGabarito remove o factual e nada mais", () => {
    const publico = VIDEOS.map(semGabarito);
    expect(JSON.stringify(publico)).not.toContain("factual");
    expect(Object.keys(publico[0]!).sort()).toEqual(
      [
        "accent",
        "arquivo",
        "avatar",
        "curtidasRotulo",
        "descricao",
        "handle",
        "id",
        "inscritosRotulo",
        "titulo",
        "visualizacoesRotulo",
      ].sort(),
    );
  });

  /**
   * As métricas de popularidade são COSMÉTICAS, mas não são aleatórias: o vídeo
   * fake é o que tem os números grandes, e é esse contraste que o ranking
   * desmonta depois. Se um dia um factual sair com mais visualizações que um
   * fake, a lição inverte de sinal sem ninguém notar.
   */
  test("todo fake é mais popular que todo factual", () => {
    const emNumero = (rotulo: string) => {
      const [valor] = rotulo.split(" ");
      const base = Number(valor!.replace(",", "."));
      if (rotulo.includes(" mi ")) return base * 1_000_000;
      if (rotulo.includes(" mil ")) return base * 1_000;
      return base;
    };
    const vistas = (fake: boolean) =>
      VIDEOS.filter((v) => v.factual !== fake).map((v) => emNumero(v.visualizacoesRotulo));
    expect(Math.min(...vistas(true))).toBeGreaterThan(Math.max(...vistas(false)));
  });
});

describe("derivados", () => {
  test("vazio", () => {
    expect(derivados([])).toEqual({ inscritos: 0, fontesConfiaveis: 0, salvos: 0, vagas: 3 });
  });
  test("3 fakes → 3000 inscritos, 0 fontes", () => {
    expect(derivados(FAKES.slice(0, 3))).toMatchObject({ inscritos: 3000, fontesConfiaveis: 0, vagas: 0 });
  });
  test("2 confiáveis + 1 fake → 1100 / 2", () => {
    expect(derivados([...CONFIAVEIS.slice(0, 2), FAKES[0]!])).toMatchObject({
      inscritos: 1100,
      fontesConfiaveis: 2,
    });
  });
  test("3 confiáveis → 150 / 3", () => {
    expect(derivados(CONFIAVEIS.slice(0, 3))).toMatchObject({ inscritos: 150, fontesConfiaveis: 3 });
  });
});

describe("aplicarSalvar", () => {
  test("salvar o mesmo vídeo é idempotente", () => {
    const r = aplicarSalvar(estadoCom(["v02"]), "v02");
    expect(r).toMatchObject({ ok: true, mudou: false });
  });
  test("o 3º salvo desbloqueia o ranking; o 4º bate no limite", () => {
    let estado = estadoCom([]);
    estado = ok(aplicarSalvar(estado, "v02"));
    estado = ok(aplicarSalvar(estado, "v04"));
    expect(estado.rankingDesbloqueado).toBe(false);
    estado = ok(aplicarSalvar(estado, "v06"));
    expect(estado.rankingDesbloqueado).toBe(true);
    expect(aplicarSalvar(estado, "v08")).toEqual({ ok: false, codigo: "LIMITE_SALVOS" });
  });
  test("após credibilidade, salvar é recusado (congelamento)", () => {
    const estado = estadoCom(["v02", "v04"], { rankingDesbloqueado: true, credibilidadeAdicionada: true });
    expect(aplicarSalvar(estado, "v06")).toEqual({ ok: false, codigo: "MISSAO_CONCLUIDA" });
  });
});

describe("aplicarRemover", () => {
  test("remover mantém o ranking desbloqueado (latch)", () => {
    const estado = estadoCom(["v02", "v04", "v06"], { rankingDesbloqueado: true });
    const depois = ok(aplicarRemover(estado, "v04"));
    expect(depois.salvos).toEqual(["v02", "v06"]);
    expect(depois.rankingDesbloqueado).toBe(true);
  });
  test("remover não salvo é no-op; após credibilidade é recusado", () => {
    expect(aplicarRemover(estadoCom(["v02"]), "v99")).toMatchObject({ ok: true, mudou: false });
    const congelado = estadoCom(["v02"], { credibilidadeAdicionada: true, rankingDesbloqueado: true });
    expect(aplicarRemover(congelado, "v02")).toEqual({ ok: false, codigo: "MISSAO_CONCLUIDA" });
  });
});

describe("alternarCurtida", () => {
  test("liga e desliga, mesmo com a missão congelada", () => {
    const congelado = estadoCom(["v02"], { credibilidadeAdicionada: true, rankingDesbloqueado: true });
    const ligado = ok(alternarCurtida(congelado, "v03"));
    expect(ligado.curtidos).toEqual(["v03"]);
    expect(ok(alternarCurtida(ligado, "v03")).curtidos).toEqual([]);
  });
});

describe("aplicarCredibilidade", () => {
  test("bloqueada com menos de 3 salvos", () => {
    expect(aplicarCredibilidade(estadoCom(["v02"]), new Date())).toEqual({
      ok: false,
      codigo: "RANKING_BLOQUEADO",
    });
  });
  test("marca conclusão uma vez e não rebate o instante", () => {
    const agora = new Date("2026-08-24T12:00:00Z");
    const primeiro = ok(aplicarCredibilidade(estadoCom(["v02", "v04", "v06"], { rankingDesbloqueado: true }), agora));
    expect(primeiro.credibilidadeAdicionada).toBe(true);
    expect(primeiro.concluidoEm).toEqual(agora);
    const segundo = aplicarCredibilidade(primeiro, new Date("2026-08-25T12:00:00Z"));
    expect(segundo).toMatchObject({ ok: true, mudou: false });
    expect(ok(segundo).concluidoEm).toEqual(agora);
  });
});

describe("ranking", () => {
  test("inscritos do colega: 0 fontes → 3000, 3 fontes → 150", () => {
    expect(inscritosDoColega(0)).toBe(3000);
    expect(inscritosDoColega(3)).toBe(150);
  });

  test("40 linhas, exatamente um 'você' com o nome real", () => {
    const linhas = montarRanking({ nome: "Lia" }, CONFIAVEIS.slice(0, 3));
    expect(linhas).toHaveLength(40);
    const voce = linhas.filter((l) => l.voce);
    expect(voce).toHaveLength(1);
    expect(voce[0]).toMatchObject({ nome: "Lia", avatar: "L", inscritos: 150, fontesConfiaveis: 3 });
  });

  test("por inscritos os fakes vencem; por fontes a métrica vira", () => {
    const linhas = montarRanking({ nome: "Lia" }, CONFIAVEIS.slice(0, 3));
    const porInscritos = ordenarPorInscritos(linhas);
    expect(porInscritos[0]!.fontesConfiaveis).toBe(0);
    // Quem acertou as 3 fontes fica no bloco final de 150 inscritos (11 linhas: 10 colegas + você).
    const bloco150 = porInscritos.slice(-11);
    expect(bloco150.every((l) => l.inscritos === 150)).toBe(true);
    expect(bloco150.some((l) => l.voce)).toBe(true);
    const porFontes = ordenarPorFontes(linhas);
    expect(porFontes[0]!.fontesConfiaveis).toBe(3);
    const pos = posicaoDoAluno(linhas);
    expect(pos.porInscritos).toBeGreaterThanOrEqual(30);
    expect(pos.porFontes).toBeLessThanOrEqual(11);
  });

  test("desempate determinístico por nome pt-BR", () => {
    const linhas = montarRanking({ nome: "Zeca" }, FAKES.slice(0, 3));
    const topo = ordenarPorInscritos(linhas).filter((l) => l.inscritos === 3000);
    const nomes = topo.map((l) => l.nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })));
  });
});

describe("resumirTurma", () => {
  const linha = (extra: Partial<LinhaTurma>): LinhaTurma => ({
    alunoId: "x",
    nome: "x",
    usuario: "x",
    iniciou: false,
    salvos: 0,
    fontesConfiaveis: 0,
    inscritos: 0,
    rankingDesbloqueado: false,
    credibilidadeAdicionada: false,
    concluidoEm: null,
    ...extra,
  });

  test("distribuição só entre concluídos; média arredondada", () => {
    const resumo = resumirTurma([
      linha({}),
      linha({ iniciou: true, salvos: 2, fontesConfiaveis: 2, inscritos: 1100 }),
      linha({ iniciou: true, salvos: 3, fontesConfiaveis: 3, inscritos: 150, rankingDesbloqueado: true }),
      linha({ iniciou: true, salvos: 3, fontesConfiaveis: 1, inscritos: 2050, rankingDesbloqueado: true, credibilidadeAdicionada: true, concluidoEm: "2026-08-24T12:00:00Z" }),
      linha({ iniciou: true, salvos: 3, fontesConfiaveis: 2, inscritos: 1100, rankingDesbloqueado: true, credibilidadeAdicionada: true, concluidoEm: "2026-08-24T12:00:00Z" }),
    ]);
    expect(resumo).toEqual({
      total: 5,
      iniciaram: 4,
      desbloquearamRanking: 3,
      concluiram: 2,
      distribuicaoFontes: { "0": 0, "1": 1, "2": 1, "3": 0 },
      mediaFontesConcluidos: 1.5,
    });
  });

  test("sem concluídos a média é null", () => {
    expect(resumirTurma([linha({})]).mediaFontesConcluidos).toBeNull();
  });
});

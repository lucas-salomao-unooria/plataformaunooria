import { describe, expect, test } from "vitest";
import {
  FOTOS_DO_POST,
  areaComMaisOcultos,
  casaComABusca,
  classificarBusca,
  comCerquilha,
  contagemSemCurtidas,
  curtidosNaTela,
  esperaAteEncerrar,
  estandesDoFeed,
  gateMudou,
  iniciais,
  laminasDoPost,
  lerGesto,
  nomeDaConta,
  normalizar,
  ocultosDaArea,
  opcoesDaTroca,
  ordemValida,
  protocoloDoVoto,
  tocarNoBloco,
  vozDaTela,
} from "./regras";
import type { Categoria, PostPublico, ProjetoDaGaleria } from "./tipos";

const post = (projetoId: string, tipo: PostPublico["tipo"] = "apresentacao"): PostPublico => ({
  id: `${projetoId}:${tipo}`,
  projetoId,
  tipo,
  area: `area_${projetoId.charAt(5)}` as PostPublico["area"],
  titulo: `Projeto ${projetoId}`,
  escola: "Escola Estadual Centro",
  perfil: "@estande.centro",
  texto: "Uma legenda.",
  legenda: "Uma legenda. Com duas frases.",
  bastidor: "O protótipo em teste na bancada.",
  hashtags: ["#robotica"],
  imagem: { url: null, alt: "Foto do estande." },
});

const CATEGORIAS: Categoria[] = [
  { area: "area_a", nome: "Robótica", hashtag: "#robotica" },
  { area: "area_b", nome: "Meio Ambiente", hashtag: "#meioambiente" },
  { area: "area_c", nome: "Artes", hashtag: "#artes" },
  { area: "area_d", nome: "Saúde", hashtag: "#saude" },
];

const projeto = (id: string, titulo: string, exibido = false): ProjetoDaGaleria => ({
  id,
  area: `area_${id.charAt(5)}` as ProjetoDaGaleria["area"],
  titulo,
  escola: "Escola Municipal Norte",
  perfil: "@estande.norte",
  legenda: "Legenda do estande.",
  resumo: "Resumo técnico do estande.",
  hashtags: [],
  imagem: { url: null, alt: "" },
  exibidoNoSeuFeed: exibido,
});

describe("o carrossel do post: três fotos e a lâmina do bastidor (0.5.0)", () => {
  test("com bastidor, quatro lâminas; sem texto, só as fotos", () => {
    expect(laminasDoPost(post("proj-a10"))).toBe(FOTOS_DO_POST + 1);
    expect(laminasDoPost({ bastidor: "   " })).toBe(FOTOS_DO_POST);
  });
});

describe("a galeria por área e o contraste sem as curtidas (0.5.0)", () => {
  const porArea = [
    { area: "area_a" as const, vistos: 7, total: 10 },
    { area: "area_b" as const, vistos: 1, total: 10 },
    { area: "area_c" as const, vistos: 1, total: 10 },
    { area: "area_d" as const, vistos: 1, total: 10 },
  ];

  test("a grade abre na área que mais ficou fora (empate: a ordem das áreas)", () => {
    expect(areaComMaisOcultos(porArea)).toBe("area_b");
    expect(areaComMaisOcultos([{ area: "area_c", vistos: 0, total: 4 }, { area: "area_d", vistos: 0, total: 4 }])).toBe(
      "area_c",
    );
    expect(areaComMaisOcultos([])).toBeNull();
  });

  test("o contrafactual é CONTADO por área: a lista vem da api, a tela não escolhe", () => {
    expect(
      contagemSemCurtidas([
        { area: "area_a", posts: ["proj-a1", "proj-a2", "proj-a10"] },
        { area: "area_b", posts: ["proj-b1", "proj-b2"] },
        { area: "area_c", posts: ["proj-c1", "proj-c2", "proj-c3"] },
        { area: "area_d", posts: ["proj-d1", "proj-d2"] },
      ]),
    ).toEqual([
      { area: "area_a", posts: 3 },
      { area: "area_b", posts: 2 },
      { area: "area_c", posts: 3 },
      { area: "area_d", posts: 2 },
    ]);
  });

  test("a grade mostra só os OCULTOS da área; a troca, a área inteira menos o voto", () => {
    const projetos = [
      projeto("proj-a9", "A9"),
      projeto("proj-a10", "A10"),
      projeto("proj-b1", "B1"),
      projeto("proj-a1", "A1", true),
    ];
    expect(ocultosDaArea(projetos, "area_a").map((p) => p.id)).toEqual(["proj-a9", "proj-a10"]);
    expect(opcoesDaTroca(projetos, "area_a", "proj-a1").map((p) => p.id)).toEqual(["proj-a9", "proj-a10"]);
    expect(opcoesDaTroca(projetos, "area_a", null)).toHaveLength(3);
  });
});

describe("a cédula oferece os estandes que apareceram no feed", () => {
  test("na ordem em que apareceram, sem repetir os formatos da saturação (o feed gravado de uma sessão 2.0.0)", () => {
    const feed = [post("proj-a1"), post("proj-b2"), post("proj-a1", "bastidor"), post("proj-a1", "depoimento"), post("proj-c3")];
    expect(estandesDoFeed(feed).map((e) => e.projetoId)).toEqual(["proj-a1", "proj-b2", "proj-c3"]);
  });
});

describe("as curtidas na tela", () => {
  test("as pendentes vencem as do servidor, nos dois sentidos", () => {
    const pendentes = new Map([
      ["proj-a1:apresentacao", false],
      ["proj-b2:apresentacao", true],
    ]);
    expect([...curtidosNaTela(["proj-a1:apresentacao", "proj-c3:apresentacao"], pendentes)].sort()).toEqual([
      "proj-b2:apresentacao",
      "proj-c3:apresentacao",
    ]);
  });
});

describe("o gate", () => {
  const sessao = { etapa: "exploracao" as const, rodada: 1, pacoteId: "p" };
  test("muda com a etapa, a rodada ou a atividade — e só", () => {
    expect(gateMudou(sessao, { etapa: "exploracao", rodada: 1, pacoteId: "p" })).toBe(false);
    expect(gateMudou(sessao, { etapa: "galeria", rodada: 1, pacoteId: "p" })).toBe(true);
    expect(gateMudou(sessao, { etapa: "exploracao", rodada: 2, pacoteId: "p" })).toBe(true);
    expect(gateMudou(sessao, { etapa: "exploracao", rodada: 1, pacoteId: "q" })).toBe(true);
  });
});

describe("a busca da galeria", () => {
  const projetos = [projeto("proj-a1", "Braço robótico de papelão"), projeto("proj-b1", "Horta com sensor"), projeto("proj-c1", "Mural de luz")];

  test("normaliza caixa, acento e cerquilha", () => {
    expect(normalizar("  #Saúde  Escolar ")).toBe("saude escolar");
    expect(comCerquilha("##artes")).toBe("#artes");
  });

  test("casa título, escola, legenda e o nome da área", () => {
    expect(casaComABusca(projetos[0]!, "papelao", CATEGORIAS)).toBe(true);
    expect(casaComABusca(projetos[1]!, "meio ambiente", CATEGORIAS)).toBe(true);
    expect(casaComABusca(projetos[2]!, "papelão", CATEGORIAS)).toBe(false);
  });

  test("a hashtag (com ou sem #) ou o nome de uma área é busca por hashtag", () => {
    expect(classificarBusca("#robotica", CATEGORIAS, projetos)).toEqual({ busca: "hashtag", area: "area_a" });
    expect(classificarBusca("Saúde", CATEGORIAS, projetos)).toEqual({ busca: "hashtag", area: "area_d" });
  });

  test("texto livre leva a área só quando todos os resultados são dela", () => {
    expect(classificarBusca("sensor", CATEGORIAS, projetos)).toEqual({ busca: "texto", area: "area_b" });
    expect(classificarBusca("escola", CATEGORIAS, projetos)).toEqual({ busca: "texto", area: null });
    expect(classificarBusca("xyz", CATEGORIAS, projetos)).toEqual({ busca: "texto", area: null });
  });

  test("busca vazia não é busca — e o texto nunca está no que vai à api", () => {
    expect(classificarBusca("   ", CATEGORIAS, projetos)).toBeNull();
    const acao = classificarBusca("meu texto secreto", CATEGORIAS, projetos);
    expect(JSON.stringify(acao)).not.toContain("secreto");
  });
});

describe("a calha da cadeia", () => {
  test("tocar na bandeja encaixa na próxima vaga; tocar na vaga devolve", () => {
    let ordem: string[] = [];
    ordem = tocarNoBloco(ordem, "bl-aaa", 4);
    ordem = tocarNoBloco(ordem, "bl-bbb", 4);
    expect(ordem).toEqual(["bl-aaa", "bl-bbb"]);
    expect(tocarNoBloco(ordem, "bl-aaa", 4)).toEqual(["bl-bbb"]);
  });

  test("calha cheia não aceita mais", () => {
    expect(tocarNoBloco(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  test("a ordem guardada só vale para os ids desta rodada", () => {
    expect(ordemValida(["bl-old", "bl-aaa", "bl-aaa", "bl-bbb"], ["bl-aaa", "bl-bbb"], 4)).toEqual(["bl-aaa", "bl-bbb"]);
  });
});

describe("pequenas coisas da tela", () => {
  test("a conta sem @ e as iniciais", () => {
    expect(nomeDaConta("@comissao_juri")).toBe("comissao_juri");
    expect(iniciais("@comissao_juri")).toBe("CJ");
    expect(iniciais("@robos")).toBe("RO");
  });

  test("o protocolo do lacre é estável e muda com o voto", () => {
    const a = protocoloDoVoto("pacote", 1, "proj-a1");
    expect(a).toMatch(/^PR-\d{4}$/);
    expect(protocoloDoVoto("pacote", 1, "proj-a1")).toBe(a);
    expect(protocoloDoVoto("pacote", 1, "proj-b2")).not.toBe(a);
  });

  test("a cadeia e o caso Mariana falam pela escola (PRD §10.1)", () => {
    expect(vozDaTela("cadeia")).toBe("escola");
    expect(vozDaTela("mariana")).toBe("escola");
    for (const t of ["credencial", "feed", "espera", "galeria", "avancando", "enquetes", "fim"] as const) {
      expect(vozDaTela(t)).toBe("clone");
    }
  });
});

describe("o relógio dos 8 minutos é do servidor", () => {
  test("sem 1ª rolagem não há relógio; depois, espera até o fim mais 1 s, nunca menos de 1 s", () => {
    expect(esperaAteEncerrar(null, 0)).toBeNull();
    expect(esperaAteEncerrar("lixo", 0)).toBeNull();
    const agora = Date.parse("2026-10-10T10:00:00Z");
    expect(esperaAteEncerrar("2026-10-10T10:08:00Z", agora)).toBe(8 * 60_000 + 1_000);
    expect(esperaAteEncerrar("2026-10-10T09:00:00Z", agora)).toBe(1_000);
  });
});

describe("o gesto na mídia do post (dedo e mouse)", () => {
  test("arrastar 40 px ou mais para a esquerda mostra a próxima lâmina; para a direita, a anterior", () => {
    expect(lerGesto(-120, 4)).toBe("proxima");
    expect(lerGesto(-40, 0)).toBe("proxima");
    expect(lerGesto(90, -6)).toBe("anterior");
  });

  test("andar pouco é toque (o toque duplo curte); rolar ou arrastar torto não é nada", () => {
    expect(lerGesto(3, -2)).toBe("toque");
    expect(lerGesto(0, 0)).toBe("toque");
    expect(lerGesto(-30, 2)).toBe("nada");
    expect(lerGesto(-80, 60)).toBe("nada");
    expect(lerGesto(2, 120)).toBe("nada");
  });
});

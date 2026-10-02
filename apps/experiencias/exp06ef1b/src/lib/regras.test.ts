import { describe, expect, test } from "vitest";
import {
  casaComABusca,
  classificarBusca,
  comCerquilha,
  curtidosNaTela,
  estandesDoFeed,
  gateMudou,
  iniciais,
  nomeDaConta,
  normalizar,
  ordemValida,
  protocoloDoVoto,
  tocarNoBloco,
  vozDaTela,
} from "./regras";
import type { Categoria, PostPublico, ProjetoDaGaleria } from "./tipos";

const post = (projetoId: string, tipo: "apresentacao" | "bastidor" = "apresentacao"): PostPublico => ({
  id: `${projetoId}:${tipo}`,
  projetoId,
  tipo,
  area: `area_${projetoId.charAt(5)}` as PostPublico["area"],
  titulo: `Projeto ${projetoId}`,
  escola: "Escola Estadual Centro",
  perfil: "@estande.centro",
  texto: "Uma legenda.",
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
  hashtags: [],
  imagem: { url: null, alt: "" },
  exibidoNoSeuFeed: exibido,
});

describe("a cédula oferece os estandes que apareceram no feed", () => {
  test("na ordem em que apareceram, sem repetir o bastidor", () => {
    const feed = [post("proj-a1"), post("proj-b2"), post("proj-a1", "bastidor"), post("proj-c3")];
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

describe("a calha dos pacotes e da cadeia", () => {
  test("tocar na bandeja encaixa na próxima vaga; tocar na vaga devolve", () => {
    let ordem: string[] = [];
    ordem = tocarNoBloco(ordem, "pk-aaa", 4);
    ordem = tocarNoBloco(ordem, "pk-bbb", 4);
    expect(ordem).toEqual(["pk-aaa", "pk-bbb"]);
    expect(tocarNoBloco(ordem, "pk-aaa", 4)).toEqual(["pk-bbb"]);
  });

  test("calha cheia não aceita mais", () => {
    expect(tocarNoBloco(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  test("a ordem guardada só vale para os ids desta rodada", () => {
    expect(ordemValida(["pk-old", "pk-aaa", "pk-aaa", "pk-bbb"], ["pk-aaa", "pk-bbb"], 4)).toEqual(["pk-aaa", "pk-bbb"]);
  });
});

describe("pequenas coisas da tela", () => {
  test("a conta sem @ e as iniciais", () => {
    expect(nomeDaConta("@comissao.mostra")).toBe("comissao.mostra");
    expect(iniciais("@comissao.mostra")).toBe("CM");
    expect(iniciais("@robos")).toBe("RO");
  });

  test("o protocolo do lacre é estável e muda com o voto", () => {
    const a = protocoloDoVoto("pacote", 1, "proj-a1");
    expect(a).toMatch(/^PR-\d{4}$/);
    expect(protocoloDoVoto("pacote", 1, "proj-a1")).toBe(a);
    expect(protocoloDoVoto("pacote", 1, "proj-b2")).not.toBe(a);
  });

  test("só os pacotes e a cadeia falam pela escola", () => {
    expect(vozDaTela("pacotes")).toBe("escola");
    expect(vozDaTela("cadeia")).toBe("escola");
    for (const t of ["credencial", "feed", "espera", "galeria", "mariana", "enquetes", "fim"] as const) {
      expect(vozDaTela(t)).toBe("clone");
    }
  });
});

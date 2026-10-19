import { describe, expect, test } from "vitest";
import {
  VISTA_INICIAL,
  alternarSelecao,
  dividirLegenda,
  estiloDaImagem,
  tomDoRemetente,
  gateDoPasso,
  gateMudou,
  horarioDaMensagem,
  iniciais,
  acoesDaRegra,
  cartaoCompleto,
  mensagensDoMural,
  mesclarSessao,
  outrosParticipantes,
  partesDaFrase,
  percentualDaBarra,
  regraMontada,
  telaDe,
  type Vista,
} from "./regras";
import type { Estado, Gate, MensagemPublica, Passo, Revelacao, Sessao } from "./tipos";

const REVELACAO: Revelacao = {
  mensagens: [{ id: "msg_1", veracidade: "verdadeira", tom: "emocional" }],
  motivo: "urgencia",
  callback: "…",
  turma: { unidades: 10, falsaNeutra: 40, verdadeiraEmocionalDescartada: 55 },
};

function estado(passo: Passo, extra: Partial<Estado> = {}): Estado {
  return {
    passo,
    fase: "triagem",
    preparada: true,
    atividade: { pacoteId: "p1", rodada: 1 },
    selecao: [],
    confirmado: false,
    motivo: null,
    concluido: false,
    revelacao: null,
    cartao: null,
    regra: null,
    ...extra,
  };
}

function vista(extra: Partial<Vista> = {}): Vista {
  return { ...VISTA_INICIAL, ...extra };
}

function sessao(passo: Passo, extra: Partial<Sessao> = {}): Sessao {
  return {
    ...estado(passo),
    pacote: null,
    textos: {
      nina: { convite: null, encerramento: "", cartao: "", tio: "" },
    },
    opcoes: { motivos: [], condicoes: [], acoes: [], previsoes: [] },
    limites: { encaminhamentos: 3, testes: 5 },
    ...extra,
  };
}

describe("telaDe — a tela que o passo pede", () => {
  test("sem pacote aprovado, é a espera do preparo em QUALQUER passo", () => {
    for (const passo of ["abertura", "grupo", "espera", "cartao", "regra", "concluida"] as Passo[]) {
      expect(telaDe(estado(passo, { preparada: false }), vista())).toBe("preparo");
    }
  });

  test("abertura: a lista, e o chat da Nina depois do toque", () => {
    expect(telaDe(estado("abertura"), vista())).toBe("lista");
    expect(telaDe(estado("abertura"), vista({ ninaAberta: true }))).toBe("nina");
  });

  test("grupo: o grupo e o Mural são vistas da MESMA etapa — um F5 volta ao grupo", () => {
    expect(telaDe(estado("grupo"), vista())).toBe("grupo");
    expect(telaDe(estado("grupo"), vista({ muralAberto: true }))).toBe("mural");
  });

  test("as etapas do Mural seguem o passo do servidor", () => {
    expect(telaDe(estado("enquete"), vista())).toBe("enquete");
    expect(telaDe(estado("espera"), vista())).toBe("espera");
    expect(telaDe(estado("revelacao", { revelacao: REVELACAO }), vista())).toBe("revelacao");
    expect(telaDe(estado("sintese", { revelacao: REVELACAO }), vista())).toBe("sintese");
  });

  test("na reflexão: o cartão pendente vem antes da regra — o servidor manda, a tela segue", () => {
    expect(telaDe(estado("cartao", { revelacao: REVELACAO }), vista())).toBe("cartao");
    expect(telaDe(estado("regra", { revelacao: REVELACAO }), vista())).toBe("regra");
  });

  test("concluída é a casca 'Missão Concluída', também depois de um F5", () => {
    expect(telaDe(estado("concluida"), vista())).toBe("concluida");
  });

  test("o gate de telemetria de cada passo que o professor abre", () => {
    expect(gateDoPasso("revelacao")).toBe("revelacao");
    expect(gateDoPasso("sintese")).toBe("sintese");
    /* O cartão pendente e a regra são a reflexão: o gate que o professor abriu. */
    expect(gateDoPasso("cartao")).toBe("reflexao");
    expect(gateDoPasso("regra")).toBe("reflexao");
    expect(gateDoPasso("grupo")).toBeNull();
  });
});

describe("o polling", () => {
  const gate = (extra: Partial<Gate> = {}): Gate => ({
    fase: "triagem",
    passo: "grupo",
    preparada: true,
    atividade: { pacoteId: "p1", rodada: 1 },
    agora: "2026-09-25T12:00:00.000Z",
    ...extra,
  });

  test("nada mudou: não relê", () => {
    expect(gateMudou(gate(), estado("grupo"))).toBe(false);
  });

  test("a FASE mudou com o passo igual (a criança ainda no grupo) — relê, para a revelação vir junto quando ela votar", () => {
    expect(gateMudou(gate({ fase: "revelacao" }), estado("grupo"))).toBe(true);
  });

  test("o professor aprovou o pacote: a espera do preparo sai sozinha", () => {
    expect(gateMudou(gate({ preparada: true }), estado("abertura", { preparada: false }))).toBe(true);
  });

  test("rodada nova (Zerar a turma) ou pacote novo: relê mesmo com o passo coincidindo", () => {
    expect(gateMudou(gate({ atividade: { pacoteId: "p1", rodada: 2 } }), estado("grupo"))).toBe(true);
    expect(gateMudou(gate({ atividade: { pacoteId: "p2", rodada: 1 } }), estado("grupo"))).toBe(true);
  });

  test("a seleção da TELA vence a relida enquanto os dois estão no grupo (o PUT pode estar em voo)", () => {
    const atual = sessao("grupo", { selecao: ["msg_1", "msg_2"] });
    const nova = sessao("grupo", { selecao: ["msg_1"], fase: "revelacao" });
    const mesclada = mesclarSessao(atual, nova);
    expect(mesclada.selecao).toEqual(["msg_1", "msg_2"]);
    expect(mesclada.fase).toBe("revelacao");
  });

  test("fora do grupo, ou com atividade nova, vale a relida inteira", () => {
    const atual = sessao("grupo", { selecao: ["msg_1", "msg_2", "msg_3"] });
    expect(mesclarSessao(atual, sessao("enquete", { selecao: ["msg_1", "msg_2", "msg_3"] })).passo).toBe("enquete");
    const outraRodada = sessao("abertura", { atividade: { pacoteId: "p1", rodada: 2 }, selecao: [] });
    expect(mesclarSessao(atual, outraRodada).selecao).toEqual([]);
  });
});

describe("a seleção do Mural", () => {
  test("põe, tira e recusa a quarta", () => {
    let s: string[] = [];
    for (const id of ["a", "b", "c"]) {
      const r = alternarSelecao(s, id, 3);
      expect(r.ok && r.entrou).toBe(true);
      if (r.ok) s = r.selecao;
    }
    expect(alternarSelecao(s, "d", 3)).toEqual({ ok: false, motivo: "limite" });
    const tirou = alternarSelecao(s, "b", 3);
    expect(tirou).toEqual({ ok: true, selecao: ["a", "c"], entrou: false });
  });

  test("tirar uma já escolhida funciona mesmo com 3/3 (é o caminho para trocar)", () => {
    expect(alternarSelecao(["a", "b", "c"], "a", 3)).toEqual({ ok: true, selecao: ["b", "c"], entrou: false });
  });

  test("o Mural mostra na ordem do GRUPO, não na do toque", () => {
    const m = (id: string): MensagemPublica => ({ id, remetente: "x", tipo: "texto", texto: id });
    const grupo = [m("msg_1"), m("msg_2"), m("msg_3"), m("msg_4")];
    expect(mensagensDoMural(grupo, ["msg_4", "msg_1", "msg_3"]).map((x) => x.id)).toEqual(["msg_1", "msg_3", "msg_4"]);
  });

  test("'você e mais N participantes' não conta a própria criança", () => {
    expect(outrosParticipantes(25)).toBe(24);
    expect(outrosParticipantes(0)).toBe(0);
  });
});

describe("o cartão de frases", () => {
  const frases = ["f1", "f2", "f3", "f4", "f5", "f6"].map((id) => ({ id, operador: "E" as const, texto: id }));

  test("só envia com as seis respondidas: não existe cartão pela metade", () => {
    const cinco = Object.fromEntries(frases.slice(0, 5).map((f) => [f.id, "sim" as const]));
    expect(cartaoCompleto(frases, cinco)).toBe(false);
    expect(cartaoCompleto(frases, { ...cinco, f6: "nao" })).toBe(true);
    expect(cartaoCompleto([], {})).toBe(false);
  });

  test("o operador ISOLADO, em maiúsculas, é destacado — e só ele", () => {
    const partes = partesDaFrase("A mensagem de Ana “Então vamos” é verdadeira E neutra.");
    expect(partes.filter((p) => p.operador).map((p) => p.texto)).toEqual(["E"]);
    expect(partes.map((p) => p.texto).join("")).toBe("A mensagem de Ana “Então vamos” é verdadeira E neutra.");
    expect(partesDaFrase("A mensagem de Bia “Oi” NÃO é falsa.").filter((p) => p.operador).map((p) => p.texto)).toEqual([
      "NÃO",
    ]);
    expect(partesDaFrase("A mensagem de Caio “Oi” é falsa OU emocional.").filter((p) => p.operador).map((p) => p.texto)).toEqual([
      "OU",
    ]);
  });
});

describe("a regra do tio", () => {
  test("montada = condição e a primeira ação (a segunda é opcional)", () => {
    expect(regraMontada(null, "a")).toBe(false);
    expect(regraMontada("c", null)).toBe(false);
    expect(regraMontada("c", "a")).toBe(true);
  });

  test("as ações em ordem; a segunda só se escolhida e diferente da primeira", () => {
    expect(acoesDaRegra("a", null)).toEqual(["a"]);
    expect(acoesDaRegra("a", "b")).toEqual(["a", "b"]);
    expect(acoesDaRegra("a", "a")).toEqual(["a"]);
  });
});

describe("o desenho das mídias", () => {
  test("'Nome do site: manchete' vira domínio e título; sem os dois-pontos, é tudo corpo", () => {
    expect(dividirLegenda("Portal Notícias Locais: Prefeitura suspende visitas")).toEqual({
      rotulo: "Portal Notícias Locais",
      corpo: "Prefeitura suspende visitas",
    });
    expect(dividirLegenda("Aviso sem rótulo nenhum")).toEqual({ rotulo: null, corpo: "Aviso sem rótulo nenhum" });
    expect(dividirLegenda(`${"x".repeat(80)}: resto`).rotulo).toBeNull();
  });

  test("a barra fica entre 0 e 100, inteira, venha o que vier", () => {
    expect(percentualDaBarra(54.6)).toBe(55);
    expect(percentualDaBarra(-3)).toBe(0);
    expect(percentualDaBarra(140)).toBe(100);
    expect(percentualDaBarra(Number.NaN)).toBe(0);
  });

  test("iniciais e horários", () => {
    expect(iniciais("Turma 5ºB")).toBe("T5");
    expect(iniciais("Mural da Turma")).toBe("MT");
    expect(horarioDaMensagem(0)).toBe("09:12");
    expect(horarioDaMensagem(99)).toBe("09:30");
  });
});

describe("o desenho de cada imagem do grupo", () => {
  const mensagem = (id: string, tipo: MensagemPublica["tipo"], texto: string) =>
    ({ id, tipo, texto, remetente: "Ana" }) as MensagemPublica;
  const pacote = (a: string, b: string) => [
    mensagem("msg_1", "texto", "oi"),
    mensagem("msg_2", "imagem", a),
    mensagem("msg_3", "link", "x"),
    mensagem("msg_4", "imagem", b),
  ];

  test("as duas imagens de um pacote nunca saem com o mesmo desenho", () => {
    for (const [a, b] of [["Aviso", "Bilhete"], ["Comunicado da direção", "Cartaz da feira"], ["", "z"], ["museu", "ônibus"]]) {
      const p = pacote(a!, b!);
      expect(estiloDaImagem(p, "msg_2")).not.toBe(estiloDaImagem(p, "msg_4"));
    }
  });

  test("é estável: o grupo, o Mural e a imagem aberta concordam", () => {
    const p = pacote("Aviso", "Bilhete");
    expect(estiloDaImagem(p, "msg_4")).toBe(estiloDaImagem([...p], "msg_4"));
  });

  test("o par muda de pacote para pacote (o desenho não vira pista)", () => {
    const pares = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((t) => estiloDaImagem(pacote(t, "fixo"), "msg_2")),
    );
    expect(pares.size).toBeGreaterThan(1);
  });
});

describe("a cor do nome de cada colega", () => {
  test("estável pelo nome, de 2 a 8 (o 1 é o acento)", () => {
    expect(tomDoRemetente("Pedro Henrique")).toBe(tomDoRemetente(" pedro henrique "));
    for (const nome of ["Ana", "Bia", "Caio", "Duda", "Enzo", "Fabi", "Gabi", "Heitor"]) {
      const tom = tomDoRemetente(nome);
      expect(tom).toBeGreaterThanOrEqual(2);
      expect(tom).toBeLessThanOrEqual(8);
    }
  });

  test("nomes diferentes espalham as cores (o grupo não fica de uma cor só)", () => {
    const tons = new Set(["Ana", "Bia", "Caio", "Duda", "Enzo", "Fabi", "Gabi", "Heitor"].map(tomDoRemetente));
    expect(tons.size).toBeGreaterThanOrEqual(4);
  });
});

import { describe, expect, test } from "vitest";
import {
  VISTA_INICIAL,
  alternarSelecao,
  dividirLegenda,
  gateDoPasso,
  gateMudou,
  horarioDaMensagem,
  iniciais,
  marcaComoVista,
  mensagensDoMural,
  mesclarSessao,
  outrosParticipantes,
  percentualDaBarra,
  perguntaDaVez,
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
      nina: { convite: null, encerramento: "" },
      perguntas: [],
    },
    opcoes: { motivos: [] },
    limites: { encaminhamentos: 3 },
    ...extra,
  };
}

describe("telaDe — a tela que o passo pede", () => {
  test("sem pacote aprovado, é a espera do preparo em QUALQUER passo", () => {
    for (const passo of ["abertura", "grupo", "espera", "perguntas", "concluida"] as Passo[]) {
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

  test("quem votou ATRASADO, com a turma já nas perguntas, vê os crachás antes do chat da Nina", () => {
    const atrasado = estado("perguntas", { revelacao: REVELACAO });
    expect(telaDe(atrasado, vista())).toBe("revelacao-atrasada");
    expect(telaDe(atrasado, vista({ viuRevelacao: true }))).toBe("perguntas");
  });

  test("as perguntas sem revelação no estado vão direto ao chat da Nina (nada a mostrar antes)", () => {
    expect(telaDe(estado("perguntas"), vista())).toBe("perguntas");
  });

  test("concluída: a despedida da Nina segura a casca; um F5 cai direto em 'Missão Concluída'", () => {
    expect(telaDe(estado("concluida"), vista({ segurandoDespedida: true }))).toBe("perguntas");
    expect(telaDe(estado("concluida"), vista())).toBe("concluida");
  });

  test("só revelação e síntese marcam os crachás como vistos — a atrasada espera o 'Continuar'", () => {
    expect(marcaComoVista("revelacao")).toBe(true);
    expect(marcaComoVista("sintese")).toBe(true);
    expect(marcaComoVista("revelacao-atrasada")).toBe(false);
    expect(marcaComoVista("perguntas")).toBe(false);
  });

  test("o gate de telemetria de cada passo que o professor abre", () => {
    expect(gateDoPasso("revelacao")).toBe("revelacao");
    expect(gateDoPasso("sintese")).toBe("sintese");
    /* As perguntas SÃO a reflexão (ADR-145): o gate que o professor abriu. */
    expect(gateDoPasso("perguntas")).toBe("reflexao");
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

describe("as perguntas da Nina", () => {
  test("a da vez é a primeira sem resposta nesta aba", () => {
    expect(perguntaDaVez(["p1", "p2"], {})).toBe("p1");
    expect(perguntaDaVez(["p1", "p2"], { p1: "A1" })).toBe("p2");
    expect(perguntaDaVez(["p1", "p2"], { p1: "A1", p2: "B3" })).toBeNull();
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

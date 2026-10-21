import { describe, expect, test } from "vitest";
import {
  abrirNaSimulacao,
  adicionar,
  blocosNasVagas,
  chaveDasVagas,
  completas,
  corpoDaChave,
  corpoDaSimulacao,
  decidirNaSimulacao,
  esperaDaTentativa,
  esvaziar,
  gateMudou,
  marcarLado,
  marcarNaSimulacao,
  marcarRepeticao,
  marcarSeFalhar,
  MATERIA_NOVA,
  materiaValida,
  montagemValida,
  montagemVazia,
  pistasDoBoatoValidas,
  porNaVaga,
  preenchidas,
  proximaVagaLivre,
  registrarPistaDoBoato,
  retirar,
  segundosDesde,
  TELA_DO_PASSO,
  tirarDaVaga,
  VAGAS_VAZIAS,
  vagasValidas,
  type MontagemDaChave,
} from "./regras";
import type { GatePublico } from "./tipos";

describe("as vagas da página", () => {
  test("adicionar vai para a PRIMEIRA vaga vazia", () => {
    const um = adicionar(VAGAS_VAZIAS, "n3");
    expect(um).toEqual({ vagas: ["n3", null, null], resultado: "adicionada" });
    expect(adicionar(["n1", null, "n2"], "n4").vagas).toEqual(["n1", "n4", "n2"]);
  });

  test("a quarta não entra, e a repetida também não", () => {
    expect(adicionar(["n1", "n2", "n3"], "n4")).toEqual({ vagas: ["n1", "n2", "n3"], resultado: "cheia" });
    expect(adicionar(["n1", null, null], "n1").resultado).toBe("repetida");
  });

  test("Trocar Matéria esvazia a vaga, e a próxima escolha volta para ELA (a manchete continua manchete)", () => {
    const sem = esvaziar(["n1", "n2", "n3"], 0);
    expect(sem).toEqual([null, "n2", "n3"]);
    expect(adicionar(sem, "n8").vagas).toEqual(["n8", "n2", "n3"]);
    expect(retirar(["n1", "n2", "n3"], "n2")).toEqual(["n1", null, "n3"]);
  });

  test("completas só com as três, na ordem — é o `slots` do contrato", () => {
    expect(completas(["n1", null, "n3"])).toBeNull();
    expect(completas(["n2", "n1", "n3"])).toEqual(["n2", "n1", "n3"]);
    expect(preenchidas(["n1", null, "n3"])).toBe(2);
    expect(chaveDasVagas(["n2", "n1", "n3"])).toBe("n2|n1|n3");
  });

  test("a memória da aba só volta se for desta mesa, com três posições e sem repetição", () => {
    const ids = new Set(["n1", "n2", "n3"]);
    expect(vagasValidas(["n1", null, "n2"], ids)).toEqual(["n1", null, "n2"]);
    expect(vagasValidas(["n1", "n1", null], ids)).toBeNull();
    expect(vagasValidas(["n9", null, null], ids)).toBeNull();
    expect(vagasValidas(["n1", null], ids)).toBeNull();
    expect(vagasValidas("n1", ids)).toBeNull();
  });
});

describe("a Chave em montagem (quem corrige é a api — aqui nada corrige)", () => {
  /** Uma Chave completa: três blocos, os dois cartões de cada um, o "se falhar" e a repetição. */
  function completa(): MontagemDaChave {
    let m = montagemVazia(3);
    (["data", "foto", "autoria"] as const).forEach((b, i) => {
      m = porNaVaga(m, i, b);
      m = marcarLado(marcarLado(m, i, 0, "aprova"), i, 1, "reprova");
      m = marcarSeFalhar(m, i, i === 1 ? "seguir" : "parar");
    });
    return marcarRepeticao(m, "so_a_primeira");
  }

  test("o bloco vai para a vaga vazia escolhida; vaga cheia e bloco repetido não mudam nada", () => {
    let m = porNaVaga(montagemVazia(3), 1, "fonte");
    expect(m.vagas.map((v) => v.bloco)).toEqual([null, "fonte", null]);
    expect(proximaVagaLivre(m)).toBe(0);
    expect(porNaVaga(m, 1, "data")).toBe(m);
    expect(porNaVaga(m, 0, "fonte")).toBe(m);
    m = porNaVaga(m, 0, "foto");
    expect([...blocosNasVagas(m)].sort()).toEqual(["fonte", "foto"]);
  });

  test("tocar na vaga cheia devolve o bloco e apaga as escolhas dele", () => {
    let m = porNaVaga(montagemVazia(3), 0, "fonte");
    m = marcarSeFalhar(marcarLado(m, 0, 1, "reprova"), 0, "parar");
    m = tirarDaVaga(m, 0);
    expect(m.vagas[0]).toEqual({ bloco: null, lados: [null, null], seFalhar: null });
  });

  test("o lado vai pela posição CANÔNICA do cartão, não pela ordem da tela", () => {
    const m = marcarLado(porNaVaga(montagemVazia(3), 0, "fonte"), 0, 1, "aprova");
    expect(m.vagas[0]?.lados).toEqual([null, "aprova"]);
    expect(marcarLado(montagemVazia(3), 0, 0, "aprova").vagas[0]?.lados).toEqual([null, null]);
  });

  test("o Pronto só acende com TUDO escolhido — e a Chave errada também é uma Chave", () => {
    expect(corpoDaChave(montagemVazia(3))).toBeNull();
    const m = completa();
    expect(corpoDaChave(m)).toEqual({
      vagas: [
        { bloco: "data", lados: ["aprova", "reprova"], seFalhar: "parar" },
        { bloco: "foto", lados: ["aprova", "reprova"], seFalhar: "seguir" },
        { bloco: "autoria", lados: ["aprova", "reprova"], seFalhar: "parar" },
      ],
      repeticao: "so_a_primeira",
    });
    expect(corpoDaChave({ ...m, repeticao: null })).toBeNull();
    expect(corpoDaChave(marcarSeFalhar(tirarDaVaga(m, 2), 2, "parar"))).toBeNull();
    const semUmLado = { ...m, vagas: m.vagas.map((v, i) => (i === 0 ? { ...v, lados: ["aprova", null] as const } : v)) };
    expect(corpoDaChave(semUmLado)).toBeNull();
  });

  test("a memória da aba só devolve uma montagem desta bandeja", () => {
    const blocos = new Set(["fonte", "data", "autoria", "foto", "urgencia", "compartilhada"]);
    const m = completa();
    expect(montagemValida(JSON.parse(JSON.stringify(m)), blocos, 3)).toEqual(m);
    expect(montagemValida({ vagas: [{ bloco: "nada" }, { bloco: null }, { bloco: null }] }, blocos, 3)).toBeNull();
    expect(montagemValida({ vagas: [{ bloco: "fonte" }, { bloco: "fonte" }, { bloco: null }] }, blocos, 3)).toBeNull();
    expect(montagemValida({ vagas: [] }, blocos, 3)).toBeNull();
    expect(montagemValida({ vagas: [{ bloco: "fonte", lados: ["x", "reprova"], seFalhar: "y" }, { bloco: null }, { bloco: null }] }, blocos, 3))
      .toEqual({ vagas: [{ bloco: "fonte", lados: [null, "reprova"], seFalhar: null }, ...montagemVazia(3).vagas.slice(1)], repeticao: null });
  });
});

describe("a simulação: a ordem é a da criança, e a marcação é obrigatória", () => {
  test("aberta, a pista espera a marcação: nenhuma outra abre e nada se decide", () => {
    let m = abrirNaSimulacao(MATERIA_NOVA, "autoria");
    expect(m.pendente).toBe("autoria");
    expect(abrirNaSimulacao(m, "fonte")).toBe(m);
    expect(decidirNaSimulacao(m, "publicar")).toBe(m);
    m = marcarNaSimulacao(m, "nao_confio");
    m = marcarNaSimulacao(abrirNaSimulacao(m, "fonte"), "confio");
    expect(m.passos).toEqual([
      { tipo: "autoria", veredito: "nao_confio" },
      { tipo: "fonte", veredito: "confio" },
    ]);
    expect(abrirNaSimulacao(m, "autoria")).toBe(m);
  });

  test("a decisão fecha a matéria, a qualquer momento (até sem abrir pista)", () => {
    const m = decidirNaSimulacao(MATERIA_NOVA, "nao_publicar");
    expect(m.decisao).toBe("nao_publicar");
    expect(abrirNaSimulacao(m, "data")).toBe(m);
  });

  test("o corpo só sai com as duas decididas, na ordem dos ids", () => {
    const s1 = decidirNaSimulacao(marcarNaSimulacao(abrirNaSimulacao(MATERIA_NOVA, "data"), "confio"), "publicar");
    expect(corpoDaSimulacao(["s1", "s2"], { s1 })).toBeNull();
    expect(corpoDaSimulacao(["s1", "s2"], { s1, s2: decidirNaSimulacao(MATERIA_NOVA, "nao_publicar") })).toEqual({
      materias: [
        { id: "s1", passos: [{ tipo: "data", veredito: "confio" }], decisao: "publicar" },
        { id: "s2", passos: [], decisao: "nao_publicar" },
      ],
    });
  });

  test("a memória da aba devolve só passos válidos e sem pista repetida", () => {
    expect(materiaValida({ passos: [{ tipo: "fonte", veredito: "confio" }], pendente: "data", decisao: null })).toEqual({
      passos: [{ tipo: "fonte", veredito: "confio" }],
      pendente: "data",
      decisao: null,
    });
    expect(materiaValida({ passos: [{ tipo: "fonte", veredito: "talvez" }] })).toBeNull();
    expect(materiaValida({ passos: [{ tipo: "fonte", veredito: "confio" }, { tipo: "fonte", veredito: "confio" }] })).toBeNull();
  });
});

describe("o boato: as pistas abertas ANTES da decisão, uma vez, na ordem", () => {
  test("registra na ordem, sem repetir, e para de contar depois da decisão", () => {
    let p = registrarPistaDoBoato([], "data", false);
    p = registrarPistaDoBoato(p, "fonte", false);
    p = registrarPistaDoBoato(p, "data", false);
    expect(p).toEqual(["data", "fonte"]);
    expect(registrarPistaDoBoato(p, "autoria", true)).toEqual(["data", "fonte"]);
    expect(pistasDoBoatoValidas(["autoria", "x", "autoria"])).toEqual(["autoria"]);
    expect(pistasDoBoatoValidas("fonte")).toEqual([]);
  });
});

describe("o polling relê a sessão quando a turma andou", () => {
  const estado = { passo: "publicada", etapa: "exploracao", rodada: 1, pacoteId: "p1" } as const;
  const gate = (parte: Partial<GatePublico>): GatePublico => ({
    etapa: "exploracao",
    rodada: 1,
    pacoteId: "p1",
    passoEfetivo: "publicada",
    aguardandoOProfessor: true,
    agora: "2026-09-27T08:00:00.000Z",
    ...parte,
  });

  test("nada mudou: não relê", () => {
    expect(gateMudou(estado, gate({}))).toBe(false);
  });

  test("o professor liberou o resultado", () => {
    expect(gateMudou(estado, gate({ etapa: "resultado", passoEfetivo: "resultado" }))).toBe(true);
  });

  test("zerar a turma (rodada) e pacote novo relêem; gate que ainda não nasceu, não", () => {
    expect(gateMudou(estado, gate({ rodada: 2 }))).toBe(true);
    expect(gateMudou(estado, gate({ pacoteId: "p2" }))).toBe(true);
    expect(gateMudou(estado, gate({ rodada: null, pacoteId: null }))).toBe(false);
  });
});

describe("a tela de cada passo", () => {
  test("todo passo tem tela, na ordem do percurso", () => {
    expect(Object.values(TELA_DO_PASSO)).toEqual([
      "abertura",
      "mesa",
      "motivo",
      "espera",
      "resultado",
      "chave",
      "revisao",
      "comparativo",
      "simulacao",
      "desafio-final",
      "leitura",
    ]);
  });
});

describe("os relógios", () => {
  test("a espera entre tentativas: 2 s, 4 s, 8 s e depois 15 s", () => {
    expect([0, 1, 2, 3, 9].map(esperaDaTentativa)).toEqual([2_000, 4_000, 8_000, 15_000, 15_000]);
  });

  test("o tempo nunca é negativo (o relógio da máquina da escola atrasa)", () => {
    expect(segundosDesde(10_000, 5_000)).toBe(0);
    expect(segundosDesde(0, 61_500)).toBe(61);
  });
});

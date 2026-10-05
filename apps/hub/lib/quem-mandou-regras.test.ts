import { describe, expect, test } from "vitest";

import {
  RECORTE_VAZIO,
  TETOS,
  agruparPorQuadrante,
  assuntosDoTexto,
  botoesDaAula,
  conferirAssuntos,
  conferirContexto,
  conferirMensagem,
  conferirTema,
  corpoDaAprovacao,
  deveConsultar,
  distribuirErros,
  duracaoLegivel,
  erroDaApi,
  faseAtingiu,
  mensagemPorId,
  mensagensEmOrdem,
  mudouAEvidencia,
  percentualComBase,
  quadranteDe,
  recorteDaAula,
  recorteDoPacote,
  rotuloDaOpcao,
  textoDosAssuntos,
  trocarCampo,
  CRITERIO_DA_RUBRICA,
  NIVEIS_DA_RUBRICA,
  rubricaDaRodada,
} from "./quem-mandou-regras";
import type { MensagemDoPacote, PainelDaTurma } from "./quem-mandou-tipos";

/**
 * As regras das telas do professor da exp05ef1b. O que elas seguram:
 *
 * - a curadoria mostra as oito nos quatro quadrantes sem mudar a ORDEM do grupo
 *   e sem deixar a edição de texto tocar no gabarito;
 * - cada frase do 400 da api cai perto do campo dela — a falha de antes era a
 *   frase que não aponta nem mensagem nem campo, num formulário de ~20 campos;
 * - os três botões andam na ordem e nunca oferecem voltar;
 * - o Termômetro nunca diz "0%" sobre uma turma em que ninguém confirmou.
 */

function mensagem(
  id: string,
  veracidade: MensagemDoPacote["veracidade"],
  tom: MensagemDoPacote["tom"],
  tipo: MensagemDoPacote["tipo"] = "texto",
  extra: Partial<MensagemDoPacote> = {},
): MensagemDoPacote {
  return {
    id,
    remetente: `Colega ${id}`,
    tipo,
    texto: `Mensagem ${id} sobre o passeio.`,
    ...(tipo === "texto" ? {} : { legenda: `Legenda da ${id}` }),
    veracidade,
    tom,
    ...extra,
  };
}

/** O molde do preset (com o ajuste do GAP): 2 por quadrante, 4 textos, 2 imagens, 2 links. */
const PACOTE: MensagemDoPacote[] = [
  mensagem("msg_1", "verdadeira", "emocional"),
  mensagem("msg_2", "falsa", "neutra", "link"),
  mensagem("msg_3", "verdadeira", "neutra", "imagem"),
  mensagem("msg_4", "falsa", "emocional"),
  mensagem("msg_5", "verdadeira", "emocional", "link"),
  mensagem("msg_6", "falsa", "neutra", "imagem"),
  mensagem("msg_7", "falsa", "emocional"),
  mensagem("msg_8", "verdadeira", "neutra"),
];

function painel(parcial: Partial<Pick<PainelDaTurma, "atividade" | "progresso">>): Pick<PainelDaTurma, "atividade" | "progresso"> {
  return {
    atividade: { pacoteId: "p1", rodada: 1, tema: "o passeio ao museu" },
    progresso: { unidades: 4, entraram: 4, confirmaram: 2, votaram: 2, refletiram: 0, concluiram: 0 },
    ...parcial,
  };
}

describe("a matriz da curadoria", () => {
  test("o quadrante sai dos dois eixos, independentes", () => {
    expect(quadranteDe({ veracidade: "verdadeira", tom: "emocional" })).toBe("VE");
    expect(quadranteDe({ veracidade: "verdadeira", tom: "neutra" })).toBe("VN");
    expect(quadranteDe({ veracidade: "falsa", tom: "emocional" })).toBe("FE");
    expect(quadranteDe({ veracidade: "falsa", tom: "neutra" })).toBe("FN");
  });

  test("as oito caem nos quatro quadrantes, duas em cada, com a posição do grupo", () => {
    const grupos = agruparPorQuadrante(PACOTE);
    expect(grupos.map((g) => g.quadrante)).toEqual(["VE", "VN", "FE", "FN"]);
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Verdadeira Emocional",
      "Verdadeira Neutra",
      "Falsa Emocional",
      "Falsa Neutra",
    ]);
    expect(grupos.map((g) => g.mensagens.map((m) => m.posicao))).toEqual([
      [1, 5],
      [3, 8],
      [4, 7],
      [2, 6],
    ]);
  });

  test("a mensagem por id diz a posição; id que não está no pacote é null", () => {
    expect(mensagemPorId(PACOTE, "msg_6")?.posicao).toBe(6);
    expect(mensagemPorId(PACOTE, "msg_9")).toBeNull();
  });

  test("editar um texto não toca nas outras nem no gabarito, e não muta o pacote", () => {
    const editado = trocarCampo(PACOTE, "msg_2", "texto", "Outro texto");
    expect(editado[1]).toEqual({ ...PACOTE[1], texto: "Outro texto" });
    expect(editado[1]!.veracidade).toBe("falsa");
    expect(editado[1]!.tom).toBe("neutra");
    expect(editado.filter((m, i) => m !== PACOTE[i]).map((m) => m.id)).toEqual(["msg_2"]);
    expect(PACOTE[1]!.texto).toBe("Mensagem msg_2 sobre o passeio.");
  });
});

describe("o recorte da aula", () => {
  test("os fatos são um por linha ou separados por ponto e vírgula; linha vazia não conta", () => {
    expect(assuntosDoTexto("limpeza da caixa d'água\n\n  laudo falso  ;foto do encanador\r\náudio da mãe")).toEqual([
      "limpeza da caixa d'água",
      "laudo falso",
      "foto do encanador",
      "áudio da mãe",
    ]);
    expect(assuntosDoTexto(textoDosAssuntos(["a b", "c"]))).toEqual(["a b", "c"]);
  });

  test("o corpo do gerar limpa o espaço e manda contexto vazio como null", () => {
    expect(
      recorteDaAula({ disciplina: "ciencias", tema: "  a água   do bebedouro ", assuntosTexto: "a\nb\nc", contexto: "  " }),
    ).toEqual({ disciplina: "ciencias", tema: "a água do bebedouro", assuntos: ["a", "b", "c"], contexto: null });
  });

  test("o pacote volta ao formulário com os fatos em linhas; o banco curado mantém a disciplina escolhida", () => {
    expect(recorteDoPacote({ disciplina: "historia", tema: "o acervo", assuntos: ["x", "y"], contexto: null })).toEqual({
      disciplina: "historia",
      tema: "o acervo",
      assuntosTexto: "x\ny",
      contexto: "",
    });
    expect(recorteDoPacote({ tema: "o passeio ao museu", assuntos: ["a"] }, "arte").disciplina).toBe("arte");
    expect(RECORTE_VAZIO.disciplina).toBe("");
  });

  test("o corpo da aprovação leva a origem e uma CÓPIA das mensagens", () => {
    const corpo = corpoDaAprovacao(
      { disciplina: "arte", tema: "o passeio ao museu", assuntosTexto: "a\nb\nc", contexto: "" },
      "padrao",
      PACOTE,
    );
    expect(corpo.origem).toBe("padrao");
    expect(corpo.contexto).toBeNull();
    expect(corpo.mensagens).toEqual(PACOTE);
    expect(corpo.mensagens[0]).not.toBe(PACOTE[0]);
  });
});

describe("o tema completa a fala da Nina", () => {
  test("o tema do preset passa, com a contagem que a tela mostra", () => {
    expect(conferirTema("o passeio ao museu")).toEqual({ caracteres: 18, palavras: 4, erro: null });
  });

  test("vazio não é erro aqui — a tela decide quando cobrar", () => {
    expect(conferirTema("   ").erro).toBeNull();
  });

  test("curto, longo e com palavras demais", () => {
    expect(conferirTema("ab").erro).toMatch(/pelo menos 3/);
    expect(conferirTema("a".repeat(TETOS.temaMaxCaracteres + 1)).erro).toMatch(/60 caracteres/);
    expect(conferirTema("um dois três quatro cinco seis sete oito nove").erro).toMatch(/8 palavras/);
    expect(conferirTema("um dois três quatro cinco seis sete oito").erro).toBeNull();
  });

  test("termo que denuncia a aula dentro do clone, por palavra inteira", () => {
    expect(conferirTema("a nota da prova").erro).toMatch(/nota/);
    expect(conferirTema("o EXERCÍCIO de sábado").erro).toMatch(/exercicio/);
    expect(conferirTema("a notícia do passeio").erro).toBeNull();
  });
});

describe("os fatos e o contexto", () => {
  test("de 3 a 6 fatos, e a frase diz quantos há", () => {
    expect(conferirAssuntos(["a1", "b2"])).toMatch(/de 3 a 6 fatos.*hoje: 2/);
    expect(conferirAssuntos(["a1", "b2", "c3"])).toBeNull();
    /* Os três temas numa linha só, separados por vírgula: o erro diz o que fazer. */
    expect(conferirAssuntos(["horário do ônibus, autorização, vaga no museu"])).toMatch(/mesma linha: aperte Enter/);
    expect(conferirAssuntos(["a1", "b2"])).toMatch(/aperte Enter entre um fato e outro/i);
    expect(conferirAssuntos(["a1", "b2", "c3", "d4", "e5", "f6", "g7"])).toMatch(/hoje: 7/);
  });

  test("cada fato de 2 a 120 caracteres, até 600 somados", () => {
    expect(conferirAssuntos(["a", "b2", "c3"])).toMatch(/de 2 a 120/);
    expect(conferirAssuntos(["x".repeat(120), "y".repeat(120), "z".repeat(120), "w".repeat(120), "v".repeat(120), "uu"])).toMatch(/600/);
  });

  test("o contexto é opcional e tem teto", () => {
    expect(conferirContexto("")).toBeNull();
    expect(conferirContexto("x".repeat(301))).toMatch(/300/);
  });
});

describe("cada mensagem da curadoria", () => {
  test("mensagem em ordem não tem erro, e texto puro não cobra legenda", () => {
    expect(conferirMensagem(PACOTE[0]!)).toEqual({});
    expect(mensagensEmOrdem(PACOTE)).toBe(8);
  });

  test("o balão passa de 45 palavras", () => {
    const longa = { ...PACOTE[0]!, texto: Array.from({ length: 46 }, () => "palavra").join(" ") };
    expect(conferirMensagem(longa).texto).toMatch(/45 palavras/);
    expect(mensagensEmOrdem([longa, ...PACOTE.slice(1)])).toBe(7);
  });

  test("imagem e link sem legenda dizem o que falta em cada formato", () => {
    expect(conferirMensagem({ ...PACOTE[2]!, legenda: "  " }).legenda).toBe("O comunicado precisa do texto da imagem.");
    expect(conferirMensagem({ ...PACOTE[1]!, legenda: undefined }).legenda).toBe("O link precisa da manchete da prévia.");
  });

  test("remetente curto, texto vazio e termo proibido apontam o campo certo", () => {
    const erros = conferirMensagem({ ...PACOTE[0]!, remetente: "A", texto: "" });
    expect(Object.keys(erros).sort()).toEqual(["remetente", "texto"]);
    expect(conferirMensagem({ ...PACOTE[0]!, texto: "Olha o gabarito da prova!" }).texto).toMatch(/gabarito/);
    expect(conferirMensagem({ ...PACOTE[2]!, legenda: "Comunicado sobre a atividade" }).legenda).toMatch(/atividade/);
  });
});

describe("o 400 da api, perto do campo", () => {
  test("as frases de mensagem vão para o card dela; as do recorte, para o campo; o resto, para o geral", () => {
    const erros = distribuirErros([
      "msg_3: o texto passa de 45 palavras.",
      "msg_3: usa um termo que quebra a simulação (nota).",
      "msg_6: o comunicado precisa do texto da imagem.",
      "O tema passa de 8 palavras.",
      "A fala da Nina com este tema passa de 45 palavras.",
      "Liste de 3 a 6 fatos da aula.",
      "Cada fato tem de 2 a 120 caracteres.",
      "O contexto passa de 300 caracteres.",
      "A matriz precisa de exatamente 2 verdadeiras emocionais, 2 verdadeiras neutras, 2 falsas emocionais e 2 falsas neutras.",
      "mensagens.2.texto: String must contain at most 800 character(s)",
    ]);
    expect(erros.porMensagem).toEqual({
      msg_3: ["O texto passa de 45 palavras.", "Usa um termo que quebra a simulação (nota)."],
      msg_6: ["O comunicado precisa do texto da imagem."],
    });
    expect(erros.tema).toHaveLength(2);
    expect(erros.assuntos).toHaveLength(2);
    expect(erros.contexto).toEqual(["O contexto passa de 300 caracteres."]);
    expect(erros.geral).toHaveLength(2);
  });

  test("o corpo do erro vira frase e lista, com o padrão quando a api não disse nada", () => {
    expect(erroDaApi(null, "padrão")).toEqual({ mensagem: "padrão", erros: [] });
    expect(erroDaApi({ codigo: "pacote-invalido", mensagem: "O pacote não pôde ser aprovado.", erros: ["a", 3, "b"] }, "x")).toEqual({
      mensagem: "O pacote não pôde ser aprovado.",
      erros: ["a", "b"],
    });
    expect(erroDaApi({ mensagem: "" }, "padrão").mensagem).toBe("padrão");
  });
});

describe("os três botões da aula", () => {
  test("sem pacote aprovado, nenhum", () => {
    expect(botoesDaAula(null).map((b) => b.estado)).toEqual(["indisponivel", "indisponivel", "indisponivel"]);
    expect(botoesDaAula(null).some((b) => b.proximo)).toBe(false);
  });

  test("na triagem, só a revelação — e ela é a próxima", () => {
    const botoes = botoesDaAula("triagem");
    expect(botoes.map((b) => b.rotulo)).toEqual(["Liberar Revelação", "Apresentar Síntese", "Liberar Reflexão"]);
    expect(botoes.map((b) => b.estado)).toEqual(["disponivel", "indisponivel", "indisponivel"]);
    expect(botoes.map((b) => b.proximo)).toEqual([true, false, false]);
  });

  test("depois da revelação, a síntese é a próxima e a reflexão já pode (pular a síntese é permitido)", () => {
    const botoes = botoesDaAula("revelacao");
    expect(botoes.map((b) => b.estado)).toEqual(["feito", "disponivel", "disponivel"]);
    expect(botoes.map((b) => b.proximo)).toEqual([false, true, false]);
  });

  test("na síntese, só a reflexão; na reflexão, nada — a fase não volta", () => {
    expect(botoesDaAula("explicar").map((b) => b.estado)).toEqual(["feito", "feito", "disponivel"]);
    expect(botoesDaAula("explicar").map((b) => b.proximo)).toEqual([false, false, true]);
    expect(botoesDaAula("reflexao").map((b) => b.estado)).toEqual(["feito", "feito", "feito"]);
    expect(botoesDaAula("reflexao").some((b) => b.proximo)).toBe(false);
  });

  test("faseAtingiu segue a ordem da aula", () => {
    expect(faseAtingiu(null, "triagem")).toBe(false);
    expect(faseAtingiu("explicar", "revelacao")).toBe(true);
    expect(faseAtingiu("revelacao", "explicar")).toBe(false);
  });
});

describe("o painel que se atualiza sozinho", () => {
  test("consulta enquanto há aula e alguém não concluiu", () => {
    expect(deveConsultar(painel({ atividade: null }))).toBe(false);
    expect(deveConsultar(painel({}))).toBe(true);
    expect(deveConsultar(painel({ progresso: { unidades: 0, entraram: 0, confirmaram: 0, votaram: 0, refletiram: 0, concluiram: 0 } }))).toBe(true);
    expect(deveConsultar(painel({ progresso: { unidades: 3, entraram: 3, confirmaram: 3, votaram: 3, refletiram: 3, concluiram: 3 } }))).toBe(false);
  });

  test("relê a página só quando muda o que a evidência registra", () => {
    const antes = painel({});
    expect(mudouAEvidencia(antes, painel({}))).toBe(false);
    expect(mudouAEvidencia(antes, painel({ progresso: { ...antes.progresso, votaram: 3 } }))).toBe(false);
    expect(mudouAEvidencia(antes, painel({ progresso: { ...antes.progresso, confirmaram: 3 } }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ progresso: { ...antes.progresso, concluiram: 1 } }))).toBe(true);
    expect(mudouAEvidencia(antes, painel({ atividade: { pacoteId: "p1", rodada: 2, tema: "x" } }))).toBe(true);
  });
});

describe("o termômetro e a folha", () => {
  test("sem ninguém que confirmou, não há percentual — nunca 0%", () => {
    expect(percentualComBase(0, 0)).toBeNull();
    expect(percentualComBase(5, 0)).toBe(0);
    expect(percentualComBase(5, 60)).toBe(60);
  });

  test("o tempo no grupo em minutos e segundos", () => {
    expect(duracaoLegivel(null)).toBe("—");
    expect(duracaoLegivel(45)).toBe("45 s");
    expect(duracaoLegivel(120)).toBe("2 min");
    expect(duracaoLegivel(130)).toBe("2 min 10 s");
  });

  test("o rótulo é o que a criança leu; sem rótulo, o id, e nunca some", () => {
    const opcoes = [{ id: "urgencia", rotulo: "Urgência (precisava avisar logo)" }];
    expect(rotuloDaOpcao(opcoes, "urgencia")).toBe("Urgência (precisava avisar logo)");
    expect(rotuloDaOpcao(opcoes, "outro")).toBe("outro");
    expect(rotuloDaOpcao(opcoes, null)).toBeNull();
  });
});

describe("a rubrica do Se/Então (EF05CO04, ADR-120)", () => {
  const celula = (status: string, origem: string) => ({ status, origem });
  type Linha = { id: string; porRodada: Record<string, Record<string, { status: string; origem: string }>> };
  const estudantes: Linha[] = [
    { id: "ana", porRodada: { "2": { EF05CO04: celula("atingiu", "professor") } } },
    { id: "bia", porRodada: { "2": { EF05CO04: celula("em_processo", "propria") } } },
    { id: "caio", porRodada: { "1": { EF05CO04: celula("nao_atingiu", "professor") } } },
    { id: "duda", porRodada: { "2": { EF05CO04: celula("nao_participou", "professor") } } },
    { id: "enzo", porRodada: { "2": { EF05CO03: celula("atingiu", "professor") } } },
  ];

  test("acende só o que o PROFESSOR classificou, nesta rodada e nesta habilidade", () => {
    expect(rubricaDaRodada(estudantes, { pacoteId: "p", rodada: 2 })).toEqual({
      pacoteId: "p",
      rodada: 2,
      classificados: { ana: "atingiu" },
    });
  });

  test("a rodada anterior não vaza para a de agora", () => {
    expect(rubricaDaRodada(estudantes, { pacoteId: "p", rodada: 1 }).classificados).toEqual({ caio: "nao_atingiu" });
  });

  test("cada nível tem o seu critério, e são os três da régua", () => {
    expect(NIVEIS_DA_RUBRICA).toEqual(["atingiu", "em_processo", "nao_atingiu"]);
    for (const n of NIVEIS_DA_RUBRICA) expect(CRITERIO_DA_RUBRICA[n].length).toBeGreaterThan(10);
  });
});

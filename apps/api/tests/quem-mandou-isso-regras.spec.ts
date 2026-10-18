import { colapsarEmUnidades, type EquipeDoMapa } from "../src/equipes/regras";
import { FICHA_EXP05EF1B } from "../src/evidencias/fichas/exp05ef1b";
import { CHAVES_REDIGIDAS } from "../src/observabilidade/redaction";
import {
  CALLBACK_DO_MOTIVO,
  ENCERRAMENTO_DA_NINA,
  FALA_DO_CARTAO,
  FALA_DO_TIO,
  GRUPO,
  MURAL,
  NINA_ANTES_DO_TEMA,
  NINA_DEPOIS_DO_TEMA,
  PACOTE_PADRAO,
  ROTULO_DO_MOTIVO,
  falaDaNina,
  mensagensDoPadrao,
  mensagensPublicas,
  quadranteDe,
  temaNaFrase,
  type MensagemDoPacote,
  type Quadrante,
} from "../src/quem-mandou-isso/catalogo";
import { validarSaidaDoPreparo, promptDoPreparo } from "../src/quem-mandou-isso/prompts";
import {
  MARCADOR_DA_REGRA,
  MARCADOR_DA_SELECAO,
  MARCADOR_DO_CARTAO,
  nivelCO08,
} from "../src/quem-mandou-isso/regras/evidencia";
import {
  OPERADORES,
  acertosDoCartao,
  acertosPorOperador,
  avaliarFrase,
  frasesDoCartao,
  nivelCO03,
  referenciaDa,
  type Resposta,
} from "../src/quem-mandou-isso/regras/operacoes";
import {
  ACOES,
  CONDICOES,
  RESULTADO_DO_TESTE,
  ROTULO_DA_ACAO,
  ROTULO_DA_CONDICAO,
  ROTULO_DA_PREVISAO,
  SITUACOES,
  conferirRegra,
  nivelCO04,
  regraEmPalavras,
  repassaSemChecar,
  simular,
  type Regra,
} from "../src/quem-mandou-isso/regras/regra";
import {
  contarPalavras,
  sortearMolde,
  termosProibidosEm,
  validarAssuntos,
  validarMensagens,
  validarPacote,
  validarTema,
} from "../src/quem-mandou-isso/regras/pacote";
import {
  FASES,
  PASSOS,
  avancarFase,
  faseAtingiu,
  passoEfetivo,
  revelacaoAberta,
  type MarcosDaSessao,
} from "../src/quem-mandou-isso/regras/passos";
import { conferirSelecao, mesmaSelecao } from "../src/quem-mandou-isso/regras/selecao";
import { percentual, progresso, termometro, type UnidadeDaConta } from "../src/quem-mandou-isso/regras/termometro";

/**
 * As regras PURAS da exp05ef1b v2.2 — sem banco. A mecânica pedagógica: a
 * régua do pacote (a matriz, os formatos, os tetos, os termos), o passo
 * derivado, a EF05CO08 nas 56 combinações, o filtro do "Então", as contas do
 * Termômetro e as falas da Nina e do tio. O que só o banco responde (RLS,
 * CHECK, latch concorrente, a porta da sala) está na suíte de Postgres.
 */

/** Um gerador determinístico (mulberry32): o sorteio do molde vira reproduzível. */
function prng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function preset() {
  return { tema: PACOTE_PADRAO.tema, assuntos: [...PACOTE_PADRAO.assuntos], contexto: null, mensagens: mensagensDoPadrao() };
}

function comMensagem(id: string, mudanca: Partial<MensagemDoPacote>): MensagemDoPacote[] {
  return mensagensDoPadrao().map((m) => (m.id === id ? ({ ...m, ...mudanca } as MensagemDoPacote) : m));
}

/** `n` palavras curtas — o teto aqui é de PALAVRAS, e não pode esbarrar no de caracteres. */
const palavras = (n: number) => Array.from({ length: n }, () => "casa").join(" ");

describe("o banco curado (o preset)", () => {
  test("passa na régua inteira — a mesma da IA e da curadoria", () => {
    expect(validarPacote(preset())).toEqual([]);
  });

  test("8 mensagens, 2 por quadrante, 4 textos / 2 imagens / 2 links", () => {
    const m = mensagensDoPadrao();
    expect(m.map((x) => x.id)).toEqual(["msg_1", "msg_2", "msg_3", "msg_4", "msg_5", "msg_6", "msg_7", "msg_8"]);
    const conta = (f: (x: MensagemDoPacote) => string) =>
      m.reduce<Record<string, number>>((acc, x) => ({ ...acc, [f(x)]: (acc[f(x)] ?? 0) + 1 }), {});
    expect(conta(quadranteDe)).toEqual({ VE: 2, VN: 2, FE: 2, FN: 2 });
    expect(conta((x) => x.tipo)).toEqual({ texto: 4, imagem: 2, link: 2 });
  });

  test("o GAP aplicado: msg_5 (VE) é link e msg_7 (FE) é texto, e o texto das duas não mudou", () => {
    const [m5, m7] = ["msg_5", "msg_7"].map((id) => mensagensDoPadrao().find((m) => m.id === id));
    expect(m5).toMatchObject({ tipo: "link", veracidade: "verdadeira", tom: "emocional" });
    expect(m5?.texto.startsWith("Turma, corre aqui! A professora acabou de avisar no pátio")).toBe(true);
    expect(m7).toMatchObject({ tipo: "texto", veracidade: "falsa", tom: "emocional" });
    expect(m7?.legenda).toBeUndefined();
    expect(m7?.texto.startsWith("MEU DEUS DO CÉU! Olhem esse link")).toBe(true);
  });

  test("a versão ORIGINAL dos artefatos (os dois links falsos) é recusada — é o GAP", () => {
    const original = mensagensDoPadrao().map((m): MensagemDoPacote => {
      if (m.id === "msg_5") return { ...m, tipo: "texto", legenda: undefined };
      if (m.id === "msg_7") return { ...m, tipo: "link", legenda: "Alerta Urgente Web: incêndio no centro cultural." };
      return m;
    });
    expect(validarMensagens(original)).toEqual([
      "As duas mensagens de link precisam ser uma verdadeira e uma falsa — senão o formato entrega a resposta.",
    ]);
  });

  test("devolve objetos NOVOS: editar o rascunho não muda o preset em memória", () => {
    const a = mensagensDoPadrao();
    (a[0] as MensagemDoPacote).texto = "outro";
    expect(mensagensDoPadrao()[0]?.texto).not.toBe("outro");
  });
});

describe("a régua do pacote", () => {
  test("matriz fora de 2 por quadrante reprova", () => {
    const erros = validarMensagens(comMensagem("msg_1", { tom: "neutra" }));
    expect(erros).toContainEqual(expect.stringContaining("exatamente 2 verdadeiras emocionais"));
  });

  test("formato fora de 4/2/2 reprova", () => {
    const erros = validarMensagens(comMensagem("msg_2", { tipo: "texto", legenda: undefined }));
    expect(erros).toContainEqual(expect.stringContaining("exatamente 4 textos, 2 imagens e 2 links"));
  });

  test("as duas imagens verdadeiras reprovam (o formato não pode entregar a resposta)", () => {
    const mensagens = mensagensDoPadrao().map((m): MensagemDoPacote => {
      if (m.id === "msg_6") return { ...m, veracidade: "verdadeira" };
      if (m.id === "msg_8") return { ...m, veracidade: "falsa" };
      return m;
    });
    expect(validarMensagens(mensagens)).toEqual([
      "As duas mensagens de imagem precisam ser uma verdadeira e uma falsa — senão o formato entrega a resposta.",
    ]);
  });

  test("a legenda existe na imagem e no link, e SÓ neles", () => {
    expect(validarMensagens(comMensagem("msg_3", { legenda: "  " }))).toEqual([
      "msg_3: o comunicado precisa do texto da imagem.",
    ]);
    expect(validarMensagens(comMensagem("msg_2", { legenda: undefined }))).toEqual([
      "msg_2: o link precisa da manchete da prévia.",
    ]);
    expect(validarMensagens(comMensagem("msg_1", { legenda: "sobrando" }))).toEqual([
      "msg_1: mensagem de texto não tem legenda.",
    ]);
  });

  test("os tetos de leitura: bolha até 45 palavras, legenda até 25", () => {
    expect(validarMensagens(comMensagem("msg_1", { texto: palavras(45) }))).toEqual([]);
    expect(validarMensagens(comMensagem("msg_1", { texto: palavras(46) }))).toEqual([
      "msg_1: o texto passa de 45 palavras.",
    ]);
    expect(validarMensagens(comMensagem("msg_3", { legenda: palavras(25) }))).toEqual([]);
    expect(validarMensagens(comMensagem("msg_3", { legenda: palavras(26) }))).toEqual([
      "msg_3: a legenda passa de 25 palavras.",
    ]);
  });

  test("remetente de 2 a 30 caracteres, texto não vazio, id uma vez só", () => {
    expect(validarMensagens(comMensagem("msg_1", { remetente: "P" }))).toEqual([
      "msg_1: o remetente tem de 2 a 30 caracteres.",
    ]);
    expect(validarMensagens(comMensagem("msg_1", { texto: "   " }))).toEqual(["msg_1: a mensagem está sem texto."]);
    const repetido = mensagensDoPadrao().map((m) => (m.id === "msg_8" ? { ...m, id: "msg_1" as const } : m));
    expect(validarMensagens(repetido)).toContainEqual("Cada id de msg_1 a msg_8 aparece uma vez só.");
    expect(validarMensagens(mensagensDoPadrao().slice(0, 7))).toContainEqual("O pacote precisa de exatamente 8 mensagens.");
  });

  test("termo proibido no clone reprova — no texto, na legenda e no remetente", () => {
    expect(validarMensagens(comMensagem("msg_1", { texto: "Gente, a atividade de hoje mudou!" }))).toEqual([
      "msg_1: usa um termo que quebra a simulação (atividade).",
    ]);
    expect(validarMensagens(comMensagem("msg_2", { legenda: "Portal: saiu o GABARITO da prova" }))).toEqual([
      "msg_2: usa um termo que quebra a simulação (gabarito).",
    ]);
    expect(validarMensagens(comMensagem("msg_4", { remetente: "Notas da Turma" }))).toEqual([
      "msg_4: usa um termo que quebra a simulação (nota).",
    ]);
  });
});

describe("os termos proibidos dentro do clone", () => {
  test("atividade, gabarito, nota e exercício — sem acento, sem caixa, com plural", () => {
    expect(termosProibidosEm("Tem ATIVIDADE hoje")).toEqual(["atividade"]);
    expect(termosProibidosEm("as atividades")).toEqual(["atividade"]);
    expect(termosProibidosEm("o Gabarito saiu")).toEqual(["gabarito"]);
    expect(termosProibidosEm("tirei nota 10")).toEqual(["nota"]);
    expect(termosProibidosEm("as notas saíram")).toEqual(["nota"]);
    expect(termosProibidosEm("o exercício 3")).toEqual(["exercicio"]);
    expect(termosProibidosEm("EXERCICIOS de casa")).toEqual(["exercicio"]);
  });

  test("palavra que só CONTÉM o termo passa: notícia, anotar, notável, exercitar", () => {
    expect(termosProibidosEm("A notícia saiu e eu fui anotar no caderno — notável! Vou exercitar a calma.")).toEqual([]);
  });

  test("\"professora\" passa, de propósito: a Professora Helena escreve no grupo da turma", () => {
    expect(termosProibidosEm("Professora Helena: os monitores aguardam no saguão")).toEqual([]);
  });
});

describe("o tema e a fala da Nina", () => {
  test("com o tema do preset, a fala é LITERALMENTE a copy (e1.narrativa.briefing_nina, 41 palavras)", () => {
    expect(falaDaNina(PACOTE_PADRAO.tema)).toBe(
      "Preciso da sua ajuda! Rolou uma confusão sobre o passeio ao museu. Entra no grupo da turma, vê o que estão falando e me ajuda: encaminha pro Mural da Turma as 3 mensagens que vão explicar o que aconteceu de verdade.",
    );
    expect(contarPalavras(falaDaNina(PACOTE_PADRAO.tema))).toBe(41);
  });

  test("a parte fixa tem 37 palavras — e é por isso que o tema tem até 8", () => {
    expect(contarPalavras(NINA_ANTES_DO_TEMA) + contarPalavras(NINA_DEPOIS_DO_TEMA)).toBe(37);
  });

  test("tema de 8 palavras deixa o balão em 45; de 9, reprova", () => {
    const oito = "a feira de livros da escola foi adiada";
    expect(contarPalavras(oito)).toBe(8);
    expect(validarTema(oito)).toEqual([]);
    expect(contarPalavras(falaDaNina(oito))).toBe(45);
    expect(validarTema(`${oito} ontem`)).toEqual(["O tema passa de 8 palavras."]);
  });

  test("até 60 caracteres; menos de 3 reprova; termo proibido reprova", () => {
    expect(validarTema("a".repeat(60))).toEqual([]);
    expect(validarTema("a".repeat(61))).toEqual(["O tema passa de 60 caracteres."]);
    expect(validarTema(" ab ")).toEqual(["O tema precisa de pelo menos 3 caracteres."]);
    expect(validarTema("a nota da prova")).toEqual(["O tema usa um termo que quebra a simulação: nota."]);
  });

  test("o tema entra na frase sem pontuação dobrada e sem espaço sobrando; a caixa não muda", () => {
    expect(temaNaFrase("  a Feira do   Livro!! ")).toBe("a Feira do Livro");
    expect(falaDaNina("a Feira do Livro.")).toContain("sobre a Feira do Livro. Entra no grupo");
  });

  test("os fatos da aula: 3 a 6, cada um de 2 a 120 caracteres, até 600 somados", () => {
    expect(validarAssuntos(["um fato", "outro fato", "mais um"])).toEqual([]);
    expect(validarAssuntos(["só", "dois"])).toEqual(["Liste de 3 a 6 fatos da aula."]);
    expect(validarAssuntos(["a", "outro fato", "mais um"])).toEqual(["Cada fato tem de 2 a 120 caracteres."]);
    expect(validarAssuntos(Array.from({ length: 6 }, () => "x".repeat(110)))).toEqual([
      "Os fatos passam de 600 caracteres somados.",
    ]);
  });
});

describe("as falas fixas da experiência (dentro do clone e na casca)", () => {
  test("a ficha é só Canal A (v4): três ações com rótulo, nenhuma pergunta", () => {
    expect(FICHA_EXP05EF1B.versao).toBe(4);
    expect(FICHA_EXP05EF1B.perguntas).toEqual([]);
    expect(FICHA_EXP05EF1B.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo, Boolean(m.rotulo)])])).toEqual([
      ["EF05CO08", [[MARCADOR_DA_SELECAO, "acao", true]]],
      ["EF05CO03", [[MARCADOR_DO_CARTAO, "acao", true]]],
      ["EF05CO04", [[MARCADOR_DA_REGRA, "acao", true]]],
    ]);
  });

  test("o tio é URGENTE e ALARMANTE e é um PARENTE: é o que a regra assume sobre o áudio", () => {
    expect(FALA_DO_TIO).toMatch(/meu tio/);
    expect(FALA_DO_TIO).toMatch(/assustada/);
    expect(FALA_DO_TIO).toMatch(/repassar correndo/);
  });

  test("tudo que a criança lê: até 45 palavras e nenhum termo proibido", () => {
    const textos = [
      falaDaNina(PACOTE_PADRAO.tema),
      ENCERRAMENTO_DA_NINA,
      FALA_DO_CARTAO,
      FALA_DO_TIO,
      GRUPO.nome,
      MURAL.nome,
      ...Object.values(ROTULO_DO_MOTIVO),
      ...Object.values(CALLBACK_DO_MOTIVO),
      ...Object.values(ROTULO_DA_CONDICAO),
      ...Object.values(ROTULO_DA_ACAO),
      ...Object.values(ROTULO_DA_PREVISAO),
      ...Object.values(RESULTADO_DO_TESTE),
      ...frasesDoCartao(mensagensDoPadrao().slice(0, 3), "qualquer").map((f) => f.texto),
    ];
    for (const texto of textos) {
      expect({ texto, palavras: contarPalavras(texto) <= 45, proibidos: termosProibidosEm(texto) }).toEqual({
        texto,
        palavras: true,
        proibidos: [],
      });
    }
  });
});

describe("o gabarito não desce antes da hora", () => {
  test("a mensagem pública não TEM veracidade nem tom — nem com valor indefinido", () => {
    for (const m of mensagensPublicas(mensagensDoPadrao())) {
      expect(Object.keys(m).sort()).toEqual(
        m.tipo === "texto" ? ["id", "remetente", "texto", "tipo"] : ["id", "legenda", "remetente", "texto", "tipo"],
      );
    }
  });

  test("os campos sensíveis estão na redação do log (o gabarito e o texto do menor)", () => {
    for (const chave of ["veracidade", "tom", "entao", "acaoEntao", "acao_entao"]) {
      expect({ chave, redigida: CHAVES_REDIGIDAS.has(chave.toLowerCase()) }).toEqual({ chave, redigida: true });
    }
  });
});

describe("o passo efetivo = f(sessão, fase)", () => {
  const nada: MarcosDaSessao = { entrou: true, confirmou: false, votou: false, respondeuCartao: false, concluiu: false };
  const confirmou = { ...nada, confirmou: true };
  const votou = { ...confirmou, votou: true };
  const respondeu = { ...votou, respondeuCartao: true };
  const concluiu = { ...votou, concluiu: true };

  test("sem sessão (ou sem entrar) é abertura, em qualquer fase", () => {
    for (const fase of [null, ...FASES]) {
      expect(passoEfetivo(null, fase)).toBe("abertura");
      expect(passoEfetivo({ ...nada, entrou: false }, fase)).toBe("abertura");
    }
  });

  test("a triagem NÃO é empurrada pela revelação: quem não confirmou continua no grupo", () => {
    for (const fase of [null, ...FASES]) {
      expect(passoEfetivo(nada, fase)).toBe("grupo");
      expect(passoEfetivo(confirmou, fase)).toBe("enquete");
    }
  });

  test("depois do voto, a fase decide", () => {
    expect(passoEfetivo(votou, null)).toBe("espera");
    expect(passoEfetivo(votou, "triagem")).toBe("espera");
    expect(passoEfetivo(votou, "revelacao")).toBe("revelacao");
    expect(passoEfetivo(votou, "explicar")).toBe("sintese");
    /* Na reflexão, o cartão vem ANTES da regra do tio: quem não o enviou
       (inclusive quem votou atrasado) cai nele primeiro. */
    expect(passoEfetivo(votou, "reflexao")).toBe("cartao");
    expect(passoEfetivo(respondeu, "reflexao")).toBe("regra");
  });

  test("o cartão enviado não muda o passo antes da reflexão (ele vive na revelação e na síntese)", () => {
    expect(passoEfetivo(respondeu, "revelacao")).toBe("revelacao");
    expect(passoEfetivo(respondeu, "explicar")).toBe("sintese");
  });

  test("o latch do estudante vence a fase: concluída = concluída", () => {
    for (const fase of [null, ...FASES]) expect(passoEfetivo(concluiu, fase)).toBe("concluida");
  });

  test("o passo da regra Se/Então não existe mais", () => {
    expect((PASSOS as readonly string[]).includes("reflexao")).toBe(false);
  });

  test("a revelação dele só abre com o VOTO e a fase na revelação ou além", () => {
    expect(revelacaoAberta(confirmou, "reflexao")).toBe(false);
    expect(revelacaoAberta(votou, "triagem")).toBe(false);
    expect(revelacaoAberta(votou, null)).toBe(false);
    for (const fase of ["revelacao", "explicar", "reflexao"] as const) expect(revelacaoAberta(votou, fase)).toBe(true);
    expect(revelacaoAberta(null, "reflexao")).toBe(false);
  });

  test("a fase só anda para a frente; pular é permitido; null é triagem", () => {
    expect(avancarFase("reflexao", "revelacao")).toBe("reflexao");
    expect(avancarFase("triagem", "reflexao")).toBe("reflexao");
    expect(avancarFase("revelacao", "revelacao")).toBe("revelacao");
    expect(faseAtingiu(null, "triagem")).toBe(true);
    expect(faseAtingiu(null, "revelacao")).toBe(false);
    expect(faseAtingiu("explicar", "revelacao")).toBe(true);
  });
});

describe("a EF05CO08 pela seleção do Mural", () => {
  /** A régua v2 (ADR-120), escrita À PARTE, por quadrantes — o oráculo não reusa a função testada. */
  const TABELA: Record<string, "atingiu" | "em_processo" | "nao_atingiu"> = {
    "VE,VE,VN": "atingiu",
    "VE,VN,VN": "atingiu",
    "FE,VE,VE": "em_processo",
    "FE,VE,VN": "em_processo",
    "FE,VN,VN": "em_processo",
    "FN,VE,VE": "em_processo",
    "FN,VE,VN": "em_processo",
    "FN,VN,VN": "em_processo",
    "FE,FE,VE": "nao_atingiu",
    "FE,FE,VN": "nao_atingiu",
    "FE,FN,VE": "nao_atingiu",
    "FE,FN,VN": "nao_atingiu",
    "FN,FN,VE": "nao_atingiu",
    "FN,FN,VN": "nao_atingiu",
    "FE,FE,FN": "nao_atingiu",
    "FE,FN,FN": "nao_atingiu",
  };

  const oito = mensagensDoPadrao();
  const combinacoes: MensagemDoPacote[][] = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++)
      for (let k = j + 1; k < 8; k++) combinacoes.push([oito[i], oito[j], oito[k]] as MensagemDoPacote[]);

  test("são 56 combinações de 3 entre 8", () => {
    expect(combinacoes).toHaveLength(56);
  });

  test("todas as 56 batem com a tabela", () => {
    const divergentes = combinacoes.flatMap((trio) => {
      const chave = trio.map(quadranteDe).sort().join(",");
      const esperado = TABELA[chave];
      const obtido = nivelCO08(trio);
      return esperado === obtido ? [] : [`${trio.map((m) => m.id).join("+")} (${chave}): ${obtido} ≠ ${esperado}`];
    });
    expect(divergentes).toEqual([]);
  });

  test("a distribuição: 4 atingiu, 24 em processo, 28 não atingiu — o sorteio atinge 7%, não 29%", () => {
    const conta = { atingiu: 0, em_processo: 0, nao_atingiu: 0 };
    for (const trio of combinacoes) conta[nivelCO08(trio)] += 1;
    expect(conta).toEqual({ atingiu: 4, em_processo: 24, nao_atingiu: 28 });
  });

  test("a régua lê exatamente 3 — nem 2, nem 4", () => {
    expect(() => nivelCO08(oito.slice(0, 2))).toThrow();
    expect(() => nivelCO08(oito.slice(0, 4))).toThrow();
  });

  test("o marcador que o módulo marca é o de AÇÃO da EF05CO08 na ficha", () => {
    const co08 = FICHA_EXP05EF1B.habilidades.find((h) => h.codigo === "EF05CO08");
    expect(co08?.marcadores).toEqual([{ id: MARCADOR_DA_SELECAO, tipo: "acao", rotulo: "Seleção do Mural" }]);
  });
});

describe("a seleção do Mural", () => {
  const doPacote = new Set(mensagensDoPadrao().map((m) => m.id));

  test("rascunho: 0 a 3; latch: exatamente 3", () => {
    expect(conferirSelecao([], doPacote, false)).toEqual({ ok: true, selecao: [] });
    expect(conferirSelecao(["msg_1", "msg_2"], doPacote, false)).toMatchObject({ ok: true });
    expect(conferirSelecao(["msg_1", "msg_2"], doPacote, true)).toEqual({ ok: false, codigo: "selecao-incompleta" });
    expect(conferirSelecao(["msg_1", "msg_2", "msg_3"], doPacote, true)).toMatchObject({ ok: true });
    expect(conferirSelecao(["msg_1", "msg_2", "msg_3", "msg_4"], doPacote, false)).toEqual({
      ok: false,
      codigo: "selecao-acima-do-limite",
    });
  });

  test("repetida e fora do pacote reprovam, com código próprio", () => {
    expect(conferirSelecao(["msg_1", "msg_1"], doPacote, false)).toEqual({ ok: false, codigo: "selecao-repetida" });
    expect(conferirSelecao(["msg_9"], doPacote, false)).toEqual({ ok: false, codigo: "mensagem-desconhecida" });
  });

  test("a mesma seleção não depende da ordem (o duplo toque é idempotente)", () => {
    expect(mesmaSelecao(["msg_1", "msg_2", "msg_3"], ["msg_3", "msg_1", "msg_2"])).toBe(true);
    expect(mesmaSelecao(["msg_1", "msg_2", "msg_3"], ["msg_1", "msg_2", "msg_4"])).toBe(false);
    expect(mesmaSelecao(["msg_1", "msg_2"], ["msg_1", "msg_2", "msg_3"])).toBe(false);
  });
});

describe("as contas do Termômetro", () => {
  const gabarito = new Map(mensagensDoPadrao().map((m) => [m.id, { veracidade: m.veracidade, tom: m.tom }]));
  const unidade = (selecao: string[] | null, motivo: UnidadeDaConta["motivo"] = null): UnidadeDaConta => ({
    entrou: true,
    selecao,
    motivo,
    respondeuCartao: false,
    enviouRegra: false,
    concluiu: false,
  });
  /* Pelo preset: VE = msg_1, msg_5; VN = msg_3, msg_8; FE = msg_4, msg_7; FN = msg_2, msg_6. */

  test("sem ninguém: zeros, nunca NaN", () => {
    const t = termometro([], gabarito);
    expect(t).toEqual({
      unidades: 0,
      falsaNeutra: { unidades: 0, percentual: 0 },
      verdadeiraEmocionalDescartada: { descartadas: 0, total: 0, percentual: 0 },
      motivos: [
        { motivo: "urgencia", unidades: 0, comFalsaNeutra: 0 },
        { motivo: "confianca_remetente", unidades: 0, comFalsaNeutra: 0 },
        { motivo: "medo_indignacao", unidades: 0, comFalsaNeutra: 0 },
        { motivo: "imagem_link_real", unidades: 0, comFalsaNeutra: 0 },
      ],
    });
    expect(percentual(3, 0)).toBe(0);
  });

  test("quem não confirmou o Mural não entra na base (a escolha ainda podia mudar)", () => {
    const t = termometro([unidade(null), unidade(["msg_2", "msg_3", "msg_8"])], gabarito);
    expect(t.unidades).toBe(1);
    expect(t.falsaNeutra).toEqual({ unidades: 1, percentual: 100 });
  });

  test("% com falsa neutra, e (2·N − ΣVE)/(2·N) das verdadeiras emocionais descartadas", () => {
    const t = termometro(
      [
        unidade(["msg_2", "msg_6", "msg_8"], "confianca_remetente"), // 2 FN, 0 VE
        unidade(["msg_1", "msg_5", "msg_3"], "urgencia"), // 0 FN, 2 VE
        unidade(["msg_1", "msg_4", "msg_2"], "urgencia"), // 1 FN, 1 VE
        unidade(["msg_3", "msg_8", "msg_7"]), // não votou ainda: 0 FN, 0 VE
      ],
      gabarito,
    );
    expect(t.unidades).toBe(4);
    expect(t.falsaNeutra).toEqual({ unidades: 2, percentual: 50 });
    /* 2·4 = 8 VE disponíveis; 3 encaminhadas; 5 descartadas = 63%. */
    expect(t.verdadeiraEmocionalDescartada).toEqual({ descartadas: 5, total: 8, percentual: 63 });
    expect(t.motivos).toEqual([
      { motivo: "urgencia", unidades: 2, comFalsaNeutra: 1 },
      { motivo: "confianca_remetente", unidades: 1, comFalsaNeutra: 1 },
      { motivo: "medo_indignacao", unidades: 0, comFalsaNeutra: 0 },
      { motivo: "imagem_link_real", unidades: 0, comFalsaNeutra: 0 },
    ]);
  });

  test("a turma inteira no falso neutro: a barra no teto, sem distorção", () => {
    const t = termometro([unidade(["msg_2", "msg_6", "msg_4"]), unidade(["msg_2", "msg_7", "msg_4"])], gabarito);
    expect(t.falsaNeutra.percentual).toBe(100);
    expect(t.verdadeiraEmocionalDescartada.percentual).toBe(100);
  });

  test("POR UNIDADE: duas crianças no mesmo computador contam como UMA", () => {
    type Linha = { id: string; conta: UnidadeDaConta };
    const linhas: Linha[] = [
      { id: "ana", conta: unidade(["msg_2", "msg_3", "msg_8"]) },
      { id: "bia", conta: { ...unidade(null), entrou: false } },
      { id: "caio", conta: unidade(["msg_1", "msg_5", "msg_3"]) },
    ];
    const equipe: EquipeDoMapa = {
      id: "e1",
      nome: "Equipe 1",
      membros: [
        { id: "ana", nome: "Ana" },
        { id: "bia", nome: "Bia" },
      ],
    };
    const mapa = new Map([
      ["ana", equipe],
      ["bia", equipe],
    ]);
    const unidades = colapsarEmUnidades(linhas, (l) => l.id, mapa, (l) => l.conta.entrou).map((u) => u.linha.conta);
    expect(unidades).toHaveLength(2);
    expect(progresso(unidades)).toEqual({
      unidades: 2,
      entraram: 2,
      confirmaram: 2,
      votaram: 0,
      responderamCartao: 0,
      enviaramRegra: 0,
      concluiram: 0,
    });
    expect(termometro(unidades, gabarito).falsaNeutra).toEqual({ unidades: 1, percentual: 50 });
  });
});

describe("o molde sorteado da IA", () => {
  /** Mensagens de mentira sobre o molde: só a ESTRUTURA é o que se confere aqui. */
  function sobreOMolde(molde: ReturnType<typeof sortearMolde>): MensagemDoPacote[] {
    return molde.map((m) => ({
      ...m,
      remetente: "Colega da turma",
      texto: "Uma mensagem qualquer do grupo.",
      ...(m.tipo === "texto" ? {} : { legenda: "Uma legenda qualquer." }),
    }));
  }

  test("em 500 sorteios, todo molde passa na régua estrutural (2 por quadrante, 4/2/2, imagem e link balanceados)", () => {
    const aleatorio = prng(20260925);
    for (let i = 0; i < 500; i++) {
      const molde = sortearMolde(aleatorio);
      expect(molde.map((m) => m.id)).toEqual(["msg_1", "msg_2", "msg_3", "msg_4", "msg_5", "msg_6", "msg_7", "msg_8"]);
      expect(validarMensagens(sobreOMolde(molde))).toEqual([]);
    }
  });

  test("a posição não é pista: cada posição já foi de mais de um quadrante e de mais de um formato", () => {
    const aleatorio = prng(7);
    const quadrantes = Array.from({ length: 8 }, () => new Set<Quadrante>());
    const formatos = Array.from({ length: 8 }, () => new Set<string>());
    for (let i = 0; i < 200; i++) {
      sortearMolde(aleatorio).forEach((m, p) => {
        quadrantes[p]?.add(quadranteDe(m));
        formatos[p]?.add(m.tipo);
      });
    }
    expect(quadrantes.every((q) => q.size === 4)).toBe(true);
    expect(formatos.every((f) => f.size === 3)).toBe(true);
  });

  test("a saída da IA é montada SOBRE o molde, e passa pela mesma régua", () => {
    const molde = sortearMolde(prng(1));
    const validar = validarSaidaDoPreparo(molde);
    const saida = {
      mensagens: molde.map((m, i) => ({
        remetente: `  Colega ${i + 1} `,
        texto: "Olha isso que mandaram no grupo agora.",
        legenda: "Portal da Cidade: uma manchete qualquer.",
        /* O modelo tentando mudar o gabarito é ignorado: o molde manda. */
        veracidade: "falsa",
      })),
    };
    const mensagens = validar(saida);
    expect(mensagens.map((m) => [m.id, m.tipo, m.veracidade, m.tom])).toEqual(
      molde.map((m) => [m.id, m.tipo, m.veracidade, m.tom]),
    );
    expect(mensagens[0]?.remetente).toBe("Colega 1");
    /* A legenda num TEXTO é descartada, não recusada. */
    for (const m of mensagens) expect(m.legenda === undefined).toBe(m.tipo === "texto");
  });

  test("saída fora da régua faz a tentativa ser regerada (lança)", () => {
    const molde = sortearMolde(prng(2));
    const validar = validarSaidaDoPreparo(molde);
    const boa = molde.map(() => ({ remetente: "Colega", texto: "Uma mensagem do grupo.", legenda: "Site: manchete." }));
    expect(() => validar({ mensagens: boa.slice(0, 7) })).toThrow("esperava 8 mensagens");
    expect(() => validar({ mensagens: boa.map((b) => ({ ...b, texto: "a nota da prova saiu" })) })).toThrow(/quebra a simulação/);
    expect(() => validar({ mensagens: boa.map((b) => ({ ...b, legenda: "" })) })).toThrow(/precisa/);
    expect(() => validar(null)).toThrow();
  });

  test("o prompt leva o recorte DELIMITADO e o molde, posição a posição", () => {
    const molde = sortearMolde(prng(3));
    const prompt = promptDoPreparo(
      { disciplina: "ciencias", tema: "a água dos bebedouros", assuntos: ["limpeza da caixa d'água", "laudo falso", "foto do encanador"] },
      molde,
    );
    expect(prompt).toContain("COMPONENTE CURRICULAR: Ciências");
    expect(prompt).toContain("TEMA DO BOATO: <<<a água dos bebedouros>>>");
    expect(prompt).toContain("<<<limpeza da caixa d'água; laudo falso; foto do encanador>>>");
    expect(prompt).toContain(`1. formato "${molde[0]?.tipo}"`);
  });
});

describe("o cartão de frases da EF05CO03", () => {
  const padrao = mensagensDoPadrao();
  /** As 56 trincas de 3 entre as 8 mensagens do preset. */
  const trincas = padrao.flatMap((a, i) =>
    padrao.slice(i + 1).flatMap((b, j) => padrao.slice(i + j + 2).map((c) => [a, b, c] as const)),
  );

  /** Lê a frase de volta, do texto, e recalcula a resposta do zero — sem confiar no gerador. */
  function respostaPeloTexto(texto: string, m: (typeof padrao)[number]): { operador: string; resposta: Resposta } {
    const corpo = texto.slice(referenciaDa(m).length);
    const nao = /^ NÃO é (\w+)\.$/u.exec(corpo);
    if (nao) return { operador: "NAO", resposta: avaliarFrase(m, "NAO", nao[1] as never) };
    const comp = /^ é (\w+) (E|OU) (\w+)\.$/u.exec(corpo);
    if (!comp) throw new Error(`frase fora do molde: ${texto}`);
    const [, a, op, b] = comp;
    expect(["verdadeira", "falsa"]).toContain(a);
    expect(["emocional", "neutra"]).toContain(b);
    return { operador: op as string, resposta: avaliarFrase(m, op as "E" | "OU", a as never, b as never) };
  }

  test("nas 56 trincas: 2 E, 2 OU e 2 NÃO; 3 Sim e 3 Não; cada mensagem em 2 frases com operadores diferentes", () => {
    expect(trincas).toHaveLength(56);
    for (const [k, trinca] of trincas.entries()) {
      const frases = frasesDoCartao(trinca, `sessao-${k}`);
      expect(frases.map((f) => f.id)).toEqual(["f1", "f2", "f3", "f4", "f5", "f6"]);
      for (const op of OPERADORES) expect(frases.filter((f) => f.operador === op)).toHaveLength(2);
      expect(frases.filter((f) => f.esperado === "sim")).toHaveLength(3);
      for (const m of trinca) {
        const dela = frases.filter((f) => f.msgId === m.id);
        expect(dela).toHaveLength(2);
        expect(dela[0]?.operador).not.toBe(dela[1]?.operador);
        for (const f of dela) {
          expect(f.texto.startsWith(referenciaDa(m))).toBe(true);
          expect(respostaPeloTexto(f.texto, m)).toEqual({ operador: f.operador, resposta: f.esperado });
        }
      }
    }
  });

  test("a mesma sessão dá as mesmas frases (o F5); outra sessão sorteia de novo", () => {
    const trinca = trincas[10] as (typeof trincas)[number];
    expect(frasesDoCartao(trinca, "a")).toEqual(frasesDoCartao(trinca, "a"));
    const variam = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(frasesDoCartao(trinca, `s${i}`))));
    expect(variam.size).toBeGreaterThan(1);
  });

  test("a referência é quem mandou e o começo do texto — nunca 'mensagem 1'", () => {
    const m = padrao[0] as (typeof padrao)[number];
    expect(referenciaDa(m)).toBe(`A mensagem de ${m.remetente} “Gente, vocês viram isso…”`);
    expect(referenciaDa({ remetente: "Ana", texto: "Oi gente" })).toBe("A mensagem de Ana “Oi gente”");
  });

  test("a régua 5–6 / 3–4 / 0–2 e as chances no chute: 10,9% / 54,7% / 34,4%", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(nivelCO03)).toEqual([
      "nao_atingiu", "nao_atingiu", "nao_atingiu", "em_processo", "em_processo", "atingiu", "atingiu",
    ]);
    expect(() => nivelCO03(7)).toThrow();
    const frases = frasesDoCartao(trincas[0] as (typeof trincas)[number], "chute");
    const conta = { atingiu: 0, em_processo: 0, nao_atingiu: 0 };
    for (let bits = 0; bits < 64; bits++) {
      const respostas = new Map<string, Resposta>(frases.map((f, i) => [f.id, bits & (1 << i) ? "sim" : "nao"]));
      conta[nivelCO03(acertosDoCartao(frases, respostas))] += 1;
    }
    expect(conta).toEqual({ atingiu: 7, em_processo: 35, nao_atingiu: 22 });
  });

  test("responder tudo igual acerta só 3 — em processo, nunca atingiu", () => {
    const frases = frasesDoCartao(trincas[5] as (typeof trincas)[number], "igual");
    for (const r of ["sim", "nao"] as const) {
      const respostas = new Map<string, Resposta>(frases.map((f) => [f.id, r]));
      expect(acertosDoCartao(frases, respostas)).toBe(3);
    }
  });

  test("os acertos por operador somam os acertos", () => {
    const frases = frasesDoCartao(trincas[3] as (typeof trincas)[number], "op");
    const respostas = new Map<string, Resposta>(frases.map((f, i) => [f.id, i % 2 ? f.esperado : "sim"]));
    const por = acertosPorOperador(frases, respostas);
    expect(por.E + por.OU + por.NAO).toBe(acertosDoCartao(frases, respostas));
  });
});

describe("a regra do tio da EF05CO04", () => {
  const r = (condicao: string, ...acoes: string[]) => conferirRegra(condicao, acoes) as Regra;
  /** Todas as regras possíveis: 4 condições × (8 ações sozinhas + 8×7 pares em ordem). */
  const todas: Regra[] = CONDICOES.flatMap((c) =>
    ACOES.flatMap((a1) => [r(c, a1), ...ACOES.filter((a2) => a2 !== a1).map((a2) => r(c, a1, a2))]),
  );

  test("a forma: condição conhecida, 1 ou 2 ações conhecidas, sem repetir", () => {
    expect(todas).toHaveLength(256);
    expect(conferirRegra("chuva", ["esperar"])).toBeNull();
    expect(conferirRegra("urgente_alarmante", [])).toBeNull();
    expect(conferirRegra("urgente_alarmante", ["esperar", "esperar"])).toBeNull();
    expect(conferirRegra("urgente_alarmante", ["esperar", "comparar_fonte", "encaminhar_logo"])).toBeNull();
    expect(conferirRegra("urgente_alarmante", ["voar"])).toBeNull();
  });

  test("o que a regra faz com o áudio: as cinco situações", () => {
    expect(simular(r("link_nao_checado", "comparar_fonte"))).toBe("deixa_passar");
    expect(simular(r("promessa_incrivel", "encaminhar_logo"))).toBe("deixa_passar");
    expect(simular(r("urgente_alarmante", "comparar_fonte"))).toBe("checa");
    expect(simular(r("parente_proximo", "perguntar_adulto", "encaminhar_se_confirmar"))).toBe("checa");
    expect(simular(r("urgente_alarmante", "comparar_fonte", "encaminhar_logo"))).toBe("checa_e_repassa");
    expect(simular(r("urgente_alarmante", "esperar"))).toBe("sem_conferir");
    expect(simular(r("urgente_alarmante", "encaminhar_se_confirmar"))).toBe("sem_conferir");
    expect(simular(r("urgente_alarmante", "encaminhar_logo", "comparar_fonte"))).toBe("repassa_antes");
    expect(simular(r("parente_proximo", "esperar", "encaminhar_pedir"))).toBe("repassa_antes");
  });

  test("encaminhar antes de checar vale para QUALQUER condição (é o não atingiu)", () => {
    expect(repassaSemChecar(r("link_nao_checado", "encaminhar_logo"))).toBe(true);
    expect(repassaSemChecar(r("urgente_alarmante", "comparar_fonte", "encaminhar_logo"))).toBe(false);
    expect(nivelCO04(r("link_nao_checado", "encaminhar_logo"), [])).toBe("nao_atingiu");
  });

  test("a régua lê a PRIMEIRA regra testada e a PRIMEIRA previsão", () => {
    const boa = r("urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar");
    const fraca = r("urgente_alarmante", "esperar");
    const teste = (regra: Regra, previsao: (typeof SITUACOES)[number]) => ({ regra, previsao, situacao: simular(regra) });

    expect(nivelCO04(boa, [teste(boa, "checa")])).toBe("atingiu");
    // Previu errado o que a própria regra faria: não simulou.
    expect(nivelCO04(boa, [teste(boa, "deixa_passar")])).toBe("em_processo");
    // Chegou à regra boa só depois do retorno do teste.
    expect(nivelCO04(boa, [teste(fraca, "sem_conferir"), teste(boa, "checa")])).toBe("em_processo");
    // Enviou sem testar.
    expect(nivelCO04(boa, [])).toBe("em_processo");
    // Testou a boa e enviou outra.
    expect(nivelCO04(fraca, [teste(boa, "checa")])).toBe("em_processo");
    // Checa e encaminha de qualquer jeito: teto em processo.
    const checaERepassa = r("urgente_alarmante", "comparar_fonte", "encaminhar_logo");
    expect(nivelCO04(checaERepassa, [teste(checaERepassa, "checa_e_repassa")])).toBe("em_processo");
    // "Só se confirmar" sem checagem antes não basta.
    const semChecar = r("urgente_alarmante", "encaminhar_se_confirmar");
    expect(nivelCO04(semChecar, [teste(semChecar, "sem_conferir")])).toBe("em_processo");
  });

  test("no chute (regra, previsão e envio ao acaso, um teste): 5,0% atingem", () => {
    const conta = { atingiu: 0, em_processo: 0, nao_atingiu: 0 };
    for (const regra of todas) {
      for (const previsao of SITUACOES) conta[nivelCO04(regra, [{ regra, previsao, situacao: simular(regra) }])] += 1;
    }
    const total = todas.length * SITUACOES.length;
    expect(conta.atingiu).toBe(64);
    expect(Math.round((1000 * conta.atingiu) / total) / 10).toBe(5);
  });

  test("a regra em palavras", () => {
    expect(regraEmPalavras(r("urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar"))).toBe(
      "Se a mensagem for urgente e alarmante, então eu comparo com uma fonte confiável e depois encaminho só se a notícia se confirmar.",
    );
  });
});

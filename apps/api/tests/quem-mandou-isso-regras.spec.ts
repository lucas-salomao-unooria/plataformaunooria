import { colapsarEmUnidades, type EquipeDoMapa } from "../src/equipes/regras";
import { FICHA_EXP05EF1B } from "../src/evidencias/fichas/exp05ef1b";
import { CHAVES_REDIGIDAS } from "../src/observabilidade/redaction";
import {
  CALLBACK_DO_MOTIVO,
  ENCERRAMENTO_DA_NINA,
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
  PEDIDOS,
  avaliar,
  conferirExpressao,
  equivalentes,
  expressaoEmPalavras,
  mesmaExpressao,
  nivelCO03,
  passamNoFiltro,
  pontosDoPedido,
  rotuloNoQuadro,
  tabelaVerdade,
  todasAsExpressoes,
  type Expressao,
} from "../src/quem-mandou-isso/regras/alerta";
import {
  MARCADOR_DA_SELECAO,
  MARCADOR_DO_ALERTA,
  MARCADOR_DO_ROBO,
  nivelCO08,
} from "../src/quem-mandou-isso/regras/evidencia";
import {
  ACOES,
  CONDICOES,
  LACO,
  MENSAGENS_DO_ROBO,
  ROTULO_DA_ACAO,
  ROTULO_DA_CONDICAO,
  TEXTO_DA_SITUACAO,
  conferirRobo,
  ligar,
  nivelCO04,
  pegaOTio,
  repassaSemChecar,
  roboEmPalavras,
  situacaoDasAcoes,
  type Robo,
} from "../src/quem-mandou-isso/regras/robo";
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
  alertaAberto,
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
  test("a ficha é só Canal A (v5): o alerta e o robô do grupo, com rótulo, nenhuma pergunta", () => {
    expect(FICHA_EXP05EF1B.versao).toBe(5);
    expect(FICHA_EXP05EF1B.perguntas).toEqual([]);
    expect(FICHA_EXP05EF1B.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo, Boolean(m.rotulo)])])).toEqual([
      ["EF05CO08", [[MARCADOR_DA_SELECAO, "acao", true]]],
      ["EF05CO03", [[MARCADOR_DO_ALERTA, "acao", true]]],
      ["EF05CO04", [[MARCADOR_DO_ROBO, "acao", true]]],
    ]);
  });

  test("o tio é URGENTE e ALARMANTE e é um PARENTE: são os sinais da 1ª mensagem do robô", () => {
    expect(FALA_DO_TIO).toMatch(/meu tio/);
    expect(FALA_DO_TIO).toMatch(/assustada/);
    expect(FALA_DO_TIO).toMatch(/repassar correndo/);
    expect(MENSAGENS_DO_ROBO[0]).toMatchObject({ remetente: "Tio Paulo", tipo: "audio" });
    expect([...(MENSAGENS_DO_ROBO[0]?.atributos ?? [])].sort()).toEqual(["parente_proximo", "urgente_alarmante"]);
  });

  test("tudo que a criança lê: até 45 palavras e nenhum termo proibido", () => {
    const textos = [
      falaDaNina(PACOTE_PADRAO.tema),
      ENCERRAMENTO_DA_NINA,
      FALA_DO_TIO,
      GRUPO.nome,
      MURAL.nome,
      ...Object.values(ROTULO_DO_MOTIVO),
      ...Object.values(CALLBACK_DO_MOTIVO),
      LACO.rotulo,
      ...Object.values(ROTULO_DA_CONDICAO),
      ...Object.values(ROTULO_DA_ACAO),
      ...Object.values(TEXTO_DA_SITUACAO),
      ...PEDIDOS.map((p) => p.texto),
      ...mensagensDoPadrao().map(rotuloNoQuadro),
      ...MENSAGENS_DO_ROBO.flatMap((m) => [m.remetente, m.texto]),
      roboEmPalavras({ laco: true, condicao: "link_nao_checado", acoes: ["encaminhar_pedir", "perguntar_adulto"] }),
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
  const nada: MarcosDaSessao = { entrou: true, confirmou: false, votou: false, concluiu: false };
  const confirmou = { ...nada, confirmou: true };
  const votou = { ...confirmou, votou: true };
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
    /* Na reflexão, direto ao robô: o alerta não é passo, e não o segura. */
    expect(passoEfetivo(votou, "reflexao")).toBe("regra");
  });

  test("o passo do cartão saiu (2.5.0): o alerta é uma janela da revelação, não um passo", () => {
    expect((PASSOS as readonly string[]).includes("cartao")).toBe(false);
    expect(alertaAberto(votou, "revelacao")).toBe(true);
    for (const fase of [null, "triagem", "explicar", "reflexao"] as const) expect(alertaAberto(votou, fase)).toBe(false);
    expect(alertaAberto(confirmou, "revelacao")).toBe(false);
    expect(alertaAberto(null, "revelacao")).toBe(false);
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
    enviouAlertas: false,
    enviouRobo: false,
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
      enviaramAlertas: 0,
      enviaramRobo: 0,
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

describe("o alerta do grupo da EF05CO03", () => {
  const padrao = mensagensDoPadrao();
  const todas = todasAsExpressoes();
  const F = (nao = false) => ({ attr: "falsa" as const, nao });
  const EMO = (nao = false) => ({ attr: "emocional" as const, nao });

  test("são 36 filtros possíveis, todos diferentes, e a forma exige conector e 2ª condição JUNTOS", () => {
    expect(todas).toHaveLength(36);
    expect(new Set(todas.map((e) => JSON.stringify(e))).size).toBe(36);
    expect(conferirExpressao({ a: F(), op: "E" })).toBeNull();
    expect(conferirExpressao({ a: F(), b: EMO() })).toBeNull();
    expect(conferirExpressao({ a: { attr: "verdadeira", nao: false } })).toBeNull();
    expect(conferirExpressao({ a: F(), op: "XOU", b: EMO() })).toBeNull();
    expect(conferirExpressao({ a: F(), op: "OU", b: EMO(true), extra: 1 })).toEqual({ a: F(), op: "OU", b: EMO(true) });
    expect(conferirExpressao({ a: EMO(true) })).toEqual({ a: EMO(true) });
  });

  test("a tabela-verdade sobre as quatro combinações (VN, VE, FN, FE)", () => {
    expect(tabelaVerdade({ a: F(), op: "E", b: EMO() })).toEqual([false, false, false, true]);
    expect(tabelaVerdade({ a: F(), op: "OU", b: EMO() })).toEqual([false, true, true, true]);
    expect(tabelaVerdade({ a: F(true) })).toEqual([true, true, false, false]);
    expect(tabelaVerdade({ a: F(true), op: "E", b: EMO(true) })).toEqual([true, false, false, false]);
    // A ordem não importa: E e OU comutam.
    expect(equivalentes({ a: EMO(), op: "E", b: F() }, { a: F(), op: "E", b: EMO() })).toBe(true);
    // Mas a mesma expressão é PEÇA A PEÇA: a comutada é equivalente e não é a mesma.
    expect(mesmaExpressao({ a: EMO(), op: "E", b: F() }, { a: F(), op: "E", b: EMO() })).toBe(false);
    expect(mesmaExpressao({ a: F() }, { a: F() })).toBe(true);
  });

  test("os 4 pedidos: E, OU, e os dois que exigem o NÃO — e no banco curado o E deixa passar 2 e o OU, 6", () => {
    expect(PEDIDOS.map((p) => [p.n, expressaoEmPalavras(p.esperada)])).toEqual([
      [1, "Falsa E Emocional"],
      [2, "Falsa OU NÃO Emocional"],
      [3, "NÃO Falsa OU Emocional"],
      [4, "NÃO Falsa E NÃO Emocional"],
    ]);
    expect(PEDIDOS.map((p) => passamNoFiltro(p.esperada, padrao).length)).toEqual([2, 6, 6, 2]);
    /* Cada pedido diz em palavras o que a expressão diz: as mensagens que
       passam são exatamente as do quadrante pedido. */
    const quadrantesQuePassam = (e: Expressao) => [...new Set(padrao.filter((m) => avaliar(e, m)).map(quadranteDe))].sort();
    expect(PEDIDOS.map((p) => quadrantesQuePassam(p.esperada))).toEqual([
      ["FE"],
      ["FE", "FN", "VN"],
      ["FE", "VE", "VN"],
      ["VN"],
    ]);
  });

  test("cada pedido tem EXATAMENTE 2 dos 36 filtros equivalentes (a ordem das duas condições)", () => {
    for (const p of PEDIDOS) expect(todas.filter((e) => equivalentes(e, p.esperada))).toHaveLength(2);
  });

  test("os pontos de um pedido: 2 de primeira, 1 corrigindo, 0 enviando errado", () => {
    const pedido = PEDIDOS[0]!;
    const certa = pedido.esperada;
    const comutada: Expressao = { a: EMO(), op: "E", b: F() };
    const errada: Expressao = { a: F(), op: "OU", b: EMO() };
    expect(pontosDoPedido(pedido, [certa], certa)).toBe(2);
    expect(pontosDoPedido(pedido, [comutada], comutada)).toBe(2);
    expect(pontosDoPedido(pedido, [errada, certa], certa)).toBe(1);
    expect(pontosDoPedido(pedido, [errada, errada, comutada], comutada)).toBe(1);
    expect(pontosDoPedido(pedido, [errada], errada)).toBe(0);
    // Acertou de primeira e trocou por uma errada: o alerta enviado está errado.
    expect(pontosDoPedido(pedido, [certa, errada], errada)).toBe(0);
  });

  test("a régua sobre a soma (0–8): 6–8 atingiu, 3–5 em processo, 0–2 não atingiu", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(nivelCO03)).toEqual([
      "nao_atingiu", "nao_atingiu", "nao_atingiu", "em_processo", "em_processo", "em_processo", "atingiu", "atingiu", "atingiu",
    ]);
    expect(() => nivelCO03(9)).toThrow();
    expect(() => nivelCO03(-1)).toThrow();
  });

  test("no chute (um filtro ao acaso por pedido, executado e enviado): EXAUSTIVO nas 36⁴ = 1.679.616 combinações", () => {
    /* Os pontos de cada um dos 36 filtros em cada pedido, executado uma vez e
       enviado (no chute, a 1ª execução é a enviada: 2 ou 0). */
    const pontos = PEDIDOS.map((p) => todas.map((e) => pontosDoPedido(p, [e], e)));
    const conta = { atingiu: 0, em_processo: 0, nao_atingiu: 0 };
    const [p1, p2, p3, p4] = pontos as [number[], number[], number[], number[]];
    for (const a of p1) for (const b of p2) for (const c of p3) for (const d of p4) conta[nivelCO03(a + b + c + d)] += 1;
    const total = 36 ** 4;
    expect(conta.atingiu + conta.em_processo + conta.nao_atingiu).toBe(total);
    /* Cada pedido certo de primeira vale 2: ≥ 3 certos (6–8) = 4·2³·34 + 2⁴ =
       1.104; exatamente 2 certos (4) = 6·2²·34² = 27.744; o resto (0 ou 2
       pontos) não atinge. */
    expect(conta).toEqual({ atingiu: 1104, em_processo: 27744, nao_atingiu: 1650768 });
    const pct = (n: number) => Math.round((10000 * n) / total) / 100;
    expect([pct(conta.atingiu), pct(conta.em_processo), pct(conta.nao_atingiu)]).toEqual([0.07, 1.65, 98.28]);
  });

  test("o rótulo do quadro é derivado do remetente — nunca 'mensagem 1'", () => {
    expect(rotuloNoQuadro({ remetente: "Pedro Henrique" })).toBe("Mensagem de Pedro Henrique");
  });
});

describe("o robô do grupo da EF05CO04", () => {
  const r = (laco: boolean, condicao: string, ...acoes: string[]) => conferirRobo(laco, condicao, acoes) as Robo;
  /** As sequências de ação: 8 sozinhas + 8×7 pares em ordem. */
  const sequencias = ACOES.flatMap((a1) => [[a1], ...ACOES.filter((a2) => a2 !== a1).map((a2) => [a1, a2])]);
  /** Todos os robôs possíveis: 2 (laço) × 4 condições × 64 sequências. */
  const todos: Robo[] = [false, true].flatMap((laco) => CONDICOES.flatMap((c) => sequencias.map((s) => r(laco, c, ...s))));

  test("a forma: condição conhecida, 1 ou 2 ações conhecidas, sem repetir", () => {
    expect(sequencias).toHaveLength(64);
    expect(todos).toHaveLength(512);
    expect(conferirRobo(true, "chuva", ["esperar"])).toBeNull();
    expect(conferirRobo(true, "urgente_alarmante", [])).toBeNull();
    expect(conferirRobo(true, "urgente_alarmante", ["esperar", "esperar"])).toBeNull();
    expect(conferirRobo(true, "urgente_alarmante", ["esperar", "comparar_fonte", "encaminhar_logo"])).toBeNull();
    expect(conferirRobo(false, "urgente_alarmante", ["voar"])).toBeNull();
  });

  test("as quatro mensagens: os sinais abertos, e a vizinha é o controle (sem sinal)", () => {
    expect(MENSAGENS_DO_ROBO.map((m) => [m.remetente, m.tipo, [...m.atributos]])).toEqual([
      ["Tio Paulo", "audio", ["urgente_alarmante", "parente_proximo"]],
      ["Banco Seguro", "texto", ["link_nao_checado"]],
      ["Dona Rita, vizinha", "texto", []],
      ["Corrente", "texto", ["promessa_incrivel"]],
    ]);
    expect(CONDICOES.filter(pegaOTio)).toEqual(["urgente_alarmante", "parente_proximo"]);
  });

  test("o que as ações fazem com uma mensagem pega: as quatro situações", () => {
    expect(situacaoDasAcoes(["comparar_fonte"])).toBe("checa");
    expect(situacaoDasAcoes(["perguntar_adulto", "encaminhar_se_confirmar"])).toBe("checa");
    expect(situacaoDasAcoes(["comparar_fonte", "encaminhar_logo"])).toBe("checa_e_repassa");
    expect(situacaoDasAcoes(["esperar"])).toBe("sem_conferir");
    expect(situacaoDasAcoes(["encaminhar_se_confirmar"])).toBe("sem_conferir");
    expect(situacaoDasAcoes(["encaminhar_logo", "comparar_fonte"])).toBe("repassa_antes");
    expect(situacaoDasAcoes(["esperar", "encaminhar_pedir"])).toBe("repassa_antes");
  });

  test("ligado SEM laço, o robô só olha a 1ª mensagem; COM laço, as quatro — e a condição decide quem passa", () => {
    const semLaco = ligar(r(false, "urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar"));
    expect(semLaco.resultados.map((x) => x.situacao)).toEqual(["checa", "nao_olhou", "nao_olhou", "nao_olhou"]);
    expect(semLaco.resumo).toBe("O robô tratou 1 das 4 mensagens.");
    expect(semLaco.resultados[1]?.texto).toBe("O robô não olhou esta mensagem");

    const comLaco = ligar(r(true, "urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar"));
    expect(comLaco.resultados.map((x) => x.situacao)).toEqual(["checa", "passou", "passou", "passou"]);
    expect(comLaco.resumo).toBe("O robô tratou as 4 mensagens.");
    expect(comLaco.resultados[1]?.texto).toBe("Passou direto: a regra não pegou");

    const doLink = ligar(r(true, "link_nao_checado", "esperar"));
    expect(doLink.resultados.map((x) => x.situacao)).toEqual(["passou", "sem_conferir", "passou", "passou"]);
    // A vizinha (controle) passa direto com QUALQUER condição.
    for (const robo of todos.filter((x) => x.laco)) expect(ligar(robo).resultados[2]?.situacao).toBe("passou");
  });

  test("encaminhar antes de checar vale para QUALQUER condição (é o não atingiu)", () => {
    expect(repassaSemChecar(["encaminhar_logo"])).toBe(true);
    expect(repassaSemChecar(["comparar_fonte", "encaminhar_logo"])).toBe(false);
    expect(nivelCO04(r(true, "link_nao_checado", "encaminhar_logo"), [])).toBe("nao_atingiu");
  });

  test("a régua lê o ENVIADO e a PRIMEIRA ligação", () => {
    const bom = r(true, "urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar");
    expect(nivelCO04(bom, [bom])).toBe("atingiu");
    expect(nivelCO04(r(true, "parente_proximo", "perguntar_adulto"), [r(true, "urgente_alarmante", "conferir_origem")])).toBe("atingiu");
    // Sem laço: só olha o tio — cobre 1 das 3 mensagens de risco.
    const semLaco = r(false, "urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar");
    expect(nivelCO04(semLaco, [semLaco])).toBe("em_processo");
    // Chegou ao bom só depois de ver o robô ligado.
    expect(nivelCO04(bom, [semLaco, bom])).toBe("em_processo");
    // Enviou sem ligar.
    expect(nivelCO04(bom, [])).toBe("em_processo");
    // Ligou o bom e enviou outro.
    expect(nivelCO04(r(true, "urgente_alarmante", "esperar"), [bom])).toBe("em_processo");
    // A condição não pega o tio.
    const doLink = r(true, "link_nao_checado", "comparar_fonte");
    expect(nivelCO04(doLink, [doLink])).toBe("em_processo");
    // Checa e encaminha de qualquer jeito.
    const checaERepassa = r(true, "urgente_alarmante", "comparar_fonte", "encaminhar_logo");
    expect(nivelCO04(checaERepassa, [checaERepassa])).toBe("em_processo");
    // "Só se confirmar" sem checagem antes não basta.
    const semChecar = r(true, "urgente_alarmante", "encaminhar_se_confirmar");
    expect(nivelCO04(semChecar, [semChecar])).toBe("em_processo");
  });

  test("no chute (robô ao acaso, ligado uma vez e enviado): EXAUSTIVO nos 512 robôs", () => {
    const conta = { atingiu: 0, em_processo: 0, nao_atingiu: 0 };
    for (const robo of todos) conta[nivelCO04(robo, [robo])] += 1;
    /* Atingem: laço × 2 condições que pegam o tio × 32 sequências que checam
       = 64. Não atingem: as 20 sequências que encaminham antes de checar, em
       qualquer laço e condição = 2 × 4 × 20 = 160. */
    expect(conta).toEqual({ atingiu: 64, em_processo: 288, nao_atingiu: 160 });
    const pct = (n: number) => Math.round((10000 * n) / todos.length) / 100;
    expect([pct(conta.atingiu), pct(conta.em_processo), pct(conta.nao_atingiu)]).toEqual([12.5, 56.25, 31.25]);
    // Enviado sem ligar: ninguém atinge.
    expect(todos.filter((robo) => nivelCO04(robo, []) === "atingiu")).toHaveLength(0);
  });

  test("o robô em palavras, com e sem laço", () => {
    expect(roboEmPalavras(r(true, "urgente_alarmante", "comparar_fonte", "encaminhar_se_confirmar"))).toBe(
      "Para cada mensagem nova, se a mensagem for urgente e alarmante, o robô compara com fonte confiável e depois encaminha só se confirmar.",
    );
    expect(roboEmPalavras(r(false, "link_nao_checado", "esperar"))).toBe(
      "Se a mensagem tiver link que ninguém checou, o robô espera antes de encaminhar.",
    );
  });
});

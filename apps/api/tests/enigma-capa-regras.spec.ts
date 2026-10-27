import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARTAS_DOS_PARES,
  CHAVES_DE_CENA,
  CHAVES_PRONTAS,
  DISCIPLINAS,
  ELEMENTOS_DA_SEGUNDA_FOTO,
  FASES,
  FOTOS,
  MOTIVOS_DO_PAR,
  ORIGENS,
  PACOTES_PRONTOS,
  PRONTO_DA_DISCIPLINA,
  RECORTE_DA_FOTO,
  ROTULO_DA_DISCIPLINA,
  SELOS,
  TEXTOS,
  VERSAO_DO_INSTRUMENTO,
  conteudoPronto,
  fraseDaMissao,
  fraseDoFora,
  type ConteudoDoPacote,
} from "../src/enigma-capa/conteudo";
import { componentesDoAno } from "../src/curriculo/componentes";
import { ConteudoBaseSchema, ForaSchema, IniciarSchema, LupaSchema, MaterialSchema, PainelSchema, SessaoSchema } from "../src/enigma-capa/contrato-de-rotas";
import { roteiroDoPodcast } from "../src/enigma-capa/podcast";
import { conteudoDaCenaGerada, pedidoDeImagem, validarSaidaDoPreparo, type CenaGerada } from "../src/enigma-capa/prompts";
import {
  MARCADOR_CO01,
  MARCADOR_CO05,
  grauDaLupa,
  grauDoFora,
  grauDoSelo,
  grauDosInvariantes,
  nivelCO01,
  nivelCO05,
  type Grau,
} from "../src/enigma-capa/regras/evidencia";
import {
  acertaAlvo,
  alvoNaFaixaComum,
  essencialVisivelNaSegunda,
  falaDaVisitante,
  fracaoDentro,
  itensFora,
  retanguloVisivel,
} from "../src/enigma-capa/regras/geometria";
import { tocar, type BuscaDaSessao } from "../src/enigma-capa/regras/invariantes";
import { acumularLupa, pisoCumprido } from "../src/enigma-capa/regras/lupa";
import { problemasDoConteudo } from "../src/enigma-capa/regras/pacote";
import { parCorreto } from "../src/enigma-capa/regras/pares";
import { avancarFase, passoEfetivo, type MarcosDaSessao } from "../src/enigma-capa/regras/passos";
import { FICHA_EXP02EF1B } from "../src/evidencias/fichas/exp02ef1b";

/**
 * O Enigma da Capa da Rádio (exp02ef1b, ADR-184; 2.0.0, ADR-186) SEM banco: a
 * geometria (o recorte visível, o alvo redondo, a faixa comum), a visitante, o
 * "fora", a segunda foto, o piso da lupa, a busca com a ajuda, os pares, o
 * passo, as tabelas-verdade das duas habilidades, a régua do pacote (os três
 * prontos e a saída da IA), as disciplinas, os textos e o espelho dos CHECKs
 * das migrations.
 */

const biblioteca = () => conteudoPronto("biblioteca");

describe("a geometria", () => {
  test("a moldura (80% × 80%) desliza dentro do recorte, sem mudar de tamanho e sem mostrar vazio", () => {
    const r = RECORTE_DA_FOTO["foto-1"];
    expect(retanguloVisivel(r, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: r.w * 0.8, h: 80 });
    const fim = retanguloVisivel(r, { x: 1, y: 1 });
    expect(fim.x + fim.w).toBeCloseTo(r.x + r.w);
    expect(fim.y + fim.h).toBeCloseTo(100);
    /* Fora de [0, 1] é limitado: a moldura nunca sai da foto. */
    expect(retanguloVisivel(r, { x: 5, y: -3 })).toEqual(retanguloVisivel(r, { x: 1, y: 0 }));
    const f2 = retanguloVisivel(RECORTE_DA_FOTO["foto-2"], { x: 0, y: 0 });
    expect(f2.x).toBe(RECORTE_DA_FOTO["foto-2"].x);
  });

  test("o alvo é redondo na TELA: um ponto de altura vale 9/16 de um de largura", () => {
    const alvo = { x: 50, y: 50, r: 7 };
    expect(acertaAlvo(alvo, { x: 57, y: 50 })).toBe(true);
    expect(acertaAlvo(alvo, { x: 57.1, y: 50 })).toBe(false);
    /* 12 pontos de altura = 6,75 de largura: dentro. */
    expect(acertaAlvo(alvo, { x: 50, y: 62 })).toBe(true);
    expect(acertaAlvo(alvo, { x: 50, y: 63 })).toBe(false);
  });

  test("a faixa comum: x − r ≥ 32 e x + r ≤ 68", () => {
    expect(alvoNaFaixaComum({ x: 39, y: 30, r: 7 })).toBe(true);
    expect(alvoNaFaixaComum({ x: 61, y: 30, r: 7 })).toBe(true);
    expect(alvoNaFaixaComum({ x: 38.9, y: 30, r: 7 })).toBe(false);
    expect(alvoNaFaixaComum({ x: 61.1, y: 30, r: 7 })).toBe(false);
    /* A altura também: o círculo não pode sair pelo topo. */
    expect(alvoNaFaixaComum({ x: 50, y: 5, r: 7 })).toBe(false);
  });

  test("a fração dentro: área nula é zero", () => {
    expect(fracaoDentro({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(0.5);
    expect(fracaoDentro({ x: 0, y: 0, w: 0, h: 10 }, { x: 0, y: 0, w: 100, h: 100 })).toBe(0);
  });
});

describe("a visitante só conhece o que o recorte mostrou", () => {
  const foto = { nucleo: { x: 0, y: 60, w: 20, h: 40 }, visitante: "Na foto, vi crianças lendo!" };
  test("com metade ou mais do núcleo na capa, a fala da foto", () => {
    expect(falaDaVisitante(foto, retanguloVisivel(RECORTE_DA_FOTO["foto-1"], { x: 0, y: 1 }), "a biblioteca")).toEqual({
      nucleoVisivel: true,
      fala: "Na foto, vi crianças lendo!",
    });
  });
  test("com a ação cortada, só o lugar", () => {
    expect(falaDaVisitante(foto, retanguloVisivel(RECORTE_DA_FOTO["foto-1"], { x: 1, y: 0 }), "a biblioteca")).toEqual({
      nucleoVisivel: false,
      fala: "Na foto, vi a biblioteca!",
    });
  });
  test("na biblioteca anotada, a capa centrada mostra a ação das duas fotos", () => {
    const c = biblioteca();
    for (const f of c.cena.fotos) {
      expect(falaDaVisitante(f, retanguloVisivel(f.recorte, { x: 0.5, y: 0.5 }), c.cena.espacoCurto).fala).toBe(f.visitante);
    }
  });
});

describe('o "o que ficou fora"', () => {
  test("conta o marcável TOCADO com metade ou mais da área fora da capa", () => {
    const c = biblioteca();
    const visivel = retanguloVisivel(RECORTE_DA_FOTO["foto-1"], { x: 0.5, y: 0.5 });
    const toques = [
      { x: 80, y: 70 }, // o tapete dos fantoches: fora
      { x: 20, y: 60 }, // a mesa de leitura: estava na capa
      { x: 50, y: 95 }, // o vazio
    ];
    expect(itensFora(c.cena.marcaveis, visivel, toques)).toEqual(["tapete-fantoches"]);
    expect(itensFora(c.cena.marcaveis, visivel, [])).toEqual([]);
    expect(itensFora(c.cena.marcaveis, visivel, [{ x: 80, y: 70 }, { x: 98, y: 65 }])).toEqual(["tapete-fantoches", "estante-direita"]);
  });
  test("a frase leva o artigo do espaço", () => {
    expect(fraseDoFora("a biblioteca")).toBe("Marque na biblioteca o que ficou fora da sua foto.");
    expect(fraseDoFora("o museu")).toBe("Marque no museu o que ficou fora da sua foto.");
  });
  test("o Pronto exige ao menos um alfinete (e no máximo 10)", () => {
    expect(ForaSchema.safeParse({ toques: [] }).success).toBe(false);
    expect(ForaSchema.safeParse({ toques: [{ x: 80, y: 70 }] }).success).toBe(true);
    expect(ForaSchema.safeParse({ toques: Array.from({ length: 11 }, () => ({ x: 1, y: 1 })) }).success).toBe(false);
  });
});

describe("a segunda foto (E5)", () => {
  test("a moldura 55% × 85% PODE deixar a criança lendo de fora", () => {
    expect(essencialVisivelNaSegunda({ x: 0, y: 0 })).toBe(true);
    expect(essencialVisivelNaSegunda({ x: 1, y: 0.5 })).toBe(false);
  });
});

describe("a lupa (E2): os dois objetos do fundo", () => {
  const zero = { alvo1Ms: 0, alvo2Ms: 0 };
  test("guarda o máximo de cada objeto, limitado ao tempo desde a entrada", () => {
    const a = acumularLupa(zero, { alvo1Ms: 4000, alvo2Ms: 9000 }, 5000);
    expect(a).toEqual({ alvo1Ms: 4000, alvo2Ms: 5000 });
    /* O relato atrasado não apaga o novo. */
    expect(acumularLupa(a, { alvo1Ms: 100, alvo2Ms: 100 }, 9000)).toEqual({ alvo1Ms: 4000, alvo2Ms: 5000 });
  });
  test("o piso: 3 s em CADA um dos dois", () => {
    expect(pisoCumprido({ alvo1Ms: 3000, alvo2Ms: 3000 })).toBe(true);
    expect(pisoCumprido({ alvo1Ms: 2999, alvo2Ms: 3000 })).toBe(false);
    expect(pisoCumprido({ alvo1Ms: 9000, alvo2Ms: 0 })).toBe(false);
  });
  test("o relato é dos dois objetos, não das fotos nem do fundo", () => {
    expect(LupaSchema.safeParse({ alvo1Ms: 0, alvo2Ms: 0, avancar: false }).success).toBe(true);
    expect(Object.keys(LupaSchema.shape).sort()).toEqual(["alvo1Ms", "alvo2Ms", "avancar"]);
  });
});

describe("a busca dos invariantes (E4)", () => {
  const invs = biblioteca().cena.invariantes;
  const [relogio, cartaz] = invs.map((i) => i.alvo!);
  const vazia: BuscaDaSessao = { encontrados: [], erros: 0, ajuda: false, errosPosAjuda: 0 };
  const aplicar = (b: BuscaDaSessao, foto: "foto-1" | "foto-2", p: { x: number; y: number }) => {
    const r = tocar(b, invs, foto, p);
    if (!r.ok) throw new Error(r.motivo);
    return r;
  };

  test("quatro achados (2 objetos × 2 fotos) completam; tocar de novo não conta", () => {
    let b = vazia;
    b = aplicar(b, "foto-1", relogio!).busca;
    const repetido = aplicar(b, "foto-1", relogio!);
    expect(repetido).toMatchObject({ acerto: "inv-1", mudou: false });
    b = aplicar(b, "foto-2", relogio!).busca;
    b = aplicar(b, "foto-1", cartaz!).busca;
    const fim = aplicar(b, "foto-2", cartaz!);
    expect(fim.completou).toBe(true);
    expect(fim.busca.erros).toBe(0);
    expect(nivelCO01(fim.busca)).toBe("atingiu");
  });

  test("no 3º erro a ajuda acende; os erros depois dela contam à parte", () => {
    let b = vazia;
    const longe = { x: 10, y: 90 };
    b = aplicar(b, "foto-1", longe).busca;
    b = aplicar(b, "foto-1", longe).busca;
    const terceiro = aplicar(b, "foto-1", longe);
    expect(terceiro).toMatchObject({ ajudaAcendeu: true, busca: { erros: 3, ajuda: true } });
    const depois = aplicar(terceiro.busca, "foto-1", longe).busca;
    expect(depois).toMatchObject({ erros: 3, errosPosAjuda: 1 });
    expect(nivelCO01(depois)).toBe("em_processo");
    expect(nivelCO01({ ajuda: true, errosPosAjuda: 3 })).toBe("nao_atingiu");
  });

  test("o toque fora do recorte da foto é recusado (defeito da tela, não erro da criança)", () => {
    expect(tocar(vazia, invs, "foto-1", { x: 90, y: 50 })).toEqual({ ok: false, motivo: "fora-da-foto" });
    expect(tocar(vazia, invs, "foto-2", { x: 10, y: 50 })).toEqual({ ok: false, motivo: "fora-da-foto" });
  });
});

describe("os pares (E5)", () => {
  test("o par certo é o da ATIVIDADE; a cor é o distrator", () => {
    expect(parCorreto(["carta-a", "carta-c"])).toBe(true);
    expect(parCorreto(["carta-d", "carta-b"])).toBe(true);
    expect(parCorreto(["carta-a", "carta-d"])).toBe(false);
    expect(parCorreto(["carta-b", "carta-c"])).toBe(false);
    expect(parCorreto(["carta-a", "carta-a"])).toBeNull();
    expect(parCorreto(["carta-a", "carta-z"])).toBeNull();
  });
});

describe("o passo e a fase", () => {
  const nada: MarcosDaSessao = {
    lupaLiberada: false,
    publicou: false,
    invariantesCompletos: false,
    panoramicaAberta: false,
    marcouFora: false,
    formouPar: false,
    concluiu: false,
  };
  test("o passo é derivado — e a capa espera a virada GERAL", () => {
    expect(passoEfetivo(null, "aberta")).toBe("inicio");
    expect(passoEfetivo(nada, "aberta")).toBe("lupa");
    expect(passoEfetivo({ ...nada, lupaLiberada: true }, "virada")).toBe("decidir");
    const publicou = { ...nada, lupaLiberada: true, publicou: true };
    expect(passoEfetivo(publicou, "aberta")).toBe("feed");
    expect(passoEfetivo(publicou, "virada")).toBe("invariantes");
    expect(passoEfetivo({ ...publicou, invariantesCompletos: true }, "virada")).toBe("slider");
    expect(passoEfetivo({ ...publicou, invariantesCompletos: true, panoramicaAberta: true }, "virada")).toBe("fora");
    expect(passoEfetivo({ ...publicou, invariantesCompletos: true, panoramicaAberta: true, marcouFora: true }, "virada")).toBe("pares");
    const quase = { ...publicou, invariantesCompletos: true, panoramicaAberta: true, marcouFora: true, formouPar: true };
    expect(passoEfetivo(quase, "virada")).toBe("segunda-foto");
    /* A segunda foto conclui. */
    expect(passoEfetivo({ ...quase, concluiu: true }, "aberta")).toBe("concluida");
  });
  test("o ABRIR BANCADA não tem corpo", () => {
    expect(IniciarSchema.safeParse({}).success).toBe(true);
    expect(IniciarSchema.safeParse({ escolha: "qualquer" }).success).toBe(false);
  });
  test("a fase só anda para a frente", () => {
    expect(avancarFase("aberta", "virada")).toBe("virada");
    expect(avancarFase("virada", "aberta")).toBe("virada");
  });
});

describe("a régua (100% Canal A)", () => {
  test("os graus dos indicadores", () => {
    expect([0, 1, 2, 5].map(grauDaLupa)).toEqual(["pleno", "parcial", "ausente", "ausente"]);
    expect([true, false].map(grauDoSelo)).toEqual(["pleno", "ausente"]);
    expect(grauDosInvariantes({ ajuda: false, errosPosAjuda: 0 })).toBe("pleno");
    expect(grauDosInvariantes({ ajuda: true, errosPosAjuda: 2 })).toBe("parcial");
    expect(grauDosInvariantes({ ajuda: true, errosPosAjuda: 3 })).toBe("ausente");
    expect([0, 1, 3].map(grauDoFora)).toEqual(["ausente", "pleno", "pleno"]);
  });

  test("EF02CO05: a tabela-verdade INTEIRA, com o \"fora\" (3 × 2 × 3 × 2 combinações)", () => {
    const tres: Grau[] = ["pleno", "parcial", "ausente"];
    const dois: Grau[] = ["pleno", "ausente"];
    let combinacoes = 0;
    for (const lupa of tres)
      for (const selo of dois)
        for (const invariantes of tres)
          for (const fora of dois) {
            combinacoes += 1;
            const n = nivelCO05({ lupa, selo, invariantes, fora });
            const todosPlenos = [lupa, selo, invariantes, fora].every((g) => g === "pleno");
            const naoAtingiu = fora === "ausente" && [lupa, selo, invariantes].includes("ausente");
            expect(n).toBe(todosPlenos ? "atingiu" : naoAtingiu ? "nao_atingiu" : "em_processo");
          }
    expect(combinacoes).toBe(36);
  });

  test("EF02CO05: o AJUSTE do não atingiu — nada marcado fora, sozinho, é em processo; com mais um ausente, não atingiu", () => {
    const plenos = { lupa: "pleno", selo: "pleno", invariantes: "pleno" } as const;
    expect(nivelCO05({ ...plenos, fora: "pleno" })).toBe("atingiu");
    expect(nivelCO05({ ...plenos, fora: "ausente" })).toBe("em_processo");
    expect(nivelCO05({ ...plenos, selo: "ausente", fora: "ausente" })).toBe("nao_atingiu");
    expect(nivelCO05({ ...plenos, lupa: "ausente", fora: "ausente" })).toBe("nao_atingiu");
    expect(nivelCO05({ ...plenos, invariantes: "ausente", fora: "ausente" })).toBe("nao_atingiu");
    expect(nivelCO05({ ...plenos, lupa: "parcial", fora: "ausente" })).toBe("em_processo");
    expect(nivelCO05({ ...plenos, selo: "ausente", fora: "pleno" })).toBe("em_processo");
    expect(nivelCO05({ ...plenos, lupa: "parcial", fora: "pleno" })).toBe("em_processo");
  });

  test("EF02CO01: a tabela-verdade", () => {
    expect(nivelCO01({ ajuda: false, errosPosAjuda: 0 })).toBe("atingiu");
    expect(nivelCO01({ ajuda: true, errosPosAjuda: 0 })).toBe("em_processo");
    expect(nivelCO01({ ajuda: true, errosPosAjuda: 2 })).toBe("em_processo");
    expect(nivelCO01({ ajuda: true, errosPosAjuda: 3 })).toBe("nao_atingiu");
  });

  test("os marcadores da régua são os da ficha (versão 2)", () => {
    const marcadores = FICHA_EXP02EF1B.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => m.id)]);
    expect(marcadores).toEqual([
      ["EF02CO05", [MARCADOR_CO05]],
      ["EF02CO01", [MARCADOR_CO01]],
    ]);
    expect(FICHA_EXP02EF1B.versao).toBe(2);
    expect(FICHA_EXP02EF1B.perguntas).toEqual([]);
    expect(FICHA_EXP02EF1B.habilidades[0]!.marcadores[0]!.rotulo).toBe("A capa da rádio e o que ficou fora");
    expect(VERSAO_DO_INSTRUMENTO).toBe("2.0.0");
  });
});

describe("a régua do pacote", () => {
  test.each(CHAVES_PRONTAS)("o pronto %s passa (com os alvos obrigatórios) e cabe no Zod", (chave) => {
    const c = conteudoPronto(chave);
    expect(problemasDoConteudo(c, { exigirAlvos: true })).toEqual([]);
    expect(ConteudoBaseSchema.safeParse(c).success).toBe(true);
  });

  test("conteudoPronto é uma CÓPIA: mexer nela não suja o catálogo", () => {
    const c = conteudoPronto("biblioteca");
    c.cena.selos[0]!.texto = "OUTRO";
    expect(PACOTES_PRONTOS.biblioteca.conteudo.cena.selos[0]!.texto).toBe("SILÊNCIO PARA LER");
  });

  test("cobra a mecânica inteira, com TODAS as frases de uma vez", () => {
    const c: ConteudoDoPacote = conteudoPronto("biblioteca");
    c.cena.invariantes[0]!.alvo = { x: 20, y: 30, r: 7 };
    c.cena.invariantes[1]!.alvo = null;
    c.cena.selos[0]!.texto = "silêncio para ler bem";
    c.cena.fotos[0]!.visitante = "Vi crianças lendo.";
    c.cena.fotos[1]!.seloCoerente = "selo-1";
    c.cena.fotos[1]!.recorte = { x: 30, y: 0, w: 70, h: 100 };
    const p = problemasDoConteudo(c, { exigirAlvos: true }).join(" | ");
    expect(p).toMatch(/RELÓGIO precisa estar na parte do meio/);
    expect(p).toMatch(/Toque no CARTAZ AMARELO/);
    expect(p).toMatch(/CAIXA ALTA/);
    expect(p).toMatch(/passa de 3 palavras/);
    expect(p).toMatch(/Na foto, vi …!/);
    expect(p).toMatch(/SEU selo/);
    expect(p).toMatch(/recorte da foto-2 é fixo/);
    /* Sem exigir os alvos (a saída da IA), o nulo passa. */
    const semAlvos = conteudoPronto("horta");
    semAlvos.cena.invariantes.forEach((i) => (i.alvo = null));
    expect(problemasDoConteudo(semAlvos, { exigirAlvos: false })).toEqual([]);
    expect(problemasDoConteudo(semAlvos, { exigirAlvos: true })).toHaveLength(2);
  });

  test("dois alvos colados são recusados", () => {
    const c = conteudoPronto("biblioteca");
    c.cena.invariantes[1]!.alvo = { x: 46, y: 20, r: 7 };
    expect(problemasDoConteudo(c, { exigirAlvos: true }).join(" ")).toMatch(/colados/);
  });
});

describe("a saída da IA do preparo", () => {
  const boa: CenaGerada = {
    espaco: "Quadra da Escola",
    espacoCurto: "A quadra",
    alt: "A quadra inteira: à esquerda, crianças jogando vôlei; à direita, crianças descansando na arquibancada.",
    atividade1: { acao: "Jogo de vôlei", visitante: "Na foto, vi crianças jogando!", selo: { texto: "hora do jogo", emoji: "🏐" }, descricao: "crianças jogando vôlei" },
    atividade2: { acao: "Descanso na arquibancada", visitante: "Na foto, vi crianças descansando!", selo: { texto: "HORA DE DESCANSAR", emoji: "😴" }, descricao: "crianças sentadas na arquibancada" },
    invariantes: [
      { nome: "relógio", descricao: "um relógio redondo de parede azul" },
      { nome: "BANDEIRA VERDE", descricao: "uma bandeira verde lisa" },
    ],
  };

  test("a forma e a régua; os alvos nascem nulos e o layout é o gabarito da cena gerada", () => {
    const g = validarSaidaDoPreparo(boa);
    const c = conteudoDaCenaGerada(g, "https://midia.exemplo/cena.webp");
    expect(c.cena).toMatchObject({ chave: "ia", espacoCurto: "a quadra", imagem: { tipo: "url" } });
    expect(c.cena.selos.map((s) => s.texto)).toEqual(["HORA DO JOGO", "HORA DE DESCANSAR"]);
    expect(c.cena.invariantes.map((i) => [i.nome, i.alvo])).toEqual([
      ["RELÓGIO", null],
      ["BANDEIRA VERDE", null],
    ]);
    expect(problemasDoConteudo(c, { exigirAlvos: false })).toEqual([]);
  });

  test("a ação longa (seis palavras, mais de 40 letras) vira marcável legível pelo contrato", () => {
    const longa = "Crianças observando joaninhas nas folhas verdes";
    const g = validarSaidaDoPreparo({ ...boa, atividade2: { ...boa.atividade2, acao: longa } });
    const c = conteudoDaCenaGerada(g, "https://midia.exemplo/cena.webp");
    expect(c.cena.marcaveis[1]!.nome).toBe(longa.toLocaleUpperCase("pt-BR"));
    expect(ConteudoBaseSchema.safeParse(c).success).toBe(true);
  });

  test("fora da FORMA do contrato, a tentativa é recusada antes de ser gravada", () => {
    expect(() =>
      validarSaidaDoPreparo({ ...boa, invariantes: [{ nome: "UM OBJETO COM UM NOME COMPRIDO DEMAIS", descricao: "x" }, boa.invariantes[1]!] }),
    ).toThrow(/fora do formato/);
  });

  test("fora da régua, a tentativa é recusada (e regerada pelo provider)", () => {
    expect(() => validarSaidaDoPreparo({ ...boa, invariantes: [boa.invariantes[0]] })).toThrow(/dois objetos/);
    expect(() => validarSaidaDoPreparo({ ...boa, atividade1: { ...boa.atividade1, visitante: "Vi crianças." } })).toThrow(/Na foto, vi/);
  });

  test('o pedido de imagem diz "ilustração", nunca "foto", e põe os objetos no centro', () => {
    const p = pedidoDeImagem(boa);
    expect(p).toMatch(/^Ilustração/);
    expect(p).not.toMatch(/\bfoto/i);
    expect(p).toMatch(/16:9/);
    expect(p).toMatch(/CENTRO/);
    expect(p).toMatch(/nenhum texto escrito/);
    /* A cena LIMPA (ADR-186): parede lisa, poucos objetos, os dois do centro grandes e sozinhos. */
    expect(p).toMatch(/LIMPA/);
    expect(p).toMatch(/paredes lisas/);
    expect(p).toMatch(/No máximo 2 crianças/);
    expect(p).toMatch(/GRANDES/);
    expect(p).toMatch(/SOZINHOS naquela parede/);
  });
});

describe("as disciplinas do recorte: todo o 2º ano, Computação e Outro componente", () => {
  test("a lista é a do catálogo, na ordem, com as duas no fim", () => {
    expect([...DISCIPLINAS]).toEqual([...componentesDoAno("2EF").map((c) => c.slug), "computacao", "outra"]);
    expect(ROTULO_DA_DISCIPLINA).toMatchObject({ "lingua-portuguesa": "Língua Portuguesa", computacao: "Computação", outra: "Outro componente" });
    expect(Object.values(ROTULO_DA_DISCIPLINA).every((r) => !/-/.test(r))).toBe(true);
  });
  test("o pronto da disciplina: Ciências → Horta; História e Geografia → Museu; o resto → Biblioteca", () => {
    for (const d of DISCIPLINAS) {
      const esperado = d === "ciencias" ? "horta" : d === "historia" || d === "geografia" ? "museu" : "biblioteca";
      expect([d, PRONTO_DA_DISCIPLINA[d]]).toEqual([d, esperado]);
    }
  });
  test("o material do guia leva as disciplinas", () => {
    expect(Object.keys(MaterialSchema.shape)).toContain("disciplinas");
  });
});

describe("os textos da tela (o protótipo)", () => {
  test("a missão do card leva o artigo contraído do espaço, em CAIXA ALTA", () => {
    expect(fraseDaMissao("a biblioteca")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DA BIBLIOTECA");
    expect(fraseDaMissao("o museu")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DO MUSEU");
    expect(fraseDaMissao("as salas")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DAS SALAS");
    expect(fraseDaMissao("os corredores")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DOS CORREDORES");
    expect(fraseDaMissao("Pátio")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DE PÁTIO");
  });
  test("os grupos: e1 a e5 e os erros — sem etapa 6", () => {
    expect(Object.keys(TEXTOS)).toEqual(["e1", "e2", "e3", "e4", "e5", "erros"]);
    expect(TEXTOS.e1).toMatchObject({ tag: "RASCUNHO PENDENTE", titulo: "INVESTIGAR A NOVA CAPA", abrir: "ABRIR BANCADA" });
    expect(TEXTOS.e2.alerta).toBe("OLHE O FUNDO");
    expect(TEXTOS.e3.publicada).toBe("CAPA PUBLICADA!");
    expect(TEXTOS.e5.guardada).toBe("FOTO GUARDADA NO ÁLBUM!");
  });
});

describe("a saída do estudante não tem lugar para o gabarito", () => {
  test("o schema da sessão não conhece núcleo, visitante da foto, coerência, alvo nem marcáveis", () => {
    const cena = SessaoSchema.shape.cena.unwrap().shape;
    expect(Object.keys(cena.fotos.element.shape).sort()).toEqual(["acao", "id", "recorte"]);
    expect(Object.keys(cena.selos.element.shape).sort()).toEqual(["emoji", "id", "texto"]);
    expect(Object.keys(cena.invariantes.element.shape).sort()).toEqual(["id", "nome"]);
    expect(Object.keys(cena)).not.toContain("marcaveis");
    expect(Object.keys(SessaoSchema.shape.material.shape.cartas.element.shape).sort()).toEqual(["id", "imagem"]);
    expect(Object.keys(SessaoSchema.shape.material.shape).sort()).toEqual(["cartas", "motivos", "segundaFoto"]);
  });
  test("o estado e o painel: a lupa é dos dois objetos, o resumo conta quem marcou fora", () => {
    expect(Object.keys(SessaoSchema.shape.lupa.unwrap().shape).sort()).toEqual(["alertas", "alvo1Ms", "alvo2Ms", "alvos", "liberada"]);
    const linha = PainelSchema.shape.linhas.element.shape;
    expect(Object.keys(linha.lupa.unwrap().shape).sort()).toEqual(["alertas", "alvo1Ms", "alvo2Ms", "liberada"]);
    expect(Object.keys(PainelSchema.shape.resumo.shape)).toContain("marcaramFora");
    expect(Object.keys(PainelSchema.shape.roteiro.shape)).toEqual(["introducao", "regraDoArraste", "pausa", "cartoes", "perguntas", "liberar"]);
  });
});

describe("o podcast é o roteiro do PO, com Iara e Bento", () => {
  test("só os dois falam, e o app é o Unoovista", () => {
    const r = roteiroDoPodcast();
    expect(new Set(r.flatMap((b) => b.falas.map((f) => f.falante)))).toEqual(new Set(["Bento", "Iara"]));
    const texto = JSON.stringify(r);
    expect(texto).toContain("no Unoovista como detetive da imagem");
    expect(texto).not.toContain("Instanooria");
  });
});

describe("os vocabulários do código são os dos CHECKs das migrations", () => {
  const ler = (pasta: string) => readFileSync(join(__dirname, `../prisma/migrations/${pasta}/migration.sql`), "utf8");
  const sql = ler("20261026120000_exp02ef1b_enigma_capa");
  const prototipo = ler("20261026210000_exp02ef1b_prototipo");
  const lista = (xs: readonly string[]) => `(${xs.map((x) => `'${x}'`).join(", ")})`;
  test.each([
    ["origem", ORIGENS],
    ["chave_cena", CHAVES_DE_CENA],
    ["fase", FASES],
    ["foto", FOTOS],
    ["selo", SELOS],
    ["motivo", MOTIVOS_DO_PAR],
    ["elemento", ELEMENTOS_DA_SEGUNDA_FOTO],
  ])("%s", (_nome, valores) => {
    expect(sql).toContain(lista(valores));
  });
  test("a disciplina: o CHECK recriado na 2.0.0", () => {
    expect(prototipo).toContain(`"disciplina" IN ${lista(DISCIPLINAS)}`);
  });
  test("as cartas da E5", () => {
    expect(sql).toContain(`ARRAY[${CARTAS_DOS_PARES.map((c) => `'${c.id}'`).join(", ")}]`);
  });
  test("o teto de erros antes da ajuda", () => {
    expect(sql).toContain('"invariantes_erros" BETWEEN 0 AND 3');
  });
});

/**
 * As regras PURAS da exp03ef1b (Nina e a Notícia que Desapareceu) — sem banco,
 * sem Nest: gabaritos, filtro, reparo, rotina (o embaralhamento nunca entrega
 * a ordem certa), níveis da evidência, passo efetivo, transições do gate,
 * invariantes do banco padrão e a allowlist do contrato.
 */
import { componentePorSlug, componentesDoAno } from "../src/curriculo/componentes";
import {
  ASSUNTOS_DO_BANCO_PADRAO,
  DISCIPLINA_DO_BANCO_PADRAO,
  TEMA_DO_BANCO_PADRAO,
  conteudoDoBancoPadrao,
  ehConteudoDoBancoPadrao,
} from "../src/nina-noticia/banco-padrao";
import {
  CARTOES_DA_MISSAO,
  DESAFIO_EXTRA,
  DESCRICAO_DA_CENA_FIXA,
  FICHAS_TESTE,
  MATERIAS_DO_CASO,
  aplicarEstrutura,
  promptDaImagem,
  type ConteudoDoPacote,
} from "../src/nina-noticia/conteudo";
import {
  CarimbosSchema,
  ConteudoDoPacoteSchema,
  FiltroSchema,
  GateSchema,
  LinhaDoPainelSchema,
  ParametrosDoPreparoSchema,
  PrevisaoSchema,
  ROTAS,
  ReparoSchema,
  ReportagemPublicaSchema,
  SessaoSchema,
  TextosGeradosSchema,
} from "../src/nina-noticia/contrato-de-rotas";
import { MENSAGENS, STATUS } from "../src/nina-noticia/erros";
import { problemasDoPacote } from "../src/nina-noticia/invariantes";
import { GABARITO, acertos, uniforme } from "../src/nina-noticia/regras/carimbos";
import {
  nivelDaInspecao,
  nivelDaRotina,
  nivelDoReparo,
  nivelDosCarimbos,
} from "../src/nina-noticia/regras/evidencia";
import { aplicarFiltro, buscar } from "../src/nina-noticia/regras/filtro";
import { idsOpacos } from "../src/nina-noticia/regras/ordem";
import {
  PROIBIDO_NA_LINHA_DO_PAINEL,
  alertasDaLinha,
  contagemPorEtapaVisivel,
  distribuicaoDasEscolhas,
} from "../src/nina-noticia/regras/painel";
import {
  aguardandoOProfessor,
  pedirPasso,
  podeAgir,
  passoEfetivo,
  proximaEtapa,
  transicaoDoGate,
} from "../src/nina-noticia/regras/passos";
import { corrigirReparo, etiquetasDaSessao } from "../src/nina-noticia/regras/reparo";
import { reportagensDaSessao, selosCompletos, travarPrevisao } from "../src/nina-noticia/regras/reportagens";
import {
  bandejaDaSessao,
  corrigirRotina,
  ehASequenciaCerta,
  simularRotina,
} from "../src/nina-noticia/regras/rotina";
import {
  CHAVES_DAS_CENAS_FIXAS,
  DISCIPLINAS,
  PASSOS,
  ROTULO_DA_DISCIPLINA,
  SEQUENCIA_CERTA,
  SUPORTES,
  VALORES_DO_FILTRO,
  type Campo,
  type Etiqueta,
  type Passo,
} from "../src/nina-noticia/vocabulario";

const SEMENTES = Array.from({ length: 500 }, (_, i) => `sessao-${i}:r${(i % 3) + 1}`);

describe("o banco padrão e as invariantes do pacote", () => {
  test("o banco padrão é a Feira de Troca de Livros, literal do 01e e da Amostra 1", () => {
    const c = conteudoDoBancoPadrao();
    expect(TEMA_DO_BANCO_PADRAO).toBe("Feira de Troca de Livros");
    expect(DISCIPLINA_DO_BANCO_PADRAO).toBe("lingua-portuguesa");
    expect(ASSUNTOS_DO_BANCO_PADRAO).toContain("busca estruturada");
    expect(c.reportagens.map((r) => r.manchete)).toEqual(["Feira de Livros", "Livros no Pátio", "Troca de Leituras"]);
    expect(c.reportagens.map((r) => r.legenda)).toEqual([
      "Estudantes trocam gibis no pátio com árvores.",
      "Mesas compridas com livros no pátio da escola.",
      "Crianças leem juntas no banco do pátio ensolarado.",
    ]);
  });

  test("o banco padrão cumpre a régua e passa no schema de escrita", () => {
    expect(problemasDoPacote(conteudoDoBancoPadrao())).toEqual([]);
    expect(ConteudoDoPacoteSchema.safeParse(conteudoDoBancoPadrao()).success).toBe(true);
    expect(ehConteudoDoBancoPadrao(conteudoDoBancoPadrao())).toBe(true);
  });

  test("a estrutura é do servidor: mural e portal com pátio, telão com Onde vazio, Quem e Quando fixos", () => {
    const c = conteudoDoBancoPadrao();
    expect(c.reportagens.map((r) => r.suporte)).toEqual(["mural", "portal", "telao"]);
    for (const r of c.reportagens) {
      expect(r.ficha.quem).toBe("estudantes");
      expect(r.ficha.quando).toBe("sexta");
      expect(r.lugar).toBe("patio");
    }
    expect(c.reportagens.map((r) => r.ficha.onde)).toEqual(["patio", "patio", null]);
  });

  test("aplicarEstrutura ignora a ordem e qualquer estrutura vinda da IA", () => {
    const base = conteudoDoBancoPadrao();
    const textos = {
      tema: base.tema,
      cartaz: base.cartaz,
      reportagens: [...base.reportagens].reverse().map((r) => ({ ...r, ficha: { quem: null, onde: "quadra", quando: null } })),
    };
    const montado = aplicarEstrutura(TextosGeradosSchema.parse(textos));
    expect(montado).toEqual(base);
  });

  const quebrar = (mudar: (c: ConteudoDoPacote) => void): string[] => {
    const c = conteudoDoBancoPadrao();
    mudar(c);
    return problemasDoPacote(c);
  };

  test("a régua recusa a estrutura mexida", () => {
    expect(quebrar((c) => (c.reportagens[2]!.ficha.onde = "patio"))).toContain(
      "a ficha do telao precisa do campo onde vazio",
    );
    expect(quebrar((c) => (c.reportagens[0]!.ficha.onde = null))).toContain("a ficha do mural precisa de onde = patio");
    expect(quebrar((c) => (c.reportagens[1]!.ficha.quando = "sabado"))).toContain(
      "a ficha do portal precisa de quando = sexta",
    );
    expect(quebrar((c) => (c.reportagens[0]!.lugar = "quadra"))).toContain("a foto do mural precisa mostrar o pátio");
    expect(quebrar((c) => c.reportagens.pop())).toContain(
      "o pacote precisa de três reportagens: mural, portal e telão, nesta ordem",
    );
  });

  test("a régua recusa manchete longa, manchete repetida, marca e telão sem pátio na cena", () => {
    expect(quebrar((c) => (c.reportagens[0]!.manchete = "Uma Feira de Livros Enorme"))).toContain(
      "a manchete do mural passa de 4 palavras",
    );
    expect(quebrar((c) => (c.reportagens[1]!.manchete = c.reportagens[0]!.manchete))).toContain(
      "as manchetes se repetem",
    );
    expect(quebrar((c) => (c.reportagens[0]!.legenda = "Gibis da Marvel no pátio."))).toContain("o mural cita marvel");
    expect(
      quebrar((c) => (c.reportagens[2]!.imagem.descricao = "Telão mostrando crianças lendo na biblioteca da escola.")),
    ).toContain("a cena do telão precisa mostrar o pátio com clareza");
  });

  test("o prompt da imagem do telão exige o pátio visível sem ambiguidade", () => {
    const prompt = promptDaImagem("telao", conteudoDoBancoPadrao());
    expect(prompt).toContain("INEQUIVOCAMENTE");
    expect(prompt).toContain("PÁTIO");
    expect(prompt).toContain("Feira de Troca de Livros");
    expect(promptDaImagem("cartaz", conteudoDoBancoPadrao())).toContain("Feira de Troca de Livros");
  });

  test("toda cena fixa tem descrição, e o caso e o Desafio Extra são os do 01e", () => {
    expect(Object.keys(DESCRICAO_DA_CENA_FIXA).sort()).toEqual([...CHAVES_DAS_CENAS_FIXAS].sort());
    expect(MATERIAS_DO_CASO.map((m) => [m.diaNoCartaz, m.ficha.quando])).toEqual([
      ["sexta", null],
      ["sabado", null],
    ]);
    expect(DESAFIO_EXTRA.map((f) => f.manchete)).toEqual(["Campeonato de Pira", "Teatro de Fantoches"]);
    expect(FICHAS_TESTE.map((f) => f.manchete)).toEqual(["Oficina de Pipas", "Clube de Xadrez", "Horta da Escola"]);
  });
});

describe("os carimbos", () => {
  test("o gabarito é K1 ✔ K2 ✖ K3 ✔ K4 ✔ K5 ? K6 ✖", () => {
    expect(GABARITO).toEqual({ k1: "v", k2: "x", k3: "v", k4: "v", k5: "duvida", k6: "x" });
    expect(CARTOES_DA_MISSAO.map((c) => c.id)).toEqual(["k1", "k2", "k3", "k4", "k5", "k6"]);
  });

  test("acertos e uniformidade por etapa", () => {
    expect(acertos("e4", { k1: "v", k2: "x", k3: "v" })).toBe(3);
    expect(acertos("e6", { k4: "v", k5: "v", k6: "v" })).toBe(1);
    expect(uniforme("e4", { k1: "v", k2: "v", k3: "v" })).toBe(true);
    expect(uniforme("e4", { k1: "v", k2: "x", k3: "v" })).toBe(false);
    expect(uniforme("e6", { k4: "duvida", k5: "duvida" })).toBe(false);
  });

  test("o contrato aceita só os três cartões da etapa", () => {
    expect(CarimbosSchema.safeParse({ etapa: "e4", carimbos: { k1: "v", k2: "x", k3: "duvida" } }).success).toBe(true);
    expect(CarimbosSchema.safeParse({ etapa: "e4", carimbos: { k4: "v", k5: "x", k6: "v" } }).success).toBe(false);
    expect(CarimbosSchema.safeParse({ etapa: "e6", carimbos: { k4: "v", k5: "x" } }).success).toBe(false);
  });
});

describe("o filtro", () => {
  const reportagens = conteudoDoBancoPadrao().reportagens;

  test("Onde = Pátio encontra o mural e o portal, e deixa o telão de fora", () => {
    const r = aplicarFiltro(reportagens, "onde", "patio");
    expect(r.encontradas).toEqual(["mural", "portal"]);
    expect(r.resolveu).toBe(true);
    expect(r.contaComoTentativa).toBe(false);
  });

  test("só Onde = Pátio encontra alguma coisa: todo outro valor oferecido devolve zero e conta tentativa", () => {
    for (const campo of Object.keys(VALORES_DO_FILTRO) as Campo[]) {
      for (const valor of VALORES_DO_FILTRO[campo]) {
        if (campo === "onde" && valor === "patio") continue;
        const r = aplicarFiltro(reportagens, campo, valor);
        expect(r.encontradas).toEqual([]);
        expect(r.resolveu).toBe(false);
        expect(r.contaComoTentativa).toBe(true);
      }
    }
  });

  test("a busca é honesta: o campo vazio nunca casa", () => {
    expect(buscar(reportagens, "quem", "estudantes")).toEqual(["mural", "portal", "telao"]);
    expect(buscar([{ suporte: "telao", ficha: { quem: null, onde: null, quando: null } }], "onde", "patio")).toEqual([]);
  });

  test("o contrato recusa valor de outra pastilha", () => {
    expect(FiltroSchema.safeParse({ campo: "onde", valor: "patio" }).success).toBe(true);
    expect(FiltroSchema.safeParse({ campo: "quem", valor: "patio" }).success).toBe(false);
    expect(FiltroSchema.safeParse({ campo: "quando", valor: "sexta" }).success).toBe(false);
  });
});

describe("selos e escolha (E1, E2)", () => {
  const semente = "s-1:r1";
  const ids = reportagensDaSessao(semente);

  test("três reportagens com ids opacos, estáveis e diferentes por sessão", () => {
    expect(ids.map((r) => r.suporte)).toEqual([...SUPORTES]);
    expect(ids.every((r) => /^rp-[a-z0-9]{3}$/.test(r.id))).toBe(true);
    expect(reportagensDaSessao(semente)).toEqual(ids);
    expect(reportagensDaSessao("s-2:r1").map((r) => r.id)).not.toEqual(ids.map((r) => r.id));
  });

  test("a escolha é um LATCH: vazia é recusada, a segunda vez também", () => {
    expect(travarPrevisao(semente, [], false)).toEqual({ ok: false, codigo: "previsao-vazia" });
    expect(travarPrevisao(semente, [ids[0]!.id], true)).toEqual({ ok: false, codigo: "previsao-ja-travada" });
    expect(travarPrevisao(semente, ["rp-zzz"], false)).toEqual({ ok: false, codigo: "reportagem-desconhecida" });
    expect(travarPrevisao(semente, [ids[2]!.id, ids[0]!.id, ids[0]!.id], false)).toEqual({
      ok: true,
      suportes: ["telao", "mural"],
    });
    expect(PrevisaoSchema.safeParse({ itens: [] }).success).toBe(true);
  });

  test("os selos completam com os três", () => {
    expect(selosCompletos(["mural", "portal"])).toBe(false);
    expect(selosCompletos(["telao", "mural", "portal"])).toBe(true);
  });
});

describe("o reparo (spec §7.6)", () => {
  const semente = "s-reparo:r1";
  const et = Object.fromEntries(etiquetasDaSessao(semente).map((e) => [e.etiqueta, e.id])) as Record<Etiqueta, string>;

  test("válido ⇔ Pátio no campo Onde — as outras duas são gravadas, não avaliadas", () => {
    const certo = corrigirReparo(semente, { quem: et.estudantes, onde: et.patio, quando: et.sexta });
    expect(certo).toEqual({
      ok: true,
      posicoes: { quem: "estudantes", onde: "patio", quando: "sexta" },
      valido: true,
      desfecho: "sucesso",
    });
    const trocado = corrigirReparo(semente, { quem: et.sexta, onde: et.patio, quando: et.estudantes });
    expect(trocado).toMatchObject({ ok: true, valido: true, desfecho: "sucesso" });
    const errado = corrigirReparo(semente, { quem: et.patio, onde: et.estudantes, quando: et.sexta });
    expect(errado).toMatchObject({ ok: true, valido: false, desfecho: "erro" });
  });

  test("as três etiquetas, uma por campo; etiqueta de outra sessão é desconhecida", () => {
    expect(corrigirReparo(semente, { quem: et.patio, onde: et.patio, quando: et.sexta })).toEqual({
      ok: false,
      codigo: "reparo-incompleto",
    });
    const outra = etiquetasDaSessao("outra:r1")[0]!.id;
    expect(corrigirReparo(semente, { quem: outra, onde: et.patio, quando: et.sexta })).toEqual({
      ok: false,
      codigo: "etiqueta-desconhecida",
    });
    expect(ReparoSchema.safeParse({ ficha: { quem: et.patio, onde: et.sexta } }).success).toBe(false);
  });
});

describe("a rotina", () => {
  test("a sequência certa é a do 01e", () => {
    expect(SEQUENCIA_CERTA).toEqual(["enquanto", "pegar", "se", "ok", "senao", "revisar", "fim"]);
  });

  test(`em ${SEMENTES.length} sementes a bandeja tem os sete blocos, ids opacos, e NUNCA a ordem certa`, () => {
    const ordens = new Set<string>();
    for (const semente of SEMENTES) {
      const bandeja = bandejaDaSessao(semente);
      expect(bandeja).toHaveLength(7);
      expect(new Set(bandeja.map((b) => b.bloco)).size).toBe(7);
      expect(bandeja.every((b) => /^bl-[a-z0-9]{3}$/.test(b.id))).toBe(true);
      expect(ehASequenciaCerta(bandeja.map((b) => b.bloco))).toBe(false);
      expect(bandejaDaSessao(semente)).toEqual(bandeja);
      ordens.add(bandeja.map((b) => b.bloco).join(","));
    }
    expect(ordens.size).toBeGreaterThan(100);
  });

  test("válida só na ordem exata; incompleta e id estranho não contam tentativa", () => {
    const semente = "s-rotina:r2";
    const porBloco = new Map(bandejaDaSessao(semente).map((b) => [b.bloco, b.id]));
    const certa = SEQUENCIA_CERTA.map((b) => porBloco.get(b)!);
    expect(corrigirRotina(semente, certa)).toMatchObject({ ok: true, valida: true });
    const semParada = [...certa.slice(0, 6)].reverse().concat(certa[6]!);
    expect(corrigirRotina(semente, semParada)).toMatchObject({ ok: true, valida: false });
    const okERevisarTrocados = [certa[0], certa[1], certa[2], certa[5], certa[4], certa[3], certa[6]] as string[];
    expect(corrigirRotina(semente, okERevisarTrocados)).toMatchObject({ ok: true, valida: false });
    expect(corrigirRotina(semente, certa.slice(0, 6))).toEqual({ ok: false, codigo: "rotina-incompleta" });
    expect(corrigirRotina(semente, [...certa.slice(0, 6), certa[0]!])).toEqual({ ok: false, codigo: "bloco-desconhecido" });
    expect(corrigirRotina(semente, [...certa.slice(0, 6), "bl-zzz"])).toEqual({ ok: false, codigo: "bloco-desconhecido" });
  });

  test("a simulação: a pilha vai de 3 a 0 e só o Clube de Xadrez recebe a bandeira", () => {
    expect(simularRotina()).toEqual([
      { manchete: "Oficina de Pipas", marca: "ok", pendentes: 2 },
      { manchete: "Clube de Xadrez", marca: "revisar", pendentes: 1 },
      { manchete: "Horta da Escola", marca: "ok", pendentes: 0 },
    ]);
  });
});

describe("os níveis da evidência (spec §2)", () => {
  test("EF15CO08 — a inspeção", () => {
    expect(nivelDaInspecao({ fichaAberta: true, filtroTentativas: 0, dicaUsada: false })).toBe("atingiu");
    expect(nivelDaInspecao({ fichaAberta: true, filtroTentativas: 1, dicaUsada: false })).toBe("em_processo");
    expect(nivelDaInspecao({ fichaAberta: true, filtroTentativas: 0, dicaUsada: true })).toBe("em_processo");
    expect(nivelDaInspecao({ fichaAberta: false, filtroTentativas: 0, dicaUsada: false })).toBeNull();
  });

  test("EF03CO01 — os seis carimbos, com a uniformidade vencendo", () => {
    const e4 = { k1: "v", k2: "x", k3: "v" } as const;
    const e6 = { k4: "v", k5: "duvida", k6: "x" } as const;
    expect(nivelDosCarimbos(e4, e6)).toBe("atingiu");
    expect(nivelDosCarimbos({ ...e4, k1: "x" }, e6)).toBe("atingiu");
    expect(nivelDosCarimbos(e4, { ...e6, k5: "v" })).toBe("em_processo");
    expect(nivelDosCarimbos({ ...e4, k3: "x" }, e6)).toBe("em_processo");
    expect(nivelDosCarimbos({ k1: "v", k2: "v", k3: "v" }, e6)).toBe("nao_atingiu");
    expect(nivelDosCarimbos(e4, { k4: "x", k5: "x", k6: "x" })).toBe("nao_atingiu");
    expect(nivelDosCarimbos(e4, null)).toBeNull();
  });

  test("EF03CO02 — a rotina: até duas tentativas, contando a válida", () => {
    expect(nivelDaRotina({ valida: true, tentativas: 1 })).toBe("atingiu");
    expect(nivelDaRotina({ valida: true, tentativas: 2 })).toBe("atingiu");
    expect(nivelDaRotina({ valida: true, tentativas: 3 })).toBe("em_processo");
    expect(nivelDaRotina({ valida: false, tentativas: 5 })).toBeNull();
  });

  test("EF03CO03 — o reparo", () => {
    expect(nivelDoReparo(true)).toBe("atingiu");
    expect(nivelDoReparo(false)).toBe("em_processo");
  });
});

describe("passos e portões", () => {
  test("passo efetivo = min(passo, teto da etapa)", () => {
    expect(passoEfetivo("filtro", "aposta")).toBe("aposta");
    expect(passoEfetivo("galeria", "inspecao")).toBe("galeria");
    expect(passoEfetivo("ficha", "filtro")).toBe("omissao");
    expect(passoEfetivo("omissao", "filtro")).toBe("omissao");
    expect(passoEfetivo("fim", "inspecao")).toBe("fim");
    for (const passo of PASSOS) expect(passoEfetivo(passo, "inspecao")).toBe(passo);
  });

  test("aguarda a professora quem travou a escolha ou confrontou a omissão antes do portão", () => {
    expect(aguardandoOProfessor("filtro", "aposta")).toBe(true);
    expect(aguardandoOProfessor("aposta", "aposta")).toBe(false);
    expect(aguardandoOProfessor("ficha", "filtro")).toBe(true);
    expect(aguardandoOProfessor("ficha", "inspecao")).toBe(false);
  });

  test("o gate só avança, uma etapa por vez; pausar e retomar são idempotentes", () => {
    const inicio = { etapa: "aposta" as const, pausada: false };
    expect(proximaEtapa("aposta")).toBe("filtro");
    expect(proximaEtapa("inspecao")).toBeNull();
    expect(transicaoDoGate(inicio, { acao: "liberar" })).toEqual({
      ok: true,
      estado: { etapa: "filtro", pausada: false },
      mudou: true,
    });
    expect(transicaoDoGate(inicio, { acao: "liberar", para: "inspecao" })).toEqual({
      ok: false,
      codigo: "transicao-de-etapa-invalida",
    });
    expect(transicaoDoGate({ etapa: "filtro", pausada: false }, { acao: "liberar", para: "aposta" })).toEqual({
      ok: false,
      codigo: "transicao-de-etapa-invalida",
    });
    expect(transicaoDoGate({ etapa: "filtro", pausada: false }, { acao: "liberar", para: "filtro" })).toMatchObject({
      ok: true,
      mudou: false,
    });
    expect(transicaoDoGate({ etapa: "inspecao", pausada: false }, { acao: "liberar" })).toEqual({
      ok: false,
      codigo: "transicao-de-etapa-invalida",
    });
    expect(transicaoDoGate(inicio, { acao: "pausar" })).toMatchObject({ estado: { pausada: true }, mudou: true });
    expect(transicaoDoGate({ ...inicio, pausada: true }, { acao: "pausar" })).toMatchObject({ mudou: false });
    expect(transicaoDoGate({ ...inicio, pausada: true }, { acao: "liberar" })).toMatchObject({
      estado: { etapa: "filtro", pausada: true },
    });
    expect(transicaoDoGate({ ...inicio, pausada: true }, { acao: "retomar" })).toMatchObject({
      estado: { pausada: false },
      mudou: true,
    });
    expect(GateSchema.safeParse({ acao: "pausar", para: "filtro" }).success).toBe(false);
  });

  test("os passos pedidos andam um, devolvem o atual adiante e recusam antes da origem", () => {
    expect(pedirPasso("omissao", "ficha")).toEqual({ ok: true, passo: "ficha" });
    expect(pedirPasso("carimbos", "ficha")).toEqual({ ok: true, passo: "carimbos" });
    expect(pedirPasso("filtro", "ficha")).toEqual({ ok: false, codigo: "passo-invalido" });
    expect(pedirPasso("desfecho", "ponte")).toEqual({ ok: true, passo: "ponte" });
    expect(pedirPasso("ponte", "rotina")).toEqual({ ok: true, passo: "rotina" });
    expect(pedirPasso("reparo", "ponte")).toEqual({ ok: false, codigo: "passo-invalido" });
  });

  test("podeAgir: pausa congela, etapa não liberada é 403, fora de ordem é 409", () => {
    expect(podeAgir("filtro", { etapa: "filtro", pausada: false }, "filtro")).toEqual({ ok: true });
    expect(podeAgir("filtro", { etapa: "filtro", pausada: true }, "filtro")).toEqual({
      ok: false,
      codigo: "turma-pausada",
    });
    expect(podeAgir("ficha", { etapa: "filtro", pausada: false }, "ficha")).toEqual({
      ok: false,
      codigo: "etapa-nao-liberada",
    });
    expect(podeAgir("reparo", { etapa: "inspecao", pausada: false }, "ficha")).toEqual({
      ok: false,
      codigo: "passo-fora-de-ordem",
    });
    expect(STATUS["etapa-nao-liberada"]).toBe(403);
    expect(STATUS["turma-pausada"]).toBe(409);
  });
});

describe("o painel", () => {
  test("a contagem por etapa visível e a distribuição das escolhas (só agregado)", () => {
    const passos: Passo[] = ["galeria", "aposta", "omissao", "reparo", "rotina", "fim"];
    expect(contagemPorEtapaVisivel(passos)).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 });
    expect(distribuicaoDasEscolhas([["mural", "portal", "telao"], ["mural", "portal"], ["telao"], []])).toEqual({
      travadas: 3,
      uma: 1,
      duas: 1,
      tres: 1,
      deFora: { mural: 1, portal: 1, telao: 1 },
    });
  });

  test("os alertas: mais de três testes sem parada; carimbos uniformes em qualquer etapa", () => {
    const base = { rotinaValida: false, carimbosE4: null, carimbosE6: null };
    expect(alertasDaLinha({ ...base, rotinaTentativas: 3 }).semParada).toBe(false);
    expect(alertasDaLinha({ ...base, rotinaTentativas: 4 }).semParada).toBe(true);
    expect(alertasDaLinha({ ...base, rotinaTentativas: 4, rotinaValida: true }).semParada).toBe(false);
    expect(
      alertasDaLinha({ ...base, rotinaTentativas: 0, carimbosE6: { k4: "duvida", k5: "duvida", k6: "duvida" } })
        .uniformes,
    ).toBe(true);
  });

  test("a linha do painel não tem acerto, escolha nem nível", () => {
    const chaves = (schema: unknown): string[] => {
      const s = schema as { shape?: Record<string, unknown> };
      if (!s.shape) return [];
      return Object.entries(s.shape).flatMap(([k, v]) => [k, ...chaves(v)]);
    };
    for (const chave of chaves(LinhaDoPainelSchema)) {
      for (const proibido of PROIBIDO_NA_LINHA_DO_PAINEL) expect(chave.toLowerCase()).not.toContain(proibido);
    }
  });
});

describe("o contrato", () => {
  test("a reportagem pública não carrega ficha (o Onde vazio do telão não desce antes da hora)", () => {
    expect(Object.keys(ReportagemPublicaSchema.shape)).not.toContain("ficha");
    expect(Object.keys(SessaoSchema.shape)).not.toContain("gabarito");
  });

  test("toda rota tem saída e nenhum par método + caminho se repete", () => {
    const pares = Object.values(ROTAS).map((r) => `${r.metodo} ${r.caminho}`);
    expect(new Set(pares).size).toBe(pares.length);
    for (const r of Object.values(ROTAS)) expect(r.saida).toBeDefined();
  });

  test("ids opacos são distintos", () => {
    for (const semente of SEMENTES.slice(0, 50)) {
      const ids = idsOpacos(semente, "bl", 7);
      expect(new Set(ids).size).toBe(7);
    }
  });

  test("nenhuma frase de erro diz 'aposta' (spec §7.1)", () => {
    for (const frase of Object.values(MENSAGENS)) expect(frase.toLowerCase()).not.toContain("aposta");
  });

  test("os parâmetros do preparo: tema até 60", () => {
    const ok = { disciplina: "lingua-portuguesa", tema: "Feira de Troca de Livros", assuntos: "notícia escolar" };
    expect(ParametrosDoPreparoSchema.safeParse(ok).success).toBe(true);
    expect(ParametrosDoPreparoSchema.safeParse({ ...ok, tema: "x".repeat(61) }).success).toBe(false);
  });
});

describe("as disciplinas do preparo: todo o 3º ano da matriz, Computação e o projeto interdisciplinar", () => {
  test("a lista é componentesDoAno(\"3EF\") + computacao, na ordem do catálogo, e o projeto no fim", () => {
    const esperados = [...componentesDoAno("3EF").map((c) => c.slug), "computacao"];
    expect(DISCIPLINAS.slice(0, esperados.length)).toEqual(esperados);
    expect(DISCIPLINAS.at(-1)).toBe("projeto-interdisciplinar");
    expect(DISCIPLINAS).toHaveLength(esperados.length + 1);
  });

  test("o rótulo é o do catálogo de componentes", () => {
    for (const slug of DISCIPLINAS) {
      const componente = componentePorSlug(slug);
      if (componente) expect(ROTULO_DA_DISCIPLINA[slug]).toBe(componente.rotulo);
    }
  });
});

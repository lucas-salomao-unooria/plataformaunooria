import { ForbiddenException, HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UsoDeIa } from "../src/ai/consumo-de-ia";
import { MedidorDeProvider } from "../src/ai/medidor.provider";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import type { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import type { AuthClaims } from "../src/auth/claims";
import { RolesGuard } from "../src/auth/roles";
import { RECURSOS_DE_IA } from "../src/recursos/custos-de-ia";
import { conteudoDoBancoPadrao } from "../src/nina-noticia/banco-padrao";
import {
  ATRIBUICAO_DAS_IMAGENS_DO_BANCO,
  ImagensDoBancoPadraoDaExp03ef1bService,
  RECURSO_DAS_IMAGENS_DO_BANCO,
  itensDoBanco,
} from "../src/nina-noticia/banco-padrao-imagens.service";
import { EXIGENCIA_DO_SUPORTE, promptDaImagem, type ConteudoDoPacote } from "../src/nina-noticia/conteudo";
import {
  GeracaoDoBancoPadraoSchema,
  ImagemRefeitaSchema,
  ImagensDoBancoPadraoSchema,
  ProgressoDaMidiaSchema,
  RascunhoSchema,
  ReportagemRegeneradaSchema,
} from "../src/nina-noticia/contrato-de-rotas";
import { CUSTO_ESTIMADO_POR_IMAGEM, MidiaDaExp03ef1bService } from "../src/nina-noticia/midia.service";
import { NinaNoticiaBancoPadraoController } from "../src/nina-noticia/nina-noticia-banco-padrao.controller";
import { NinaNoticiaTurmasController } from "../src/nina-noticia/nina-noticia-turmas.controller";
import type { NinaNoticiaService, PacoteLido } from "../src/nina-noticia/nina-noticia.service";
import { PreparoDaExp03ef1bService } from "../src/nina-noticia/preparo.service";
import { SYSTEM_DO_PREPARO } from "../src/nina-noticia/prompts";
import { itensDasCenasFixas, itensDoPacote, nomeDaImagem } from "../src/nina-noticia/regras/imagens";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * O preparo com IA e as imagens da exp03ef1b — SEM banco: a IA FALSA é
 * injetada só aqui, no teste unitário (a aula de verdade roda sempre com IA
 * real). O texto da IA, a estrutura do servidor por cima, a régua que regera,
 * o fallback ao banco padrão, as imagens do pacote (gerar, refazer, aprovadas)
 * e as do banco padrão (só o `admin`, medidas com atribuição explícita).
 * Molde: `juri-estadual-midia.spec.ts`.
 */

const PARAMETROS = {
  disciplina: "ciencias" as const,
  tema: "Inauguração da Horta",
  assuntos: "horta, compostagem, plantio de mudas",
};

/** O texto que a IA "escreve" — com estrutura INVENTADA que o servidor tem de descartar. */
function textoDaIa(o: { mancheteDoTelao?: string; cenaDoTelao?: string } = {}) {
  return {
    tema: "Inauguração da Horta",
    cartaz: { texto: "Horta da Escola", imagem: { descricao: "Cartaz colorido da horta com um calendário.", alt: "Cartaz da horta." } },
    reportagens: [
      {
        suporte: "telao",
        manchete: o.mancheteDoTelao ?? "Mudas no Pátio",
        legenda: "Crianças plantam mudas no pátio.",
        /* Estrutura inventada: o servidor ignora. */
        ficha: { quem: "professores", onde: "patio", quando: "sabado" },
        lugar: "quadra",
        imagem: { descricao: o.cenaDoTelao ?? "Crianças plantando mudas nos canteiros do pátio da escola, com árvores ao fundo.", alt: "Crianças plantam no pátio." },
      },
      {
        suporte: "mural",
        manchete: "Nova Horta",
        legenda: "Estudantes regam a horta no pátio.",
        imagem: { descricao: "Estudantes regando canteiros no pátio aberto da escola.", alt: "Estudantes regam a horta." },
      },
      {
        suporte: "portal",
        manchete: "Horta Inaugurada",
        legenda: "A horta nova ficou pronta no pátio.",
        imagem: { descricao: "Canteiros novos no pátio da escola, com o cartaz da horta.", alt: "Canteiros da horta no pátio." },
      },
    ],
  };
}

/** A IA de texto falsa: as tentativas como o provider real (paga cada uma, regera quando o `validar` lança). */
function montarPreparo(responder: (n: number) => unknown, { saldo = true } = {}) {
  let chamadas = 0;
  let debitado = 0;
  const pedidos: AiJsonRequest<unknown>[] = [];
  const ia = {
    generateJson: async <T>(req: AiJsonRequest<T>) => {
      pedidos.push(req as AiJsonRequest<unknown>);
      let erro: unknown = new Error("sem tentativa");
      for (let t = 0; t < (req.tentativas ?? 1); t++) {
        chamadas += 1;
        req.aoUsarTokens?.(100, { entrada: 40, saida: 60 });
        try {
          return req.validar(responder(chamadas));
        } catch (e) {
          erro = e;
        }
      }
      throw erro;
    },
  } as unknown as AiProvider;
  const quota = {
    temSaldo: async () => saldo,
    consumir: async (_e: string, _u: string, n: number) => {
      debitado += n;
    },
  } as unknown as QuotaService;
  return { preparo: new PreparoDaExp03ef1bService(ia, quota), pedidos, estado: () => ({ chamadas, debitado }) };
}

/** O controller da professora com a missão e o banco de imagens falsos — é nele que o fallback mora. */
function montarController(preparo: PreparoDaExp03ef1bService) {
  const geracoes: number[] = [];
  const missao = {
    exigirTurmaVisivel: async () => undefined,
    registrarGeracao: async (_e: string, _t: string, tokens: number) => {
      geracoes.push(tokens);
    },
  } as unknown as NinaNoticiaService;
  const banco = { existentes: async () => ({ telao: "https://cdn/telao.webp", "caso-a": "https://cdn/caso-a.webp" }) };
  const controller = new NinaNoticiaTurmasController(
    missao,
    preparo,
    {} as MidiaDaExp03ef1bService,
    banco as unknown as ImagensDoBancoPadraoDaExp03ef1bService,
  );
  const req = { auth: { usuarioId: "prof", escolaId: "escola", perfil: "professor" } as AuthClaims };
  return { controller, req, geracoes };
}

const TURMA = "6f0f6b9e-1f2a-4c3b-9d4e-5f6a7b8c9d0e";
const PACOTE = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (erro) {
    return ((erro as HttpException).getResponse() as { codigo?: string }).codigo;
  }
}

describe("o preparo: a IA escreve só texto, a estrutura é do servidor", () => {
  test("o rascunho da IA sai na ordem dos suportes, com as fichas do servidor (Onde VAZIO no telão) e o débito do que foi pago", async () => {
    const m = montarPreparo(() => textoDaIa());
    const { controller, req, geracoes } = montarController(m.preparo);
    const r = RascunhoSchema.parse(await controller.gerarConteudo(TURMA, undefined, PARAMETROS, req));
    expect(r).toMatchObject({ usouIa: true, origem: "ia", motivo: null, imagens: {} });
    expect(r.conteudo.reportagens.map((x) => x.suporte)).toEqual(["mural", "portal", "telao"]);
    expect(r.conteudo.reportagens[2]).toMatchObject({ lugar: "patio", ficha: { quem: "estudantes", onde: null, quando: "sexta" } });
    expect(m.estado()).toEqual({ chamadas: 1, debitado: 100 });
    expect(geracoes).toEqual([100]);
    expect(m.pedidos[0]?.system).toBe(SYSTEM_DO_PREPARO);
    /* O que a professora escreveu entra delimitado, como dado. */
    expect(m.pedidos[0]?.prompt).toContain("<<<TEMA\nInauguração da Horta\nTEMA>>>");
  });

  test("a saída que fere a régua (manchete longa, telão sem pátio) é regerada; a segunda boa vale, e as duas são pagas", async () => {
    const m = montarPreparo((n) =>
      n === 1 ? textoDaIa({ mancheteDoTelao: "Uma manchete longa demais aqui", cenaDoTelao: "Crianças plantando numa sala fechada." }) : textoDaIa(),
    );
    const r = await m.preparo.gerar("escola", "prof", "professor", PARAMETROS);
    expect(r.ok).toBe(true);
    expect(m.estado()).toEqual({ chamadas: 2, debitado: 200 });
  });

  test("FALLBACK: com a IA reprovada nas duas tentativas, o banco padrão com usouIa:false, o motivo e as imagens do pacote do banco", async () => {
    const m = montarPreparo(() => textoDaIa({ cenaDoTelao: "Crianças plantando numa sala fechada." }));
    const { controller, req } = montarController(m.preparo);
    const r = RascunhoSchema.parse(await controller.gerarConteudo(TURMA, undefined, PARAMETROS, req));
    expect(r).toMatchObject({ usouIa: false, origem: "padrao", motivo: "ia-indisponivel" });
    expect(r.conteudo).toEqual(conteudoDoBancoPadrao());
    /* Só as chaves do pacote descem para a tela da professora; as cenas fixas ficam no pacote. */
    expect(r.imagens).toEqual({ telao: "https://cdn/telao.webp" });
    expect(m.estado().debitado).toBe(200);
  });

  test("FALLBACK sem saldo: a IA nem é chamada, motivo sem-saldo-de-ia", async () => {
    const m = montarPreparo(() => textoDaIa(), { saldo: false });
    const { controller, req, geracoes } = montarController(m.preparo);
    const r = await controller.gerarConteudo(TURMA, undefined, PARAMETROS, req);
    expect(r).toMatchObject({ usouIa: false, motivo: "sem-saldo-de-ia" });
    expect(m.estado().chamadas).toBe(0);
    expect(geracoes).toEqual([]);
  });

  test("Regenerar Notícia: mantém o suporte e a ficha; sem saldo é 429; com a IA fora volta a reportagem COMO ESTAVA", async () => {
    const conteudo = conteudoDoBancoPadrao();
    const pedido = { ...PARAMETROS, conteudo, suporte: "telao" as const };
    const nova = {
      reportagem: {
        suporte: "mural",
        manchete: "Leitura no Pátio",
        legenda: "Crianças leem no pátio.",
        imagem: { descricao: "Crianças lendo nos bancos do pátio, com o cartaz da feira.", alt: "Crianças leem no pátio." },
      },
    };
    const ok = montarController(montarPreparo(() => nova).preparo);
    const r = ReportagemRegeneradaSchema.parse(await ok.controller.regenerarReportagem(TURMA, undefined, pedido, ok.req));
    expect(r).toMatchObject({ usouIa: true, reportagem: { suporte: "telao", manchete: "Leitura no Pátio", ficha: { onde: null } } });

    const semSaldo = montarController(montarPreparo(() => nova, { saldo: false }).preparo);
    expect(await codigoDe(semSaldo.controller.regenerarReportagem(TURMA, undefined, pedido, semSaldo.req))).toBe("sem-saldo-de-ia");

    const fora = montarController(
      montarPreparo(() => {
        throw new Error("vendor fora");
      }).preparo,
    );
    const comoEstava = await fora.controller.regenerarReportagem(TURMA, undefined, pedido, fora.req);
    expect(comoEstava).toEqual({ reportagem: conteudo.reportagens[2], usouIa: false });
  });

  test("a homologação recusa estrutura errada com a lista de problemas (400 pacote-invalido)", async () => {
    const { controller, req } = montarController(montarPreparo(() => null).preparo);
    const conteudo = conteudoDoBancoPadrao();
    conteudo.reportagens[2]!.ficha.onde = "patio";
    const r = await controller.homologar(TURMA, undefined, { parametros: PARAMETROS, conteudo }, req).catch((e: HttpException) => e.getResponse());
    expect(r).toMatchObject({ codigo: "pacote-invalido" });
    expect((r as { erros: string[] }).erros.join(" ")).toMatch(/telao precisa do campo onde vazio/);
  });
});

// ─────────────────────────────────────────── as imagens do pacote

function montarMidia({
  saldo = true,
  aprovada = false,
  falhaEm = "",
  noStorage = new Set<string>(),
  storage = new Set<string>(noStorage),
  pacoteId = PACOTE,
} = {}) {
  const conteudo: ConteudoDoPacote = conteudoDoBancoPadrao();
  const prompts: string[] = [];
  /** A quem cada pedido foi atribuído no painel de custos (`undefined` = a turma, pelo contexto da requisição). */
  const atribuicoes = new Map<string, unknown>();
  const registradas: Array<[string, string]> = [];
  let consumido = 0;
  const ia = {
    generateImage: async (prompt: string, opcoes?: { atribuicao?: unknown }) => {
      prompts.push(prompt);
      atribuicoes.set(prompt, opcoes?.atribuicao);
      /* Uma volta do laço de eventos: dois preparos simultâneos se encontram na trava. */
      await new Promise((ok) => setImmediate(ok));
      if (falhaEm && prompt.includes(falhaEm)) throw new Error("provedor fora");
      return Buffer.from("imagem");
    },
  } as unknown as AiProvider;
  const assets = {
    salvarMidiaDeExperiencia: async ({ nome }: { nome: string }) => {
      storage.add(nome);
      return `https://cdn/${nome}`;
    },
    midiaDeExperienciaExiste: async (_e: string, nome: string) => storage.has(nome),
    urlDaMidiaDeExperiencia: (_e: string, nome: string) => `https://cdn/${nome}`,
  } as unknown as AssetsService;
  const quota = {
    temSaldo: async () => saldo,
    consumir: async (_e: string, _u: string, n: number) => {
      consumido += n;
    },
  } as unknown as QuotaService;
  const pacote: PacoteLido = {
    id: pacoteId,
    escolaId: "escola",
    turmaId: "turma",
    disciplina: "lingua-portuguesa",
    tema: conteudo.tema,
    assuntos: "x",
    contexto: null,
    origem: "ia",
    conteudo,
    midia: {},
  };
  const missao = {
    pacoteParaMidia: async () => {
      if (aprovada) throw new HttpException({ codigo: "imagens-ja-aprovadas" }, 409);
      return { ...pacote, midia: Object.fromEntries(registradas) };
    },
    registrarMidia: async (_e: string, _p: string, chave: string, url: string) => {
      registradas.push([chave, url]);
    },
  } as unknown as NinaNoticiaService;
  const banco = new ImagensDoBancoPadraoDaExp03ef1bService(ia, assets);
  const servico = new MidiaDaExp03ef1bService(ia, assets, quota, missao, banco);
  const cenas = itensDasCenasFixas();
  return {
    servico,
    conteudo,
    prompts,
    atribuicoes,
    registradas,
    /** Os pedidos de CENA FIXA que foram ao provedor. */
    pedidosDeCena: () => prompts.filter((p) => cenas.some((c) => c.prompt === p)),
    gerar: () => servico.gerar("escola", "turma", "prof", "prof", "professor", pacoteId),
    refazer: (chave: "mural" | "portal" | "telao" | "cartaz") => servico.refazer("escola", "turma", "prof", "prof", "professor", pacoteId, chave),
    consumido: () => consumido,
  };
}

describe("as imagens do pacote (a professora)", () => {
  test("o prompt do telão EXIGE o pátio inequívoco, e a tela de revisão recebe a chave dele", () => {
    const prompt = promptDaImagem("telao", conteudoDoBancoPadrao());
    expect(prompt).toContain(EXIGENCIA_DO_SUPORTE.telao);
    expect(prompt).toMatch(/PÁTIO precisa estar INEQUIVOCAMENTE visível/);
    expect(itensDoPacote(conteudoDoBancoPadrao()).map((i) => i.chave)).toEqual(["mural", "portal", "telao", "cartaz"]);
  });

  test("gera as quatro numa chamada, debita cada uma, e de novo não gera nada; a cena fixa que existe entra de graça", async () => {
    const m = montarMidia({ noStorage: new Set(itensDasCenasFixas().map((i) => i.nome)) });
    const r = ProgressoDaMidiaSchema.parse(await m.gerar());
    expect(r).toMatchObject({ total: 4, prontas: 4, faltam: 0, completo: true, falharam: [] });
    expect(r.geradas.sort()).toEqual(["cartaz", "mural", "portal", "telao"]);
    expect(m.consumido()).toBe(4 * CUSTO_ESTIMADO_POR_IMAGEM);
    expect(m.registradas.map(([c]) => c)).toEqual(expect.arrayContaining(["caso-a", "caso-b"]));
    /* As cenas já estavam no storage: só os quatro pedidos do pacote foram ao provedor. */
    expect(m.prompts).toHaveLength(4);
    /* A resposta é só das quatro do pacote: o contrato da professora recusa outra chave. */
    expect(Object.keys(r.imagens).sort()).toEqual(["cartaz", "mural", "portal", "telao"]);
    const denovo = await m.gerar();
    expect(denovo.geradas).toEqual([]);
    expect(m.prompts).toHaveLength(4);
  });

  test("ADR-199: a cena fixa que FALTA no storage é gerada no preparo, na conta da PLATAFORMA — sem débito na quota da professora", async () => {
    const [casoA] = itensDasCenasFixas();
    const m = montarMidia({ noStorage: new Set([casoA!.nome]) });
    await m.gerar();
    expect(m.pedidosDeCena()).toHaveLength(1);
    for (const pedido of m.pedidosDeCena()) expect(m.atribuicoes.get(pedido)).toEqual(ATRIBUICAO_DAS_IMAGENS_DO_BANCO);
    /* As quatro do pacote são da turma (o contexto da requisição), não da plataforma. */
    for (const item of itensDoPacote(m.conteudo)) expect(m.atribuicoes.get(item.prompt)).toBeUndefined();
    expect(m.consumido()).toBe(4 * CUSTO_ESTIMADO_POR_IMAGEM);
    const cenas = new Map(m.registradas.filter(([c]) => !["mural", "portal", "telao", "cartaz"].includes(c)));
    expect([...cenas.keys()].sort()).toEqual(["caso-a", "caso-b"]);
    /* O arquivo é o do hash do pedido: o mesmo que o `admin` geraria. */
    for (const item of itensDasCenasFixas()) expect(cenas.get(item.chave)).toBe(`https://cdn/${item.nome}`);
    /* De novo: o pacote já as tem, nada vai ao provedor. */
    await m.gerar();
    expect(m.pedidosDeCena()).toHaveLength(1);
  });

  test("ADR-199: duas turmas no preparo ao mesmo tempo pagam CADA cena fixa uma vez; a próxima turma reaproveita pelo hash", async () => {
    const storage = new Set<string>();
    const a = montarMidia({ storage, pacoteId: PACOTE });
    const b = montarMidia({ storage, pacoteId: "1c2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d5e" });
    await Promise.all([a.gerar(), b.gerar()]);
    expect(a.pedidosDeCena().length + b.pedidosDeCena().length).toBe(2);
    const c = montarMidia({ storage, pacoteId: "2d3e4f50-6172-4c8d-8e9f-1a2b3c4d5e6f" });
    await c.gerar();
    expect(c.prompts).toHaveLength(0);
    expect(c.registradas).toHaveLength(6);
  });

  test("ADR-199: a professora SEM saldo recebe 429, e as cenas fixas (da plataforma) saem assim mesmo; a que falha não entra em `falharam`", async () => {
    const semSaldo = montarMidia({ saldo: false });
    expect(await codigoDe(semSaldo.gerar())).toBe("sem-saldo-de-ia");
    expect(semSaldo.pedidosDeCena()).toHaveLength(2);
    expect(semSaldo.registradas.map(([c]) => c).sort()).toEqual(["caso-a", "caso-b"]);
    expect(semSaldo.consumido()).toBe(0);

    const falha = montarMidia({ falhaEm: "Outros alunos no mesmo pátio", noStorage: new Set(itensDoPacote(conteudoDoBancoPadrao()).map((i) => i.nome)) });
    const r = await falha.gerar();
    expect(r).toMatchObject({ completo: true, falharam: [] });
    expect(falha.registradas.map(([c]) => c)).not.toContain("caso-b");
    /* A próxima chamada tenta de novo a que falhou — e só ela. */
    const antes = falha.pedidosDeCena().length;
    await falha.gerar();
    expect(falha.pedidosDeCena().length - antes).toBe(1);
  });

  test("a que falha volta em `falharam`, não é cobrada e fica sem URL (a ilustração local)", async () => {
    const m = montarMidia({ falhaEm: "telão pendurado" });
    const r = await m.gerar();
    expect(r).toMatchObject({ falharam: ["telao"], prontas: 3, completo: false });
    expect(r.imagens.telao).toBeUndefined();
    expect(m.consumido()).toBe(3 * CUSTO_ESTIMADO_POR_IMAGEM);
  });

  test("REFAZER uma imagem: arquivo NOVO, debitado, na chave dela; sem saldo 429; provedor fora 503; aprovadas 409", async () => {
    const m = montarMidia();
    const r = ImagemRefeitaSchema.parse(await m.refazer("telao"));
    expect(r.chave).toBe("telao");
    expect(r.url).not.toBe(`https://cdn/${nomeDaImagem(promptDaImagem("telao", m.conteudo))}`);
    expect(r.url).toMatch(/^https:\/\/cdn\/feira\/[0-9a-f]{32}-[0-9a-f-]+\.webp$/);
    expect(m.registradas).toEqual([["telao", r.url]]);
    expect(m.consumido()).toBe(CUSTO_ESTIMADO_POR_IMAGEM);

    expect(await codigoDe(montarMidia({ saldo: false }).refazer("mural"))).toBe("sem-saldo-de-ia");
    const fora = montarMidia({ falhaEm: "mural de cortiça" });
    expect(await codigoDe(fora.refazer("mural"))).toBe("ia-indisponivel");
    expect(fora.registradas).toEqual([]);
    expect(fora.consumido()).toBe(0);
    expect(await codigoDe(montarMidia({ aprovada: true }).refazer("mural"))).toBe("imagens-ja-aprovadas");
    expect(await codigoDe(montarMidia({ aprovada: true }).gerar())).toBe("imagens-ja-aprovadas");
  });

  test("dois cliques no mesmo Refazer pagam UMA imagem", async () => {
    const m = montarMidia();
    const [a, b] = await Promise.all([m.refazer("cartaz"), m.refazer("cartaz")]);
    expect(a).toEqual(b);
    expect(m.prompts).toHaveLength(1);
  });
});

// ─────────────────────────────────────────── as imagens do banco padrão (admin)

function montarBanco({ falhaEm = "", jaExistem = new Set<string>() } = {}) {
  const storage = new Set<string>(jaExistem);
  const pedidos: string[] = [];
  const real = {
    generateImage: async (prompt: string) => {
      pedidos.push(prompt);
      if (falhaEm && prompt.includes(falhaEm)) throw new Error("provedor fora");
      return Buffer.from("imagem");
    },
  } as unknown as AiProvider;
  /* O MEDIDOR de verdade em volta do provider falso: é ele que grava o consumo do painel de custos (ADR-161). */
  const consumos: UsoDeIa[] = [];
  const { metricas, encerrar } = metricasEmMemoria();
  const ia = new MedidorDeProvider(real, metricas, { padrao: "p", longo: "l", imagem: "modelo-imagem", voz: "v" }, (uso) =>
    consumos.push(uso),
  );
  const assets = {
    salvarMidiaDeExperiencia: async ({ nome }: { nome: string }) => {
      storage.add(nome);
      return `https://cdn/${nome}`;
    },
    midiaDeExperienciaExiste: async (_e: string, nome: string) => storage.has(nome),
    urlDaMidiaDeExperiencia: (_e: string, nome: string) => `https://cdn/${nome}`,
  } as unknown as AssetsService;
  return { servico: new ImagensDoBancoPadraoDaExp03ef1bService(ia, assets), pedidos, consumos, encerrar };
}

describe("as imagens do banco padrão (só o admin)", () => {
  test("a guarda: só o admin; professora e gestores recebem 403", () => {
    const guarda = new RolesGuard(new Reflector());
    const contexto = (perfil: string) =>
      ({
        getHandler: () => NinaNoticiaBancoPadraoController.prototype.gerar,
        getClass: () => NinaNoticiaBancoPadraoController,
        switchToHttp: () => ({ getRequest: () => ({ auth: { perfil } }) }),
      }) as unknown as ExecutionContext;
    expect(guarda.canActivate(contexto("admin"))).toBe(true);
    for (const perfil of ["professor", "gestor_escola", "gestor_contrato", "estudante"]) {
      expect(() => guarda.canActivate(contexto(perfil))).toThrow(ForbiddenException);
    }
  });

  test("as seis (pacote + cenas fixas), só as que faltam, idempotente — com o MESMO nome da customização", async () => {
    const [mural] = itensDoPacote(conteudoDoBancoPadrao());
    const m = montarBanco({ jaExistem: new Set([mural!.nome]) });
    const antes = ImagensDoBancoPadraoSchema.parse(await m.servico.progresso());
    expect(antes).toMatchObject({ total: 6, prontas: 1, completo: false });
    expect(antes.faltam).not.toContain("mural");
    const r = GeracaoDoBancoPadraoSchema.parse(await m.servico.gerar());
    expect(r).toMatchObject({ total: 6, prontas: 6, completo: true, falharam: [] });
    expect(r.geradas).toEqual(["portal", "telao", "cartaz", "caso-a", "caso-b"]);
    expect(m.pedidos).toHaveLength(5);
    expect((await m.servico.gerar()).geradas).toEqual([]);
    expect(m.pedidos).toHaveLength(5);
    expect(itensDoBanco().map((i) => i.nome)).toEqual(
      [...itensDoPacote(conteudoDoBancoPadrao()), ...itensDasCenasFixas()].map((i) => i.nome),
    );
    await m.encerrar();
  });

  test("medida no painel de custos com ATRIBUIÇÃO explícita (plataforma, admin, recurso do banco); a que falha é medida e volta em `falharam`", async () => {
    const m = montarBanco({ falhaEm: "Outros alunos no mesmo pátio" });
    const r = await m.servico.gerar();
    expect(r.falharam).toEqual(["caso-b"]);
    expect(m.consumos).toHaveLength(6);
    for (const uso of m.consumos) {
      expect(uso).toMatchObject({ operacao: "generateImage", modalidade: "imagem", imagens: uso.ok ? 1 : 0 });
      expect(uso.atribuicao).toEqual({ escolaId: null, perfil: "admin", recurso: RECURSO_DAS_IMAGENS_DO_BANCO });
    }
    expect(m.consumos.filter((c) => !c.ok)).toHaveLength(1);
    expect(ATRIBUICAO_DAS_IMAGENS_DO_BANCO.recurso).toBe("nina-noticia-banco-padrao");
    expect(RECURSOS_DE_IA[RECURSO_DAS_IMAGENS_DO_BANCO]?.nome).toMatch(/banco padrão/);
    expect(RECURSOS_DE_IA["nina-noticia"]?.nome).toBe("Nina e a Notícia que Desapareceu");
    await m.encerrar();
  });

  test("`existentes` nunca lança: o storage fora do ar vira vazio", async () => {
    const quebrado = new ImagensDoBancoPadraoDaExp03ef1bService({} as AiProvider, {
      midiaDeExperienciaExiste: async () => {
        throw new Error("storage fora");
      },
    } as unknown as AssetsService);
    expect(await quebrado.existentes()).toEqual({});
  });
});

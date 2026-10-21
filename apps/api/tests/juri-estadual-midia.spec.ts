import { ForbiddenException, HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UsoDeIa } from "../src/ai/consumo-de-ia";
import { MedidorDeProvider } from "../src/ai/medidor.provider";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { RolesGuard } from "../src/auth/roles";
import type { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import type { JuriEstadualService, PacoteLido } from "../src/juri-estadual/juri-estadual.service";
import { conteudoDoBancoPadrao } from "../src/juri-estadual/banco-padrao";
import {
  ATRIBUICAO_DAS_IMAGENS_DO_BANCO,
  ImagensDoBancoPadraoService,
  RECURSO_DAS_IMAGENS_DO_BANCO,
} from "../src/juri-estadual/banco-padrao-imagens.service";
import { GeracaoDoBancoPadraoSchema, ImagensDoBancoPadraoSchema } from "../src/juri-estadual/contrato-de-rotas";
import { JuriEstadualBancoPadraoController } from "../src/juri-estadual/juri-estadual-banco-padrao.controller";
import {
  CUSTO_ESTIMADO_POR_IMAGEM,
  IMAGENS_EM_PARALELO,
  IMAGENS_POR_CHAMADA,
  MidiaDaExp06ef1bService,
  nomeDaImagem,
} from "../src/juri-estadual/midia.service";
import { promptDaImagem } from "../src/juri-estadual/prompts";
import { LAMINAS, chaveDaMidia, nomeDaLamina, promptDeLamina, type Lamina } from "../src/juri-estadual/regras/laminas";
import { PreparoDaExp06ef1bService } from "../src/juri-estadual/preparo.service";
import { RECURSOS_DE_IA } from "../src/recursos/custos-de-ia";
import { AREAS, type Area } from "../src/juri-estadual/vocabulario";
import {
  PARAMETROS_DE_TESTE,
  areaDaIaDeTeste,
  categoriasDaIaDeTeste,
  conteudoDeTeste,
} from "./juri-estadual-fixture";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * "GERAR OUTRA IMAGEM" de um estande do Júri Estadual (o pedido do PO: o
 * professor vê e valida as imagens antes da turma) — SEM banco: o nome do
 * arquivo refeito e o serviço com provider, bucket, quota e missão falsos.
 * Molde: `a-selecao-midia.spec.ts`.
 */

const CONTEUDO = conteudoDeTeste();
const PROJETO = CONTEUDO.projetos[0]!;

function montar({ saldo = true, aprovada = false, falhaNaIa = false, semMidia = false } = {}) {
  const salvos: string[] = [];
  const registradas: Array<[string, string]> = [];
  const prompts: string[] = [];
  let consumido = 0;
  let geradas = 0;
  let emVoo = 0;
  let picoEmVoo = 0;
  const ia = {
    generateImage: async (prompt: string) => {
      geradas += 1;
      prompts.push(prompt);
      emVoo += 1;
      picoEmVoo = Math.max(picoEmVoo, emVoo);
      await new Promise((r) => setTimeout(r, 1));
      emVoo -= 1;
      if (falhaNaIa) throw new Error("provedor fora");
      return Buffer.from("imagem");
    },
  } as unknown as AiProvider;
  const assets = {
    salvarMidiaDeExperiencia: async ({ nome }: { nome: string }) => {
      salvos.push(nome);
      return `https://cdn/${nome}`;
    },
    midiaDeExperienciaExiste: async (_exp: string, nome: string) => salvos.includes(nome),
    urlDaMidiaDeExperiencia: (_exp: string, nome: string) => `https://cdn/${nome}`,
  } as unknown as AssetsService;
  const quota = {
    temSaldo: async () => saldo,
    consumir: async (_e: string, _u: string, tokens: number) => {
      consumido += tokens;
    },
  } as unknown as QuotaService;
  const pacote: PacoteLido = {
    id: "p1",
    escolaId: "escola",
    turmaId: "turma",
    disciplina: PARAMETROS_DE_TESTE.disciplina,
    tema: CONTEUDO.tema,
    assuntos: PARAMETROS_DE_TESTE.assuntos,
    contexto: null,
    origem: "ia",
    conteudo: CONTEUDO,
    midia: semMidia ? {} : { [PROJETO.id]: "https://cdn/antiga.webp" },
  };
  const juri = {
    pacoteParaMidia: async () => {
      if (aprovada) throw new HttpException({ codigo: "imagens-ja-aprovadas" }, 409);
      return pacote;
    },
    registrarMidia: async (_e: string, _p: string, chave: string, url: string) => {
      registradas.push([chave, url]);
    },
  } as unknown as JuriEstadualService;
  const servico = new MidiaDaExp06ef1bService(ia, assets, quota, juri);
  const refazer = (projetoId: string, lamina?: Lamina) =>
    servico.refazer("escola", "turma", "prof", "prof", "professor", "p1", projetoId, lamina);
  return { servico, refazer, salvos, registradas, prompts, estado: () => ({ consumido, geradas, picoEmVoo }) };
}

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (erro) {
    return ((erro as HttpException).getResponse() as { codigo?: string }).codigo;
  }
}

describe("o nome do arquivo da imagem do estande", () => {
  test("sem variação é o da descrição (a herança entre pacotes depende disso)", () => {
    expect(nomeDaImagem("Um estande")).toBe(nomeDaImagem("  Um estande "));
    expect(nomeDaImagem("Um estande")).toMatch(/^mostra\/[0-9a-f]{32}\.webp$/);
  });
  test("a refeita é OUTRO arquivo: não sobrescreve a de quem herdou a descrição", () => {
    expect(nomeDaImagem("Um estande", "v1")).not.toBe(nomeDaImagem("Um estande"));
    expect(nomeDaImagem("Um estande", "v1")).not.toBe(nomeDaImagem("Um estande", "v2"));
  });
});

describe("as quatro lâminas do carrossel (ADR-178)", () => {
  test("a capa é o arquivo de sempre (as imagens já geradas seguem valendo); as outras três, um arquivo cada", () => {
    expect(nomeDaLamina("capa", PROJETO)).toBe(nomeDaImagem(PROJETO.imagem.descricao));
    const nomes = LAMINAS.map((l) => nomeDaLamina(l, PROJETO));
    expect(new Set(nomes).size).toBe(4);
    expect(nomeDaLamina("detalhe", PROJETO)).toMatch(/^mostra\/detalhe-[0-9a-f]{32}\.webp$/);
  });

  test("mudar o texto dos bastidores troca SÓ o arquivo da lâmina dos bastidores", () => {
    const editado = { ...PROJETO, bastidor: `${PROJETO.bastidor} Testamos de novo.` };
    expect(nomeDaLamina("bastidor", editado)).not.toBe(nomeDaLamina("bastidor", PROJETO));
    for (const l of ["capa", "detalhe", "equipe"] as const) expect(nomeDaLamina(l, editado)).toBe(nomeDaLamina(l, PROJETO));
  });

  test("a chave da capa é o id do projeto (o contrato de antes); as outras levam a lâmina", () => {
    expect(chaveDaMidia(PROJETO.id, "capa")).toBe(PROJETO.id);
    expect(chaveDaMidia(PROJETO.id, "bastidor")).toBe(`${PROJETO.id}:bastidor`);
  });

  test("cada lâmina pede a sua cena: a capa é o pedido de sempre; os bastidores levam o texto do teste", () => {
    expect(promptDeLamina("capa", PROJETO)).toBe(promptDaImagem(PROJETO.imagem.descricao));
    const pedidos = LAMINAS.map((l) => promptDeLamina(l, PROJETO));
    expect(new Set(pedidos).size).toBe(4);
    expect(promptDeLamina("bastidor", PROJETO)).toContain(PROJETO.bastidor.slice(0, 30));
    expect(promptDeLamina("equipe", PROJETO)).toMatch(/rosto/i);
  });
});

describe("gerar outra imagem de um estande", () => {
  test("gera, grava num arquivo novo, debita a quota e troca a URL do estande", async () => {
    const m = montar();
    const r = await m.refazer(PROJETO.id);
    expect(r).toMatchObject({ pacoteId: "p1", projetoId: PROJETO.id });
    expect(m.salvos).toHaveLength(1);
    expect(m.salvos[0]).not.toBe(nomeDaImagem(PROJETO.imagem.descricao));
    expect(m.registradas).toEqual([[PROJETO.id, r.url]]);
    expect(m.estado().consumido).toBe(CUSTO_ESTIMADO_POR_IMAGEM);
  });

  test("refazer UMA lâmina grava na chave dela, com o pedido dela, e não toca a capa", async () => {
    const m = montar();
    const r = await m.refazer(PROJETO.id, "detalhe");
    expect(r).toMatchObject({ lamina: "detalhe", chave: `${PROJETO.id}:detalhe` });
    expect(m.registradas).toEqual([[`${PROJETO.id}:detalhe`, r.url]]);
    expect(m.prompts).toEqual([promptDeLamina("detalhe", PROJETO)]);
    expect(m.salvos[0]).not.toBe(nomeDaLamina("detalhe", PROJETO));
  });

  test("dois cliques no mesmo estande pagam UMA imagem", async () => {
    const m = montar();
    const [a, b] = await Promise.all([m.refazer(PROJETO.id), m.refazer(PROJETO.id)]);
    expect(a).toEqual(b);
    expect(m.estado().geradas).toBe(1);
  });

  test("estande que não é do pacote é 400; sem saldo é 429; aprovadas não mudam", async () => {
    expect(await codigoDe(montar().refazer("proj-z9"))).toBe("payload-invalido");
    const semSaldo = montar({ saldo: false });
    expect(await codigoDe(semSaldo.refazer(PROJETO.id))).toBe("sem-saldo-de-ia");
    expect(semSaldo.estado().geradas).toBe(0);
    expect(await codigoDe(montar({ aprovada: true }).refazer(PROJETO.id))).toBe("imagens-ja-aprovadas");
  });

  test("o provedor fora do ar é 503, e o estande fica com a imagem que tinha (nada gravado, nada cobrado)", async () => {
    const m = montar({ falhaNaIa: true });
    expect(await codigoDe(m.refazer(PROJETO.id))).toBe("ia-indisponivel");
    expect(m.registradas).toEqual([]);
    expect(m.estado().consumido).toBe(0);
  });

  test("a geração em lote também para depois da aprovação", async () => {
    expect(await codigoDe(montar({ aprovada: true }).servico.gerar("escola", "turma", "prof", "prof", "professor", "p1"))).toBe(
      "imagens-ja-aprovadas",
    );
  });
});

describe("a geração em lote: quarenta estandes, quatro lâminas cada, oito por chamada", () => {
  const gerar = (m: ReturnType<typeof montar>) => m.servico.gerar("escola", "turma", "prof", "prof", "professor", "p1");

  test("cada chamada gera até OITO novas, QUATRO de cada vez; a mostra inteira são 160", async () => {
    expect(IMAGENS_POR_CHAMADA).toBe(8);
    expect(IMAGENS_EM_PARALELO).toBe(4);
    const m = montar({ semMidia: true });
    const primeira = await gerar(m);
    expect(primeira).toMatchObject({ total: 160, prontas: 8, faltam: 152, completo: false });
    /* Na ordem do carrossel: as quatro do 1º estande, depois as do 2º. */
    expect(primeira.geradas.slice(0, 4)).toEqual(LAMINAS.map((l) => chaveDaMidia(PROJETO.id, l)));
    expect(m.estado().consumido).toBe(8 * CUSTO_ESTIMADO_POR_IMAGEM);
    expect(m.estado().picoEmVoo).toBe(4);
  });

  test("até completar, nenhuma é gerada duas vezes; o que já está no bucket entra de graça", async () => {
    const m = montar({ semMidia: true });
    let ultima = await gerar(m);
    let idas = 1;
    while (!ultima.completo) {
      ultima = await gerar(m);
      idas += 1;
    }
    expect(idas).toBe(20);
    expect(m.estado().geradas).toBe(160);
    expect(new Set(m.salvos).size).toBe(160);
  });
});

// ─────────────────────────────────────────────── as imagens do banco padrão

function montarBanco({ falhaEm = new Set<string>(), jaExistem = new Set<string>() } = {}) {
  const storage = new Set<string>(jaExistem);
  const pedidos: Array<{ prompt: string; atribuicao?: unknown }> = [];
  const real = {
    generateImage: async (prompt: string, opcoes?: { atribuicao?: unknown }) => {
      pedidos.push({ prompt, atribuicao: opcoes?.atribuicao });
      if ([...falhaEm].some((t) => prompt.includes(t))) throw new Error("provedor fora");
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
    midiaDeExperienciaExiste: async (_exp: string, nome: string) => storage.has(nome),
    urlDaMidiaDeExperiencia: (_exp: string, nome: string) => `https://cdn/${nome}`,
  } as unknown as AssetsService;
  return { servico: new ImagensDoBancoPadraoService(ia, assets), pedidos, consumos, storage, encerrar };
}

describe("PROVA 9: as imagens do banco padrão (admin)", () => {
  const banco = conteudoDoBancoPadrao().projetos;

  test("só o admin: professor e gestores recebem 403 da guarda", () => {
    const guarda = new RolesGuard(new Reflector());
    const contexto = (perfil: string) =>
      ({
        getHandler: () => JuriEstadualBancoPadraoController.prototype.gerar,
        getClass: () => JuriEstadualBancoPadraoController,
        switchToHttp: () => ({ getRequest: () => ({ auth: { perfil } }) }),
      }) as unknown as ExecutionContext;
    expect(guarda.canActivate(contexto("admin"))).toBe(true);
    for (const perfil of ["professor", "gestor_escola", "gestor_contrato", "estudante"]) {
      expect(() => guarda.canActivate(contexto(perfil))).toThrow(ForbiddenException);
    }
  });

  test("gera SÓ as que faltam, oito por chamada, as quatro lâminas, com o nome da customização, e é idempotente", async () => {
    const jaFeita = nomeDaImagem(banco[1]!.imagem.descricao);
    const m = montarBanco({ jaExistem: new Set([jaFeita]) });
    const antes = await m.servico.progresso();
    expect(ImagensDoBancoPadraoSchema.safeParse(antes).success).toBe(true);
    expect(antes).toMatchObject({ total: 160, prontas: 1, completo: false });
    expect(antes.faltam).not.toContain(banco[1]!.id);
    expect(antes.faltam).toContain(`${banco[1]!.id}:detalhe`);
    expect(antes.imagens[banco[1]!.id]).toBe(`https://cdn/${jaFeita}`);

    const r = await m.servico.gerar();
    expect(GeracaoDoBancoPadraoSchema.safeParse(r).success).toBe(true);
    /* A capa já existente foi pulada: as oito novas são as próximas da ordem do banco. */
    const [a, b, c] = [banco[0]!.id, banco[1]!.id, banco[2]!.id];
    expect(r.geradas).toEqual([a, `${a}:detalhe`, `${a}:equipe`, `${a}:bastidor`, `${b}:detalhe`, `${b}:equipe`, `${b}:bastidor`, c]);
    expect(r).toMatchObject({ prontas: 9, completo: false });
    expect(m.storage.has(nomeDaLamina("bastidor", banco[0]!))).toBe(true);

    /* Até completar: nenhuma imagem é gerada duas vezes. */
    let ultima = r;
    while (!ultima.completo) ultima = await m.servico.gerar();
    expect(ultima).toMatchObject({ total: 160, prontas: 160, faltam: [], completo: true });
    expect(m.pedidos).toHaveLength(159);
    const denovo = await m.servico.gerar();
    expect(denovo.geradas).toEqual([]);
    expect(m.pedidos).toHaveLength(159);
    await m.encerrar();
  });

  test("a imagem é medida no painel de custos com ATRIBUIÇÃO explícita: plataforma, admin, recurso do banco padrão", async () => {
    const m = montarBanco();
    await m.servico.gerar();
    expect(m.consumos).toHaveLength(8);
    for (const uso of m.consumos) {
      expect(uso).toMatchObject({ operacao: "generateImage", modalidade: "imagem", imagens: 1, ok: true });
      expect(uso.atribuicao).toEqual({ escolaId: null, perfil: "admin", recurso: RECURSO_DAS_IMAGENS_DO_BANCO });
    }
    expect(ATRIBUICAO_DAS_IMAGENS_DO_BANCO.recurso).toBe("juri-estadual-banco-padrao");
    expect(RECURSOS_DE_IA[RECURSO_DAS_IMAGENS_DO_BANCO]?.nome).toMatch(/banco padrão/);
    await m.encerrar();
  });

  test("a que falha volta em `falharam`, é medida (ok: false) e não vai ao storage; a próxima chamada tenta de novo", async () => {
    /* O título está no pedido das quatro lâminas do 1º estande. */
    const m = montarBanco({ falhaEm: new Set([banco[0]!.titulo]) });
    const r = await m.servico.gerar();
    expect(r.falharam).toEqual(LAMINAS.map((l) => chaveDaMidia(banco[0]!.id, l)));
    expect(r.geradas).toHaveLength(4);
    expect(r.faltam).toContain(banco[0]!.id);
    expect(m.consumos.filter((c) => !c.ok)).toHaveLength(4);
    await m.encerrar();
  });

  test("dois cliques simultâneos recebem o MESMO trabalho", async () => {
    const m = montarBanco();
    const [a, b] = await Promise.all([m.servico.gerar(), m.servico.gerar()]);
    expect(a).toEqual(b);
    expect(m.pedidos).toHaveLength(8);
    await m.encerrar();
  });

  test("`existentes` é o que o pacote padrão leva na midia; o storage fora do ar não derruba (vira vazio)", async () => {
    const m = montarBanco({ jaExistem: new Set([nomeDaImagem(banco[5]!.imagem.descricao)]) });
    expect(await m.servico.existentes()).toEqual({ [banco[5]!.id]: `https://cdn/${nomeDaImagem(banco[5]!.imagem.descricao)}` });
    const quebrado = new ImagensDoBancoPadraoService({} as AiProvider, {
      midiaDeExperienciaExiste: async () => {
        throw new Error("storage fora");
      },
    } as unknown as AssetsService);
    expect(await quebrado.existentes()).toEqual({});
    await m.encerrar();
  });
});

// ─────────────────────────────────────────── o preparo em quatro chamadas

function montarPreparo(responder: (req: AiJsonRequest<unknown>, n: number) => unknown) {
  let chamadas = 0;
  let debitado = 0;
  const ia = {
    generateJson: async <T>(req: AiJsonRequest<T>) => {
      const tentativas = req.tentativas ?? 1;
      let erro: unknown;
      for (let t = 0; t < tentativas; t++) {
        chamadas += 1;
        req.aoUsarTokens?.(100, { entrada: 40, saida: 60 });
        try {
          return req.validar(responder(req as AiJsonRequest<unknown>, chamadas));
        } catch (e) {
          erro = e;
        }
      }
      throw erro;
    },
  } as unknown as AiProvider;
  const quota = {
    temSaldo: async () => true,
    consumir: async (_e: string, _u: string, n: number) => {
      debitado += n;
    },
  } as unknown as QuotaService;
  return { servico: new PreparoDaExp06ef1bService(ia, quota), estado: () => ({ chamadas, debitado }) };
}

const areaDoPrompt = (prompt: string): Area | null => AREAS.find((a) => prompt.includes(`A área destes projetos é ${a}`)) ?? null;

describe("o preparo: categorias e as quatro áreas em paralelo", () => {
  test("cinco chamadas (categorias + quatro áreas) montam os quarenta, e o débito soma TODAS", async () => {
    const m = montarPreparo((req) => {
      const area = areaDoPrompt(req.prompt);
      return area ? areaDaIaDeTeste(area) : categoriasDaIaDeTeste();
    });
    const r = await m.servico.gerar("escola", "prof", "professor", PARAMETROS_DE_TESTE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toEqual(conteudoDeTeste(PARAMETROS_DE_TESTE.tema));
    expect(m.estado()).toEqual({ chamadas: 5, debitado: 500 });
    expect(r.tokens).toBe(500);
  });

  test("o título repetido ENTRE áreas é regerado sozinho (uma chamada a mais), com a lista dos outros 39", async () => {
    const regeneracoes: string[] = [];
    const m = montarPreparo((req) => {
      const area = areaDoPrompt(req.prompt);
      if (area === "area_d") {
        const d = areaDaIaDeTeste("area_d") as { projetos: Record<string, unknown>[] };
        return { projetos: d.projetos.map((p) => (p.id === "proj-d7" ? { ...p, titulo: "Placa solar de garrafa" } : p)) };
      }
      if (area) return areaDaIaDeTeste(area);
      if (req.prompt.includes("Reescreva UM projeto")) {
        regeneracoes.push(req.prompt);
        const d7 = (areaDaIaDeTeste("area_d") as { projetos: Record<string, unknown>[] }).projetos.find((p) => p.id === "proj-d7");
        return { projeto: { ...d7, titulo: "Bengala com sensor de chão" } };
      }
      return categoriasDaIaDeTeste();
    });
    const r = await m.servico.gerar("escola", "prof", "professor", PARAMETROS_DE_TESTE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(regeneracoes).toHaveLength(1);
    expect(regeneracoes[0]).toContain('o id "proj-d7"');
    expect(r.valor.projetos.find((p) => p.id === "proj-d7")?.titulo).toBe("Bengala com sensor de chão");
    expect(m.estado().chamadas).toBe(6);
  });

  test("uma área que falha as duas tentativas derruba o rascunho (o fallback é da rota), e TUDO o que foi pago é debitado", async () => {
    const m = montarPreparo((req) => {
      const area = areaDoPrompt(req.prompt);
      if (area === "area_c") return { projetos: [] };
      return area ? areaDaIaDeTeste(area) : categoriasDaIaDeTeste();
    });
    const r = await m.servico.gerar("escola", "prof", "professor", PARAMETROS_DE_TESTE);
    expect(r).toMatchObject({ ok: false, codigo: "ia-indisponivel", chamouIa: true });
    /* Categorias (1) + três áreas boas (3) + a ruim nas duas tentativas (2). */
    expect(m.estado()).toEqual({ chamadas: 6, debitado: 600 });
  });
});

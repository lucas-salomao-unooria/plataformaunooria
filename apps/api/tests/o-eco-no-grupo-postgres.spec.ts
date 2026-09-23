import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { MockProvider } from "../src/ai/mock.provider";
import { QuotaService } from "../src/ai/quota.service";
import { AssetsService } from "../src/assets/assets.service";
import { IaDaExp07ef1bService } from "../src/o-eco-no-grupo/ia.service";
import { MidiaDaExp07ef1bService } from "../src/o-eco-no-grupo/midia.service";
import { OEcoNoGrupoService } from "../src/o-eco-no-grupo/o-eco-no-grupo.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp07ef1b no Postgres: o gate da aula, o fluxo completo, a corrida
 * em "enviar", o latch e a tenancy. UMA ESCOLA POR SUÍTE (o Jest paraleliza
 * suítes; limpeza compartilhada corromperia a outra).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-eco";
const OUTRA_ESCOLA = "teste-eco-outra";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

/**
 * `MockProvider` de propósito: ele falha fechado em `generateJson`,
 * `generateSpeech` e `generateImage`, o que exercita justamente o caminho que
 * TEM de funcionar sem Vertex nenhum — o bairro reage pelo roteiro do catálogo,
 * a mídia fica `null` e a missão fecha inteira. É o piso que garante que uma
 * aula não depende de o modelo estar de pé.
 */
const config = new ConfigService({
  ASSETS_DRIVER: "local",
  ASSETS_LOCAL_DIR: "/tmp/eco-teste-assets",
});
const provider = new MockProvider();
const quota = new QuotaService(prisma);
const assets = new AssetsService(config);
const service = new OEcoNoGrupoService(
  prisma,
  new IaDaExp07ef1bService(provider, quota),
  new MidiaDaExp07ef1bService(provider, assets, quota),
);

let turmaId = "";
let estudanteA = "";
let estudanteB = "";
let estudanteSemTurma = "";

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.ecoSessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.ecoGateTurma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) {
      const corpo = e.getResponse() as { codigo?: string };
      return corpo.codigo ?? `HTTP_${e.getStatus()}`;
    }
    throw e;
  }
}

/** Leva o estudante até a porta da decisão, com a Aula 2 aberta. */
async function ateAIntervencao(estudanteId: string) {
  await service.acao(ESCOLA, estudanteId, turmaId, "entrar-no-grupo");
  await service.acao(ESCOLA, estudanteId, turmaId, "ouvir-audio");
  await service.acao(ESCOLA, estudanteId, turmaId, "inspecionar-materia");
  await service.acao(ESCOLA, estudanteId, turmaId, "encerrar-investigacao");
  await service.mexerNoGate(ESCOLA, turmaId, "liberar-aula2");
  await service.acao(ESCOLA, estudanteId, turmaId, "ouvir-podcast");
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Eco (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  const turma = await criarTurmaDeTeste(prisma, ESCOLA, "7A", "7EF");
  turmaId = turma.id;
  const criar = (username: string, displayName: string, comTurma: boolean) =>
    prisma.user.create({
      data: {
        role: "estudante",
        escolaId: ESCOLA,
        turmaId: comTurma ? turmaId : null,
        username,
        displayName,
        passwordHash: "x",
      },
      select: { id: true },
    });
  estudanteA = (await criar("eco.ana", "Ana Teste", true)).id;
  estudanteB = (await criar("eco.bia", "Bia Teste", true)).id;
  estudanteSemTurma = (await criar("eco.sem", "Sem Turma", false)).id;

  /* A PORTA DA SALA (ADR-69): sem esta linha `estudanteDaEscola` — o funil de
     todas as rotas de estudante — recusa com 403 `missao-nao-liberada`. */
  await liberarParaTeste(prisma, ESCOLA, turmaId, "exp07ef1b", estudanteA);
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("tenancy no banco", () => {
  test("as quatro tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    const tabelas = [
      "exp07ef1b_sessoes",
      "exp07ef1b_mensagens",
      "exp07ef1b_reflexoes",
      "exp07ef1b_gates_turma",
    ];
    for (const tabela of tabelas) {
      const [linha] = await prisma.$queryRawUnsafe<
        { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`);
      expect(linha).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  test("o score só aceita 0, 70 e 100 — o CHECK é a rede final da regra 3", async () => {
    // Se um caminho novo tentar gravar pontuação vinda do cliente, o banco recusa.
    await expect(
      prisma.$executeRaw`
        INSERT INTO exp07ef1b_sessoes (escola_id, estudante_id, passo, score)
        VALUES (${ESCOLA}, ${estudanteA}::uuid, 'desfecho', 55)`,
    ).rejects.toThrow(/score_check/);
  });

  test("conclusão e carimbo não podem divergir", async () => {
    // Uma tela dizendo "missão cumprida" sobre uma linha sem `concluido_em` é
    // um relatório que mente para o professor.
    await expect(
      prisma.$executeRaw`
        INSERT INTO exp07ef1b_sessoes (escola_id, estudante_id, passo, score)
        VALUES (${ESCOLA}, ${estudanteA}::uuid, 'fim', 100)`,
    ).rejects.toThrow(/fim_check/);
  });

  test("o percurso exige exatamente 2 estratégias", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO exp07ef1b_reflexoes (escola_id, estudante_id, estrategias, justificativa)
        VALUES (${ESCOLA}, ${estudanteA}::uuid, ARRAY['buscar_fonte'], 'evidencia_desarma')`,
    ).rejects.toThrow(/estrategias_check/);
  });
});

describe("sessão", () => {
  test("sem linha devolve o estado inicial, o catálogo sem gabarito e NÃO cria linha", async () => {
    const r = await service.sessao(ESCOLA, estudanteA, turmaId);
    expect(r).toMatchObject({
      passo: "chat_amara",
      passoDoEstudante: "chat_amara",
      aguardandoATurma: false,
      inspecionouMateria: false,
      opcao: null,
      concluidoEm: null,
      turma: { etapa: "investigacao" },
    });
    expect(r.catalogo.feed).toHaveLength(8);
    expect(r.catalogo.opcoes).toHaveLength(3);
    expect(r.estudante).toEqual({ nome: "Ana Teste", avatar: "A" });
    expect(r.reacoes).toBeNull();
    // O gabarito não tem NOME no payload: `correta` e `prioritaria` são os
    // campos do catálogo que decidem a lição, e nenhum deles atravessa.
    for (const campo of ["correta", "prioritaria"]) {
      expect(JSON.stringify(r)).not.toContain(campo);
    }
    // `desfecho` existe no contrato, mas vem NULO antes de haver resposta —
    // ele diz o que aconteceu, nunca o que vai acontecer.
    expect(r.desfecho).toBeNull();
    expect(await prisma.ecoSessao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });
});

describe("o gate da aula", () => {
  test("a Aula 1 termina no breakpoint e o estudante espera lá", async () => {
    await service.acao(ESCOLA, estudanteA, turmaId, "entrar-no-grupo");
    await service.acao(ESCOLA, estudanteA, turmaId, "inspecionar-materia");
    const r = await service.acao(ESCOLA, estudanteA, turmaId, "encerrar-investigacao");
    expect(r).toMatchObject({
      passo: "breakpoint",
      passoDoEstudante: "breakpoint",
      aguardandoATurma: false,
    });
    // Sem a Aula 2 aberta, nem o podcast destrava.
    expect(await codigoDe(service.acao(ESCOLA, estudanteA, turmaId, "ouvir-podcast"))).toBe(
      "passo-invalido",
    );
  });

  test("liberar a Aula 2 é idempotente — é o clique que se dá duas vezes", async () => {
    const primeira = await service.mexerNoGate(ESCOLA, turmaId, "liberar-aula2");
    const segunda = await service.mexerNoGate(ESCOLA, turmaId, "liberar-aula2");
    expect(primeira.etapa).toBe("aula2");
    expect(segunda.etapa).toBe("aula2");
    expect(await prisma.ecoGateTurma.count({ where: { escolaId: ESCOLA, turmaId } })).toBe(1);
  });

  test("com a Aula 2 aberta, o piso empurra quem estava no breakpoint para o podcast", async () => {
    const r = await service.gate(ESCOLA, turmaId, "breakpoint");
    expect(r).toMatchObject({ etapa: "aula2", passoEfetivo: "podcast" });
    expect(new Date(r.agora).getTime()).toBeGreaterThan(0);
  });

  test("congelar o debate trava quem já estava na reflexão", async () => {
    await service.mexerNoGate(ESCOLA, turmaId, "congelar-debate");
    expect((await service.gate(ESCOLA, turmaId, "reflexao")).passoEfetivo).toBe("sintese");
    await service.mexerNoGate(ESCOLA, turmaId, "liberar-aula2");
  });

  test("estudante sem turma corre sem gate", async () => {
    const r = await service.gate(ESCOLA, null, "intervencao");
    expect(r).toMatchObject({ etapa: "investigacao", passoEfetivo: "intervencao" });
  });
});

describe("fluxo da missão", () => {
  test("a impulsiva leva o bairro ao pânico e pode ser apagada; a checada fixa e não regride", async () => {
    await ateAIntervencao(estudanteB);

    const impulsiva = await service.intervencao(ESCOLA, estudanteB, turmaId, "estudante", "A", 4);
    expect(impulsiva.desfecho).toBe("ruido");
    expect(impulsiva.reacoes.map((r) => r.atrasoMs)).toEqual([2000, 3000, 2000]);
    expect(impulsiva).not.toHaveProperty("amaraCelebra");

    const desfeita = await service.desfazer(ESCOLA, estudanteB, turmaId);
    expect(desfeita).toMatchObject({ passo: "intervencao", opcao: null, desfazerUsado: 1 });
    expect(
      (await prisma.ecoSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: estudanteB } }))
        .reacoes,
    ).toBeNull();

    const checada = await service.intervencao(ESCOLA, estudanteB, turmaId, "estudante", "B", 51);
    expect(checada.desfecho).toBe("checada");
    expect(checada.amaraCelebra).toContain("mandou muito bem");
    expect(await codigoDe(service.desfazer(ESCOLA, estudanteB, turmaId))).toBe(
      "resposta-ja-enviada",
    );
  });

  test("o desfecho volta no estado, e é ele que a tela usa — não a letra", async () => {
    // Sem este campo, o cliente comparava `opcao === "B"` para decidir se
    // desenha o alfinete ou o botão de desfazer, e a resposta certa ia legível
    // para dentro do bundle público (regra 3).
    const r = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(r.desfecho).toBe("checada");
  });

  test("as reações gravadas voltam iguais depois de um F5", async () => {
    const antes = await service.sessao(ESCOLA, estudanteB, turmaId);
    const depois = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(antes.reacoes).not.toBeNull();
    expect(depois.reacoes).toEqual(antes.reacoes);
  });

  test("responder sem inspecionar a matéria é recusado — o portão da missão", async () => {
    const semChecar = (
      await prisma.user.create({
        data: {
          role: "estudante",
          escolaId: ESCOLA,
          turmaId,
          username: "eco.imp",
          displayName: "Impulsivo",
          passwordHash: "x",
        },
        select: { id: true },
      })
    ).id;
    await service.acao(ESCOLA, semChecar, turmaId, "entrar-no-grupo");
    await service.acao(ESCOLA, semChecar, turmaId, "encerrar-investigacao");
    await service.acao(ESCOLA, semChecar, turmaId, "ouvir-podcast");
    expect(await codigoDe(service.intervencao(ESCOLA, semChecar, turmaId, "estudante", "B", 3))).toBe(
      "sem-inspecao",
    );
  });

  test("dois toques simultâneos em enviar geram UMA resposta", async () => {
    // O lock por (escola, estudante) serializa: a segunda transação relê o
    // estado com a primeira aplicada e cai em `resposta-ja-enviada`.
    const corredor = (
      await prisma.user.create({
        data: {
          role: "estudante",
          escolaId: ESCOLA,
          turmaId,
          username: "eco.cor",
          displayName: "Corrida",
          passwordHash: "x",
        },
        select: { id: true },
      })
    ).id;
    await ateAIntervencao(corredor);
    const resultados = await Promise.allSettled([
      service.intervencao(ESCOLA, corredor, turmaId, "estudante", "B", 20),
      service.intervencao(ESCOLA, corredor, turmaId, "estudante", "B", 21),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const linha = await prisma.ecoSessao.findFirstOrThrow({
      where: { escolaId: ESCOLA, estudanteId: corredor },
    });
    expect(linha.opcao).toBe("B");
  });

  test("a síntese, o debate e o percurso na ordem que a professora abre", async () => {
    await service.verSintese(ESCOLA, estudanteB, turmaId);
    for (let i = 0; i < 3; i += 1) await service.acao(ESCOLA, estudanteB, turmaId, "avancar-card");

    // A reflexão não abre sozinha: é depois do debate.
    expect(
      await codigoDe(
        service.reflexao(ESCOLA, estudanteB, turmaId, "estudante", ["buscar_fonte", "reparar_selo"], "evidencia_desarma"),
      ),
    ).toBe("reflexao-nao-liberada");

    await service.mexerNoGate(ESCOLA, turmaId, "liberar-reflexao");
    await service.acao(ESCOLA, estudanteB, turmaId, "abrir-reflexao");
    const fim = await service.reflexao(
      ESCOLA,
      estudanteB,
      turmaId,
      "estudante",
      ["buscar_fonte", "reparar_selo"],
      "evidencia_desarma",
    );
    expect(fim).toMatchObject({ passo: "fim", score: 70 });
    expect(fim.concluidoEm).not.toBeNull();

    // Latch: segunda entrega recusada.
    expect(
      await codigoDe(
        service.reflexao(ESCOLA, estudanteB, turmaId, "estudante", ["buscar_fonte", "reparar_selo"], "evidencia_desarma"),
      ),
    ).toBe("reflexao-ja-enviada");
  });

  test("o percurso entregue é lido de volta na sessão, sem devolutiva do mock", async () => {
    // `devolutiva: null` aqui NÃO é o caminho quebrado: é o sanitizador
    // barrando a saída do mock, que ecoa o próprio prompt. Publicar isso seria
    // pôr na tela a descrição do mecanismo da missão.
    const r = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(r.reflexao).toMatchObject({
      estrategias: ["buscar_fonte", "reparar_selo"],
      justificativa: "evidencia_desarma",
      devolutiva: null,
    });
  });
});

describe("Amara no privado", () => {
  test("antes do desfecho ela está offline — o silêncio dela é a missão", async () => {
    // Se ela apontasse qual mensagem é falsa durante a investigação, o
    // reconhecimento de padrão que a missão mede deixaria de acontecer.
    const investigando = (
      await prisma.user.create({
        data: {
          role: "estudante",
          escolaId: ESCOLA,
          turmaId,
          username: "eco.inv",
          displayName: "Investigando",
          passwordHash: "x",
        },
        select: { id: true },
      })
    ).id;
    await service.acao(ESCOLA, investigando, turmaId, "entrar-no-grupo");
    expect(
      await codigoDe(
        service.amara(ESCOLA, investigando, turmaId, "estudante", "qual mensagem é falsa?"),
      ),
    ).toBe("amara-em-silencio");
    expect(await prisma.ecoMensagem.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("depois do desfecho ela conversa, e a fala do estudante fica gravada", async () => {
    const r = await service.amara(
      ESCOLA,
      estudanteB,
      turmaId,
      "estudante",
      "achei sacanagem terem cortado o parágrafo",
    );
    expect(r.texto.length).toBeGreaterThan(0);
    expect(r.turnosRestantes).toBe(2);
    const mensagens = await prisma.ecoMensagem.findMany({
      where: { escolaId: ESCOLA, estudanteId: estudanteB },
      orderBy: { id: "asc" },
    });
    expect(mensagens.map((m) => m.papel)).toEqual(["estudante", "amara"]);
  });

  test("no 4º envio ela precisa sair — é amiga, não assistente", async () => {
    await service.amara(ESCOLA, estudanteB, turmaId, "estudante", "e o Carlos, ficou envergonhado?");
    await service.amara(ESCOLA, estudanteB, turmaId, "estudante", "vou contar pra minha mãe");
    expect(
      await codigoDe(service.amara(ESCOLA, estudanteB, turmaId, "estudante", "mais uma coisa")),
    ).toBe("sem-turno");
  });

  test("a conversa volta inteira na sessão, depois de um F5", async () => {
    const r = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(r.amara.length).toBe(6);
    expect(r.amara[0]).toMatchObject({ papel: "estudante" });
  });
});

describe("mídia", () => {
  test("sem provider de verdade, tudo falha e o mapa vem com null", async () => {
    // `null` é informação, não erro: é o sinal para o cliente cair na
    // transcrição (que já está na tela) em vez de esperar um arquivo.
    // Perfil `gestor_escola` para o teste não precisar de matrícula: o filtro por
    // MATRÍCULA do professor já é exercido no painel.
    const r = await service.prepararMidia(ESCOLA, turmaId, estudanteA, "gestor_escola");
    expect(r.geradas).toEqual([]);
    expect(r.falharam.length).toBeGreaterThan(0);
    expect(Object.values(r.urls).every((u) => u === null)).toBe(true);
  });

  test("o mapa do estudante não gera nada — quem gera é o preparo", async () => {
    const urls = await service.midiaDaMissao();
    expect(Object.keys(urls).length).toBeGreaterThanOrEqual(5);
    expect(Object.values(urls).every((u) => u === null)).toBe(true);
  });
});

describe("painel do professor", () => {
  test("mostra progresso e distribuição, e NÃO tem coluna de pontos", async () => {
    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.turma).toMatchObject({ nome: "7A", serie: "7EF", etapa: "reflexao" });
    expect(painel.resumo.total).toBeGreaterThanOrEqual(4);
    expect(painel.resumo.responderam).toBeGreaterThanOrEqual(1);
    expect(painel.resumo.distribuicao).toMatchObject({ B: expect.any(Number) });
    expect(painel.resumo.usaramRecuperacao).toBeGreaterThanOrEqual(1);
    expect(painel.resumo.percursoComAsDuas).toBeGreaterThanOrEqual(1);
    for (const proibido of ["score", "pontos", "estrelas"]) {
      expect(JSON.stringify(painel)).not.toContain(proibido);
    }
    // Quem não tem turma não aparece no painel de turma nenhuma.
    expect(painel.estudantes.map((e) => e.estudanteId)).not.toContain(estudanteSemTurma);
  });

  test("turma de outra escola não é encontrada — a exceção não vaza existência", async () => {
    expect(await codigoDe(service.painel(OUTRA_ESCOLA, turmaId))).toBe("turma-nao-encontrada");
  });
});

describe("segunda aplicação", () => {
  test("zerar a turma apaga sessões e gate, e a missão recomeça do zero", async () => {
    const r = await service.zerarTurma(ESCOLA, turmaId);
    expect(r.sucesso).toBe(true);
    expect(r.registrosApagados).toBeGreaterThanOrEqual(1);
    expect(await prisma.ecoSessao.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await prisma.ecoReflexao.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await prisma.ecoGateTurma.count({ where: { escolaId: ESCOLA, turmaId } })).toBe(0);
    const depois = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(depois).toMatchObject({ passo: "chat_amara", turma: { etapa: "investigacao" } });
  });
});

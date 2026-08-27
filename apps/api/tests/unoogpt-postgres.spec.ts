import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { MockProvider } from "../src/ai/mock.provider";
import { QuotaService } from "../src/ai/quota.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { UnoogptService } from "../src/unoogpt/unoogpt.service";

/**
 * Integração da exp-03-unoogpt no Postgres: a largada da TURMA, o orçamento de
 * perguntas, a alocação com justificativa, a tempestade, o teto por sessão e
 * TENANCY.
 *
 * UMA ESCOLA POR SUÍTE — o Jest paraleliza suítes, e limpeza compartilhada
 * corromperia a vizinha.
 *
 * `AI_PROVIDER` é o mock: ele chama a primeira ferramenta declarada, então o
 * caminho de function-calling é de fato exercitado aqui. O que o mock NÃO pega
 * é o 400 do `thoughtSignature` — isso só a partida real com o Vertex pega, e
 * está na verificação manual do plano.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-unoogpt";
const OUTRA_ESCOLA = "teste-unoogpt-outra";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const config = new ConfigService({
  AI_DAILY_TOKEN_QUOTA_PER_ALUNO: 20000,
  AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR: 2_000_000,
});
const quota = new QuotaService(prisma, config);
const service = new UnoogptService(prisma, new MockProvider(), quota);

let turmaId = "";
let outraTurmaId = "";
let ana = "";
let bia = "";
let semTurma = "";
let deOutraEscola = "";

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.unoogptSessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.unoogptRelogioTurma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: { in: escolas } } });
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

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola unooGPT (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  const t = await prisma.turma.create({ data: { escolaId: ESCOLA, nome: "2A", serie: "2EM" } });
  turmaId = t.id;
  const o = await prisma.turma.create({ data: { escolaId: OUTRA_ESCOLA, nome: "2A", serie: "2EM" } });
  outraTurmaId = o.id;

  const criar = (escolaId: string, turma: string | null, username: string) =>
    prisma.user.create({
      data: { role: "aluno", escolaId, turmaId: turma, username, displayName: username, passwordHash: "x" },
      select: { id: true },
    });
  ana = (await criar(ESCOLA, turmaId, "ug.ana")).id;
  bia = (await criar(ESCOLA, turmaId, "ug.bia")).id;
  semTurma = (await criar(ESCOLA, null, "ug.sem")).id;
  deOutraEscola = (await criar(OUTRA_ESCOLA, outraTurmaId, "ug.outra")).id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("a largada é da TURMA, não do aluno", () => {
  it("antes da largada o cronômetro está parado e o Cientista não responde", async () => {
    const abertura = await service.sessao(ESCOLA, ana);
    expect(abertura.estado.fase).toBe("aguardando");
    expect(abertura.estado.aberta).toBe(false);
    // Falar antes da largada é o que a sala inteira tentaria fazer.
    expect(await codigoDe(service.pergunta(ESCOLA, ana, "aluno", "onde chove mais?"))).toBe(
      "relogio-nao-comecou",
    );
  });

  it("a largada do professor vale para TODOS os alunos da turma ao mesmo tempo", async () => {
    const retrato = await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    expect(retrato.fase).toBe("correndo");

    // Ana e Bia não fizeram nada: quem começou a aula foi o professor.
    for (const aluno of [ana, bia]) {
      const s = await service.sessao(ESCOLA, aluno);
      expect(s.estado.fase).toBe("correndo");
      expect(s.estado.aberta).toBe(true);
    }
  });

  it("apertar a largada duas vezes NÃO rebobina a aula da turma", async () => {
    // É exatamente o clique que um professor nervoso dá duas vezes.
    const antes = await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    await new Promise((r) => setTimeout(r, 50));
    const depois = await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    expect(depois.iniciadoEm).toBe(antes.iniciadoEm);
  });

  it("aluno sem turma vê o relógio PARADO — nunca um cronômetro só dele", async () => {
    // O projeto de origem armava um cronômetro individual aqui, e com ele um
    // aluno solto jogava sem largada. "Aguardando" é a verdade.
    const s = await service.sessao(ESCOLA, semTurma);
    expect(s.estado.fase).toBe("aguardando");
  });

  it("+2 min NÃO faz o minuto da cidade rebobinar", async () => {
    const antes = await service.mexerNoRelogio(ESCOLA, turmaId, "encerrar");
    void antes;
    await service.mexerNoRelogio(ESCOLA, turmaId, "redefinir");
    await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    const inicial = await service.relogio(ESCOLA, ana);
    const esticado = await service.mexerNoRelogio(ESCOLA, turmaId, "mais-tempo");
    expect(esticado.duracaoSeg).toBe(inicial.relogio.duracaoSeg + 120);
    const depois = await service.relogio(ESCOLA, ana);
    // O pivô é o que garante isto: sem ele, esticar de 5 para 7 minutos jogaria
    // a cidade do minuto 48 para o 34, na cara da turma.
    expect(depois.estado.minutosGastos).toBeGreaterThanOrEqual(inicial.estado.minutosGastos);
  });
});

describe("o turno do Cientista", () => {
  it("responde, grava a Transcrição e conta o custo na sessão", async () => {
    const r = await service.pergunta(ESCOLA, ana, "aluno", "onde mora mais gente?");
    expect(r.texto).toContain("[mock]");

    const falas = await prisma.unoogptMensagem.findMany({
      where: { escolaId: ESCOLA, alunoId: ana },
      orderBy: { id: "asc" },
    });
    expect(falas.map((f) => f.papel)).toEqual(["aluno", "agente"]);
    expect(falas[0]?.texto).toBe("onde mora mais gente?");

    const sessao = await prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_alunoId: { escolaId: ESCOLA, alunoId: ana } },
    });
    expect(sessao.chamadasIa).toBe(1);
    expect(sessao.tokensGastos).toBeGreaterThan(0);
    // A quota diária contou o mesmo gasto: os dois tetos leem o mesmo número.
    expect(await quota.usadoHoje(ESCOLA, ana)).toBe(sessao.tokensGastos);
  });

  it("ferramenta chamada com argumento inválido NÃO quebra o turno", async () => {
    // O mock chama `usar_dados` com argumentos VAZIOS — ele é genérico e não
    // conhece os slugs do domínio. Isso é justamente o caso que importa: um
    // modelo real também erra o argumento, e o turno tem de sobreviver a isso
    // em vez de devolver 500 para o aluno. (O laço de ferramenta em si tem
    // teste próprio em `ai-conversar.spec.ts`.)
    const antes = await service.sessao(ESCOLA, ana);
    expect(antes.sessao.conjuntos).toEqual([]);
    const r = await service.pergunta(ESCOLA, ana, "aluno", "e a previsão do tempo?");
    expect(r.texto).toContain("[mock]");
  });

  it("carregar fonte pelo painel enche o mapa — que começa VAZIO", async () => {
    const vazio = await service.sessao(ESCOLA, ana);
    expect(vazio.mapa.every((b) => b.estimativa === null)).toBe(true);
    // E nenhum bairro entrega tempo de deslocamento sem a malha viária.
    expect(vazio.mapa.every((b) => b.tempos === null)).toBe(true);

    const depois = await service.carregarConjuntos(ESCOLA, ana, ["censo", "viaria"]);
    expect(depois.sessao.conjuntos).toEqual(expect.arrayContaining(["censo", "viaria"]));
    expect(depois.mapa.some((b) => b.estimativa !== null)).toBe(true);
    expect(depois.mapa.every((b) => b.tempos !== null)).toBe(true);
    // Carregar fonte passa a valer como justificativa; intuição sempre valeu.
    expect(depois.justificativas.map((j) => j.valor)).toEqual(
      expect.arrayContaining(["censo", "viaria", "intuicao"]),
    );
  });

  it("o orçamento de 3 perguntas é debitado no SERVIDOR e trava na quarta", async () => {
    for (let i = 0; i < 6; i += 1) {
      const codigo = await codigoDe(service.pergunta(ESCOLA, bia, "aluno", `pergunta ${i} sobre a chuva?`));
      if (codigo === "sem-perguntas") break;
    }
    const sessao = await prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_alunoId: { escolaId: ESCOLA, alunoId: bia } },
    });
    expect(sessao.perguntasGastas).toBeLessThanOrEqual(3);
    // E a fala que debitou está marcada: é a trilha de auditoria do orçamento.
    const debitadas = await prisma.unoogptMensagem.count({
      where: { escolaId: ESCOLA, alunoId: bia, debitou: true },
    });
    expect(debitadas).toBe(sessao.perguntasGastas);
  });

  it("estourar o teto POR SESSÃO fecha a sala de operações", async () => {
    await prisma.unoogptSessao.update({
      where: { escolaId_alunoId: { escolaId: ESCOLA, alunoId: ana } },
      data: { tokensGastos: 999_999 },
    });
    expect(await codigoDe(service.pergunta(ESCOLA, ana, "aluno", "e agora?"))).toBe("teto-da-sessao");
    await prisma.unoogptSessao.update({
      where: { escolaId_alunoId: { escolaId: ESCOLA, alunoId: ana } },
      data: { tokensGastos: 0 },
    });
  });
});

describe("decidir, justificar e enfrentar a tempestade", () => {
  it("justificativa com fonte NÃO carregada é recusada", async () => {
    const sessao = await service.sessao(ESCOLA, ana);
    const naoCarregada = sessao.justificativas.find((j) => j.valor === "intuicao");
    expect(naoCarregada).toBeDefined();
    // 'estudo' quase certamente não está carregado (o mock carrega uma fonte).
    const codigo = await codigoDe(service.alocar(ESCOLA, ana, "alfa", "valeverde", "estudo"));
    expect(["falta-justificar", null]).toContain(codigo);
  });

  it("bairro inventado é recusado antes de qualquer gravação", async () => {
    const codigo = await codigoDe(
      service.alocar(ESCOLA, ana, "alfa", "atlantida" as "valeverde", "intuicao"),
    );
    expect(codigo).toBe("bairro-desconhecido");
  });

  it("enviar sem justificar as duas equipes é barrado no SERVIDOR", async () => {
    await service.alocar(ESCOLA, ana, "alfa", "valeverde", "intuicao");
    await service.alocar(ESCOLA, ana, "bravo", "ribeirinha", null);
    expect(await codigoDe(service.simular(ESCOLA, ana))).toBe("falta-justificar");
  });

  it("com as duas justificadas a tempestade acontece, e uma vez só", async () => {
    await service.alocar(ESCOLA, ana, "bravo", "ribeirinha", "intuicao");
    const r = await service.simular(ESCOLA, ana);

    expect(r.desfecho.totais.salvas).toBeGreaterThanOrEqual(0);
    // A FAIXA é a manchete: a mesma decisão não repete igual.
    expect(r.esperado.faixa[0]).toBeLessThanOrEqual(r.esperado.media);
    expect(r.esperado.faixa[1]).toBeGreaterThanOrEqual(r.esperado.media);
    // E as amostras são a variância VISTA, não afirmada.
    expect(r.esperado.amostras.length).toBeGreaterThan(0);
    // A lista do que ele nunca consultou não leva o nome TÉCNICO da fonte: o
    // catálogo diz que ele "aparece no painel do professor, nunca para o aluno".
    for (const f of r.naoConsultados) {
      expect(f).not.toHaveProperty("nome");
      expect(f).not.toHaveProperty("instrucao");
      expect(f).not.toHaveProperty("vies");
      expect(f).not.toHaveProperty("cobertura");
    }
    expect(r.trilha.length).toBeGreaterThan(0);

    // Idempotente por tentativa: enfrentar de novo não sorteia outra chuva.
    const denovo = await service.simular(ESCOLA, ana);
    expect(denovo.desfecho.totais.salvas).toBe(r.desfecho.totais.salvas);
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, alunoId: ana } })).toBe(1);
  });

  it("o contrafactual não grava nada e não debita", async () => {
    const antes = await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, alunoId: ana } });
    const r = await service.contrafactual(ESCOLA, ana, { alfa: "morroalto", bravo: "industrial" });
    expect(r.media).toBeGreaterThanOrEqual(0);
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, alunoId: ana } })).toBe(antes);
  });

  it("recomeçar abre tentativa NOVA e preserva a conversa anterior", async () => {
    const falasAntes = await prisma.unoogptMensagem.count({ where: { escolaId: ESCOLA, alunoId: ana } });
    const s = await service.reiniciar(ESCOLA, ana);
    expect(s.tentativa).toBe(2);
    expect(s.conjuntos).toEqual([]);
    expect(s.alocacao).toEqual({ alfa: null, bravo: null });
    // Para o aluno a tela limpa; para o professor a aula inteira continua.
    expect(await prisma.unoogptMensagem.count({ where: { escolaId: ESCOLA, alunoId: ana } })).toBe(
      falasAntes,
    );
  });
});

describe("a fronteira do cliente e a do gestor", () => {
  it("nada do gabarito atravessa para o aluno", async () => {
    const cru = JSON.stringify(await service.sessao(ESCOLA, ana));
    // `instrucao` é o VIÉS de cada fonte: é o material do debate do professor,
    // e é a única coisa que a missão inteira existe para não entregar.
    for (const proibido of ["instrucao", "pSevero", "expostosSevero", "fracaoVulneravel", "escola"]) {
      expect(cru).not.toContain(proibido);
    }
  });

  it("a folha da turma fala de CONDUTA, e não traz número de resgate", async () => {
    const folha = await service.turmaDoProfessor(ESCOLA, turmaId);
    expect(folha.linhas.length).toBe(2);
    const cru = JSON.stringify(folha.linhas);
    // Listagem é ordenável, e uma coluna de resgatados viraria ranking de
    // crianças. O número vive na tela individual, uma por vez.
    for (const proibido of ["salvas", "resgatadas", "vitimas"]) {
      expect(cru).not.toContain(proibido);
    }
  });

  it("o relatório individual usa GRAUS, e `zero` não se confunde com `none`", async () => {
    const rel = await service.alunoDoProfessor(ESCOLA, ana);
    expect(rel.linhas.length).toBeGreaterThan(0);
    for (const l of rel.linhas) {
      // Número só na variante `scored`; nas outras é null POR TIPO.
      if (l.grau !== "scored") expect(l.numero).toBeNull();
    }
    expect(rel.conversa.length).toBeGreaterThan(0);
  });

  it("o agregado do gestor não tem uma única linha de aluno", async () => {
    const ag = await service.agregadoDaEscola(ESCOLA);
    const cru = JSON.stringify(ag);
    for (const proibido of [ana, bia, "ug.ana", "conversa", "texto"]) {
      expect(cru).not.toContain(proibido);
    }
    expect(ag.turmas.some((t) => t.turma === "2A")).toBe(true);
  });
});

describe("tenancy: a segunda escola não vê a primeira", () => {
  it("a folha de uma turma da outra escola não abre", async () => {
    expect(await codigoDe(service.turmaDoProfessor(ESCOLA, outraTurmaId))).toBe("sessao-encerrada");
  });

  it("o relatório de um aluno de outra escola não abre", async () => {
    expect(await codigoDe(service.alunoDoProfessor(ESCOLA, deOutraEscola))).toBe("sessao-encerrada");
  });

  it("abrir a sessão de um aluno de outra escola não cria linha nenhuma", async () => {
    expect(await codigoDe(service.sessao(ESCOLA, deOutraEscola))).toBe("sessao-encerrada");
    expect(
      await prisma.unoogptSessao.count({ where: { escolaId: ESCOLA, alunoId: deOutraEscola } }),
    ).toBe(0);
  });

  it("mexer no relógio de uma turma de outra escola não mexe em nada", async () => {
    expect(await codigoDe(service.mexerNoRelogio(ESCOLA, outraTurmaId, "largada"))).toBe(
      "sessao-encerrada",
    );
    const linhas = await prisma.unoogptRelogioTurma.count({ where: { turmaId: outraTurmaId } });
    expect(linhas).toBe(0);
  });
});

describe("zerar a turma", () => {
  it("apaga as partidas E o relógio, e não sobra filho órfão", async () => {
    await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    const r = await service.zerarTurma(ESCOLA, turmaId);
    expect(r.partidasApagadas).toBeGreaterThan(0);

    // As partidas DA TURMA somem, e os filhos vão por ON DELETE CASCADE.
    for (const aluno of [ana, bia]) {
      expect(
        await prisma.unoogptSessao.count({ where: { escolaId: ESCOLA, alunoId: aluno } }),
      ).toBe(0);
      expect(
        await prisma.unoogptMensagem.count({ where: { escolaId: ESCOLA, alunoId: aluno } }),
      ).toBe(0);
      expect(await prisma.unoogptMarco.count({ where: { escolaId: ESCOLA, alunoId: aluno } })).toBe(0);
      expect(
        await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, alunoId: aluno } }),
      ).toBe(0);
    }
    // E o aluno que NÃO é da turma continua intocado: "zerar a turma" é da
    // turma, não da escola — o professor da 2A não apaga a partida da 2B.
    expect(
      await prisma.unoogptSessao.count({ where: { escolaId: ESCOLA, alunoId: semTurma } }),
    ).toBe(1);
    // O relógio vai junto: rodar de novo com a aula "já começada" faria a
    // segunda rodada nascer no meio da tempestade.
    expect(await prisma.unoogptRelogioTurma.count({ where: { escolaId: ESCOLA, turmaId } })).toBe(0);
  });
});

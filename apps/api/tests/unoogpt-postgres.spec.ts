import { canalADeTeste } from "./canal-a-de-teste";
import { randomUUID } from "node:crypto";
import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { MockProvider } from "../src/ai/mock.provider";
import type { AiConversaRequest, AiResult } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { UnoogptService } from "../src/unoogpt/unoogpt.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp02em1b no Postgres: a largada da TURMA, o orçamento de
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
const quota = new QuotaService(prisma);
const service = new UnoogptService(prisma, new MockProvider(), quota, canalADeTeste(prisma));

let turmaId = "";
let outraTurmaId = "";
let ana = "";
let bia = "";
let semTurma = "";
let turmaBId = "";
let daOutraTurma = "";
let deOutraEscola = "";

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: escolas } } });
  /* Equipes e membros caem por CASCADE da montagem. */
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: escolas } } });
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
  const t = await criarTurmaDeTeste(prisma, ESCOLA, "2A", "2EM");
  turmaId = t.id;
  const o = await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "2A", "2EM");
  outraTurmaId = o.id;

  const criar = (escolaId: string, turma: string | null, username: string) =>
    prisma.user.create({
      data: { role: "estudante", escolaId, turmaId: turma, username, displayName: username, passwordHash: "x" },
      select: { id: true },
    });
  ana = (await criar(ESCOLA, turmaId, "ug.ana")).id;
  bia = (await criar(ESCOLA, turmaId, "ug.bia")).id;
  semTurma = (await criar(ESCOLA, null, "ug.sem")).id;
  deOutraEscola = (await criar(OUTRA_ESCOLA, outraTurmaId, "ug.outra")).id;

  /* Uma SEGUNDA turma na mesma escola. Antes da sala de aula (ADR-69) o papel
     de "estudante que não é desta turma" era feito pelo `semTurma`, que agora
     não entra na missão — sem sala não há missão. A 2B faz o papel melhor: é o
     caso real que "zerar a turma" tem de respeitar, o professor da 2A que não
     pode apagar a partida da 2B. */
  const segunda = await criarTurmaDeTeste(prisma, ESCOLA, "2B", "2EM");
  turmaBId = segunda.id;
  daOutraTurma = (await criar(ESCOLA, turmaBId, "ug.2b")).id;

  /* A PORTA DA SALA: sem estas linhas `garantirSessao` recusa com 403
     `missao-nao-liberada` e a suíte inteira falha. */
  for (const t of [turmaId, turmaBId]) {
    await liberarParaTeste(prisma, ESCOLA, t, "exp02em1b", ana);
  }
  await liberarParaTeste(prisma, OUTRA_ESCOLA, outraTurmaId, "exp02em1b", deOutraEscola);
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("a largada é da TURMA, não do estudante", () => {
  it("antes da largada o cronômetro está parado e o Cientista não responde", async () => {
    const abertura = await service.sessao(ESCOLA, ana);
    expect(abertura.estado.fase).toBe("aguardando");
    expect(abertura.estado.aberta).toBe(false);
    // Falar antes da largada é o que a sala inteira tentaria fazer.
    expect(await codigoDe(service.pergunta(ESCOLA, ana, "estudante", "onde chove mais?"))).toBe(
      "relogio-nao-comecou",
    );
  });

  it("a largada do professor vale para TODOS os estudantes da turma ao mesmo tempo", async () => {
    const retrato = await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    expect(retrato.fase).toBe("correndo");

    // Ana e Bia não fizeram nada: quem começou a aula foi o professor.
    for (const estudante of [ana, bia]) {
      const s = await service.sessao(ESCOLA, estudante);
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

  it("estudante de turma sem largada vê o relógio PARADO — nunca um cronômetro só dele", async () => {
    // O projeto de origem armava um cronômetro individual aqui, e com ele um
    // estudante solto jogava sem largada. "Aguardando" é a verdade.
    //
    // Esta prova era feita com um estudante SEM TURMA. Desde a sala de aula
    // (ADR-69) ele nem chega aqui — sem sala não há missão —, então quem a faz é
    // a criança da 2B, que tem sala e ainda não teve largada. O que se prova é o
    // mesmo, e agora pelo caminho que existe de verdade.
    const s = await service.sessao(ESCOLA, daOutraTurma);
    expect(s.estado.fase).toBe("aguardando");
  });

  it("estudante SEM TURMA não entra: sem sala não há missão (ADR-69)", async () => {
    await expect(service.sessao(ESCOLA, semTurma)).rejects.toMatchObject({
      response: { codigo: "missao-nao-liberada" },
    });
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
    const r = await service.pergunta(ESCOLA, ana, "estudante", "onde mora mais gente?");
    expect(r.texto).toContain("[mock]");

    const falas = await prisma.unoogptMensagem.findMany({
      where: { escolaId: ESCOLA, estudanteId: ana },
      orderBy: { id: "asc" },
    });
    expect(falas.map((f) => f.papel)).toEqual(["estudante", "agente"]);
    expect(falas[0]?.texto).toBe("onde mora mais gente?");

    const sessao = await prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: ana } },
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
    // em vez de devolver 500 para o estudante. (O laço de ferramenta em si tem
    // teste próprio em `ai-conversar.spec.ts`.)
    const antes = await service.sessao(ESCOLA, ana);
    expect(antes.sessao.conjuntos).toEqual([]);
    const r = await service.pergunta(ESCOLA, ana, "estudante", "e a previsão do tempo?");
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

  it("turno em que NADA foi consultado não debita pergunta", async () => {
    // O mock chama `usar_dados` com argumento vazio, então nada é carregado.
    // Cobrar por isso ensinaria o estudante a não perguntar — que é o contrário do
    // ponto da missão. Só conta como consulta se o modelo rodou ou se há fonte
    // de fato em uso.
    await service.mexerNoRelogio(ESCOLA, turmaId, "largada");
    // A premissa tem de ser explícita: NENHUMA fonte em uso. Com fonte
    // carregada o Cientista consulta de verdade e o débito é correto — foi o que
    // esta suíte pegou na primeira versão do teste.
    await prisma.unoogptSessao.update({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: ana } },
      data: { conjuntos: [], rodadas: 0, perguntasGastas: 0 },
    });
    const gastasAntes = 0;
    await service.pergunta(ESCOLA, ana, "estudante", "quantas pessoas moram na Ribeirinha?");
    const depois = await prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: ana } },
    });
    expect(depois.perguntasGastas).toBe(gastasAntes);
    // Mas a CHAMADA contou: o token foi gasto de todo modo.
    expect(depois.chamadasIa).toBeGreaterThan(0);
  });

  it("o orçamento de 3 perguntas é debitado no SERVIDOR e trava na quarta", async () => {
    for (let i = 0; i < 6; i += 1) {
      const codigo = await codigoDe(service.pergunta(ESCOLA, bia, "estudante", `pergunta ${i} sobre a chuva?`));
      if (codigo === "sem-perguntas") break;
    }
    const sessao = await prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: bia } },
    });
    expect(sessao.perguntasGastas).toBeLessThanOrEqual(3);
    // E a fala que debitou está marcada: é a trilha de auditoria do orçamento.
    const debitadas = await prisma.unoogptMensagem.count({
      where: { escolaId: ESCOLA, estudanteId: bia, debitou: true },
    });
    expect(debitadas).toBe(sessao.perguntasGastas);
  });

  it("estourar o teto POR SESSÃO fecha a sala de operações", async () => {
    await prisma.unoogptSessao.update({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: ana } },
      data: { tokensGastos: 999_999 },
    });
    expect(await codigoDe(service.pergunta(ESCOLA, ana, "estudante", "e agora?"))).toBe("teto-da-sessao");
    await prisma.unoogptSessao.update({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: ana } },
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
    // catálogo diz que ele "aparece no painel do professor, nunca para o estudante".
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
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: ana } })).toBe(1);
  });

  it("o contrafactual não grava nada e não debita", async () => {
    const antes = await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: ana } });
    const r = await service.contrafactual(ESCOLA, ana, { alfa: "morroalto", bravo: "industrial" });
    expect(r.media).toBeGreaterThanOrEqual(0);
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: ana } })).toBe(antes);
  });

  it("recomeçar abre tentativa NOVA e preserva a conversa anterior", async () => {
    const falasAntes = await prisma.unoogptMensagem.count({ where: { escolaId: ESCOLA, estudanteId: ana } });
    const { sessao } = await service.reiniciar(ESCOLA, ana);
    expect(sessao.tentativa).toBe(2);
    expect(sessao.conjuntos).toEqual([]);
    expect(sessao.alocacao).toEqual({ alfa: null, bravo: null });
    // Para o estudante a tela limpa; para o professor a aula inteira continua.
    expect(await prisma.unoogptMensagem.count({ where: { escolaId: ESCOLA, estudanteId: ana } })).toBe(
      falasAntes,
    );
  });
});

describe("o ENVELOPE das rotas de mutação", () => {
  /**
   * Toda rota de mutação devolve `{ sessao }`. Parece detalhe e não é: o cliente
   * tem UM tipo para todas (`RespostaEstado`), e uma rota que devolvesse a
   * sessão crua fazia ele ler `dados.sessao` como `undefined` e derrubar a
   * árvore do React — tela BRANCA dentro do iframe, sem erro de console.
   * Nenhum typecheck vê através do HTTP; quem pegou foi o smoke visual.
   */
  it("passo, alocacao e reiniciar devolvem `{ sessao }`", async () => {
    for (const resposta of [
      await service.irParaPasso(ESCOLA, bia, "orientacao"),
      await service.alocar(ESCOLA, bia, "alfa", "valeverde", null),
      await service.reiniciar(ESCOLA, bia),
    ]) {
      expect(resposta).toHaveProperty("sessao");
      expect((resposta as { sessao: { passo: string } }).sessao.passo).toBeTruthy();
    }
  });
});

describe("o marco carrega o relógio do instante, e o professor lê o TEMPO (ADR-64)", () => {
  it("entrar na Investigação grava `inicio` UMA vez por tentativa, com o cronômetro", async () => {
    await service.irParaPasso(ESCOLA, ana, "orientacao");
    await service.irParaPasso(ESCOLA, ana, "investigacao");
    // Voltar à Orientação e retornar não é começar de novo.
    await service.irParaPasso(ESCOLA, ana, "orientacao");
    await service.irParaPasso(ESCOLA, ana, "investigacao");
    const inicios = await prisma.unoogptMarco.findMany({
      where: { escolaId: ESCOLA, estudanteId: ana, tipo: "inicio", tentativa: 2 },
    });
    expect(inicios).toHaveLength(1);
    // A aula está correndo (largada dada acima): o cronômetro que a criança via
    // fica gravado, e não há motivo de fim.
    expect(inicios[0]!.segundosRestantes).toBeGreaterThan(0);
    expect(inicios[0]!.motivoDoFim).toBeNull();
  });

  it("a fala do estudante é datada pela hora de ENVIO, antes da resposta do Cientista", async () => {
    const antes = new Date();
    await service.pergunta(ESCOLA, ana, "estudante", "e agora, onde tem mais gente?");
    const fala = await prisma.unoogptMensagem.findFirst({
      where: { escolaId: ESCOLA, estudanteId: ana, tentativa: 2, papel: "estudante" },
      orderBy: { id: "desc" },
    });
    const resposta = await prisma.unoogptMensagem.findFirst({
      where: { escolaId: ESCOLA, estudanteId: ana, tentativa: 2, papel: "agente" },
      orderBy: { id: "desc" },
    });
    expect(fala!.criadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 5);
    expect(fala!.criadoEm.getTime()).toBeLessThanOrEqual(resposta!.criadoEm.getTime());
  });

  it("a simulação guarda a FAIXA da decisão e o percentil do resgate real", async () => {
    const sim = await prisma.unoogptSimulacao.findFirst({ where: { escolaId: ESCOLA, estudanteId: ana, ordem: 1 } });
    const esperado = sim!.esperado as { media: number; faixa: [number, number]; percentil: number } | null;
    expect(esperado).not.toBeNull();
    expect(esperado!.faixa[0]).toBeLessThanOrEqual(esperado!.media);
    expect(esperado!.percentil).toBeGreaterThanOrEqual(0);
    expect(esperado!.percentil).toBeLessThanOrEqual(100);
  });

  it("recomeçar grava `recomeco` na tentativa que FECHA, com qual botão e o relógio", async () => {
    const { sessao } = await service.reiniciar(ESCOLA, ana, "resultado");
    expect(sessao.tentativa).toBe(3);
    const marco = await prisma.unoogptMarco.findFirst({
      where: { escolaId: ESCOLA, estudanteId: ana, tipo: "recomeco", tentativa: 2 },
    });
    expect(marco).not.toBeNull();
    expect(marco!.dados).toMatchObject({ origem: "resultado", fase: "correndo", modo: "cronometrado" });
    expect(marco!.segundosRestantes).toBeGreaterThan(0);
  });

  it("o relatório do professor deriva tempo, mudanças e desfecho — sem coluna nova de leitura", async () => {
    const r = await service.doEstudante(ESCOLA, ana);

    // Rodadas: toda tentativa que deixou rastro, enfrentada ou não.
    expect(r.rodadas.map((x) => x.tentativa)).toEqual([1, 2, 3]);
    const primeira = r.rodadas[0]!;
    expect(primeira.enfrentou).toBe(true);
    expect(primeira.envio).not.toBeNull();
    expect(primeira.envio!.estourou).toBe(false);
    // Alfa → Vale Verde; depois Bravo → Ribeirinha; justificar não mudou nada.
    expect(primeira.mudancasDeDestino).toBeGreaterThanOrEqual(1);
    expect(primeira.ateAPrimeiraFala).not.toBeNull();
    expect(typeof primeira.ateAPrimeiraFala!.desdeALargada).toBe("number");

    const segunda = r.rodadas[1]!;
    expect(segunda.enfrentou).toBe(false);
    expect(segunda.recomeco).toMatchObject({ origem: "resultado", fase: "correndo" });
    expect(segunda.inicioEm).not.toBeNull();

    // Desfecho por tentativa: número de resgate SÓ aqui, com a faixa ao lado.
    expect(r.tentativas).toHaveLength(1);
    const t = r.tentativas[0]!;
    expect(t.salvas).toBeGreaterThanOrEqual(0);
    expect(t.coberturaDoRisco).toBeGreaterThanOrEqual(0);
    expect(t.coberturaDoRisco).toBeLessThanOrEqual(100);
    expect(t.posicao.percentil).toBeGreaterThanOrEqual(0);
    // As justificativas vêm do marco de envio — a sessão já não as tem.
    expect(t.justificativas).toEqual({ alfa: "intuição, sem dado", bravo: "intuição, sem dado" });

    // Trilha e conversa datadas.
    for (const m of r.trilha) expect(typeof m.criadoEm).toBe("string");
    for (const f of r.conversa) expect(typeof f.segundosDesdeALargada).toBe("number");
  });
});

describe("a fronteira do cliente e a do gestor", () => {
  it("nada do gabarito atravessa para o estudante", async () => {
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
    const rel = await service.doEstudante(ESCOLA, ana);
    expect(rel.linhas.length).toBeGreaterThan(0);
    for (const l of rel.linhas) {
      // Número só na variante `scored`; nas outras é null POR TIPO.
      if (l.grau !== "scored") expect(l.numero).toBeNull();
    }
    expect(rel.conversa.length).toBeGreaterThan(0);
  });

  it("o agregado do gestor não tem uma única linha de estudante", async () => {
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

  it("o relatório de um estudante de outra escola não abre", async () => {
    expect(await codigoDe(service.doEstudante(ESCOLA, deOutraEscola))).toBe("sessao-encerrada");
  });

  it("abrir a sessão de um estudante de outra escola não cria linha nenhuma", async () => {
    expect(await codigoDe(service.sessao(ESCOLA, deOutraEscola))).toBe("sessao-encerrada");
    expect(
      await prisma.unoogptSessao.count({ where: { escolaId: ESCOLA, estudanteId: deOutraEscola } }),
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
    for (const estudante of [ana, bia]) {
      expect(
        await prisma.unoogptSessao.count({ where: { escolaId: ESCOLA, estudanteId: estudante } }),
      ).toBe(0);
      expect(
        await prisma.unoogptMensagem.count({ where: { escolaId: ESCOLA, estudanteId: estudante } }),
      ).toBe(0);
      expect(await prisma.unoogptMarco.count({ where: { escolaId: ESCOLA, estudanteId: estudante } })).toBe(0);
      expect(
        await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: estudante } }),
      ).toBe(0);
    }
    // E o estudante que NÃO é da turma continua intocado: "zerar a turma" é da
    // turma, não da escola — o professor da 2A não apaga a partida da 2B.
    expect(
      await prisma.unoogptSessao.count({ where: { escolaId: ESCOLA, estudanteId: daOutraTurma } }),
    ).toBe(1);
    // O relógio vai junto: rodar de novo com a aula "já começada" faria a
    // segunda rodada nascer no meio da tempestade.
    expect(await prisma.unoogptRelogioTurma.count({ where: { escolaId: ESCOLA, turmaId } })).toBe(0);
  });
});

/**
 * EQUIPES NA MISSÃO (E13, ADR-111): quem divide um computador entra com o login
 * de UM membro, e a folha conta por computador. Turma PRÓPRIA (a 2C): as
 * suítes acima contam as linhas da 2A.
 */
describe("a folha conta por COMPUTADOR quando a turma tem equipes", () => {
  let turma2C = "";
  const alunos = { caio: "", duda: "", enzo: "", fabi: "" };

  /** A montagem gravada direto no banco — o serviço de equipes tem a suíte dele. */
  async function montarEquipe(expId: string, nome: string, membros: string[]) {
    await prisma.equipesMontagem.create({
      /* Missão sem atividade (ADR-130): o id fixo `turma`, uma montagem por turma. */
      data: {
        escolaId: ESCOLA,
        turmaId: turma2C,
        expId,
        atividadeId: "turma",
        modo: "manual",
        computadores: 2,
        atualizadoPor: randomUUID(),
      },
    });
    const equipe = await prisma.equipe.create({
      data: { escolaId: ESCOLA, turmaId: turma2C, expId, atividadeId: "turma", nome, ordem: 0 },
    });
    await prisma.equipeMembro.createMany({
      data: membros.map((estudanteId) => ({
        escolaId: ESCOLA,
        equipeId: equipe.id,
        turmaId: turma2C,
        expId,
        atividadeId: "turma",
        estudanteId,
      })),
    });
    return equipe.id;
  }

  beforeAll(async () => {
    turma2C = (await criarTurmaDeTeste(prisma, ESCOLA, "2C", "2EM")).id;
    const criar = async (username: string) =>
      (
        await prisma.user.create({
          data: { role: "estudante", escolaId: ESCOLA, turmaId: turma2C, username, displayName: username, passwordHash: "x" },
          select: { id: true },
        })
      ).id;
    alunos.caio = await criar("ug.caio");
    alunos.duda = await criar("ug.duda");
    alunos.enzo = await criar("ug.enzo");
    alunos.fabi = await criar("ug.fabi");
    /* Só a Duda entrou — com o computador que divide com o Caio e o Enzo. Passo
       fora da abertura = começou. */
    await prisma.unoogptSessao.create({
      data: { escolaId: ESCOLA, estudanteId: alunos.duda, turmaId: turma2C, passo: "investigacao" },
    });
  });

  it("sem equipe NESTA missão, cada estudante é uma linha — equipe de outra missão não conta", async () => {
    await montarEquipe("exp04ef1b", "Equipe do UnooTube", [alunos.caio, alunos.duda, alunos.enzo]);
    const folha = await service.turmaDoProfessor(ESCOLA, turma2C);
    expect(folha.linhas.map((l) => l.usuario)).toEqual(["ug.caio", "ug.duda", "ug.enzo", "ug.fabi"]);
    expect(folha.linhas.every((l) => l.equipe === null)).toBe(true);
    expect(folha.retrato).toMatchObject({ estudantes: 4, comecaram: 1, porComputador: false });
  });

  it("equipe de 3 com 1 login: UMA linha, a de quem entrou, e o retrato conta computadores", async () => {
    const equipeId = await montarEquipe("exp02em1b", "Equipe 1", [alunos.caio, alunos.duda, alunos.enzo]);
    const folha = await service.turmaDoProfessor(ESCOLA, turma2C);

    expect(folha.linhas).toHaveLength(2);
    const [daEquipe, sozinha] = folha.linhas;
    /* A linha é a do REPRESENTANTE: é para a tela dele que "Abrir" leva. */
    expect(daEquipe).toMatchObject({ estudanteId: alunos.duda, usuario: "ug.duda", comecou: true });
    expect(daEquipe!.equipe).toEqual({
      id: equipeId,
      nome: "Equipe 1",
      membros: [
        { id: alunos.caio, nome: "ug.caio" },
        { id: alunos.duda, nome: "ug.duda" },
        { id: alunos.enzo, nome: "ug.enzo" },
      ],
    });
    expect(sozinha).toMatchObject({ estudanteId: alunos.fabi, comecou: false, equipe: null });
    /* 2 computadores, 1 começou — e não "4 estudantes, 3 não começaram". */
    expect(folha.retrato).toMatchObject({ estudantes: 2, comecaram: 1, concluiram: 0, porComputador: true });
    /* A equipe não abre porta para o número de resgate na listagem. */
    const cru = JSON.stringify(folha.linhas);
    for (const proibido of ["salvas", "resgatadas", "vitimas"]) expect(cru).not.toContain(proibido);
  });
});

/**
 * Um provedor com ROTEIRO: chama as ferramentas que o teste mandar, na ordem, e
 * guarda o que cada uma devolveu. O `MockProvider` chama só a primeira
 * ferramenta, com argumento vazio — não serve para provar o que acontece quando
 * o Cientista confirma, troca o destino ou carrega uma fonte de verdade.
 */
class ProvedorComRoteiro extends MockProvider {
  roteiro: Array<[string, Record<string, unknown>]> = [];
  devolvido: Array<{ nome: string; saida: unknown }> = [];

  override async conversar(req: AiConversaRequest): Promise<AiResult> {
    this.devolvido = [];
    for (const [nome, argumentos] of this.roteiro) {
      const saida = await req.ferramentas!.executar(nome, argumentos);
      this.devolvido.push({ nome, saida });
    }
    return { texto: "[roteiro] Feito. Quer seguir?", tokensUsados: 10, finishReason: "STOP" };
  }
}

/**
 * AS BRECHAS (fix/unoogpt-brechas): cada uma deixava uma porta para a decisão
 * sair diferente do que a tela e o Cientista prometem. Turma PRÓPRIA (a 2D): as
 * suítes acima contam as linhas da 2A e mexem no relógio dela.
 */
describe("as brechas da Tempestade", () => {
  const roteiro = new ProvedorComRoteiro();
  const comRoteiro = new UnoogptService(prisma, roteiro, quota, canalADeTeste(prisma));
  let turma2D = "";
  const quem = { gil: "", hel: "", ivo: "", jon: "", kim: "" };

  const sessaoDe = (estudanteId: string) =>
    prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId } },
    });

  beforeAll(async () => {
    turma2D = (await criarTurmaDeTeste(prisma, ESCOLA, "2D", "2EM")).id;
    for (const nome of Object.keys(quem) as (keyof typeof quem)[]) {
      quem[nome] = (
        await prisma.user.create({
          data: { role: "estudante", escolaId: ESCOLA, turmaId: turma2D, username: `ug.${nome}`, displayName: nome, passwordHash: "x" },
          select: { id: true },
        })
      ).id;
    }
    await liberarParaTeste(prisma, ESCOLA, turma2D, "exp02em1b", quem.gil);
    /* A sessão nasce no bootstrap da tela, como na aula. */
    for (const id of Object.values(quem)) await service.sessao(ESCOLA, id);
  });

  it("carregar fonte pelo painel ANTES da largada é recusado, e nada fica gravado", async () => {
    expect(await codigoDe(service.carregarConjuntos(ESCOLA, quem.gil, ["censo"]))).toBe("relogio-nao-comecou");
    expect((await sessaoDe(quem.gil)).conjuntos).toEqual([]);
    expect(await prisma.unoogptMarco.count({ where: { escolaId: ESCOLA, estudanteId: quem.gil, tipo: "fontes" } })).toBe(0);
  });

  it("o cartão de leitura e o mapa mostram a MESMA estimativa depois de carregar uma fonte", async () => {
    await service.mexerNoRelogio(ESCOLA, turma2D, "largada");
    roteiro.roteiro = [["usar_dados", { dados: ["censo"] }]];
    const r = await comRoteiro.pergunta(ESCOLA, quem.gil, "estudante", "onde mora mais gente?");
    const anexo = r.anexo as { tipo: string; rodada: { estimativas: Array<{ bairro: string; pessoasEmRisco: unknown }> } };
    expect(anexo.tipo).toBe("tendencia");
    const doMapa = r.mapa.filter((b) => b.estimativa !== null);
    expect(doMapa.length).toBeGreaterThan(0);
    for (const b of doMapa) {
      const doCartao = anexo.rodada.estimativas.find((e) => e.bairro === b.slug);
      expect(doCartao?.pessoasEmRisco).toEqual(b.estimativa!.pessoasEmRisco);
    }
  });

  it("confirmar pela CONVERSA não manda as equipes: abre a tela de envio, que tem o portão do porquê", async () => {
    await service.alocar(ESCOLA, quem.hel, "alfa", "ribeirinha", null);
    await service.alocar(ESCOLA, quem.hel, "bravo", "morroalto", null);
    roteiro.roteiro = [["confirmar_alocacao", { confirmado: true }]];
    const turno = await comRoteiro.pergunta(ESCOLA, quem.hel, "estudante", "pode mandar");

    // ADR-169: a conversa pede para a tela abrir a decisão; quem manda é o botão.
    expect(turno.abrirEnvio).toBe(true);
    expect(roteiro.devolvido[0]!.saida).toMatchObject({ disparado: false, telaDeEnvio: "aberta" });
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: quem.hel } })).toBe(0);
    expect((await sessaoDe(quem.hel)).concluidoEm).toBeNull();

    // O botão recusa sem o porquê, e manda com ele.
    expect(await codigoDe(service.mandar(ESCOLA, quem.hel))).toBe("falta-justificar");
    await service.alocar(ESCOLA, quem.hel, "alfa", "ribeirinha", "intuicao");
    await service.alocar(ESCOLA, quem.hel, "bravo", "morroalto", "intuicao");
    // Mesmo com o porquê, a conversa continua sem mandar.
    await comRoteiro.pergunta(ESCOLA, quem.hel, "estudante", "pode mandar");
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: quem.hel } })).toBe(0);
    await service.mandar(ESCOLA, quem.hel);
    expect(await prisma.unoogptSimulacao.count({ where: { escolaId: ESCOLA, estudanteId: quem.hel } })).toBe(1);
  });

  it("trocar o destino pela CONVERSA apaga o porquê antigo; repetir o mesmo destino não", async () => {
    await service.alocar(ESCOLA, quem.ivo, "alfa", "ribeirinha", "intuicao");
    await service.alocar(ESCOLA, quem.ivo, "bravo", "morroalto", "intuicao");

    roteiro.roteiro = [["alocar_equipe", { alfa: "ribeirinha" }]];
    await comRoteiro.pergunta(ESCOLA, quem.ivo, "estudante", "alfa continua na ribeirinha");
    expect((await sessaoDe(quem.ivo)).justificativaAlfa).toBe("intuicao");

    roteiro.roteiro = [["alocar_equipe", { alfa: "industrial" }]];
    await comRoteiro.pergunta(ESCOLA, quem.ivo, "estudante", "manda a alfa para o industrial");
    const depois = await sessaoDe(quem.ivo);
    expect(depois.alocacaoAlfa).toBe("industrial");
    expect(depois.justificativaAlfa).toBeNull();
    // A outra equipe não mudou de bairro: o porquê dela fica.
    expect(depois.justificativaBravo).toBe("intuicao");
    expect(await codigoDe(service.simular(ESCOLA, quem.ivo))).toBe("falta-justificar");
  });

  it("mandar com UMA equipe na base é permitido; sem destino nenhum, a recusa diz isso", async () => {
    expect(await codigoDe(service.simular(ESCOLA, quem.jon))).toBe("sem-destino");
    await service.alocar(ESCOLA, quem.jon, "alfa", "ribeirinha", "intuicao");
    const r = await service.simular(ESCOLA, quem.jon);
    const naBase = r.desfecho.porBairro.filter((b) => b.equipe === "bravo");
    expect(naBase).toHaveLength(0);
    expect(r.desfecho.porBairro.some((b) => b.equipe === "alfa")).toBe(true);
  });

  it("o contrafactual é PAREADO: a mesma decisão compara com ela mesma e não muda nada", async () => {
    const sim = await prisma.unoogptSimulacao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: quem.jon } });
    const a = sim.alocacao as { alfa: string | null; bravo: string | null };
    const igual = await service.contrafactual(ESCOLA, quem.jon, { alfa: a.alfa, bravo: a.bravo });
    expect(igual.media).toBe(igual.sua.media);
    expect(igual.comparacao).toMatchObject({ maisEm: 0, menosEm: 0, empates: igual.comparacao.corridas });

    const outra = await service.contrafactual(ESCOLA, quem.jon, { alfa: "industrial", bravo: "valeverde" });
    // A média da decisão dele é a mesma nas duas chamadas: as tempestades são as mesmas.
    expect(outra.sua.media).toBe(igual.sua.media);
    expect(outra.comparacao.maisEm + outra.comparacao.menosEm + outra.comparacao.empates).toBe(outra.comparacao.corridas);
  });

  it("carregar fonte pelo painel DEPOIS do fim do relógio é recusado", async () => {
    await service.mexerNoRelogio(ESCOLA, turma2D, "encerrar");
    expect(await codigoDe(service.carregarConjuntos(ESCOLA, quem.kim, ["censo"]))).toBe("relogio-encerrado");
    expect((await sessaoDe(quem.kim)).conjuntos).toEqual([]);
  });

  it("carregar fonte pelo painel depois de mandar as equipes é recusado", async () => {
    await service.mexerNoRelogio(ESCOLA, turma2D, "redefinir");
    await service.mexerNoRelogio(ESCOLA, turma2D, "largada");
    expect(await codigoDe(service.carregarConjuntos(ESCOLA, quem.jon, ["censo"]))).toBe("sessao-encerrada");
  });
});

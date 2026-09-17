import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider, AiRequest, AiResult } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import { BemEstarService } from "../src/bemestar/bemestar.service";
import { CHECKINS_POR_CICLO, ITENS, MENSAGEM_DE_APOIO } from "../src/bemestar/catalogo";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integração da exp-91-bem-estar no Postgres: ciclo em 7 check-ins de 3 itens
 * (relógio injetado anda os dias), um check-in por dia, correção server-side
 * ao fechar, sinal de apoio, fallback dos textos quando a IA falha ou fura o
 * guardrail, posse entre professores, apagar tudo. UMA ESCOLA POR SUÍTE.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-bemestar";

class ProviderFake implements AiProvider {
  /** Texto que `generate` devolve; `null` = lança (provider fora do ar). */
  proximo: string | null = JSON.stringify({
    abertura: "Terça-feira de agosto. Um minuto para você antes da sala.",
    pergunta: "Se quiser, o que mais pesou na sua semana até aqui?",
    mensagem: "Li o que você escreveu sobre a turma cheia. Obrigado por deixar isso registrado aqui.",
  });
  tokens = 90;
  chamadas: AiRequest[] = [];

  async generate(req: AiRequest): Promise<AiResult> {
    this.chamadas.push(req);
    if (this.proximo === null) throw new Error("vertex fora");
    return { texto: this.proximo, tokensUsados: this.tokens, finishReason: "STOP" };
  }
  generateJson<T>(_req: AiJsonRequest<T>): Promise<T> {
    throw new Error("não usado");
  }
  generateImage(): Promise<Buffer> {
    throw new Error("não usado");
  }
  generateSpeech(): Promise<Buffer> {
    throw new Error("não usado");
  }
  conversar(): Promise<AiResult> {
    throw new Error("não usado");
  }
}

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const provider = new ProviderFake();
// O teto vem de `ia_quotas` (ADR-105), semeada pela migration — nada a configurar.
const quota = new QuotaService(prisma);
const service = new BemEstarService(prisma, provider, quota);

/** Relógio controlável: começa numa terça, 10h de Brasília. */
let agora = new Date("2026-08-25T13:00:00Z");
service.definirRelogio(() => agora);
const avancarDias = (n: number) => {
  agora = new Date(agora.getTime() + n * 86_400_000);
};

let profA = "";
let profB = "";

async function limpar() {
  await prisma.bemEstarCheckin.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.bemEstarCiclo.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

async function statusDe(promessa: Promise<unknown>): Promise<number | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
}

type Hoje = Awaited<ReturnType<BemEstarService["hoje"]>>;

/** Responde ao check-in de hoje com o mesmo valor em todos os itens. */
async function responderHoje(professorId: string, valor: 0 | 1 | 2 | 3, textoLivre?: string) {
  const { checkin } = await service.hoje(ESCOLA, professorId, "professor");
  return service.responder(ESCOLA, professorId, "professor", checkin.id, {
    respostas: checkin.itens.map((i) => ({ item: i.numero, valor })),
    textoLivre,
  });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Bem-estar (teste)" } });
  const criar = (username: string) =>
    prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username, displayName: username, passwordHash: "x" },
      select: { id: true },
    });
  profA = (await criar("bemestar.prof.a")).id;
  profB = (await criar("bemestar.prof.b")).id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

beforeEach(() => {
  provider.chamadas = [];
  provider.proximo = JSON.stringify({
    abertura: "Terça-feira de agosto. Um minuto para você antes da sala.",
    pergunta: "Se quiser, o que mais pesou na sua semana até aqui?",
    mensagem: "Li o que você escreveu sobre a turma cheia. Obrigado por deixar isso registrado aqui.",
  });
});

describe("check-in do dia", () => {
  let primeiro: Hoje;

  test("GET hoje abre o ciclo e cria o pendente com 3 itens (um por subescala) e textos da IA", async () => {
    primeiro = await service.hoje(ESCOLA, profA, "professor");
    expect(primeiro.checkin.status).toBe("pendente");
    expect(primeiro.checkin.numero).toBe(1);
    expect(primeiro.checkin.itens).toHaveLength(3);
    const subescalas = primeiro.checkin.itens.map((i) => ITENS.find((x) => x.numero === i.numero)!.subescala);
    expect(new Set(subescalas).size).toBe(3);
    expect(primeiro.checkin.abertura).toContain("Terça-feira");
    expect(primeiro.checkin.pergunta.endsWith("?")).toBe(true);
    expect(primeiro.ciclo).toMatchObject({ status: "aberto", respondidos: 0, total: CHECKINS_POR_CICLO });
    expect(primeiro.resultado).toBeNull();
    // A IA só viu contexto neutro: nada de nome, escola ou pontuação.
    expect(provider.chamadas).toHaveLength(1);
    expect(provider.chamadas[0]!.user).toMatch(/check-in 1 de 7/);
    expect(provider.chamadas[0]!.user).not.toContain(profA);
    // Quota consumida.
    expect(await quota.usadoHoje(ESCOLA, profA)).toBe(90);
  });

  test("segundo GET no mesmo dia devolve o MESMO pendente sem chamar a IA de novo", async () => {
    const outro = await service.hoje(ESCOLA, profA, "professor");
    expect(outro.checkin.id).toBe(primeiro.checkin.id);
    expect(provider.chamadas).toHaveLength(0);
  });

  test("resumo é leve e não cria nada", async () => {
    expect(await service.resumo(ESCOLA, profA)).toEqual({ hoje: "pendente", respondidos: 0, total: 7, cicloAberto: true });
    expect(await service.resumo(ESCOLA, profB)).toEqual({ hoje: "pendente", respondidos: 0, total: 7, cicloAberto: false });
    expect(await prisma.bemEstarCiclo.count({ where: { escolaId: ESCOLA, professorId: profB } })).toBe(0);
  });

  test("respostas que não casam com os itens do dia → 400; outro professor → 404", async () => {
    // Um item válido do instrumento, mas que NÃO é de hoje.
    const fora = ITENS.find((x) => !primeiro.checkin.itens.some((i) => i.numero === x.numero))!.numero;
    const errado = primeiro.checkin.itens.map((i, k) => ({ item: k === 0 ? fora : i.numero, valor: 0 }));
    expect(await statusDe(service.responder(ESCOLA, profA, "professor", primeiro.checkin.id, { respostas: errado }))).toBe(400);
    expect(
      await statusDe(
        service.responder(ESCOLA, profB, "professor", primeiro.checkin.id, {
          respostas: primeiro.checkin.itens.map((i) => ({ item: i.numero, valor: 0 })),
        }),
      ),
    ).toBe(404);
    expect(await statusDe(service.responder(ESCOLA, profA, "professor", "nao-e-uuid", { respostas: [] }))).toBe(404);
  });

  test("responder com texto → acolhimento da IA; segundo POST no dia → 409; GET devolve o respondido", async () => {
    const r = await responderHoje(profA, 1, "Turma cheia, mas a aula de hoje rendeu.");
    expect(r.checkin.status).toBe("respondido");
    expect(r.sinalDeApoio).toBe(false);
    expect(r.apoio).toBeNull();
    expect(r.acolhimento).toContain("turma cheia");
    expect(r.ciclo.respondidos).toBe(1);
    expect(r.resultado).toBeNull();
    // A IA recebeu o texto como conteúdo delimitado, nunca a pontuação.
    expect(provider.chamadas[0]!.user).toContain('"""');
    expect(provider.chamadas[0]!.user).not.toMatch(/pontua/i);

    expect(await statusDe(service.responder(ESCOLA, profA, "professor", r.checkin.id, { respostas: [] }))).toBe(409);

    const hoje = await service.hoje(ESCOLA, profA, "professor");
    expect(hoje.checkin.id).toBe(r.checkin.id);
    expect(hoje.checkin.status).toBe("respondido");
    expect(hoje.ciclo?.respondidos).toBe(1);
    expect(await service.resumo(ESCOLA, profA)).toMatchObject({ hoje: "respondido", respondidos: 1 });
  });

  test("sem texto livre a IA não é chamada; acolhimento fixo", async () => {
    avancarDias(1);
    const r = await responderHoje(profA, 0);
    expect(r.checkin.numero).toBe(2);
    // Uma chamada só: a abertura do GET. Nenhuma para o acolhimento.
    expect(provider.chamadas).toHaveLength(1);
    expect(r.acolhimento.length).toBeGreaterThan(10);
  });

  test("IA fora do ar → textos fixos (o check-in abre mesmo assim); IA furando o guardrail → fixo", async () => {
    avancarDias(1);
    provider.proximo = null;
    const semIa = await service.hoje(ESCOLA, profA, "professor");
    expect(semIa.checkin.numero).toBe(3);
    expect(semIa.checkin.abertura.length).toBeGreaterThan(10);
    expect(semIa.checkin.pergunta.endsWith("?")).toBe(true);
    const linha = await prisma.bemEstarCheckin.findUnique({ where: { id: semIa.checkin.id } });
    expect(linha?.origemTexto).toBe("fallback");

    provider.proximo = JSON.stringify({ mensagem: "Você deve procurar terapia, isso é sinal de depressão." });
    provider.chamadas = [];
    // A quota do QuotaService é por dia REAL (não pelo relógio injetado): medir o delta.
    const quotaAntes = await quota.usadoHoje(ESCOLA, profA);
    const r = await service.responder(ESCOLA, profA, "professor", semIa.checkin.id, {
      respostas: semIa.checkin.itens.map((i) => ({ item: i.numero, valor: 1 })),
      textoLivre: "cansado",
    });
    // Duas tentativas (a segunda com o motivo), as duas barradas → fixo.
    expect(provider.chamadas).toHaveLength(2);
    expect(provider.chamadas[1]!.user).toMatch(/recusada por/);
    expect(r.acolhimento).not.toMatch(/terapia|depress/i);
    const depois = await prisma.bemEstarCheckin.findUnique({ where: { id: semIa.checkin.id } });
    expect(depois?.origemTexto).toBe("fallback");
    // Os tokens das tentativas barradas contam na quota mesmo assim.
    expect((await quota.usadoHoje(ESCOLA, profA)) - quotaAntes).toBe(180);
  });

  test("sinal de apoio: item sentinela alto → mensagem fixa de apoio, IA não é chamada para o acolhimento", async () => {
    avancarDias(1);
    const { checkin } = await service.hoje(ESCOLA, profA, "professor");
    expect(checkin.numero).toBe(4);
    provider.chamadas = [];
    // Força o item 21 no dia: se ele não estiver entre os 3, usa o texto de risco.
    const temSentinela = checkin.itens.some((i) => i.numero === 21 || i.numero === 17);
    const r = await service.responder(ESCOLA, profA, "professor", checkin.id, {
      respostas: checkin.itens.map((i) => ({ item: i.numero, valor: i.numero === 21 || i.numero === 17 ? 3 : 0 })),
      textoLivre: temSentinela ? "semana difícil" : "não aguento mais",
    });
    expect(r.sinalDeApoio).toBe(true);
    expect(r.apoio).toEqual(MENSAGEM_DE_APOIO);
    expect(r.acolhimento).toBe(MENSAGEM_DE_APOIO.texto);
    expect(provider.chamadas).toHaveLength(0);
    const linha = await prisma.bemEstarCheckin.findUnique({ where: { id: checkin.id } });
    expect(linha?.origemTexto).toBe("seguranca");
    expect(linha?.sinalDeApoio).toBe(true);
  });

  test("7º check-in fecha o ciclo com pontuação server-side; o dia seguinte abre ciclo novo", async () => {
    for (let n = 5; n <= 7; n += 1) {
      avancarDias(1);
      const r = await responderHoje(profA, 0);
      expect(r.checkin.numero).toBe(n);
      if (n < 7) expect(r.resultado).toBeNull();
      else {
        expect(r.ciclo.status).toBe("concluido");
        expect(r.resultado).not.toBeNull();
        expect(r.resultado!.dimensoes.map((d) => d.subescala)).toEqual(["depressao", "ansiedade", "estresse"]);
        // Respostas: dia1=1, dia2=0, dia3=1, dia4=(sentinela 3 ou 0), dias5-7=0.
        for (const d of r.resultado!.dimensoes) {
          expect(d.pontos).toBeGreaterThanOrEqual(0);
          expect(d.pontos % 2).toBe(0);
          expect(typeof d.faixaRotulo).toBe("string");
          expect(typeof d.leitura).toBe("string");
        }
      }
    }
    // Mesmo dia: o GET mostra o respondido + o resultado do ciclo fechado.
    const mesmoDia = await service.hoje(ESCOLA, profA, "professor");
    expect(mesmoDia.checkin.status).toBe("respondido");
    expect(mesmoDia.ciclo?.status).toBe("concluido");
    expect(mesmoDia.resultado).not.toBeNull();

    avancarDias(1);
    const novo = await service.hoje(ESCOLA, profA, "professor");
    expect(novo.checkin.numero).toBe(1);
    expect(novo.ciclo?.status).toBe("aberto");
    expect(await prisma.bemEstarCiclo.count({ where: { escolaId: ESCOLA, professorId: profA } })).toBe(2);
  });

  test("histórico: ciclo concluído com faixas + anotações, só do próprio professor", async () => {
    const h = await service.historico(ESCOLA, profA);
    expect(h.ciclos).toHaveLength(1);
    expect(h.ciclos[0]!.resultado.dimensoes).toHaveLength(3);
    expect(h.anotacoes.length).toBe(7);
    expect(h.anotacoes.some((a) => a.textoLivre === "Turma cheia, mas a aula de hoje rendeu.")).toBe(true);
    expect(h.anotacoes.some((a) => a.sinalDeApoio)).toBe(true);
    const deB = await service.historico(ESCOLA, profB);
    expect(deB.ciclos).toHaveLength(0);
    expect(deB.anotacoes).toHaveLength(0);
  });

  test("ciclo expirado (21 dias) vira `expirado` e nasce outro; o pendente antigo é descartado", async () => {
    avancarDias(22);
    const r = await service.hoje(ESCOLA, profA, "professor");
    expect(r.checkin.numero).toBe(1);
    const status = await prisma.bemEstarCiclo.findMany({
      where: { escolaId: ESCOLA, professorId: profA },
      select: { status: true },
      orderBy: { iniciadoEm: "asc" },
    });
    expect(status.map((c) => c.status)).toEqual(["concluido", "expirado", "aberto"]);
    expect(await prisma.bemEstarCheckin.count({ where: { escolaId: ESCOLA, professorId: profA, status: "pendente" } })).toBe(1);
  });

  test("apagar tudo remove ciclos e check-ins do professor — e só dele", async () => {
    await service.hoje(ESCOLA, profB, "professor");
    const r = await service.apagarTudo(ESCOLA, profA);
    expect(r.ciclos).toBe(3);
    expect(r.checkins).toBe(8);
    expect(await prisma.bemEstarCiclo.count({ where: { escolaId: ESCOLA, professorId: profA } })).toBe(0);
    expect(await prisma.bemEstarCiclo.count({ where: { escolaId: ESCOLA, professorId: profB } })).toBe(1);
  });

  /*
   * Regressão do 500 no boot. Duas chamadas concorrentes a `hoje()` é o que o
   * boot da experiência produz — não é cenário de laboratório: o advisory lock
   * da 1ª transação morre com ela, e a criação só acontece na 2ª, depois da
   * chamada de IA. Nesse intervalo as duas leem "não existe" e as duas decidem
   * criar.
   *
   * O UNIQUE resolve a corrida; o que estava quebrado era a RECUPERAÇÃO. A
   * releitura da perdedora vivia no `catch` da mesma transação, e no Postgres
   * um erro aborta a transação inteira — o `findUnique` seguinte devolvia
   * `25P02 current transaction is aborted`. Ou seja, o caminho escrito para
   * salvar a corrida era o que a transformava em 500, e a suíte
   * `professor/04-bem-estar` morria no boot sem nunca chegar ao formulário.
   */
  test("duas chamadas concorrentes a hoje() devolvem o MESMO check-in, sem 500", async () => {
    const profC = (
      await prisma.user.create({
        data: {
          role: "professor",
          escolaId: ESCOLA,
          username: "bemestar.prof.c",
          displayName: "bemestar.prof.c",
          passwordHash: "x",
        },
        select: { id: true },
      })
    ).id;

    const [um, dois] = await Promise.all([
      service.hoje(ESCOLA, profC, "professor"),
      service.hoje(ESCOLA, profC, "professor"),
    ]);

    // A perdedora releu em vez de estourar, e as duas veem a mesma linha.
    expect(um.checkin.id).toBe(dois.checkin.id);
    expect(
      await prisma.bemEstarCheckin.count({ where: { escolaId: ESCOLA, professorId: profC } }),
    ).toBe(1);
  });
});

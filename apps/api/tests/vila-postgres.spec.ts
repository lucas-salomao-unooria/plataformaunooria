import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VERSAO_MAPEAMENTO } from "../src/vila/mapeamento";
import { VilaService } from "../src/vila/vila.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da app-70 no Postgres: abrir, concluir, idempotência, bolha
 * estável e tenancy. UMA ESCOLA POR SUÍTE (o Jest paraleliza suítes; limpeza
 * compartilhada corromperia a outra).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-vila";
const OUTRA_ESCOLA = "teste-vila-outra";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const service = new VilaService(prisma);

let turma8: string;
let turma3: string;
let estudantes8: string[] = [];
let estudante3: string;
let estudanteDaOutraEscola: string;

function partidaCompleta(): Record<string, unknown> {
  return {
    v: 1,
    bundleVersion: "2026.08.26",
    duracaoSeg: 900,
    duracaoTotalSeg: 1200,
    status: "completa",
    resumo: {
      fogueirasAcesas: 8, pedrasQuebradas: 14, aldeoesAjudados: 3, lampioesAcesos: 4,
      tochasAcesas: 9, dilemasVistos: 3, dilemasResolvidos: 2, distanciaM: 950,
    },
    medidas: {
      cobertura: { celulas: 180, total: 400, pisoObrigatorio: 120 },
      movimento: { movendoSeg: 620, escuroSeg: 140, luzSeg: 480, atalhos: 3, desvioM: 210, raioMax: 28.4 },
      lume: { conversas: 5, perguntasCaminho: 2, lore: 2, ajuda: 1, sugestaoSeguida: true },
      tocha: { aldeao: 3, lampiao: 4, pedra: 1, passarela: 1, retomadas: 1 },
      pedra: { borda: true, destaque: false, nomesApagados: 0, nomesLidos: 2 },
      fumaca: { avistadas: 2, seguidas: 1 },
      brinquedos: 4,
      resgates: [],
    },
    oportunidades: {
      selfDirection: 1, stimulation: 1, hedonism: 1, achievement: 1, power: 1,
      security: 1, conformity: 1, tradition: 1, benevolence: 1, universalism: 1,
    },
    dilemas: [
      { pairId: 0, escolha: "aldeao", emMs: 120_000 },
      { pairId: 1, escolha: "lampiao", emMs: 300_000 },
    ],
    eventos: [{ tipo: "fogueira_acesa", emMs: 40_000, dados: { zona: "praca" } }],
    seguranca: { apareceram: 0, respondidas: 0, ignoradas: 0, cartoes: [] },
  };
}

/** Preenche `seguranca.cartoes` com os cartões comuns, que existem em toda bolha. */
function comCartoesComuns(p: Record<string, unknown>): Record<string, unknown> {
  p.seguranca = {
    apareceram: 2,
    respondidas: 2,
    ignoradas: 0,
    cartoes: [
      { id: "fagulha-infinita", emMs: 25_000, viuOpcoes: true, escolha: 2, decisaoMs: 3400 },
      { id: "lume-dica", emMs: 60_000, viuOpcoes: true, escolha: 1, decisaoMs: 2100 },
    ],
  };
  return p;
}

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.vilaPerfil.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.vilaSessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.vilaBolha.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
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

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Vila (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  const t8 = await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF");
  const t3 = await criarTurmaDeTeste(prisma, ESCOLA, "3A", "3EF");
  turma8 = t8.id;
  turma3 = t3.id;

  const criar = (escolaId: string, turmaId: string | null, username: string, nome: string) =>
    prisma.user.create({
      data: { role: "estudante", escolaId, turmaId, username, displayName: nome, passwordHash: "x" },
      select: { id: true },
    });

  estudantes8 = [];
  for (let i = 1; i <= 9; i += 1) {
    estudantes8.push((await criar(ESCOLA, turma8, `vila.a${i}`, `Estudante ${i}`)).id);
  }
  estudante3 = (await criar(ESCOLA, turma3, "vila.p1", "Pequeno 1")).id;
  estudanteDaOutraEscola = (await criar(OUTRA_ESCOLA, null, "vila.x1", "Fora 1")).id;

  /* A PORTA DA SALA (ADR-69): a Vila é transversal, o que quer dizer que ela
     CABE em qualquer ano — não que ela abre sozinha. Sem estas linhas, `abrir`
     recusa com 403 `missao-nao-liberada`. */
  for (const turmaId of [turma8, turma3]) {
    await liberarParaTeste(prisma, ESCOLA, turmaId, "app-70-vila-do-lume", estudantes8[0]!);
  }
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("abrir a partida", () => {
  test("crava o início no servidor e entrega só os cartões da bolha, sem gabarito", async () => {
    const s = await service.abrir(ESCOLA, estudantes8[0]!, "1.0.0");
    expect(s.sessaoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(["A", "B", "C"]).toContain(s.bolha);
    expect(s.cartoes.length).toBe(4);
    const fio = JSON.stringify(s.cartoes);
    expect(fio).not.toMatch(/legitima|"aceita"|"nivel"/);

    const linha = await prisma.vilaSessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
    expect(linha.status).toBe("aberta");
    expect(linha.turmaId).toBe(turma8);
    expect(linha.cartoesServidos).toBe(4);
    /* O início é cravado pelo SERVIDOR (default do banco), não pelo relógio do
       cliente — o app de origem derivava `iniciadaEm` de um `Date.now()` no
       navegador e documentava que a hora numa máquina de escola costuma estar
       errada. */
    expect(linha.abertaEm.getTime()).toBeLessThanOrEqual(Date.now());
    expect(Date.now() - linha.abertaEm.getTime()).toBeLessThan(60_000);
  });

  test("a partida NÃO nasce com prazo de validade", () => {
    /* Houve um `expires_at` de 90 dias, e nenhuma rotina que o cumprisse. Coluna
       de prazo que ninguém lê é pior que prazo nenhum: quem lê o schema acredita
       nela. O que se ganha em troca é o reprocessamento — `payload` é a única
       fonte para recomputar o perfil quando `VERSAO_MAPEAMENTO` subir.
       Este teste falha se alguém reintroduzir a coluna sem a rotina. */
    const colunas = Object.keys(prisma.vilaSessao.fields);
    expect(colunas).not.toContain("expiresAt");
  });

  test("a bolha é ESTÁVEL entre partidas do mesmo estudante", async () => {
    // Se mudasse, a folha do professor ("esse estava na C") ficaria errada e o
    // relatório misturaria dois níveis na mesma criança.
    const primeira = await service.abrir(ESCOLA, estudantes8[1]!, "1.0.0");
    const segunda = await service.abrir(ESCOLA, estudantes8[1]!, "1.0.0");
    const terceira = await service.abrir(ESCOLA, estudantes8[1]!, "1.0.0");
    expect(segunda.bolha).toBe(primeira.bolha);
    expect(terceira.bolha).toBe(primeira.bolha);
    expect(segunda.sessaoId).not.toBe(primeira.sessaoId);
  });

  test("abrir de novo marca a anterior como abandonada — nunca duas abertas", async () => {
    const estudante = estudantes8[2]!;
    const primeira = await service.abrir(ESCOLA, estudante, "1.0.0");
    await service.abrir(ESCOLA, estudante, "1.0.0");
    const antiga = await prisma.vilaSessao.findUniqueOrThrow({ where: { id: primeira.sessaoId } });
    expect(antiga.status).toBe("abandonada");
    expect(antiga.concluidaEm).not.toBeNull();
    const abertas = await prisma.vilaSessao.count({ where: { escolaId: ESCOLA, estudanteId: estudante, status: "aberta" } });
    expect(abertas).toBe(1);
  });

  test("a turma inteira sai balanceada, não toda na bolha A", async () => {
    // A sala clica "jogar" no mesmo minuto. Sem o lock consultivo por turma, os
    // 9 leriam a mesma contagem vazia e todos cairiam na A — a falha que estraga
    // o debate. Aqui vão em paralelo de propósito.
    await prisma.vilaBolha.deleteMany({ where: { escolaId: ESCOLA } });
    await Promise.all(estudantes8.map((id) => service.abrir(ESCOLA, id, "1.0.0")));
    const porBolha = await prisma.vilaBolha.groupBy({
      by: ["bolha"],
      where: { escolaId: ESCOLA, estudante: { turmaId: turma8 } },
      _count: { bolha: true },
    });
    expect(porBolha.length).toBe(3);
    for (const linha of porBolha) expect(linha._count.bolha).toBe(3);
  });

  test("nos anos iniciais a bolha B não é atribuída", async () => {
    const s = await service.abrir(ESCOLA, estudante3, "1.0.0");
    expect(s.bolha).not.toBe("B");
    // e o golpe servido não é o de autoridade/urgência
    expect(JSON.stringify(s.cartoes)).not.toMatch(/Suporte da Vila/);
  });

  test("estudante de outra escola não abre partida nesta", async () => {
    expect(await statusDe(service.abrir(ESCOLA, estudanteDaOutraEscola, "1.0.0"))).toBe(404);
  });
});

describe("concluir a partida", () => {
  test("grava contadores, perfil e leitura das mensagens numa transação", async () => {
    const estudante = estudantes8[3]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    const r = await service.concluir(ESCOLA, estudante, s.sessaoId, comCartoesComuns(partidaCompleta()));
    expect(r.status).toBe("gravada");
    expect(r.perfilId).not.toBeNull();

    const linha = await prisma.vilaSessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
    expect(linha.status).toBe("completa");
    expect(linha.concluidaEm).not.toBeNull();
    expect(linha.fogueirasAcesas).toBe(8);
    expect(linha.aldeoesAjudados).toBe(3);
    expect(linha.payload).not.toBeNull();
    expect(linha.leituraMensagens).not.toBeNull();

    const perfil = await prisma.vilaPerfil.findFirstOrThrow({ where: { sessaoId: s.sessaoId } });
    expect(perfil.versaoMapeamento).toBe(VERSAO_MAPEAMENTO);
    // A leitura das mensagens tem de ser da MESMA bolha da partida.
    const leitura = linha.leituraMensagens as { bolha: string };
    expect(leitura.bolha).toBe(linha.bolha);
  });

  test("é idempotente: concluir de novo devolve o que já está gravado", async () => {
    const estudante = estudantes8[4]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    const primeira = await service.concluir(ESCOLA, estudante, s.sessaoId, comCartoesComuns(partidaCompleta()));
    const segunda = await service.concluir(ESCOLA, estudante, s.sessaoId, comCartoesComuns(partidaCompleta()));
    expect(segunda.status).toBe("jaEstava");
    expect(segunda.perfilId).toBe(primeira.perfilId);
    expect(await prisma.vilaPerfil.count({ where: { sessaoId: s.sessaoId } })).toBe(1);
  });

  test("missão que não aconteceu grava SQL NULL, não o JSON `null`", async () => {
    // Com `Prisma.JsonNull` a coluna recebe o VALOR json null, e um
    // `IS NOT NULL` passa a responder TRUE para toda partida — a pergunta
    // "quais têm leitura das mensagens?" devolveria todas. O caminho de leitura
    // funciona nos dois casos, que é o que torna esse erro silencioso.
    const estudante = estudantes8[2]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    await service.concluir(ESCOLA, estudante, s.sessaoId, partidaCompleta()); // seguranca.cartoes vazio
    const [linha] = await prisma.$queryRaw<Array<{ nulo: boolean }>>`
      SELECT leitura_mensagens IS NULL AS nulo FROM app_70_sessoes WHERE id = ${s.sessaoId}::uuid`;
    expect(linha!.nulo).toBe(true);
    const relatorio = await service.doEstudante(ESCOLA, estudante);
    expect(relatorio!.mensagens).toBeNull();
    // E os cartões foram servidos: a missão estava disponível, só não apareceu.
    expect(relatorio!.cartoesServidos).toBe(4);
  });

  test("partida abandonada guarda o bruto e NÃO gera perfil", async () => {
    const estudante = estudantes8[5]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    const p = comCartoesComuns(partidaCompleta());
    p.status = "abandonada";
    (p.resumo as Record<string, unknown>).fogueirasAcesas = 3;
    const r = await service.concluir(ESCOLA, estudante, s.sessaoId, p);
    expect(r.perfilId).toBeNull();
    const linha = await prisma.vilaSessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
    expect(linha.status).toBe("abandonada");
    expect(linha.payload).not.toBeNull(); // quantas são abandonadas é dado sobre o JOGO
  });

  test("payload com nome de criança é recusado com 422, e nada é gravado", async () => {
    const estudante = estudantes8[6]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    const p = comCartoesComuns(partidaCompleta());
    p.nome = "Lara";
    expect(await statusDe(service.concluir(ESCOLA, estudante, s.sessaoId, p))).toBe(422);
    const linha = await prisma.vilaSessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
    expect(linha.status).toBe("aberta");
    expect(linha.payload).toBeNull();
  });

  test("cartão de outra bolha é recusado com 422", async () => {
    const estudante = estudantes8[7]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    const outraBolha = s.bolha === "C" ? "jogador-1000" : "colega-fagulha";
    const p = partidaCompleta();
    p.seguranca = {
      apareceram: 1,
      respondidas: 1,
      ignoradas: 0,
      cartoes: [{ id: outraBolha, emMs: 1000, viuOpcoes: true, escolha: 1, decisaoMs: 500 }],
    };
    expect(await statusDe(service.concluir(ESCOLA, estudante, s.sessaoId, p))).toBe(422);
  });
});

describe("tenancy (regra inviolável nº 1)", () => {
  test("nenhuma leitura atravessa escola", async () => {
    const estudante = estudantes8[8]!;
    const s = await service.abrir(ESCOLA, estudante, "1.0.0");
    await service.concluir(ESCOLA, estudante, s.sessaoId, comCartoesComuns(partidaCompleta()));

    // A escola errada não acha a partida, nem para concluir, nem para ler.
    expect(await statusDe(service.concluir(OUTRA_ESCOLA, estudante, s.sessaoId, comCartoesComuns(partidaCompleta())))).toBe(404);
    expect(await service.doEstudante(OUTRA_ESCOLA, estudante)).toBeNull();
    expect(await service.daTurma(OUTRA_ESCOLA, turma8)).toEqual([]);
    // E o dono continua vendo.
    expect(await service.doEstudante(ESCOLA, estudante)).not.toBeNull();
  });

  test("concluir a partida de OUTRO estudante da mesma escola é 404", async () => {
    const dono = estudantes8[0]!;
    const outro = estudantes8[1]!;
    const s = await service.abrir(ESCOLA, dono, "1.0.0");
    expect(await statusDe(service.concluir(ESCOLA, outro, s.sessaoId, comCartoesComuns(partidaCompleta())))).toBe(404);
  });
});

describe("o guia não projeta bolha que a turma não recebeu", () => {
  test("turma dos anos iniciais só tem A e C", async () => {
    // Sem isto o guia de uma turma de 3º ano projetaria o golpe da bolha B — que
    // a api nunca serviu ali — e mandaria o professor esperar a reação de um
    // grupo que não existe na sala.
    expect(await service.bolhasDaTurma(ESCOLA, turma3)).toEqual(["A", "C"]);
  });

  test("turma dos anos finais tem as três", async () => {
    expect(await service.bolhasDaTurma(ESCOLA, turma8)).toEqual(["A", "B", "C"]);
  });

  test("turma de outra escola é null", async () => {
    expect(await service.bolhasDaTurma(OUTRA_ESCOLA, turma8)).toBeNull();
  });
});

describe("leitura do professor", () => {
  test("a turma vem com uma linha por estudante, com a bolha e sem número de valor", async () => {
    const linhas = await service.daTurma(ESCOLA, turma8);
    expect(linhas.length).toBe(estudantes8.length);
    for (const l of linhas) {
      expect(l.nome).toBeTruthy();
      expect(["A", "B", "C"]).toContain(l.bolha);
    }
    // Nenhum valor de Schwartz vaza para a listagem da turma.
    expect(JSON.stringify(linhas)).not.toMatch(/power|selfDirection|valores/);
  });

  test("o relatório não traz número para valor não-`scored`", async () => {
    const relatorio = await service.doEstudante(ESCOLA, estudantes8[3]!);
    expect(relatorio).not.toBeNull();
    for (const linha of relatorio!.perfil!.linhas) {
      if (linha.grau !== "scored") expect(linha.numero).toBeNull();
      else expect(typeof linha.numero).toBe("number");
    }
    // A seção das mensagens existe e sabe o nível.
    expect(relatorio!.mensagens!.bolha).toBe(relatorio!.bolha);
  });

  test("estudante que não jogou devolve null, não erro", async () => {
    const novo = await prisma.user.create({
      data: { role: "estudante", escolaId: ESCOLA, turmaId: turma8, username: "vila.novo", displayName: "Novo", passwordHash: "x" },
      select: { id: true },
    });
    expect(await service.doEstudante(ESCOLA, novo.id)).toBeNull();
  });
});

/* ÚLTIMO BLOCO DO ARQUIVO, e não é organização: ele APAGA os dados que os
   describes acima usam. O Jest roda os describes na ordem do arquivo, então
   colocá-lo no meio faz os seguintes falharem com "não encontrado" — que é um
   sintoma que não tem nada a ver com a causa. */
describe("zerar os dados da turma", () => {
  test("apaga partidas, perfis E bolhas — sem bolha nova, a rodada não mede nada", async () => {
    // A bolha vai junto de propósito: rodar de novo com a mesma bolha serviria à
    // criança o MESMO golpe, ela reconhece, e a segunda rodada não mede nada.
    const antes = await prisma.vilaSessao.count({ where: { escolaId: ESCOLA } });
    expect(antes).toBeGreaterThan(0);

    const r = await service.zerarTurma(ESCOLA, turma8);
    expect(r).not.toBeNull();
    expect(r!.partidas).toBeGreaterThan(0);

    const daTurma = estudantes8;
    expect(await prisma.vilaSessao.count({ where: { escolaId: ESCOLA, estudanteId: { in: daTurma } } })).toBe(0);
    expect(await prisma.vilaPerfil.count({ where: { escolaId: ESCOLA, estudanteId: { in: daTurma } } })).toBe(0);
    expect(await prisma.vilaBolha.count({ where: { escolaId: ESCOLA, estudanteId: { in: daTurma } } })).toBe(0);
  });

  /* Contagem RELATIVA, não absoluta: `estudante3` acumulou partidas dos describes
     anteriores, e fixar um número aqui quebra sempre que um teste acima abrir mais
     uma. O que este teste afirma é que zerar a turma 8A não encosta nele. */
  const partidasDoEstudante3 = () =>
    prisma.vilaSessao.count({ where: { escolaId: ESCOLA, estudanteId: estudante3 } });

  test("não atravessa turma: quem é de outra turma da mesma escola fica", async () => {
    await service.abrir(ESCOLA, estudante3, "1.0.0");
    const antes = await partidasDoEstudante3();
    expect(antes).toBeGreaterThan(0);

    await service.zerarTurma(ESCOLA, turma8); // estudante3 é da turma 3A
    expect(await partidasDoEstudante3()).toBe(antes);
  });

  test("turma de outra escola é null, e nada é apagado", async () => {
    const antes = await partidasDoEstudante3();
    expect(await service.zerarTurma(OUTRA_ESCOLA, turma8)).toBeNull();
    expect(await partidasDoEstudante3()).toBe(antes);
  });

  test("zerar de novo é inofensivo", async () => {
    const r = await service.zerarTurma(ESCOLA, turma8);
    expect(r).toEqual({ partidas: 0, perfis: 0, bolhas: 0 });
  });
});

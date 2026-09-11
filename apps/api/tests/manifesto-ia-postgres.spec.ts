import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { ManifestoIaService } from "../src/manifesto-ia/manifesto-ia.service";
import { CLAUSULAS_DEFAULT, PROMPTS_DEFAULT } from "../src/manifesto-ia/catalogo";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp-08 no Postgres: RLS, a porta da sala, a cota de auditoria,
 * o latch da cláusula, o Checkpoint A, o filtro de dado pessoal e a corrida em
 * "Submeter resposta".
 *
 * UMA ESCOLA POR SUÍTE (o Jest paraleliza suítes; limpeza compartilhada
 * corromperia a outra). Molde: `rastro-boato-postgres.spec.ts`.
 *
 * O que esta suíte prova e os testes de regra pura NÃO alcançam: que a RLS
 * isola de verdade (não só que a política existe), que os CHECK recusam o que
 * dizem recusar, e que o 422 do filtro de PII acontece ANTES de qualquer
 * gravação — as três coisas que só o banco pode responder.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-manifesto";
const OUTRA_ESCOLA = "teste-manifesto-outra";

const prisma = new PrismaService({
  datasources: { db: { url: URL } },
}) as PrismaService & PrismaClient;

const service = new ManifestoIaService(prisma);

/**
 * O MESMO Prisma, mas conectado com a role SEM `BYPASSRLS`.
 *
 * Sem isto o teste de isolamento é inútil e passa em falso: o usuário
 * administrativo do Postgres é SUPERUSER, e superusuário ignora RLS **mesmo com
 * `FORCE ROW LEVEL SECURITY`**. A primeira versão desta suíte descobriu isso da
 * pior forma — ela reprovou dizendo que a RLS não isolava, quando o que não
 * isolava era o teste. `app_runtime_test` é o mesmo desenho da produção: a api
 * não é dona das tabelas.
 */
const runtime = new PrismaService({
  datasources: { db: { url: urlDeRuntime(URL) } },
}) as PrismaService & PrismaClient;

let turmaId = "";
let turmaOutraEscola = "";
let estudanteA = "";
let estudanteB = "";
let estudanteC = "";
let estudanteSemTurma = "";
let estudanteOutraEscola = "";

const TABELAS = [
  "exp_08_conteudo_turma",
  "exp_08_sessoes",
  "exp_08_auditorias",
  "exp_08_respostas_percurso",
  "exp_08_gates_turma",
] as const;

/** Os dois questionamentos que abrem o pico, na ordem da hipótese pedagógica. */
const DOIS_QUESTIONAMENTOS = ["prompt_origem_dados", "prompt_preconceito_historico"] as const;

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.exp08Sessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.exp08GateTurma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.exp08ConteudoTurma.deleteMany({ where: { escolaId: { in: escolas } } });
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

/** Contradiz a máquina as duas vezes que abrem o pico. */
async function auditarOMinimo(estudanteId: string) {
  await service.abrirConversa(ESCOLA, estudanteId, turmaId);
  for (const id of DOIS_QUESTIONAMENTOS) {
    await service.disparar(ESCOLA, estudanteId, turmaId, id, 12);
  }
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Manifesto (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  const turma = await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF");
  turmaId = turma.id;
  const outra = await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "8A vizinha", "8EF");
  turmaOutraEscola = outra.id;

  const criar = (escolaId: string, turma: string | null, username: string, nome: string) =>
    prisma.user.create({
      data: {
        role: "estudante",
        escolaId,
        turmaId: turma,
        username,
        displayName: nome,
        passwordHash: "x",
      },
      select: { id: true },
    });
  estudanteA = (await criar(ESCOLA, turmaId, "manifesto.ana", "Ana Teste")).id;
  estudanteB = (await criar(ESCOLA, turmaId, "manifesto.bia", "Bia Teste")).id;
  /* Fica parado em `chat` a suíte inteira: é o estudante que o debate NÃO
     pode empurrar para a frente. */
  estudanteC = (await criar(ESCOLA, turmaId, "manifesto.caio", "Caio Teste")).id;
  estudanteSemTurma = (await criar(ESCOLA, null, "manifesto.sem", "Sem Turma")).id;
  estudanteOutraEscola = (
    await criar(OUTRA_ESCOLA, turmaOutraEscola, "manifesto.vizinho", "Vizinho Teste")
  ).id;

  /* A PORTA DA SALA (ADR-69): sem esta linha `estudanteDaEscola` — o funil de
     todas as rotas de estudante — recusa com 403 `missao-nao-liberada`. */
  await liberarParaTeste(prisma, ESCOLA, turmaId, "exp-08-manifesto-ia", estudanteA);
  await liberarParaTeste(
    prisma,
    OUTRA_ESCOLA,
    turmaOutraEscola,
    "exp-08-manifesto-ia",
    estudanteOutraEscola,
  );
});

afterAll(async () => {
  await limpar();
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("tenancy no banco (regra inviolável nº 1)", () => {
  test("as cinco tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await prisma.$queryRawUnsafe<
        { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`);
      expect({ tabela, ...linha }).toEqual({
        tabela,
        relrowsecurity: true,
        relforcerowsecurity: true,
      });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  /**
   * A prova que a leitura de código não dá: com a escola de A armada, a linha
   * de B SOME — não vem marcada, não vem vazia: some.
   *
   * `FORCE ROW LEVEL SECURITY` é o que faz isto valer também para o dono da
   * tabela, que é quem a aplicação é em dev. Sem o `FORCE`, este teste passaria
   * em produção e falharia aqui — ou o contrário, que é pior.
   */
  test("a RLS isola DE VERDADE: a sessão da escola vizinha não existe daqui", async () => {
    await service.abrirConversa(ESCOLA, estudanteA, turmaId);
    await service.abrirConversa(OUTRA_ESCOLA, estudanteOutraEscola, turmaOutraEscola);

    const daqui = await runtime.comTenancy(
      (tx) => tx.exp08Sessao.findMany({ select: { escolaId: true } }),
      ESCOLA,
    );
    expect(daqui.length).toBeGreaterThan(0);
    expect(daqui.every((l) => l.escolaId === ESCOLA)).toBe(true);

    const deLa = await runtime.comTenancy(
      (tx) => tx.exp08Sessao.findMany({ select: { escolaId: true } }),
      OUTRA_ESCOLA,
    );
    expect(deLa.every((l) => l.escolaId === OUTRA_ESCOLA)).toBe(true);

    /* E as duas listas são DISJUNTAS: não é filtro de aplicação, é o banco
       recusando a linha. */
    expect(daqui.length + deLa.length).toBeGreaterThanOrEqual(2);
  });

  test("o gate e o pacote da turma vizinha também somem", async () => {
    // Uma rede não vê a aula da outra, e o caso que a professora escreveu no
    // preparo é dela.
    await service.mudarGate(OUTRA_ESCOLA, turmaOutraEscola, undefined, "pausar-para-debate");
    const gates = await runtime.comTenancy(
      (tx) => tx.exp08GateTurma.findMany({ select: { escolaId: true } }),
      ESCOLA,
    );
    expect(gates.every((g) => g.escolaId === ESCOLA)).toBe(true);
  });
});

describe("os CHECK são a rede das regras puras", () => {
  test("o manifesto não existe sem cláusula, nem a cláusula sem manifesto", async () => {
    // Um documento sem cláusula teria o artigo em branco; uma cláusula sem
    // documento seria a Etapa 4 sem o artefato que ela promulga.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp_08_sessoes SET clausula_id = 'clausula_veto_humano'
         WHERE escola_id = '${ESCOLA}' AND estudante_id = '${estudanteA}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("`concluido_em` e `passo = fim` não podem divergir", async () => {
    // Uma tela dizendo "missão cumprida" sobre uma linha sem carimbo é um
    // relatório que mente.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp_08_sessoes SET passo = 'fim' WHERE escola_id = '${ESCOLA}'`,
      ),
    ).rejects.toThrow();
  });

  test("a cláusula só aceita os quatro ids do catálogo", async () => {
    // Id inventado produziria uma tela mostrando uma cláusula que o servidor
    // não reconhece. NÃO é gabarito: as quatro são válidas.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp_08_sessoes SET clausula_id = 'clausula_inventada', manifesto_markdown = 'x'
         WHERE escola_id = '${ESCOLA}' AND estudante_id = '${estudanteA}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("o percurso exige DUAS palavras-chave distintas do vocabulário", async () => {
    const inserir = (tags: string) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO exp_08_respostas_percurso
           (escola_id, estudante_id, palavras_chave_tags, justificativa_texto, chars_count)
         VALUES ('${ESCOLA}', '${estudanteA}'::uuid, ${tags},
                 'Uma pessoa tem de olhar antes de a maquina decidir.', 50)`,
      );
    // Uma só: cardinalidade errada.
    await expect(inserir(`ARRAY['autonomia']`)).rejects.toThrow();
    // Repetida: um slot logicamente vazio dentro de um array cheio.
    await expect(inserir(`ARRAY['justica','justica']`)).rejects.toThrow();
    // Fora do vocabulário.
    await expect(inserir(`ARRAY['autonomia','eficiencia']`)).rejects.toThrow();
  });

  test("o parágrafo em branco não passa — o `btrim` cobre o piso que o tipo não cobre", async () => {
    // Vinte espaços passariam o comprimento e contariam como percurso entregue.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO exp_08_respostas_percurso
           (escola_id, estudante_id, palavras_chave_tags, justificativa_texto, chars_count)
         VALUES ('${ESCOLA}', '${estudanteA}'::uuid, ARRAY['autonomia','justica'],
                 '                         ', 25)`,
      ),
    ).rejects.toThrow();
  });

  test("o pacote da turma tem 3 questionamentos e 4 cláusulas, sempre", async () => {
    // Um pacote com duas cláusulas faria a tela do PICO renderizar meio grid, e
    // o sintoma apareceria na aula, não no deploy.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO exp_08_conteudo_turma
           (escola_id, turma_id, caso_contextual, foco_prioritario,
            contexto, prompts_json, clausulas_json)
         VALUES ('${ESCOLA}', '${turmaId}'::uuid, 'caso', 'foco',
                 '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)`,
      ),
    ).rejects.toThrow();
  });
});

describe("a porta da sala (ADR-69)", () => {
  test("estudante de turma sem liberação é recusado no funil", async () => {
    // Filtrar o card no hub é UX; a regra que vale é esta. `/exp/:expId` é
    // endereço adivinhável e o bundle é público.
    expect(await codigoDe(service.sessao(ESCOLA, estudanteSemTurma, null))).toBe(
      "missao-nao-liberada",
    );
  });

  test("a recusa vale para TODA rota de estudante, não só a de leitura", async () => {
    for (const chamada of [
      () => service.abrirConversa(ESCOLA, estudanteSemTurma, null),
      () => service.disparar(ESCOLA, estudanteSemTurma, null, "prompt_origem_dados", 1),
      () => service.submeterClausula(ESCOLA, estudanteSemTurma, null, "clausula_veto_humano", 10, false),
      () => service.registrarPercurso(ESCOLA, estudanteSemTurma, null, ["autonomia", "justica"], "um texto qualquer com mais de vinte caracteres"),
      () => service.concluir(ESCOLA, estudanteSemTurma, null),
    ]) {
      expect(await codigoDe(chamada())).toBe("missao-nao-liberada");
    }
  });
});

describe("a cota de auditoria é a porta do pico (PED-02)", () => {
  test("fixar a cláusula com UM questionamento é recusado", async () => {
    await service.abrirConversa(ESCOLA, estudanteB, turmaId);
    await service.disparar(ESCOLA, estudanteB, turmaId, "prompt_origem_dados", 14);
    expect(
      await codigoDe(
        service.submeterClausula(ESCOLA, estudanteB, turmaId, "clausula_veto_humano", 20, false),
      ),
    ).toBe("auditoria-insuficiente");
  });

  test("o mesmo questionamento duas vezes é recusado, e o banco tem UMA linha", async () => {
    expect(
      await codigoDe(service.disparar(ESCOLA, estudanteB, turmaId, "prompt_origem_dados", 9)),
    ).toBe("prompt-ja-enviado");
    const linhas = await prisma.exp08Auditoria.count({
      where: { escolaId: ESCOLA, estudanteId: estudanteB, promptId: "prompt_origem_dados" },
    });
    expect(linhas).toBe(1);
  });

  test("a defesa da máquina só chega NA RESPOSTA do disparo", async () => {
    // Ver a réplica antes de fazer a pergunta desmontaria a cena da auditoria.
    const r = await service.disparar(
      ESCOLA,
      estudanteB,
      turmaId,
      "prompt_preconceito_historico",
      16,
    );
    expect(r.replica).toContain("probabilidade estatística válida");
    // E a cota fecha AQUI, no servidor: uma tela que decide quando o pico
    // começa é uma tela que pode pular o pico.
    expect(r.cotaAtingida).toBe(true);
    expect(r.passoDoEstudante).toBe("decisao");
  });
});

describe("o gabarito não existe — e o que não pode vazar, não vaza (regra 3)", () => {
  test("a sessão não leva a réplica da máquina nem o argumento das cláusulas", async () => {
    // A prova é por busca no JSON serializado, não por confiança no schema: é
    // o que pega o campo que alguém acrescentar sem pensar.
    const sessao = await service.sessao(ESCOLA, estudanteA, turmaId);
    const bruto = JSON.stringify(sessao.catalogo);
    expect(bruto).not.toContain("replicaIa");
    expect(bruto).not.toContain("justificativaSugerida");
    for (const p of PROMPTS_DEFAULT) expect(bruto).not.toContain(p.replicaIa);
    for (const c of CLAUSULAS_DEFAULT) expect(bruto).not.toContain(c.justificativaSugerida);
  });

  test("mas o professor recebe as duas coisas — é o roteiro dele", async () => {
    const conteudo = await service.conteudoParaOProfessor(ESCOLA, turmaId);
    const bruto = JSON.stringify(conteudo);
    expect(bruto).toContain(PROMPTS_DEFAULT[0]!.replicaIa);
    expect(bruto).toContain(CLAUSULAS_DEFAULT[0]!.justificativaSugerida);
  });
});

describe("o PICO: latch, compilação e a corrida em Submeter", () => {
  test("a cláusula é gravada e o manifesto é COMPILADO no servidor", async () => {
    const r = await service.submeterClausula(
      ESCOLA,
      estudanteB,
      turmaId,
      "clausula_veto_humano",
      42,
      false,
    );
    expect(r.manifestoMarkdown).toContain("Veto Humano Obrigatório");
    // E NÃO leva as outras três: a diretriz soberana é uma, senão a escolha do
    // pico não teria consequência.
    expect(r.manifestoMarkdown).not.toContain("Anonimização Estrita");
    expect(r.delayMs).toBe(2000);
  });

  test("a segunda submissão é recusada — a escolha é definitiva", async () => {
    expect(
      await codigoDe(
        service.submeterClausula(ESCOLA, estudanteB, turmaId, "clausula_transparencia", 5, false),
      ),
    ).toBe("clausula-ja-submetida");
  });

  /**
   * Dois toques rápidos em "Submeter resposta" viram duas transações em fila. O
   * `pg_advisory_xact_lock` por (escola, estudante) as serializa, e a segunda
   * relê o estado com a primeira aplicada — daí o `clausula-ja-submetida` em vez
   * de dois manifestos compilados.
   */
  test("a corrida em Submeter produz UMA cláusula, não duas", async () => {
    await auditarOMinimo(estudanteA);
    const [a, b] = await Promise.allSettled([
      service.submeterClausula(ESCOLA, estudanteA, turmaId, "clausula_transparencia", 30, false),
      service.submeterClausula(ESCOLA, estudanteA, turmaId, "clausula_anonimizacao", 30, false),
    ]);
    const vitoriosos = [a, b].filter((r) => r.status === "fulfilled");
    expect(vitoriosos).toHaveLength(1);

    const linha = await prisma.exp08Sessao.findUniqueOrThrow({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: estudanteA } },
      select: { clausulaId: true, manifestoMarkdown: true },
    });
    expect(linha.clausulaId).toBeTruthy();
    expect(linha.manifestoMarkdown).toBeTruthy();
  });
});

describe("o Checkpoint A (ADR-93)", () => {
  test("pausar segura a assinatura, no SERVIDOR", async () => {
    // O overlay é UX; `/manifesto-ia/percurso` é endereço alcançável.
    await service.mudarGate(ESCOLA, turmaId, undefined, "pausar-para-debate");
    expect(
      await codigoDe(
        service.registrarPercurso(
          ESCOLA,
          estudanteB,
          turmaId,
          ["autonomia", "justica"],
          "Uma pessoa tem de olhar antes de a máquina decidir sobre alguém.",
        ),
      ),
    ).toBe("debate-em-andamento");
  });

  /**
   * ESTE TESTE ENCONTROU UM DEFEITO, e é a razão de ele existir.
   *
   * Na primeira versão, `aguardandoATurma` era `passoEfetivo !== passo` e o
   * congelamento era um TETO. O estudante parado exatamente em `manifesto`
   * ficava com `passoEfetivo === passo`, `aguardandoATurma: false` — e **o
   * overlay de pausa não aparecia para quem tinha acabado de ler o documento**,
   * que é exatamente quem o debate existe para reunir. O typecheck e os testes
   * de regra pura passavam.
   *
   * O congelamento virou uma JANELA (`manifesto`..`percurso`).
   */
  test("acende o overlay para quem ESTÁ no manifesto — o caso mais comum", async () => {
    const parado = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(parado.turma.etapa).toBe("debate");
    expect(parado.passo).toBe("manifesto");
    expect(parado.aguardandoATurma).toBe(true);
  });

  test("e NÃO toca quem ainda está auditando a máquina", async () => {
    // Pausar não empurra para a frente quem está atrás: puxá-lo para o
    // documento o faria pular a auditoria, que é o que a aula mede.
    await service.abrirConversa(ESCOLA, estudanteC, turmaId);
    const atras = await service.sessao(ESCOLA, estudanteC, turmaId);
    expect(atras.passo).toBe("chat");
    expect(atras.aguardandoATurma).toBe(false);
  });

  test("pausar é idempotente — é o clique que se dá duas vezes", async () => {
    const um = await service.mudarGate(ESCOLA, turmaId, undefined, "pausar-para-debate");
    const dois = await service.mudarGate(ESCOLA, turmaId, undefined, "pausar-para-debate");
    expect(um.etapa).toBe("debate");
    expect(dois.etapa).toBe("debate");
  });

  test("o polling devolve a etapa e o instante do SERVIDOR", async () => {
    // O relógio da máquina da escola atrasa, e não é ele que decide o momento.
    const gate = await service.gate(ESCOLA, turmaId, "manifesto");
    expect(gate.etapa).toBe("debate");
    expect(gate.passoEfetivo).toBe("manifesto");
    expect(Number.isNaN(Date.parse(gate.agora))).toBe(false);
  });
});

describe("o filtro de dado pessoal: 422, e NADA gravado", () => {
  beforeAll(async () => {
    await service.mudarGate(ESCOLA, turmaId, undefined, "retomar-missao");
  });

  test("telefone na justificativa é recusado com o código estável", async () => {
    expect(
      await codigoDe(
        service.registrarPercurso(
          ESCOLA,
          estudanteB,
          turmaId,
          ["autonomia", "justica"],
          "Se errarem comigo me liguem no (11) 98765-4321 para eu poder contestar.",
        ),
      ),
    ).toBe("dado-pessoal-no-texto");
  });

  test("e o texto NÃO chegou ao banco — a recusa é anterior à gravação", async () => {
    // A alternativa descartada era gravar com flag de moderação. O que não foi
    // gravado não vaza em backup, em dump de diagnóstico nem em log.
    const linhas = await prisma.exp08Percurso.count({
      where: { escolaId: ESCOLA, estudanteId: estudanteB },
    });
    expect(linhas).toBe(0);
  });

  test("o ano NÃO é confundido com dado pessoal — é o falso positivo mais provável", async () => {
    const r = await service.registrarPercurso(
      ESCOLA,
      estudanteB,
      turmaId,
      ["autonomia", "justica"],
      "Desde 2019 a escola usa esse sistema e ninguém nos explicou como ele decide.",
    );
    expect(r.registrouPercurso).toBe(true);
  });

  test("o percurso é latch: a segunda assinatura é recusada", async () => {
    expect(
      await codigoDe(
        service.registrarPercurso(
          ESCOLA,
          estudanteB,
          turmaId,
          ["justica", "privacidade"],
          "Mudei de ideia sobre a cláusula que escolhi para o nosso manifesto.",
        ),
      ),
    ).toBe("percurso-ja-registrado");
  });

  test("concluir carimba o `concluido_em` e fecha a missão", async () => {
    const r = await service.concluir(ESCOLA, estudanteB, turmaId);
    expect(r.passoDoEstudante).toBe("fim");
    expect(r.concluidoEm).toBeTruthy();
    // Sem `score`: a missão não pontua, e as quatro cláusulas valem igual.
    expect(JSON.stringify(r)).not.toContain('"score"');
  });
});

describe("o painel do professor", () => {
  test("não expõe nota, nível nem taxa de acerto (PED-07 / D6b)", async () => {
    // Com quatro cláusulas e uma "mais votada", o percentual de acerto é o erro
    // natural de quem chegar depois.
    const painel = await service.painel(ESCOLA, turmaId);
    const bruto = JSON.stringify(painel);
    for (const proibido of ['"score"', '"nivel"', '"pontos"', '"ranking"', '"acerto"', '"taxa"']) {
      expect(bruto).not.toContain(proibido);
    }
  });

  test("mostra progresso, a distribuição das cláusulas e o texto do percurso", async () => {
    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.resumo.total).toBeGreaterThanOrEqual(2);
    expect(painel.resumo.distribuicao.clausula_veto_humano).toBeGreaterThanOrEqual(1);
    expect(painel.resumo.tags.autonomia).toBeGreaterThanOrEqual(1);
    const bia = painel.estudantes.find((e) => e.estudanteId === estudanteB);
    expect(bia?.registrouPercurso).toBe(true);
    expect(bia?.justificativaTexto).toContain("2019");
    expect(bia?.auditouOMinimo).toBe(true);
  });

  test("a homologação é o ÚNICO caminho que liga `aprovado_por_professor`", async () => {
    // Sem ela, a missão lê o banco curado — rascunho de IA não chega ao
    // estudante (exigência 8.2).
    const antes = await service.sessao(ESCOLA, estudanteA, turmaId);
    expect(antes.catalogo.origemDoConteudo).toBe("default");

    await service.homologar(
      ESCOLA,
      turmaId,
      undefined,
      {
        contexto: {
          escola: "Escola Municipal de Teste",
          casoUsoTitulo: "Catraca com reconhecimento facial",
          premissaIaAutoritaria: "Sou o sistema. Meus cálculos são objetivos e não precisam de revisão externa.",
        },
        prompts: PROMPTS_DEFAULT.map((p) => ({ ...p })),
        clausulas: CLAUSULAS_DEFAULT.map((c) => ({ ...c })),
      },
      true,
      { casoContextual: "catraca", focoPrioritario: "privacidade" },
    );

    const depois = await service.sessao(ESCOLA, estudanteA, turmaId);
    expect(depois.catalogo.origemDoConteudo).toBe("turma");
    expect(depois.catalogo.contexto.escola).toBe("Escola Municipal de Teste");
  });

  test("zerar a turma apaga a execução e PRESERVA o preparo", async () => {
    // A curadoria custou tempo da professora: apagá-la junto obrigaria a
    // refazer para aplicar a missão na turma seguinte no mesmo dia.
    const r = await service.zerarTurma(ESCOLA, turmaId, undefined);
    expect(r.sucesso).toBe(true);
    expect(r.registrosApagados).toBeGreaterThan(0);

    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.resumo.iniciaram).toBe(0);
    expect(painel.estudantes.every((e) => e.justificativaTexto === null)).toBe(true);
    // O gate volta a `missao`, senão a turma nova nasceria congelada num debate
    // que já aconteceu.
    expect(painel.turma.etapa).toBe("missao");

    const conteudo = await service.conteudoParaOProfessor(ESCOLA, turmaId);
    expect(conteudo.aprovadoPorProfessor).toBe(true);
    expect(conteudo.contexto.escola).toBe("Escola Municipal de Teste");
  });
});

import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { OneRosterService } from "../src/rostering/oneroster.service";
import { RosteringService } from "../src/rostering/rostering.service";
import { periodoDeTeste } from "./turma-de-teste";

/**
 * O binding CSV do OneRoster 1.2 aplicado arquivo por arquivo.
 *
 * O que estes testes protegem é o comportamento na BORDA: referência a
 * `sourcedId` que ainda não existe, `tobedeleted`, `bulk` que não veio completo,
 * a coluna `password` do padrão (que é ignorada) e o papel ausente na 1.2.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-oneroster";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const rostering = new RosteringService(prisma);
const oneroster = new OneRosterService(prisma, rostering);

const csv = (...linhas: string[]) => linhas.join("\n");
/**
 * Ano letivo de 2025, não o corrente, DE PROPÓSITO: `periodos_letivos` é
 * catálogo do CONTRATO — não tem escola e é compartilhado por todas as suítes.
 * Um período de 2026 criado aqui passaria a vencer o `periodoDeHoje()` das
 * outras, que rodam em paralelo contra o mesmo banco, e elas criariam turma sob
 * o período errado. Falha intermitente, longe da causa.
 */
const PERIODO = "or-ano-2025";

async function limpar() {
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
  await prisma.periodoLetivo.deleteMany({ where: { fonteId: PERIODO } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola OneRoster (teste)" } });
  await periodoDeTeste(prisma); // garante um vigente para o caso sem termSourcedIds
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("manifest.csv", () => {
  test("valida a versão e lista os arquivos declarados", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "manifest",
      csv(
        "propertyName,value",
        "manifest.version,1.0",
        "oneroster.version,1.2",
        "file.users,bulk",
        "file.enrollments,delta",
        "file.results,bulk",
      ),
    );
    expect(r.erros).toEqual([]);
    expect(r.arquivosDoLote).toEqual(
      expect.arrayContaining([{ nome: "users", modo: "bulk" }, { nome: "enrollments", modo: "delta" }]),
    );
    // results.csv é do serviço de notas: declarado, mas sem destino nesta api.
    expect(r.avisos.map((a) => a.campo)).toContain("results");
  });

  test("arquivo que a api LÊ não vira aviso de não-lido (a comparação é sem caixa)", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "manifest",
      csv(
        "propertyName,value",
        "oneroster.version,1.2",
        "file.academicSessions,delta",
        "file.enrollments,delta",
      ),
    );
    // `file.academicSessions` chega normalizado como `academicsessions`;
    // comparando com a grafia do padrão, o manifesto acusava que não lemos
    // justamente o arquivo que lemos.
    expect(r.avisos).toEqual([]);
  });

  test("versão diferente de 1.2 é erro, não tentativa", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "manifest",
      csv("propertyName,value", "oneroster.version,1.1"),
    );
    expect(r.erros[0]?.campo).toBe("oneroster.version");
  });
});

describe("ordem de dependência", () => {
  test("classes antes de academicSessions cai no período vigente", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "classes",
      csv(
        "sourcedId,title,grades,classType,schoolSourcedId,termSourcedIds",
        `or-t1,7A,08,homeroom,${ESCOLA},`,
      ),
    );
    expect(r.criados).toBe(1);
    expect(r.turmasCriadas).toEqual(["7A"]);
  });

  test("enrollments antes de users diz QUAL arquivo falta", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "enrollments",
      csv("sourcedId,classSourcedId,userSourcedId,role,primary", "or-m1,or-t1,or-u1,student,true"),
    );
    expect(r.matriculados).toBe(0);
    expect(r.erros[0]?.mensagem).toMatch(/envie users.csv antes/);
  });

  test("classes com termSourcedIds desconhecido não inventa período", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "classes",
      csv(
        "sourcedId,title,grades,schoolSourcedId,termSourcedIds",
        `or-t9,9Z,09,${ESCOLA},or-periodo-que-nao-existe`,
      ),
    );
    expect(r.criados).toBe(0);
    expect(r.erros[0]?.mensagem).toMatch(/envie academicSessions.csv antes/);
  });
});

describe("lote completo, na ordem", () => {
  test("academicSessions cria o ano letivo", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "academicSessions",
      csv(
        "sourcedId,title,type,startDate,endDate,schoolYear",
        `${PERIODO},Ano letivo OR 2025,schoolYear,2025-02-01,2025-12-20,2025`,
      ),
    );
    expect(r.criados).toBe(1);
    const periodo = await prisma.periodoLetivo.findFirstOrThrow({ where: { fonteId: PERIODO } });
    expect(periodo.tipo).toBe("ano_letivo");
  });

  test("classes amarra a turma ao período do arquivo", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "classes",
      csv(
        "sourcedId,title,grades,classType,schoolSourcedId,termSourcedIds",
        `or-t2,8A,08,homeroom,${ESCOLA},${PERIODO}`,
        `or-t3,Eletiva de Robótica,08,scheduled,${ESCOLA},${PERIODO}`,
      ),
    );
    expect(r.criados).toBe(2);
    const eletiva = await prisma.turma.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-t3" } });
    expect(eletiva.tipo).toBe("componente");
  });

  test("users: password do padrão é IGNORADA e o papel ausente cai em aluno", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "users",
      csv(
        "sourcedId,enabledUser,username,givenName,familyName,identifier,email,password",
        "or-u1,true,,Ana,Ribeiro,OR-A1,ana@escola.exemplo,senha-do-arquivo",
        "or-u2,true,marta.or,Marta,Alves,OR-P1,,",
      ),
      { senhaPadrao: "SenhaDoLote1" },
    );

    expect(r.criados).toBe(2);
    expect(r.avisos.map((a) => a.campo)).toEqual(expect.arrayContaining(["password", "role"]));

    const ana = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u1" } });
    // Login gerado (a coluna veio vazia) e papel de MENOR privilégio.
    expect(ana.username).toBe("ana.ribeiro");
    expect(ana.role).toBe("aluno");
    expect(ana.matriculaExterna).toBe("OR-A1");
    expect(ana.senhaProvisoria).toBe(true);
    // A senha do arquivo não foi usada: a do lote é que valeu.
    const senhaDoArquivo = r.credenciais.find((c) => c.usuario === "ana.ribeiro")?.senha;
    expect(senhaDoArquivo).toBe("SenhaDoLote1");
  });

  test("roles.csv corrige o papel; secundário é ignorado com aviso", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "roles",
      csv(
        "sourcedId,userSourcedId,roleType,role,orgSourcedId",
        `or-r1,or-u2,primary,teacher,${ESCOLA}`,
        `or-r2,or-u1,secondary,teacher,${ESCOLA}`,
      ),
    );
    expect(r.atualizados).toBe(1);
    expect(r.avisos[0]?.campo).toBe("roleType");

    const marta = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u2" } });
    expect(marta.role).toBe("professor");
    const ana = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u1" } });
    expect(ana.role).toBe("aluno"); // o secundário não promoveu ninguém
  });

  test("enrollments matricula aluno e professor, e o aluno em DUAS turmas", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "enrollments",
      csv(
        "sourcedId,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate",
        `or-m1,or-t2,${ESCOLA},or-u1,student,true,2025-02-01`,
        `or-m2,or-t3,${ESCOLA},or-u1,student,false,2025-02-01`,
        `or-m3,or-t2,${ESCOLA},or-u2,teacher,true,2025-02-01`,
      ),
    );
    expect(r.matriculados).toBe(3);

    const ana = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u1" } });
    const ativas = await prisma.matricula.findMany({
      where: { escolaId: ESCOLA, usuarioId: ana.id, papel: "aluno", fim: null },
    });
    // Eletiva e turma regular ao mesmo tempo — o que a coluna users.turma_id
    // não conseguia representar.
    expect(ativas).toHaveLength(2);

    const doProfessor = await rostering.turmasDoProfessor(
      ESCOLA,
      (await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u2" } })).id,
    );
    expect(doProfessor.map((t) => t.nome)).toEqual(["8A"]);
  });

  test("reaplicar o mesmo lote é no-op (idempotente por sourcedId)", async () => {
    const arquivo = csv(
      "sourcedId,enabledUser,username,givenName,familyName,identifier",
      "or-u1,true,ana.ribeiro,Ana,Ribeiro,OR-A1",
    );
    const r = await oneroster.importar(ESCOLA, "users", arquivo, { senhaPadrao: "SenhaDoLote1" });
    expect(r.criados).toBe(0);
    expect(r.atualizados).toBe(1);
    expect(await prisma.user.count({ where: { escolaId: ESCOLA } })).toBe(2);
  });
});

describe("tobedeleted e bulk", () => {
  test("matrícula tobedeleted é ENCERRADA, não apagada", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "enrollments",
      csv(
        "sourcedId,status,dateLastModified,classSourcedId,userSourcedId,role",
        "or-m2,tobedeleted,2026-08-28T00:00:00.000Z,or-t3,or-u1,student",
      ),
      { modo: "delta" },
    );
    expect(r.desativados).toBe(1);

    const turmaEletiva = await prisma.turma.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-t3" } });
    const linha = await prisma.matricula.findFirstOrThrow({
      where: { escolaId: ESCOLA, turmaId: turmaEletiva.id },
    });
    expect(linha.fim).not.toBeNull(); // a linha continua existindo
  });

  test("pessoa tobedeleted é DESATIVADA, não apagada", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "users",
      csv(
        "sourcedId,status,dateLastModified,enabledUser,username,givenName,familyName",
        "or-u1,tobedeleted,2026-08-28T00:00:00.000Z,false,ana.ribeiro,Ana,Ribeiro",
      ),
    );
    expect(r.desativados).toBe(1);
    const ana = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u1" } });
    expect(ana.ativo).toBe(false);
    await prisma.user.update({ where: { id: ana.id }, data: { ativo: true } });
  });

  test("bulk incompleto NÃO desativa ninguém — só conta e avisa", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "users",
      csv(
        "sourcedId,enabledUser,username,givenName,familyName",
        "or-u2,true,marta.or,Marta,Alves",
      ),
      { modo: "bulk" },
    );
    expect(r.candidatosAInativacao).toBe(1); // a Ana não veio
    expect(r.avisos.map((a) => a.campo)).toContain("bulk");

    const ana = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA, fonteId: "or-u1" } });
    expect(ana.ativo).toBe(true); // continua ativa: ausência não é ordem de exclusão
  });
});

describe("orgs.csv", () => {
  test("aprende o código INEP da escola desta importação", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "orgs",
      csv("sourcedId,name,type,identifier", `${ESCOLA},EE Teste OneRoster,school,35001234`),
    );
    expect(r.atualizados).toBe(1);
    const escola = await prisma.escola.findUniqueOrThrow({ where: { id: ESCOLA } });
    expect(escola.codigoInep).toBe("35001234");
  });

  test("escola nova NÃO nasce de CSV", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "orgs",
      csv("sourcedId,name,type", "outra-escola-qualquer,EE Outra,school"),
    );
    expect(r.criados).toBe(0);
    expect(r.avisos[0]?.mensagem).toMatch(/escola nova não nasce de CSV/);
    expect(await prisma.escola.count({ where: { id: "outra-escola-qualquer" } })).toBe(0);
  });

  test("distrito e rede não são montados por importação", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "orgs",
      csv("sourcedId,name,type", "rede-sp,SEE-SP,district"),
    );
    expect(r.avisos[0]?.campo).toBe("type");
  });
});

describe("cabeçalho", () => {
  test("coluna obrigatória ausente não escreve nada", async () => {
    const r = await oneroster.importar(ESCOLA, "users", csv("sourcedId,username", "x,y"));
    expect(r.criados).toBe(0);
    expect(r.erros[0]?.campo).toBe("header");
  });

  test("coluna extra do padrão (metadata) não é erro", async () => {
    const r = await oneroster.importar(
      ESCOLA,
      "users",
      csv(
        "sourcedId,enabledUser,username,givenName,familyName,metadata.br.cpf",
        "or-u3,true,zeca.or,Zeca,Novo,00000000000",
      ),
      { senhaPadrao: "SenhaDoLote1" },
    );
    expect(r.erros).toEqual([]);
    expect(r.criados).toBe(1);
  });
});

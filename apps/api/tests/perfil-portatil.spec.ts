import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { hashDoPerfil, jsonCanonico, nomeDoArquivo, PerfilPortatilSchema } from "../src/portabilidade/regras";
import { generateKeyPair, SignJWT } from "jose";
import {
  verificarAssinatura,
  type ResolvedorDeChaves,
} from "../src/portabilidade/verificacao";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * O PERFIL PORTÁTIL — o que a criança leva quando sai da REDE.
 *
 * O que esta suíte protege, em ordem de importância:
 *
 * 1. O documento que vem de fora **nunca se mistura** com o dado produzido aqui.
 * 2. Assinatura que não confere é RECUSA; não conseguir falar com o emissor é
 *    um rótulo visível, não uma recusa. A diferença entre as duas é a decisão
 *    inteira.
 * 3. O hash é canônico e ESTÁVEL: quem verifica está em outra instalação, numa
 *    versão possivelmente diferente, e as duas precisam chegar ao mesmo número.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-pp-origem";
const ESCOLA_DESTINO = "teste-pp-destino";

/* CPFs válidos EXCLUSIVOS desta suíte: o índice único de CPF é do contrato, e
   duas suítes com o mesmo número colidem no banco quando o Jest as roda junto. */
const CPF_ALUNO = "70010020039";
const CPF_FORASTEIRO = "70010020110";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { portabilidade } = servicosDeTeste(prisma);

let alunoId = "";
let gestorId = "";

async function limpar() {
  const alvo = { in: [ESCOLA, ESCOLA_DESTINO] };
  await prisma.perfilPortatil.deleteMany({ where: { escolaId: alvo } });
  await prisma.matricula.deleteMany({ where: { escolaId: alvo } });
  await prisma.lotacao.deleteMany({ where: { escolaId: alvo } });
  await prisma.user.deleteMany({ where: { escolaId: alvo } });
  await prisma.turma.deleteMany({ where: { escolaId: alvo } });
  await prisma.escola.deleteMany({ where: { id: { in: [ESCOLA, ESCOLA_DESTINO] } } });
}

beforeAll(async () => {
  await limpar();
  const periodo = await periodoDeTeste(prisma);

  for (const [id, nome] of [
    [ESCOLA, "EE Portátil Origem"],
    [ESCOLA_DESTINO, "EE Portátil Destino"],
  ] as const) {
    await prisma.escola.create({
      data: { id, nome, tipo: "escola", municipio: "São Paulo", uf: "SP" },
    });
  }

  const turma = await prisma.turma.create({
    data: { escolaId: ESCOLA, nome: "7A", serie: "7EF", periodoLetivoId: periodo.id },
  });

  const aluno = await prisma.user.create({
    data: {
      escolaId: ESCOLA,
      username: "pp.aluno",
      displayName: "Ana Portátil da Silva",
      passwordHash: "x",
      role: "aluno",
      cpf: CPF_ALUNO,
      turmaId: turma.id,
    },
  });
  alunoId = aluno.id;
  await prisma.lotacao.create({
    data: {
      escolaId: ESCOLA,
      usuarioId: aluno.id,
      papel: "aluno",
      principal: true,
      inicio: periodo.inicio,
    },
  });
  await prisma.comTenancy(
    (tx) =>
      tx.matricula.create({
        data: {
          escolaId: ESCOLA,
          turmaId: turma.id,
          usuarioId: aluno.id,
          papel: "aluno",
          principal: true,
          inicio: periodo.inicio,
        },
      }),
    ESCOLA,
  );

  const gestor = await prisma.user.create({
    data: {
      escolaId: ESCOLA_DESTINO,
      username: "pp.gestor",
      displayName: "Gestor Portátil",
      passwordHash: "x",
      role: "gestor",
    },
  });
  gestorId = gestor.id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------- o documento

describe("montar o documento", () => {
  test("leva trajetória, participações e o CPF — que é quem reconhece a criança lá fora", async () => {
    const perfil = await portabilidade.montar(alunoId);
    expect(perfil).not.toBeNull();
    expect(perfil!.titular.nome).toBe("Ana Portátil da Silva");
    /* Formatado: quem lê o arquivo é uma pessoa, e a chave de reconciliação são
       os dígitos, que o importador extrai. */
    expect(perfil!.titular.cpf).toBe("700.100.200-39");
    expect(perfil!.trajetoria.escolas).toHaveLength(1);
    expect(perfil!.trajetoria.escolas[0]?.nome).toBe("EE Portátil Origem");
    expect(perfil!.trajetoria.turmas[0]).toMatchObject({ turma: "7A", serie: "7EF" });
  });

  test("sem CPF não há documento: numa rede de destino nenhum id daqui existe", async () => {
    const semCpf = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "pp.sem.cpf",
        displayName: "Sem Documento",
        passwordHash: "x",
        role: "aluno",
      },
    });
    expect(await portabilidade.montar(semCpf.id)).toBeNull();
  });

  test("professor não tem perfil portátil — o documento é do estudante", async () => {
    const prof = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "pp.prof",
        displayName: "Professor Portátil",
        passwordHash: "x",
        role: "professor",
        cpf: CPF_FORASTEIRO,
      },
    });
    expect(await portabilidade.montar(prof.id)).toBeNull();
  });

  test("o documento montado passa no schema que o destino vai aplicar", async () => {
    const perfil = await portabilidade.montar(alunoId);
    const completo = {
      ...perfil,
      emitidoEm: new Date().toISOString(),
      emissor: { contrato: "sp-estadual", hub: "https://hub.exemplo.gov.br", nome: "Rede Teste" },
    };
    expect(PerfilPortatilSchema.safeParse(completo).success).toBe(true);
  });
});

// ------------------------------------------------------------------- o hash

describe("hash canônico", () => {
  test("ordem das chaves não muda o hash — quem verifica está em outra instalação", () => {
    const a = { b: 1, a: { z: [1, 2], y: null } };
    const b = { a: { y: null, z: [1, 2] }, b: 1 };
    expect(jsonCanonico(a)).toBe(jsonCanonico(b));
    expect(hashDoPerfil(a)).toBe(hashDoPerfil(b));
  });

  test("ordem de ARRAY muda o hash — lista é conteúdo, não conjunto", () => {
    expect(hashDoPerfil({ x: [1, 2] })).not.toBe(hashDoPerfil({ x: [2, 1] }));
  });

  test("qualquer alteração no conteúdo muda o hash", () => {
    const base = { titular: { nome: "Ana", cpf: "700.100.200-39" } };
    const mexido = { titular: { nome: "Ana", cpf: "700.100.200-30" } };
    expect(hashDoPerfil(base)).not.toBe(hashDoPerfil(mexido));
  });

  /**
   * CONSTANTE COMPARTILHADA COM O HUB.
   *
   * O hub tem a sua própria cópia de `jsonCanonico` (ele assina; a api verifica),
   * e as duas precisam produzir o MESMO número — inclusive entre instalações em
   * versões diferentes, que é o caso normal deste recurso. O mesmo valor é
   * afirmado em `apps/hub/lib/perfil-portatil.test.ts`: se uma das
   * implementações mudar, um dos dois testes cai.
   */
  test("fixture de contrato: o hash é este número e não outro", () => {
    const fixture = {
      documento: "perfil-portatil-unooria",
      versao: 1,
      titular: { cpf: "700.100.200-39", nome: "Ana" },
      participacoes: [{ expId: "exp-70-vila-do-lume", em: "2026-03-01T12:00:00.000Z" }],
    };
    expect(hashDoPerfil(fixture)).toBe(
      "a8bf15847e2b3a4aa640d32a7cf907496c19bf1fb08c8c525ad403cbbcc4ea43",
    );
  });
});

// ------------------------------------------------------------- a verificação

describe("verificação da assinatura", () => {
  const perfilBase = {
    documento: "perfil-portatil-unooria" as const,
    versao: 1,
    emitidoEm: "2026-08-01T10:00:00.000Z",
    emissor: { contrato: "outra-rede", hub: "https://hub.outra.gov.br", nome: null },
    titular: { cpf: "700.100.200-39", nome: "Ana" },
    trajetoria: { escolas: [], turmas: [] },
    participacoes: [],
    resultados: [],
  };

  test("sem emissores configurados, nada é verificado — e isso é dito, não escondido", async () => {
    const v = await verificarAssinatura(perfilBase, "a.b.c", undefined);
    expect(v.estado).toBe("nao-verificada");
    expect(v).toHaveProperty("motivo", expect.stringContaining("PORTABILIDADE_EMISSORES"));
  });

  test("emissor fora da allowlist não é buscado: o hub vem de dentro do arquivo", async () => {
    const v = await verificarAssinatura(perfilBase, "a.b.c", "https://hub.conhecida.gov.br");
    expect(v.estado).toBe("nao-verificada");
    expect(v).toHaveProperty("motivo", expect.stringContaining("não está entre os emissores"));
  });

  /**
   * O CAMINHO CRIPTOGRÁFICO — a única parte do recurso onde errar em silêncio
   * seria grave. As chaves vêm de um resolvedor local em vez do JWKS remoto: em
   * dev o hub é http, e a regra de só buscar JWKS por https (que não se
   * afrouxa) deixaria esta garantia sem teste nenhum.
   */
  describe("com a chave do emissor em mãos", () => {
    const EMISSOR = "https://hub.outra.gov.br";
    const perfil = { ...perfilBase, emissor: { ...perfilBase.emissor, hub: EMISSOR } };
    let assinar: (hash: string) => Promise<string>;
    let chaves: ResolvedorDeChaves;
    let outraChave: ResolvedorDeChaves;

    beforeAll(async () => {
      const par = await generateKeyPair("RS256");
      const outroPar = await generateKeyPair("RS256");
      assinar = (hash) =>
        new SignJWT({ hash })
          .setProtectedHeader({ alg: "RS256" })
          .setIssuer(EMISSOR)
          .setAudience("perfil-portatil")
          .setIssuedAt()
          .sign(par.privateKey);
      chaves = () => (async () => par.publicKey) as never;
      outraChave = () => (async () => outroPar.publicKey) as never;
    });

    test("documento íntegro e assinado: VERIFICADA", async () => {
      const jws = await assinar(hashDoPerfil(perfil));
      expect(await verificarAssinatura(perfil, jws, EMISSOR, chaves)).toEqual({
        estado: "verificada",
      });
    });

    test("um byte trocado no documento: INVÁLIDA, e a importação recusa", async () => {
      const jws = await assinar(hashDoPerfil(perfil));
      const adulterado = { ...perfil, titular: { ...perfil.titular, nome: "Outra Criança" } };
      const v = await verificarAssinatura(adulterado, jws, EMISSOR, chaves);
      expect(v.estado).toBe("invalida");
      expect(v).toHaveProperty("motivo", expect.stringContaining("não corresponde"));
    });

    /* Este teste pegou um bug de verdade: a classificação olhava o TEXTO do erro
       e a palavra "failed" da mensagem "signature verification failed" caía na
       regra de erro de rede — documento forjado entraria marcado "não deu para
       conferir" em vez de recusado. Hoje a classificação é pelo `code`. */
    test("assinado por outra chave: INVÁLIDA, e não 'não deu para conferir'", async () => {
      const jws = await assinar(hashDoPerfil(perfil));
      expect((await verificarAssinatura(perfil, jws, EMISSOR, outraChave)).estado).toBe("invalida");
    });

    test("assinatura de token de EXPERIÊNCIA não vale como perfil: `aud` separa os usos", async () => {
      const par = await generateKeyPair("RS256");
      const deOutroUso = await new SignJWT({ hash: hashDoPerfil(perfil) })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuer(EMISSOR)
        .setAudience("plataforma-api")
        .setIssuedAt()
        .sign(par.privateKey);
      const v = await verificarAssinatura(
        perfil,
        deOutroUso,
        EMISSOR,
        () => (async () => par.publicKey) as never,
      );
      expect(v.estado).toBe("invalida");
    });
  });

  test("emissor em http não é verificável: chave pública por canal reescrevível não prova nada", async () => {
    const v = await verificarAssinatura(
      { ...perfilBase, emissor: { ...perfilBase.emissor, hub: "http://hub.outra.gov.br" } },
      "a.b.c",
      "http://hub.outra.gov.br",
    );
    expect(v.estado).toBe("nao-verificada");
    expect(v).toHaveProperty("motivo", expect.stringContaining("https"));
  });
});

// -------------------------------------------------------------- a importação

describe("importar um documento", () => {
  function arquivoDe(over: Record<string, unknown> = {}) {
    return {
      perfil: {
        documento: "perfil-portatil-unooria",
        versao: 1,
        emitidoEm: "2026-07-01T10:00:00.000Z",
        emissor: { contrato: "rede-municipal-x", hub: "https://hub.municipal.gov.br", nome: "Rede X" },
        titular: { cpf: "700.100.200-39", nome: "Ana Portátil da Silva" },
        trajetoria: {
          escolas: [
            {
              nome: "EM Outra Rede",
              municipio: "Campinas",
              uf: "SP",
              entrada: "2025-02-01T00:00:00.000Z",
              saida: "2026-06-30T00:00:00.000Z",
            },
          ],
          turmas: [],
        },
        participacoes: [],
        resultados: [],
        ...over,
      },
      assinatura: "cabecalho.carga.assinatura",
    } as never;
  }

  test("entra marcado NÃO VERIFICADO quando não há como falar com o emissor", async () => {
    const r = await portabilidade.importar(ESCOLA_DESTINO, arquivoDe(), gestorId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.perfil.verificacao).toBe("nao-verificada");
    expect(r.perfil.emissor).toBe("rede-municipal-x");
    expect(r.perfil.escolas).toBe(1);
  });

  test("o documento fica na tabela dele e NÃO vira lotação, matrícula nem progresso", async () => {
    const lotacoes = await prisma.lotacao.count({
      where: { usuarioId: alunoId, escolaId: ESCOLA_DESTINO },
    });
    const matriculas = await prisma.matricula.count({ where: { usuarioId: alunoId } });
    const progresso = await prisma.progresso.count({ where: { alunoId } });
    expect(lotacoes).toBe(0);
    expect(matriculas).toBe(1); // só a daqui, criada no beforeAll
    expect(progresso).toBe(0);
  });

  test("reimportar o mesmo documento não cria uma segunda medida", async () => {
    await portabilidade.importar(ESCOLA_DESTINO, arquivoDe(), gestorId);
    const recebidos = await portabilidade.recebidos(ESCOLA_DESTINO, alunoId);
    expect(recebidos).toHaveLength(1);
  });

  test("documento de versão desconhecida é recusado em vez de meia-lido", async () => {
    const r = await portabilidade.importar(ESCOLA_DESTINO, arquivoDe({ versao: 99 }), gestorId);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toBe("versao-nao-suportada");
  });

  test("CPF que não existe nesta rede: matricule a criança primeiro", async () => {
    const r = await portabilidade.importar(
      ESCOLA_DESTINO,
      arquivoDe({ titular: { cpf: "700.100.202-09", nome: "Ninguém" } }),
      gestorId,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toBe("titular-desconhecido");
  });

  test("arquivo que não é um perfil é recusado com o campo que faltou", async () => {
    const r = await portabilidade.importar(
      ESCOLA_DESTINO,
      { perfil: { documento: "outra-coisa" }, assinatura: "x".repeat(30) } as never,
      gestorId,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toBe("documento-invalido");
  });

  test("o perfil recebido é da ESCOLA que recebeu — a outra não o enxerga", async () => {
    expect(await portabilidade.recebidos(ESCOLA_DESTINO, alunoId)).toHaveLength(1);
    expect(await portabilidade.recebidos(ESCOLA, alunoId)).toHaveLength(0);
  });

  test("apagar tira o documento de fora e não toca em nada medido aqui", async () => {
    const [recebido] = await portabilidade.recebidos(ESCOLA_DESTINO, alunoId);
    expect(recebido).toBeDefined();
    expect(await portabilidade.remover(ESCOLA_DESTINO, recebido!.id)).toBe(true);
    expect(await portabilidade.recebidos(ESCOLA_DESTINO, alunoId)).toHaveLength(0);
    expect(await prisma.user.count({ where: { id: alunoId } })).toBe(1);
  });
});

describe("nome do arquivo", () => {
  test("é legível por quem recebe por e-mail", () => {
    expect(nomeDoArquivo("Ana Portátil da Silva", new Date("2026-08-28T10:00:00Z"))).toBe(
      "perfil-ana-portatil-da-silva-2026-08-28.json",
    );
  });
});

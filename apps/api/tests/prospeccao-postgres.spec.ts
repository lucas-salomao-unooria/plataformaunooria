import { PrismaClient } from "@prisma/client";
import { ROLES_KEY } from "../src/auth/roles";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEXTO_DO_CONSENTIMENTO } from "../src/prospeccao/contrato-de-rotas";
import { ProspeccaoPublicoController } from "../src/prospeccao/prospeccao-publico.controller";
import { ProspeccaoController } from "../src/prospeccao/prospeccao.controller";

/**
 * O CADASTRO DE INTERESSE (ADR-107): o que o site público escreve, o que a api
 * recusa, e o que o painel da Unooria lê.
 *
 * A suíte escreve em `prospeccao_leads`, que é tabela SEM tenant — não há
 * `escola_id` para isolar uma corrida da outra (ver a migration). O isolamento
 * é pelo E-MAIL: tudo que ela cria termina em `@suite-prospeccao.invalid`
 * (domínio reservado pela RFC 2606, então nunca colide com cadastro real), e o
 * `afterEach` apaga exatamente esse recorte. Uma corrida abortada no meio não
 * deixa lixo que a tela mostre como cadastro de gente.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const DOMINIO = "@suite-prospeccao.invalid";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const publico = new ProspeccaoPublicoController(prisma);
const painel = new ProspeccaoController(prisma);

/** O IP é chave de cota: um por teste, senão o segundo cadastro bate no teto. */
let contadorDeIp = 0;
const deOutroIp = () => ({ headers: { "x-forwarded-for": `203.0.113.${++contadorDeIp}` } });

const cadastro = (email: string, extra: Record<string, unknown> = {}) => ({
  nome: "Marta Ribeiro",
  email,
  telefone: "(11) 98888-7777",
  organizacao: "Secretaria Municipal de Educação",
  cargo: "Gestão de rede ou secretaria",
  consentimento: true,
  ...extra,
});

async function limpar() {
  await prisma.prospeccaoLead.deleteMany({ where: { email: { endsWith: DOMINIO } } });
}

beforeAll(limpar);
afterEach(limpar);
afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("a escrita, que é pública", () => {
  it("grava o cadastro com a FRASE do consentimento, não com um booleano", async () => {
    await publico.cadastrar(cadastro(`marta${DOMINIO}`), deOutroIp());

    const linha = await prisma.prospeccaoLead.findFirstOrThrow({ where: { email: `marta${DOMINIO}` } });
    expect(linha.nome).toBe("Marta Ribeiro");
    expect(linha.organizacao).toBe("Secretaria Municipal de Educação");
    /* O que prova o aceite não é `true`: é a que a pessoa disse sim. */
    expect(linha.consentimentoTexto).toBe(TEXTO_DO_CONSENTIMENTO);
  });

  it("guarda o e-mail em minúsculas — é a chave do dedupe", async () => {
    await publico.cadastrar(cadastro(`Diretoria.Geral${DOMINIO}`), deOutroIp());

    const linha = await prisma.prospeccaoLead.findFirstOrThrow({ where: { email: { endsWith: DOMINIO } } });
    expect(linha.email).toBe(`diretoria.geral${DOMINIO}`);
  });

  it("recusa o corpo sem consentimento — sem aceite não há base legal", async () => {
    await expect(
      publico.cadastrar(cadastro(`sem-aceite${DOMINIO}`, { consentimento: false }), deOutroIp()),
    ).rejects.toMatchObject({ status: 400 });

    expect(await prisma.prospeccaoLead.count({ where: { email: { endsWith: DOMINIO } } })).toBe(0);
  });

  it("recusa e-mail que não é e-mail", async () => {
    await expect(publico.cadastrar(cadastro("marta-arroba-nada"), deOutroIp())).rejects.toMatchObject({ status: 400 });
  });

  it("aceita em silêncio e NÃO grava quando a armadilha vem preenchida", async () => {
    const resposta = await publico.cadastrar(cadastro(`robo${DOMINIO}`, { website: "https://spam.example" }), deOutroIp());

    /* 201, e não 400: o erro ensinaria o robô a tentar de novo sem o campo. */
    expect(resposta).toEqual({ recebido: true });
    expect(await prisma.prospeccaoLead.count({ where: { email: { endsWith: DOMINIO } } })).toBe(0);
  });

  it("não duplica o mesmo e-mail dentro da janela — e não conta isso a quem enviou", async () => {
    const primeira = await publico.cadastrar(cadastro(`repetida${DOMINIO}`), deOutroIp());
    const segunda = await publico.cadastrar(cadastro(`repetida${DOMINIO}`), deOutroIp());

    /* As DUAS respostas são iguais: uma resposta diferente para o e-mail que já
       existe transformaria a rota num verificador de quem se cadastrou. */
    expect(segunda).toEqual(primeira);
    expect(await prisma.prospeccaoLead.count({ where: { email: `repetida${DOMINIO}` } })).toBe(1);
  });

  it("recusa o excesso do MESMO IP, e o IP seguinte continua passando", async () => {
    const mesmoIp = { headers: { "x-forwarded-for": "203.0.113.250" } };
    for (let i = 0; i < 5; i++) {
      await publico.cadastrar(cadastro(`cota${i}${DOMINIO}`), mesmoIp);
    }
    await expect(publico.cadastrar(cadastro(`cota-demais${DOMINIO}`), mesmoIp)).rejects.toMatchObject({ status: 429 });

    /* A cota é POR IP: a escola inteira atrás de um NAT não pode ser calada
       porque um robô gastou a cota de outro endereço. */
    await expect(publico.cadastrar(cadastro(`outro-ip${DOMINIO}`), deOutroIp())).resolves.toEqual({ recebido: true });
  });
});

describe("a leitura, que é só do admin", () => {
  it("lista do mais novo para o mais antigo, e conta o total", async () => {
    await publico.cadastrar(cadastro(`antiga${DOMINIO}`, { nome: "Antiga" }), deOutroIp());
    await publico.cadastrar(cadastro(`nova${DOMINIO}`, { nome: "Nova" }), deOutroIp());
    await prisma.prospeccaoLead.updateMany({
      where: { email: `antiga${DOMINIO}` },
      data: { criadoEm: new Date("2026-01-01T12:00:00Z") },
    });

    const { cadastros, total } = await painel.cadastros();
    const daSuite = cadastros.filter((c) => c.email.endsWith(DOMINIO));
    expect(daSuite.map((c) => c.nome)).toEqual(["Nova", "Antiga"]);
    expect(total).toBeGreaterThanOrEqual(2);
    /* ISO na resposta: quem formata é a tela, no fuso da plataforma (ADR-98/99). */
    expect(daSuite[0]!.criadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("o CSV sai com BOM, ponto-e-vírgula e todo campo entre aspas", async () => {
    await publico.cadastrar(cadastro(`csv${DOMINIO}`, { organizacao: 'Rede "Modelo"; Diretoria' }), deOutroIp());

    const cabecalhos: Record<string, string> = {};
    const csv = await painel.exportacao({ setHeader: (n, v) => { cabecalhos[n] = v; } });

    expect(cabecalhos["content-type"]).toBe("text/csv; charset=utf-8");
    expect(cabecalhos["content-disposition"]).toContain("cadastros-de-interesse.csv");
    /* O BOM é o que faz o Excel em português abrir os acentos certos. */
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Data";"Nome";"E-mail";"Telefone";"Organização";"Cargo"');
    /* Aspas internas DOBRADAS e o `;` do valor preso dentro do campo: sem isso
       a linha inteira se desloca uma coluna e nada acusa. */
    expect(csv).toContain('"Rede ""Modelo""; Diretoria"');
  });

  it("elimina um cadastro a pedido do titular, e só ele (H10.5.2)", async () => {
    await publico.cadastrar(cadastro(`fica${DOMINIO}`, { nome: "Fica" }), deOutroIp());
    await publico.cadastrar(cadastro(`sai${DOMINIO}`, { nome: "Sai" }), deOutroIp());
    const antes = (await painel.cadastros()).cadastros.filter((c) => c.email.endsWith(DOMINIO));
    const alvo = antes.find((c) => c.nome === "Sai")!;
    expect(alvo.id).toMatch(/^[0-9a-f-]{36}$/);

    const admin = { auth: { usuarioId: "admin-da-suite" } } as never;
    await painel.eliminar(alvo.id, admin);

    /* Apagado de verdade, não marcado: o contato some da base. */
    expect(await prisma.prospeccaoLead.count({ where: { email: `sai${DOMINIO}` } })).toBe(0);
    expect(await prisma.prospeccaoLead.count({ where: { email: `fica${DOMINIO}` } })).toBe(1);

    /* De novo, ou um id que não é uuid: 404, nunca 500. */
    await expect(painel.eliminar(alvo.id, admin)).rejects.toMatchObject({ status: 404 });
    await expect(painel.eliminar("nao-e-uuid", admin)).rejects.toMatchObject({ status: 404 });
  });

  it("a leitura é `admin`, e a escrita não tem papel nenhum", () => {
    expect(Reflect.getMetadata(ROLES_KEY, ProspeccaoController)).toEqual(["admin"]);
    /* A rota do site é pública POR DESENHO — o dia em que alguém puser um papel
       aqui, o formulário para de aceitar cadastro e ninguém vê. */
    expect(Reflect.getMetadata(ROLES_KEY, ProspeccaoPublicoController)).toBeUndefined();
    expect(Reflect.getMetadata("__guards__", ProspeccaoPublicoController)).toBeUndefined();
  });
});

import { HttpException } from "@nestjs/common";

import { ErroDeGeracao } from "../src/ai/provider";
import { GeracaoController } from "../src/geracao/geracao.controller";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import type { GeracaoService } from "../src/geracao/geracao.service";
import { contextoDeTeste, prisma } from "./motor-fixture-db";

const ctx = contextoDeTeste("teste-destilar-ia-fora");

/**
 * Regressão de `POST /atividades/:id/destilar` quando o provedor de IA falha.
 *
 * A destilação é o único dos quatro consumidores de `generateJson` SEM
 * fallback: as reações ao vivo caem em lista vazia, a geração de posts vira job
 * falho que o painel mostra, e as personas idem. Aqui não há o que degradar —
 * sem os dois lados não existe atividade.
 *
 * Antes, a exceção subia e o Nest devolvia
 * `{"statusCode":500,"message":"Internal server error"}`. Nem o log salvava: o
 * `ErroDeGeracao` guarda a causa em `detalhe`, e o `ExceptionsHandler` do Nest
 * só imprime a `message`. Com `AI_PROVIDER=mock` — o modo que existe para subir
 * sem GCP — `generateJson` lança SEMPRE, então criar atividade era impossível e
 * nada dizia por quê; a resposta só apareceu num `ps eww` do processo da api.
 *
 * O teste instancia o controller à mão em vez de subir o módulo do Nest: o que
 * está sob teste é a tradução da falha em resposta HTTP, e um `GeracaoService`
 * dublado que lança é a forma mais direta de provocá-la.
 */
describe("destilar quando o provedor de IA não responde", () => {
  let activityId = "";
  let professorId = "";
  let antagonismoAntes: unknown = null;
  let perguntaAntes = "";

  const requisicao = () => ({
    auth: { usuarioId: professorId, escolaId: ctx.escolaId } as never,
  });

  /**
   * Chama a rota DENTRO do contexto de tenancy.
   *
   * Em produção quem o estabelece é o `TenancyInterceptor`, e o
   * `comTenancy` do PrismaService recusa rodar sem ele — a mesma trava que
   * impede uma query escapar do `escola_id`. Sem este embrulho, o teste
   * receberia o erro da trava em vez do erro que ele quer observar.
   */
  const destilar = (controller: GeracaoController) =>
    comEscolaNoContexto(ctx.escolaId, () =>
      controller
        .destilar(activityId, {}, requisicao())
        .then(() => null)
        .catch((falha: unknown) => falha),
    );

  /** Um `GeracaoService` que só sabe falhar do jeito pedido. */
  const servicoQueFalha = (falha: Error) =>
    ({
      destilar: async () => {
        throw falha;
      },
    }) as unknown as GeracaoService;

  beforeAll(async () => {
    await ctx.limpar();
    const fixture = await ctx.criar({ posts: 1 });
    activityId = fixture.atividade.id;
    professorId = fixture.professor.id;
    /* A rota recusa atividade que já passou da análise (409). O fixture nasce
       pronta para revisão, então voltamos ao estado em que o professor está. */
    await prisma.activity.update({ where: { id: activityId }, data: { status: "rascunho" } });

    const antes = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { antagonismo: true, perguntaChave: true },
    });
    antagonismoAntes = antes?.antagonismo ?? null;
    perguntaAntes = antes?.perguntaChave ?? "";
  });

  afterAll(async () => {
    await ctx.limpar();
    await prisma.$disconnect();
  });

  it("responde 503, e não 500 — o pedido está certo, a dependência é que falhou", async () => {
    const controller = new GeracaoController(
      prisma,
      servicoQueFalha(new ErroDeGeracao("Falha ao gerar conteúdo estruturado.", "[mock] sem implementação")),
    );

    const erro = await destilar(controller);

    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(503);
  });

  it("a mensagem carrega a CAUSA do provedor, que o log do Nest engole", async () => {
    const controller = new GeracaoController(
      prisma,
      servicoQueFalha(
        new ErroDeGeracao("Falha ao gerar conteúdo estruturado.", "[mock] generateJson sem implementação"),
      ),
    );

    const erro = (await destilar(controller)) as HttpException;

    const corpo = erro.getResponse() as { mensagem: string };
    expect(corpo.mensagem).toContain("não pôde ser gerada");
    /* É esta parte que resolve o diagnóstico na hora: sem ela, quem roda em
       `AI_PROVIDER=mock` vê um erro genérico e vai procurar no lugar errado. */
    expect(corpo.mensagem).toContain("[mock] generateJson sem implementação");
  });

  it("um ErroDeGeracao SÓ com message (o caso do mock) também entrega a causa", async () => {
    /* O `MockProvider` diz tudo na `message` e não preenche `detalhe`. Ler só o
       `detalhe` deixaria sem diagnóstico exatamente o modo em que a falha é
       garantida — e foi ele que custou a tarde de investigação. */
    const controller = new GeracaoController(
      prisma,
      servicoQueFalha(new ErroDeGeracao("[mock] generateJson sem implementação — nada será exibido.")),
    );

    const erro = (await destilar(controller)) as HttpException;

    const corpo = erro.getResponse() as { mensagem: string };
    expect(erro.getStatus()).toBe(503);
    expect(corpo.mensagem).toContain("[mock] generateJson sem implementação");
  });

  it("uma falha que NÃO é do provedor vira 503 legível, sem parêntese vazio", async () => {
    const controller = new GeracaoController(prisma, servicoQueFalha(new Error("timeout de rede")));

    const erro = (await destilar(controller)) as HttpException;

    const corpo = erro.getResponse() as { mensagem: string };
    expect(erro.getStatus()).toBe(503);
    expect(corpo.mensagem).toBe(
      "A análise da pergunta não pôde ser gerada agora. Tente de novo em instantes.",
    );
  });

  it("a atividade continua em rascunho — nada foi gravado pela metade", async () => {
    const controller = new GeracaoController(
      prisma,
      servicoQueFalha(new ErroDeGeracao("Falha ao gerar conteúdo estruturado.")),
    );
    await destilar(controller);

    const atividade = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { status: true, antagonismo: true, perguntaChave: true },
    });
    /* O fixture nasce com antagonismo (ele simula uma atividade já analisada),
       então o que se cobra aqui é que a falha não moveu NADA: nem o status para
       `antagonismo`, nem a pergunta-chave para uma proposta que não existe. */
    expect(atividade?.status).toBe("rascunho");
    expect(atividade?.antagonismo).toEqual(antagonismoAntes);
    expect(atividade?.perguntaChave).toBe(perguntaAntes);
  });
});

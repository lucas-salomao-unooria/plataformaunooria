import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { cadeiaDaEscola } from "../comum/disponibilidade";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { PRODUTOS, ProdutoSchema, RecursoIdSchema, partesDoRecurso } from "./catalogo";
import {
  DefinirDisponibilidadeSchema,
  ExcecaoRemovidaSchema,
  PainelSchema,
  RecursoAlteradoSchema,
} from "./contrato-de-rotas";
import {
  linhasLegiveis,
  resolverExperiencia,
  resolverProduto,
  type Efetivo,
  type LinhaDeDisponibilidade,
} from "./regras";

/**
 * O PAINEL DA UNOORIA (ADR-87 + ADR-88) — ligar, desligar e ver o que vale.
 *
 * `@Roles("admin")` e nada mais, e esta é a PRIMEIRA capacidade que `admin` tem
 * e `gestor_contrato` não: ligar e desligar produto é decisão da fornecedora,
 * não de quem administra o contrato do lado do cliente. Um `gestor_contrato` que
 * pode LIGAR passa a ter acesso a produto que a rede não contratou.
 *
 * Controller separado do de leitura, e não um `@Roles` misto com exceção por
 * método: é a mesma razão do unooGPT e da Vila — `@Roles` misto é como uma rota
 * acaba aberta para quem não devia sem ninguém notar.
 */
@Controller("recursos")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class RecursosAdminController {
  constructor(private readonly prisma: PrismaService) {}

  /** As linhas que valem numa cadeia, já filtradas do que é ilegível. */
  private async linhas(cadeia: readonly string[]): Promise<LinhaDeDisponibilidade[]> {
    const brutas = await this.prisma.disponibilidade.findMany({
      where: { OR: [{ escolaId: null }, { escolaId: { in: [...cadeia] } }] },
      select: { recursoId: true, escolaId: true, ligado: true, versaoFixa: true, motivo: true },
    });
    return linhasLegiveis(brutas);
  }

  /**
   * Traduz o `Efetivo` do resolvedor no que a TELA precisa saber.
   *
   * `origem` existe porque `decididoEm: undefined` (ninguém decidiu) não
   * atravessa JSON — e a distinção entre "ninguém mexeu", "vem do contrato",
   * "herdado de um escopo acima" e "decidido AQUI" é justamente o que permite à
   * tela oferecer o terceiro estado do interruptor.
   */
  private paraATela(efetivo: Efetivo, escopo: string | null) {
    /* A ORDEM IMPORTA, e errá-la é um defeito de leitura: no escopo-CONTRATO
       tanto `escopo` quanto `decididoEm` são nulos, então testar `=== null`
       antes de `=== escopo` faz uma decisão tomada ALI ser lida como
       "vem da rede" — soa herdada de um nível acima que não existe. Visto na
       tela antes de virar teste. */
    const origem =
      efetivo.decididoEm === undefined
        ? "padrao"
        : efetivo.decididoEm === escopo
          ? "aqui"
          : efetivo.decididoEm === null
            ? "contrato"
            : "herdado";
    return {
      ligado: efetivo.ligado,
      origem: origem as "padrao" | "contrato" | "herdado" | "aqui",
      decididoEm: efetivo.decididoEm ?? null,
      motivo: efetivo.motivo ?? null,
    };
  }

  /** O que o interruptor DESTE escopo mostra: há linha aqui, e o que ela diz. */
  private estadoAqui(
    linhas: readonly LinhaDeDisponibilidade[],
    recursoId: string,
    escopo: string | null,
  ): "ligado" | "desligado" | "herda" {
    const aqui = linhas.find((l) => l.recursoId === recursoId && l.escolaId === escopo);
    if (!aqui) return "herda";
    return aqui.ligado ? "ligado" : "desligado";
  }

  @Get("painel")
  @Contrato({
    resumo: "O painel: produtos, experiências e o que vale em cada escopo.",
    descricao:
      "Resolve a cadeia escola → regional → contrato e devolve, por recurso, **o que o interruptor daquele escopo mostra** (`estadoAqui`, três estados) e **o que efetivamente vale** (`efetivo`, com a origem). Sem `?escolaId=`, o escopo é o CONTRATO inteiro.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: PainelSchema,
    notas: [
      "`estadoAqui: herda` é a AUSÊNCIA de linha neste escopo — é o terceiro estado, e sem ele desfazer uma exceção seria impossível.",
      "`tetoDoProduto` marca a experiência que está desligada pelo PRODUTO, não por linha própria: a tela desabilita o interruptor dela e escreve o motivo ao lado, em vez de mostrá-lo ligado.",
      "`versaoAtiva` é a que o hub monta hoje; `versaoFixa` é a fixada NESTE escopo (`null` = segue a ativa).",
    ],
  })
  async painel(@Query("escolaId") escolaIdPedida?: string) {
    const escolaId = escolaIdPedida?.trim() || null;

    let nome = "Rede (contrato inteiro)";
    let tipo: string | null = null;
    if (escolaId) {
      const escola = await this.prisma.escola.findUnique({
        where: { id: escolaId },
        select: { nome: true, tipo: true },
      });
      /* 404 e não 400: o `admin` atravessa escolas, então id inexistente aqui é
         endereço errado, não falta de permissão. */
      if (!escola) throw new NotFoundException({ mensagem: "Escola não encontrada." });
      nome = escola.nome;
      tipo = escola.tipo;
    }

    const cadeia = escolaId ? await cadeiaDaEscola(this.prisma, escolaId) : [];
    const [linhas, experiencias] = await Promise.all([
      this.linhas(cadeia),
      this.prisma.experiencia.findMany({
        select: { expId: true, nome: true, produto: true, versaoAtiva: true },
        orderBy: { expId: "asc" },
      }),
    ]);

    const produtos = PRODUTOS.map((slug) => {
      const recursoDoProdutoId = `produto:${slug}`;
      const efetivoDoProduto = resolverProduto(linhas, slug, cadeia);

      /* As experiências DAQUELE produto, na ordem do catálogo. A composição é
         derivada de `experiencias.produto`: nada aqui lista expIds à mão, e é
         isso que faz a experiência nova aparecer sozinha. */
      const dentro = experiencias
        .filter((e) => e.produto === slug)
        .map((e) => {
          const recursoDaExpId = `experiencia:${e.expId}`;
          const efetivo = resolverExperiencia(linhas, e.expId, slug, cadeia);
          const linhaPropria = linhas.find(
            (l) => l.recursoId === recursoDaExpId && l.escolaId === escolaId,
          );
          return {
            expId: e.expId,
            nome: e.nome,
            estadoAqui: this.estadoAqui(linhas, recursoDaExpId, escolaId),
            efetivo: this.paraATela(efetivo, escolaId),
            tetoDoProduto: efetivo.tetoDoProduto === true,
            versaoAtiva: e.versaoAtiva,
            versaoFixa: linhaPropria?.versaoFixa ?? null,
          };
        });

      return {
        slug,
        estadoAqui: this.estadoAqui(linhas, recursoDoProdutoId, escolaId),
        efetivo: this.paraATela(efetivoDoProduto, escolaId),
        experiencias: dentro,
      };
    });

    return { escopo: { escolaId, nome, tipo }, produtos };
  }

  @Put(":recursoId")
  @Contrato({
    resumo: "Liga ou desliga um recurso num escopo.",
    descricao:
      "Grava a linha de `disponibilidades` daquele (recurso, escopo). Idempotente por `upsert` — o índice único PARCIAL `WHERE escola_id IS NULL` é o que dá idempotência ao escopo-contrato, onde o único composto não bastaria.",
    params: z.object({ recursoId: z.string() }),
    corpo: DefinirDisponibilidadeSchema,
    resposta: RecursoAlteradoSchema,
    notas: [
      "**Desligar exige `motivo`** (Zod aqui, CHECK no banco). `Desligado sem motivo` é o estado que ninguém sabe desfazer meses depois.",
      "`escolaId: null` no corpo é o CONTRATO inteiro — a rede toda. Ele é explícito de propósito: numa querystring, ausente e vazio são indistinguíveis, e desligar a rede não pode acontecer por URL mal montada.",
      "`versao_fixa` não se escreve por aqui: produto não tem versão, e a fixação por escopo é outra rota (fase 3).",
    ],
  })
  async definir(
    @Param("recursoId") recursoIdBruto: string,
    @Body() body: unknown,
    @Req() req: { auth: AuthClaims },
  ) {
    const recursoId = RecursoIdSchema.parse(recursoIdBruto);
    const dados = DefinirDisponibilidadeSchema.parse(body);
    await this.exigirRecursoConhecido(recursoId);
    await this.exigirEscopoExistente(dados.escolaId);

    await this.gravar(recursoId, dados, req.auth.usuarioId);
    const linha = {
      recursoId,
      escolaId: dados.escolaId,
      ligado: dados.ligado,
      motivo: dados.motivo ?? null,
    };

    /* O registro é a resposta a "quem desligou o jogo da rede, e quando?". A
       LINHA é sobrescrita a cada mudança, então sem esta linha de log a pergunta
       não tem histórico nenhum — é o gatilho de reavaliação da ADR-87. `motivo`
       vai no log de propósito: é texto que o operador escreveu sobre o produto,
       não dado de pessoa. */
    logger.info(
      {
        codigo: "recurso-alterado",
        recursoId,
        escopo: dados.escolaId ?? "contrato",
        ligado: dados.ligado,
        motivo: dados.motivo ?? null,
      },
      dados.ligado ? "recurso ligado" : "recurso DESLIGADO",
    );

    return linha;
  }

  @Delete(":recursoId")
  @Contrato({
    resumo: "Remove a exceção de um escopo (volta a herdar).",
    descricao:
      "Apaga a linha daquele (recurso, escopo). É o terceiro estado do interruptor: **herda** não é `ligado` — é a ausência de decisão neste nível, e sem esta rota uma exceção criada por engano seria permanente.",
    params: z.object({ recursoId: z.string() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: ExcecaoRemovidaSchema,
    notas: [
      "Sem `?escolaId=`, remove a linha do CONTRATO.",
      "Remover o que não existe devolve `removida: false` e **não é erro**: o estado final pedido — não haver linha aqui — é o que já valia.",
    ],
  })
  async remover(
    @Param("recursoId") recursoIdBruto: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims },
  ) {
    const recursoId = RecursoIdSchema.parse(recursoIdBruto);
    const escolaId = escolaIdPedida?.trim() || null;

    const { count } = await this.prisma.disponibilidade.deleteMany({
      where: { recursoId, escolaId },
    });

    if (count > 0) {
      logger.info(
        {
          codigo: "recurso-alterado",
          recursoId,
          escopo: escolaId ?? "contrato",
          ligado: null,
          motivo: "exceção removida (volta a herdar)",
        },
        "exceção de disponibilidade removida",
      );
    }
    /* `usuarioId` fica de fora do log da remoção porque a linha some: não há
       coluna onde gravá-lo, e o log já carrega o contexto da requisição. */
    void req;

    return { recursoId, escolaId, removida: count > 0 };
  }

  /**
   * O UPSERT É SQL CRU, e não por preferência: **o `upsert` do Prisma não
   * consegue endereçar a linha de escopo-CONTRATO.**
   *
   * O único composto `(recurso_id, escola_id)` tipa `escolaId` como `string`
   * no `where`, porque um único composto do Postgres não casa `NULL` — é a
   * MESMA limitação que obrigou o índice único PARCIAL da migration a existir.
   * Com `upsert`, o typecheck reprova; forçando o tipo, o Postgres nunca acha a
   * linha e cada clique em "desligar para a rede" tentaria um `INSERT` novo.
   *
   * `ON CONFLICT ... WHERE escola_id IS NULL` infere justamente o índice
   * parcial, e é o que dá idempotência ao escopo-contrato. As duas formas de
   * conflito são dois `ON CONFLICT` distintos porque são dois índices
   * distintos; não há um alvo que sirva aos dois.
   *
   * `atualizado_em` vai na mão: `@updatedAt` é do Prisma, e SQL cru passa por
   * baixo dele. Sem esta linha a coluna congelaria no primeiro INSERT — a
   * armadilha do `created_at` que a `ADR-43` já registrou em outra tabela.
   */
  private async gravar(
    recursoId: string,
    dados: { escolaId: string | null; ligado: boolean; motivo?: string },
    autor: string,
  ): Promise<void> {
    const motivo = dados.motivo ?? null;

    if (dados.escolaId === null) {
      await this.prisma.$executeRaw`
        INSERT INTO disponibilidades (recurso_id, escola_id, ligado, motivo, definido_por)
        VALUES (${recursoId}, NULL, ${dados.ligado}, ${motivo}, ${autor}::uuid)
        ON CONFLICT (recurso_id) WHERE escola_id IS NULL
        DO UPDATE SET ligado = EXCLUDED.ligado,
                      motivo = EXCLUDED.motivo,
                      definido_por = EXCLUDED.definido_por,
                      definido_em = now(),
                      atualizado_em = now()`;
      return;
    }

    await this.prisma.$executeRaw`
      INSERT INTO disponibilidades (recurso_id, escola_id, ligado, motivo, definido_por)
      VALUES (${recursoId}, ${dados.escolaId}, ${dados.ligado}, ${motivo}, ${autor}::uuid)
      ON CONFLICT (recurso_id, escola_id)
      DO UPDATE SET ligado = EXCLUDED.ligado,
                    motivo = EXCLUDED.motivo,
                    definido_por = EXCLUDED.definido_por,
                    definido_em = now(),
                    atualizado_em = now()`;
  }

  /** Recurso fora do catálogo é 400, não linha órfã no banco. */
  private async exigirRecursoConhecido(recursoId: string): Promise<void> {
    const partes = partesDoRecurso(recursoId);
    if (!partes) throw new BadRequestException({ mensagem: "Recurso fora do vocabulário." });

    if (partes.tipo === "produto") {
      if (!ProdutoSchema.safeParse(partes.alvo).success) {
        throw new BadRequestException({ mensagem: `Produto desconhecido: ${partes.alvo}.` });
      }
      return;
    }

    /* Experiência TEM de estar no catálogo. Sem esta checagem, um `expId`
       digitado errado cria uma linha que não desliga nada e aparece no painel
       como uma experiência que não existe — o painel mentindo sobre o produto. */
    const existe = await this.prisma.experiencia.findUnique({
      where: { expId: partes.alvo },
      select: { expId: true },
    });
    if (!existe) {
      throw new BadRequestException({
        mensagem:
          `Experiência ${partes.alvo} não está no catálogo desta instalação. ` +
          "Em desenvolvimento, rode o seed; em produção, ela entra ao ser publicada.",
      });
    }
  }

  /** Escopo tem de ser uma linha de `escolas` (unidade OU regional). */
  private async exigirEscopoExistente(escolaId: string | null): Promise<void> {
    if (!escolaId) return;
    const escola = await this.prisma.escola.findUnique({
      where: { id: escolaId },
      select: { id: true },
    });
    if (!escola) throw new NotFoundException({ mensagem: "Escola não encontrada." });
  }
}

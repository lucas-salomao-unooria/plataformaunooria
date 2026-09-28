import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
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
  AtivarVersaoSchema,
  DefinirDisponibilidadeSchema,
  ExcecaoRemovidaSchema,
  FixarVersaoSchema,
  PainelSchema,
  RecursoAlteradoSchema,
  VersaoAtivadaSchema,
  VersaoFixadaSchema,
  VersoesDaExperienciaSchema,
  ExperienciasArquivadasSchema,
} from "./contrato-de-rotas";
import { ManifestoGuardadoSchema } from "./manifesto-guardado";
import { registrarAuditoria, type AcaoDeAuditoria } from "./auditoria";
import {
  linhasLegiveis,
  resolverExperiencia,
  resolverProduto,
  type Efetivo,
  type LinhaDeDisponibilidade,
} from "./regras";
import { EXP_ID_RE } from "../comum/codigo-da-experiencia";

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

  /**
   * Registra no histórico (ADR-89) SEM poder derrubar a operação.
   *
   * O ato do operador — desligar um produto num incidente — não pode falhar
   * porque o registro não pôde ser escrito. Mas o erro não some: vai ao log com
   * código próprio, que é o que uma métrica de log alcança.
   */
  private async historiar(dados: {
    recursoId: string;
    escolaId: string | null;
    acao: AcaoDeAuditoria;
    versao?: string | null;
    motivo?: string | null;
    autorId: string;
  }): Promise<void> {
    await registrarAuditoria(this.prisma, dados, (erro) => {
      logger.error(
        { codigo: "recurso-auditoria-nao-gravada", recursoId: dados.recursoId, err: erro },
        "a mudança valeu, mas o histórico dela não foi gravado",
      );
    });
  }

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

  @Get("arquivadas")
  @Contrato({
    resumo: "As experiências arquivadas: tiradas do produto sem serem apagadas (ADR-116).",
    descricao:
      "Sai de `experiencias_arquivadas`. Uma experiência é arquivada quando uma missão nova toma o código dela (o código é derivado da série e da unidade, ADR-110): tudo o que era dela ganha o prefixo `backup-` e some da grade, do catálogo e deste painel, com os dados guardados. **Só lista** — ninguém joga uma arquivada, e desarquivar é uma migração.",
    resposta: ExperienciasArquivadasSchema,
    notas: [
      "`turmasGuardadas` e `estudantesGuardados` são a FOTOGRAFIA tirada pela migração que arquivou, não uma recontagem: contar `liberacoes` e `progresso` de todas as escolas atravessaria a RLS.",
      "A ordem é a do arquivamento, da mais recente para a mais antiga.",
    ],
  })
  async arquivadas() {
    const linhas = await this.prisma.experienciaArquivada.findMany({
      orderBy: [{ arquivadaEm: "desc" }, { expId: "asc" }],
    });
    return {
      arquivadas: linhas.map((l) => ({
        expId: l.expId,
        codigoDeOrigem: l.codigoDeOrigem,
        nome: l.nome,
        versao: l.versao,
        series: l.series,
        unidade: l.unidade,
        produto: l.produto,
        motivo: l.motivo,
        turmasGuardadas: l.turmasGuardadas,
        estudantesGuardados: l.estudantesGuardados,
        arquivadaEm: l.arquivadaEm.toISOString(),
      })),
    };
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
    await this.historiar({
      recursoId,
      escolaId: dados.escolaId,
      acao: dados.ligado ? "ligado" : "desligado",
      motivo: dados.motivo ?? null,
      autorId: req.auth.usuarioId,
    });

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
      /* Só historia se APAGOU algo: remover o que não existe é no-op, e uma
         linha de histórico dizendo "voltou a herdar" quando nada mudou faria o
         painel contar uma decisão que ninguém tomou. */
      await this.historiar({
        recursoId,
        escolaId,
        acao: "herdado",
        autorId: req.auth.usuarioId,
      });
    }

    return { recursoId, escolaId, removida: count > 0 };
  }


  /* ======================================================================
     VERSÃO — o histórico, a ativação (rollback) e a fixação por escopo
     ====================================================================== */

  @Get("experiencias/:expId/versoes")
  @Contrato({
    resumo: "As versões publicadas de uma experiência.",
    descricao:
      "Sai de `experiencias_versoes`, que o `PUT /experiencias/:expId` do CI escreve a cada publish (e o seed em desenvolvimento). É a lista do **rollback pela tela** — antes dela, voltar uma versão exigia saber o número anterior de cabeça.",
    params: z.object({ expId: z.string() }),
    resposta: VersoesDaExperienciaSchema,
    notas: [
      "`emRollback` é `true` quando a ativa não é a última publicada. É o estado que a tela tem de dizer: sem ele, o próximo deploy 'conserta' o rollback sem ninguém perceber.",
      "O `manifesto` de cada versão NÃO vem na resposta: ele é insumo da ativação, não informação de tela.",
    ],
  })
  async versoes(@Param("expId") expIdBruto: string) {
    const expId = z.string().regex(EXP_ID_RE).parse(expIdBruto);
    const experiencia = await this.prisma.experiencia.findUnique({
      where: { expId },
      select: { versaoAtiva: true },
    });
    if (!experiencia) throw new NotFoundException({ mensagem: "Experiência não está no catálogo." });

    const linhas = await this.prisma.experienciaVersao.findMany({
      where: { expId },
      select: { versao: true, publicadaEm: true, publicadaPor: true },
      orderBy: { publicadaEm: "desc" },
    });

    return {
      expId,
      versaoAtiva: experiencia.versaoAtiva,
      /* A mais RECENTE por data de publicação, não a maior por semver: o que
         importa é o que o CI publicou por último, e uma correção de 1.1.x
         publicada depois de uma 1.2.0 é o caso real de hotfix. */
      emRollback: linhas.length > 0 && linhas[0]!.versao !== experiencia.versaoAtiva,
      versoes: linhas.map((l) => ({
        versao: l.versao,
        publicadaEm: l.publicadaEm.toISOString(),
        publicadaPor: l.publicadaPor,
        ativa: l.versao === experiencia.versaoAtiva,
      })),
    };
  }

  @Post("experiencias/:expId/ativar")
  @Contrato({
    resumo: "Ativa uma versão para o CONTRATO (o rollback).",
    descricao:
      "Troca `experiencias.versao_ativa` e **restaura o manifesto daquela versão** — `viewport`, `permissoes`, `series`, `unidade`, `produto`. Antes disto, rollback era `publicar-manifesto.mjs --versao x.y.z`, que mandava o número antigo com o manifesto ATUAL do repositório: voltar a versão não voltava as permissões de iframe, e a app-70 reabria sem `allow-pointer-lock` — a criança entrava na Vila e a câmera não girava, sem erro em lugar nenhum.",
    params: z.object({ expId: z.string() }),
    corpo: AtivarVersaoSchema,
    resposta: VersaoAtivadaSchema,
    notas: [
      "**Confere no CDN antes de gravar** (um HEAD no `index.html` da versão). Apontar a rede para uma versão que não subiu é tela branca para todo mundo, e o erro só apareceria quando a primeira criança abrisse a missão.",
      "`conferida: false` = `CDN_EXP_URL` ausente (desenvolvimento). A tela precisa dizer isso: 'ativei sem conferir' e 'ativei e conferi' são garantias diferentes.",
      "Vale para o CONTRATO inteiro. Fixar versão numa escola é `PUT /recursos/experiencias/:expId/versao`.",
    ],
  })
  async ativar(
    @Param("expId") expIdBruto: string,
    @Body() body: unknown,
    @Req() req: { auth: AuthClaims },
  ) {
    const expId = z.string().regex(EXP_ID_RE).parse(expIdBruto);
    const { versao, motivo } = AtivarVersaoSchema.parse(body);

    const guardada = await this.prisma.experienciaVersao.findUnique({
      where: { expId_versao: { expId, versao } },
      select: { manifesto: true },
    });
    /* Versão que a api nunca viu publicar NÃO se ativa. Sem esta recusa, um
       número digitado errado apontaria a rede para um caminho que não existe no
       bucket — e o painel não teria como restaurar o manifesto dela. */
    if (!guardada) {
      throw new BadRequestException({
        mensagem:
          `A versão ${versao} não consta no histórico de ${expId}. ` +
          "Só se ativa o que a api viu ser publicado.",
      });
    }

    const conferida = await this.conferirNoCdn(expId, versao);

    const lido = ManifestoGuardadoSchema.safeParse(guardada.manifesto);
    const experiencia = await this.prisma.experiencia.update({
      where: { expId },
      data: {
        versaoAtiva: versao,
        /* O manifesto daquela versão volta JUNTO. Ilegível (linha antiga, JSON
           de outra época) troca só a versão — degradar assim é melhor que
           recusar o rollback, que é operação de incidente. */
        ...(lido.success
          ? {
              nome: lido.data.nome,
              series: lido.data.series,
              unidade: lido.data.unidade ?? null,
              produto: lido.data.produto ?? null,
              capabilities: lido.data.capabilities,
              viewport: lido.data.viewport ?? undefined,
              publico: lido.data.publico,
              permissoes: lido.data.permissoes,
            }
          : {}),
      },
      select: { versaoAtiva: true },
    });

    logger.info(
      {
        codigo: "recurso-alterado",
        recursoId: `experiencia:${expId}`,
        escopo: "contrato",
        versaoAtiva: versao,
        conferida,
        manifestoRestaurado: lido.success,
        motivo: motivo ?? null,
      },
      "versão ativada",
    );
    await this.historiar({
      recursoId: `experiencia:${expId}`,
      escolaId: null,
      acao: "versao-ativada",
      versao,
      motivo: motivo ?? null,
      autorId: req.auth.usuarioId,
    });

    return {
      expId,
      versaoAtiva: experiencia.versaoAtiva,
      conferida,
      manifestoRestaurado: lido.success,
    };
  }

  @Put("experiencias/:expId/versao")
  @Contrato({
    resumo: "Fixa (ou solta) a versão de uma experiência num escopo.",
    descricao:
      "Grava `disponibilidades.versao_fixa`. É o canário: uma escola roda a versão nova enquanto a rede segue na anterior. `versao: null` solta a fixação e volta a seguir a `versao_ativa`.",
    params: z.object({ expId: z.string() }),
    corpo: FixarVersaoSchema,
    resposta: VersaoFixadaSchema,
    notas: [
      "Fixar num escopo que não tinha linha CRIA a linha como `ligado`. É decisão explícita: quem fixa versão para uma escola está dizendo que a experiência vale ali.",
      "Confere no CDN, como a ativação — e pelo mesmo motivo.",
      "O CHECK do banco recusa `versao_fixa` em linha de `produto:*`: produto não tem bundle, logo não tem versão.",
    ],
  })
  async fixarVersao(
    @Param("expId") expIdBruto: string,
    @Body() body: unknown,
    @Req() req: { auth: AuthClaims },
  ) {
    const expId = z.string().regex(EXP_ID_RE).parse(expIdBruto);
    const { escolaId, versao } = FixarVersaoSchema.parse(body);
    await this.exigirRecursoConhecido(`experiencia:${expId}`);
    await this.exigirEscopoExistente(escolaId);

    const conferida = versao ? await this.conferirNoCdn(expId, versao) : true;
    const recursoId = `experiencia:${expId}`;

    if (versao === null) {
      /* Soltar a fixação NÃO apaga a linha: ela pode carregar um
         `ligado: false` que é decisão à parte. Só o campo da versão sai. */
      await this.prisma.disponibilidade.updateMany({
        where: { recursoId, escolaId },
        data: { versaoFixa: null, definidoPor: req.auth.usuarioId, definidoEm: new Date() },
      });
    } else {
      await this.gravar(
        recursoId,
        { escolaId, ligado: true, versaoFixa: versao },
        req.auth.usuarioId,
      );
    }

    logger.info(
      {
        codigo: "recurso-alterado",
        recursoId,
        escopo: escolaId ?? "contrato",
        versaoFixa: versao,
        conferida,
      },
      versao ? "versão fixada no escopo" : "fixação de versão removida",
    );
    await this.historiar({
      recursoId,
      escolaId,
      acao: versao ? "versao-fixada" : "versao-soltada",
      versao,
      autorId: req.auth.usuarioId,
    });

    return { expId, escolaId, versaoFixa: versao, conferida };
  }

  /**
   * O HEAD no `index.html` da versão — a rede contra o pior erro deste painel.
   *
   * Apontar a rede inteira para uma versão que não subiu ao bucket é tela branca
   * para todo mundo, e o sintoma aparece quando a primeira criança abre a
   * missão, não quando o operador clica. Uma requisição resolve.
   *
   * SEM `CDN_EXP_URL` a conferência é PULADA e a resposta diz isso: em
   * desenvolvimento o hub serve do dev server do Vite e não existe caminho
   * versionado para conferir. Recusar por falta de env deixaria o painel
   * inutilizável em dev.
   *
   * Falha de REDE também devolve `false` — "não deu para conferir" e "conferi e
   * não existe" são a mesma informação para quem decide: o operador vê que
   * ativou sem garantia.
   */
  private async conferirNoCdn(expId: string, versao: string): Promise<boolean> {
    const cdn = process.env.CDN_EXP_URL?.replace(/\/$/, "");
    if (!cdn) return false;
    const url = `${cdn}/${expId}/${versao}/index.html`;
    try {
      const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
      if (!r.ok) {
        logger.warn(
          { codigo: "recurso-versao-inexistente", expId, versao, status: r.status },
          "a versão não foi encontrada no CDN",
        );
      }
      return r.ok;
    } catch (erro) {
      logger.warn(
        { codigo: "recurso-versao-nao-conferida", expId, versao, err: erro },
        "não foi possível conferir a versão no CDN",
      );
      return false;
    }
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
    dados: {
      escolaId: string | null;
      ligado: boolean;
      motivo?: string;
      /* Ausente = NÃO MEXE na fixação de versão da linha. `null` explícito é
         que a solta. Sem essa distinção, ligar/desligar um recurso apagaria
         em silêncio a versão que alguém fixou naquele escopo. */
      versaoFixa?: string | null;
    },
    autor: string,
  ): Promise<void> {
    const motivo = dados.motivo ?? null;
    const mexeNaVersao = dados.versaoFixa !== undefined;
    const versaoFixa = dados.versaoFixa ?? null;

    if (dados.escolaId === null) {
      await this.prisma.$executeRaw`
        INSERT INTO disponibilidades
          (recurso_id, escola_id, ligado, motivo, versao_fixa, definido_por)
        VALUES (${recursoId}, NULL, ${dados.ligado}, ${motivo}, ${versaoFixa}, ${autor}::uuid)
        ON CONFLICT (recurso_id) WHERE escola_id IS NULL
        DO UPDATE SET ligado = EXCLUDED.ligado,
                      motivo = EXCLUDED.motivo,
                      versao_fixa = CASE WHEN ${mexeNaVersao}::boolean
                                         THEN EXCLUDED.versao_fixa
                                         ELSE disponibilidades.versao_fixa END,
                      definido_por = EXCLUDED.definido_por,
                      definido_em = now(),
                      atualizado_em = now()`;
      return;
    }

    await this.prisma.$executeRaw`
      INSERT INTO disponibilidades
        (recurso_id, escola_id, ligado, motivo, versao_fixa, definido_por)
      VALUES (${recursoId}, ${dados.escolaId}, ${dados.ligado}, ${motivo}, ${versaoFixa}, ${autor}::uuid)
      ON CONFLICT (recurso_id, escola_id)
      DO UPDATE SET ligado = EXCLUDED.ligado,
                    motivo = EXCLUDED.motivo,
                    versao_fixa = CASE WHEN ${mexeNaVersao}::boolean
                                       THEN EXCLUDED.versao_fixa
                                       ELSE disponibilidades.versao_fixa END,
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

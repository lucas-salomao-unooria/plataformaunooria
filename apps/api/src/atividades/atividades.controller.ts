import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { AssetsService } from "../assets/assets.service";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { metricasDaAtividade, OCIOSO_ALERTA_MS } from "../analise/metricas";
import {
  CATEGORIAS_NEUTRAS_DEFAULT,
  DIVISOR_TESE,
  ENGINE_CONFIG_DEFAULT,
  MINIMOS_ATIVACAO,
  PERFIS,
  PROPORCOES_DEFAULT,
} from "../comum/insta/defaults";
import { antagonismoSchema } from "../comum/insta/tipos";
import {
  ehEtapaDaTurma,
  ehVoltar,
  faseAoVoltar,
  faseEfetiva,
  type EtapaDaTurma,
  type FaseDaRun,
} from "../comum/insta/etapas";
import { encerrarRun } from "../dossie/computar";
import { arteFallback } from "../geracao/arte-fallback";
import { equilibrioLados } from "../geracao/validacao";
import { atividadeDoProfessor, ehUuid, naoEncontrado } from "../motor/guardas";
import { normalizarEstado } from "../motor/estado";
import { PrismaService } from "../prisma/prisma.service";
import { excluirAtividade, limparDadosDosAlunos } from "./manutencao";
import { Contrato } from "../openapi/contrato";
import {
  AlunoDaAtividadeSchema,
  AtivadaSchema,
  AtivarSchema,
  AtividadeCriadaSchema,
  CriarSchema,
  DetalheDaAtividadeSchema,
  EtapaAtualSchema,
  EtapaMovidaSchema,
  EtapaSchema,
  ExcluidaSchema,
  IaAlternadaSchema,
  IaSchema,
  LimpaSchema,
  ListaDeAtividadesSchema,
  MonitorSchema,
} from "./contrato-de-rotas";

/**
 * Rotas do PROFESSOR sobre a atividade (fora da geração de conteúdo, que vive
 * no GeracaoModule) — porte fiel dos handlers de `app/api/activities/**` do
 * origem. Aqui lado/perfil/domínio PODEM aparecer: é superfície de professor.
 */

type Autenticado = { auth: AuthClaims };

@Controller("atividades")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class AtividadesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  /** Lista do professor — o que a página do hub de produtos consulta. */
  @Get()
  @Contrato({
    resumo: "As atividades DESTE professor.",
    descricao: "Posse por `professor_id` + `escola_id`: atividade é autoral.",
    resposta: ListaDeAtividadesSchema,
  })
  async listar(@Req() req: Autenticado) {
    return this.prisma.comTenancy(async (tx) => {
      const atividades = await tx.activity.findMany({
        where: { professorId: req.auth.usuarioId, escolaId: req.auth.escolaId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          titulo: true,
          disciplina: true,
          recorte: true,
          perguntaChave: true,
          status: true,
          etapa: true,
          createdAt: true,
          _count: { select: { runs: true, posts: true } },
        },
      });
      return {
        atividades: atividades.map((a) => ({
          id: a.id,
          titulo: a.titulo,
          disciplina: a.disciplina,
          recorte: a.recorte,
          perguntaChave: a.perguntaChave,
          status: a.status,
          etapa: a.etapa,
          criadoEm: a.createdAt,
          alunos: a._count.runs,
          /** Sinônimo de `alunos` (1 run = 1 aluno na atividade) — as telas
           *  portadas usam os dois nomes; manter ambos evita drift no port. */
          sessoes: a._count.runs,
          posts: a._count.posts,
        })),
      };
    });
  }

  /** Detalhe — o que a página da atividade carregava com prisma no origem. */
  @Get(":id")
  @Contrato({
    resumo: "O detalhe de uma atividade.",
    descricao:
      "`_count` espelha o `select` do Prisma da página de origem — o porte dos painéis consome exatamente esse shape —, e os agregados nomeados (`alunos`, `postsAprovados`) ficam junto.",
    params: z.object({ id: z.string().uuid() }),
    resposta: DetalheDaAtividadeSchema,
  })
  async detalhe(@Param("id") id: string, @Req() req: Autenticado) {
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();
      const [runs, posts] = await Promise.all([
        tx.run.count({ where: { activityId: id } }),
        tx.post.count({ where: { activityId: id, aprovado: true } }),
      ]);
      // `_count` espelha o select prisma da página origem (o porte dos painéis
      // consome exatamente esse shape); os agregados nomeados ficam junto.
      return {
        atividade: { ...atividade, _count: { runs }, alunos: runs, postsAprovados: posts },
      };
    });
  }

  /** Passo 1: cria a atividade em rascunho com os defaults do motor. */
  @Post()
  @HttpCode(201)
  @Contrato({
    resumo: "Cria a atividade em rascunho, com os defaults do motor.",
    corpo: CriarSchema,
    resposta: AtividadeCriadaSchema,
    status: 201,
    notas: [
      "`qtdPostsTese` precisa ser múltiplo de 8 (2 lados × 4 perfis) para a matriz fechar sem célula quebrada — **recusar é melhor que arredondar em silêncio**. É um `.refine()`, invisível no esquema.",
    ],
  })
  async criar(@Body() body: unknown, @Req() req: Autenticado) {
    const parsed = CriarSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        mensagem: "Confira os campos do formulário.",
        campos: parsed.error.flatten().fieldErrors,
      });
    }
    const dados = parsed.data;

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await tx.activity.create({
        data: {
          escolaId: req.auth.escolaId,
          professorId: req.auth.usuarioId,
          titulo: dados.titulo,
          disciplina: dados.disciplina,
          recorte: dados.recorte,
          temaGeral: dados.temaGeral ?? dados.recorte,
          /**
           * Nasce vazia: a pergunta é gerada pela IA no passo 2 (`/destilar`) e
           * validada pelo professor. `rascunho` = "ainda não tem pergunta".
           */
          perguntaChave: "",
          contextoAula: dados.contextoAula ?? null,
          qtdPostsTese: dados.qtdPostsTese,
          estiloVisual: dados.estiloVisual,
          categoriasNeutras: CATEGORIAS_NEUTRAS_DEFAULT as unknown as string[],
          proporcoes: {
            ...PROPORCOES_DEFAULT,
            neutros: dados.neutros,
          } as unknown as Prisma.InputJsonObject,
          engineConfig: ENGINE_CONFIG_DEFAULT as unknown as Prisma.InputJsonObject,
          status: "rascunho",
        },
        select: { id: true },
      });
      return { id: atividade.id };
    });
  }

  /** Irreversível — a UI exige digitar o título antes de confirmar. */
  @Delete(":id")
  @Contrato({
    resumo: "Exclui a atividade.",
    descricao: "Devolve o título e quantas sessões foram junto — \"pronto\" sem número deixa o professor sem saber se apagou a atividade certa.",
    params: z.object({ id: z.string().uuid() }),
    resposta: ExcluidaSchema,
  })
  async excluir(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const atividade = await this.prisma.comTenancy((tx) =>
      atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId),
    );
    if (!atividade) naoEncontrado();

    const { sessoes } = await excluirAtividade(this.prisma, this.assets, req.auth.escolaId, id);
    return { ok: true, titulo: atividade.titulo, sessoes };
  }

  /** Zera o que a turma produziu, preservando a atividade e os perfis do Ato 1. */
  @Post(":id/limpar")
  @HttpCode(200)
  @Contrato({
    resumo: "Apaga as sessões dos alunos, mantendo a atividade e os posts.",
    descricao: "É o botão de rodar a mesma atividade com outra turma.",
    params: z.object({ id: z.string().uuid() }),
    resposta: LimpaSchema,
  })
  async limpar(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();
      const { sessoes } = await limparDadosDosAlunos(tx, id);
      return { ok: true, sessoes };
    });
  }

  /** Liga/desliga as reações ao vivo — o único conteúdo que ele não revisa antes. */
  @Patch(":id/ia")
  @Contrato({
    resumo: "Liga ou desliga a IA ao vivo durante a aula.",
    params: z.object({ id: z.string().uuid() }),
    corpo: IaSchema,
    resposta: IaAlternadaSchema,
  })
  async ia(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const corpo = IaSchema.safeParse(body);
    if (!corpo.success) throw new BadRequestException({ mensagem: "Valor inválido." });
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();
      await tx.activity.update({ where: { id }, data: { iaAoVivo: corpo.data.ativo } });
      return { ok: true, ativo: corpo.data.ativo };
    });
  }

  /** Checa os mínimos de cobertura e ativa a atividade para a turma. */
  @Post(":id/ativar")
  @HttpCode(200)
  @Contrato({
    resumo: "Ativa a atividade para os alunos entrarem.",
    descricao:
      "Devolve a MATRIZ 2 lados × 4 perfis: é ela que diz se a geração fechou. Célula vazia significa que um perfil de um lado não tem post — e o feed daquele aluno nasceria torto.",
    params: z.object({ id: z.string().uuid() }),
    corpo: AtivarSchema,
    resposta: AtivadaSchema,
    notas: ["`forcar: true` ativa com a matriz incompleta, de propósito — e a resposta devolve `forcado: true` para a tela dizer isso."],
  })
  async ativar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const parsed = AtivarSchema.safeParse(body ?? {});
    const forcar = parsed.success ? parsed.data.forcar : false;

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      const porLado = await tx.post.groupBy({
        by: ["lado"],
        where: { activityId: id, aprovado: true },
        _count: { _all: true },
      });
      const conta = (lado: string) => porLado.find((l) => l.lado === lado)?._count._all ?? 0;
      const aprovados = porLado.reduce((soma, l) => soma + l._count._all, 0);
      const equilibrio = equilibrioLados(conta("A"), conta("B"), MINIMOS_ATIVACAO.toleranciaEquilibrioLados);

      /**
       * Cobertura da matriz: célula (lado, perfil) vazia = o mecanismo do Ato 2
       * simplesmente não acontece para o aluno daquele perfil. Pendência de
       * ativação, não aviso.
       */
      const porCelula = await tx.post.groupBy({
        by: ["lado", "perfil"],
        where: { activityId: id, aprovado: true, lado: { in: ["A", "B"] } },
        _count: { _all: true },
      });
      const contaCelula = (lado: string, perfil: string) =>
        porCelula.find((l) => l.lado === lado && l.perfil === perfil)?._count._all ?? 0;

      const esperadoPorCelula = Math.floor(atividade.qtdPostsTese / DIVISOR_TESE);
      const vazias: string[] = [];
      const rasas: string[] = [];
      for (const lado of ["A", "B"] as const) {
        for (const perfil of PERFIS) {
          const obtido = contaCelula(lado, perfil);
          if (obtido === 0) vazias.push(`${lado}/${perfil}`);
          else if (obtido < esperadoPorCelula * MINIMOS_ATIVACAO.fracaoMinimaPorCelula) {
            rasas.push(`${lado}/${perfil} (${obtido})`);
          }
        }
      }

      const pendencias: string[] = [];
      if (aprovados < MINIMOS_ATIVACAO.postsAprovados) {
        pendencias.push(`${aprovados} posts aprovados — o recomendado é ${MINIMOS_ATIVACAO.postsAprovados}.`);
      }
      if (!equilibrio.ok) {
        pendencias.push(
          `Os lados estão desequilibrados (${conta("A")} × ${conta("B")}); o limite é ${Math.round(
            MINIMOS_ATIVACAO.toleranciaEquilibrioLados * 100,
          )}%.`,
        );
      }
      if (vazias.length > 0) pendencias.push(`Sem nenhum post nestas combinações de lado e perfil: ${vazias.join(", ")}.`);
      if (rasas.length > 0) {
        pendencias.push(
          `Combinações com pouquíssimo conteúdo (menos de ${Math.round(
            MINIMOS_ATIVACAO.fracaoMinimaPorCelula * 100,
          )}% do esperado): ${rasas.join(", ")}.`,
        );
      }

      if (pendencias.length > 0 && !forcar) {
        throw new HttpException({ mensagem: pendencias.join(" "), pendencias }, 422);
      }

      // Uma turma por vez: ativar encerra a atividade ativa anterior do
      // professor, senão `POST /runs` (que pega a mais recente) sequestraria a turma.
      await tx.activity.updateMany({
        where: { professorId: req.auth.usuarioId, escolaId: req.auth.escolaId, status: "ativa", id: { not: id } },
        data: { status: "encerrada" },
      });
      await tx.activity.update({ where: { id }, data: { status: "ativa" } });

      return {
        ok: true,
        aprovados,
        ladoA: conta("A"),
        ladoB: conta("B"),
        matriz: porCelula.map((l) => ({ lado: l.lado, perfil: l.perfil, aprovados: l._count._all })),
        forcado: forcar,
      };
    });
  }

  /**
   * O RELÓGIO DA AULA: o professor move a turma de momento. Escreve a etapa na
   * atividade **e** reconcilia as runs (indo para frente a etapa é PISO;
   * voltando, é TETO). Ao sair da investigação, congela quem ainda não foi
   * congelado (`encerrarRun` idempotente) — sem isso o relatório abria vazio.
   */
  @Post(":id/etapa")
  @HttpCode(200)
  @Contrato({
    resumo: "O RELÓGIO DA AULA: move a turma inteira de momento.",
    descricao:
      "Escreve a etapa na atividade e leva as runs junto. `voltou: true` quando a turma RETROCEDE de etapa.",
    params: z.object({ id: z.string().uuid() }),
    corpo: EtapaSchema,
    resposta: EtapaMovidaSchema,
    notas: ["`foraDoAparelho` conta quem ficou no onboarding: não entrou e não pode ser movido."],
  })
  async moverEtapa(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const corpo = EtapaSchema.safeParse(body ?? {});
    if (!corpo.success) throw new BadRequestException({ mensagem: "Etapa desconhecida." });
    const { etapa } = corpo.data;
    const { usuarioId, escolaId } = req.auth;

    const atividade = await this.prisma.comTenancy((tx) =>
      atividadeDoProfessor(tx, id, usuarioId, escolaId),
    );
    if (!atividade) naoEncontrado();

    const runs = await this.prisma.comTenancy((tx) =>
      tx.run.findMany({
        where: { activityId: id },
        select: { id: true, fase: true, dossier: { select: { runId: true } } },
      }),
    );

    /**
     * Congela a sessão de quem ainda não foi congelado — FORA de uma transação
     * única de propósito: uma sessão sem dados não pode travar a turma inteira
     * (registra e segue), e `encerrarRun` abre a própria transação.
     */
    if (etapa !== "investigacao") {
      const semDossie = runs.filter((run) => !run.dossier && run.fase !== "onboarding");
      for (const run of semDossie) {
        try {
          await encerrarRun(this.prisma, run.id, escolaId);
        } catch (falha) {
          console.error(`[etapa] não deu para congelar a run ${run.id}`, falha);
        }
      }
    }

    return this.prisma.comTenancy(async (tx) => {
      // Relê as fases: `encerrarRun` acabou de mover algumas para `conclusao`.
      const atuais = await tx.run.findMany({
        where: { activityId: id },
        select: { id: true, fase: true, finishedAt: true },
      });

      const voltando = ehVoltar(atividade.etapa as EtapaDaTurma, etapa);

      const porDestino = new Map<FaseDaRun, string[]>();
      for (const run of atuais) {
        const destino = voltando
          ? faseAoVoltar(run.fase as FaseDaRun, etapa, run.finishedAt !== null)
          : faseEfetiva(run.fase as FaseDaRun, etapa);
        if (destino === run.fase) continue;
        porDestino.set(destino, [...(porDestino.get(destino) ?? []), run.id]);
      }

      /** Reconciliação em lote: uma turma de 40 vira ≤9 updateMany, não 40 update. */
      await tx.activity.update({ where: { id }, data: { etapa } });
      for (const [destino, ids] of porDestino) {
        await tx.run.updateMany({ where: { id: { in: ids } }, data: { fase: destino } });
      }

      const movidos = [...porDestino.values()].reduce((soma, ids) => soma + ids.length, 0);
      return {
        ok: true,
        etapa,
        movidos,
        voltou: voltando,
        total: runs.length,
        /** Quem ficou no onboarding: não entrou no aparelho e não pode ser movido. */
        foraDoAparelho: atuais.filter((run) => faseEfetiva(run.fase as FaseDaRun, etapa) === "onboarding").length,
      };
    });
  }

  /** Etapa atual + quantos alunos em cada tela — o painel decide se pode avançar. */
  @Get(":id/etapa")
  @Contrato({
    resumo: "Etapa atual e quantos alunos em cada tela.",
    descricao: "É com isto que o painel decide se dá para avançar a turma.",
    params: z.object({ id: z.string().uuid() }),
    resposta: EtapaAtualSchema,
  })
  async lerEtapa(@Param("id") id: string, @Req() req: Autenticado) {
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      const porFase = await tx.run.groupBy({
        by: ["fase"],
        where: { activityId: id },
        _count: { _all: true },
      });
      const etapa = ehEtapaDaTurma(atividade.etapa) ? atividade.etapa : "investigacao";

      return {
        etapa,
        iaAoVivo: atividade.iaAoVivo,
        porFase: Object.fromEntries(porFase.map((l) => [l.fase, l._count._all])),
        total: porFase.reduce((soma, l) => soma + l._count._all, 0),
      };
    });
  }

  /** Painel da turma ao vivo. `ociosoHaMs` é o único campo que pede AÇÃO. */
  @Get(":id/monitor")
  @Contrato({
    resumo: "O painel da turma ao vivo.",
    descricao:
      "**`ociosoHaMs` é o único campo que pede AÇÃO** — é o número que faz o professor levantar da cadeira. Tudo o mais é retrato.",
    params: z.object({ id: z.string().uuid() }),
    resposta: MonitorSchema,
    notas: [
      "`ladoDominante: \"indefinido\"` sai como `neutro`: o painel não tem coluna para \"ainda não dá para dizer\".",
      "A imersão nunca vem só com o total — os componentes vão junto, e essa é a regra em toda tela.",
    ],
  })
  async monitor(@Param("id") id: string, @Req() req: Autenticado) {
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      const [metricas, dossies] = await Promise.all([
        metricasDaAtividade(tx, id),
        tx.dossier.findMany({ where: { run: { activityId: id } }, select: { runId: true } }),
      ]);
      const comDossie = new Set(dossies.map((registro) => registro.runId));

      const linhas = metricas.map((aluno) => ({
        runId: aluno.runId,
        aluno: {
          username: aluno.aluno.username,
          displayName: aluno.aluno.displayName,
          avatar: null as string | null,
        },
        fase: aluno.fase,
        postsConsumidos: aluno.postsConsumidos,
        blocos: aluno.blocos,
        dominio: aluno.dominio,
        ladoDominante: aluno.ladoDominante === "indefinido" ? "neutro" : aluno.ladoDominante,
        escada: aluno.escada,
        ladoInicial: aluno.bolha.ladoInicial,
        ladoOrigem: aluno.bolha.ladoOrigem,
        inverteu: aluno.bolha.inverteu,
        perfilOrigem: aluno.perfilJogo?.origem ?? "ausente",
        perfilJogo: aluno.perfilJogo?.dominante ?? null,
        concluiu: aluno.conclusao !== null,
        colecao: aluno.colecao,
        imersaoParcial: aluno.imersao.total,
        imersaoComponentes: aluno.imersao.componentes,
        /**
         * Relógio de PAREDE desde o início da sessão — no monitor ao vivo a
         * pergunta é "há quanto tempo esse aluno está nisso?".
         */
        minutos: Math.round(
          ((aluno.encerradaEm ?? new Date()).getTime() - aluno.iniciadaEm.getTime()) / 60_000,
        ),
        minutosDeFeed: Math.round(aluno.tempo.feedMs / 60_000),
        ociosoHaMs: aluno.ociosoHaMs,
        alertaDeOcioso: aluno.ociosoHaMs !== null && aluno.ociosoHaMs >= OCIOSO_ALERTA_MS,
        temDossie: comDossie.has(aluno.runId),
        publicou: aluno.interacoes.publicou,
      }));

      const comLado = linhas.filter((linha) => linha.ladoDominante !== "neutro");
      const naMissao = ["onboarding", "feed", "encerramento", "conclusao"];

      return {
        runs: linhas,
        resumo: {
          total: linhas.length,
          emFeed: linhas.filter((l) => l.fase === "feed").length,
          concluidas: linhas.filter((l) => !naMissao.includes(l.fase)).length,
          ladoA: comLado.filter((l) => l.ladoDominante === "A").length,
          ladoB: comLado.filter((l) => l.ladoDominante === "B").length,
          semLado: linhas.length - comLado.length,
          porLadoInicial: {
            A: linhas.filter((l) => l.ladoInicial === "A").length,
            B: linhas.filter((l) => l.ladoInicial === "B").length,
          },
          porPerfil: linhas.reduce<Record<string, number>>((acumulado, l) => {
            const chave = l.perfilJogo ?? "ausente";
            acumulado[chave] = (acumulado[chave] ?? 0) + 1;
            return acumulado;
          }, {}),
          inverteram: linhas.filter((l) => l.inverteu).length,
          concluiram: linhas.filter((l) => l.concluiu).length,
          ociosos: linhas.filter((l) => l.alertaDeOcioso).length,
          salvosNaTurma: linhas.reduce((soma, l) => soma + l.colecao.total, 0),
          salvosDoOutroLado: linhas.reduce((soma, l) => soma + l.colecao.doOutroLado, 0),
        },
        limiteDeOciosidadeMs: OCIOSO_ALERTA_MS,
      };
    });
  }

  /** Tudo o que UM aluno fez, para o professor ler durante a atividade. */
  @Get(":id/alunos/:runId")
  @Contrato({
    resumo: "Tudo o que UM aluno fez, durante a atividade.",
    descricao:
      "As interações vêm com os **salvos primeiro**: é a coleção que o aluno vai defender no debate.",
    params: z.object({ id: z.string().uuid(), runId: z.string().uuid() }),
    resposta: AlunoDaAtividadeSchema,
    notas: [
      "`doLadoSemeado` é a definição de COERÊNCIA: o post é do lado em que o feed dele nasceu?",
      "`nomeNoApp` é apelido dentro da ficção do Instanooria — nunca identidade em tela de professor ou relatório.",
    ],
  })
  async aluno(@Param("id") id: string, @Param("runId") runId: string, @Req() req: Autenticado) {
    if (!ehUuid(runId)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      const run = await tx.run.findFirst({
        where: { id: runId, activityId: id },
        select: {
          id: true,
          fase: true,
          ladoInicial: true,
          ladoOrigem: true,
          perfilJogo: true,
          perfilOrigem: true,
          nomeNoApp: true,
          avatarEscolhido: true,
          startedAt: true,
          engineState: true,
          aluno: { select: { username: true, displayName: true } },
          conclusao: { select: { inclinacao: true } },
          reflexao: { select: { texto: true } },
          studentPosts: { select: { texto: true, ladoInferido: true, createdAt: true } },
        },
      });
      if (!run) naoEncontrado();

      const [eventos, comentarios] = await Promise.all([
        tx.event.findMany({
          where: {
            runId,
            postId: { not: null },
            tipo: { in: ["salvou", "dessalvou", "curtiu", "descurtiu", "comentou"] },
          },
          select: { postId: true, tipo: true, clientTs: true },
          orderBy: { id: "asc" },
        }),
        tx.comentarioDaSessao.findMany({
          where: { runId },
          select: { postId: true, texto: true, createdAt: true, handle: true, deIa: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      /** Último evento por (post, ação) decide: salvar e dessalvar se anulam. */
      const salvos = new Map<string, boolean>();
      const curtidos = new Map<string, boolean>();
      for (const evento of eventos) {
        if (!evento.postId) continue;
        if (evento.tipo === "salvou") salvos.set(evento.postId, true);
        if (evento.tipo === "dessalvou") salvos.set(evento.postId, false);
        if (evento.tipo === "curtiu") curtidos.set(evento.postId, true);
        if (evento.tipo === "descurtiu") curtidos.set(evento.postId, false);
      }

      /** Só os comentários ancorados em post do banco entram na lista de tocados. */
      const comentadosPorPost = new Map<string, string[]>();
      for (const comentario of comentarios) {
        if (!comentario.postId || comentario.deIa) continue;
        comentadosPorPost.set(comentario.postId, [
          ...(comentadosPorPost.get(comentario.postId) ?? []),
          comentario.texto,
        ]);
      }

      const idsTocados = [
        ...new Set([
          ...[...salvos].filter(([, v]) => v).map(([postId]) => postId),
          ...[...curtidos].filter(([, v]) => v).map(([postId]) => postId),
          ...comentadosPorPost.keys(),
        ]),
      ];

      const posts = await tx.post.findMany({
        where: { id: { in: idsTocados } },
        select: {
          id: true,
          lado: true,
          perfil: true,
          intensidade: true,
          categoria: true,
          caption: true,
          imageUrl: true,
          imageStatus: true,
          author: { select: { handle: true } },
        },
      });

      const antagonismo = antagonismoSchema.safeParse(atividade.antagonismo);
      const rotulo = (lado: string) =>
        lado === "A"
          ? antagonismo.success
            ? antagonismo.data.ladoA.label
            : "Lado A"
          : lado === "B"
            ? antagonismo.success
              ? antagonismo.data.ladoB.label
              : "Lado B"
            : "Outros assuntos";

      const estado = normalizarEstado(run.engineState);
      const dwellPorPost = estado.dwellPorPost;

      const interacoes = posts
        .map((post) => ({
          id: post.id,
          handle: post.author.handle,
          caption: post.caption,
          imageUrl: post.imageStatus === "ok" ? post.imageUrl : null,
          fallbackArt: post.imageStatus === "ok" ? null : arteFallback(post.id, post.categoria),
          lado: post.lado,
          ladoRotulo: rotulo(post.lado),
          perfil: post.perfil,
          intensidade: post.intensidade,
          /** É do lado em que o feed dele nasceu? A definição de coerência. */
          doLadoSemeado: post.lado === run.ladoInicial,
          neutro: post.lado === "neutro",
          salvou: salvos.get(post.id) === true,
          curtiu: curtidos.get(post.id) === true,
          comentarios: comentadosPorPost.get(post.id) ?? [],
          segundos: Math.round(((dwellPorPost[post.id] ?? 0) / 1000) * 10) / 10,
        }))
        // Salvos primeiro: é a coleção que o aluno vai defender no debate.
        .sort((a, b) => Number(b.salvou) - Number(a.salvou) || b.segundos - a.segundos);

      const salvosDoLado = interacoes.filter((p) => p.salvou && p.doLadoSemeado).length;
      const salvosDoOutro = interacoes.filter((p) => p.salvou && !p.doLadoSemeado && !p.neutro).length;
      const salvosNeutros = interacoes.filter((p) => p.salvou && p.neutro).length;

      const perfil = run.perfilJogo as { dominante?: string } | null;

      return {
        aluno: {
          username: run.aluno.username,
          displayName: run.aluno.displayName,
          nomeNoApp: run.nomeNoApp,
          avatar: run.avatarEscolhido,
        },
        sessao: {
          fase: run.fase,
          ladoInicial: run.ladoInicial,
          ladoInicialRotulo: rotulo(run.ladoInicial),
          ladoOrigem: run.ladoOrigem,
          perfilJogo: perfil?.dominante ?? null,
          perfilOrigem: run.perfilOrigem,
          respondeu: run.conclusao?.inclinacao ?? null,
          respondeuRotulo: run.conclusao ? rotulo(run.conclusao.inclinacao) : null,
          reflexao: run.reflexao?.texto ?? null,
          postouNoApp: run.studentPosts[0]?.texto ?? null,
        },
        resumo: {
          salvos: salvosDoLado + salvosDoOutro + salvosNeutros,
          salvosDoLadoSemeado: salvosDoLado,
          salvosDoOutroLado: salvosDoOutro,
          salvosNeutros,
          curtidos: interacoes.filter((p) => p.curtiu).length,
          comentados: interacoes.filter((p) => p.comentarios.length > 0).length,
        },
        interacoes,
      };
    });
  }
}

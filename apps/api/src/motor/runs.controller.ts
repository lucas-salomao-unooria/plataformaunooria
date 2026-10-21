import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { rateLimit } from "../comum/rate-limit";
import { antagonismoSchema } from "../comum/insta/tipos";
import { ehEtapaDaTurma, faseEfetiva, normalizarFase } from "../comum/insta/etapas";
import { DossieAindaNaoExiste, encerrarRun, montarRespostaDossie } from "../dossie/computar";
import { EXP_ID, MINIMO_DA_REFLEXAO } from "../comum/insta/defaults";
import { calcularExposicao } from "../dossie/exposicao";
import { arteFallback } from "../geracao/arte-fallback";
import { gerarReacoes } from "../geracao/prompts/reacoes";
import { resolverLargada } from "../perfis/largada";
import { PrismaService } from "../prisma/prisma.service";
import { LeituraDaReflexaoService, type LeituraAgendada } from "./canal-a/leitura-da-reflexao.service";
import { TarefasDoUnoovista } from "./canal-a/tarefas.service";
import { deveEncerrar } from "./curadoria";
import { estadoInicial, normalizarEstado, semearEstado } from "./estado";
import { dominioDe } from "./eventos";
import {
  ehUuid,
  naoEncontrado,
  ondeAAtividadeVale,
  ORDEM_DA_ATIVIDADE_DO_ESTUDANTE,
  runDoEstudante,
} from "./guardas";
import { textoAlternativoDaImagem } from "../comum/insta/texto-alternativo";
import { paraFeedPost } from "./sanitizador";
import { proximoBlocoDoFeed } from "./servico";
import type { EngineConfig } from "./tipos";
import { Contrato } from "../openapi/contrato";
import {
  BlocoDoFeedSchema,
  BootSchema,
  BuscaSchema,
  ConclusaoGravadaSchema,
  ConclusaoSchema,
  CriarRunSchema,
  DossieSchema,
  EntrarSchema,
  EventosGravadosSchema,
  EventosSchema,
  FaseAtualSchema,
  FaseSchema,
  PerdidosSchema,
  PostDoEstudanteSchema,
  ReacoesGeradasSchema,
  ReacoesSchema,
  ReflexaoGravadaSchema,
  ReflexaoSalvaSchema,
  ReflexaoSchema,
  RunCriadaSchema,
  RunResetadaSchema,
  SalvosSchema,
  StudentPostSchema,
} from "./contrato-de-rotas";

/**
 * Rotas de RUN do estudante (e o reset do professor) — porte fiel dos handlers de
 * `app/api/runs/**` do origem para NestJS. As decisões de produto vivem nos
 * comentários de cada handler do origem; aqui só muda a casca (guards, tenancy
 * explícita por `escola_id` + RLS via comTenancy).
 */

type Autenticado = { auth: AuthClaims };

@Controller("runs")
@UseGuards(OidcGuard, RolesGuard)
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly tarefas: TarefasDoUnoovista,
    private readonly leitura: LeituraDaReflexaoService,
  ) {}

  /** POST /runs — inicia ou retoma a sessão do estudante na atividade ativa. */
  @Post()
  @Roles("estudante")
  @HttpCode(201)
  @Contrato({
    resumo: "Cria a run do estudante na atividade ativa.",
    descricao:
      "A LARGADA: é aqui que o lado do feed é decidido — pelo perfil do Ato 1, por redistribuição do professor, ou por sorteio balanceado quando não há perfil.",
    corpo: CriarRunSchema,
    resposta: RunCriadaSchema,
    status: 201,
  })
  async criar(@Body() body: unknown, @Req() req: Autenticado) {
    const parsed = CriarRunSchema.safeParse(body ?? {});
    const avatar = parsed.success ? parsed.data.avatar : undefined;
    const { usuarioId, escolaId } = req.auth;

    return this.prisma.comTenancy(async (tx) => {
      /* A PORTA DA SALA, antes de qualquer coisa (ADR-69): sem liberação nesta
         turma, a missão não abre. É a checagem que falta ser feita no hub —
         `/exp/:expId` é endereço adivinhável, e sem isto qualquer estudante
         logado começava a missão de qualquer ano digitando a URL. */
      await exigirMissaoLiberada(tx, escolaId, usuarioId, EXP_ID);

      /**
       * A atividade DESTA criança.
       *
       * A busca era só `{ status: "ativa", escolaId }`, e com uma atividade por
       * escola isso bastava. Desde `20260830090000_atividade_por_turma` a
       * atividade pode declarar turma, e aí a da sala do lado não é a dela: o
       * estudante do 8B entrava na atividade do 8A e aparecia no painel de um
       * professor que não é o dele.
       *
       * A turma sai de `users.turma_id` — o CACHE da matrícula principal — e não
       * de `matriculas`, pelo mesmo motivo do login: aqui ainda não há turma no
       * contexto, e `matriculas` tem RLS. A regra de qual atividade vale está em
       * `ondeAAtividadeVale`, compartilhada com o `boot`.
       */
      const estudante = await tx.user.findUnique({
        where: { id: usuarioId },
        select: { turmaId: true },
      });

      const atividade = await tx.activity.findFirst({
        where: ondeAAtividadeVale(escolaId, estudante?.turmaId),
        orderBy: ORDEM_DA_ATIVIDADE_DO_ESTUDANTE,
        select: { id: true, antagonismo: true, engineConfig: true },
      });

      if (!atividade) {
        // Linguagem de app real: nada de "atividade" nem de "professor" aqui.
        throw new HttpException({ mensagem: "Nada rolando por aqui agora. Volta mais tarde." }, 409);
      }

      if (avatar) {
        await tx.user.update({ where: { id: usuarioId }, data: { avatar } });
      }

      const existente = await tx.run.findUnique({
        where: { activityId_estudanteId: { activityId: atividade.id, estudanteId: usuarioId } },
        select: { id: true, fase: true },
      });
      if (existente) return { runId: existente.id, fase: existente.fase };

      /**
       * O lado semeado vem da AFINIDADE do perfil do Ato 1 — não é sorteio.
       * A regra inteira vive em `resolverLargada`, compartilhada com o reset.
       */
      const largada = await resolverLargada(tx, atividade.id, usuarioId, atividade.antagonismo);
      const config = atividade.engineConfig as { sementeInicial?: number };

      const run = await tx.run.create({
        data: {
          escolaId,
          activityId: atividade.id,
          estudanteId: usuarioId,
          fase: "onboarding",
          ladoInicial: largada.ladoInicial,
          ladoOrigem: largada.ladoOrigem,
          perfilJogo: (largada.perfilJogo as Prisma.InputJsonObject) ?? undefined,
          perfilOrigem: largada.perfilOrigem,
          engineState: semearEstado(
            estadoInicial(),
            largada.ladoInicial,
            config.sementeInicial,
            largada.perfilDominante,
          ) as unknown as Prisma.InputJsonObject,
        },
        select: { id: true, fase: true },
      });

      return { runId: run.id, fase: run.fase };
    });
  }

  /**
   * GET /runs/boot — o que o Server Component `tela/page.tsx` resolvia no
   * origem: a experiência (agora estática, Vite) chama isto no primeiro fetch.
   * O servidor decide a fase; o cliente assume dali. Só entram os rótulos dos
   * lados — os ÚNICOS campos do antagonismo que o cliente pode ver antes da
   * revelação.
   */
  @Get("boot")
  @Roles("estudante")
  @Contrato({
    resumo: "O bootstrap do aparelho — o que a tela de entrada precisa saber.",
    descricao:
      "Só os RÓTULOS dos lados — os únicos campos do antagonismo que o cliente pode ver antes da revelação. Zero lado/intensidade dos posts.",
    resposta: BootSchema,
  })
  async boot(@Req() req: Autenticado) {
    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      // A mesma porta do `POST /runs` (ADR-69): o `boot` é o primeiro fetch do
      // aparelho, e sem ele aqui a tela de entrada carregaria a missão inteira
      // antes de descobrir que ela não abre.
      await exigirMissaoLiberada(tx, escolaId, usuarioId, EXP_ID);

      const [estudante, run] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { displayName: true, username: true, avatar: true, turmaId: true },
        }),
        tx.run.findFirst({
          where: { estudanteId: usuarioId, escolaId, activity: { status: "ativa" } },
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            fase: true,
            activity: { select: { perguntaChave: true, antagonismo: true } },
          },
        }),
      ]);

      /* Mesma regra do `POST /runs`: sem ela o estudante lia na tela a pergunta de
         uma atividade e a run nascia em outra. `estudante.turmaId` vem do select
         acima. */
      const atividade =
        run?.activity ??
        (await tx.activity.findFirst({
          where: ondeAAtividadeVale(escolaId, estudante.turmaId),
          orderBy: ORDEM_DA_ATIVIDADE_DO_ESTUDANTE,
          select: { perguntaChave: true, antagonismo: true },
        }));

      const bruto = atividade?.antagonismo as
        | { ladoA?: { label?: string }; ladoB?: { label?: string } }
        | null
        | undefined;

      const dadosEstudante = {
        displayName: estudante.displayName,
        handle: `@${estudante.username}`,
        avatar: estudante.avatar ?? `avatar-${estudante.username.slice(-2)}`,
      };

      return {
        runId: run?.id ?? null,
        fase: run?.fase ?? "onboarding",
        missao: {
          perguntaChave: atividade?.perguntaChave ?? "",
          ladoALabel: bruto?.ladoA?.label ?? "Um lado",
          ladoBLabel: bruto?.ladoB?.label ?? "O outro lado",
        },
        estudante: dadosEstudante,
      };
    });
  }

  /** O estudante entra no aparelho: escolheu avatar, digitou o nome, vai ao feed. */
  @Post(":id/entrar")
  @Contrato({
    resumo: "O estudante entra no aparelho e vai ao feed.",
    descricao: "`nome` é APELIDO dentro da ficção do Instanooria — nunca identidade em tela de professor ou relatório.",
    params: z.object({ id: z.string().uuid() }),
    corpo: EntrarSchema,
    resposta: FaseSchema,
  })
  @Roles("estudante")
  @HttpCode(200)
  async entrar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const corpo = EntrarSchema.safeParse(body ?? {});
    if (!corpo.success) {
      throw new BadRequestException({ mensagem: "Escolhe uma figurinha e escreve seu nome." });
    }

    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();

      /**
       * Só avança quem está no onboarding. Reentrar depois — aparelho que
       * travou, aba fechada — não pode jogar o estudante de volta para o feed se a
       * turma já está no debate.
       */
      const avancou = run.fase === "onboarding";
      await tx.run.update({
        where: { id },
        data: {
          nomeNoApp: corpo.data.nome,
          avatarEscolhido: corpo.data.avatar,
          ...(avancou ? { fase: "feed" } : {}),
        },
      });
      // O avatar também vai para o usuário: é o que a casca e o professor mostram.
      await tx.user.update({ where: { id: req.auth.usuarioId }, data: { avatar: corpo.data.avatar } });

      return { ok: true, fase: avancou ? "feed" : run.fase };
    });
  }

  /** GET /runs/:id/feed — casca HTTP; o motor vive em servico.ts. */
  @Get(":id/feed")
  @Contrato({
    resumo: "O próximo bloco do feed.",
    descricao:
      "O post sai **sem `lado`, sem `perfil` e sem `intensidade`** — o disfarce depende disso: um bundle que soubesse o lado de cada post entregaria o experimento antes da revelação.\n\nO `diagnostico` do motor (domínio, lado dominante, bloco) fica no SERVIDOR.",
    params: z.object({ id: z.string().uuid() }),
    resposta: BlocoDoFeedSchema,
    notas: ["Lock consultivo por run: duas abas pedindo bloco ao mesmo tempo se sobrescreviam, e um bloco se perdia."],
  })
  @Roles("estudante")
  async feed(@Param("id") id: string, @Req() req: Autenticado) {
    const run = await this.prisma.comTenancy((tx) =>
      runDoEstudante(tx, id, req.auth.usuarioId, req.auth.escolaId),
    );
    if (!run) naoEncontrado();

    const { posts, modulos } = await proximoBlocoDoFeed(this.prisma, id, req.auth.escolaId);
    // diagnostico fica no servidor: nada de domínio/lado no bundle do estudante.
    return { posts, modulos };
  }

  /**
   * A tela que o estudante deve estar vendo agora — já reconciliada com a etapa da
   * turma. O cliente faz polling: os momentos coletivos são do PROFESSOR.
   */
  @Get(":id/fase")
  @Roles("estudante")
  @Contrato({
    resumo: "A tela que o estudante deve estar vendo agora.",
    descricao:
      "Já reconciliada com a etapa da TURMA — o cliente faz polling porque os momentos coletivos são do professor, não do estudante.",
    params: z.object({ id: z.string().uuid() }),
    resposta: FaseAtualSchema,
  })
  async fase(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();
      const etapa = ehEtapaDaTurma(run.activity.etapa) ? run.activity.etapa : "investigacao";
      return { fase: faseEfetiva(normalizarFase(run.fase), etapa), etapa };
    });
  }

  /** POST /runs/:id/finish — congela a run, computa o dossiê, fase = conclusao. */
  @Post(":id/finish")
  @Contrato({
    resumo: "Congela a run e computa o dossiê.",
    descricao: "Encerrar antes da hora é **409** — e a mensagem é de app real (\"sua sessão ainda está rolando\"), não de sistema.",
    params: z.object({ id: z.string().uuid() }),
    resposta: FaseSchema,
  })
  @Roles("estudante")
  @HttpCode(200)
  async finish(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;

    const gate = await this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, estudanteId: usuarioId, escolaId },
        select: {
          fase: true,
          startedAt: true,
          engineState: true,
          activity: { select: { engineConfig: true } },
        },
      });
      if (!run) return null;
      /**
       * Só encerra quem já chegou ao fim: o gatilho é do motor, não do cliente.
       * `conclusao` conta como já encerrado — chamar de novo (recarga) não pode
       * derrubar quem está escrevendo.
       */
      const jaEncerrado = ["conclusao", "revelacao", "dossie"].includes(run.fase);
      const noEncerramento = run.fase === "encerramento";
      const gatilho = deveEncerrar(
        normalizarEstado(run.engineState),
        run.activity.engineConfig as unknown as EngineConfig,
        run.startedAt,
      );
      return { pode: jaEncerrado || noEncerramento || gatilho };
    });

    if (!gate) naoEncontrado();
    if (!gate.pode) throw new HttpException({ mensagem: "Sua sessão ainda está rolando." }, 409);

    await encerrarRun(this.prisma, id, escolaId);
    const atual = await this.prisma.comTenancy((tx) =>
      tx.run.findUnique({ where: { id }, select: { fase: true } }),
    );
    return { ok: true, fase: atual?.fase ?? "conclusao" };
  }

  /**
   * POST /runs/:id/reset — zera a sessão para outra turma reusar o aparelho.
   * Só o professor da atividade. Re-resolve a largada (não herda o lado velho).
   */
  @Post(":id/reset")
  @Roles("professor")
  @Contrato({
    resumo: "Reabre a run de um estudante, sorteando a largada de novo.",
    descricao: "Rota de PROFESSOR: é o socorro para a sessão que travou no meio da aula.",
    params: z.object({ id: z.string().uuid() }),
    resposta: RunResetadaSchema,
  })
  @HttpCode(200)
  async reset(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;

    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, escolaId, activity: { professorId: usuarioId } },
        select: {
          id: true,
          estudanteId: true,
          activityId: true,
          activity: { select: { antagonismo: true, engineConfig: true } },
        },
      });
      if (!run) naoEncontrado();

      const largada = await resolverLargada(tx, run.activityId, run.estudanteId, run.activity.antagonismo, {
        ignorarRunAtual: run.id,
      });
      const config = run.activity.engineConfig as { sementeInicial?: number };

      /**
       * Tudo que o estudante PRODUZIU vai embora com a sessão: sobra de dado aqui
       * vira vazamento entre estudantes (comentários e reflexão inclusos — a lição
       * do teste de comentário duplicado do origem).
       */
      await tx.event.deleteMany({ where: { runId: id } });
      await tx.studentPost.deleteMany({ where: { runId: id } });
      await tx.dossier.deleteMany({ where: { runId: id } });
      await tx.conclusao.deleteMany({ where: { runId: id } });
      await tx.reflexao.deleteMany({ where: { runId: id } });
      await tx.comentarioDaSessao.deleteMany({ where: { runId: id } });
      /* As tarefas do Canal A também (ADR-167). A MARCA de evidência e a
         LEITURA da reflexão ficam: vale o primeiro envio, e a IA não lê de
         novo — quem refizer aparece como "refeito após reinício". */
      await tx.tarefaDaSessao.deleteMany({ where: { runId: id } });
      await tx.run.update({
        where: { id },
        data: {
          fase: "onboarding",
          revelacaoConcluidaEm: null,
          ladoInicial: largada.ladoInicial,
          ladoOrigem: largada.ladoOrigem,
          perfilJogo: (largada.perfilJogo as Prisma.InputJsonObject) ?? undefined,
          perfilOrigem: largada.perfilOrigem,
          engineState: semearEstado(
            estadoInicial(),
            largada.ladoInicial,
            config.sementeInicial,
            largada.perfilDominante,
          ) as unknown as Prisma.InputJsonObject,
          finishedAt: null,
          startedAt: new Date(),
        },
      });

      return { ok: true, ladoInicial: largada.ladoInicial, ladoOrigem: largada.ladoOrigem };
    });
  }

  /** Lote de eventos do cliente. Idempotência por (client_ts, tipo, postId). */
  @Post(":id/eventos")
  @Contrato({
    resumo: "Lote de eventos do cliente — o canal OPERACIONAL.",
    descricao:
      "Síncrono e transacional, lido em tempo quase real para curar o próximo bloco. **`dwell` nunca passa por Pub/Sub**: latência e falta de ordenação quebrariam a adaptação e o lock por run.",
    params: z.object({ id: z.string().uuid() }),
    corpo: EventosSchema,
    resposta: EventosGravadosSchema,
    notas: [
      "Idempotência por `(client_ts, tipo, postId)`: `descartados` conta o que já existia — reenvio é rotina no cliente, não erro.",
      "Cota por SESSÃO, não por IP: a turma toda compartilha a rede da escola.",
    ],
  })
  @Roles("estudante")
  @HttpCode(200)
  async eventos(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();

    // Cota por sessão, não por IP: a turma toda compartilha a rede da escola.
    const limite = rateLimit(`events:${id}`, 300, 60_000);
    if (!limite.ok) return { ok: true, gravados: 0, descartados: 0, limitado: true };

    const parsed = EventosSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Não deu para enviar agora." });

    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, estudanteId: usuarioId, escolaId },
        select: { id: true },
      });
      if (!run) naoEncontrado();

      const chave = (e: { clientTs: number; tipo: string; postId?: string | null }) =>
        `${e.clientTs}|${e.tipo}|${e.postId ?? ""}`;

      // 1) dedupe dentro do próprio lote
      const unicos = new Map<string, (typeof parsed.data.events)[number]>();
      for (const evento of parsed.data.events) unicos.set(chave(evento), evento);

      // 2) dedupe contra o que já está no banco
      const timestamps = [...new Set([...unicos.values()].map((e) => BigInt(e.clientTs)))];
      const jaGravados = await tx.event.findMany({
        where: { runId: id, clientTs: { in: timestamps } },
        select: { tipo: true, postId: true, clientTs: true },
      });
      const existentes = new Set(jaGravados.map((e) => `${e.clientTs}|${e.tipo}|${e.postId ?? ""}`));
      const novos = [...unicos.values()].filter((e) => !existentes.has(chave(e)));

      /**
       * O comentário do estudante vira LINHA PRÓPRIA, além do evento — escrito na
       * MESMA transação e só para eventos novos: a deduplicação protege o
       * comentário também (reenviar o lote não duplica o que ele escreveu).
       */
      const comentarios = novos
        .filter((e) => e.tipo === "comentou" && e.postId)
        .map((e) => ({
          escolaId,
          runId: id,
          postId: e.postId as string,
          texto: String((e.payload as { texto?: unknown } | undefined)?.texto ?? "").trim(),
        }))
        .filter((c) => c.texto.length > 0);

      if (novos.length > 0) {
        await tx.event.createMany({
          data: novos.map((e) => ({
            escolaId,
            runId: id,
            postId: e.postId ?? null,
            tipo: e.tipo,
            payload: (e.payload ?? {}) as Prisma.InputJsonObject,
            clientTs: BigInt(e.clientTs),
          })),
        });
        if (comentarios.length > 0) await tx.comentarioDaSessao.createMany({ data: comentarios });
      }

      return {
        ok: true,
        gravados: novos.length,
        descartados: unicos.size - novos.length,
        comentarios: comentarios.length,
      };
    });
  }

  /** A busca do estudante — e ela NÃO é enviesada: é o acervo, não a bolha. */
  @Get(":id/busca")
  @Roles("estudante")
  @Contrato({
    resumo: "Busca no acervo da atividade.",
    descricao: "Usar a busca é o sinal de INVESTIGAÇÃO que o relatório conta — por isso ela é uma rota, e não um filtro no cliente.",
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ q: z.string().optional() }),
    resposta: BuscaSchema,
  })
  async busca(@Param("id") id: string, @Query("q") q: string | undefined, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const termo = z.string().trim().max(80).optional().parse(q ?? undefined)?.trim();

    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();

      const posts = await tx.post.findMany({
        where: {
          activityId: run.activityId,
          aprovado: true,
          ...(termo && termo.length >= 2
            ? {
                OR: [
                  { caption: { contains: termo, mode: "insensitive" } },
                  { hashtags: { has: termo.toLowerCase().replace(/^#/, "") } },
                ],
              }
            : {}),
        },
        // Ordem por likes, como busca de rede social — NUNCA por lado/domínio.
        orderBy: { likesCount: "desc" },
        take: 30,
        include: {
          author: { select: { handle: true, displayName: true, verificado: true } },
          comments: {
            orderBy: { ordem: "asc" },
            select: { id: true, handle: true, texto: true, likesCount: true, ordem: true },
          },
        },
      });

      // Mesmo sanitizador do feed: nem aqui o cliente vê lado/perfil/intensidade.
      return { posts: posts.map((post) => paraFeedPost(post as never, false)), termo: termo ?? null };
    });
  }

  /** Os posts que o ESTUDANTE salvou — o último evento por post decide. */
  @Get(":id/salvos")
  @Contrato({
    resumo: "A coleção do estudante — o que ele salvou.",
    descricao: "O ÚLTIMO evento por post decide: salvar e dessalvar se anulam. É a coleção que ele vai defender no debate.",
    params: z.object({ id: z.string().uuid() }),
    resposta: SalvosSchema,
  })
  @Roles("estudante")
  async salvos(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();

      const eventos = await tx.event.findMany({
        where: { runId: id, tipo: { in: ["salvou", "dessalvou"] }, postId: { not: null } },
        select: { postId: true, tipo: true },
        orderBy: { id: "asc" },
      });
      const estado = new Map<string, boolean>();
      for (const evento of eventos) {
        if (evento.postId) estado.set(evento.postId, evento.tipo === "salvou");
      }
      const ids = [...estado.entries()].filter(([, salvo]) => salvo).map(([postId]) => postId);
      if (ids.length === 0) return { posts: [], comentarios: {} };

      const [posts, meusComentarios] = await Promise.all([
        tx.post.findMany({
          where: { id: { in: ids } },
          include: {
            author: { select: { handle: true, displayName: true, verificado: true } },
            comments: {
              orderBy: { ordem: "asc" },
              select: { id: true, handle: true, texto: true, likesCount: true, ordem: true },
            },
          },
        }),
        /** Os comentários que ELE escreveu, para o debate ter o que ele disse. */
        tx.comentarioDaSessao.findMany({
          where: { runId: id, postId: { in: ids } },
          select: { postId: true, texto: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      // Ordem em que ele salvou: é a ordem em que ele vai contar a história.
      const posicao = new Map(ids.map((postId, indice) => [postId, indice]));
      posts.sort((a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0));

      const comentarios: Record<string, string[]> = {};
      for (const c of meusComentarios) {
        if (!c.postId) continue;
        comentarios[c.postId] = [...(comentarios[c.postId] ?? []), c.texto];
      }
      return { posts: posts.map((post) => paraFeedPost(post as never, false)), comentarios };
    });
  }

  /** O que o estudante PERDEU: posts do lado oposto que nunca foram servidos. */
  @Get(":id/perdidos")
  @Contrato({
    resumo: "O que o estudante PERDEU — posts do lado oposto que nunca foram servidos.",
    descricao:
      "**Só das etapas `perdidos` em diante**: antes disso derrubaria o disfarce, que é o que a atividade inteira depende de manter até a revelação.",
    params: z.object({ id: z.string().uuid() }),
    resposta: PerdidosSchema,
  })
  @Roles("estudante")
  async perdidos(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();
      // Só nas etapas `perdidos` em diante: antes disso derrubaria o disfarce.
      if (!["perdidos", "reflexao", "fim"].includes(run.fase)) naoEncontrado();

      const atividade = await tx.activity.findUniqueOrThrow({
        where: { id: run.activityId },
        select: { antagonismo: true },
      });
      const antagonismo = antagonismoSchema.safeParse(atividade.antagonismo);
      const estado = normalizarEstado(run.engineState);
      const servidos = new Set(estado.servedPostIds);

      /**
       * O lado dele = onde o FEED mais serviu. A conta vive em `calcularExposicao`
       * porque o relatório do professor faz a mesma pergunta e precisa da mesma
       * resposta — antes cada um tinha a sua, e nos estudantes que viraram o jogo as
       * duas telas nomeavam lados opostos para a mesma criança (ADR-42).
       */
      const metas = await tx.post.findMany({
        where: { activityId: run.activityId, aprovado: true, lado: { in: ["A", "B"] } },
        select: { id: true, lado: true, aprovado: true },
      });
      const exposicao = calcularExposicao(estado.servedPostIds, metas);

      /**
       * Sem post de tese servido não há lado a nomear. Acontece com sessão
       * interrompida cedo, e é raro — mas inventar um lado aqui poria na tela do
       * estudante uma frase sobre um feed que ele não chegou a ter.
       */
      if (!exposicao.ladoDele || !exposicao.ladoPerdido) {
        return {
          ladoPerdido: null,
          rotuloDoLadoPerdido: null,
          rotuloDoLadoDele: null,
          contagem: { totalNoAcervo: 0, vistos: 0, perdidos: 0 },
          posts: [],
        };
      }
      const ladoPerdido = exposicao.ladoPerdido;
      const ladoDele = exposicao.ladoDele;

      const perdidos = await tx.post.findMany({
        where: {
          activityId: run.activityId,
          aprovado: true,
          lado: ladoPerdido,
          id: { notIn: [...servidos] },
        },
        // Mais curtidos primeiro: é o que "todo mundo menos ele" estava vendo.
        orderBy: { likesCount: "desc" },
        take: 30,
        include: {
          author: { select: { handle: true, displayName: true, verificado: true } },
          comments: { orderBy: { ordem: "asc" }, take: 2, select: { handle: true, texto: true } },
        },
      });

      const rotulo = (lado: "A" | "B") =>
        antagonismo.success
          ? lado === "A"
            ? antagonismo.data.ladoA.label
            : antagonismo.data.ladoB.label
          : lado === "A"
            ? "Um lado"
            : "O outro lado";

      return {
        ladoPerdido,
        rotuloDoLadoPerdido: rotulo(ladoPerdido),
        rotuloDoLadoDele: rotulo(ladoDele),
        contagem: {
          totalNoAcervo: exposicao.totalNoAcervo,
          vistos: exposicao.vistos,
          perdidos: exposicao.perdidos,
        },
        posts: perdidos.map((post) => ({
          id: post.id,
          author: {
            handle: post.author.handle,
            displayName: post.author.displayName,
            verificado: post.author.verificado,
          },
          imageUrl: post.imageStatus === "ok" ? post.imageUrl : null,
          imageAlt: textoAlternativoDaImagem(post),
          fallbackArt: post.imageStatus === "ok" ? null : arteFallback(post.id, post.categoria),
          caption: post.caption,
          hashtags: post.hashtags,
          likesCount: post.likesCount,
          timestampLabel: post.timestampLabel,
          comentarios: post.comments.map((c) => ({ handle: c.handle, texto: c.texto })),
        })),
      };
    });
  }

  /**
   * A resposta à pergunta-chave — só a escolha de um lado. Não pontua no motor
   * (dado reflexivo, não comportamental), é idempotente enquanto a fase é
   * `conclusao`, e NÃO avança a fase: quem move a turma é o professor.
   */
  @Post(":id/conclusao")
  @Roles("estudante")
  @Contrato({
    resumo: "A escolha de um lado no fim da missão.",
    descricao: "Enviar duas vezes é **409**, com linguagem de app real: \"isso já foi enviado\", nada de \"fase\" ou \"atividade\".",
    params: z.object({ id: z.string().uuid() }),
    corpo: ConclusaoSchema,
    resposta: ConclusaoGravadaSchema,
  })
  @HttpCode(200)
  async conclusao(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, estudanteId: usuarioId, escolaId },
        select: { id: true, fase: true },
      });
      if (!run) naoEncontrado();
      if (run.fase !== "conclusao") {
        // Linguagem de app real: nada de "fase" ou "atividade".
        throw new HttpException({ mensagem: "Isso já foi enviado." }, 409);
      }
      const parsed = ConclusaoSchema.safeParse(body);
      if (!parsed.success) throw new BadRequestException({ mensagem: "Escolhe uma das três opções." });

      /**
       * A PRIMEIRA escolha é gravada uma vez e nunca mais tocada; `inclinacao`
       * segue sendo a última, que é a que vale. A tela convida o estudante a mudar
       * de ideia enquanto espera a turma, e antes disso a primeira reação ao
       * feed — a que acontece antes de dois minutos de espera e de olhar a tela
       * do colega — desaparecia no `update`.
       */
      const atual = await tx.conclusao.findUnique({
        where: { runId: id },
        select: { inclinacao: true, inclinacaoInicial: true, trocas: true },
      });

      if (!atual) {
        await tx.conclusao.create({
          data: {
            runId: id,
            escolaId,
            inclinacao: parsed.data.inclinacao,
            inclinacaoInicial: parsed.data.inclinacao,
          },
        });
        return { ok: true, fase: "conclusao" };
      }

      const mudou = atual.inclinacao !== parsed.data.inclinacao;
      await tx.conclusao.update({
        where: { runId: id },
        data: {
          inclinacao: parsed.data.inclinacao,
          // Reenviar a mesma opção (toque duplo, rede lenta) não é trocar de ideia.
          trocas: mudou ? atual.trocas + 1 : atual.trocas,
          // Linha anterior à migração: a primeira observável é esta.
          inclinacaoInicial: atual.inclinacaoInicial ?? atual.inclinacao,
        },
      });
      return { ok: true, fase: "conclusao" };
    });
  }

  /** A reflexão que fecha a atividade: assunto próprio, sem teto, editável. */
  @Post(":id/reflexao")
  @Roles("estudante")
  @Contrato({
    resumo: "O fechamento escrito da atividade.",
    descricao:
      "É sobre a ATIVIDADE (letramento digital), não sobre a pergunta-chave — a conclusão já foi a escolha de um lado.",
    params: z.object({ id: z.string().uuid() }),
    corpo: ReflexaoSchema,
    resposta: ReflexaoGravadaSchema,
    notas: [
      "60 caracteres é o PISO: passa \"o algoritmo me mostrou mais de um lado\" e barra \"gostei\". Não é medida de qualidade, é filtro de vazio.",
    ],
  })
  @HttpCode(200)
  async salvarReflexao(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;
    const gravada = await this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, estudanteId: usuarioId, escolaId },
        select: { id: true, fase: true, activityId: true, activity: { select: { turmaId: true } } },
      });
      if (!run) naoEncontrado();
      if (run.fase !== "reflexao" && run.fase !== "fim") {
        throw new HttpException({ mensagem: "Ainda não é hora disso." }, 409);
      }
      const parsed = ReflexaoSchema.safeParse(body);
      if (!parsed.success) {
        throw new BadRequestException({ mensagem: "Escreve um pouco mais — vale contar o que você percebeu." });
      }
      /* O PRIMEIRO texto fica guardado para o professor conferir a leitura da
         IA (ADR-167): gravado só na criação da linha, nunca no update. */
      const criada = await tx.reflexao.createMany({
        data: [{ runId: id, escolaId, texto: parsed.data.texto, primeiroTexto: parsed.data.texto }],
        skipDuplicates: true,
      });
      if (criada.count === 0) {
        await tx.reflexao.update({ where: { runId: id }, data: { texto: parsed.data.texto } });
      }
      /* A LEITURA nasce na mesma transação do primeiro salvamento, e só para
         quem teve feed com lado e terminou a revelação. A unicidade por
         atividade e estudante impede a segunda — inclusive depois de um
         reinício, que não a apaga. */
      let agendada: LeituraAgendada | null = null;
      if (criada.count === 1 && (await this.tarefas.podeLerAReflexao(tx, id, usuarioId, escolaId))) {
        const leitura = await tx.leituraDaReflexao.createMany({
          data: [{ escolaId, activityId: run.activityId, estudanteId: usuarioId, runId: id }],
          skipDuplicates: true,
        });
        if (leitura.count === 1) {
          const linha = await tx.leituraDaReflexao.findUniqueOrThrow({
            where: { activityId_estudanteId: { activityId: run.activityId, estudanteId: usuarioId } },
            select: { id: true },
          });
          agendada = {
            leituraId: linha.id,
            escolaId,
            estudanteId: usuarioId,
            activityId: run.activityId,
            turmaId: run.activity.turmaId,
          };
        }
      }
      return { caracteres: parsed.data.texto.length, agendada };
    });
    /* A IA lê DEPOIS da transação e sem a criança esperar: a resposta não
       depende da leitura, e a leitura nunca lança. */
    if (gravada.agendada) void this.leitura.ler(gravada.agendada);
    return { ok: true, caracteres: gravada.caracteres };
  }

  /** O que ele já escreveu — para reabrir a tela sem perder o texto. */
  @Get(":id/reflexao")
  @Roles("estudante")
  @Contrato({
    resumo: "O texto da reflexão que o estudante já escreveu.",
    descricao:
      "Lê a reflexão desta run — a dele, e só a dele: o `where` casa `estudanteId` do token junto com o id.",
    params: z.object({ id: z.string().uuid() }),
    resposta: ReflexaoSalvaSchema,
    notas: ["`texto: \"\"` quando ainda não escreveu — o campo abre vazio, não com erro."],
  })
  async lerReflexao(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, estudanteId: req.auth.usuarioId, escolaId: req.auth.escolaId },
        select: { reflexao: { select: { texto: true } } },
      });
      if (!run) naoEncontrado();
      return { texto: run.reflexao?.texto ?? "", minimo: MINIMO_DA_REFLEXAO };
    });
  }

  /** O post espontâneo do estudante (nunca sugerido pela interface). */
  @Post(":id/student-post")
  @Contrato({
    resumo: "O estudante publica no app, e as personas reagem.",
    descricao:
      "**Falha fechada**: IA desligada, erro de rede ou reação recusada ⇒ lista vazia, e o post é publicado do mesmo jeito — como num app real quando ninguém responde. A chamada de IA fica FORA da transação, de propósito.",
    params: z.object({ id: z.string().uuid() }),
    corpo: StudentPostSchema,
    resposta: PostDoEstudanteSchema,
  })
  @Roles("estudante")
  @HttpCode(201)
  async studentPost(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const limite = rateLimit(`student-post:${id}`, 10, 60_000);
    if (!limite.ok) throw new HttpException({ mensagem: "Espera um pouco pra publicar de novo." }, 429);

    const parsed = StudentPostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Escreve algo antes de publicar." });

    const { usuarioId, escolaId } = req.auth;
    const contexto = await this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, usuarioId, escolaId);
      if (!run) naoEncontrado();

      const estado = normalizarEstado(run.engineState);
      const { ladoDominante } = dominioDe(estado, run.activity.engineConfig as unknown as EngineConfig);

      const criado = await tx.studentPost.create({
        data: {
          escolaId,
          runId: id,
          texto: parsed.data.texto,
          template: parsed.data.template,
          ladoInferido: ladoDominante,
        },
        select: { id: true, texto: true, template: true, createdAt: true },
      });

      /** O elenco vem das personas que o PROFESSOR aprovou nesta atividade. */
      const elenco = await tx.author.findMany({
        where: { activityId: run.activityId },
        select: { handle: true, displayName: true, voz: true, perfilAfim: true },
        take: 12,
      });
      return { criado, elenco, iaAoVivo: run.activity.iaAoVivo, perguntaChave: run.activity.perguntaChave };
    });

    /**
     * Reações geradas na hora pelas personas aprovadas. Falha fechada: IA
     * desligada, erro de rede ou reação recusada ⇒ lista vazia, e o post do
     * estudante é publicado do mesmo jeito — como num app real quando ninguém
     * responde. (A chamada de IA fica FORA da transação de propósito.)
     */
    const { reacoes } = contexto.iaAoVivo
      ? await gerarReacoes(this.ia, {
          elenco: contexto.elenco.map((autor) => ({
            handle: autor.handle,
            displayName: autor.displayName,
            voz: autor.voz ?? "fala de forma simples e direta",
            perfil: autor.perfilAfim ?? "",
          })),
          perguntaChave: contexto.perguntaChave,
          textoDoEstudante: parsed.data.texto,
          contexto: "O ESTUDANTE PUBLICOU UM POST no feed.",
          quantas: 3,
        })
      : { reacoes: [] };

    if (reacoes.length > 0) {
      await this.prisma.comTenancy((tx) =>
        tx.comentarioDaSessao.createMany({
          data: reacoes.map((reacao) => ({
            escolaId,
            runId: id,
            studentPostId: contexto.criado.id,
            handle: reacao.handle,
            deIa: true,
            texto: reacao.texto,
          })),
        }),
      );
    }

    return { post: contexto.criado, comentariosDeApoio: reacoes };
  }

  /** Personas reagem ao que o estudante acabou de escrever. Vazio é resultado válido. */
  @Post(":id/reacoes")
  @Contrato({
    resumo: "Reações das personas ao que o estudante escreveu.",
    descricao: "Nunca falha para o estudante: sem IA, sem cota ou com erro, devolve `reacoes: []` e diz por quê.",
    params: z.object({ id: z.string().uuid() }),
    corpo: ReacoesSchema,
    resposta: ReacoesGeradasSchema,
    notas: [
      "`desligada: true` = o professor desligou a IA ao vivo.",
      "`limite: true` = teto de 12 reações por sessão — estudante comentando sem parar não queima a cota da turma.",
    ],
  })
  @Roles("estudante")
  @HttpCode(200)
  async reacoes(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;

    const corpo = ReacoesSchema.safeParse(body);
    if (!corpo.success) return { reacoes: [] };

    const contexto = await this.prisma.comTenancy(async (tx) => {
      const run = await runDoEstudante(tx, id, usuarioId, escolaId);
      if (!run) naoEncontrado();
      // Sessão congelada não recebe conteúdo novo.
      if (run.fase !== "feed" && run.fase !== "encerramento") return null;
      if (!run.activity.iaAoVivo) return { desligada: true as const };

      const autores = await tx.author.findMany({
        where: { activityId: run.activityId },
        select: { handle: true, displayName: true, voz: true, perfilAfim: true },
        take: 12,
      });
      return { autores, perguntaChave: run.activity.perguntaChave };
    });

    if (!contexto) return { reacoes: [] };
    if ("desligada" in contexto) return { reacoes: [], desligada: true };

    // 12 reações por sessão: estudante comentando sem parar não queima a cota da turma.
    const cota = rateLimit(`reacoes:${id}`, 12, 30 * 60_000);
    if (!cota.ok) return { reacoes: [], limite: true };

    const ehPostEstudante = corpo.data.tipo === "post_do_estudante";

    const { reacoes } = await gerarReacoes(this.ia, {
      elenco: contexto.autores.map((autor) => ({
        handle: autor.handle,
        displayName: autor.displayName,
        voz: autor.voz ?? "fala de forma simples e direta",
        perfil: autor.perfilAfim ?? "",
      })),
      perguntaChave: contexto.perguntaChave,
      textoDoEstudante: corpo.data.texto,
      contexto: ehPostEstudante
        ? "O ESTUDANTE PUBLICOU UM POST no feed."
        : "O ESTUDANTE COMENTOU num post do feed.",
      quantas: ehPostEstudante ? 3 : 1,
    });

    if (reacoes.length === 0) return { reacoes: [] };

    await this.prisma.comTenancy((tx) =>
      tx.comentarioDaSessao.createMany({
        data: reacoes.map((reacao) => ({
          escolaId,
          runId: id,
          postId: corpo.data.tipo === "comentario" ? corpo.data.postId : null,
          studentPostId: corpo.data.tipo !== "comentario" ? corpo.data.studentPostId : null,
          handle: reacao.handle,
          deIa: true,
          texto: reacao.texto,
        })),
      }),
    );

    return { reacoes };
  }

  /**
   * GET /runs/:id/dossie — o estudante lê o próprio; o professor, qualquer um da
   * sua atividade (para projetar em aula). Aqui lado/intensidade PODEM
   * aparecer: o disfarce já caiu.
   */
  @Get(":id/dossie")
  @Contrato({
    resumo: "O dossiê da sessão — o relatório da revelação.",
    descricao:
      "Aqui o disfarce JÁ CAIU, e por isso o `lado` de cada post pode aparecer. A seção mais importante é `explicacaoDoLado`: **por que o feed começou daquele lado**.",
    params: z.object({ id: z.string().uuid() }),
    resposta: DossieSchema,
    notas: [
      "`conclusao` é anexada na LEITURA, não no congelamento: o dossiê é computado no `finish`, antes de o estudante escrever. `undefined` quando a sessão foi interrompida — e o relatório precisa funcionar assim.",
      "Os rótulos de perfil vêm prontos no payload em vez de o cliente importar as FICHAS: elas carregam o vocabulário dos prompts, que não tem por que viajar até o navegador.",
      "`imersao.total` nunca vem sem os componentes.",
    ],
  })
  @Roles("estudante", "professor")
  async dossie(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId, perfil } = req.auth;

    const run = await this.prisma.comTenancy((tx) =>
      tx.run.findFirst({
        where:
          perfil === "estudante" || (perfil as string) === "estudante"
            ? { id, estudanteId: usuarioId, escolaId }
            : { id, escolaId, activity: { professorId: usuarioId } },
        select: { id: true, fase: true },
      }),
    );
    if (!run) naoEncontrado();

    /**
     * O dossiê só existe depois da revelação — sem esta guarda, colar a URL na
     * barra entregava pesos do motor e rótulos no meio da sessão.
     * `explicabilidade` é a fase do fluxo v2; `revelacao`/`dossie` continuam
     * por causa de runs congeladas antes da mudança.
     */
    const PODE_LER = ["explicabilidade", "perdidos", "reflexao", "fim", "revelacao", "dossie"];
    if ((perfil === "estudante" || (perfil as string) === "estudante") && !PODE_LER.includes(run.fase)) naoEncontrado();

    try {
      const resposta = await montarRespostaDossie(this.prisma, id, escolaId);
      /* Enquanto o Raio-x está pendente, o relatório do ESTUDANTE chega sem o
         lado, a intensidade e a categoria dos posts em que ele mais parou —
         senão entregaria o gabarito do 6a (ADR-167). A tela não usa esses
         campos, e o professor recebe sempre o relatório completo. */
      if ((perfil === "estudante" || (perfil as string) === "estudante") && (await this.tarefas.raioXPendente(id, escolaId))) {
        return {
          ...resposta,
          posts: {
            ...resposta.posts,
            topDwell: resposta.posts.topDwell.map(({ lado: _l, intensidade: _i, categoria: _c, ...resto }) => resto),
          },
        };
      }
      return resposta;
    } catch (falha) {
      if (falha instanceof DossieAindaNaoExiste) naoEncontrado();
      throw falha;
    }
  }
}

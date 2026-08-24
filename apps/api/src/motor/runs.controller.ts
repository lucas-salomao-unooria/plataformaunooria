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
import { rateLimit } from "../comum/rate-limit";
import { antagonismoSchema } from "../comum/insta/tipos";
import { ehEtapaDaTurma, faseEfetiva, normalizarFase } from "../comum/insta/etapas";
import { DossieAindaNaoExiste, encerrarRun, montarRespostaDossie } from "../dossie/computar";
import { arteFallback } from "../geracao/arte-fallback";
import { gerarReacoes } from "../geracao/prompts/reacoes";
import { resolverLargada } from "../perfis/largada";
import { PrismaService } from "../prisma/prisma.service";
import { deveEncerrar } from "./curadoria";
import { estadoInicial, normalizarEstado, semearEstado } from "./estado";
import { dominioDe } from "./eventos";
import { ehUuid, naoEncontrado, runDoAluno } from "./guardas";
import { paraFeedPost } from "./sanitizador";
import { proximoBlocoDoFeed } from "./servico";
import { eventoSchema, type EngineConfig } from "./tipos";

/**
 * Rotas de RUN do aluno (e o reset do professor) — porte fiel dos handlers de
 * `app/api/runs/**` do origem para NestJS. As decisões de produto vivem nos
 * comentários de cada handler do origem; aqui só muda a casca (guards, tenancy
 * explícita por `escola_id` + RLS via comTenancy).
 */

const CriarRunSchema = z.object({ avatar: z.string().trim().max(40).optional() }).default({});
const EntrarSchema = z.object({
  /** O nome que aparece no aparelho. Pode ser apelido; é ele que o aluno lê. */
  nome: z.string().trim().min(1).max(40),
  avatar: z.string().trim().min(1).max(60),
});
const EventosSchema = z.object({ events: z.array(eventoSchema).min(1).max(200) });
const ConclusaoSchema = z.object({ inclinacao: z.enum(["A", "B", "duvida"]) });
const ReflexaoSchema = z.object({
  /** 60 caracteres é o piso: passa "o algoritmo me mostrou mais de um lado" e
   *  barra "gostei". Não é medida de qualidade, é filtro de vazio. */
  texto: z.string().trim().min(60),
});
const StudentPostSchema = z.object({
  texto: z.string().trim().min(1).max(280),
  template: z.string().trim().min(1).max(40),
});
const ReacoesSchema = z.union([
  z.object({ tipo: z.literal("post_do_aluno"), studentPostId: z.string().uuid(), texto: z.string().trim().min(1).max(600) }),
  z.object({ tipo: z.literal("comentario"), postId: z.string().uuid(), texto: z.string().trim().min(1).max(600) }),
]);

type Autenticado = { auth: AuthClaims };

@Controller("runs")
@UseGuards(OidcGuard, RolesGuard)
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
  ) {}

  /** POST /runs — inicia ou retoma a sessão do aluno na atividade ativa. */
  @Post()
  @Roles("aluno")
  @HttpCode(201)
  async criar(@Body() body: unknown, @Req() req: Autenticado) {
    const parsed = CriarRunSchema.safeParse(body ?? {});
    const avatar = parsed.success ? parsed.data.avatar : undefined;
    const { usuarioId, escolaId } = req.auth;

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await tx.activity.findFirst({
        where: { status: "ativa", escolaId },
        orderBy: { createdAt: "desc" },
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
        where: { activityId_alunoId: { activityId: atividade.id, alunoId: usuarioId } },
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
          alunoId: usuarioId,
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
  @Roles("aluno")
  async boot(@Req() req: Autenticado) {
    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const [aluno, run] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { displayName: true, username: true, avatar: true },
        }),
        tx.run.findFirst({
          where: { alunoId: usuarioId, escolaId, activity: { status: "ativa" } },
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            fase: true,
            activity: { select: { perguntaChave: true, antagonismo: true } },
          },
        }),
      ]);

      const atividade =
        run?.activity ??
        (await tx.activity.findFirst({
          where: { status: "ativa", escolaId },
          orderBy: { createdAt: "desc" },
          select: { perguntaChave: true, antagonismo: true },
        }));

      const bruto = atividade?.antagonismo as
        | { ladoA?: { label?: string }; ladoB?: { label?: string } }
        | null
        | undefined;

      return {
        runId: run?.id ?? null,
        fase: run?.fase ?? "onboarding",
        missao: {
          perguntaChave: atividade?.perguntaChave ?? "",
          ladoALabel: bruto?.ladoA?.label ?? "Um lado",
          ladoBLabel: bruto?.ladoB?.label ?? "O outro lado",
        },
        aluno: {
          displayName: aluno.displayName,
          handle: `@${aluno.username}`,
          avatar: aluno.avatar ?? `avatar-${aluno.username.slice(-2)}`,
        },
      };
    });
  }

  /** O aluno entra no aparelho: escolheu avatar, digitou o nome, vai ao feed. */
  @Post(":id/entrar")
  @Roles("aluno")
  @HttpCode(200)
  async entrar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const corpo = EntrarSchema.safeParse(body ?? {});
    if (!corpo.success) {
      throw new BadRequestException({ mensagem: "Escolhe uma figurinha e escreve seu nome." });
    }

    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();

      /**
       * Só avança quem está no onboarding. Reentrar depois — aparelho que
       * travou, aba fechada — não pode jogar o aluno de volta para o feed se a
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
  @Roles("aluno")
  async feed(@Param("id") id: string, @Req() req: Autenticado) {
    const run = await this.prisma.comTenancy((tx) =>
      runDoAluno(tx, id, req.auth.usuarioId, req.auth.escolaId),
    );
    if (!run) naoEncontrado();

    const { posts, modulos } = await proximoBlocoDoFeed(this.prisma, id, req.auth.escolaId);
    // diagnostico fica no servidor: nada de domínio/lado no bundle do aluno.
    return { posts, modulos };
  }

  /**
   * A tela que o aluno deve estar vendo agora — já reconciliada com a etapa da
   * turma. O cliente faz polling: os momentos coletivos são do PROFESSOR.
   */
  @Get(":id/fase")
  @Roles("aluno")
  async fase(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!run) naoEncontrado();
      const etapa = ehEtapaDaTurma(run.activity.etapa) ? run.activity.etapa : "investigacao";
      return { fase: faseEfetiva(normalizarFase(run.fase), etapa), etapa };
    });
  }

  /** POST /runs/:id/finish — congela a run, computa o dossiê, fase = conclusao. */
  @Post(":id/finish")
  @Roles("aluno")
  @HttpCode(200)
  async finish(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;

    const gate = await this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, alunoId: usuarioId, escolaId },
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
  @HttpCode(200)
  async reset(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;

    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, escolaId, activity: { professorId: usuarioId } },
        select: {
          id: true,
          alunoId: true,
          activityId: true,
          activity: { select: { antagonismo: true, engineConfig: true } },
        },
      });
      if (!run) naoEncontrado();

      const largada = await resolverLargada(tx, run.activityId, run.alunoId, run.activity.antagonismo, {
        ignorarRunAtual: run.id,
      });
      const config = run.activity.engineConfig as { sementeInicial?: number };

      /**
       * Tudo que o aluno PRODUZIU vai embora com a sessão: sobra de dado aqui
       * vira vazamento entre alunos (comentários e reflexão inclusos — a lição
       * do teste de comentário duplicado do origem).
       */
      await tx.event.deleteMany({ where: { runId: id } });
      await tx.studentPost.deleteMany({ where: { runId: id } });
      await tx.dossier.deleteMany({ where: { runId: id } });
      await tx.conclusao.deleteMany({ where: { runId: id } });
      await tx.reflexao.deleteMany({ where: { runId: id } });
      await tx.comentarioDaSessao.deleteMany({ where: { runId: id } });
      await tx.run.update({
        where: { id },
        data: {
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
          finishedAt: null,
          startedAt: new Date(),
        },
      });

      return { ok: true, ladoInicial: largada.ladoInicial, ladoOrigem: largada.ladoOrigem };
    });
  }

  /** Lote de eventos do cliente. Idempotência por (client_ts, tipo, postId). */
  @Post(":id/eventos")
  @Roles("aluno")
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
        where: { id, alunoId: usuarioId, escolaId },
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
       * O comentário do aluno vira LINHA PRÓPRIA, além do evento — escrito na
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

  /** A busca do aluno — e ela NÃO é enviesada: é o acervo, não a bolha. */
  @Get(":id/busca")
  @Roles("aluno")
  async busca(@Param("id") id: string, @Query("q") q: string | undefined, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const termo = z.string().trim().max(80).optional().parse(q ?? undefined)?.trim();

    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, req.auth.usuarioId, req.auth.escolaId);
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

  /** Os posts que o ALUNO salvou — o último evento por post decide. */
  @Get(":id/salvos")
  @Roles("aluno")
  async salvos(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, req.auth.usuarioId, req.auth.escolaId);
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

  /** O que o aluno PERDEU: posts do lado oposto que nunca foram servidos. */
  @Get(":id/perdidos")
  @Roles("aluno")
  async perdidos(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, req.auth.usuarioId, req.auth.escolaId);
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

      /** O lado dele = onde ele mais consumiu (posts servidos, não scores). */
      const metas = await tx.post.findMany({
        where: { activityId: run.activityId, aprovado: true, lado: { in: ["A", "B"] } },
        select: { id: true, lado: true },
      });
      const consumo = { A: 0, B: 0 };
      for (const meta of metas) {
        if (servidos.has(meta.id) && (meta.lado === "A" || meta.lado === "B")) consumo[meta.lado] += 1;
      }
      const ladoDele: "A" | "B" = consumo.A >= consumo.B ? "A" : "B";
      const ladoPerdido: "A" | "B" = ladoDele === "A" ? "B" : "A";

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

      const totalDoLadoPerdido = metas.filter((m) => m.lado === ladoPerdido).length;
      const vistosDoLadoPerdido = metas.filter((m) => m.lado === ladoPerdido && servidos.has(m.id)).length;
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
          totalNoAcervo: totalDoLadoPerdido,
          vistos: vistosDoLadoPerdido,
          perdidos: totalDoLadoPerdido - vistosDoLadoPerdido,
        },
        posts: perdidos.map((post) => ({
          id: post.id,
          author: {
            handle: post.author.handle,
            displayName: post.author.displayName,
            verificado: post.author.verificado,
          },
          imageUrl: post.imageStatus === "ok" ? post.imageUrl : null,
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
  @Roles("aluno")
  @HttpCode(200)
  async conclusao(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, alunoId: usuarioId, escolaId },
        select: { id: true, fase: true },
      });
      if (!run) naoEncontrado();
      if (run.fase !== "conclusao") {
        // Linguagem de app real: nada de "fase" ou "atividade".
        throw new HttpException({ mensagem: "Isso já foi enviado." }, 409);
      }
      const parsed = ConclusaoSchema.safeParse(body);
      if (!parsed.success) throw new BadRequestException({ mensagem: "Escolhe uma das três opções." });

      await tx.conclusao.upsert({
        where: { runId: id },
        create: { runId: id, escolaId, inclinacao: parsed.data.inclinacao },
        update: { inclinacao: parsed.data.inclinacao },
      });
      return { ok: true, fase: "conclusao" };
    });
  }

  /** A reflexão que fecha a atividade: assunto próprio, sem teto, editável. */
  @Post(":id/reflexao")
  @Roles("aluno")
  @HttpCode(200)
  async salvarReflexao(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, alunoId: usuarioId, escolaId },
        select: { id: true, fase: true },
      });
      if (!run) naoEncontrado();
      if (run.fase !== "reflexao" && run.fase !== "fim") {
        throw new HttpException({ mensagem: "Ainda não é hora disso." }, 409);
      }
      const parsed = ReflexaoSchema.safeParse(body);
      if (!parsed.success) {
        throw new BadRequestException({ mensagem: "Escreve um pouco mais — vale contar o que você percebeu." });
      }
      await tx.reflexao.upsert({
        where: { runId: id },
        create: { runId: id, escolaId, texto: parsed.data.texto },
        update: { texto: parsed.data.texto },
      });
      return { ok: true, caracteres: parsed.data.texto.length };
    });
  }

  /** O que ele já escreveu — para reabrir a tela sem perder o texto. */
  @Get(":id/reflexao")
  @Roles("aluno")
  async lerReflexao(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id, alunoId: req.auth.usuarioId, escolaId: req.auth.escolaId },
        select: { reflexao: { select: { texto: true } } },
      });
      if (!run) naoEncontrado();
      return { texto: run.reflexao?.texto ?? "" };
    });
  }

  /** O post espontâneo do aluno (nunca sugerido pela interface). */
  @Post(":id/student-post")
  @Roles("aluno")
  @HttpCode(201)
  async studentPost(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const limite = rateLimit(`student-post:${id}`, 10, 60_000);
    if (!limite.ok) throw new HttpException({ mensagem: "Espera um pouco pra publicar de novo." }, 429);

    const parsed = StudentPostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Escreve algo antes de publicar." });

    const { usuarioId, escolaId } = req.auth;
    const contexto = await this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, usuarioId, escolaId);
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
     * aluno é publicado do mesmo jeito — como num app real quando ninguém
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
          textoDoAluno: parsed.data.texto,
          contexto: "O ALUNO PUBLICOU UM POST no feed.",
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

  /** Personas reagem ao que o aluno acabou de escrever. Vazio é resultado válido. */
  @Post(":id/reacoes")
  @Roles("aluno")
  @HttpCode(200)
  async reacoes(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId } = req.auth;

    const corpo = ReacoesSchema.safeParse(body);
    if (!corpo.success) return { reacoes: [] };

    const contexto = await this.prisma.comTenancy(async (tx) => {
      const run = await runDoAluno(tx, id, usuarioId, escolaId);
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

    // 12 reações por sessão: aluno comentando sem parar não queima a cota da turma.
    const cota = rateLimit(`reacoes:${id}`, 12, 30 * 60_000);
    if (!cota.ok) return { reacoes: [], limite: true };

    const { reacoes } = await gerarReacoes(this.ia, {
      elenco: contexto.autores.map((autor) => ({
        handle: autor.handle,
        displayName: autor.displayName,
        voz: autor.voz ?? "fala de forma simples e direta",
        perfil: autor.perfilAfim ?? "",
      })),
      perguntaChave: contexto.perguntaChave,
      textoDoAluno: corpo.data.texto,
      contexto:
        corpo.data.tipo === "post_do_aluno"
          ? "O ALUNO PUBLICOU UM POST no feed."
          : "O ALUNO COMENTOU num post do feed.",
      quantas: corpo.data.tipo === "post_do_aluno" ? 3 : 1,
    });

    if (reacoes.length === 0) return { reacoes: [] };

    await this.prisma.comTenancy((tx) =>
      tx.comentarioDaSessao.createMany({
        data: reacoes.map((reacao) => ({
          escolaId,
          runId: id,
          postId: corpo.data.tipo === "comentario" ? corpo.data.postId : null,
          studentPostId: corpo.data.tipo === "post_do_aluno" ? corpo.data.studentPostId : null,
          handle: reacao.handle,
          deIa: true,
          texto: reacao.texto,
        })),
      }),
    );

    return { reacoes };
  }

  /**
   * GET /runs/:id/dossie — o aluno lê o próprio; o professor, qualquer um da
   * sua atividade (para projetar em aula). Aqui lado/intensidade PODEM
   * aparecer: o disfarce já caiu.
   */
  @Get(":id/dossie")
  @Roles("aluno", "professor")
  async dossie(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId, perfil } = req.auth;

    const run = await this.prisma.comTenancy((tx) =>
      tx.run.findFirst({
        where:
          perfil === "aluno"
            ? { id, alunoId: usuarioId, escolaId }
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
    if (perfil === "aluno" && !PODE_LER.includes(run.fase)) naoEncontrado();

    try {
      return await montarRespostaDossie(this.prisma, id, escolaId);
    } catch (falha) {
      if (falha instanceof DossieAindaNaoExiste) naoEncontrado();
      throw falha;
    }
  }
}

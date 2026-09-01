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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { DIVISOR_TESE, MINIMOS_ATIVACAO } from "../comum/insta/defaults";
import { antagonismoSchema } from "../comum/insta/tipos";
import { atividadeDoProfessor, ehUuid, naoEncontrado } from "../motor/guardas";
import { ErroDeGeracao } from "../ai/provider";
import { PrismaService } from "../prisma/prisma.service";
import { planejarLotes, type Proporcoes } from "./plano";
import { GeracaoService } from "./geracao.service";
import { Contrato } from "../openapi/contrato";
import {
  AntagonismoDoProfessorSchema,
  DestilarSchema,
  DestiladoSchema,
  EditarPostSchema,
  FiltrosSchema,
  GradeDePostsSchema,
  GeracaoDisparadaSchema,
  OkSchema,
  ProgressoDaGeracaoSchema,
  RegenerarSchema,
} from "./contrato-de-rotas";

/**
 * O fluxo de GERAÇÃO de conteúdo do professor — porte fiel dos handlers
 * distill/antagonismo/generate/progress/posts (+ ações de post) do origem.
 * Superfície de professor: lado/perfil/intensidade são visíveis.
 */

const TAMANHO_PAGINA = 24;

/**
 * Ordenação da grade de revisão do professor. O `id` não é enfeite: é o que
 * faz a ordenação ser TOTAL.
 *
 * Os posts entram por `createMany` dentro de uma transação (`worker.ts`), e o
 * `now()` do Postgres é o timestamp de início da transação — o lote inteiro
 * compartilha o mesmo `created_at`. Com a chave empatada, `ORDER BY created_at
 * LIMIT/OFFSET` não tem ordem definida: a mesma linha vem em duas páginas e
 * outra nunca vem. Medido no app origem: 207 de 208 posts visíveis, de forma
 * reprodutível. Exportada porque `tests/geracao-paginacao.spec.ts` pagina com
 * ela — travar a query é o ponto do teste.
 */
export const ORDEM_DA_GRADE: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];
type Autenticado = { auth: AuthClaims };

@Controller()
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class GeracaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geracao: GeracaoService,
  ) {}

  /** Passo 2: a IA propõe a pergunta-chave e destila o antagonismo. */
  @Post("atividades/:id/destilar")
  @HttpCode(200)
  @Contrato({
    resumo: "Destila a pergunta-chave e os dois lados a partir do recorte.",
    descricao:
      "O professor pode mandar a `perguntaChave` pronta — e aí `perguntaOrigem` sai como `professor`. Sem ela, a IA destila e a origem é `ia`.",
    params: z.object({ id: z.string().uuid() }),
    corpo: DestilarSchema,
    resposta: DestiladoSchema,
  })
  async destilar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const limite = rateLimit(`distill:${req.auth.usuarioId}`, 12, 60_000);
    if (!limite.ok) {
      throw new HttpException({ mensagem: "Muitas análises seguidas. Aguarde um instante." }, 429);
    }

    const atividade = await this.prisma.comTenancy((tx) =>
      atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId),
    );
    if (!atividade) naoEncontrado();

    if (["gerando", "revisao", "ativa"].includes(atividade.status)) {
      throw new HttpException(
        { mensagem: "Esta atividade já passou da etapa de análise da pergunta." },
        409,
      );
    }

    const parsed = DestilarSchema.safeParse(body ?? {});
    const perguntaDoProfessor = parsed.success ? parsed.data.perguntaChave : undefined;

    // A chamada de IA fica FORA de transação (pode levar dezenas de segundos).
    /**
     * O provedor de IA falhando aqui é 503, NÃO 500.
     *
     * Diferente dos outros três consumidores de `generateJson`, a destilação
     * não tem fallback: as reações ao vivo caem em lista vazia (o feed fica
     * quieto, como um app em que ninguém respondeu) e a geração de posts vira
     * job falho que o painel de progresso mostra. Aqui não há o que degradar —
     * sem os dois lados não existe atividade.
     *
     * Deixar a exceção subir dava `{"statusCode":500,"message":"Internal
     * server error"}`, e nem o log salvava: o `ErroDeGeracao` guarda a causa
     * real em `detalhe`, e o `ExceptionsHandler` do Nest só imprime a
     * `message`. Em `AI_PROVIDER=mock` — o modo que existe para subir sem GCP —
     * `generateJson` lança SEMPRE, então criar atividade era impossível e nada
     * na tela nem no terminal dizia por quê. Custou uma tarde para descobrir
     * que a resposta estava num `ps eww` do processo da api.
     *
     * 503 e não 500 porque o pedido está correto e tentar de novo pode
     * funcionar — a falha é de uma dependência, não da requisição.
     */
    let antagonismo;
    try {
      antagonismo = await this.geracao.destilar({
        // Vazio na primeira análise: é a IA que propõe.
        perguntaChave: perguntaDoProfessor ?? null,
        disciplina: atividade.disciplina,
        recorte: atividade.recorte,
        temaGeral: atividade.temaGeral,
        contextoAula: atividade.contextoAula,
      });
    } catch (falha) {
      /* `detalhe` primeiro, `message` como reserva: o VertexProvider põe a causa
         real no `detalhe` e deixa a `message` genérica, enquanto o MockProvider
         diz tudo na `message` ("[mock] generateJson sem implementação"). Ler só
         um dos dois deixaria justamente o caso do mock sem diagnóstico — que é
         o que esta mudança existe para resolver. */
      const causa = falha instanceof ErroDeGeracao ? (falha.detalhe ?? falha.message) : undefined;
      throw new HttpException(
        {
          mensagem:
            "A análise da pergunta não pôde ser gerada agora. Tente de novo em instantes." +
            (causa ? ` (${causa.slice(0, 200)})` : ""),
        },
        503,
      );
    }

    const perguntaChave = antagonismo.perguntas_candidatas[antagonismo.escolhida]!.pergunta;

    await this.prisma.comTenancy((tx) =>
      tx.activity.update({
        where: { id },
        data: {
          perguntaChave,
          perguntaOrigem: perguntaDoProfessor ? "professor" : "ia",
          // Reanalisar zera a aprovação: o professor precisa validar de novo.
          antagonismo: { ...antagonismo, aprovado: false } as unknown as Prisma.InputJsonObject,
          categoriasNeutras: antagonismo.categorias_neutras_sugeridas,
          neutrosNoTema: antagonismo.neutros_no_tema_sugeridos,
          status: "antagonismo",
        },
      }),
    );

    return {
      antagonismo,
      perguntaChave,
      perguntaOrigem: perguntaDoProfessor ? "professor" : "ia",
    };
  }

  /** O professor edita/aprova os dois lados e as categorias neutras. */
  @Patch("atividades/:id/antagonismo")
  @Contrato({
    resumo: "O professor aprova (ou reescreve) os dois lados e os neutros.",
    descricao:
      "Nada é gerado antes desta aprovação: os dois lados e as justificativas de eixo são o que decide de que lado cada estudante começa, e isso não sai da IA direto para a turma.",
    params: z.object({ id: z.string().uuid() }),
    corpo: AntagonismoDoProfessorSchema,
    resposta: OkSchema,
    notas: ["`forcar: true` passa por cima do medidor de equilíbrio, de propósito e explicitamente."],
  })
  async aprovarAntagonismo(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const parsed = AntagonismoDoProfessorSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        mensagem: "Confira os dois lados antes de aprovar.",
        campos: parsed.error.flatten().fieldErrors,
      });
    }
    const { antagonismo, categoriasNeutras, neutrosNoTema, forcar } = parsed.data;
    if (!antagonismo.equilibrio.ok && !forcar) {
      throw new HttpException(
        {
          mensagem:
            antagonismo.equilibrio.aviso ??
            "Essa pergunta não sustenta dois lados defensáveis — a bolha não se formaria.",
          equilibrioReprovado: true,
        },
        422,
      );
    }

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      // A aprovação é explícita e fica gravada: é ela que libera a geração.
      await tx.activity.update({
        where: { id },
        data: {
          antagonismo: {
            ...antagonismo,
            aprovado: true,
            aprovadoEm: new Date().toISOString(),
            ...(forcar ? { aprovadoComOverride: true } : {}),
          } as unknown as Prisma.InputJsonObject,
          /** A pergunta aprovada é a candidata escolhida — fixa a escolha dele. */
          perguntaChave:
            antagonismo.perguntas_candidatas[antagonismo.escolhida]?.pergunta ??
            atividade.perguntaChave,
          categoriasNeutras,
          neutrosNoTema,
          status: "antagonismo",
        },
      });
      return { ok: true };
    });
  }

  /** Exige antagonismo aprovado; cria a fila e dispara o worker in-process. */
  @Post("atividades/:id/gerar")
  @HttpCode(200)
  @Contrato({
    resumo: "Enfileira a geração dos posts.",
    descricao:
      "**Duas respostas, e a diferença importa**: `retomado: true` quando havia uma geração parada no meio (nada novo foi enfileirado), e `lotes: N` quando ela começou agora.",
    params: z.object({ id: z.string().uuid() }),
    resposta: GeracaoDisparadaSchema,
  })
  async gerar(@Param("id") id: string, @Req() req: Autenticado) {
    const { usuarioId, escolaId } = req.auth;
    const atividade = await this.prisma.comTenancy((tx) =>
      atividadeDoProfessor(tx, id, usuarioId, escolaId),
    );
    if (!atividade) naoEncontrado();

    const antagonismo = antagonismoSchema.safeParse(atividade.antagonismo);
    const aprovado = (atividade.antagonismo as { aprovado?: boolean } | null)?.aprovado === true;

    // Sem aprovação explícita do professor, nada é gerado.
    if (!antagonismo.success || !aprovado) {
      throw new HttpException(
        { mensagem: "Aprove os dois lados da pergunta antes de gerar o conteúdo." },
        409,
      );
    }

    if (atividade.status === "gerando") {
      this.geracao.dispararWorker(escolaId, id);
      return { ok: true, retomado: true };
    }

    const lotes = planejarLotes({
      qtdPostsTese: atividade.qtdPostsTese,
      proporcoes: atividade.proporcoes as unknown as Proporcoes,
      categoriasNeutras: atividade.categoriasNeutras,
      neutrosNoTema: atividade.neutrosNoTema,
    });

    await this.geracao.iniciarGeracao(escolaId, id, lotes);
    return { ok: true, lotes: lotes.length };
  }

  /** Polling de 2s do painel. Também retoma fila órfã após restart. */
  @Get("atividades/:id/geracao/progresso")
  @Contrato({
    resumo: "O progresso da geração — o alvo do polling da tela.",
    descricao:
      "As imagens são contadas em três estados porque `fallback` **não é erro**: a arte procedural entra no lugar e o feed nunca fica com buraco.",
    params: z.object({ id: z.string().uuid() }),
    resposta: ProgressoDaGeracaoSchema,
  })
  async progresso(@Param("id") id: string, @Req() req: Autenticado) {
    const atividade = await this.prisma.comTenancy((tx) =>
      atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId),
    );
    if (!atividade) naoEncontrado();
    return this.geracao.progresso(req.auth.escolaId, id);
  }

  /** Grade de revisão do professor. Aqui lado/intensidade são visíveis. */
  @Get("atividades/:id/posts")
  @Contrato({
    resumo: "A grade de revisão do professor, paginada e filtrável.",
    descricao:
      "A ordenação é `(created_at, id)`, e o `id` **não é enfeite**: os posts entram por `createMany` numa transação, então o lote inteiro compartilha o mesmo `created_at`. Com a chave empatada, `LIMIT/OFFSET` não tem ordem definida — a mesma linha vem em duas páginas e outra nunca vem (medido no app de origem: 207 de 208 visíveis, de forma reprodutível).",
    params: z.object({ id: z.string().uuid() }),
    query: FiltrosSchema,
    resposta: GradeDePostsSchema,
    notas: [
      "A `matriz` 2×4 existe para o professor ver de relance se alguma linguagem ficou fraca: os lados podem estar 50/50 e um perfil inteiro estar vazio.",
      "24 posts por página.",
    ],
  })
  async posts(@Param("id") id: string, @Query() query: Record<string, string>, @Req() req: Autenticado) {
    const parsed = FiltrosSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Filtro inválido." });
    const { lado, perfil, intensidade, categoria, imagem, aprovado, page } = parsed.data;

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      const where = {
        activityId: id,
        ...(lado ? { lado } : {}),
        ...(perfil ? { perfil } : {}),
        ...(intensidade ? { intensidade } : {}),
        ...(categoria ? { categoria } : {}),
        ...(imagem ? { imageStatus: imagem } : {}),
        ...(aprovado ? { aprovado: aprovado === "sim" } : {}),
      };

      const [total, posts, categorias, resumo, matriz] = await Promise.all([
        tx.post.count({ where }),
        tx.post.findMany({
          where,
          orderBy: ORDEM_DA_GRADE,
          skip: (page - 1) * TAMANHO_PAGINA,
          take: TAMANHO_PAGINA,
          select: {
            id: true,
            lado: true,
            perfil: true,
            intensidade: true,
            categoria: true,
            caption: true,
            hashtags: true,
            emotionalHook: true,
            imageUrl: true,
            imageStatus: true,
            imageBrief: true,
            likesCount: true,
            timestampLabel: true,
            aprovado: true,
            author: { select: { handle: true, displayName: true, verificado: true } },
            comments: {
              orderBy: { ordem: "asc" },
              select: { id: true, handle: true, texto: true, likesCount: true, ordem: true },
            },
          },
        }),
        tx.post.findMany({
          where: { activityId: id },
          distinct: ["categoria"],
          select: { categoria: true },
          orderBy: { categoria: "asc" },
        }),
        tx.post.groupBy({
          by: ["lado"],
          where: { activityId: id, aprovado: true },
          _count: { _all: true },
        }),
        /**
         * Matriz 2×4 para o professor ver de relance se alguma linguagem ficou
         * fraca — os lados podem estar 50/50 e um perfil inteiro estar vazio.
         */
        tx.post.groupBy({
          by: ["lado", "perfil"],
          where: { activityId: id, aprovado: true, lado: { in: ["A", "B"] } },
          _count: { _all: true },
        }),
      ]);

      return {
        posts,
        total,
        page,
        paginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)),
        categorias: categorias.map((l) => l.categoria),
        aprovadosPorLado: Object.fromEntries(resumo.map((l) => [l.lado, l._count._all])),
        matriz: matriz.map((l) => ({ lado: l.lado, perfil: l.perfil, aprovados: l._count._all })),
        esperadoPorCelula: Math.floor(atividade.qtdPostsTese / DIVISOR_TESE),
        /**
         * A fração abaixo da qual a célula BLOQUEIA a ativação. Vai no payload
         * porque a tela precisa pintar de vermelho exatamente o que a api vai
         * recusar: o client tinha a sua própria constante (0.9), a api a dela
         * (0.1), e uma célula entre as duas saía amarela — "não bloqueia", dizia
         * a legenda — para só então o professor levar 422 ao clicar em ativar.
         */
        fracaoMinimaPorCelula: MINIMOS_ATIVACAO.fracaoMinimaPorCelula,
      };
    });
  }

  /** Edição do professor: caption, hashtags, comentários e aprovação. */
  @Patch("posts/:id")
  @Contrato({
    resumo: "Edita o post: legenda, hashtags, comentários e aprovação.",
    params: z.object({ id: z.string().uuid() }),
    corpo: EditarPostSchema,
    resposta: OkSchema,
  })
  async editarPost(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const parsed = EditarPostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Confira o texto antes de salvar." });
    const { caption, hashtags, aprovado, comentarios } = parsed.data;

    return this.prisma.comTenancy(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id, escolaId: req.auth.escolaId, activity: { professorId: req.auth.usuarioId } },
        select: { id: true, comments: { select: { id: true } } },
      });
      if (!post) naoEncontrado();

      // Um comentário só pode ser editado pelo post a que pertence — sem isso,
      // um id qualquer no corpo alcançaria comentários de outra atividade.
      const idsDoPost = new Set(post.comments.map((c) => c.id));
      if (comentarios?.some((c) => !idsDoPost.has(c.id))) {
        throw new BadRequestException({ mensagem: "Esse comentário não é deste post." });
      }

      await tx.post.update({
        where: { id },
        data: {
          ...(caption !== undefined ? { caption } : {}),
          ...(hashtags !== undefined
            ? { hashtags: hashtags.map((tag) => `#${tag.trim().replace(/^#+/, "").toLowerCase()}`) }
            : {}),
          ...(aprovado !== undefined ? { aprovado } : {}),
        },
      });
      for (const comentario of comentarios ?? []) {
        await tx.postComment.update({ where: { id: comentario.id }, data: { texto: comentario.texto } });
      }
      return { ok: true };
    });
  }

  /** Excluir um post gerado (a grade de revisão tem essa ação). */
  @Delete("posts/:id")
  @Contrato({
    resumo: "Exclui um post da grade.",
    params: z.object({ id: z.string().uuid() }),
    resposta: OkSchema,
  })
  async excluirPost(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id, escolaId: req.auth.escolaId, activity: { professorId: req.auth.usuarioId } },
        select: { id: true },
      });
      if (!post) naoEncontrado();

      // Sem isto, o job de imagem do post apagado fica órfão na fila.
      await tx.generationJob.deleteMany({
        where: {
          tipo: "imagem",
          status: { in: ["pendente", "rodando"] },
          payload: { path: ["postId"], equals: id },
        },
      });
      await tx.post.delete({ where: { id } });
      return { ok: true };
    });
  }

  /** Cria um job de regeração (texto ou imagem) e acorda o worker. */
  @Post("posts/:id/regenerar")
  @HttpCode(200)
  @Contrato({
    resumo: "Regenera o texto ou a imagem de um post.",
    params: z.object({ id: z.string().uuid() }),
    corpo: RegenerarSchema,
    resposta: OkSchema,
  })
  async regenerar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const parsed = RegenerarSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Alvo inválido." });
    const { escolaId } = req.auth;

    const post = await this.prisma.comTenancy(async (tx) => {
      const encontrado = await tx.post.findFirst({
        where: { id, escolaId, activity: { professorId: req.auth.usuarioId } },
        select: { id: true, activityId: true, lado: true, intensidade: true, categoria: true, imageBrief: true },
      });
      if (!encontrado) naoEncontrado();

      if (parsed.data.alvo === "imagem") {
        await tx.post.update({ where: { id }, data: { imageStatus: "pendente", imageUrl: null } });
        await tx.generationJob.create({
          data: {
            escolaId,
            activityId: encontrado.activityId,
            tipo: "imagem",
            payload: { postId: encontrado.id, imageBrief: encontrado.imageBrief },
          },
        });
      } else {
        // Texto: gera 1 post novo com o mesmo mix e apaga o antigo ao concluir.
        await tx.generationJob.create({
          data: {
            escolaId,
            activityId: encontrado.activityId,
            tipo: "posts_lote",
            payload: {
              lado: encontrado.lado,
              intensidade: encontrado.intensidade,
              categoria: encontrado.categoria,
              quantidade: 1,
              substituiPostId: encontrado.id,
              reposicao: true,
            },
          },
        });
      }
      return encontrado;
    });

    this.geracao.dispararWorker(escolaId, post.activityId);
    return { ok: true };
  }
}

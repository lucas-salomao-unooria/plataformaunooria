import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ehUuid, naoEncontrado } from "./guardas";
import { z } from "zod";
import { Contrato } from "../openapi/contrato";
import { ComentariosDoPostSchema } from "../geracao/contrato-de-rotas";

/**
 * GET /posts/:id/comentarios — comentários completos do sheet. Lazy: só o que
 * o card precisa quando o aluno abre. Nada de lado/intensidade na resposta.
 *
 * Devolve os comentários do post **mais os que o próprio aluno escreveu**
 * nesta sessão (sem isso, reabrir o sheet apagava da tela o que ele acabou de
 * comentar). Os comentários da sessão são os DELE, nunca de outro: a consulta
 * filtra pela run do aluno. Professor e admin leem só os do post.
 */
@Controller("posts")
@UseGuards(OidcGuard)
export class PostsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":id/comentarios")
  @Contrato({
    resumo: "Os comentários de um post do feed.",
    descricao:
      "Na ordem de uma CONVERSA: o comentário do aluno no topo (como o Instagram faz com o seu), as reações da IA logo depois, e os do roteiro por último.",
    params: z.object({ id: z.string().uuid() }),
    resposta: ComentariosDoPostSchema,
    notas: ["`doAluno` distingue o que a criança escreveu do que veio do roteiro — só o aluno da própria run vê os dele."],
  })
  async comentarios(@Param("id") id: string, @Req() req: { auth: AuthClaims }) {
    if (!ehUuid(id)) naoEncontrado();
    const { usuarioId, escolaId, perfil } = req.auth;

    return this.prisma.comTenancy(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id, escolaId },
        select: {
          id: true,
          comments: {
            orderBy: { ordem: "asc" },
            select: { id: true, handle: true, texto: true, likesCount: true, timestampLabel: true },
          },
        },
      });
      if (!post) naoEncontrado();

      const daSessao =
        perfil === "aluno"
          ? await tx.comentarioDaSessao.findMany({
              where: { postId: id, run: { alunoId: usuarioId } },
              orderBy: { createdAt: "asc" },
              select: { id: true, texto: true, handle: true, deIa: true },
            })
          : [];
      const meus = daSessao.filter((c) => !c.deIa);
      const reacoes = daSessao.filter((c) => c.deIa);

      const usuario =
        meus.length > 0
          ? await tx.user.findUnique({ where: { id: usuarioId }, select: { username: true } })
          : null;

      /** O comentário do aluno entra no TOPO, como o Instagram faz com o seu;
       *  as reações vêm logo depois — é a ordem de uma conversa. */
      const comments = [
        ...meus.map((c) => ({
          id: c.id,
          handle: `@${usuario?.username ?? "voce"}`,
          texto: c.texto,
          likesCount: 0,
          timestampLabel: "agora",
          doAluno: true,
        })),
        ...reacoes.map((r) => ({
          id: r.id,
          handle: r.handle ?? "@alguem",
          texto: r.texto,
          likesCount: 0,
          timestampLabel: "agora",
          doAluno: false,
        })),
        ...post.comments.map((c) => ({ ...c, doAluno: false })),
      ];

      return { comments, total: comments.length };
    });
  }
}

import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import {
  ConcluirSchema,
  OkSchema,
  ProgressoSalvoSchema,
  SalvarSchema,
} from "./contrato-de-rotas";

@Controller("progresso")
@UseGuards(OidcGuard)
export class ProgressoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":expId")
  @Contrato({
    resumo: "O progresso do aluno autenticado nesta experiência.",
    descricao:
      "Escopado por `escola_id` + `aluno_id` do token — nunca por parâmetro. O aluno da requisição é o único progresso que esta rota alcança.",
    params: z.object({ expId: z.string() }),
    resposta: ProgressoSalvoSchema,
    notas: ["`dados: null` = a criança ainda não começou; não é erro."],
  })
  async carregar(@Param("expId") expId: string, @Req() req: { auth: AuthClaims }) {
    // escopado por escola_id + aluno_id (regra inviolável nº 1); a transação
    // do comTenancy também arma a RLS como rede de segurança
    const r = await this.prisma.comTenancy((tx) =>
      tx.progresso.findUnique({
        where: {
          escolaId_alunoId_expId: {
            escolaId: req.auth.escolaId,
            alunoId: req.auth.usuarioId,
            expId,
          },
        },
      }),
    );
    return { dados: r?.dados ?? null };
  }

  /**
   * Registro da CONCLUSÃO (exp:concluir do protocolo), gravado pelo hub.
   * Merge no jsonb — nunca sobrescreve o progresso que a experiência salvou.
   * Isto é progresso ("terminou"), não nota: pontuação que vale nota é
   * recalculada server-side pelo módulo de avaliação (regra inviolável nº 3).
   */
  @Post(":expId/concluir")
  @Contrato({
    resumo: "Registra a conclusão da experiência.",
    descricao:
      "O `exp:concluir` do protocolo da bridge, gravado pelo hub. **Merge** no jsonb: nunca sobrescreve o que a experiência salvou.",
    params: z.object({ expId: z.string() }),
    corpo: ConcluirSchema,
    resposta: OkSchema,
    notas: [
      "Isto é progresso (\"terminou\"), NÃO nota. Pontuação que vale nota é recalculada server-side pelo módulo de avaliação (regra 3).",
    ],
  })
  async concluir(@Param("expId") expId: string, @Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const payload = z
      .object({ score: z.number().optional(), dados: z.record(z.unknown()).optional() })
      .parse(body);
    const conclusao = { em: new Date().toISOString(), ...payload };
    await this.prisma.comTenancy(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO progresso (escola_id, aluno_id, exp_id, dados, atualizado_em)
        VALUES (${req.auth.escolaId}, ${req.auth.usuarioId}, ${expId},
                jsonb_build_object('__conclusao', ${JSON.stringify(conclusao)}::jsonb), now())
        ON CONFLICT (escola_id, aluno_id, exp_id) DO UPDATE
          SET dados = progresso.dados || jsonb_build_object('__conclusao', ${JSON.stringify(conclusao)}::jsonb),
              atualizado_em = now()`;
    });
    return { ok: true };
  }

  @Post(":expId")
  @Contrato({
    resumo: "Salva o progresso da experiência.",
    descricao: "Substitui `dados` inteiro. É a experiência que decide o que cabe ali.",
    params: z.object({ expId: z.string() }),
    corpo: SalvarSchema,
    resposta: OkSchema,
  })
  async salvar(@Param("expId") expId: string, @Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    // Zod valida a forma; o cast diz ao Prisma que é JSON serializável (o
    // z.record garante objeto plano vindo de JSON.parse do body).
    const { dados } = z.object({ dados: z.record(z.unknown()) }).parse(body) as {
      dados: Prisma.InputJsonObject;
    };
    await this.prisma.comTenancy((tx) =>
      tx.progresso.upsert({
        where: {
          escolaId_alunoId_expId: {
            escolaId: req.auth.escolaId,
            alunoId: req.auth.usuarioId,
            expId,
          },
        },
        create: { escolaId: req.auth.escolaId, alunoId: req.auth.usuarioId, expId, dados },
        update: { dados },
      }),
    );
    return { ok: true };
  }
}

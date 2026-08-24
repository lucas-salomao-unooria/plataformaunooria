import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Pool } from "pg";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }); // pooler externo faz o resto

@Controller("progresso")
@UseGuards(OidcGuard)
export class ProgressoController {
  @Get(":expId")
  async carregar(@Param("expId") expId: string, @Req() req: { auth: AuthClaims }) {
    const r = await pool.query(
      // escopado por escola_id + aluno_id (regra inviolável nº 1)
      "SELECT dados FROM progresso WHERE escola_id=$1 AND aluno_id=$2 AND exp_id=$3",
      [req.auth.escolaId, req.auth.alunoId, expId],
    );
    return { dados: r.rows[0]?.dados ?? null };
  }

  @Post(":expId")
  async salvar(@Param("expId") expId: string, @Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { dados } = z.object({ dados: z.record(z.unknown()) }).parse(body);
    await pool.query(
      `INSERT INTO progresso (escola_id, aluno_id, exp_id, dados, atualizado_em)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (escola_id, aluno_id, exp_id) DO UPDATE SET dados=$4, atualizado_em=now()`,
      [req.auth.escolaId, req.auth.alunoId, expId, JSON.stringify(dados)],
    );
    return { ok: true };
  }
}

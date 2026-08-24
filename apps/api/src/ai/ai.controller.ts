import { Body, Controller, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { PROMPTS } from "./prompts";
import type { AiProvider } from "./provider";
import { VertexProvider } from "./vertex.provider";
import { MockProvider } from "./mock.provider";

const provider: AiProvider =
  process.env.AI_PROVIDER === "mock" ? new MockProvider() : new VertexProvider();

// Quota diária em memória (por instância). TODO produção: mover p/ Redis ou Postgres.
const usoDiario = new Map<string, { dia: string; tokens: number }>();
const QUOTA = Number(process.env.AI_DAILY_TOKEN_QUOTA_PER_ALUNO ?? 20000);

const GerarSchema = z.object({
  expId: z.string(),
  atividade: z.string().max(200),
  mensagem: z.string().max(2000),
});

@Controller("ai")
@UseGuards(OidcGuard)
export class AiController {
  @Post("gerar")
  async gerar(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { expId, atividade, mensagem } = GerarSchema.parse(body);

    const hoje = new Date().toISOString().slice(0, 10);
    const uso = usoDiario.get(req.auth.alunoId);
    const tokensHoje = uso?.dia === hoje ? uso.tokens : 0;
    if (tokensHoje >= QUOTA) throw new HttpException("Quota diária de IA atingida", 429);

    const system = PROMPTS[expId] ?? PROMPTS["tutor"]!;
    const result = await provider.generate({
      system: `${system}\nSérie do aluno: ${req.auth.turmaId ?? "n/d"}. Atividade: ${atividade}.`,
      user: mensagem,
    });
    usoDiario.set(req.auth.alunoId, { dia: hoje, tokens: tokensHoje + result.tokensUsados });
    return { texto: result.texto };
  }
}

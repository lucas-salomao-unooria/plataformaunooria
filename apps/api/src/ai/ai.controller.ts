import { Body, Controller, HttpException, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { PROMPTS } from "./prompts";
import { AI_PROVIDER, type AiProvider } from "./provider";
import { QuotaService } from "./quota.service";

const GerarSchema = z.object({
  expId: z.string(),
  atividade: z.string().max(200),
  mensagem: z.string().max(2000),
});

@Controller("ai")
@UseGuards(OidcGuard)
export class AiController {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  @Post("gerar")
  async gerar(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { expId, atividade, mensagem } = GerarSchema.parse(body);
    const { escolaId, usuarioId } = req.auth;

    // Quota persistida (tabela ia_uso_diario): sobrevive a restart e vale para
    // todas as instâncias — o Map em memória de antes não fazia nem uma coisa
    // nem outra.
    if (!(await this.quota.temSaldo(escolaId, usuarioId))) {
      throw new HttpException("Quota diária de IA atingida", 429);
    }

    const system = PROMPTS[expId] ?? PROMPTS["tutor"]!;
    const result = await this.provider.generate({
      system: `${system}\nSérie do aluno: ${req.auth.turmaId ?? "n/d"}. Atividade: ${atividade}.`,
      user: mensagem,
    });

    await this.quota.consumir(escolaId, usuarioId, result.tokensUsados);
    return { texto: result.texto };
  }
}

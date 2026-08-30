import { Body, Controller, HttpException, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Contrato } from "../openapi/contrato";
import { GerarRespostaSchema, GerarSchema } from "./contrato-de-rotas";
import { PROMPTS } from "./prompts";
import { AI_PROVIDER, type AiProvider } from "./provider";
import { QuotaService } from "./quota.service";

@Controller("ai")
@UseGuards(OidcGuard)
export class AiController {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  @Post("gerar")
  @Contrato({
    resumo: "Conversa com o tutor de IA da experiência.",
    descricao:
      "Única porta de IA para o cliente. O prompt de sistema é escolhido no servidor pelo `expId` e **nunca sai daqui** — segredo em bundle de experiência é regra 2.",
    corpo: GerarSchema,
    resposta: GerarRespostaSchema,
    notas: [
      "Quota diária POR PERFIL (`AI_DAILY_TOKEN_QUOTA_PER_ESTUDANTE` / `_PROFESSOR`), persistida em `ia_uso_diario`: `temSaldo` ANTES, `consumir` depois. Sem saldo, **429**.",
      "A série do estudante vai ao prompt a partir do TOKEN, não do corpo.",
    ],
  })
  async gerar(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { expId, atividade, mensagem } = GerarSchema.parse(body);
    const { escolaId, usuarioId } = req.auth;

    // Quota persistida (tabela ia_uso_diario): sobrevive a restart e vale para
    // todas as instâncias — o Map em memória de antes não fazia nem uma coisa
    // nem outra.
    if (!(await this.quota.temSaldo(escolaId, usuarioId, req.auth.perfil))) {
      throw new HttpException("Quota diária de IA atingida", 429);
    }

    const system = PROMPTS[expId] ?? PROMPTS["tutor"]!;
    const result = await this.provider.generate({
      system: `${system}\nSérie do estudante: ${req.auth.turmaId ?? "n/d"}. Atividade: ${atividade}.`,
      user: mensagem,
    });

    await this.quota.consumir(escolaId, usuarioId, result.tokensUsados);
    return { texto: result.texto };
  }
}

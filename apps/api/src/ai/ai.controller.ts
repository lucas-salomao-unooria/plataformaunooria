import { Body, Controller, HttpException, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { rotuloDaSerie, SerieSchema } from "../comum/series";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
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
    private readonly prisma: PrismaService,
  ) {}

  /**
   * A SÉRIE de quem está perguntando, para o tutor falar com a idade certa.
   *
   * O token carrega `turma_id`, não série. A linha do prompt dizia "Série do
   * estudante" e injetava o UUID da turma: o modelo recebia um identificador
   * interno onde devia receber "4º ano", e ninguém percebia porque a resposta
   * saía plausível de qualquer jeito. Sem turma (professor, estudante sem
   * enturmamento) a linha inteira SOME — "Série: n/d" é ruído que o modelo
   * tenta interpretar.
   *
   * `turmas` está fora da RLS: o `escola_id` no `where` é a única tranca.
   */
  private async serieDoPedido(auth: AuthClaims): Promise<string | null> {
    if (!auth.turmaId) return null;
    const turma = await this.prisma.turma.findFirst({
      where: { id: auth.turmaId, escolaId: auth.escolaId },
      select: { serie: true },
    });
    const serie = SerieSchema.safeParse(turma?.serie);
    return serie.success ? rotuloDaSerie(serie.data) : null;
  }

  @Post("gerar")
  @Contrato({
    resumo: "Conversa com o tutor de IA da experiência.",
    descricao:
      "Única porta de IA para o cliente. O prompt de sistema é escolhido no servidor pelo `expId` e **nunca sai daqui** — segredo em bundle de experiência é regra 2.",
    corpo: GerarSchema,
    resposta: GerarRespostaSchema,
    notas: [
      "Quota diária POR PERFIL (`AI_DAILY_TOKEN_QUOTA_PER_ESTUDANTE` / `_PROFESSOR`), persistida em `ia_uso_diario`: `temSaldo` ANTES, `consumir` depois. Sem saldo, **429**.",
      "A série do estudante vai ao prompt RESOLVIDA da turma do token (`turmas.serie` → \"4º ano\"), nunca vinda do corpo. Sem turma, a linha some do prompt.",
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
    const serie = await this.serieDoPedido(req.auth);
    const contexto = serie ? `Série do estudante: ${serie}. ` : "";
    const result = await this.provider.generate({
      system: `${system}\n${contexto}Atividade: ${atividade}.`,
      user: mensagem,
    });

    await this.quota.consumir(escolaId, usuarioId, result.tokensUsados);
    return { texto: result.texto };
  }
}

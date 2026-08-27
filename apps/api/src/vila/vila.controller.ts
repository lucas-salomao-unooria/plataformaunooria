import { Body, Controller, HttpCode, HttpException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { VilaService } from "./vila.service";

/**
 * Rotas do ALUNO da exp-70-vila-do-lume.
 *
 * O gabarito da missão "A Noite Longa" (`legitima` por cartão) fica no servidor:
 * o cliente manda qual opção escolheu, a api corrige (regra inviolável nº 3). E
 * a BOLHA é atribuída aqui, nunca pelo cliente — era `alunoSlot % 3` no
 * navegador, o que punha nas mãos do bundle a condição do próprio instrumento.
 *
 * Identidade sempre do token, nunca do body: o payload não traz aluno nem turma.
 */

const AbrirSchema = z.object({
  /** versão do bundle que está jogando. Fica na linha porque quem estava com a
   *  aba aberta durante um publish termina com a anterior. */
  expVersion: z.string().min(1).max(32),
});

const UUID = z.string().uuid();

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, teto: number) {
  const r = rateLimit(`vila:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
}

@Controller("vila")
@UseGuards(OidcGuard, RolesGuard)
@Roles("aluno")
export class VilaController {
  constructor(private readonly vila: VilaService) {}

  /**
   * Abre a partida. Devolve o id, a bolha e OS CARTÕES DESTA CRIANÇA — sem
   * gabarito e sem os das outras bolhas, porque a explicação final da missão
   * depende de ser a primeira vez que a turma vê as outras versões.
   */
  @Post("sessoes")
  @HttpCode(201)
  async abrir(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 20);
    const dados = AbrirSchema.parse(body);
    return this.vila.abrir(req.auth.escolaId, req.auth.usuarioId, dados.expVersion);
  }

  /**
   * Fecha a partida. Idempotente: a criança pode recarregar, e o `pagehide` pode
   * disparar duas vezes.
   */
  @Post("sessoes/:id/concluir")
  @HttpCode(200)
  async concluir(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 40);
    const sessaoId = UUID.safeParse(id);
    if (!sessaoId.success) throw new HttpException({ mensagem: "Partida não encontrada." }, 404);
    return this.vila.concluir(req.auth.escolaId, req.auth.usuarioId, sessaoId.data, body);
  }
}

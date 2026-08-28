import { Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Body } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { ehUuid } from "../motor/guardas";
import { erroDeJogo } from "./erros";
import { UnoogptService } from "./unoogpt.service";
import { professorDoToken } from "../comum/turmas-do-professor";

/**
 * Visão do PROFESSOR: o relógio da aula, a folha da turma e a linha de uma
 * criança — com a Transcrição.
 *
 * **Gestor NÃO entra aqui**, e isso é classe separada em vez de `@Roles` misto
 * com exceção por método (mesma regra da exp-70). O agregado por turma abre
 * para o gestor em `UnoogptAgregadoController`; a conversa de uma criança, não.
 *
 * `admin-contrato` é a única exceção cross-escola (regra 1): o token dele tem
 * escola vazia, então precisa dizer `?escolaId=`.
 */
type Autenticado = { auth: AuthClaims };

function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (auth.perfil === "admin-contrato") {
    if (!escolaIdPedida) throw erroDeJogo("payload-invalido");
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw new ForbiddenException("professor só vê a própria escola");
  }
  return auth.escolaId;
}

const AcaoSchema = z.object({
  acao: z.enum(["largada", "mais-tempo", "encerrar", "modo-livre", "modo-cronometrado", "redefinir"]),
});

@Controller("unoogpt/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", "admin-contrato")
export class UnoogptTurmasController {
  constructor(private readonly service: UnoogptService) {}

  /** As turmas da escola: alimenta o seletor da página de resultados. */
  @Get("turmas")
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.service.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  /** A folha da turma: relógio, retrato de conduta e uma linha por aluno. */
  @Get("turmas/:turmaId")
  turma(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(turmaId)) throw erroDeJogo("payload-invalido");
    return this.service.turmaDoProfessor(escolaId, turmaId, professorDoToken(req.auth));
  }

  /**
   * Dar a largada, somar +2 min, encerrar, trocar o modo ou redefinir.
   *
   * É o único lugar onde alguém que não é o aluno mexe no que ele vê — e mesmo
   * aqui não toca o Passo dele: o que o professor controla é QUANDO dá para
   * falar com o Cientista, não o que a criança decide.
   */
  @Post("turmas/:turmaId/relogio")
  relogio(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(turmaId)) throw erroDeJogo("payload-invalido");
    const r = AcaoSchema.safeParse(corpo);
    if (!r.success) throw erroDeJogo("payload-invalido");
    return this.service.mexerNoRelogio(escolaId, turmaId, r.data.acao);
  }

  /**
   * ZERAR A TURMA: apaga as partidas e o relógio.
   *
   * É o caminho de exclusão que substitui o `expires_at` do projeto de origem —
   * prazo apertado por quem tem a posse pedagógica, em vez de coluna que nenhuma
   * rotina cumpre.
   */
  @Delete("turmas/:turmaId")
  zerar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(turmaId)) throw erroDeJogo("payload-invalido");
    return this.service.zerarTurma(escolaId, turmaId);
  }

  /** A linha de UMA criança: leitura em graus + a Transcrição. */
  @Get("alunos/:alunoId")
  aluno(
    @Param("alunoId") alunoId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(alunoId)) throw erroDeJogo("payload-invalido");
    return this.service.alunoDoProfessor(escolaId, alunoId);
  }
}

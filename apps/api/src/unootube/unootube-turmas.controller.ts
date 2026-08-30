import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { ehUuid } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import { ResultadosDaTurmaSchema, TurmasDoUnootubeSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { UnootubeService } from "./unootube.service";
import { professorDoToken } from "../comum/turmas-do-professor";

/**
 * Visão do PROFESSOR (e gestor) sobre a missão do UnooTube — classe separada
 * para o `@Roles` ficar limpo, como em `analise.controller.ts`.
 *
 * `admin-contrato` é a única exceção cross-escola (regra 1): o token dele tem
 * escola vazia, então precisa dizer `?escolaId=` — e o valor vai EXPLÍCITO ao
 * `comTenancy` (o TenancyInterceptor não abre contexto para ele).
 */

type Autenticado = { auth: AuthClaims };

function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (auth.perfil === "admin-contrato") {
    if (!escolaIdPedida) erroDeJogo("ESCOLA_OBRIGATORIA");
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw new ForbiddenException("professor e gestor só veem a própria escola");
  }
  return auth.escolaId;
}

@Controller("unootube/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", "gestor", "admin-contrato")
export class UnootubeTurmasController {
  constructor(private readonly unootube: UnootubeService) {}

  /** Turmas da escola — alimenta o seletor da página de resultados do hub. */
  @Get()
  @Contrato({
    resumo: "Turmas para o seletor de resultados.",
    descricao:
      "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. `admin-contrato` precisa dizer `?escolaId=` — o token dele tem escola vazia e o TenancyInterceptor não abre contexto.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmasDoUnootubeSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.unootube.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/resultados")
  @Contrato({
    resumo: "O que a turma fez na missão do UnooTube.",
    descricao:
      "Uma linha por estudante mais o resumo. `distribuicaoFontes` conta só entre os que CONCLUÍRAM — misturar quem parou no meio faria a média dizer outra coisa.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: ResultadosDaTurmaSchema,
  })
  resultados(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(turmaId)) {
      throw new BadRequestException({ codigo: "TURMA_NAO_ENCONTRADA", mensagem: "Turma inválida." });
    }
    return this.unootube.resultadosDaTurma(escolaId, turmaId, professorDoToken(req.auth));
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  DefinirEstadoSchema,
  ExpId,
  LiberacaoSchema,
  SalaDoProfessorSchema,
  Uuid,
} from "./contrato-de-rotas";
import { SalasService } from "./salas.service";
import { GESTORES, ehDoContrato} from "../auth/claims";

type Autenticado = { auth: AuthClaims };

/** `gestor_contrato` tem escola vazia (regra 1) e precisa dizer `?escolaId=`. */
function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (ehDoContrato(auth.perfil)) {
    if (!escolaIdPedida) throw new BadRequestException({ mensagem: "escolaId é obrigatório" });
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw new ForbiddenException({ mensagem: "só a própria escola" });
  }
  return auth.escolaId;
}

function uuidOu400(valor: string): string {
  const r = Uuid.safeParse(valor);
  if (!r.success) throw new BadRequestException({ mensagem: "turmaId inválido" });
  return r.data;
}

/**
 * A SALA, do lado de quem dá aula (ADR-69).
 *
 * Gestor e admin-contrato LEEM a sala; quem LIBERA é só quem tem matrícula de
 * professor na turma. É a mesma distinção que o OneRoster faz entre `roles` (da
 * organização) e `enrollments` (da turma): administrar a escola não é dar a aula.
 */
@Controller("salas")
@UseGuards(OidcGuard, RolesGuard)
export class SalasProfessorController {
  constructor(private readonly salas: SalasService) {}

  @Get("turma/:turmaId")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "A sala: a turma, a grade de missões e quem liberou cada uma.",
    descricao:
      "A grade é a das experiências da SÉRIE da turma mais as transversais (`series: []`). `?todas=1` acrescenta as de outras séries, marcadas com `deOutraSerie` — turma multisseriada e reforço existem, mas trazê-las por padrão afogaria a grade do ano.",
    params: z.object({ turmaId: Uuid }),
    query: z.object({ escolaId: z.string().optional(), todas: z.string().optional() }),
    resposta: SalaDoProfessorSchema,
    notas: [
      "Turma em que o professor não tem matrícula responde **404**, não 403: um \"sem permissão\" já contaria que a turma existe.",
      "Gestor e admin-contrato leem a escola inteira, de propósito.",
    ],
  })
  turma(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("todas") todas: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.salas.daTurma(
      escolaAlvo(req.auth, escolaIdPedida),
      uuidOu400(turmaId),
      professorDoToken(req.auth),
      todas === "1" || todas === "true",
    );
  }

  /**
   * LIBERAR ou ENCERRAR a missão nesta turma.
   *
   * `PUT` e não `POST`: o efeito é o estado final, e apertar duas vezes tem de
   * dar no mesmo — é o clique que um professor nervoso dá duas vezes, na frente
   * da sala.
   */
  @Put("turma/:turmaId/missoes/:expId")
  @Roles("professor")
  @Contrato({
    resumo: "Libera ou encerra uma missão nesta turma.",
    descricao:
      "**Só quem tem matrícula de professor na turma.** Gestor não libera: ele vê a sala e não decide a aula — a opção não aparece na tela dele e a rota responde 404 para turma que não é dele.\n\nIdempotente: repetir não muda nada além do carimbo.",
    params: z.object({ turmaId: Uuid, expId: ExpId }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: DefinirEstadoSchema,
    resposta: LiberacaoSchema,
    notas: [
      "Não existe estado `bloqueada` no corpo: bloquear é a ausência de linha, e o caminho de volta é `encerrada` — a criança precisa continuar vendo o que fez.",
      "Recusa experiência de `publico: professor` (exp-90, exp-91): liberar uma delas seria um botão que não abre nada, porque `/exp/*` responde 404 para ferramenta de professor.",
    ],
  })
  definir(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const dados = DefinirEstadoSchema.parse(corpo);
    const id = ExpId.safeParse(expId);
    if (!id.success) throw new BadRequestException({ mensagem: "expId no formato exp-<slug>" });

    return this.salas.definirEstado(
      escolaAlvo(req.auth, escolaIdPedida),
      uuidOu400(turmaId),
      id.data,
      dados.estado,
      req.auth.usuarioId,
    );
  }
}

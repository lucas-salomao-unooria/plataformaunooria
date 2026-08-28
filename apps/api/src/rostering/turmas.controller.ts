import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { SerieSchema } from "../comum/series";
import { TURNOS } from "./catalogo";
import { RosteringService } from "./rostering.service";

type Autenticado = { auth: AuthClaims };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NovaTurmaSchema = z.object({
  nome: z.string().trim().min(1).max(40),
  serie: SerieSchema,
  turno: z.enum(TURNOS).optional(),
  periodoLetivoId: z.string().uuid().optional(),
});

const EditarTurmaSchema = z.object({
  nome: z.string().trim().min(1).max(40).optional(),
  serie: SerieSchema.optional(),
  turno: z.enum(TURNOS).nullable().optional(),
});

const MatricularSchema = z.object({
  usuarioId: z.string().uuid(),
  papel: z.enum(["aluno", "professor"]),
});

const AjustarMatriculaSchema = z
  .object({
    turmaDestinoId: z.string().uuid().optional(),
    principal: z.literal(true).optional(),
  })
  .refine((d) => Boolean(d.turmaDestinoId) !== Boolean(d.principal), {
    message: "informe turmaDestinoId OU principal",
  });

/**
 * Turmas e enturmamento.
 *
 * A divisão de papéis aqui É o modelo: gestor administra a ESCOLA (por isso
 * enxerga todas as turmas), professor tem MATRÍCULA em turma (por isso enxerga
 * as dele). É a mesma separação que o OneRoster faz entre `roles`, no nível da
 * organização, e `enrollments`, no nível da turma.
 */
@Controller("turmas")
@UseGuards(OidcGuard, RolesGuard)
export class TurmasController {
  constructor(private readonly rostering: RosteringService) {}

  /**
   * As turmas DO PROFESSOR — as que ele tem matrícula, e só elas.
   *
   * Declarada antes de `:id` de propósito: no Nest a primeira rota que casa
   * vence, e `/turmas/minhas` bateria em `/turmas/:id` com id "minhas".
   */
  @Get("minhas")
  @Roles("professor", "gestor", "admin-contrato")
  async minhas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (req.auth.perfil === "professor") {
      return this.rostering.turmasDoProfessor(escolaId, req.auth.usuarioId);
    }
    return this.rostering.turmasDaEscola(escolaId);
  }

  @Get()
  @Roles("gestor", "admin-contrato")
  async listar(
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("periodoLetivoId") periodoLetivoId: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.rostering.turmasDaEscola(escolaAlvo(req.auth, escolaIdPedida), periodoLetivoId);
  }

  @Post()
  @Roles("gestor", "admin-contrato")
  async criar(
    @Body() body: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const dados = NovaTurmaSchema.parse(body);
    const turma = await this.rostering.criarTurma(escolaAlvo(req.auth, escolaIdPedida), dados);
    if (!turma) throw new BadRequestException("nenhum período letivo cadastrado");
    return turma;
  }

  @Patch(":id")
  @Roles("gestor", "admin-contrato")
  async editar(
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.test(id)) throw new NotFoundException("turma não encontrada");
    const turma = await this.rostering.atualizarTurma(
      escolaAlvo(req.auth, escolaIdPedida),
      id,
      EditarTurmaSchema.parse(body),
    );
    if (!turma) throw new NotFoundException("turma não encontrada");
    return turma;
  }

  /**
   * Os matriculados da turma — a lista nominal.
   *
   * Para o professor a checagem é de MATRÍCULA, não de escola: o professor do
   * 8A pedindo o 9B leva 403. Antes disto, qualquer professor da escola lia
   * qualquer turma dela.
   */
  @Get(":id")
  @Roles("professor", "gestor", "admin-contrato")
  async pessoas(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.test(id)) throw new NotFoundException("turma não encontrada");
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (req.auth.perfil === "professor") {
      const leciona = await this.rostering.professorLecionaNaTurma(escolaId, req.auth.usuarioId, id);
      if (!leciona) throw new ForbiddenException("você não leciona nesta turma");
    }
    const turma = await this.rostering.pessoasDaTurma(escolaId, id);
    if (!turma) throw new NotFoundException("turma não encontrada");
    return turma;
  }

  @Post(":id/matriculas")
  @Roles("gestor", "admin-contrato")
  async matricular(
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.test(id)) throw new NotFoundException("turma não encontrada");
    const { usuarioId, papel } = MatricularSchema.parse(body);
    const feito = await this.rostering.matricular(
      escolaAlvo(req.auth, escolaIdPedida),
      id,
      usuarioId,
      papel,
    );
    if (!feito) throw new NotFoundException("turma ou pessoa não encontrada nesta escola");
    return feito;
  }
}

/**
 * Encerrar matrícula é DELETE na matrícula, não na pessoa — e mesmo assim não
 * apaga linha: grava `fim`. O dado da Vila, do UnooTube e do unooGPT continua
 * pendurado nela, e apagar deixaria esse dado órfão de turma.
 */
@Controller("matriculas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class MatriculasController {
  constructor(private readonly rostering: RosteringService) {}

  /**
   * Mover de turma (`turmaDestinoId`) ou tornar esta a turma de referência
   * (`principal: true`). Nenhuma das duas apaga linha.
   */
  @Patch(":id")
  async ajustar(
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.test(id)) throw new NotFoundException("matrícula não encontrada");
    const dados = AjustarMatriculaSchema.parse(body);
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);

    const feito = dados.turmaDestinoId
      ? await this.rostering.moverDeTurma(escolaId, id, dados.turmaDestinoId)
      : await this.rostering.tornarPrincipal(escolaId, id);
    if (!feito) throw new NotFoundException("matrícula ou turma não encontrada nesta escola");
    return feito;
  }

  @Delete(":id")
  async encerrar(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.test(id)) throw new NotFoundException("matrícula não encontrada");
    const feito = await this.rostering.encerrarMatricula(escolaAlvo(req.auth, escolaIdPedida), id);
    if (!feito) throw new NotFoundException("matrícula não encontrada");
    return feito;
  }
}

const NovoPeriodoSchema = z.object({
  tipo: z.enum(["ano_letivo", "semestre", "bimestre", "trimestre"]).default("ano_letivo"),
  titulo: z.string().trim().min(1).max(80),
  ano: z.number().int().min(2020).max(2100),
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
});

/** Catálogo do CONTRATO (sem escola, sem RLS) — por isso controller separado. */
@Controller("periodos-letivos")
@UseGuards(OidcGuard, RolesGuard)
export class PeriodosLetivosController {
  constructor(private readonly rostering: RosteringService) {}

  @Get()
  @Roles("professor", "gestor", "admin-contrato")
  listar() {
    return this.rostering.periodosComTurmas();
  }

  @Post()
  @Roles("gestor", "admin-contrato")
  criar(@Body() body: unknown) {
    const dados = NovoPeriodoSchema.parse(body);
    if (dados.fim < dados.inicio) throw new BadRequestException("fim antes do início");
    return this.rostering.criarPeriodo(dados);
  }
}

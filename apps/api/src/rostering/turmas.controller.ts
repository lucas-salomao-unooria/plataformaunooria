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
import { Contrato } from "../openapi/contrato";
import {
  AjustarMatriculaSchema,
  EditarTurmaSchema,
  EscolaAlvoQuery,
  MatricularSchema,
  NovaTurmaSchema,
  NovoPeriodoSchema,
  OkSchema,
  PeriodosSchema,
  PeriodoLetivoSchema,
  PessoasDaTurmaSchema,
  TurmaCruaSchema,
  TurmasSchema,
} from "./contrato-de-rotas";
import { RosteringService } from "./rostering.service";

type Autenticado = { auth: AuthClaims };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  @Roles("professor", "gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "As turmas DO PROFESSOR — as que ele tem matrícula, e só elas.",
    descricao:
      "Declarada antes de `:id` de propósito: no Nest a primeira rota que casa vence, e `/turmas/minhas` bateria em `/turmas/:id` com o id \"minhas\".\n\nGestor e admin-contrato caem nas turmas da escola inteira — é a diferença entre administrar a escola e dar aula numa turma.",
    query: EscolaAlvoQuery,
    resposta: TurmasSchema,
  })
  async minhas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (req.auth.perfil === "professor") {
      return this.rostering.turmasDoProfessor(escolaId, req.auth.usuarioId);
    }
    return this.rostering.turmasDaEscola(escolaId);
  }

  @Get()
  @Roles("gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "As turmas da escola.",
    descricao:
      "Filtra por período letivo quando `periodoLetivoId` vem. Sem ele, TODAS as turmas de todos os anos — é isso que preserva o histórico depois da virada.",
    query: EscolaAlvoQuery.extend({ periodoLetivoId: z.string().uuid().optional() }),
    resposta: TurmasSchema,
  })
  async listar(
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("periodoLetivoId") periodoLetivoId: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.rostering.turmasDaEscola(escolaAlvo(req.auth, escolaIdPedida), periodoLetivoId);
  }

  @Post()
  @Roles("gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "Cria uma turma.",
    descricao:
      "Sem `periodoLetivoId`, nasce no período VIGENTE — derivado das datas. Sem nenhum período cadastrado, **400**: turma sem período é a coluna `users.turma_id` de novo, com outro nome.",
    query: EscolaAlvoQuery,
    corpo: NovaTurmaSchema,
    resposta: TurmaCruaSchema,
    notas: [
      "`UNIQUE (escola_id, periodo_letivo_id, nome)`: o \"8A de 2026\" e o \"8A de 2027\" são turmas DIFERENTES.",
    ],
  })
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
  @Roles("gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "Edita nome, série ou turno da turma.",
    descricao: "Não move de período: isso seria reescrever o histórico do ano.",
    params: z.object({ id: z.string().uuid() }),
    query: EscolaAlvoQuery,
    corpo: EditarTurmaSchema,
    resposta: TurmaCruaSchema,
  })
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
  @Roles("professor", "gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "Os matriculados da turma — a lista nominal.",
    descricao:
      "Para o PROFESSOR a checagem é de MATRÍCULA, não de escola: o professor do 8A pedindo o 9B leva **403**. Antes disto, qualquer professor da escola lia qualquer turma dela — a única prova exigida era \"mesma escola\", que é a regra de tenancy e não a de quem dá aula ali.",
    params: z.object({ id: z.string().uuid() }),
    query: EscolaAlvoQuery,
    resposta: PessoasDaTurmaSchema,
    notas: [
      "`matriculaId` é da MATRÍCULA e `id` é da PESSOA — mover e encerrar operam sobre o primeiro.",
      "`senhaProvisoria: true` = ainda não fez o primeiro acesso.",
    ],
  })
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
  @Roles("gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "Matricula uma pessoa na turma.",
    descricao:
      "`papel` só admite `estudante` e `professor`. Gestor é papel da ESCOLA, não matrícula de turma — e é por isso que ele continua vendo a escola inteira.",
    params: z.object({ id: z.string().uuid() }),
    query: EscolaAlvoQuery,
    corpo: MatricularSchema,
    resposta: OkSchema,
  })
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
@Roles("gestor_escola", "gestor_contrato")
export class MatriculasController {
  constructor(private readonly rostering: RosteringService) {}

  /**
   * Mover de turma (`turmaDestinoId`) ou tornar esta a turma de referência
   * (`principal: true`). Nenhuma das duas apaga linha.
   */
  @Patch(":id")
  @Contrato({
    resumo: "Move de turma, ou torna esta a turma de referência.",
    descricao:
      "Mover é UM passo de propósito: à mão, o gestor tira da antiga e esquece de pôr na nova, e o estudante fica sem turma — invisível para o professor, sem nada na tela dizendo o que faltou.\n\nNenhuma das duas operações apaga linha.",
    params: z.object({ id: z.string().uuid() }),
    query: EscolaAlvoQuery,
    corpo: AjustarMatriculaSchema,
    resposta: OkSchema,
    notas: [
      "Informe `turmaDestinoId` OU `principal`, nunca os dois nem nenhum — é um `.refine()`, que o JSON Schema não sabe expressar.",
    ],
  })
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
  @Contrato({
    resumo: "Encerra a matrícula.",
    descricao:
      "**Não apaga linha**: grava `fim`. O dado da Vila, do UnooTube e do unooGPT continua pendurado nela, e apagar deixaria esse dado órfão de turma. Sair da REDE é outra coisa — `ativo = false` na pessoa.",
    params: z.object({ id: z.string().uuid() }),
    query: EscolaAlvoQuery,
    resposta: OkSchema,
  })
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

/** Catálogo do CONTRATO (sem escola, sem RLS) — por isso controller separado. */
@Controller("periodos-letivos")
@UseGuards(OidcGuard, RolesGuard)
export class PeriodosLetivosController {
  constructor(private readonly rostering: RosteringService) {}

  @Get()
  @Roles("professor", "gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "O calendário do contrato, com quantas turmas cada período tem.",
    descricao:
      "Catálogo do CONTRATO: sem `escola_id` e sem RLS, por isso controller separado. A contagem de turmas é o que impede apagar um período por engano.",
    resposta: PeriodosSchema,
    notas: [
      "`vigente` é DERIVADO das datas, nunca coluna — estado que ninguém atualiza mente mais do que ajuda.",
    ],
  })
  listar() {
    return this.rostering.periodosComTurmas();
  }

  @Post()
  @Roles("gestor_escola", "gestor_contrato")
  @Contrato({
    resumo: "Cria um período letivo — a primeira etapa da virada do ano.",
    descricao:
      "A partir da data de início ele passa a ser o vigente, e toda turma nova nasce nele. **A segunda etapa é importar o enturmamento**, e nenhuma das duas é automática: as turmas do ano anterior ficam onde estão, e é isso que preserva o histórico.",
    corpo: NovoPeriodoSchema,
    resposta: PeriodoLetivoSchema,
    notas: ["`fim` antes de `inicio` é **400**."],
  })
  criar(@Body() body: unknown) {
    const dados = NovoPeriodoSchema.parse(body);
    if (dados.fim < dados.inicio) throw new BadRequestException("fim antes do início");
    return this.rostering.criarPeriodo(dados);
  }
}

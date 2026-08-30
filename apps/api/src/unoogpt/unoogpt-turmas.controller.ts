import { Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Body } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { ehUuid } from "../motor/guardas";
import { erroDeJogo } from "./erros";
import { Contrato } from "../openapi/contrato";
import {
  AcaoDoRelogioSchema,
  AlunoDoProfessorSchema,
  EstudanteDoProfessorSchema,
  RelogioDoProfessorSchema,
  TurmaDoProfessorSchema,
  TurmaZeradaDoUnoogptSchema,
  TurmasDoUnoogptSchema,
} from "./contrato-de-rotas";
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

@Controller("unoogpt/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", "admin-contrato")
export class UnoogptTurmasController {
  constructor(private readonly service: UnoogptService) {}

  /** As turmas da escola: alimenta o seletor da página de resultados. */
  @Get("turmas")
  @Contrato({
    resumo: "Turmas para o seletor de resultados do unooGPT.",
    descricao: "Filtradas por MATRÍCULA para o professor. **Gestor não entra aqui** — ele tem `/unoogpt/agregado/escola`.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmasDoUnoogptSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.service.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  /** A folha da turma: relógio, retrato de conduta e uma linha por aluno. */
  @Get("turmas/:turmaId")
  @Contrato({
    resumo: "A folha da turma: relógio, retrato de conduta e uma linha por aluno.",
    descricao:
      "O retrato fala de **conduta, não de nota** — conta \"decidiram no escuro\" e \"justificaram por intuição\" em vez de somar acertos, porque a Missão não tem resposta certa.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmaDoProfessorSchema,
  })
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
  @Contrato({
    resumo: "Dá a largada, soma tempo, encerra, troca o modo ou redefine.",
    descricao:
      "É o único lugar onde alguém que não é o aluno mexe no que ele vê — e mesmo aqui **não toca o Passo dele**: o que o professor controla é QUANDO dá para falar com o Cientista, não o que a criança decide.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: AcaoDoRelogioSchema,
    resposta: RelogioDoProfessorSchema,
  })
  relogio(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(turmaId)) throw erroDeJogo("payload-invalido");
    const r = AcaoDoRelogioSchema.safeParse(corpo);
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
  @Contrato({
    resumo: "Zera a turma: apaga as partidas E o relógio.",
    descricao:
      "É o caminho de exclusão que substitui o `expires_at` do app de origem — prazo real, apertado por quem tem a posse pedagógica, em vez de coluna que nenhuma rotina cumpre.\n\nO relógio vai junto porque rodar de novo com a aula \"já começada\" faria a segunda rodada nascer no meio da tempestade.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmaZeradaDoUnoogptSchema,
  })
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
  @Get("estudantes/:alunoId")
  @Contrato({
    resumo: "A linha de UMA criança: leitura em graus e a Transcrição.",
    descricao:
      "**Professor only.** O relatório abre pelo que a missão MEDIU, em graus.",
    params: z.object({ alunoId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: EstudanteDoProfessorSchema,
    notas: [
      "Número só com `grau: \"scored\"`. E `zero` (\"teve a chance e não foi\") nunca se confunde com `none` (\"a oportunidade não chegou\") — é a distinção mais importante do modelo, e ela está no TIPO.",
      "`resumo` nunca afirma o que o estudante É, e partida curta some com o resto: dois minutos de jogo não sustentam frase.",
    ],
  })
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

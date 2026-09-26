import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { MaterialSchema } from "./contrato-de-rotas";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

/**
 * O material do GUIA DA AULA — o banco curado COM gabarito e as perguntas de
 * evidência COM o nível de cada alternativa, para quem conduz.
 *
 * Classe separada das rotas de turma porque não é dado de turma: sem
 * `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`. O mesmo
 * desenho de `rastro-boato/professor/material`.
 */
@Controller("quem-mandou-isso/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class QuemMandouIssoProfessorController {
  constructor(private readonly missao: QuemMandouIssoService) {}

  @Get("material")
  @Contrato({
    resumo: "O guia da aula: o banco curado com gabarito, o roteiro e as perguntas de evidência.",
    descricao:
      "**Quem dá aula e quem administra.** O hub não guarda cópia: em paráfrase, o que sustenta a lição — a falsa NÃO parece malfeita, a verdadeira NÃO parece profissional — desaparece.\n\nÉ o BANCO CURADO, não o pacote da turma (esse está em `GET /quem-mandou-isso/turmas/:turmaId/pacote`). As perguntas de evidência vêm COM o nível de cada alternativa — é o professor quem lê; o estudante nunca o recebe.",
    resposta: MaterialSchema,
    notas: ["Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato."],
  })
  material() {
    return this.missao.material();
  }
}

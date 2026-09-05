import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { SalasDoEstudanteSchema } from "./contrato-de-rotas";
import { SalasService } from "./salas.service";

type Autenticado = { auth: AuthClaims };

/**
 * O hub do ESTUDANTE, do lado do servidor (ADR-69).
 *
 * Controller separado do de professor de propósito, como no unooGPT e na Vila:
 * um `@Roles` misto com exceção por método é como uma rota acaba aberta para
 * quem não devia sem ninguém notar.
 */
@Controller("salas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class SalasEstudanteController {
  constructor(private readonly salas: SalasService) {}

  /**
   * As turmas do estudante e, em cada uma, a grade do ano dela.
   *
   * Rota LITERAL (`/salas/minhas`), e a do professor é `/salas/turma/:turmaId`:
   * prefixos distintos de propósito. Com `/salas/:turmaId` no outro controller,
   * qual das duas vence dependeria da ordem de registro dos módulos — a mesma
   * armadilha que `/turmas/minhas` documenta em `rostering`.
   */
  @Get("minhas")
  @Contrato({
    resumo: "As salas do estudante: as turmas dele e a grade de cada uma.",
    descricao:
      "Devolve a grade INTEIRA da série da turma, não só o que está aberto: missão bloqueada aparece com **cadeado** e a encerrada aparece com o rótulo. Quem decide o que abre é o `estado`.",
    resposta: SalasDoEstudanteSchema,
    notas: [
      "`bloqueada` **não é um estado do banco** — é a ausência de linha em `liberacoes`.",
      "Sem turma, `salas` volta VAZIO: sem sala não há missão, e é a tela que explica que falta enturmar.",
      "Esconder o card é UX. A porta é `exigirMissaoLiberada`, na entrada de cada experiência — `/exp/:expId` é endereço adivinhável.",
    ],
  })
  minhas(@Req() req: Autenticado) {
    return this.salas.minhas(req.auth.escolaId, req.auth.usuarioId);
  }
}

import { Controller, Get, UseGuards } from "@nestjs/common";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { GESTORES } from "../auth/claims";
import { Contrato } from "../openapi/contrato";
import { materialDoProfessor } from "./catalogo";
import { MaterialDoProfessorSchema } from "./contrato-de-rotas";

/**
 * O material do GUIA DA AULA da exp07ef1b — catálogo com gabarito, para quem
 * conduz.
 *
 * Classe separada de `OEcoNoGrupoTurmasController` porque não é dado de turma:
 * sem `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`. Mesmo
 * desenho de `unoogpt/professor/fontes`.
 */
@Controller("o-eco-no-grupo/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class OEcoNoGrupoProfessorController {
  /**
   * As três respostas com desfecho, gabarito e o que o bairro devolve.
   *
   * O hub não guarda cópia: a reação é a parte que a turma comenta, e ela não
   * cabe em paráfrase.
   */
  @Get("material")
  @Contrato({
    resumo: "As três respostas com o gabarito e as reações do bairro, para o guia da aula.",
    descricao:
      "**Professor only.** Alimenta o guia da aula em `/professor/entre-redes/7-ano/unidade-1/guia`. `desfecho` e `correta` são os dois campos que `semGabarito` tira da opção antes de ela chegar ao estudante (regra 3). As reações são o roteiro CANÔNICO — o que roda com a IA desligada; com IA as falas respondem ao que o estudante postou, mas o desfecho continua sendo decidido aqui.",
    resposta: MaterialDoProfessorSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
      "`atrasoMs` das reações fica de fora: é cadência de tela, não material de preparo.",
    ],
  })
  material() {
    return materialDoProfessor();
  }
}

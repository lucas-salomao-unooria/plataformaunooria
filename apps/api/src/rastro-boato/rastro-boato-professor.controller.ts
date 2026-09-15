import { Controller, Get, UseGuards } from "@nestjs/common";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { GESTORES } from "../auth/claims";
import { Contrato } from "../openapi/contrato";
import { materialDoProfessor } from "./catalogo";
import { MaterialDoProfessorSchema } from "./contrato-de-rotas";

/**
 * O material do GUIA DA AULA da exp-06 — catálogo com gabarito, para quem
 * conduz.
 *
 * Classe separada de `RastroBoatoTurmasController` porque não é dado de turma:
 * sem `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`. Mesmo
 * desenho de `unoogpt/professor/fontes`.
 */
@Controller("rastro-boato/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class RastroBoatoProfessorController {
  /**
   * As três intervenções com desfecho e reação, e o ciclo na ordem certa.
   *
   * O hub não guarda cópia: em paráfrase, a coincidência que sustenta a lição
   * — A e C produzem a MESMA reação do grupo — desaparece.
   */
  @Get("material")
  @Contrato({
    resumo: "As três intervenções com o gabarito e o ciclo ordenado, para o guia da aula.",
    descricao:
      "**Professor only.** Alimenta o guia da aula em `/professor/entre-redes/6-ano/unidade-2/guia`. `desfecho` é o mesmo gabarito que a tela do estudante só conhece do PRÓPRIO caso, depois de decidir; `ciclo` chega ordenado aqui e embaralhado lá, porque montar a ordem é a tarefa dela.",
    resposta: MaterialDoProfessorSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
    ],
  })
  material() {
    return materialDoProfessor();
  }
}

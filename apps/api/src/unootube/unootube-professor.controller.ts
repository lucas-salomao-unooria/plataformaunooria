import { Controller, Get, UseGuards } from "@nestjs/common";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { GESTORES } from "../auth/claims";
import { Contrato } from "../openapi/contrato";
import { videosParaOProfessor } from "./catalogo";
import { VideosDoProfessorSchema } from "./contrato-de-rotas";

/**
 * O material do GUIA DA AULA da exp04ef1b — catálogo com gabarito, para quem
 * conduz.
 *
 * Classe separada de `UnootubeTurmasController` porque não é dado de turma:
 * não há `escolaId`, não há tenancy a aplicar e não há `?escolaId=` para o
 * `gestor_contrato` informar. O que a guarda protege aqui é o PAPEL — o mesmo
 * desenho de `unoogpt/professor/fontes`, e pela mesma razão: é a única
 * superfície em que o gabarito da missão é dito com todas as letras.
 */
@Controller("unootube/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class UnootubeProfessorController {
  /**
   * Os 21 vídeos com `factual`, a contagem real e os números da pontuação.
   *
   * O hub NÃO guarda cópia disto. Guardava, em prosa — "metade cita fonte
   * verificável, a outra metade é sensacionalista" — e a prosa já estava
   * errada: são 11 e 10. A tabela sai do catálogo ou volta a divergir.
   */
  @Get("videos")
  @Contrato({
    resumo: "Os 21 vídeos do UnooTube com o gabarito, para o guia da aula.",
    descricao:
      "**Professor only.** Alimenta o guia da aula em `/professor/entre-redes/4-ano/unidade-1/guia`. O `factual` que esta rota devolve é o mesmo que `VideoPublicoSchema` remove da sessão do estudante (regra 3) — o que muda é o leitor.",
    resposta: VideosDoProfessorSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
      "`resumo` e `pontuacao` são CALCULADOS do catálogo. Existiam à mão no guia e já haviam derivado.",
    ],
  })
  videos() {
    return videosParaOProfessor();
  }
}

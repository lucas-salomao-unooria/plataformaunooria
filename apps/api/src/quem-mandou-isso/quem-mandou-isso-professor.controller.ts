import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import {
  LOTE_DEFAULT,
  PARIDADE,
  PISO_DE_ENCAMINHAMENTOS,
  PODCAST,
  TEMA_DEFAULT,
} from "./catalogo";
import { MaterialDoProfessorSchema } from "./contrato-de-rotas";

/**
 * O material do GUIA DA AULA da exp05ef1b — o banco curado COM gabarito, para quem
 * conduz.
 *
 * Classe separada de `QuemMandouIssoTurmasController` porque não é dado de
 * turma: sem `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`.
 * Mesmo desenho de `rastro-boato/professor/material` e de `unoogpt/professor/fontes`.
 */
@Controller("quem-mandou-isso/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class QuemMandouIssoProfessorController {
  /**
   * As oito mensagens com veracidade, tom e explicação, mais o roteiro do
   * episódio.
   *
   * O hub não guarda cópia: em paráfrase, a coisa que sustenta a lição — que a
   * mensagem falsa NÃO parece malfeita e a verdadeira NÃO parece profissional —
   * desaparece, e o guia passa a ensinar a heurística errada.
   */
  @Get("material")
  @Contrato({
    resumo: "As 8 mensagens do banco curado com o gabarito, a paridade e o podcast.",
    descricao:
      "**Professor only.** Alimenta o bloco vivo do guia da aula em `/professor/entre-redes/5-ano/unidade-1/guia`.\n\nÉ o BANCO CURADO da Unooria, não o lote da turma: se a professora gerou ou editou outro, ele está em `GET /quem-mandou-isso/turmas/:turmaId/conteudo`. Os dois coexistem de propósito — o guia da aula é escrito sobre o banco curado, e uma turma com tema próprio não pode reescrever o guia impresso.",
    resposta: MaterialDoProfessorSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
      "`paridade` (3 verdadeiras, 3 falsas, 2 ambíguas) e `pisoDeEncaminhamentos` vão junto porque são o que a professora precisa dizer em voz alta antes de a turma entrar no grupo — e são as duas regras que o lote gerado por IA também tem de respeitar.",
      "O podcast é TEXTO. A locução do brief não foi gravada, e a missão roda igual: a transcrição é acessibilidade de sala sem fone, não remendo. Quando o áudio chegar, entra ao lado — nunca no lugar.",
    ],
  })
  material() {
    return {
      tema: TEMA_DEFAULT,
      mensagens: LOTE_DEFAULT.map((m) => ({ ...m })),
      paridade: { ...PARIDADE },
      pisoDeEncaminhamentos: PISO_DE_ENCAMINHAMENTOS,
      podcast: PODCAST,
    };
  }
}

import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { DISCIPLINA_PADRAO, ROTEIRO_DA_MEDIACAO, TEMA_PADRAO, blocosDoProfessor, noticiasPadrao } from "./catalogo";
import { ConteudoDaAulaSchema } from "./contrato-de-rotas";

/**
 * O material do GUIA DA AULA da exp04ef1b — o banco padrão COM gabarito, a
 * Chave com os pilares marcados e o roteiro da mediação, para quem conduz.
 *
 * Classe separada de `JornalEscolaTurmasController` porque não é dado de
 * turma: sem `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`.
 * Mesmo desenho de `a-selecao/professor/material`.
 */
@Controller("jornal-escola/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class JornalEscolaProfessorController {
  /**
   * O hub não guarda cópia: o roteiro e o gabarito do banco padrão mudam aqui,
   * e corrigir uma notícia não pode exigir republicar o hub.
   */
  @Get("material")
  @Contrato({
    resumo: "O banco padrão com o gabarito, os blocos da Chave e o roteiro da mediação.",
    descricao:
      "**Professor e gestores.** É o \"Usar Banco Padrão: Feira de Ciências e Notícias da Cidade\" do preparo — o hub o manda de volta no `POST :turmaId/homologar` com `origem: \"padrao\"` — e o bloco vivo do guia: com um computador só, o professor projeta as notícias e conduz a turma (PDF §11).\n\nÉ o BANCO PADRÃO da Unooria, não o pacote da turma: se o professor homologou outro, ele está em `GET /jornal-escola/turmas/:turmaId/pacotes`.",
    resposta: ConteudoDaAulaSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
      "`blocos[].pilar` diz quais três formam a Chave — é gabarito, e só existe nesta rota de professor.",
      "`roteiro` é o da copy revisada (§4b): o gatilho do resultado, as três perguntas do debate e o gatilho da revisão.",
    ],
  })
  material() {
    return {
      disciplina: DISCIPLINA_PADRAO,
      tema: TEMA_PADRAO,
      noticias: noticiasPadrao(),
      blocos: blocosDoProfessor(),
      roteiro: {
        gatilhoDoResultado: ROTEIRO_DA_MEDIACAO.gatilhoDoResultado,
        perguntas: [...ROTEIRO_DA_MEDIACAO.perguntas],
        gatilhoDaRevisao: ROTEIRO_DA_MEDIACAO.gatilhoDaRevisao,
      },
    };
  }
}

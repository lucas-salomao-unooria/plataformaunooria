import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import {
  COLEGAS_VIRTUAIS,
  COLEGAS_VIRTUAIS_IDS,
  GATILHOS_DO_PROFESSOR,
  POSTS_PADRAO,
  ROTEIRO_DA_ETAPA_4,
  TEMA_PADRAO,
} from "./catalogo";
import { MaterialDoProfessorSchema } from "./contrato-de-rotas";
import { FALAS_DO_TEMA_PADRAO } from "./podcast";

/**
 * O material do GUIA DA AULA da exp07ef1b — o banco curado COM gabarito e o
 * roteiro de mediação da Etapa 4, para quem conduz.
 *
 * Classe separada de `ASelecaoTurmasController` porque não é dado de turma:
 * sem `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`. Mesmo
 * desenho de `quem-mandou-isso/professor/material`.
 */
@Controller("a-selecao/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class ASelecaoProfessorController {
  /**
   * O hub não guarda cópia: as três perguntas do debate e os gatilhos de cada
   * botão são o roteiro que o PRD mandou não parafrasear, e corrigir uma
   * pergunta não pode exigir republicar o hub.
   */
  @Get("material")
  @Contrato({
    resumo: "O banco curado com o gabarito, o roteiro da Etapa 4 e os colegas virtuais.",
    descricao:
      "**Professor only.** Alimenta o bloco vivo do guia da aula.\n\nÉ o BANCO CURADO da Unooria (a Praça Central), não a cobertura da turma: se a professora homologou outro tema, ele está em `GET /a-selecao/turmas/:turmaId/coberturas`. Os dois coexistem de propósito — o guia é escrito sobre o banco curado, e uma turma com tema próprio não reescreve o guia.",
    resposta: MaterialDoProfessorSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
      "`roteiroDaEtapa4.aviso` é a proteção do gap: as perguntas não podem ser lidas em voz alta antes de o Mural abrir.",
      "`gatilhos` está chaveado pela etapa de DESTINO do botão — a mesma que o `POST :turmaId/gate` recebe.",
    ],
  })
  material() {
    return {
      tema: TEMA_PADRAO,
      posts: POSTS_PADRAO.map((p) => ({ ...p })),
      /* O ponto de partida da criação (ADR-130): "Usar a cobertura pronta da
         Unooria" leva os posts E as falas do podcast do sheet. */
      podcast: { ...FALAS_DO_TEMA_PADRAO },
      roteiroDaEtapa4: { aviso: ROTEIRO_DA_ETAPA_4.aviso, perguntas: [...ROTEIRO_DA_ETAPA_4.perguntas] },
      gatilhos: { ...GATILHOS_DO_PROFESSOR },
      colegasVirtuais: COLEGAS_VIRTUAIS_IDS.map((id) => ({
        id,
        nome: COLEGAS_VIRTUAIS[id].nome,
        selecao: [...COLEGAS_VIRTUAIS[id].selecao],
        legenda: COLEGAS_VIRTUAIS[id].legenda,
      })),
    };
  }
}

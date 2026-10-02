import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import {
  BLOCOS_DA_CADEIA,
  CARTOES_DE_ATITUDE,
  CARTOES_DE_MECANISMO,
  CASO_MARIANA,
  PACOTES_DA_CURTIDA,
  PERGUNTAS_DA_PLENARIA,
} from "./conteudo";
import { MaterialSchema } from "./contrato-de-rotas";
import { LIMIAR_DA_BOLHA, PESO_DA_CURTIDA, PESO_DA_PERMANENCIA, POSTS_NO_FEED } from "./vocabulario";

/**
 * O material do GUIA DA AULA da exp06ef1b — o esqueleto fixo COM gabarito (a
 * ordem dos pacotes e dos blocos, os cartões certos), as perguntas da plenária
 * e a regra que o motor executou, para quem conduz.
 *
 * Classe separada de `JuriEstadualTurmasController` porque não é dado de
 * turma: sem `escolaId`, sem tenancy, sem `?escolaId=` do `gestor_contrato`.
 * Mesmo desenho de `jornal-escola/professor/material`.
 */
@Controller("juri-estadual/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class JuriEstadualProfessorController {
  /**
   * O hub não guarda cópia: o esqueleto e a regra mudam aqui, e corrigir um
   * cartão não pode exigir republicar o hub.
   */
  @Get("material")
  @Contrato({
    resumo: "O esqueleto da missão com o gabarito, a plenária e a regra do feed.",
    descricao:
      "**Professor e gestores.** É o bloco vivo do guia: os quatro pacotes na ordem certa (com o molde do trecho, `{projeto}` e `{hashtag}`), a cadeia Interações → Dados → Algoritmo → Bolha, o caso Mariana com os cartões certos marcados, as quatro perguntas de contraste da plenária e os números do motor (o que a Etapa 5 ensina: duas curtidas na mesma área fecham a bolha).\n\nA MOSTRA da turma não está aqui: ela é da atividade, em `GET /juri-estadual/turmas/:turmaId/pacotes`.",
    resposta: MaterialSchema,
    notas: [
      "Nada aqui é escopado por escola: é o catálogo da missão, igual para todo contrato.",
      "`mecanismos[].certo` e `atitudes[].certo` são gabarito, e só existem nesta rota de professor.",
    ],
  })
  material() {
    return {
      pacotes: PACOTES_DA_CURTIDA.map((p) => ({ numero: p.numero, trecho: p.trecho, rota: [...p.rota] })),
      blocos: BLOCOS_DA_CADEIA.map((b) => ({ posicao: b.posicao, rotulo: b.rotulo })),
      mariana: {
        caso: CASO_MARIANA,
        mecanismos: CARTOES_DE_MECANISMO.map((c) => ({ id: c.id, texto: c.texto, certo: c.certo })),
        atitudes: CARTOES_DE_ATITUDE.map((c) => ({ id: c.id, texto: c.texto, certo: c.certo })),
      },
      plenaria: [...PERGUNTAS_DA_PLENARIA],
      regra: {
        pesoDaCurtida: PESO_DA_CURTIDA,
        pesoDaPermanencia: PESO_DA_PERMANENCIA,
        limiar: LIMIAR_DA_BOLHA,
        postsNoFeed: POSTS_NO_FEED,
      },
    };
  }
}

import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { MinhaEquipeSchema, QueryDaMinhaEquipeSchema } from "./contrato-de-rotas";
import { EquipesService } from "./equipes.service";

type Autenticado = { auth: AuthClaims };

/**
 * A EQUIPE, do lado do ESTUDANTE (E13, ADR-111).
 *
 * Controller separado do de professor de propósito, como em `salas`: um
 * `@Roles` misto com exceção por método é como uma rota acaba aberta para quem
 * não devia sem ninguém notar.
 */
@Controller("equipes")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class EquipesEstudanteController {
  constructor(private readonly equipes: EquipesService) {}

  @Get("minha")
  @Contrato({
    resumo: "A equipe do estudante nesta missão: o nome dela e o primeiro nome dos colegas.",
    descricao:
      "É o que o hub mostra antes de abrir a missão — \"você está na Equipe 3, com a Bia e o Caio\" — para a criança saber de qual computador ela é.\n\n**Sempre 200**: sem equipe, `equipe: null`. Um 404 aqui viraria `api-recusou` no log do hub a cada abertura de missão, para a imensa maioria das crianças, que não tem equipe.",
    query: QueryDaMinhaEquipeSchema,
    resposta: MinhaEquipeSchema,
    notas: [
      "`colegas` leva SÓ o primeiro nome dos outros membros — o nome completo de outra criança não tem o que fazer nesta tela (regra 6). Quando o primeiro nome repete dentro da equipe (o próprio estudante incluso), sobe um degrau por vez só até desempatar: \"Gabriela C.\", depois \"Gabriela Cardoso\".",
      "`expId` ausente ou fora do formato responde **400**; missão que não aceita equipe responde `equipe: null`.",
      "A turma sai da matrícula e do cache (`turmasDoEstudante`), a mesma da porta da sala.",
    ],
  })
  minha(@Query() query: unknown, @Req() req: Autenticado) {
    const { expId } = QueryDaMinhaEquipeSchema.parse(query);
    return this.equipes.minha(req.auth.escolaId, req.auth.usuarioId, expId);
  }
}

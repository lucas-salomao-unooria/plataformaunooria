import { Body, Controller, HttpCode, HttpException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { AbrirSchema, SessaoAbertaSchema, SessaoConcluidaSchema } from "./contrato-de-rotas";
import { PayloadVilaV1 } from "./contrato";
import { VilaService } from "./vila.service";

/**
 * Rotas do ESTUDANTE da app-70-vila-do-lume.
 *
 * O gabarito da missão "A Noite Longa" (`legitima` por cartão) fica no servidor:
 * o cliente manda qual opção escolheu, a api corrige (regra inviolável nº 3). E
 * a BOLHA é atribuída aqui, nunca pelo cliente — era `estudanteSlot % 3` no
 * navegador, o que punha nas mãos do bundle a condição do próprio instrumento.
 *
 * Identidade sempre do token, nunca do body: o payload não traz estudante nem turma.
 */

const UUID = z.string().uuid();

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, teto: number) {
  const r = rateLimit(`vila:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
}

@Controller("vila")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class VilaController {
  constructor(private readonly vila: VilaService) {}

  /**
   * Abre a partida. Devolve o id, a bolha e OS CARTÕES DESTA CRIANÇA — sem
   * gabarito e sem os das outras bolhas, porque a explicação final da missão
   * depende de ser a primeira vez que a turma vê as outras versões.
   */
  @Post("sessoes")
  @HttpCode(201)
  @Contrato({
    resumo: "Abre a partida e entrega os cartões DESTA criança.",
    descricao:
      "**A bolha é do SERVIDOR.** Atribuída A/B/C de forma balanceada dentro da TURMA e persistida em `vila_bolhas` (estável entre partidas: a folha do professor diz \"esse estava na C\").\n\nEra `estudanteSlot % 3` no navegador, o que punha no bundle a condição do próprio instrumento e deixava as três versões legíveis antes da aula.",
    corpo: AbrirSchema,
    resposta: SessaoAbertaSchema,
    status: 201,
    notas: [
      "Os cartões vêm **sem gabarito** e só os desta bolha: a explicação final da missão depende de ser a primeira vez que a turma vê as outras versões.",
      "Nos anos iniciais (1EF–5EF) a bolha B **não é servida** — \"suporte\" exige entender o que é suporte, e só a api sabe a série.",
      "Há lock consultivo por turma: a sala clica junto, e sem ele os 25 caíam todos na bolha A.",
      "Identidade sempre do token: o payload não traz estudante nem turma.",
    ],
  })
  async abrir(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 20);
    const dados = AbrirSchema.parse(body);
    return this.vila.abrir(req.auth.escolaId, req.auth.usuarioId, dados.expVersion);
  }

  /**
   * Fecha a partida. Idempotente: a criança pode recarregar, e o `pagehide` pode
   * disparar duas vezes.
   */
  @Post("sessoes/:id/concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Fecha a partida e grava o payload bruto.",
    descricao:
      "**Idempotente**: a criança pode recarregar, e o `pagehide` pode disparar duas vezes — daí `status: \"jaEstava\"`.\n\nO servidor RECALCULA o retrato; nunca aceita o perfil do cliente. É isso que permite reprocessar o histórico quando `VERSAO_MAPEAMENTO` subir.",
    params: z.object({ id: z.string().uuid() }),
    corpo: PayloadVilaV1,
    resposta: SessaoConcluidaSchema,
    notas: [
      "`CHAVES_DE_PERFIL` recusa payload que traga valores/graus/perfil calculados: o jogo sabe computar o retrato e deliberadamente não o envia.",
      "`eventos[].dados` só aceita número, booleano ou string de um **vocabulário fechado** — o `texto` livre era o caminho por onde o nome de uma criança chegaria a um JSONB.",
      "O gabarito da missão fica no servidor: o cliente manda qual opção escolheu, a api corrige (regra 3).",
    ],
  })
  async concluir(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 40);
    const sessaoId = UUID.safeParse(id);
    if (!sessaoId.success) throw new HttpException({ mensagem: "Partida não encontrada." }, 404);
    return this.vila.concluir(req.auth.escolaId, req.auth.usuarioId, sessaoId.data, body);
  }
}

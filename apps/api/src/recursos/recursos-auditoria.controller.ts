import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { GESTORES_DO_CONTRATO, type AuthClaims } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { DetalheDeQuotaSchema } from "./auditoria";
import { HistoricoDeRecursosSchema } from "./contrato-de-rotas";

/**
 * O HISTÓRICO do painel (ADR-89), lido por DOIS painéis.
 *
 * `GESTORES_DO_CONTRATO` — `admin` E `gestor_contrato` —, e esta é a única rota
 * de `/recursos/*` que a rede alcança. A assimetria da ADR-88 continua intacta:
 * ligar e desligar é só do `admin`. O que a rede ganha aqui é ver POR QUÊ o
 * produto dela mudou de estado, e isso pertence ao cliente: o alternativo é o
 * gestor descobrir que a missão sumiu e ligar para perguntar.
 *
 * Controller separado dos outros dois, e não um `@Roles` misto com exceção por
 * método: é a razão do unooGPT e da Vila — `@Roles` misto é como uma rota acaba
 * aberta para quem não devia sem ninguém notar.
 *
 * `gestor_escola` e `gestor_regional` NÃO entram, e a ausência é deliberada: o
 * histórico é do CONTRATO (a linha de escopo-contrato não tem escola), e
 * recortá-lo por escola daria a uma unidade a notícia de que a rede dela perdeu
 * um produto antes de a coordenação da rede saber.
 */
@Controller("recursos")
@UseGuards(OidcGuard, RolesGuard)
@Roles(...GESTORES_DO_CONTRATO)
export class RecursosAuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("auditoria")
  @Contrato({
    resumo: "Quem ligou ou desligou o quê, e quando.",
    descricao:
      "O registro **append-only** das mudanças de disponibilidade e de versão. Existe porque a linha de `disponibilidades` é SOBRESCRITA a cada mudança: ela responde o estado atual, não o histórico. `UPDATE` é recusado por trigger no banco.",
    query: z.object({
      escolaId: z.string().optional(),
      recursoId: z.string().optional(),
      /** Prefixo de `recursoId` — `quota:` traz só as mudanças de quota (ADR-105). */
      prefixo: z.string().optional(),
      limite: z.string().optional(),
    }),
    resposta: HistoricoDeRecursosSchema,
    notas: [
      "Aberta a `admin` E `gestor_contrato` — a única de `/recursos/*` que a rede alcança. Escrever continua sendo só do `admin` (ADR-88).",
      "`autorNome` vem CONGELADO da linha, não de um JOIN: o histórico tem de dizer quem era aquela pessoa NAQUELE dia, e não o nome de hoje (ou nada, se a conta saiu).",
      "Sem `?escolaId=` traz o contrato inteiro, incluindo as mudanças de escopo-contrato (`escolaId: null`). COM ele, traz as daquela escola **e** as do contrato, porque foram elas que decidiram o que vale ali.",
      "Teto de 200 linhas, dito na resposta (`truncado`) — mesmo desenho de `GET /rostering/contas-de-assento`.",
      "`?prefixo=quota:` recorta as mudanças de quota de IA (ADR-105), que a tela `/unooria/uso-de-ia` mostra sozinhas. `detalhe` (`{ de, para }`) só vem nessas linhas.",
    ],
  })
  async auditoria(
    @Query("escolaId") escolaId: string | undefined,
    @Query("recursoId") recursoId: string | undefined,
    @Query("limite") limiteBruto: string | undefined,
    @Req() _req: { auth: AuthClaims },
    @Query("prefixo") prefixo?: string,
  ) {
    const TETO = 200;
    const pedido = Number(limiteBruto ?? TETO);
    const limite = Number.isFinite(pedido) ? Math.min(Math.max(1, pedido), TETO) : TETO;
    const escopo = escolaId?.trim() || null;

    const linhas = await this.prisma.recursoAuditoria.findMany({
      where: {
        ...(recursoId ? { recursoId } : {}),
        ...(!recursoId && prefixo ? { recursoId: { startsWith: prefixo } } : {}),
        /* COM escola: as dela E as do contrato. Sem as do contrato, o histórico
           de uma escola omitiria justamente a decisão que a alcançou — e a tela
           diria "nada aconteceu aqui" sobre um produto que a rede desligou. */
        ...(escopo ? { OR: [{ escolaId: escopo }, { escolaId: null }] } : {}),
      },
      orderBy: { quando: "desc" },
      take: limite + 1,
      select: {
        id: true,
        recursoId: true,
        escolaId: true,
        acao: true,
        versao: true,
        motivo: true,
        detalhe: true,
        autorNome: true,
        quando: true,
      },
    });

    const truncado = linhas.length > limite;
    return {
      truncado,
      linhas: linhas.slice(0, limite).map((l) => ({
        id: l.id,
        recursoId: l.recursoId,
        escolaId: l.escolaId,
        acao: l.acao,
        versao: l.versao,
        motivo: l.motivo,
        detalhe: DetalheDeQuotaSchema.nullable().catch(null).parse(l.detalhe ?? null),
        autorNome: l.autorNome,
        quando: l.quando.toISOString(),
      })),
    };
  }
}

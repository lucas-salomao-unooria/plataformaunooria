import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PERFIS_COM_QUOTA, QUOTA_PADRAO, type PerfilDaQuota } from "../ai/quota.service";
import type { AuthClaims } from "../auth/oidc.guard";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { registrarAuditoria } from "./auditoria";
import {
  DefinirQuotaDeIaSchema,
  PerfilDaQuotaSchema,
  QuotaAlteradaSchema,
  QuotasDeIaSchema,
} from "./contrato-de-rotas";

/**
 * A QUOTA DE IA POR PERFIL (ADR-105) — a torneira da rede, ao lado do
 * interruptor (ADR-87).
 *
 * `@Roles("admin")` e nada mais, pela mesma razão do painel (ADR-88): quanto de
 * IA uma rede pode gastar por dia é decisão comercial da fornecedora, não de
 * quem administra o contrato do lado do cliente. Um `gestor_contrato` que pode
 * SUBIR a quota passa a decidir o custo variável da Unooria.
 *
 * Mora no módulo `recursos`, e não em `ai`, porque é o painel da Unooria que a
 * opera: mesma guarda, mesmo histórico (`recursos_auditoria`), mesmo prefixo
 * do BFF. O `QuotaService` (em `ai/`) só LÊ a linha — a fronteira da ADR-23
 * continua: `src/ai` não conhece papel de tela.
 *
 * Controller separado, e não um método a mais no `RecursosAdminController`: a
 * tabela é outra, o vocabulário é outro (perfil, não recurso) e o teste de
 * cada um fica com o próprio isolamento.
 */
@Controller("recursos/quotas-de-ia")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class QuotasDeIaController {
  constructor(private readonly prisma: PrismaService) {}

  /** Uma linha por perfil da tupla, na ordem dela — nunca só as que existem. */
  private async listar() {
    const linhas = await this.prisma.iaQuota.findMany();
    const autores = new Map<string, string>();
    const ids = linhas.map((l) => l.definidoPor).filter((id): id is string => id !== null);
    if (ids.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, displayName: true },
      });
      for (const u of users) autores.set(u.id, u.displayName);
    }
    return PERFIS_COM_QUOTA.map((perfil) => {
      const linha = linhas.find((l) => l.perfil === perfil);
      /* Sem linha (não deveria acontecer: a migration semeia), a tela mostra a
         constante que o `QuotaService` está aplicando — nunca um campo vazio
         que pareceria "sem limite". */
      return {
        perfil,
        tokensPorDia: linha?.tokensPorDia ?? QUOTA_PADRAO[perfil],
        motivo: linha?.motivo ?? null,
        definidoPorNome: linha?.definidoPor ? (autores.get(linha.definidoPor) ?? "(conta sem nome)") : null,
        definidoEm: (linha?.definidoEm ?? new Date(0)).toISOString(),
      };
    });
  }

  @Get()
  @Contrato({
    resumo: "O teto diário de IA de cada perfil.",
    descricao:
      "Uma linha por perfil de `ia_quotas` (`estudante`, `professor`), escopo do contrato inteiro. É o número que o `QuotaService` consulta ANTES de toda chamada de IA (regra 5).",
    resposta: QuotasDeIaSchema,
    notas: [
      "Só `admin` (ADR-88/105). O contador do dia (`ia_uso_diario`) NÃO sai aqui: é dado por pessoa.",
      "Todo perfil que não é `estudante` cai na linha `professor` — é o que já valia com as envs, agora escrito.",
    ],
  })
  async quotas() {
    return { quotas: await this.listar() };
  }

  @Put(":perfil")
  @Contrato({
    resumo: "Define o teto diário de IA de um perfil.",
    descricao:
      "Sobrescreve a linha do perfil em `ia_quotas`. **Motivo obrigatório sempre**: aqui toda mudança é exceção ao padrão da plataforma, e é o motivo que, meses depois, diz se foi decisão comercial ou incidente. A mudança entra no histórico do painel (`recursos_auditoria`, ação `quota-alterada`, com `{ de, para }`).",
    params: z.object({ perfil: PerfilDaQuotaSchema }),
    corpo: DefinirQuotaDeIaSchema,
    resposta: QuotaAlteradaSchema,
    notas: [
      "Zero e negativo são recusados (Zod e CHECK): fechar a IA de um produto é o interruptor da ADR-87, não a quota.",
      "Teto de sanidade de 100 milhões de tokens/dia — um zero a mais no campo não vira quota infinita.",
      "Valor igual ao atual devolve `alterada: false` e não grava nem historia: nada mudou.",
      "Vale para a REDE INTEIRA na próxima chamada de IA: o `QuotaService` lê a linha a cada `temSaldo`, sem cache.",
    ],
  })
  async definir(
    @Param("perfil") perfilBruto: string,
    @Body() body: unknown,
    @Req() req: { auth: AuthClaims },
  ) {
    const perfil: PerfilDaQuota = PerfilDaQuotaSchema.parse(perfilBruto);
    const dados = DefinirQuotaDeIaSchema.parse(body);

    const atual = await this.prisma.iaQuota.findUnique({ where: { perfil } });
    const de = atual?.tokensPorDia ?? QUOTA_PADRAO[perfil];

    if (atual && de === dados.tokensPorDia) {
      const [linha] = (await this.listar()).filter((q) => q.perfil === perfil);
      return { ...linha!, alterada: false };
    }

    await this.prisma.iaQuota.upsert({
      where: { perfil },
      create: {
        perfil,
        tokensPorDia: dados.tokensPorDia,
        motivo: dados.motivo,
        definidoPor: req.auth.usuarioId,
      },
      update: {
        tokensPorDia: dados.tokensPorDia,
        motivo: dados.motivo,
        definidoPor: req.auth.usuarioId,
        definidoEm: new Date(),
      },
    });

    /* Log E histórico, como toda escrita do painel: o log é do plantão, a
       tabela é da tela. `motivo` vai ao log de propósito — é texto do operador
       sobre a rede, não dado de pessoa. */
    logger.info(
      { codigo: "ia-quota-alterada", perfil, de, para: dados.tokensPorDia, motivo: dados.motivo },
      "quota diária de IA alterada",
    );
    await registrarAuditoria(
      this.prisma,
      {
        recursoId: `quota:${perfil}`,
        escolaId: null,
        acao: "quota-alterada",
        detalhe: { de, para: dados.tokensPorDia },
        motivo: dados.motivo,
        autorId: req.auth.usuarioId,
      },
      (erro) =>
        logger.error(
          { codigo: "recurso-auditoria-nao-gravada", recursoId: `quota:${perfil}`, acao: "quota-alterada", err: erro },
          "a quota mudou, mas o histórico não foi gravado",
        ),
    );

    const [linha] = (await this.listar()).filter((q) => q.perfil === perfil);
    return { ...linha!, alterada: true };
  }
}

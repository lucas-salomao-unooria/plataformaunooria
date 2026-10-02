import { BadRequestException, Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CHAVES_DE_LIMITE, LIMITES_PADRAO, MAXIMO_POR_SESSAO, type ChaveDeLimite } from "../ajuda/regras";
import type { AuthClaims } from "../auth/oidc.guard";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { registrarAuditoria } from "./auditoria";
import {
  ChaveDeLimiteSchema,
  DefinirLimiteDaAjudaSchema,
  LimiteAlteradoSchema,
  LimitesDaAjudaSchema,
} from "./contrato-de-rotas";

/**
 * OS MINUTOS DA AJUDA COM AVATAR (ADR-132) — a torneira do custo da Ajuda, ao
 * lado da quota de IA (ADR-105) e com o mesmo desenho.
 *
 * `@Roles("admin")` e nada mais, pela razão da quota: quanto de avatar uma rede
 * pode gastar por dia é decisão comercial da fornecedora (o vendor cobra por
 * minuto), não de quem administra o contrato do lado do cliente.
 *
 * Mora em `recursos`, e não em `ajuda`, porque é o painel da Unooria que a
 * opera: mesma guarda, mesmo histórico (`recursos_auditoria`), mesmo prefixo do
 * BFF. A Ajuda só LÊ a linha, a cada abertura de sessão.
 */
@Controller("recursos/limites-da-ajuda")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class LimitesDaAjudaController {
  constructor(private readonly prisma: PrismaService) {}

  /** Uma linha por chave da tupla, na ordem dela — nunca só as que existem. */
  private async listar() {
    const linhas = await this.prisma.ajudaLimite.findMany();
    const ids = linhas.map((l) => l.definidoPor).filter((id): id is string => id !== null);
    const autores = new Map<string, string>();
    if (ids.length > 0) {
      const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
      for (const u of users) autores.set(u.id, u.displayName);
    }
    return CHAVES_DE_LIMITE.map((chave) => {
      const linha = linhas.find((l) => l.chave === chave);
      return {
        chave,
        minutos: linha?.valor ?? LIMITES_PADRAO[chave],
        motivo: linha?.motivo ?? null,
        definidoPorNome: linha?.definidoPor ? (autores.get(linha.definidoPor) ?? "(conta sem nome)") : null,
        definidoEm: (linha?.definidoEm ?? new Date(0)).toISOString(),
      };
    });
  }

  @Get()
  @Contrato({
    resumo: "Os limites de minutos da Ajuda com avatar.",
    descricao:
      "Uma linha por chave de `ajuda_limites` (`minutos-por-dia`, `minutos-por-sessao`), escopo do contrato inteiro. É o que a Ajuda consulta ao abrir cada sessão: o teto da sessão é o menor entre o limite por sessão e o que sobra do dia da pessoa.",
    resposta: LimitesDaAjudaSchema,
    notas: ["Só `admin` (ADR-88/132). O uso de cada pessoa (`ajuda_sessoes`) NÃO sai aqui."],
  })
  async limites() {
    return { limites: await this.listar() };
  }

  @Put(":chave")
  @Contrato({
    resumo: "Define um limite de minutos da Ajuda.",
    descricao:
      "Sobrescreve a linha da chave em `ajuda_limites`. **Motivo obrigatório sempre.** A mudança entra no histórico do painel (`recursos_auditoria`, ação `quota-alterada`, `recurso_id` `ajuda:<chave>`, com `{ de, para }`).",
    params: z.object({ chave: ChaveDeLimiteSchema }),
    corpo: DefinirLimiteDaAjudaSchema,
    resposta: LimiteAlteradoSchema,
    notas: [
      "Zero é recusado: fechar a Ajuda é desligar o produto `ajuda` (ADR-87), não zerar o limite.",
      `Tetos de sanidade: 600 minutos por dia e ${MAXIMO_POR_SESSAO} por sessão (Zod e CHECK).`,
      "Vale na PRÓXIMA sessão aberta; a que está no ar mantém o teto com que nasceu.",
    ],
  })
  async definir(@Param("chave") chaveBruta: string, @Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const chave: ChaveDeLimite = ChaveDeLimiteSchema.parse(chaveBruta);
    const dados = DefinirLimiteDaAjudaSchema.parse(body);
    if (chave === "minutos-por-sessao" && dados.minutos > MAXIMO_POR_SESSAO) {
      throw new BadRequestException({ mensagem: `Uma sessão vai até ${MAXIMO_POR_SESSAO} minutos.` });
    }

    const atual = await this.prisma.ajudaLimite.findUnique({ where: { chave } });
    const de = atual?.valor ?? LIMITES_PADRAO[chave];
    if (atual && de === dados.minutos) {
      const [linha] = (await this.listar()).filter((l) => l.chave === chave);
      return { ...linha!, alterado: false };
    }

    await this.prisma.ajudaLimite.upsert({
      where: { chave },
      create: { chave, valor: dados.minutos, motivo: dados.motivo, definidoPor: req.auth.usuarioId },
      update: { valor: dados.minutos, motivo: dados.motivo, definidoPor: req.auth.usuarioId, definidoEm: new Date() },
    });

    logger.info(
      { codigo: "ajuda-limite-alterado", chave, de, para: dados.minutos, motivo: dados.motivo },
      "limite de minutos da Ajuda alterado",
    );
    await registrarAuditoria(
      this.prisma,
      {
        recursoId: `ajuda:${chave}`,
        escolaId: null,
        acao: "quota-alterada",
        detalhe: { de, para: dados.minutos },
        motivo: dados.motivo,
        autorId: req.auth.usuarioId,
      },
      (erro) =>
        logger.error(
          { codigo: "recurso-auditoria-nao-gravada", recursoId: `ajuda:${chave}`, acao: "quota-alterada", err: erro },
          "o limite mudou, mas o histórico não foi gravado",
        ),
    );

    const [linha] = (await this.listar()).filter((l) => l.chave === chave);
    return { ...linha!, alterado: true };
  }
}

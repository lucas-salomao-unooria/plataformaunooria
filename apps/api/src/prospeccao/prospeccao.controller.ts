import { Controller, Delete, Get, HttpCode, NotFoundException, Param, Req, Res, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { fusoDaPlataforma } from "../comum/fuso";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import {
  CadastroIdSchema,
  CadastrosSchema,
  EliminarCadastroParamsSchema,
  TETO_DA_LISTAGEM,
  type Cadastro,
} from "./contrato-de-rotas";

type RespostaHttp = { setHeader(nome: string, valor: string): void };
type Autenticado = { auth: AuthClaims };

/**
 * A LEITURA dos cadastros de interesse — o painel da Unooria (ADR-88/107).
 *
 * `@Roles("admin")` e nada mais, pela mesma razão da quota de IA (ADR-105):
 * quem procurou a Unooria antes de existir contrato é informação comercial da
 * fornecedora. Um `gestor_contrato` é o cliente — mostrar a ele a lista de
 * quem mais pediu apresentação seria entregar o funil da Unooria ao cliente.
 *
 * As queries desta tabela rodam FORA de `comTenancy`, e é o único lugar do
 * repositório em que isso vale: `prospeccao_leads` não tem `escola_id` nem RLS
 * porque não há tenant a isolar (ver a migration). A tranca é o papel.
 */
@Controller("prospeccao/cadastros")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class ProspeccaoController {
  constructor(private readonly prisma: PrismaService) {}

  private async listar(): Promise<{ cadastros: Cadastro[]; total: number }> {
    const [linhas, total] = await Promise.all([
      this.prisma.prospeccaoLead.findMany({
        orderBy: { criadoEm: "desc" },
        take: TETO_DA_LISTAGEM,
        select: { id: true, nome: true, email: true, telefone: true, organizacao: true, cargo: true, criadoEm: true },
      }),
      this.prisma.prospeccaoLead.count(),
    ]);
    return {
      cadastros: linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() })),
      total,
    };
  }

  @Get()
  @Contrato({
    resumo: "Os cadastros de interesse recebidos pelo site público.",
    descricao:
      "Do mais novo para o mais antigo. Alimenta `/unooria/prospeccao` (ADR-107). A data sai em **ISO 8601**, e quem a formata é a tela, no fuso da plataforma (ADR-98/99).",
    resposta: CadastrosSchema,
    notas: [
      "Só `admin` (ADR-88): é o funil comercial da Unooria, não da rede.",
      `A lista vem limitada a ${TETO_DA_LISTAGEM} linhas; \`total\` diz quantas existem de verdade — se os dois divergirem, a tela avisa em vez de mentir que aquilo é tudo.`,
      "O `id` da linha sai só para `DELETE /prospeccao/cadastros/:id` (eliminação a pedido do titular). Não há rota de edição, e não deve haver: cadastro não se edita.",
    ],
  })
  async cadastros() {
    return this.listar();
  }

  @Get("exportacao")
  @Contrato({
    resumo: "Os mesmos cadastros, em CSV.",
    descricao:
      "O arquivo que o `admin` baixa do painel. Separador `;` e BOM UTF-8: é o par que faz o Excel em português abrir o arquivo com as colunas separadas e os acentos certos — com vírgula, a planilha chega numa coluna só.",
    resposta: z.string(),
    tipoDaResposta: "text/csv",
    notas: [
      "Só `admin` (ADR-88).",
      "O caminho **não** termina em `.csv`, como em `/analise/exportar/:nivel`: segmento de rota com ponto quebra a validação de tipos do App Router no hub. O nome do arquivo sai no `content-disposition`.",
      "A data sai formatada no fuso da plataforma (`FUSO_DA_PLATAFORMA`), e não em ISO: este arquivo é lido por gente, numa planilha.",
    ],
  })
  async exportacao(@Res({ passthrough: true }) res: RespostaHttp) {
    const { cadastros } = await this.listar();
    const fuso = fusoDaPlataforma();
    /* `Intl`, nunca fatiar a string da data à mão (ADR-98), e o fuso vem do
       ambiente, nunca cravado (ADR-99). */
    const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso });

    /* Aspas em TODO campo e aspas internas dobradas: nome de secretaria leva
       vírgula e ponto-e-vírgula com frequência ("Secretaria Municipal de
       Educação; Diretoria de TI"), e um separador solto dentro do valor desloca
       a linha inteira sem nada acusar. */
    const aspas = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
    const linhas = [
      ["Data", "Nome", "E-mail", "Telefone", "Organização", "Cargo"],
      ...cadastros.map((c) => [quando.format(new Date(c.criadoEm)), c.nome, c.email, c.telefone, c.organizacao, c.cargo]),
    ];
    const corpo = `﻿${linhas.map((linha) => linha.map(aspas).join(";")).join("\r\n")}\r\n`;

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="cadastros-de-interesse.csv"`);
    return corpo;
  }

  @Delete(":id")
  @HttpCode(204)
  @Contrato({
    resumo: "Elimina um cadastro a pedido do titular (LGPD art. 18, VI).",
    descricao:
      "Apaga a linha de verdade — não há exclusão lógica: guardar o contato \"marcado como apagado\" seria continuar tratando o dado que a pessoa pediu para eliminar. É a razão de o `GRANT` desta tabela ter `DELETE` e não ter `UPDATE` (ver a migration).",
    params: EliminarCadastroParamsSchema,
    resposta: z.void(),
    notas: [
      "Só `admin` (ADR-88).",
      "Id que não existe, ou fora do formato: **404** `cadastro-inexistente`. Apagar duas vezes não é erro do titular, mas a tela recebe o 404 e relê a lista.",
      "O registro do atendimento é a linha de log `prospeccao-cadastro-eliminado`, com QUEM eliminou e QUANDO — e nenhum dado da pessoa eliminada.",
    ],
  })
  async eliminar(@Param("id") bruto: string, @Req() req: Autenticado): Promise<void> {
    const lido = CadastroIdSchema.safeParse(bruto);
    const naoAchou = () =>
      new NotFoundException({ codigo: "cadastro-inexistente", mensagem: "Cadastro não encontrado." });
    if (!lido.success) throw naoAchou();
    /* `deleteMany` e não `delete`: o `delete` do Prisma LANÇA quando não acha a
       linha, e a contagem diz a mesma coisa sem exceção para traduzir. */
    const { count } = await this.prisma.prospeccaoLead.deleteMany({ where: { id: lido.data } });
    if (count === 0) throw naoAchou();
    /* O comprovante de que o pedido foi atendido, sem o dado de quem pediu: nem
       nome, nem e-mail, nem o id (que já não aponta para nada). */
    logger.info(
      { codigo: "prospeccao-cadastro-eliminado", eliminadoPor: req.auth.usuarioId },
      "cadastro de interesse eliminado a pedido do titular",
    );
  }
}

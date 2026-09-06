import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogoSchema, UmaExperienciaSchema, UpsertSchema } from "./contrato-de-rotas";

/**
 * Manifesto de versões das experiências — o `experiencia.json` finalmente é
 * LIDO: o CI faz upsert aqui ao publicar um bundle em
 * `gs://{contrato}-exp/{expId}/{versao}/`, e o hub monta a URL do iframe com
 * `versaoAtiva`. Rollback = PUT trocando a versão. Catálogo do contrato:
 * tabela global, sem RLS (não é dado de estudante).
 */


const EXP_ID_RE = /^exp-[a-z0-9-]+$/;

@Controller("experiencias")
@UseGuards(OidcGuard, RolesGuard)
export class ExperienciasController {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo — qualquer usuário autenticado (o hub filtra por série na UI). */
  @Get()
  @Contrato({
    resumo: "O catálogo de experiências do contrato.",
    descricao:
      "Tabela GLOBAL, sem RLS: manifesto de versões não é dado de estudante. O hub monta a URL do iframe com `versaoAtiva`, e filtra por série na interface.",
    resposta: CatalogoSchema,
    notas: [
      "`series: []` quer dizer TODAS as séries, não nenhuma — é como uma experiência transversal se declara (exp-70).",
    ],
  })
  async listar() {
    const experiencias = await this.prisma.experiencia.findMany({ orderBy: { expId: "asc" } });
    return { experiencias };
  }

  @Get(":expId")
  @Contrato({
    resumo: "Uma linha do manifesto.",
    descricao:
      "Devolve `experiencia: null` quando não há linha — e isso não é erro: o hub cai no `experiencia.json` servido ao lado do bundle. É o caso de dev e o de uma stack nova, antes do primeiro publish do CI.",
    params: z.object({ expId: z.string() }),
    resposta: UmaExperienciaSchema,
  })
  async uma(@Param("expId") expId: string) {
    const experiencia = await this.prisma.experiencia.findUnique({ where: { expId } });
    return { experiencia };
  }

  /** Upsert do CI (ou rollback manual) — só admin-contrato. */
  @Put(":expId")
  @Roles("admin-contrato")
  @Contrato({
    resumo: "Publica ou faz rollback de uma versão.",
    descricao:
      "Chamada pelo CI ao publicar `gs://{contrato}-exp/{expId}/{versao}/`, com o conteúdo do `public/experiencia.json` da experiência. **Rollback é trocar `versaoAtiva` para a anterior** — não há deploy a desfazer, porque o bundle antigo continua no bucket.",
    params: z.object({ expId: z.string().regex(EXP_ID_RE) }),
    corpo: UpsertSchema,
    resposta: UmaExperienciaSchema,
    notas: [
      "`permissoes` é POR EXPERIÊNCIA: prender o ponteiro do estudante é capacidade de quem declarou, nunca default do frame.",
      "`viewport` ausente ⇒ o hub NÃO embeda dentro da casca de aparelho (a exp-02 foi desenhada para desktop).",
    ],
  })
  async upsert(@Param("expId") expId: string, @Body() body: unknown, @Req() _req: { auth: AuthClaims }) {
    const dados = UpsertSchema.parse(body);
    const id = z.string().regex(EXP_ID_RE, "expId no formato exp-<slug>").parse(expId);
    const experiencia = await this.prisma.experiencia.upsert({
      where: { expId: id },
      update: {
        nome: dados.nome,
        versaoAtiva: dados.versaoAtiva,
        series: dados.series,
        unidade: dados.unidade ?? null,
        capabilities: dados.capabilities,
        viewport: dados.viewport ?? undefined,
        publico: dados.publico,
        permissoes: dados.permissoes,
      },
      create: {
        expId: id,
        nome: dados.nome,
        versaoAtiva: dados.versaoAtiva,
        series: dados.series,
        unidade: dados.unidade ?? null,
        capabilities: dados.capabilities,
        viewport: dados.viewport ?? undefined,
        publico: dados.publico,
        permissoes: dados.permissoes,
      },
    });
    return { experiencia };
  }
}

import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { SERIES } from "../comum/series";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Manifesto de versões das experiências — o `experiencia.json` finalmente é
 * LIDO: o CI faz upsert aqui ao publicar um bundle em
 * `gs://{contrato}-exp/{expId}/{versao}/`, e o hub monta a URL do iframe com
 * `versaoAtiva`. Rollback = PUT trocando a versão. Catálogo do contrato:
 * tabela global, sem RLS (não é dado de aluno).
 */

const UpsertSchema = z.object({
  nome: z.string().min(1).max(120),
  versaoAtiva: z.string().regex(/^\d+\.\d+\.\d+$/, "versão semver x.y.z"),
  series: z.array(z.enum(SERIES)).default([]),
  capabilities: z
    .array(z.enum(["telemetria", "progresso", "ia", "avaliacao", "tempo-real"]))
    .default([]),
  viewport: z.object({ largura: z.number().int().positive(), altura: z.number().int().positive() }).nullish(),
  /**
   * Para quem é a experiência. `series` pressupõe aluno; uma ferramenta de
   * professor (exp-90, plano de aula) declara `publico: "professor"` e o hub
   * recusa embedá-la em `/exp/*` (rota do aluno). Aditivo: ausente = aluno.
   */
  publico: z.enum(["aluno", "professor"]).default("aluno"),
  /**
   * Permissões de iframe que esta experiência precisa. Lista FECHADA e curta:
   * hoje só `pointer-lock`, que liga o token `allow-pointer-lock` do sandbox
   * do `ExpFrame` (jogo 3D em primeira pessoa, exp-70). Ausente/vazio =
   * nenhuma. Prender o ponteiro do aluno é capacidade de quem declarou, nunca
   * default do frame. `fullscreen` não entra: o `allow` do frame já o delega a
   * todas as experiências.
   */
  permissoes: z.array(z.enum(["pointer-lock", "forms"])).default([]),
});

const EXP_ID_RE = /^exp-[a-z0-9-]+$/;

@Controller("experiencias")
@UseGuards(OidcGuard, RolesGuard)
export class ExperienciasController {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo — qualquer usuário autenticado (o hub filtra por série na UI). */
  @Get()
  async listar() {
    const experiencias = await this.prisma.experiencia.findMany({ orderBy: { expId: "asc" } });
    return { experiencias };
  }

  @Get(":expId")
  async uma(@Param("expId") expId: string) {
    const experiencia = await this.prisma.experiencia.findUnique({ where: { expId } });
    return { experiencia };
  }

  /** Upsert do CI (ou rollback manual) — só admin-contrato. */
  @Put(":expId")
  @Roles("admin-contrato")
  async upsert(@Param("expId") expId: string, @Body() body: unknown, @Req() _req: { auth: AuthClaims }) {
    const dados = UpsertSchema.parse(body);
    const id = z.string().regex(EXP_ID_RE, "expId no formato exp-<slug>").parse(expId);
    const experiencia = await this.prisma.experiencia.upsert({
      where: { expId: id },
      update: {
        nome: dados.nome,
        versaoAtiva: dados.versaoAtiva,
        series: dados.series,
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
        capabilities: dados.capabilities,
        viewport: dados.viewport ?? undefined,
        publico: dados.publico,
        permissoes: dados.permissoes,
      },
    });
    return { experiencia };
  }
}

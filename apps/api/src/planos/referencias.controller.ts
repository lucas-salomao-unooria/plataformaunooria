import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { ehUuid, naoEncontrado } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { ImportarReferenciaSchema } from "./catalogo";
import {
  InventarioDeReferenciasSchema,
  OkSchema,
  ReferenciaImportadaSchema,
} from "./contrato-de-rotas";

/**
 * Importação das referências curriculares do CONTRATO (currículo da rede,
 * material didático) — chamada pelo `scripts/importar-referencias-plano.mjs`,
 * que extrai o texto dos PDF/DOCX localmente e manda só texto.
 *
 * Autenticação por chave de serviço (`x-import-token` = PLANOS_IMPORT_TOKEN),
 * o mesmo desenho de `POST /perfis/importar`: env ausente = rota DESLIGADA
 * (503), nunca aberta. É catálogo global (sem escola_id), fora da RLS.
 */
@Controller("planos/referencias")
export class ReferenciasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private autorizar(token: string | undefined): void {
    const esperado = this.config.get<string>("PLANOS_IMPORT_TOKEN");
    if (!esperado) {
      throw new HttpException(
        { mensagem: "Importação de referências desligada: PLANOS_IMPORT_TOKEN não configurado." },
        503,
      );
    }
    if (token !== esperado) throw new HttpException({ mensagem: "Token inválido." }, 401);
  }

  /** Inventário (sem o texto) para o script ser idempotente e para auditoria. */
  @Get()
  @Contrato({
    resumo: "O inventário das referências curriculares do contrato.",
    descricao:
      "**Sem o texto**: existe para o script de importação ser idempotente e para auditoria — o texto de um currículo inteiro não cabe numa listagem.",
    resposta: InventarioDeReferenciasSchema,
    acesso: "servico",
    notas: ["Catálogo GLOBAL do contrato: sem `escola_id`, fora da RLS."],
  })
  async listar(@Headers("x-import-token") token: string | undefined) {
    this.autorizar(token);
    const referencias = await this.prisma.planoReferencia.findMany({
      orderBy: [{ disciplina: "asc" }, { serie: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      select: { id: true, disciplina: true, serie: true, nome: true, ordem: true, atualizadoEm: true },
    });
    return { referencias };
  }

  /** Upsert por (disciplina, serie, nome). */
  @Post()
  @HttpCode(200)
  @Contrato({
    resumo: "Importa (ou sobrescreve) uma referência curricular.",
    descricao:
      "Chamada pelo `scripts/importar-referencias-plano.mjs`, que extrai o texto dos PDF/DOCX **localmente** e manda só texto. Upsert por `(disciplina, serie, nome)`.",
    corpo: ImportarReferenciaSchema,
    resposta: ReferenciaImportadaSchema,
    acesso: "servico",
    notas: [
      "`serie: null` = vale para todas as séries daquela disciplina.",
      "O upsert é find + update/create, e não `upsert`: `serie` nulo não entra em `where` de unique composto no Prisma, e o Postgres trata NULLs como distintos no índice.",
      "Sem `PLANOS_IMPORT_TOKEN` a rota responde **503** — desligada, nunca aberta.",
    ],
  })
  async importar(@Headers("x-import-token") token: string | undefined, @Body() body: unknown) {
    this.autorizar(token);
    const parsed = ImportarReferenciaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        mensagem: "Referência inválida.",
        campos: parsed.error.flatten().fieldErrors,
      });
    }
    const { disciplina, nome, texto, ordem } = parsed.data;
    const serie = parsed.data.serie ?? null;

    // `serie` nulo não entra em `where` de unique composto no Prisma (e o
    // Postgres trata NULLs como distintos no índice) — daí find + update/create.
    const existente = await this.prisma.planoReferencia.findFirst({
      where: { disciplina, serie, nome },
      select: { id: true },
    });
    const referencia = existente
      ? await this.prisma.planoReferencia.update({
          where: { id: existente.id },
          data: { texto, ordem },
          select: { id: true, disciplina: true, serie: true, nome: true, ordem: true },
        })
      : await this.prisma.planoReferencia.create({
          data: { disciplina, serie, nome, texto, ordem },
          select: { id: true, disciplina: true, serie: true, nome: true, ordem: true },
        });
    return { referencia, atualizada: Boolean(existente), caracteres: texto.length };
  }

  @Delete(":id")
  @Contrato({
    resumo: "Remove uma referência do catálogo.",
    params: z.object({ id: z.string().uuid() }),
    resposta: OkSchema,
    acesso: "servico",
  })
  async remover(@Headers("x-import-token") token: string | undefined, @Param("id") id: string) {
    this.autorizar(token);
    if (!ehUuid(id)) naoEncontrado();
    const { count } = await this.prisma.planoReferencia.deleteMany({ where: { id } });
    if (count === 0) naoEncontrado();
    return { ok: true };
  }
}

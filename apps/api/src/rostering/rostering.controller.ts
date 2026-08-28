import {
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { ARQUIVOS_ONEROSTER, type ArquivoOneRoster } from "./catalogo";
import { OneRosterService } from "./oneroster.service";
import { exemploPreenchido, modeloEmBranco } from "./planilha";
import { MAX_LINHAS, RosteringService } from "./rostering.service";

interface RespostaHttp {
  setHeader(nome: string, valor: string): void;
}

const TETO_DO_ARQUIVO = 10_000_000; // 10 MB — 10 mil alunos não cabem em 1 MB

const ImportarSchema = z.object({
  escolaId: z.string().min(1).optional(),
  /** Senha única do lote, escolhida na tela. Vale só para quem nasce aqui. */
  senhaPadrao: z.string().min(8).max(200).optional(),
  /** "1" = uma senha diferente por pessoa. */
  gerarSenhas: z.enum(["0", "1"]).optional(),
});

const OneRosterSchema = ImportarSchema.extend({
  modo: z.enum(["bulk", "delta"]).optional(),
});

/**
 * Fronteira de entrada de pessoas e turmas. Só gestor (própria escola) e
 * admin-contrato (qualquer escola, via `?escolaId=`).
 */
@Controller("rostering")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class RosteringController {
  constructor(
    private readonly rostering: RosteringService,
    private readonly oneroster: OneRosterService,
  ) {}

  /**
   * O modelo em branco. Gerado da MESMA constante que o leitor consome — um
   * modelo escrito à mão divergiria do parser no primeiro campo novo, e o
   * sintoma seria "importei o modelo de vocês e deu erro de cabeçalho".
   */
  @Get("modelos/usuarios.csv")
  modelo(@Res({ passthrough: true }) res: RespostaHttp): string {
    return this.comoCsv(res, "modelo-usuarios.csv", modeloEmBranco());
  }

  @Get("modelos/exemplo.csv")
  exemplo(@Res({ passthrough: true }) res: RespostaHttp): string {
    return this.comoCsv(res, "exemplo-usuarios.csv", exemploPreenchido());
  }

  private comoCsv(res: RespostaHttp, arquivo: string, conteudo: string): string {
    // BOM + charset: um sem o outro ainda quebra acento em alguma planilha.
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${arquivo}"`);
    return `﻿${conteudo}`;
  }

  /** Corpo: o CSV cru (`Content-Type: text/csv`). */
  @Post("importar")
  async importar(
    @Query() query: Record<string, string>,
    @Req() req: { auth: AuthClaims; body: unknown },
  ) {
    const q = ImportarSchema.parse(query);
    const escolaId = escolaAlvo(req.auth, q.escolaId);

    const cota = rateLimit(`importar:${req.auth.usuarioId}`, 5, 60_000);
    if (!cota.ok) throw new HttpException("Muitas importações — aguarde um minuto", 429);

    if (typeof req.body !== "string" || req.body.length === 0) {
      throw new HttpException({ mensagem: "Envie o CSV cru no corpo com Content-Type: text/csv" }, 400);
    }
    if (req.body.length > TETO_DO_ARQUIVO) {
      throw new HttpException(
        { mensagem: `CSV acima de 10MB — divida o arquivo (máx. ${MAX_LINHAS} linhas)` },
        400,
      );
    }

    return this.rostering.importarPlanilha(escolaId, req.body, {
      senhaPadrao: q.senhaPadrao,
      gerarSenhas: q.gerarSenhas === "1",
    });
  }

  /**
   * Binding CSV do OneRoster 1.2 — UM arquivo por chamada, nesta ordem:
   * `manifest`, `orgs`, `academicSessions`, `classes`, `users`, `enrollments`,
   * `roles`. Fora de ordem não corrompe nada: a linha que referencia
   * `sourcedId` inexistente volta no relatório dizendo qual arquivo falta.
   */
  @Post("oneroster/:arquivo")
  async oneRoster(
    @Param("arquivo") arquivo: string,
    @Query() query: Record<string, string>,
    @Req() req: { auth: AuthClaims; body: unknown },
  ) {
    const q = OneRosterSchema.parse(query);
    const escolaId = escolaAlvo(req.auth, q.escolaId);

    if (!(ARQUIVOS_ONEROSTER as readonly string[]).includes(arquivo)) {
      throw new HttpException(
        { mensagem: `arquivo desconhecido — use um de: ${ARQUIVOS_ONEROSTER.join(", ")}` },
        400,
      );
    }

    const cota = rateLimit(`oneroster:${req.auth.usuarioId}`, 20, 60_000);
    if (!cota.ok) throw new HttpException("Muitas importações — aguarde um minuto", 429);

    if (typeof req.body !== "string" || req.body.length === 0) {
      throw new HttpException({ mensagem: "Envie o CSV cru no corpo com Content-Type: text/csv" }, 400);
    }
    if (req.body.length > TETO_DO_ARQUIVO) {
      throw new HttpException({ mensagem: "CSV acima de 10MB — divida o arquivo" }, 400);
    }

    return this.oneroster.importar(escolaId, arquivo as ArquivoOneRoster, req.body, {
      modo: q.modo,
      senhaPadrao: q.senhaPadrao,
      gerarSenhas: q.gerarSenhas === "1",
      // Escola é tenant: só o admin do contrato abre inquilino novo por CSV.
      podeCriarEscola: req.auth.perfil === "admin-contrato",
    });
  }

  /** Diagnóstico das contas sem matrícula da rede (as que podem ser de assento). */
  @Get("contas-de-assento")
  async contasDeAssento(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: { auth: AuthClaims }) {
    return this.rostering.contasDeAssento(escolaAlvo(req.auth, escolaIdPedida));
  }
}

import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { MAX_LINHAS, UsuariosService } from "./usuarios.service";

const ListarSchema = z.object({
  papel: z.enum(["aluno", "professor", "gestor"]).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  escolaId: z.string().min(1).optional(),
});

/**
 * Gestão de usuários — só gestor (própria escola) e admin-contrato (qualquer
 * escola, via ?escolaId= — a exceção cross-escola da regra 1).
 */
@Controller("usuarios")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /** A escola alvo vem do TOKEN para gestor; admin-contrato pode escolher. */
  private escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
    if (auth.perfil === "admin-contrato") {
      if (!escolaIdPedida) throw new BadRequestException("admin-contrato: informe ?escolaId=");
      return escolaIdPedida;
    }
    if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
      throw new ForbiddenException("gestor só administra a própria escola");
    }
    return auth.escolaId;
  }

  @Get()
  async listar(@Query() query: Record<string, string>, @Req() req: { auth: AuthClaims }) {
    const q = ListarSchema.parse(query);
    const escolaId = this.escolaAlvo(req.auth, q.escolaId);
    return this.usuarios.listar(escolaId, { papel: q.papel, pagina: q.pagina, porPagina: q.porPagina });
  }

  /** Body: o CSV cru (Content-Type: text/csv). Limite 1MB / 5.000 linhas. */
  @Post("importar-csv")
  async importarCsv(
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims; body: unknown; headers: Record<string, string | undefined> },
  ) {
    const escolaId = this.escolaAlvo(req.auth, escolaIdPedida);

    const cota = rateLimit(`importar-csv:${req.auth.usuarioId}`, 5, 60_000);
    if (!cota.ok) throw new HttpException("Muitas importações — aguarde um minuto", 429);

    if (typeof req.body !== "string" || req.body.length === 0) {
      throw new BadRequestException("Envie o CSV cru no corpo com Content-Type: text/csv");
    }
    if (req.body.length > 1_000_000) {
      throw new BadRequestException(`CSV acima de 1MB — divida o arquivo (máx. ${MAX_LINHAS} linhas)`);
    }
    return this.usuarios.importarCsv(escolaId, req.body);
  }

  @Post(":id/reset-senha")
  async resetarSenha(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims },
  ) {
    const escolaId = this.escolaAlvo(req.auth, escolaIdPedida);
    const resultado = await this.usuarios.resetarSenha(escolaId, id);
    if (!resultado) throw new BadRequestException("usuário não encontrado nesta escola");
    return resultado;
  }
}

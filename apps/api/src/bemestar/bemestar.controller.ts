import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { BemEstarService } from "./bemestar.service";
import { ResponderSchema } from "./catalogo";

/**
 * Rotas do PROFESSOR da exp-91-bem-estar. Identidade sempre do token; posse
 * checada em toda rota com id. NÃO existe rota de gestor/admin aqui de
 * propósito: as respostas são dado sensível de saúde do professor e só ele lê
 * (ver docs/DECISOES.md).
 */

type Autenticado = { auth: AuthClaims };

function limitar(chave: string, limite: number, janelaMs: number) {
  const r = rateLimit(chave, limite, janelaMs);
  if (!r.ok) {
    throw new HttpException(
      { codigo: "RATE_LIMIT", mensagem: `Muitas requisições seguidas. Tente de novo em ${r.retryAfterSeconds}s.` },
      429,
    );
  }
}

@Controller("bemestar")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class BemEstarController {
  constructor(private readonly bemEstar: BemEstarService) {}

  /** Estado leve para o card do hub — sem abrir ciclo nem chamar IA. */
  @Get("resumo")
  resumo(@Req() req: Autenticado) {
    limitar(`bemestar:resumo:${req.auth.usuarioId}`, 120, 60 * 60_000);
    return this.bemEstar.resumo(req.auth.escolaId, req.auth.usuarioId);
  }

  /** O check-in de hoje (cria o pendente se ainda não houver — pode chamar IA). */
  @Get("hoje")
  hoje(@Req() req: Autenticado) {
    limitar(`bemestar:hoje:${req.auth.usuarioId}`, 60, 60 * 60_000);
    return this.bemEstar.hoje(req.auth.escolaId, req.auth.usuarioId, req.auth.perfil);
  }

  @Post("checkins/:id/respostas")
  responder(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    limitar(`bemestar:responder:${req.auth.usuarioId}`, 20, 60 * 60_000);
    const parsed = ResponderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ mensagem: "Responda às três frases (0 a 3); o texto livre tem até 600 caracteres." });
    }
    return this.bemEstar.responder(req.auth.escolaId, req.auth.usuarioId, req.auth.perfil, id, parsed.data);
  }

  @Get("historico")
  historico(@Req() req: Autenticado) {
    limitar(`bemestar:historico:${req.auth.usuarioId}`, 60, 60 * 60_000);
    return this.bemEstar.historico(req.auth.escolaId, req.auth.usuarioId);
  }

  /** LGPD (direito de eliminação): apaga tudo do professor logado. */
  @Delete("dados")
  apagar(@Req() req: Autenticado) {
    limitar(`bemestar:apagar:${req.auth.usuarioId}`, 5, 60 * 60_000);
    return this.bemEstar.apagarTudo(req.auth.escolaId, req.auth.usuarioId);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { VIDEO_IDS } from "./catalogo";
import { UnootubeService } from "./unootube.service";

/**
 * Rotas do ALUNO da exp-02-unootube. O gabarito (`factual`) fica no servidor:
 * o cliente manda a escolha, a api corrige e devolve inscritos/fontes
 * (regra inviolável nº 3). Identidade sempre do token, nunca do body.
 */

const VideoIdSchema = z.enum(VIDEO_IDS);
const SalvarSchema = z.object({ videoId: VideoIdSchema });

type Autenticado = { auth: AuthClaims };

function videoIdOu400(bruto: unknown): string {
  const parsed = VideoIdSchema.safeParse(bruto);
  if (!parsed.success) {
    throw new BadRequestException({
      codigo: "VIDEO_DESCONHECIDO",
      mensagem: "Esse vídeo não está mais disponível.",
    });
  }
  return parsed.data;
}

/** Por usuário, nunca por IP (a turma inteira sai pelo mesmo NAT da escola). */
function limitar(usuarioId: string) {
  const r = rateLimit(`unootube:${usuarioId}`, 120, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
  }
}

@Controller("unootube")
@UseGuards(OidcGuard, RolesGuard)
@Roles("aluno")
export class UnootubeController {
  constructor(private readonly unootube: UnootubeService) {}

  @Get("sessao")
  sessao(@Req() req: Autenticado) {
    return this.unootube.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("salvos")
  @HttpCode(200)
  salvar(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const parsed = SalvarSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        codigo: "VIDEO_DESCONHECIDO",
        mensagem: "Esse vídeo não está mais disponível.",
      });
    }
    return this.unootube.salvar(req.auth.escolaId, req.auth.usuarioId, parsed.data.videoId);
  }

  /** POST explícito em vez de DELETE: a SDK só expõe get/post; semântica idempotente igual. */
  @Post("salvos/:videoId/remover")
  @HttpCode(200)
  remover(@Param("videoId") videoId: string, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.remover(req.auth.escolaId, req.auth.usuarioId, videoIdOu400(videoId));
  }

  @Post("curtidos/:videoId")
  @HttpCode(200)
  curtir(@Param("videoId") videoId: string, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.curtir(req.auth.escolaId, req.auth.usuarioId, videoIdOu400(videoId));
  }

  @Get("ranking")
  ranking(@Req() req: Autenticado) {
    return this.unootube.ranking(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("credibilidade")
  @HttpCode(200)
  credibilidade(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.credibilidade(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("reiniciar")
  @HttpCode(200)
  reiniciar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.reiniciar(req.auth.escolaId, req.auth.usuarioId);
  }
}

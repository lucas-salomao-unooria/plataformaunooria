import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { CriarPlanoSchema, RenomearSchema, SalvarConteudoSchema } from "./catalogo";
import { PlanosService } from "./planos.service";

/**
 * Rotas do PROFESSOR da exp-90-plano-de-aula. Identidade (professor, escola)
 * sempre do token — nunca do body. Posse checada em toda rota com id.
 */

type Autenticado = { auth: AuthClaims };

@Controller("planos")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class PlanosController {
  constructor(private readonly planos: PlanosService) {}

  /** Disciplinas/séries com material importado — alimenta os `Selection`. */
  @Get("referencias/disponiveis")
  disponiveis() {
    return this.planos.disponiveis();
  }

  @Get()
  listar(@Req() req: Autenticado) {
    return this.planos.listar(req.auth.escolaId, req.auth.usuarioId);
  }

  /** 202: a geração corre em background; acompanhar por GET /planos/:id. */
  @Post()
  @HttpCode(202)
  criar(@Body() body: unknown, @Req() req: Autenticado) {
    // Cada geração custa ~220k tokens de prompt: 3 por hora por professor é
    // generoso para uso real e barra um laço de cliques.
    const limite = rateLimit(`plano:gerar:${req.auth.usuarioId}`, 3, 60 * 60_000);
    if (!limite.ok) {
      throw new HttpException(
        {
          codigo: "RATE_LIMIT",
          mensagem: `Muitas gerações seguidas. Tente de novo em ${Math.ceil(limite.retryAfterSeconds / 60)} min.`,
        },
        429,
      );
    }
    const parsed = CriarPlanoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ mensagem: "Escolha a disciplina e a série." });
    }
    return this.planos.criar(req.auth.escolaId, req.auth.usuarioId, req.auth.perfil, parsed.data);
  }

  @Get(":id")
  obter(@Param("id") id: string, @Req() req: Autenticado) {
    return this.planos.obter(req.auth.escolaId, req.auth.usuarioId, id);
  }

  /** O botão Salvar do editor. */
  @Put(":id/conteudo")
  salvar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const parsed = SalvarConteudoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ mensagem: "O conteúdo está vazio ou grande demais (limite 1 MB)." });
    }
    return this.planos.salvarConteudo(req.auth.escolaId, req.auth.usuarioId, id, parsed.data.html);
  }

  @Patch(":id")
  renomear(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const parsed = RenomearSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Título entre 3 e 160 caracteres." });
    return this.planos.renomear(req.auth.escolaId, req.auth.usuarioId, id, parsed.data.titulo);
  }

  @Post(":id/restaurar")
  @HttpCode(200)
  restaurar(@Param("id") id: string, @Req() req: Autenticado) {
    return this.planos.restaurar(req.auth.escolaId, req.auth.usuarioId, id);
  }

  @Delete(":id")
  excluir(@Param("id") id: string, @Req() req: Autenticado) {
    return this.planos.excluir(req.auth.escolaId, req.auth.usuarioId, id);
  }
}

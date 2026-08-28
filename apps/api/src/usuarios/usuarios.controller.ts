import {
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { MAX_LINHAS, RosteringService } from "../rostering/rostering.service";
import { UsuariosService } from "./usuarios.service";

const ListarSchema = z.object({
  papel: z.enum(["aluno", "professor", "gestor"]).optional(),
  turmaId: z.string().uuid().optional(),
  situacao: z.enum(["ativos", "inativos", "sem-primeiro-acesso"]).optional(),
  busca: z.string().trim().max(80).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  escolaId: z.string().min(1).optional(),
});

const EditarSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  email: z.union([z.literal(""), z.string().email().max(180)]).optional(),
  papel: z.enum(["aluno", "professor", "gestor"]).optional(),
  ativo: z.boolean().optional(),
});

/**
 * Gestão de usuários — só gestor (própria escola) e admin-contrato (qualquer
 * escola, via ?escolaId= — a exceção cross-escola da regra 1).
 */
@Controller("usuarios")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly rostering: RosteringService,
  ) {}

  @Get()
  async listar(@Query() query: Record<string, string>, @Req() req: { auth: AuthClaims }) {
    const q = ListarSchema.parse(query);
    const escolaId = escolaAlvo(req.auth, q.escolaId);
    return this.usuarios.listar(escolaId, q);
  }

  /**
   * Compatibilidade: a importação vive em `POST /rostering/importar`. Esta rota
   * continua respondendo porque scripts e a documentação a citam, e delega —
   * dois importadores lado a lado divergiriam na primeira regra nova.
   */
  @Post("importar-csv")
  async importarCsv(
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("senhaPadrao") senhaPadrao: string | undefined,
    @Req() req: { auth: AuthClaims; body: unknown },
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);

    const cota = rateLimit(`importar-csv:${req.auth.usuarioId}`, 5, 60_000);
    if (!cota.ok) throw new HttpException("Muitas importações — aguarde um minuto", 429);

    if (typeof req.body !== "string" || req.body.length === 0) {
      throw new HttpException({ mensagem: "Envie o CSV cru no corpo com Content-Type: text/csv" }, 400);
    }
    if (req.body.length > 10_000_000) {
      throw new HttpException(
        { mensagem: `CSV acima de 10MB — divida o arquivo (máx. ${MAX_LINHAS} linhas)` },
        400,
      );
    }
    return this.rostering.importarPlanilha(escolaId, req.body, { senhaPadrao });
  }

  @Patch(":id")
  async editar(
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims },
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const dados = EditarSchema.parse(body);
    const atualizado = await this.usuarios.atualizar(escolaId, id, {
      ...dados,
      ...(dados.email !== undefined ? { email: dados.email === "" ? null : dados.email } : {}),
    });
    if (!atualizado) throw new NotFoundException("usuário não encontrado nesta escola");
    return atualizado;
  }

  @Post(":id/reset-senha")
  async resetarSenha(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims },
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const resultado = await this.usuarios.resetarSenha(escolaId, id);
    if (!resultado) throw new NotFoundException("usuário não encontrado nesta escola");
    return resultado;
  }
}

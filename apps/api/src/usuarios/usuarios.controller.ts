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
import { digitosDoCpf } from "../comum/cpf";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { RelatorioDeImportacaoSchema } from "../rostering/contrato-de-rotas";
import { MAX_LINHAS, RosteringService } from "../rostering/rostering.service";
import {
  EditarSchema,
  ListarSchema,
  ListaDeUsuariosSchema,
  SenhaResetadaSchema,
  UsuarioEditadoSchema,
} from "./contrato-de-rotas";
import { UsuariosService } from "./usuarios.service";

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
  @Contrato({
    resumo: "As pessoas da escola, paginadas.",
    descricao:
      "A tela `/admin/usuarios`. Busca por nome, login, matrícula **e CPF — com ou sem pontuação**.",
    query: ListarSchema,
    resposta: ListaDeUsuariosSchema,
    notas: [
      "`situacao: sem-primeiro-acesso` lista quem ainda não trocou a senha da importação.",
      "A consulta roda dentro de `comTenancy` porque inclui MATRÍCULAS, que têm RLS: fora do contexto a lista voltaria com todo mundo \"sem turma\", em silêncio.",
    ],
  })
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
  @Contrato({
    resumo: "Compatibilidade: delega para `POST /rostering/importar`.",
    descricao:
      "Continua respondendo porque scripts e documentação a citam. **Delega** — dois importadores lado a lado divergiriam na primeira regra nova.",
    query: z.object({ escolaId: z.string().optional(), senhaPadrao: z.string().optional() }),
    corpo: z.string(),
    tipoDoCorpo: "text/csv",
    resposta: RelatorioDeImportacaoSchema,
  })
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
  @Contrato({
    resumo: "Edita nome, CPF, e-mail, papel ou situação da pessoa.",
    descricao:
      "Caminho de balcão: a planilha veio com o dígito trocado e a família traz o documento.",
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: EditarSchema,
    resposta: UsuarioEditadoSchema,
    notas: [
      "`cpf: \"\"` **APAGA** o campo — é o que se faz quando o número era de outra pessoa.",
      "Sair da REDE é `ativo: false`, não DELETE: há dado de aluno pendurado em oito tabelas.",
    ],
  })
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
      ...(dados.cpf !== undefined
        ? { cpf: dados.cpf === "" ? null : digitosDoCpf(dados.cpf) }
        : {}),
    });
    if (!atualizado) throw new NotFoundException("usuário não encontrado nesta escola");
    return atualizado;
  }

  @Post(":id/reset-senha")
  @Contrato({
    resumo: "Gera uma senha temporária e a devolve UMA vez.",
    descricao:
      "Marca a conta como provisória: quem entrar com ela cai em `/trocar-senha` sem saída — trava tripla, no middleware, no BFF e no `/api/exp-token`.",
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: SenhaResetadaSchema,
    notas: ["A senha **não fica em coluna nem em log**: se a tela perder, gera-se outra."],
  })
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

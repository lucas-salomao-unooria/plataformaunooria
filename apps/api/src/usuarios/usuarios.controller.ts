import {
  Body,
  Controller,
  ForbiddenException,
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
  PessoaSemEscolaCriadaSchema,
  CriarSemEscolaSchema,
  CriarUsuarioSchema,
  EditarSchema,
  ListarSchema,
  ListaDeUsuariosSchema,
  SenhaResetadaSchema,
  UsuarioCriadoSchema,
  UsuarioEditadoSchema,
} from "./contrato-de-rotas";
import { podeCriarPapel } from "./regras";
import { UsuariosService } from "./usuarios.service";
import { GESTORES, GESTORES_DO_CONTRATO } from "../auth/claims";

/**
 * Gestão de usuários — só gestor (própria escola) e admin-contrato (qualquer
 * escola, via ?escolaId= — a exceção cross-escola da regra 1).
 */
@Controller("usuarios")
@UseGuards(OidcGuard, RolesGuard)
@Roles(...GESTORES)
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
   * Cadastro unitário — o balcão que a ADR-54 previu e a ADR-59 abriu.
   *
   * Não é um segundo caminho de escrita: monta a MESMA linha de planilha e
   * chama o MESMO importador. O que muda em relação a importar um arquivo de
   * uma linha é a SEMÂNTICA — aqui "criar" significa criar, e quem já existe
   * recebe 409 em vez de ser atualizado em silêncio.
   */
  @Post()
  @Contrato({
    resumo: "Cadastra UMA pessoa da escola (estudante, professor ou gestor).",
    descricao:
      "O formulário de `/admin/usuarios`. Monta a mesma linha da planilha e delega ao importador (ADR-59) — por isso as regras de CPF, série, turno e login são idênticas às da importação.",
    query: z.object({ escolaId: z.string().min(1).optional() }),
    corpo: CriarUsuarioSchema,
    resposta: UsuarioCriadoSchema,
    notas: [
      "**Criar é criar**: CPF, matrícula ou login já existentes devolvem 409 e nada é escrito — o caminho de quem já existe é `PATCH /usuarios/:id`.",
      "CPF achado em OUTRA escola da rede devolve 409 sem id, sem nome e sem dizer qual escola: transferir é pela importação, que move a matrícula junto.",
      "A senha sai UMA vez no corpo da resposta e é sempre provisória. Em branco, é sorteada.",
      "`gestor_contrato` NÃO entra aqui: ele não tem escola nem lotação, e tem rota própria.",
      "Limite de 30 cadastros por minuto por usuário — é balcão, não carga.",
    ],
  })
  async criar(
    @Body() body: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims },
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);

    const cota = rateLimit(`criar-usuario:${req.auth.usuarioId}`, 30, 60_000);
    if (!cota.ok) throw new HttpException("Muitos cadastros seguidos — aguarde um minuto", 429);

    const dados = CriarUsuarioSchema.parse(body);
    /* Segunda tranca: o `@Roles` protege a ROTA, não o campo `papel` do corpo. */
    if (!podeCriarPapel(req.auth.perfil, dados.papel)) {
      throw new ForbiddenException(`${req.auth.perfil} não cria ${dados.papel}`);
    }
    return this.usuarios.criarPessoa(escolaId, dados);
  }

  /**
   * `gestor_contrato` tem rota própria porque não é pessoa da escola: sem
   * `escola_id`, sem lotação, sem turma. Manter na mesma rota exigiria um
   * corpo com metade dos campos inertes e uma regra de papel escondida no
   * service; separado, a matriz papel x rota se lê sozinha.
   */
  @Post("sem-escola")
  @Roles(...GESTORES_DO_CONTRATO)
  @Contrato({
    resumo: "Cadastra um papel SEM escola (`gestor_contrato` ou `gestor_regional`).",
    descricao:
      "Os papéis que não nascem por importação: não pertencem a escola nenhuma, e por isso não cabem numa linha de planilha da escola.\n\nQuem pode pedir qual sai da **cadeia de atribuição** (ADR-80): `admin` atribui `gestor_contrato`; `gestor_contrato` atribui `gestor_regional`. Pedir acima do próprio alcance é 403 — e a checagem é `podeCriarPapel`, não o `@Roles`, porque o guard protege a ROTA e não o campo `papel` do corpo.",
    corpo: CriarSemEscolaSchema,
    resposta: PessoaSemEscolaCriadaSchema,
    notas: [
      "Nasce com `escola_id` nulo e nenhuma lotação — é o mesmo formato que o seed cria.",
      "`gestor_regional` EXIGE `regionalId`, e `gestor_contrato` o recusa: é o escopo de um e não do outro, com CHECK bicondicional no banco.",
      "O login é único na REDE inteira, não na escola: o índice `(escola_id, username)` não cobre linha com `escola_id` nulo, e a autenticação procura o username na rede.",
      "A senha sai UMA vez e é provisória: o primeiro acesso cai em `/trocar-senha`.",
      "A rota se chamava `/usuarios/admin-contrato` e servia um papel só. O caminho mudou com o vocabulário (ADR-80).",
    ],
  })
  async criarSemEscola(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const cota = rateLimit(`criar-sem-escola:${req.auth.usuarioId}`, 5, 60_000);
    if (!cota.ok) throw new HttpException("Muitos cadastros seguidos — aguarde um minuto", 429);

    const dados = CriarSemEscolaSchema.parse(body);
    if (!podeCriarPapel(req.auth.perfil, dados.papel)) {
      throw new ForbiddenException(`${req.auth.perfil} não atribui ${dados.papel}`);
    }
    return this.usuarios.criarSemEscola(dados);
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
      "Sair da REDE é `ativo: false`, não DELETE: há dado de estudante pendurado em oito tabelas.",
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

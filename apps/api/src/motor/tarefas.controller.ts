import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { TarefasDoUnoovista } from "./canal-a/tarefas.service";
import {
  DevolutivaDoRaioXSchema,
  EnvioSchema,
  RaioXSchema,
  RespostaDoEnvioSchema,
  RespostaDoRaioXSchema,
  RespostaDosTermosSchema,
  RevelacaoConcluidaSchema,
  SituacaoDasTarefasSchema,
  TarefaEnviadaSchema,
  TermosSchema,
} from "./contrato-de-rotas";
import { ehUuid, naoEncontrado } from "./guardas";

type Autenticado = { auth: AuthClaims };
const Params = z.object({ id: z.string().uuid() });

/**
 * As TAREFAS do Canal A do Unoovista (ADR-167) — só do estudante, só da
 * própria sessão (`runDoEstudante`: id + estudante do token + escola).
 *
 * O envio responde SEMPRE `{ enviada: true }`: o estudante nunca vê o próprio
 * nível. As travas e as réguas estão em `canal-a/`.
 */
@Controller("runs")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class TarefasController {
  constructor(private readonly tarefas: TarefasDoUnoovista) {}

  private exigirId(id: string) {
    if (!ehUuid(id)) naoEncontrado();
  }

  private corpo<T>(schema: z.ZodType<T>, body: unknown, mensagem: string): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ codigo: "resposta-invalida", mensagem });
    return parsed.data;
  }

  @Get(":id/tarefas")
  @Contrato({
    resumo: "A situação das três tarefas do Canal A e da revelação.",
    descricao:
      "É por ela que a experiência decide o desvio por fase: o Raio-x pendente antes da revelação, a revelação antes das tarefas, a tarefa pendente antes da reflexão.",
    params: Params,
    resposta: SituacaoDasTarefasSchema,
  })
  situacao(@Param("id") id: string, @Req() req: Autenticado) {
    this.exigirId(id);
    return this.tarefas.situacao(id, req.auth.usuarioId, req.auth.escolaId);
  }

  @Get(":id/raio-x")
  @Contrato({
    resumo: "O 6a Raio-x: os 6 posts que o estudante viu, sem o lado.",
    descricao:
      "Só da resposta à pergunta-chave até o fim da revelação, para quem teve feed com lado. A composição é gravada na primeira leitura.",
    params: Params,
    resposta: RaioXSchema,
  })
  lerRaioX(@Param("id") id: string, @Req() req: Autenticado) {
    this.exigirId(id);
    return this.tarefas.lerRaioX(id, req.auth.usuarioId, req.auth.escolaId);
  }

  @Post(":id/raio-x")
  @HttpCode(200)
  @Contrato({
    resumo: "O envio do 6a Raio-x.",
    descricao: "Corrigido no servidor pelo lado gravado de cada post. Vale o primeiro envio. Enviar de novo é **409**.",
    params: Params,
    corpo: RespostaDoRaioXSchema,
    resposta: TarefaEnviadaSchema,
  })
  enviarRaioX(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    this.exigirId(id);
    const { respostas } = this.corpo(RespostaDoRaioXSchema, body, "Escolhe uma opção em cada post.");
    return this.tarefas.enviarRaioX(id, req.auth.usuarioId, req.auth.escolaId, respostas);
  }

  @Get(":id/raio-x/devolutiva")
  @Contrato({
    resumo: "A ponte da revelação: de onde veio cada post do Raio-x.",
    descricao: "Só da explicabilidade em diante, e só para quem enviou o 6a. Sem certo ou errado, sem contagem.",
    params: Params,
    resposta: DevolutivaDoRaioXSchema,
  })
  devolutiva(@Param("id") id: string, @Req() req: Autenticado) {
    this.exigirId(id);
    return this.tarefas.devolutivaDoRaioX(id, req.auth.usuarioId, req.auth.escolaId);
  }

  @Post(":id/revelacao/concluida")
  @HttpCode(200)
  @Contrato({
    resumo: "O estudante chegou à última tela da revelação.",
    descricao: "O toque em \"Ver meu relatório\". Abre o 6b e o 6c e fecha o Raio-x. Idempotente.",
    params: Params,
    resposta: RevelacaoConcluidaSchema,
  })
  concluirRevelacao(@Param("id") id: string, @Req() req: Autenticado) {
    this.exigirId(id);
    return this.tarefas.concluirRevelacao(id, req.auth.usuarioId, req.auth.escolaId);
  }

  @Get(":id/termos")
  @Contrato({
    resumo: "O 6b: as 5 cláusulas, os efeitos e as mudanças, sem gabarito.",
    descricao: "Só depois do cinza, para quem teve feed com lado e terminou a revelação.",
    params: Params,
    resposta: TermosSchema,
  })
  lerTermos(@Param("id") id: string, @Req() req: Autenticado) {
    this.exigirId(id);
    return this.tarefas.lerTermos(id, req.auth.usuarioId, req.auth.escolaId);
  }

  @Post(":id/termos")
  @HttpCode(200)
  @Contrato({
    resumo: "O envio do 6b.",
    descricao: "As regras marcadas, o efeito de cada uma e a mudança. Vale o primeiro envio.",
    params: Params,
    corpo: RespostaDosTermosSchema,
    resposta: TarefaEnviadaSchema,
  })
  enviarTermos(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    this.exigirId(id);
    const resposta = this.corpo(RespostaDosTermosSchema, body, "Responde os três passos.");
    return this.tarefas.enviarTermos(id, req.auth.usuarioId, req.auth.escolaId, resposta);
  }

  @Get(":id/envio")
  @Contrato({
    resumo: "O 6c: os 9 posts (sem lado, com a descrição do perfil) e as 4 mensagens.",
    descricao: "Só depois do cinza, para quem teve feed com lado e terminou a revelação.",
    params: Params,
    resposta: EnvioSchema,
  })
  lerEnvio(@Param("id") id: string, @Req() req: Autenticado) {
    this.exigirId(id);
    return this.tarefas.lerEnvio(id, req.auth.usuarioId, req.auth.escolaId);
  }

  @Post(":id/envio")
  @HttpCode(200)
  @Contrato({
    resumo: "O envio do 6c.",
    descricao:
      "Até 3 posts, uma mensagem e uma frase opcional (até 140 caracteres, só o professor lê, não entra no nível). Vale o primeiro envio.",
    params: Params,
    corpo: RespostaDoEnvioSchema,
    resposta: TarefaEnviadaSchema,
  })
  enviarEnvio(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    this.exigirId(id);
    const resposta = this.corpo(RespostaDoEnvioSchema, body, "Escolhe até 3 posts e uma mensagem.");
    return this.tarefas.enviarEnvio(id, req.auth.usuarioId, req.auth.escolaId, resposta);
  }
}

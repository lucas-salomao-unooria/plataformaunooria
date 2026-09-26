import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import {
  ParamsDaPerguntaSchema,
  PerguntaSchema,
  RespostaEnviadaSchema,
  RespostaSchema,
} from "./contrato-de-rotas";
import { EvidenciasService } from "./evidencias.service";

type Autenticado = { auth: AuthClaims };

function daPergunta(expId: string, perguntaId: string): { expId: string; perguntaId: string } {
  const r = ParamsDaPerguntaSchema.safeParse({ expId, perguntaId });
  if (!r.success) {
    const problema = r.error.issues[0];
    throw new BadRequestException({
      mensagem: `${problema?.path.join(".") ?? "parâmetro"}: ${problema?.message ?? "inválido"}`,
    });
  }
  return r.data;
}

/**
 * A EVIDÊNCIA, do lado do ESTUDANTE (E14) — e o que ele NÃO tem é o ponto: não
 * há rota para ver o próprio resultado. As duas daqui são a pergunta de
 * múltipla escolha (sem gabarito) e a resposta (`{ enviada: true }`, sempre).
 *
 * Controller separado do de professor de propósito, como em `salas` e
 * `equipes`: um `@Roles` misto com exceção por método é como uma rota acaba
 * aberta para quem não devia sem ninguém notar.
 */
@Controller("evidencias")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class EvidenciasEstudanteController {
  constructor(private readonly evidencias: EvidenciasService) {}

  @Get(":expId/perguntas/:perguntaId")
  @Contrato({
    resumo: "Uma pergunta de múltipla escolha da ficha da missão — sem o gabarito.",
    descricao:
      "O enunciado e as alternativas (`id` e `texto`). O nível que cada alternativa vale fica no servidor (regra 3): quem corrige é a api, na resposta.\n\nAs alternativas saem EMBARALHADAS, numa ordem nova a cada chamada: a ficha as guarda na ordem da régua, e servida assim \"a primeira é a certa\" vira a pista. A tela mostra na ordem que recebeu e responde pelo `id` — nunca pela posição.",
    params: ParamsDaPerguntaSchema,
    resposta: PerguntaSchema,
    notas: [
      "Pergunta que não existe na ficha da missão responde **404** `pergunta-nao-encontrada`.",
      "Missão não liberada na turma do estudante responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`, se a rede não tem o recurso).",
    ],
  })
  pergunta(@Param("expId") expId: string, @Param("perguntaId") perguntaId: string, @Req() req: Autenticado) {
    const alvo = daPergunta(expId, perguntaId);
    return this.evidencias.pergunta(req.auth.escolaId, req.auth.usuarioId, alvo.expId, alvo.perguntaId);
  }

  /**
   * `POST` que não devolve recurso criado, daí o `@HttpCode(200)`: a resposta
   * é só o recibo.
   */
  @Post(":expId/perguntas/:perguntaId/resposta")
  @HttpCode(200)
  @Contrato({
    resumo: "A resposta do estudante a uma pergunta — a api corrige, e só devolve o recibo.",
    descricao:
      "O corpo leva SÓ a alternativa. A atividade e a rodada saem do contexto da missão, no servidor — nunca do cliente. Vale a PRIMEIRA resposta; as seguintes são aceitas e ignoradas, e as duas respondem o mesmo `{ enviada: true }`: a criança não descobre, pela resposta, se acertou nem se já tinha respondido.",
    params: ParamsDaPerguntaSchema,
    corpo: RespostaSchema,
    resposta: RespostaEnviadaSchema,
    notas: [
      "Sem atividade em andamento na missão responde **409** `sem-atividade-em-andamento`.",
      "Missão não liberada na turma do estudante responde **403** `missao-nao-liberada`.",
      "Pergunta fora da ficha responde **404** `pergunta-nao-encontrada`; alternativa que não é dela, **400** `alternativa-desconhecida`.",
    ],
  })
  responder(
    @Param("expId") expId: string,
    @Param("perguntaId") perguntaId: string,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const alvo = daPergunta(expId, perguntaId);
    const { alternativaId } = RespostaSchema.parse(corpo);
    return this.evidencias.responder(
      req.auth.escolaId,
      req.auth.usuarioId,
      alvo.expId,
      alvo.perguntaId,
      alternativaId,
    );
  }
}

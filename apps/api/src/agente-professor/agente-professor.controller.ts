import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { DisponibilidadeGuard, Produto, SemDisponibilidade } from "../comum/disponibilidade.guard";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { z } from "zod";
import { AgenteProfessorService, erroJson, type RespostaSse } from "./agente-professor.service";
import {
  ApagadaSchema,
  ConversaCriadaSchema,
  ConversaIdSchema,
  ConversaSchema,
  EnviarMensagemSchema,
  ListaDeConversasSchema,
  StreamDeMensagemSchema,
  TAMANHO_MAXIMO_DA_MENSAGEM,
} from "./contrato-de-rotas";

/**
 * As rotas do AGENTE DE IA DO PROFESSOR. Contrato das quatro pontas:
 * `docs/regras/agente-professor.md`.
 *
 * Só `professor` (decisão do dono do produto: a coordenação ficou fora). O
 * interruptor da rede é por PRODUTO — não há experiência —, na CLASSE: rota nova
 * nasce coberta, e a única exceção é apagar (`@SemDisponibilidade`).
 *
 * Identidade SÓ do token: o `user_id` que vai ao Agent Engine é o `usuarioId`
 * do token, nunca um valor do corpo.
 */

type Autenticado = { auth: AuthClaims };

const IdParamsSchema = z.object({ id: ConversaIdSchema });

/** Mensagens por minuto por professor — cada uma pode custar várias chamadas ao modelo. */
export const LIMITE_DE_MENSAGENS_POR_MINUTO = 10;

function limitar(chave: string, limite: number, janelaMs: number) {
  const r = rateLimit(chave, limite, janelaMs);
  if (!r.ok) throw erroJson("RATE_LIMIT", 429, { retryAfterSeconds: r.retryAfterSeconds });
}

@Controller("agente-professor")
@UseGuards(OidcGuard, RolesGuard, DisponibilidadeGuard)
@Roles("professor")
@Produto("agente-professor")
export class AgenteProfessorController {
  constructor(private readonly service: AgenteProfessorService) {}

  private quem(req: Autenticado) {
    const { escolaId, usuarioId } = req.auth;
    /* Professor sem escola no token não existe: escola vazia é dos perfis de
       contrato, que o `@Roles` já barrou. */
    if (!escolaId) throw new ForbiddenException({ codigo: "sem-escola", mensagem: "Escolha uma escola." });
    return { escolaId, usuarioId };
  }

  /** Id que não é UUID responde como inexistente — sem 500 do Prisma e sem distinguir. */
  private id(bruto: string): string {
    const lido = ConversaIdSchema.safeParse(bruto);
    if (!lido.success) throw new NotFoundException({ codigo: "conversa-inexistente", mensagem: "Conversa não encontrada." });
    return lido.data;
  }

  @Get("conversas")
  @Contrato({
    resumo: "As conversas do professor na escola ativa, a mais recente primeiro.",
    descricao:
      "Sai do Postgres (`agente_professor_conversas`), que é a fonte da POSSE — o Agent Engine não confere o usuário numa sessão pedida por nome. Trocar de escola troca a lista: a conversa pertence a (professor, escola ativa).",
    resposta: ListaDeConversasSchema,
    notas: ["`titulo` é `null` até o fim do 1º turno: quem escreve o título é o agente (`titulo_conversa` no estado da sessão)."],
  })
  async listar(@Req() req: Autenticado) {
    const quem = this.quem(req);
    limitar(`agente-professor:ler:${quem.usuarioId}`, 120, 60_000);
    return this.service.listar(quem);
  }

  @Post("conversas")
  @Contrato({
    resumo: "Abre uma conversa nova com o agente de IA do professor.",
    descricao:
      "Cria a sessão no Agent Engine com o estado `nome_professor` (primeiro nome de `users.display_name`, lido do banco) e expiração distante, e grava a linha da posse. Não chama o modelo — não consome quota.",
    resposta: ConversaCriadaSchema,
    notas: [
      "**503** `{ codigo: \"AGENTE_INDISPONIVEL\" }` quando o agente não responde (ou `AGENTE_PROFESSOR_MODO=desligado`).",
      "**403** `{ codigo: \"recurso-indisponivel\" }` com o produto `agente-professor` desligado para a escola.",
    ],
  })
  async criar(@Req() req: Autenticado) {
    const quem = this.quem(req);
    limitar(`agente-professor:criar:${quem.usuarioId}`, 10, 60_000);
    return this.service.criar(quem);
  }

  @Get("conversas/:id")
  @Contrato({
    resumo: "Uma conversa: título e mensagens, montados da sessão no agente.",
    descricao:
      "Confere a posse (professor E escola) antes de tocar a sessão. As mensagens são o texto do professor e o texto FINAL do agente, sem os parciais do stream; `fontes` vem dos retornos de `buscar_acervo` daquele turno.",
    params: IdParamsSchema,
    resposta: ConversaSchema,
    notas: [
      "Conversa de OUTRO professor, ou de outra escola, é **404** — nunca 403, que confirmaria que o id existe.",
      "Se a sessão sumiu do agente (expirou), a linha é apagada e a resposta é 404.",
    ],
  })
  async ler(@Param("id") id: string, @Req() req: Autenticado) {
    const quem = this.quem(req);
    limitar(`agente-professor:ler:${quem.usuarioId}`, 120, 60_000);
    return this.service.ler(quem, this.id(id));
  }

  @Post("conversas/:id/mensagens")
  @HttpCode(200)
  @Contrato({
    resumo: "Envia uma mensagem e recebe a resposta do agente em SSE.",
    descricao:
      "Responde `text/event-stream` com os eventos `delta` / `fontes` / `titulo` / `aviso` / `fim` / `erro` de `docs/regras/agente-professor.md`, e `: ping` a cada 15 s. O stream termina em `fim` OU em `erro`. Teto de 240 s (`TEMPO_ESGOTADO`); fechar a conexão aborta a chamada ao agente.",
    params: IdParamsSchema,
    corpo: EnviarMensagemSchema,
    resposta: StreamDeMensagemSchema,
    tipoDaResposta: "text/event-stream",
    notas: [
      `\`texto\`: 1 a ${TAMANHO_MAXIMO_DA_MENSAGEM} caracteres depois do \`trim\` — fora disso, **400** JSON.`,
      `**429 JSON ANTES do stream**: \`{ codigo: "RATE_LIMIT" }\` acima de ${LIMITE_DE_MENSAGENS_POR_MINUTO} mensagens por minuto, \`{ codigo: "QUOTA" }\` sem saldo diário de IA (perfil \`professor\`, \`ia_quotas\`).`,
      "Os tokens consumidos são a soma dos eventos NÃO parciais do turno, contados mesmo se o professor fechar o painel.",
      "Conversa de outro professor ou de outra escola: **404** JSON, antes do stream.",
    ],
  })
  async enviar(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Autenticado,
    @Res() res: RespostaSse,
  ): Promise<void> {
    const quem = this.quem(req);
    const conversaId = this.id(id);
    const corpo = EnviarMensagemSchema.safeParse(body);
    if (!corpo.success) {
      throw new BadRequestException({
        codigo: "corpo-invalido",
        mensagem: `Escreva uma mensagem de 1 a ${TAMANHO_MAXIMO_DA_MENSAGEM} caracteres.`,
      });
    }

    /* TUDO o que pode recusar vem ANTES de abrir o stream, e responde JSON: com
       o `text/event-stream` aberto o status já foi 200, e o hub teria de ler o
       corpo para saber que foi recusado. */
    const conversa = await this.service.daPosse(quem, conversaId);
    limitar(`agente-professor:mensagem:${quem.usuarioId}`, LIMITE_DE_MENSAGENS_POR_MINUTO, 60_000);
    if (!(await this.service.temSaldo(quem))) throw erroJson("QUOTA", 429);

    await this.service.transmitir(quem, conversa, corpo.data.texto, res);
  }

  /* Fora do interruptor: apagar os próprios dados nunca fica preso ao produto
     desligado (ADR-87). O único escape desta classe. */
  @SemDisponibilidade()
  @Delete("conversas/:id")
  @HttpCode(204)
  @Contrato({
    resumo: "Apaga a conversa: a sessão no agente e a linha da posse.",
    descricao:
      "Escapa do interruptor (`@SemDisponibilidade`): com o produto desligado, o professor continua podendo apagar o que é dele. Sessão que já não existe no agente não é erro.",
    params: IdParamsSchema,
    resposta: ApagadaSchema,
    notas: [
      "Agente fora do ar: **503** e a linha FICA — apagar só a linha deixaria a conversa guardada no agente sem ninguém capaz de alcançá-la.",
      "Conversa de outro professor ou de outra escola: **404**.",
    ],
  })
  async apagar(@Param("id") id: string, @Req() req: Autenticado): Promise<void> {
    const quem = this.quem(req);
    limitar(`agente-professor:apagar:${quem.usuarioId}`, 30, 60_000);
    await this.service.apagar(quem, this.id(id));
  }
}

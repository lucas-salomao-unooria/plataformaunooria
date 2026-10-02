import { Body, Controller, Get, Headers, HttpCode, HttpException, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";
import { rateLimit } from "../comum/rate-limit";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { AjudaService, type RespostaDoStream } from "./ajuda.service";
import { CorpoDoChatSchema, ListaDeModelosSchema, MODELO_ANUNCIADO, RespostaDoChatSchema } from "./contrato-de-rotas";
import { extrairTokenDaSessao } from "./regras";
import { verificarTokenDaSessao } from "./token-da-sessao";

/**
 * O LLM DA AJUDA, lado do VENDOR (ADR-132) — o endpoint OpenAI-compatível que o
 * LiveAvatar chama a cada fala da pessoa (voz transcrita ou texto do chat).
 *
 * INTEGRAÇÃO EXTERNA: fora de `OidcGuard`/`RolesGuard`, de propósito — quem
 * chama é o servidor do vendor, não uma pessoa logada. DUAS trancas, e as duas
 * são necessárias:
 *   1. `Authorization: Bearer <AJUDA_LLM_SEGREDO>` — prova que é o vendor (o
 *      segredo mora lá como `OPENAI_API_KEY` da nossa configuração de LLM);
 *   2. o TOKEN DA SESSÃO dentro da mensagem `system` — prova QUEM está falando
 *      e que a sessão é uma que esta api abriu e ainda não fechou.
 * Só o segredo deixaria qualquer um com ele conversar em nome de ninguém; só o
 * token deixaria qualquer um com um token vazado usar o modelo direto.
 *
 * O que foi MEDIDO no spike e decide o desenho (ver `ajuda/AGENTS.md`): o vendor
 * pede `stream: true` com 10 s de paciência para o primeiro byte, e fica MUDO
 * diante de status de erro. Por isso, aceita a chamada, toda recusa de negócio
 * (produto desligado, excesso) vira FALA — e só a autenticação responde 401.
 */
@Controller("ajuda/llm")
export class AjudaLlmController {
  constructor(
    private readonly service: AjudaService,
    private readonly config: ConfigService,
  ) {}

  /** As duas chaves andam juntas: sem qualquer uma, a rota está DESLIGADA (503), nunca aberta. */
  private chaves(): { segredo: string; chaveDaSessao: string } {
    const segredo = this.config.get<string>("AJUDA_LLM_SEGREDO");
    const chaveDaSessao = this.config.get<string>("AJUDA_SESSAO_CHAVE");
    if (!segredo || !chaveDaSessao) throw new HttpException({ error: { message: "Ajuda desligada nesta stack." } }, 503);
    return { segredo, chaveDaSessao };
  }

  /** Comparação em tempo constante (o padrão da porta do `/docs`): `!==` vazaria o segredo pelo tempo. */
  private exigirSegredo(cabecalho: string | undefined, segredo: string): void {
    const recebido = (cabecalho ?? "").replace(/^Bearer\s+/i, "");
    const a = createHash("sha256").update(recebido).digest();
    const b = createHash("sha256").update(segredo).digest();
    if (!recebido || !timingSafeEqual(a, b)) {
      throw new HttpException({ error: { message: "Credencial inválida." } }, 401);
    }
  }

  @Get("models")
  @Contrato({
    resumo: "Lista o modelo da Ajuda, no formato OpenAI (o vendor consulta ao abrir a sessão).",
    descricao:
      "O vendor faz `GET {base_url}/models` ao abrir a sala (medido no spike). Responde um modelo só, `unooria-ajuda`; o modelo de verdade é o da api (`VERTEX_MODEL`) e não é anunciado.",
    resposta: ListaDeModelosSchema,
    acesso: "servico",
    notas: ["Exige `Authorization: Bearer <AJUDA_LLM_SEGREDO>`; sem a env, **503**."],
  })
  modelos(@Headers("authorization") autorizacao: string | undefined) {
    const { segredo } = this.chaves();
    this.exigirSegredo(autorizacao, segredo);
    return { object: "list" as const, data: [{ id: MODELO_ANUNCIADO, object: "model" as const, owned_by: "unooria" }] };
  }

  @Post("chat/completions")
  @HttpCode(200)
  @Contrato({
    resumo: "Um turno do atendente da Ajuda, no formato `chat/completions` do OpenAI.",
    descricao:
      "Chamado pelo vendor do avatar a cada fala da pessoa. A mensagem `system` que ele manda é DESCARTADA — só o token da sessão é lido dela (`[sessao:<token>]`); o prompt de verdade e a base de conhecimento moram na api. O histórico `user`/`assistant` vai ao `AiProvider` e a resposta volta em `chat.completion.chunk` (SSE) — ou num `chat.completion` inteiro quando `stream` é falso.",
    corpo: CorpoDoChatSchema,
    resposta: RespostaDoChatSchema,
    tipoDaResposta: "text/event-stream",
    acesso: "servico",
    notas: [
      "**401** sem o segredo certo em `Authorization`, ou sem token de sessão válido (vencido, adulterado, de sessão já encerrada). Sem `AJUDA_LLM_SEGREDO`/`AJUDA_SESSAO_CHAVE`, **503**.",
      "Recusa de NEGÓCIO não é status: produto `ajuda` desligado para a escola, ou mais de 20 turnos por minuto, viram uma FALA do atendente — o vendor fica mudo diante de erro.",
      "**Fora da quota de tokens** (exceção à regra 5, ADR-132): o custo da Ajuda é limitado pelos minutos de `ajuda_limites`. Os tokens continuam medidos pelo `MedidorDeProvider`.",
      "Falha do modelo vira a fala de desculpa (`FALA_DE_FALHA`), em 200. A pergunta e a resposta não vão ao log.",
    ],
  })
  async conversar(
    @Headers("authorization") autorizacao: string | undefined,
    @Body() body: unknown,
    @Res() res: RespostaDoStream,
  ): Promise<void> {
    const { segredo, chaveDaSessao } = this.chaves();
    this.exigirSegredo(autorizacao, segredo);

    const corpo = CorpoDoChatSchema.safeParse(body);
    if (!corpo.success) throw new HttpException({ error: { message: "Corpo inválido." } }, 400);

    const system = corpo.data.messages.find((m) => m.role === "system");
    const token = typeof system?.content === "string" ? extrairTokenDaSessao(system.content) : null;
    const claims = token ? await verificarTokenDaSessao(token, chaveDaSessao) : null;
    if (!claims || !(await this.service.sessaoValida(claims))) {
      logger.warn({ codigo: "ajuda.llm-sem-sessao", comToken: Boolean(token) }, "chamada ao LLM da Ajuda sem sessão válida");
      throw new HttpException({ error: { message: "Sessão inválida." } }, 401);
    }

    const emFluxo = corpo.data.stream !== false;
    const comUso = corpo.data.stream_options?.include_usage === true;
    const mensagens = corpo.data.messages.filter((m) => m.role !== "system");

    let fala: string | undefined;
    if (!(await this.service.produtoLigado(claims))) {
      fala = "A Ajuda foi desligada para a sua rede. Para dúvidas, procure a coordenação da sua escola.";
    } else if (!rateLimit(`ajuda:llm:${claims.sub}`, 20, 60_000).ok) {
      fala = "Vamos com calma: espere alguns segundos e me pergunte de novo.";
    }

    await this.service.responder({ claims, mensagens, emFluxo, comUso, fala }, res);
  }
}

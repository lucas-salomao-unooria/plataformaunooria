import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { DisponibilidadeGuard, Produto, SemDisponibilidade } from "../comum/disponibilidade.guard";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { AjudaService, type Quem } from "./ajuda.service";
import {
  AbrirSessaoSchema,
  ConfiguracaoDaJanelaSchema,
  EncerradaSchema,
  erroDaAjuda,
  SessaoAbertaSchema,
  SessaoIdSchema,
} from "./contrato-de-rotas";
import { atendenteEfetivo, PERFIS_DA_AJUDA } from "./regras";

/**
 * A AJUDA, lado do HUB (ADR-132, ADR-158): saber quem atende, abrir e encerrar
 * a sessão. Dois atendentes — o mascote (Gemini Live, pela conexão de voz do
 * `MascoteAoVivo`) e o avatar em vídeo (LiveAvatar); o `admin` escolhe o padrão.
 *
 * Todos os papéis MENOS o estudante (decisão do dono do produto). O
 * interruptor da rede é por PRODUTO, na CLASSE — rota nova nasce coberta; o
 * único escape é encerrar (`@SemDisponibilidade`), porque desligar o produto
 * no meio de uma conversa não pode deixar a sala do vendor aberta e cobrando.
 *
 * A conversa em si NÃO passa por aqui: o vendor fala direto com o
 * `AjudaLlmController`.
 */

type Autenticado = { auth: AuthClaims };

@Controller("ajuda")
@UseGuards(OidcGuard, RolesGuard, DisponibilidadeGuard)
@Roles(...PERFIS_DA_AJUDA)
@Produto("ajuda")
export class AjudaController {
  constructor(private readonly service: AjudaService) {}

  private quem(req: Autenticado): Quem {
    const { usuarioId, escolaId, perfil } = req.auth;
    /* O `@Roles` já barrou o estudante; o narrow aqui é o que o tipo pede. */
    const lido = z.enum(PERFIS_DA_AJUDA).safeParse(perfil);
    if (!lido.success) throw new NotFoundException();
    return { usuarioId, escolaId, perfil: lido.data };
  }

  @Get("configuracao")
  @Contrato({
    resumo: "Quem atende na Ajuda desta rede, e se a pessoa pode trocar.",
    descricao:
      "Lê `ajuda_configuracao` (o padrão que o `admin` escolheu) e o que está montado nesta stack: se o padrão não está, abre o outro. Nada aqui é segredo — os ajustes do mascote chegam na abertura da sessão.",
    resposta: ConfiguracaoDaJanelaSchema,
  })
  async configuracao() {
    const config = await this.service.configuracao();
    const disponiveis = this.service.disponiveis();
    const atendente = atendenteEfetivo(config, disponiveis);
    const outro = atendente === "mascote" ? "avatar" : "mascote";
    return {
      atendente,
      podeTrocar: Boolean(atendente && config.permitirTroca && disponiveis[outro]),
      modeloDoMascote: this.service.urlDoModeloDoMascote(),
    };
  }

  @Post("sessoes")
  @HttpCode(201)
  @Contrato({
    resumo: "Abre a Ajuda: reserva os minutos e prepara o atendente (mascote ou avatar).",
    descricao:
      "Confere os minutos de hoje (`ajuda_limites` × `ajuda_sessoes`, os mesmos para os dois atendentes), fecha a sessão anterior da pessoa que tenha ficado aberta e reserva a linha. **Avatar**: pede ao vendor uma sala com o teto calculado e devolve o token que o SDK usa no navegador; a conversa vai por `POST /ajuda/llm/chat/completions`. **Mascote**: devolve um bilhete (2 min, uma entrada) para a conexão de voz `WS /ajuda/mascote/ao-vivo` e os ajustes da boca. O corpo `{ atendente }` vale só se o `admin` permitiu a troca.",
    corpo: AbrirSessaoSchema,
    resposta: SessaoAbertaSchema,
    notas: [
      "**503** `{ codigo: \"AJUDA_INDISPONIVEL\" }` quando a stack não tem nenhum dos dois atendentes montado (o avatar pede `LIVEAVATAR_*` e `AJUDA_*`; o mascote, a Vertex e `AJUDA_SESSAO_CHAVE`).",
      "**429** `{ codigo: \"SEM_MINUTOS\", minutosPorDia }` quando o que sobra do dia é menos de 1 minuto. **429** `{ codigo: \"RATE_LIMIT\" }` acima de 6 aberturas por minuto.",
      "**502** `{ codigo: \"AVATAR_FALHOU\" }` quando o vendor não abre a sala — a linha reservada fecha com duração zero e não conta minuto.",
      "**403** `{ codigo: \"recurso-indisponivel\" }` com o produto `ajuda` desligado para a escola.",
      "O dia é o do fuso da plataforma (ADR-99). Sessão sem `fim` conta o teto inteiro.",
    ],
  })
  async abrir(@Req() req: Autenticado, @Body() body: unknown) {
    const quem = this.quem(req);
    const corpo = AbrirSessaoSchema.safeParse(body ?? {});
    if (!corpo.success) throw new BadRequestException({ mensagem: "Pedido inválido." });
    const limite = rateLimit(`ajuda:abrir:${quem.usuarioId}`, 6, 60_000);
    if (!limite.ok) throw erroDaAjuda("RATE_LIMIT", 429, { retryAfterSeconds: limite.retryAfterSeconds });
    return this.service.abrirSessao(quem, corpo.data.atendente);
  }

  /* Fora do interruptor: fechar a sala nunca fica preso ao produto desligado. */
  @SemDisponibilidade()
  @Post("sessoes/:id/encerrar")
  @HttpCode(204)
  @Contrato({
    resumo: "Encerra a sessão de vídeo da Ajuda.",
    descricao:
      "Grava o fim da sessão (é o tempo real que passa a contar no dia) e pede ao vendor que feche a sala. Idempotente: sessão já encerrada, inexistente ou de outra pessoa responde 204 do mesmo jeito.",
    params: z.object({ id: SessaoIdSchema }),
    resposta: EncerradaSchema,
    notas: ["Escapa do interruptor (`@SemDisponibilidade`): desligar o produto não pode deixar a sala cobrando."],
  })
  async encerrar(@Param("id") id: string, @Req() req: Autenticado): Promise<void> {
    const quem = this.quem(req);
    const lido = SessaoIdSchema.safeParse(id);
    if (!lido.success) return;
    const limite = rateLimit(`ajuda:encerrar:${quem.usuarioId}`, 30, 60_000);
    if (!limite.ok) throw erroDaAjuda("RATE_LIMIT", 429, { retryAfterSeconds: limite.retryAfterSeconds });
    await this.service.encerrar(quem, lido.data);
  }
}

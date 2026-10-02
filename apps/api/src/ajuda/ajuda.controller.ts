import { Controller, HttpCode, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { DisponibilidadeGuard, Produto, SemDisponibilidade } from "../comum/disponibilidade.guard";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { AjudaService, type Quem } from "./ajuda.service";
import { EncerradaSchema, erroDaAjuda, SessaoAbertaSchema, SessaoIdSchema } from "./contrato-de-rotas";
import { PERFIS_DA_AJUDA } from "./regras";

/**
 * A AJUDA COM AVATAR, lado do HUB (ADR-132): abrir e encerrar a sessão de vídeo.
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

  @Post("sessoes")
  @HttpCode(201)
  @Contrato({
    resumo: "Abre a Ajuda: reserva os minutos e pede a sala de vídeo do atendente.",
    descricao:
      "Confere os minutos de hoje (`ajuda_limites` × `ajuda_sessoes`), fecha a sessão anterior da pessoa que tenha ficado aberta, e pede ao vendor do avatar uma sessão com o teto calculado. Devolve o token que o SDK do vendor usa NO NAVEGADOR — a chave da conta nunca sai da api. A conversa não passa por esta rota: o vendor chama `POST /ajuda/llm/chat/completions`.",
    resposta: SessaoAbertaSchema,
    notas: [
      "**503** `{ codigo: \"AJUDA_INDISPONIVEL\" }` quando a stack não tem o vendor configurado (as envs `LIVEAVATAR_*` e `AJUDA_*`).",
      "**429** `{ codigo: \"SEM_MINUTOS\", minutosPorDia }` quando o que sobra do dia é menos de 1 minuto. **429** `{ codigo: \"RATE_LIMIT\" }` acima de 6 aberturas por minuto.",
      "**502** `{ codigo: \"AVATAR_FALHOU\" }` quando o vendor não abre a sala — a linha reservada fecha com duração zero e não conta minuto.",
      "**403** `{ codigo: \"recurso-indisponivel\" }` com o produto `ajuda` desligado para a escola.",
      "O dia é o do fuso da plataforma (ADR-99). Sessão sem `fim` conta o teto inteiro.",
    ],
  })
  async abrir(@Req() req: Autenticado) {
    const quem = this.quem(req);
    const limite = rateLimit(`ajuda:abrir:${quem.usuarioId}`, 6, 60_000);
    if (!limite.ok) throw erroDaAjuda("RATE_LIMIT", 429, { retryAfterSeconds: limite.retryAfterSeconds });
    return this.service.abrirSessao(quem);
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

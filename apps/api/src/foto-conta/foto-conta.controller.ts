import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  FeedBodySchema,
  GaleriaSchema,
  LatchSchema,
  MarcaBodySchema,
  PublicacaoSchema,
  PublicarBodySchema,
  ReflexaoBodySchema,
  ReflexaoRespostaSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDaMissao } from "./erros";
import { FotoContaService } from "./foto-conta.service";

/**
 * Rotas do ESTUDANTE da exp01ef1b.
 *
 * O leitor tem 6 anos: nenhum erro daqui fala de token, sessão ou requisição —
 * a voz é a de Nina (`erros.ts`). Identidade e TURMA saem sempre do token,
 * nunca do body. A matriz causal do Aha e o gabarito da reflexão ficam no
 * servidor (regra inviolável nº 3): o cliente manda a escolha e recebe só a
 * consequência dela.
 */

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`foto-conta:${usuarioId}`, limite, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
  }
}

function valida<T>(schema: z.ZodType<T>, corpo: unknown): T {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDaMissao("payload-invalido");
  return parsed.data;
}

@Controller("foto-conta")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class FotoContaController {
  constructor(private readonly fotoConta: FotoContaService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O boot da missão: estado da run + o pacote da aula, sem a matriz do Aha.",
    descricao:
      "O `pacote` sai **sem `comentarios`** — o tipo do servidor é um `omit` do schema completo, então a surpresa do Aha é impossível de vazar aqui, não só ausente por descuido. Os comentários chegam um par por vez, na resposta de `POST /foto-conta/publicar`.\n\nA run da tentativa corrente é criada no primeiro toque; um F5 devolve exatamente o estado gravado (reentrada determinística, bloco 4 do handoff).",
    resposta: SessaoSchema,
    notas: [
      "Estudante sem turma responde 409 `sem-turma`: a missão é síncrona por turma e não há aula para entrar. Quem explica a resolução é a tela do HUB, fora do disfarce.",
      "`latchLiberado` já vem no boot para o F5 no meio da roda renderizar direto a tela de espera — ou de reflexão, se o professor liberou durante a queda.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.fotoConta.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("marca")
  @HttpCode(200)
  @Contrato({
    resumo: "Etapa 1: grava a marca escolhida e abre o mural.",
    corpo: MarcaBodySchema,
    resposta: SessaoSchema.pick({ etapa: true, marcaId: true }),
    notas: ["Seleção unária: a marca nova substitui a anterior só ANTES de confirmar — depois de entrar no mural ela é a identidade da ficção e não muda mais."],
  })
  async marca(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { marcaId } = valida(MarcaBodySchema, body);
    const run = await this.fotoConta.marcar(req.auth.escolaId, req.auth.usuarioId, marcaId);
    return { etapa: run.etapa, marcaId: run.marcaId };
  }

  @Post("feed")
  @HttpCode(200)
  @Contrato({
    resumo: "Etapa 2: registra a exploração do feed e abre a decisão.",
    descricao:
      "Curtidas e permanência são grau `none` (cosmético/motor): familiarização com o clone, sem peso avaliativo — o dashboard mostra a média da turma e nada mais.",
    corpo: FeedBodySchema,
    resposta: SessaoSchema.pick({ etapa: true }),
  })
  async feed(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const dados = valida(FeedBodySchema, body);
    const run = await this.fotoConta.sairDoFeed(req.auth.escolaId, req.auth.usuarioId, dados);
    return { etapa: run.etapa };
  }

  @Post("publicar")
  @HttpCode(200)
  @Contrato({
    resumo: "Etapa 3 (o PICO): publica o par foto+legenda e devolve o eco dos colegas.",
    descricao:
      "A escolha é validada CONTRA O PACOTE da turma (id fora do pacote é payload forjado, não clique) e os comentários voltam **deterministicamente** — o mesmo par devolve sempre o mesmo Leo e a mesma Sofia, e um F5 não muda a cena (não-negociável 1 do handoff).\n\nRepetir a chamada com o MESMO par devolve a publicação existente (toque duplo e retry de rede não criam segundo post); par DIFERENTE responde `409 publicacao-ja-feita` — publicar é irreversível por desenho.",
    corpo: PublicarBodySchema,
    resposta: PublicacaoSchema,
    notas: [
      "`latenciaMs` é cronometrada pelo CLIENTE: o dado é o tempo de decisão da criança, não a latência da api. Teto de 2h (aba esquecida).",
      "A cadência do eco (Leo a 1,5s, Sofia a 3,0s) é do CLIENTE, fixada em constante — o servidor entrega os textos de uma vez.",
    ],
  })
  publicar(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const corpo = valida(PublicarBodySchema, body);
    return this.fotoConta.publicar(req.auth.escolaId, req.auth.usuarioId, corpo);
  }

  @Post("roda")
  @HttpCode(200)
  @Contrato({
    resumo: "Etapa 4 → 5: o eco terminou; a run entra no latch da Roda de Conversa.",
    resposta: SessaoSchema.pick({ etapa: true }),
    notas: [
      "Daqui em diante o tablet é porta-retrato: a tela não tem botão nenhum e quem anda é o professor, liberando a turma inteira pelo painel.",
    ],
  })
  async roda(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const run = await this.fotoConta.chegarNaRoda(req.auth.escolaId, req.auth.usuarioId);
    return { etapa: run.etapa };
  }

  @Get("latch")
  @Contrato({
    resumo: "O polling do latch (3s): a turma já foi liberada? (ADR-94)",
    descricao:
      "Leve de propósito, como o gate do o-eco-no-grupo: sem pacote e sem catálogo — é o que deixa 35 tablets perguntarem a cada 3 segundos sem pesar. `agora` é o instante do SERVIDOR: o relógio do tablet da escola atrasa, e não é ele que decide o momento da aula.",
    resposta: LatchSchema,
    notas: [
      "Polling HTTP curto, e não WebSocket/SSE: decisão da ADR-94 — não existe canal persistente de aplicação nesta infraestrutura, e o teto de 4s de reação docente da banca é atendido com folga.",
    ],
  })
  latch(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.fotoConta.latch(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("reflexao")
  @HttpCode(200)
  @Contrato({
    resumo: "Etapa 6: a síntese metacognitiva — o servidor decide, sem nota.",
    descricao:
      "O cliente manda `lupa` ou `globo` e NUNCA sabe de antemão qual conclui (regra 3): `conclui: true` celebra e congela a run; `false` é o retry formativo — o card pisca sem vermelho punitivo, Nina acolhe e a criança escolhe de novo, sem teto de tentativas e sem penalidade.",
    corpo: ReflexaoBodySchema,
    resposta: ReflexaoRespostaSchema,
    notas: [
      "Exige o latch liberado (`409 roda-em-andamento` antes disso): responder antes da Roda quebraria a mediação presencial que a missão existe para provocar.",
    ],
  })
  reflexao(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { escolha } = valida(ReflexaoBodySchema, body);
    return this.fotoConta.refletir(req.auth.escolaId, req.auth.usuarioId, escolha);
  }

  @Get("galeria")
  @Contrato({
    resumo: "O mural da turma (pós-publicação): as fotos dos colegas, chegando.",
    descricao:
      "Estritamente passiva (irreversibilidade pós-missão do handoff): sem curtir, sem editar, sem republicar. Quem assina cada post é a MARCA (coruja/estrela/sol) — nome de criança não existe nesta resposta.",
    resposta: GaleriaSchema,
    notas: ["O cliente atualiza por polling lento (~10s); a galeria é vitrine, não canal."],
  })
  galeria(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.fotoConta.galeria(req.auth.escolaId, req.auth.usuarioId);
  }
}

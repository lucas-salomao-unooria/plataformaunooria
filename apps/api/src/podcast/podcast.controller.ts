import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { professorDoToken } from "../comum/turmas-do-professor";
import { ehUuid } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import {
  FalasEscritasSchema,
  ParamsDoPodcastSchema,
  PedidoDasFalasSchema,
  PodcastSchema,
  ProgressoDoPodcastSchema,
  QueryDoPodcastSchema,
} from "./contrato-de-rotas";
import { erroDoPodcast } from "./erros";
import { EscritaDasFalasService } from "./escrita.service";
import { PodcastService } from "./podcast.service";

/**
 * O PODCAST DE RECAPITULAÇÃO de toda missão (ADR-150) — rotas únicas, e a
 * missão entra pelo `:expId`. É do PROFESSOR (decisão do dono do produto,
 * 2026-09-26): nenhuma rota de estudante.
 *
 * A guarda de turma é da MISSÃO (`FonteDoPodcast.atividade` e
 * `escrita.exigirTurma`): turma que o professor não leciona é 404, nunca 403,
 * pelo mesmo carregador que a missão já usa para as imagens. O gestor alcança
 * as mesmas rotas, como alcança a aula e a homologação.
 */

type Autenticado = { auth: AuthClaims };

/** Turma e atividade inválidas são 404 — como a de outra escola. */
function idOu404(id: string | undefined): string | undefined {
  if (id === undefined || id === "") return undefined;
  if (!ehUuid(id)) throw erroDoPodcast("experiencia-sem-podcast");
  return id;
}

/** As rotas que gastam IA do professor têm um teto a mais: o de requisição. */
function limitar(usuarioId: string, rota: string, teto: number) {
  if (!rateLimit(`podcast:${rota}:${usuarioId}`, teto, 60_000).ok) throw erroDoPodcast("muitas-tentativas");
}

const NOTA_DA_ATIVIDADE =
  "`?atividadeId=` diz a atividade (ADR-130); sem ele, a em andamento. Os erros da atividade são os da missão: turma que o professor não leciona e atividade de outra turma são **404**; sem atividade em andamento, **403** `atividade-nao-preparada`.";

@Controller("podcast")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class PodcastController {
  constructor(
    private readonly podcast: PodcastService,
    private readonly escrita: EscritaDasFalasService,
  ) {}

  @Get(":expId/turmas/:turmaId")
  @Contrato({
    resumo: "O podcast de recapitulação de uma atividade: o roteiro e o estado do áudio.",
    descricao:
      "O podcast é do PROFESSOR, para tocar à turma depois da aula se quiser. `roteiro` é o texto inteiro (a transcrição, que fica na tela junto do player): os blocos do sheet aprovado da missão, com as falas do tema que o professor aprovou na customização — ou as do sheet, quando a atividade é o banco padrão. `url` é o episódio, quando todos os trechos já foram sintetizados e emendados; `null` enquanto não.\n\n**Não gera nada** — é o `POST gerar`.",
    params: ParamsDoPodcastSchema,
    query: QueryDoPodcastSchema,
    resposta: PodcastSchema,
    notas: [
      NOTA_DA_ATIVIDADE,
      "Missão sem podcast: **404** `experiencia-sem-podcast`. Atividade com tema próprio criada antes do podcast (sem falas aprovadas): **409** `roteiro-indisponivel`.",
    ],
  })
  estado(
    @Param("expId") expId: string,
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("atividadeId") atividadeId: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.podcast.estado(
      expId,
      escolaAlvo(req.auth, escolaIdPedida),
      idOu404(turmaId) as string,
      professorDoToken(req.auth),
      idOu404(atividadeId),
    );
  }

  @Post(":expId/turmas/:turmaId/gerar")
  @HttpCode(200)
  @Contrato({
    resumo: "Sintetiza o próximo trecho do podcast e, com todos prontos, emenda o episódio — incremental.",
    descricao:
      "O episódio não cabe numa chamada: cada uma sintetiza UM trecho (um bloco do roteiro, numa chamada de diálogo do TTS do Gemini pelo provider da api, `generateSpeech`) e, quando todos existem, emenda o episódio num MP3 só. **Repita enquanto `completo` for `false` e a chamada anterior tiver gerado um trecho** — `falhou` diz qual bloco não saiu, e a transcrição continua na tela.\n\nIdempotente: o trecho que já está no bucket é pulado. O nome de cada trecho é o hash do texto e do pedido de voz, então os blocos fixos saem UMA vez por contrato e só os blocos com fala do tema custam síntese nova.",
    params: ParamsDoPodcastSchema,
    query: QueryDoPodcastSchema,
    resposta: ProgressoDoPodcastSchema,
    notas: [
      NOTA_DA_ATIVIDADE,
      "Quota do professor, com custo ESTIMADO por trecho (a síntese é cobrada por caractere e não devolve contagem). Sem saldo responde **429** `sem-saldo-de-ia`.",
      "Duas chamadas simultâneas para o mesmo episódio recebem o mesmo trabalho (lock de processo).",
    ],
  })
  gerar(
    @Param("expId") expId: string,
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("atividadeId") atividadeId: string | undefined,
    @Req() req: Autenticado,
  ) {
    limitar(req.auth.usuarioId, "gerar", 20);
    return this.podcast.gerar(
      expId,
      escolaAlvo(req.auth, escolaIdPedida),
      idOu404(turmaId) as string,
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      idOu404(atividadeId),
    );
  }

  @Post(":expId/turmas/:turmaId/falas-do-tema")
  @HttpCode(200)
  @Contrato({
    resumo: "Escreve as falas do podcast que contam o tema da atividade — rascunho para o professor revisar na customização.",
    descricao:
      "Chamada pela tela de criação da atividade, com o conteúdo como ela o tem (o rascunho, ainda não gravado). As falas voltam para o professor revisar e editar; quem as grava é a homologação da missão, com elas no corpo.\n\nO banco padrão intocado devolve as falas do sheet aprovado, sem IA. Sem saldo ou com a IA fora do ar, a resposta é 200 com as falas do sheet e o `motivo`: o professor sempre tem texto para revisar, e a tela avisa que ele conta o banco padrão.",
    params: ParamsDoPodcastSchema,
    query: QueryDoPodcastSchema,
    corpo: PedidoDasFalasSchema,
    resposta: FalasEscritasSchema,
    notas: [
      "`conteudo` tem a forma da missão (as notícias do Jornal, as mensagens de Quem Mandou Isso?); fora dela, **400** `payload-invalido`.",
      "Cada fala tem de 12 a 60 palavras, até 400 bytes, sem link, e-mail nem @ — a mesma régua da homologação. A IA que fere a régua é regerada uma vez com o motivo.",
      "Quota do professor (ADR-105), debitada pelo que o vendor cobrou, inclusive nas tentativas recusadas (ADR-74).",
    ],
  })
  falasDoTema(
    @Param("expId") expId: string,
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const pedido = PedidoDasFalasSchema.safeParse(corpo);
    if (!pedido.success) throw erroDoPodcast("payload-invalido");
    limitar(req.auth.usuarioId, "falas-do-tema", 10);
    return this.escrita.escrever(
      expId,
      escolaAlvo(req.auth, escolaIdPedida),
      idOu404(turmaId) as string,
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      pedido.data.conteudo,
    );
  }
}

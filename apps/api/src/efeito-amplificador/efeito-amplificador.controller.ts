import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AcaoNoFeedSchema,
  EstadoSchema,
  GateDoEstudanteSchema,
  IndicadorSchema,
  MensagemSchema,
  ParagrafoSchema,
  PublicarSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { EfeitoAmplificadorService } from "./efeito-amplificador.service";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp02em1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo);
  if (!r.success) throw erroDeJogo("payload-invalido");
  return r.data as z.output<S>;
}

const NOTA_DA_PORTA =
  "A porta da sala (ADR-69) e a disponibilidade (ADR-87) valem aqui: turma sem a missão liberada responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`).";
const NOTA_SEM_PACOTE = "Sem pacote no ar responde **409** `campanha-em-preparo` — espera, não bloqueio.";
const NOTA_DA_PAUSA = "Com as telas pausadas pelo professor: **409** `telas-pausadas`.";

/**
 * Rotas do ESTUDANTE da exp02em1b — O Efeito Amplificador (ADR-180).
 *
 * O gabarito fica no servidor: o cliente manda o que o estudante escreveu,
 * tirou, escolheu ou tocou, e é o servidor que decide o que aquilo mediu
 * (regra 3). A identidade — inclusive a TURMA — sai do token e do banco.
 * A guarda de liberação está no FUNIL do service, não aqui.
 */
@Controller("efeito-amplificador")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class EfeitoAmplificadorController {
  constructor(private readonly missao: EfeitoAmplificadorService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão, a fala de abertura do UnooriaAI e os textos fixos.",
    descricao:
      "`passo` é DERIVADO no servidor: `abertura → conversa → feed → explicar → concluida`. `conversa` cobre o chat, a prévia e a escolha da manchete; o Publicar é o latch.\n\n`pausada` é a camada do \"Pausar Telas para Debate\": a tela mostra a espera na voz da ficção. O comentário do feed desce SEM a categoria de saúde, o indicador sem o gabarito.",
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Sem pacote no ar: `preparada: false` e a tela é de espera."],
  })
  sessao(@Req() req: Autenticado) {
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Get("gate")
  @Contrato({
    resumo: "A fase da turma e o passo do estudante (polling de 3 s).",
    descricao: "**Polling HTTP, nunca WebSocket** (ADR-93). `agora` é o instante do SERVIDOR.",
    resposta: GateDoEstudanteSchema,
    notas: [NOTA_DA_PORTA],
  })
  gate(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("entrar")
  @HttpCode(200)
  @Contrato({ resumo: '"Iniciar Campanha": abre a sessão desta rodada. Idempotente.', resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE] })
  entrar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.entrar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("mensagem")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma mensagem ao UnooriaAI (até 5).",
    descricao:
      "A intenção é classificada no servidor por uma lista fechada de gatilhos (sem acento, sem caixa, sem pontuação) — a conversa é determinística, sem modelo de linguagem na aula. O pedido da fonte, da correção do dado, do crédito e da anonimização muda a prévia; é o que a EM13CO14 e a EM13CO26 medem no Publicar.\n\nO texto do estudante é texto livre de menor: fica na sessão para o F5 e não vai a painel, telemetria nem log.",
    corpo: MensagemSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DA_PAUSA, "Depois da 5ª: **409** `limite-do-chat`. Depois do Publicar: **409** `ja-publicado`."],
  })
  mensagem(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 30);
    const { texto } = valida(MensagemSchema, corpo);
    return this.missao.mensagem(req.auth.escolaId, req.auth.usuarioId, texto);
  }

  @Post("paragrafo")
  @HttpCode(200)
  @Contrato({
    resumo: "Tira ou devolve um parágrafo da prévia.",
    descricao: "Tirar o parágrafo de um nó crítico também o RESOLVE para a régua (o dado sai do post, ou o colega sai do post).",
    corpo: ParagrafoSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, "Antes de o UnooriaAI gerar o rascunho: **409** `rascunho-nao-gerado`."],
  })
  paragrafo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { paragrafoId, removido } = valida(ParagrafoSchema, corpo);
    return this.missao.paragrafo(req.auth.escolaId, req.auth.usuarioId, paragrafoId, removido);
  }

  @Post("publicar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Publicar no Unoovista" — o latch.',
    descricao:
      "Irreversível. Na MESMA transação, as marcas da **EM13CO14** (perguntou a fonte × tirou o dado) e da **EM13CO26** (o crédito × o colega fora do post). O algoritmo pinça o trecho do banner aqui: a estatística, se ficou; senão o recorte do pacote; senão a manchete — sempre há um.",
    corpo: PublicarSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, "A mesma manchete de novo é idempotente; outra é **409** `ja-publicado`."],
  })
  publicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { manchete } = valida(PublicarSchema, corpo);
    return this.missao.publicar(req.auth.escolaId, req.auth.usuarioId, manchete);
  }

  @Post("feed")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma ação no feed da madrugada (Etapa 4).",
    descricao:
      "`inspecionar` (abrir um comentário), `metricas`, `moderar` (`restringir` | `aviso` | `arquivar`), `privacidade`, `denunciar` e `ajuda`. Marca a **EM13CO24** e a **EM13CO08** com o que o feed já alcançou (vale a melhor). Arquivar exige as métricas abertas.",
    corpo: AcaoNoFeedSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, "Antes do Publicar: **409** `nao-publicado`. Depois de abrir o Explicar, o feed é histórico: **409**."],
  })
  feed(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.acaoNoFeed(req.auth.escolaId, req.auth.usuarioId, valida(AcaoNoFeedSchema, corpo));
  }

  @Post("explicar")
  @HttpCode(200)
  @Contrato({
    resumo: "Entra no Explicar (Etapa 5), depois de o professor liberar.",
    descricao: "Fecha o feed: o que o estudante não fez lá vira \"não atingiu\" na EM13CO24 e na EM13CO08, na mesma transação. Idempotente.",
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, "Antes de o professor liberar: **409** `explicar-nao-liberado`."],
  })
  explicar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.abrirExplicar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("indicador")
  @HttpCode(200)
  @Contrato({
    resumo: "Aponta um indicador na folha de bastidores.",
    descricao: "O gabarito é do servidor: o que comprova fica confirmado; o que não comprova acende `ultimoNaoComprova`. Não é evidência.",
    corpo: IndicadorSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA],
  })
  indicador(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { indicador } = valida(IndicadorSchema, corpo);
    return this.missao.apontarIndicador(req.auth.escolaId, req.auth.usuarioId, indicador);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Conclui a missão — exige os dois indicadores que comprovam.",
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, "Sem os dois: **409** `evidencias-incompletas`. Idempotente."],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId);
  }
}

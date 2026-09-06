import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AuditoriaRespostaSchema,
  AuditoriaSchema,
  DecisaoRespostaSchema,
  DecisaoSchema,
  EstadoSchema,
  GatePublicoSchema,
  ModelagemSchema,
  ReflexaoSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { RastroBoatoService } from "./rastro-boato.service";
import { PASSOS } from "./regras/passos";

/**
 * Rotas do ESTUDANTE da exp-06-rastro-boato.
 *
 * O gabarito fica no servidor: o cliente manda qual opção escolheu e qual ordem
 * montou, a api corrige contra o catálogo e devolve o desfecho, a reação do
 * grupo e a topologia da rede (regra inviolável nº 3). Identidade — inclusive a
 * TURMA, que liga o estudante ao gate da aula — sai sempre do token, nunca do
 * body.
 *
 * A guarda de liberação (ADR-69) está no FUNIL do service
 * (`estudanteDaEscola`), não aqui: rota nova nasce protegida sem ninguém
 * lembrar de protegê-la.
 */

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`rastro:${usuarioId}`, limite, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
  }
}

/**
 * `z.output<S>`, e não `z.ZodType<T>` como na exp-07: dois campos aqui têm
 * `.default()` (`tempoLeituraS`, `houveInacao90s`), e com a assinatura genérica
 * o TypeScript infere o tipo de ENTRADA — em que eles são opcionais — em vez do
 * de saída, onde o default já foi aplicado. O sintoma é um `undefined` que só
 * aparece na chamada do service.
 */
function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

@Controller("rastro-boato")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class RastroBoatoController {
  constructor(private readonly rastro: RastroBoatoService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão, as 4 conversas e os metadados de cada mensagem.",
    descricao:
      'As 3 opções de intervenção saem **sem `desfecho` e sem `reacao`**, e os 4 blocos do ciclo saem **sem a ordem certa** — os tipos do servidor são `Omit<...>`, então o gabarito é impossível de vazar aqui, não só ausente por descuido.\n\nO feed vem da api, e não do bundle, para que corrigir uma palavra da copy não exija republicar um caminho imutável no bucket.',
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o cru. Quando os dois divergem e `aguardandoATurma` é `true`, o estudante está preso no breakpoint esperando a Aula 2.",
      "`topologia` e `desfecho` são `null` até a intervenção ser enviada. Devolvê-los antes entregaria qual opção quebra a corrente.",
      "`metadados.saltos` é `null` numa mensagem escrita ali mesmo — ausência de encaminhamento não é zero encaminhamentos, e a tela mostra as duas coisas de formas diferentes.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.rastro.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está (polling de ~5s).",
    descricao:
      "Leve de propósito: sem catálogo. É o que deixa a docente conduzir 30 telas — a Aula 2 abre para todos ao mesmo tempo.\n\n`agora` é o instante do SERVIDOR: o relógio da máquina da escola atrasa, e não é ele que decide o momento da aula.",
    query: z.object({ passo: z.enum(PASSOS).optional() }),
    resposta: GatePublicoSchema,
    notas: [
      "Estudante sem turma não tem gate: a missão corre no ritmo dele. Prendê-lo no breakpoint seria um beco sem saída, porque não há quem dê a largada.",
    ],
  })
  gate(@Query("passo") passo: string | undefined, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.rastro.gate(req.auth.escolaId, turmaDo(req.auth), passo);
  }

  @Post("entrar")
  @HttpCode(200)
  @Contrato({
    resumo: 'Sai da tela de contexto e abre a lista de conversas.',
    descricao:
      "Idempotente. Existe como rota para o `passo` andar no SERVIDOR: um F5 na Etapa 2 não pode devolver a criança ao briefing de Tomás que ela já leu.",
    resposta: EstadoSchema,
  })
  entrar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.rastro.abrirChats(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("auditoria")
  @HttpCode(200)
  @Contrato({
    resumo: 'Registra a abertura do modal "Dados da mensagem".',
    descricao:
      "A cota de 3 é sobre mensagens **DISTINTAS**, e a dedupe é do servidor — um contador incrementado no cliente seria um número que o estudante controla. Reabrir o mesmo balão devolve 200 com `novo: false`: reler é o comportamento que a missão quer, e um 409 ali viraria a releitura em erro na tela.",
    corpo: AuditoriaSchema,
    resposta: AuditoriaRespostaSchema,
    notas: [
      "Quando a terceira mensagem distinta fecha a cota, o `passo` anda para `decisao` AQUI, no servidor. Deixar o cliente pedir a transição seria deixá-lo escolher quando o pico da missão começa.",
      "`tempoLeituraS` é calibragem de fluxo, não medida de mérito: ninguém é avaliado por ler rápido.",
    ],
  })
  auditoria(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { mensagemId, tempoLeituraS } = valida(AuditoriaSchema, corpo);
    return this.rastro.auditoria(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      mensagemId,
      tempoLeituraS,
    );
  }

  @Post("decisao")
  @HttpCode(200)
  @Contrato({
    resumo: "A intervenção no grupo — irrevogável (latch).",
    descricao:
      "O pico da missão. A api confere a cota de auditoria ANTES de aceitar (409 `auditoria-insuficiente`), corrige a escolha contra o catálogo e devolve o desfecho, a reação do grupo e a topologia da rede já calculada.\n\nSegunda chamada responde 409 `decisao-ja-registrada`: a escolha é definitiva, e é isso que faz o estudante assumir o peso dela antes de ver o mapa.",
    corpo: DecisaoSchema,
    resposta: DecisaoRespostaSchema,
    notas: [
      "`latenciaSeg` é cronometrado pelo CLIENTE — a latência da api não é o dado. O que se mede é o tempo entre a crise aparecer e o toque.",
      "`houveInacao90s` alimenta a hipótese H3 do playtest e o painel; nunca entra no nível de intervenção.",
      "A topologia vem AGRUPADA em anéis (`nos` real, `desenhar` quantos círculos): 1.200 elementos SVG travariam o Chromebook da escola.",
    ],
  })
  decisao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { opcao, latenciaSeg, houveInacao90s } = valida(DecisaoSchema, corpo);
    return this.rastro.decisao(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      opcao,
      latenciaSeg,
      houveInacao90s,
    );
  }

  @Post("modelagem")
  @HttpCode(200)
  @Contrato({
    resumo: "O modelo do ciclo da desinformação — 4 blocos, sem nota.",
    descricao:
      "A api confere a sequência contra a ordem do catálogo e devolve `coerente`. **Não há penalidade**: sequência incoerente grava igual e a missão segue (RF-007). O que recusa é modelo INCOMPLETO — 400 `blocos-incompletos` para quantidade errada, bloco desconhecido ou repetido (repetir deixa um slot logicamente vazio).",
    corpo: ModelagemSchema,
    resposta: EstadoSchema,
    notas: [
      "A ordem correta nunca sai do servidor: o cliente recebe os blocos e devolve a sequência que montou.",
      "Exige decisão enviada (409 `sem-decisao`): o construtor sistematiza o que aconteceu no grupo, e sem a cena não há o que sistematizar.",
    ],
  })
  modelagem(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { ordemBlocos } = valida(ModelagemSchema, corpo);
    return this.rastro.modelagem(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      ordemBlocos,
    );
  }

  @Post("reflexao")
  @HttpCode(200)
  @Contrato({
    resumo: 'O "Meu percurso" — encerra a missão (latch).',
    descricao:
      "Texto livre de até 280 caracteres. É o **único** campo livre da missão e o dado mais sensível dela: caixa escrita por menor de idade. Não vai a log, não vai à telemetria analítica, e a única rota que o devolve é o painel do professor DA TURMA dela (LGPD art. 14).\n\nGrava `concluido_em` e leva o `passo` a `fim`. Segunda chamada responde 409 `reflexao-ja-enviada`.",
    corpo: ReflexaoSchema,
    resposta: EstadoSchema,
    notas: [
      "O `trim` é anterior ao `min(1)`: um campo com três espaços é um percurso em branco, e ele contaria como entregue no painel.",
      "Exige o modelo do ciclo confirmado (400 `blocos-incompletos`).",
    ],
  })
  reflexao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { texto } = valida(ReflexaoSchema, corpo);
    return this.rastro.reflexao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), texto);
  }
}

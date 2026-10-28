import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { MarcoSchema, ParecerSchema, PublicarSchema, SessaoSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PortaVozDosDadosService } from "./porta-voz-dos-dados.service";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. O polling de 3 s cabe no teto. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp03em1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ codigo: "muitas-requisicoes", mensagem: "Limite de requisições por usuário atingido. Aguarde alguns segundos." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo);
  if (!r.success) throw erroDeJogo("payload-invalido");
  return r.data as z.output<S>;
}

const NOTA_DA_PORTA =
  "A porta da sala (ADR-69) e a disponibilidade (ADR-87) valem aqui: turma sem a missão liberada responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`).";
const NOTA_SEM_PACOTE = "Sem pacote no ar responde **409** `atividade-nao-preparada` — espera, não bloqueio.";
const NOTA_DA_PAUSA = "Com as telas pausadas pelo professor (gate em `pausa`): **409** `telas-pausadas`, para quem ainda não concluiu.";
const NOTA_DA_SESSAO = "Toda rota POST abre a sessão desta rodada se ela ainda não existe (`garantirSessao`) e devolve o estado inteiro (`SessaoSchema`).";

/**
 * Rotas do ESTUDANTE da exp03em1b — O Porta-Voz dos Dados (ADR-198), as do
 * PRD §12 com o plano aprovado por cima. O cliente manda o que o estudante
 * escolheu ou tocou; quem diz o que aquilo mediu é o servidor (regra 3). A
 * identidade — inclusive a TURMA — sai do token e do banco; a guarda de
 * liberação está no FUNIL do service. Toda rota é idempotente.
 */
@Controller("porta-voz-dos-dados")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class PortaVozDosDadosController {
  constructor(private readonly missao: PortaVozDosDadosService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão (API-006): o pacote, o gate da turma, as publicações e a perícia. É também o polling da pausa (~3 s).",
    descricao:
      "READ-ONLY. `passo` é DERIVADO no servidor (`abertura → dados → compositor → feed → errata → laudo → pericia → concluida`); `pausada` é a camada do \"Pausar Telas\". `feed` traz só o ramo da escala que ESTE estudante publicou e o post espelho com a escala oposta. Os números da série e os cartões da perícia são fixos; o gabarito da perícia não desce.",
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Sem pacote no ar: `preparada: false` e a tela é de espera."],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("sessao/marco")
  @HttpCode(200)
  @Contrato({
    resumo: "Um marco da tela, com o carimbo do servidor: chat, anexo, nudge da E2, compositor, perícia.",
    descricao:
      "A primeira vez vale; repetir é idempotente. `compositor_aberto` carimba o chat junto. `pericia_aberta` só depois da errata decidida (**409** `errata-pendente`). Os horários de `anexo_aberto`, `nudge_e2` e `compositor_aberto` são o que a EM13CO13 lê.",
    corpo: MarcoSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DA_PAUSA, NOTA_DA_SESSAO],
  })
  marco(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { marco } = valida(MarcoSchema, corpo);
    return this.missao.marco(req.auth.escolaId, req.auth.usuarioId, marco);
  }

  @Post("decisao/publicar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Confirmar Envio" (API-007): o LATCH 1 — a 1ª publicação, o slot 1 (3 → 2) e a EM13CO13.',
    corpo: PublicarSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DA_PAUSA, "A mesma publicação de novo é idempotente; outra é **409** `ja-publicado`."],
  })
  publicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.publicar(req.auth.escolaId, req.auth.usuarioId, valida(PublicarSchema, corpo));
  }

  @Post("errata/publicar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Publicar Errata Corretiva" (API-008): o slot 2 (2 → 1); a 1ª fica no histórico.',
    descricao: "Marca EM13CO12, CO21, CO22 e CO26 pelo conjunto FINAL. Quem publicou depois da retomada já liberada chega aqui direto (decisão 7).",
    corpo: PublicarSchema,
    resposta: SessaoSchema,
    notas: [
      NOTA_DA_PORTA,
      NOTA_SEM_PACOTE,
      "Sem a 1ª publicação: **409** `nao-publicado`. Antes do \"Liberar Retomada\": **409** `errata-nao-liberada`.",
      "A mesma errata de novo é idempotente; outra decisão já tomada é **409** `errata-ja-decidida`.",
    ],
  })
  publicarErrata(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.publicarErrata(req.auth.escolaId, req.auth.usuarioId, valida(PublicarSchema, corpo));
  }

  @Post("errata/pular")
  @HttpCode(200)
  @Contrato({
    resumo: '"Avançar sem publicar errata" (API-009): o slot fica; o conjunto final é a 1ª.',
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, "As mesmas recusas da errata publicada. Idempotente."],
  })
  pularErrata(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.pularErrata(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("pericia/parecer")
  @HttpCode(200)
  @Contrato({
    resumo: '"Emitir parecer" (API-010): os dois cartões, sinalizados ou não, e o motivo — conclui a missão e marca a EM13CO14.',
    descricao: "Cartão sinalizado exige motivo (`escala | fonte | titulo`); não sinalizado, sem motivo (**400** `payload-invalido`). A resposta não diz se o parecer acertou.",
    corpo: ParecerSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, "Antes da errata decidida: **409** `errata-pendente`. O mesmo parecer de novo é idempotente; outro, **409** `pericia-ja-concluida`."],
  })
  parecer(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.emitirParecer(req.auth.escolaId, req.auth.usuarioId, valida(ParecerSchema, corpo));
  }

  @Post("pericia/pular")
  @HttpCode(200)
  @Contrato({
    resumo: '"Avançar sem emitir parecer" (API-011): conclui a missão; a EM13CO14 fica "não atingiu".',
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, "Antes da errata decidida: **409** `errata-pendente`. Depois do parecer emitido: **409** `pericia-ja-concluida`. Idempotente."],
  })
  pularPericia(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.pularPericia(req.auth.escolaId, req.auth.usuarioId);
  }
}

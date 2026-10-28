import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AvisoDeCuidadoSchema,
  DevolutivaSchema,
  EstadoSchema,
  EvidenciaSchema,
  GateDoEstudanteSchema,
  MensagemSchema,
  PreviaSchema,
  PublicarSchema,
  SegurancaSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { EfeitoAmplificadorService } from "./efeito-amplificador.service";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp02em1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ codigo: "muitas-requisicoes", mensagem: "Muitos comandos enviados. Aguarde alguns segundos." }, 429);
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
const NOTA_DO_FEED =
  "Só depois do Publicar (**409** `nao-publicado`) e antes dos bastidores (**409** `explicar-nao-liberado`). Grava e marca o que o feed já alcançou (vale a melhor).";

/**
 * Rotas do ESTUDANTE da exp02em1b — O Efeito Amplificador 2.2.0 (ADR-191,
 * ADR-192), as do PRD §12 mais a devolutiva.
 *
 * O gabarito fica no servidor: o cliente manda o que o estudante escreveu,
 * escolheu ou tocou, e é o servidor que decide o que aquilo mediu (regra 3).
 * A identidade — inclusive a TURMA — sai do token e do banco. A guarda de
 * liberação está no FUNIL do service, não aqui. A IA da aula (o classificador
 * do chat e a devolutiva) não decide nada que a régua lê.
 */
@Controller("efeito-amplificador")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class EfeitoAmplificadorController {
  constructor(private readonly missao: EfeitoAmplificadorService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão (API-001), a pauta do grêmio e os textos fixos.",
    descricao:
      "`passo` é DERIVADO no servidor: `abertura → conversa → feed → explicar → concluida`; `etapa` é o mesmo estado com o nome do contrato do PRD (`E1_DESAFIAR` … `E7_CONCLUIDO`).\n\n`pausada` é a camada do \"Pausar Telas para Debate\". O comentário do feed desce SEM a categoria de saúde. `feed.instrucao` é o TC-10 com o tema do professor: o hub o desenha ao lado do aparelho.",
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Sem pacote no ar: `preparada: false` e a tela é de espera."],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Get("gate")
  @Contrato({
    resumo: "O polling do gate da turma (API-002, ~3 s): pausa e liberação dos bastidores.",
    resposta: GateDoEstudanteSchema,
    notas: [NOTA_DA_PORTA],
  })
  gate(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("entrar")
  @HttpCode(200)
  @Contrato({ resumo: '"Abrir UnooriaAI": abre a sessão desta rodada (E1 → E2). Idempotente.', resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE] })
  entrar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.entrar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("chat/mensagem")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma mensagem ao UnooriaAI (API-003): a árvore de intenções, no servidor; a IA só no que ela não entende.",
    descricao:
      "A prévia muda pela INTENÇÃO, de uma lista fechada: perguntar a fonte só pergunta (o \"sim\" à oferta corrige), o pedido de crédito e o de tirar o nome corrigem cada um o seu nó. A mensagem que a árvore não entende vai ao classificador de IA (ADR-192, quota do estudante, teto de 5 s), que devolve uma intenção da MESMA lista; a fala continua a do banco de conteúdo. Sem IA (sem saldo, lenta, recusada), vale a árvore. O texto do estudante é de menor: fica na sessão e não vai a painel, telemetria nem log.",
    corpo: MensagemSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DA_PAUSA, "Depois da 5ª: **409** `limite-do-chat`. Depois do Publicar: **409** `ja-publicado`."],
  })
  mensagem(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 30);
    const { texto } = valida(MensagemSchema, corpo);
    return this.missao.mensagem(req.auth.escolaId, req.auth.usuarioId, texto);
  }

  @Post("previa")
  @HttpCode(200)
  @Contrato({
    resumo: '"Aprovar Prévia" ou "Solicitar revisão": os botões da gaveta da prévia.',
    descricao: "Aprovar não é obrigatório para exportar, e não bloqueia por pendência: o dilema é do estudante, e a régua o mede no Publicar.",
    corpo: PreviaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, "Sem rascunho: **409** `rascunho-nao-gerado`."],
  })
  previa(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { acao } = valida(PreviaSchema, corpo);
    return this.missao.previa(req.auth.escolaId, req.auth.usuarioId, acao);
  }

  @Post("publicar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Publicar no Unoovista" (API-004): o latch 1, com a manchete. Marca a EM13CO14 e a EM13CO26.',
    corpo: PublicarSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, "A mesma manchete de novo é idempotente; outra é **409** `ja-publicado`."],
  })
  publicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { manchete } = valida(PublicarSchema, corpo);
    return this.missao.publicar(req.auth.escolaId, req.auth.usuarioId, manchete);
  }

  @Post("aviso-cuidado")
  @HttpCode(200)
  @Contrato({
    resumo: '"Fixar aviso de cuidado" com o motivo (API-005): a EM13CO24.',
    corpo: AvisoDeCuidadoSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, NOTA_DO_FEED, "O mesmo motivo de novo é idempotente; outro é **409** `aviso-ja-fixado`."],
  })
  avisoDeCuidado(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { motivo } = valida(AvisoDeCuidadoSchema, corpo);
    return this.missao.avisoDeCuidado(req.auth.escolaId, req.auth.usuarioId, motivo);
  }

  @Post("seguranca")
  @HttpCode(200)
  @Contrato({
    resumo: "As ações de proteção (API-006): a Configuração da Publicação e a Central de Apoio — a EM13CO08.",
    descricao:
      "`conta_privada` e `restringir_comentarios` são as chaves da Configuração da Publicação; `abrir_central`, `denunciar_perfil` e `encaminhar_apoio` (um comentário e a equipe) são a Central de Apoio.",
    corpo: SegurancaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DA_PAUSA, NOTA_DO_FEED, "Comentário que não é do post: **400** `comentario-desconhecido`."],
  })
  seguranca(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.seguranca(req.auth.escolaId, req.auth.usuarioId, valida(SegurancaSchema, corpo));
  }

  @Post("explicar")
  @HttpCode(200)
  @Contrato({
    resumo: "Abre os bastidores (Etapa 5) depois que o professor libera. Fecha o feed e marca o \"não atingiu\" de quem não agiu.",
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, "Antes da liberação: **409** `explicar-nao-liberado`. Idempotente."],
  })
  explicar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.abrirExplicar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("evidencia")
  @HttpCode(200)
  @Contrato({
    resumo: "Um cartão apontado nos bastidores (EVT-005). Abre a citação de Nico; não é evidência.",
    corpo: EvidenciaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, "Antes dos bastidores: **409** `explicar-nao-liberado`. Idempotente."],
  })
  evidencia(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { elemento } = valida(EvidenciaSchema, corpo);
    return this.missao.apontarEvidencia(req.auth.escolaId, req.auth.usuarioId, elemento);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "O fim (API-007, latch 2): a missão em somente leitura e o podcast na tela.",
    descricao: "Sem diário: a transferência da Etapa 6 saiu desta versão (ADR-191). Não exige os cartões apontados (PRD RF-007).",
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, "Antes dos bastidores: **409** `explicar-nao-liberado`. Idempotente."],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("devolutiva")
  @HttpCode(200)
  @Contrato({
    resumo: "A devolutiva da conclusão (ADR-192): um parágrafo por habilidade, gerado uma vez.",
    descricao:
      "Sai dos FATOS da sessão (os mesmos que a régua lê), nunca do texto do estudante, e não diz nível nem nota. A IA redige (quota do estudante, teto de 7 s); sem ela, o modelo curado responde (`origem: \"modelo\"`). A primeira gravada vale: chamar de novo devolve a mesma.",
    resposta: DevolutivaSchema,
    notas: [NOTA_DA_PORTA, "Antes de concluir: **409** `missao-nao-concluida`."],
  })
  devolutiva(@Req() req: Autenticado) {
    /* O teto PADRÃO: o contador é UM por estudante para todas as rotas, e o polling do gate (3 s) já passa de 20 por
       minuto — a e2e pegou 429 aqui. O custo tem as suas travas: a devolutiva é gerada uma vez, e a IA da aula tem o
       limite próprio (`ia-da-aula.service.ts`). */
    limitar(req.auth.usuarioId);
    return this.missao.devolutiva(req.auth.escolaId, req.auth.usuarioId);
  }
}

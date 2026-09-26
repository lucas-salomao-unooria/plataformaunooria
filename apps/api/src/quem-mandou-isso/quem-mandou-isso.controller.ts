import { Body, Controller, Get, HttpCode, HttpException, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  EnqueteSchema,
  EstadoSchema,
  GateDoEstudanteSchema,
  MuralSchema,
  ReflexaoSchema,
  SelecaoSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp05ef1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo);
  if (!r.success) throw erroDeJogo("payload-invalido");
  return r.data as z.output<S>;
}

const NOTA_DA_PORTA =
  "A porta da sala (ADR-69) e a disponibilidade (ADR-87) valem aqui: turma sem a missão liberada responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`).";
const NOTA_SEM_PACOTE =
  "Sem pacote aprovado pelo professor responde **409** `grupo-em-preparo` — espera, não bloqueio.";

/**
 * Rotas do ESTUDANTE da exp05ef1b v2.2.
 *
 * O gabarito fica no servidor: o cliente diz o que encaminhou, e a veracidade
 * e o tom das três dele só descem DEPOIS do voto e da revelação aberta pela
 * turma, dentro de `revelacao` (regra 3). A identidade — inclusive a TURMA —
 * sai do token e do banco, nunca do corpo.
 *
 * A guarda de liberação está no FUNIL do service (`estudanteDaEscola`), não
 * aqui: rota nova nasce protegida sem ninguém lembrar de protegê-la.
 */
@Controller("quem-mandou-isso")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class QuemMandouIssoController {
  constructor(private readonly missao: QuemMandouIssoService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão e as 8 mensagens do grupo, sem o gabarito.",
    descricao:
      "As mensagens saem **sem `veracidade` e `tom`** — o tipo do servidor é um `Omit`. O gabarito só aparece em `revelacao`, e `revelacao` é `null` até o estudante VOTAR na enquete e a turma abrir a revelação; ela traz só as TRÊS mensagens dele.\n\n`pacote` é `null` enquanto o professor não aprovou um pacote para a turma: **a missão nasce vazia** e a tela é de espera.\n\n`passo` é DERIVADO no servidor (os latches da sessão × a fase da turma): `abertura → grupo → enquete → espera → revelacao → sintese → reflexao → perguntas → concluida`. `grupo` cobre o grupo E o Mural (as duas vistas da mesma seleção); `selecao` restaura um F5.",
    resposta: SessaoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Quem ainda não confirmou o Mural quando a turma abre a revelação CONTINUA no grupo; depois de votar, recebe `revelacao` junto com o passo da turma (que pode já ser `sintese` ou `reflexao`) — a tela mostra os crachás antes do passo corrente.",
      "`textos.perguntas` são as falas da Nina que antecedem as perguntas de evidência (`p1`, `p2`). O enunciado e as alternativas vêm de `GET /evidencias/exp05ef1b/perguntas/:perguntaId` — embaralhadas, sem o nível —, e a resposta vai a `POST /evidencias/exp05ef1b/perguntas/:perguntaId/resposta`, que só aceita no passo `perguntas`.",
      "`reflexao` é sempre a do PRÓPRIO estudante.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Get("gate")
  @Contrato({
    resumo: "A fase da turma e o passo do estudante (polling de 3 s).",
    descricao:
      "Leve de propósito: sem pacote e sem contas. **Polling HTTP, nunca WebSocket** (ADR-93): a fase é uma linha em `exp05ef1b_gates_turma` que o professor move pelo painel.\n\n`agora` é o instante do SERVIDOR.",
    resposta: GateDoEstudanteSchema,
    notas: [NOTA_DA_PORTA, "`preparada: false` é a espera do preparo, não um erro."],
  })
  gate(@Req() req: Autenticado) {
    // 240/min: os 20 pedidos por minuto do intervalo de 3 s, com folga para reconexão.
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("entrar")
  @HttpCode(200)
  @Contrato({
    resumo: 'Toca "Entrar no grupo": abre a sessão desta rodada.',
    descricao:
      "Idempotente. Carimba `entrou_em` UMA vez — um F5 não reinicia o relógio do `tempo_feed_segundos` (entrar → confirmar o Mural).",
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE],
  })
  entrar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.entrar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Put("selecao")
  @Contrato({
    resumo: "Guarda a triagem em andamento: de 0 a 3 mensagens para o Mural.",
    descricao:
      "Substitui a seleção inteira (é um `PUT`). O servidor guarda para o F5 restaurar; nada conta até o `POST /mural`.",
    corpo: SelecaoSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      NOTA_SEM_PACOTE,
      "**400** `selecao-acima-do-limite` com mais de 3, `selecao-repetida` com id duplicado, `mensagem-desconhecida` com id fora do pacote da turma. **409** `grupo-nao-aberto` antes de entrar e `mural-ja-enviado` depois do latch.",
    ],
  })
  selecao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { selecao } = valida(SelecaoSchema, corpo);
    return this.missao.guardarSelecao(req.auth.escolaId, req.auth.usuarioId, selecao);
  }

  @Post("mural")
  @HttpCode(200)
  @Contrato({
    resumo: '"Confirmar envio" no Mural da Turma — o latch 1 (exatamente 3).',
    descricao:
      "O corpo leva as três que o estudante está VENDO no Mural, e são elas que fecham. Irreversível: a partir daqui a seleção não muda.\n\nNa MESMA transação, a marca da **EF05CO08** (evidência E14): 3 verdadeiras → atingiu; 2 verdadeiras e a falsa é emocional → atingiu; 2 verdadeiras e a falsa é neutra → em processo; ≤ 1 verdadeira → não atingiu. Se a marca falhar, o Mural não fecha.",
    corpo: MuralSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      NOTA_SEM_PACOTE,
      "**400** `selecao-incompleta` com menos de 3 (e os mesmos códigos do `PUT /selecao`).",
      "Idempotente para o duplo toque: a MESMA seleção depois do latch devolve o estado sem marcar de novo; uma seleção diferente é **409** `mural-ja-enviado`.",
    ],
  })
  mural(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { selecao } = valida(MuralSchema, corpo);
    return this.missao.enviarAoMural(req.auth.escolaId, req.auth.usuarioId, selecao);
  }

  @Post("enquete")
  @HttpCode(200)
  @Contrato({
    resumo: "O voto na enquete de motivo — o latch 2.",
    descricao:
      "Um de quatro: `urgencia`, `confianca_remetente`, `medo_indignacao`, `imagem_link_real`. Depois dele o estudante espera a revelação da turma.",
    corpo: EnqueteSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "**409** `mural-nao-enviado` antes do latch 1. O mesmo voto de novo é idempotente; outro é **409** `enquete-ja-votada`.",
    ],
  })
  enquete(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { motivo } = valida(EnqueteSchema, corpo);
    return this.missao.votar(req.auth.escolaId, req.auth.usuarioId, motivo);
  }

  @Post("reflexao")
  @HttpCode(200)
  @Contrato({
    resumo: "A regra Se/Então da Etapa 6 — o latch 3.",
    descricao:
      "`se` é uma das quatro condições; `entao` é o **único texto livre da missão**, escrito por menor de idade: vai para a tabela confinada `exp05ef1b_reflexoes`, não vai a log nem a telemetria, e só o professor que leciona na turma o lê no painel (LGPD art. 14). A regra NÃO é corrigida: a EF05CO04 vem da pergunta P2.",
    corpo: ReflexaoSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "`entao` de 15 a 240 caracteres DEPOIS do `trim`: **400** `entao-curto`, `entao-longo`, ou `entao-sem-sentido` (um caractere repetido, sequência de dígitos, pouca variedade de letras, teclado amassado).",
      "**409** `enquete-nao-votada` antes do latch 2 e `reflexao-nao-liberada` antes de o professor liberar a reflexão. A mesma regra de novo é idempotente; outra é **409** `reflexao-ja-enviada`.",
    ],
  })
  reflexao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { se, entao } = valida(ReflexaoSchema, corpo);
    return this.missao.refletir(req.auth.escolaId, req.auth.usuarioId, se, entao);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Encerra a missão, depois das perguntas de evidência.",
    descricao:
      "Não exige as respostas de P1 e P2: quem sai antes delas fica **Não avaliado** em EF05CO03/EF05CO04 (a ausência de marca), nunca \"não atingiu\". Depois disto as perguntas não aceitam mais resposta.",
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, "**409** `reflexao-nao-enviada` antes do latch 3. Idempotente."],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId);
  }
}

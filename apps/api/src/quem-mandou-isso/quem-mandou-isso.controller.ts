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
  OperacoesSchema,
  RegraSchema,
  SelecaoSchema,
  SessaoSchema,
  TesteDaRegraSchema,
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
      "As mensagens saem **sem `veracidade` e `tom`** — o tipo do servidor é um `Omit`. O gabarito só aparece em `revelacao`, e `revelacao` é `null` até o estudante VOTAR na enquete e a turma abrir a revelação; ela traz só as TRÊS mensagens dele.\n\n`pacote` é `null` enquanto o professor não aprovou um pacote para a turma: **a missão nasce vazia** e a tela é de espera.\n\n`passo` é DERIVADO no servidor (os latches da sessão × a fase da turma): `abertura → grupo → enquete → espera → revelacao → sintese → cartao → regra → concluida`. `grupo` cobre o grupo E o Mural (as duas vistas da mesma seleção); `selecao` restaura um F5.\n\n`cartao` (as seis frases com E, OU e NÃO, sem a resposta esperada) desce junto com `revelacao`; `regra` (os testes e a regra enviada), no passo `regra`.",
    resposta: SessaoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Quem ainda não confirmou o Mural quando a turma abre a revelação CONTINUA no grupo; depois de votar, recebe `revelacao` (e o `cartao`) junto com o passo da turma — a tela mostra os crachás antes do passo corrente.",
      "Na reflexão, quem ainda não enviou o cartão cai no passo `cartao`, ANTES da `regra`: o cartão segue o caminho do estudante, não o botão do professor.",
      "Só o Canal A (2.4.0): a missão não tem pergunta de múltipla escolha, e `GET /evidencias/exp05ef1b/perguntas/*` responde **404**.",
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
      "O corpo leva as três que o estudante está VENDO no Mural, e são elas que fecham. Irreversível: a partir daqui a seleção não muda.\n\nNa MESMA transação, a marca da **EF05CO08** (evidência E14): 3 verdadeiras → atingiu; 2 verdadeiras e 1 falsa (emocional ou neutra) → em processo; ≤ 1 verdadeira → não atingiu (a régua v2, ADR-120). Se a marca falhar, o Mural não fecha.",
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

  @Post("operacoes")
  @HttpCode(200)
  @Contrato({
    resumo: "O cartão de frases com E, OU e NÃO — o latch 3 (EF05CO03).",
    descricao:
      "As seis respostas (`sim`/`nao`) por id de frase, todas de uma vez. O servidor recalcula as frases da sessão, grava-as com a resposta esperada, e na MESMA transação marca a **EF05CO03**: 5 ou 6 acertos → atingiu; 3 ou 4 → em processo; 0 a 2 → não atingiu. Nada do acerto volta ao estudante.",
    corpo: OperacoesSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Aceito a partir da revelação DO ESTUDANTE (voto dado e revelação aberta pela turma), em qualquer fase dali em diante: **409** `enquete-nao-votada` e `cartao-nao-liberado` antes disso.",
      "Idempotente para o duplo toque: as MESMAS respostas devolvem o estado; outras são **409** `cartao-ja-enviado`. Frase faltando ou repetida é **400** `payload-invalido`.",
    ],
  })
  operacoes(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { respostas } = valida(OperacoesSchema, corpo);
    return this.missao.responderCartao(req.auth.escolaId, req.auth.usuarioId, respostas);
  }

  @Post("regra/teste")
  @HttpCode(200)
  @Contrato({
    resumo: "Testa a regra do tio — com a previsão do estudante ANTES do resultado (EF05CO04).",
    descricao:
      "A regra montada com peças (`condicao` e uma ou duas `acoes`, em ordem) e a `previsao` do que ela vai fazer com o áudio do tio. Grava o teste; o resultado volta em `regra.testes` do estado (`situacao` e a frase). O primeiro teste é o que a régua lê.",
    corpo: TesteDaRegraSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Só na reflexão, com o cartão enviado e a regra ainda não enviada: **409** `reflexao-nao-liberada`, `cartao-pendente` e `regra-ja-enviada`. No máximo 5 testes (**409** `testes-esgotados`).",
      "**400** `regra-invalida` com a mesma ação duas vezes.",
    ],
  })
  testarRegra(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { condicao, acoes, previsao } = valida(TesteDaRegraSchema, corpo);
    return this.missao.testarRegra(req.auth.escolaId, req.auth.usuarioId, condicao, acoes, previsao);
  }

  @Post("regra")
  @HttpCode(200)
  @Contrato({
    resumo: '"Enviar minha regra" — o latch 4 (EF05CO04).',
    descricao:
      "A regra final. Na MESMA transação, a marca da **EF05CO04**: não atingiu se encaminha antes de checar; atingiu se a PRIMEIRA regra testada já pegava o áudio e mandava checar, a primeira previsão acertou, e a enviada continua assim; em processo em todo o resto (inclusive enviar sem testar).",
    corpo: RegraSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Os mesmos **409** do teste. Idempotente: a MESMA regra de novo devolve o estado; outra é **409** `regra-ja-enviada`.",
    ],
  })
  enviarRegra(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { condicao, acoes } = valida(RegraSchema, corpo);
    return this.missao.enviarRegra(req.auth.escolaId, req.auth.usuarioId, condicao, acoes);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Encerra a missão, depois da regra do tio.",
    descricao:
      "Não exige o cartão nem a regra: quem sai antes fica **Não avaliado** em EF05CO03/EF05CO04 (a ausência de marca), nunca \"não atingiu\".",
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "**409** `enquete-nao-votada` antes do voto e `reflexao-nao-liberada` antes de o professor liberar a reflexão. Idempotente.",
    ],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId);
  }
}

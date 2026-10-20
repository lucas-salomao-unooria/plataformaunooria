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
  JogadaDoAlertaSchema,
  MuralSchema,
  RoboSchema,
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
      "As mensagens saem **sem `veracidade` e `tom`** — o tipo do servidor é um `Omit`. O gabarito só aparece em `revelacao`, e `revelacao` é `null` até o estudante VOTAR na enquete e a turma abrir a revelação; ela traz só as TRÊS mensagens dele.\n\n`pacote` é `null` enquanto o professor não aprovou um pacote para a turma: **a missão nasce vazia** e a tela é de espera.\n\n`passo` é DERIVADO no servidor (os latches da sessão × a fase da turma): `abertura → grupo → enquete → espera → revelacao → sintese → regra → concluida`. `grupo` cobre o grupo E o Mural (as duas vistas da mesma seleção); `selecao` restaura um F5.\n\n`alerta` (o quadro das OITO mensagens com os crachás, os quatro pedidos SEM a expressão esperada e o andamento) desce junto com `revelacao`; `robo` (as quatro mensagens, as ligações e o robô enviado), no passo `regra` — a reflexão.",
    resposta: SessaoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Quem ainda não confirmou o Mural quando a turma abre a revelação CONTINUA no grupo; depois de votar, recebe `revelacao` (e o `alerta`) junto com o passo da turma — a tela mostra os crachás antes do passo corrente.",
      "O alerta NÃO é passo: aceita jogada só com a turma na revelação (`alerta.aberto`) e fecha na síntese. Quem não enviou os quatro fica \"Não avaliado\" na EF05CO03 e segue para o robô do mesmo jeito.",
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

  @Post("alerta/execucao")
  @HttpCode(200)
  @Contrato({
    resumo: '"Ver resultado" no alerta do grupo: executa o filtro do pedido da vez (EF05CO03).',
    descricao:
      "O número do pedido (1 a 4) e o filtro que está na tela — uma condição (`a`), ou duas ligadas por `op` (`E`/`OU`), cada uma com o interruptor `nao`. O servidor executa sobre as oito mensagens, GRAVA a execução e devolve no estado (`alerta.andamento`) os ids que passaram. A PRIMEIRA execução de cada pedido é a que a régua lê. Nada diz se o filtro atende o pedido.",
    corpo: JogadaDoAlertaSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "**409** `enquete-nao-votada` antes do voto, `alerta-nao-liberado` antes da revelação e `alerta-fechado` a partir da síntese (ou com os quatro enviados).",
      "Um pedido por vez, em ordem: **409** `alerta-fora-de-ordem` para outro pedido. No máximo 3 execuções por pedido (**409** `limite-execucoes`).",
      "**400** `payload-invalido` com `op` sem `b` (ou `b` sem `op`).",
    ],
  })
  executarAlerta(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { pedido, expressao } = valida(JogadaDoAlertaSchema, corpo);
    return this.missao.executarAlerta(req.auth.escolaId, req.auth.usuarioId, pedido, expressao);
  }

  @Post("alerta/envio")
  @HttpCode(200)
  @Contrato({
    resumo: '"Enviar alerta ao grupo" — trava o pedido e abre o próximo (EF05CO03).',
    descricao:
      "A expressão enviada precisa ser a ÚLTIMA executada no pedido: a criança envia o que viu passar. No QUARTO envio, o latch `alertas_em` e, na MESMA transação, a marca da **EF05CO03**: cada pedido vale 2 se a primeira execução já atendia o pedido (por tabela-verdade), 1 se só a enviada atende, 0 senão; a soma de 6 a 8 atinge, de 3 a 5 está em processo, de 0 a 2 não atinge. Menos de quatro enviados = **Não avaliado** (sem marca).",
    corpo: JogadaDoAlertaSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "**400** `execute-antes` se a expressão não é a última executada (ou o pedido nem foi executado).",
      "Os mesmos **409** da execução. Idempotente: o MESMO envio de novo devolve o estado (inclusive depois de a janela fechar); outro, para um pedido já enviado, é **409** `alerta-ja-enviado`.",
    ],
  })
  enviarAlerta(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { pedido, expressao } = valida(JogadaDoAlertaSchema, corpo);
    return this.missao.enviarAlerta(req.auth.escolaId, req.auth.usuarioId, pedido, expressao);
  }

  @Post("robo/ligar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Ligar o robô" do grupo — o servidor executa o robô nas quatro mensagens (EF05CO04).',
    descricao:
      "O robô montado com blocos: `laco` (o \"para cada mensagem nova\"), a `condicao` e uma ou duas `acoes`, em ordem. O servidor executa e grava a ligação; o resultado de cada mensagem volta em `robo.ligacoes` do estado (a tela só anima). Sem o laço, o robô só olha a primeira mensagem. A PRIMEIRA ligação é a que a régua lê.",
    corpo: RoboSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Só na reflexão, antes de enviar o robô e de concluir — SEM exigir o alerta: **409** `reflexao-nao-liberada` e `robo-ja-enviado`. No máximo 5 ligações (**409** `ligacoes-esgotadas`).",
      "**400** `robo-invalido` com a mesma ação duas vezes.",
    ],
  })
  ligarRobo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { laco, condicao, acoes } = valida(RoboSchema, corpo);
    return this.missao.ligarRobo(req.auth.escolaId, req.auth.usuarioId, laco, condicao, acoes);
  }

  @Post("robo")
  @HttpCode(200)
  @Contrato({
    resumo: '"Enviar meu robô" — o latch do robô (EF05CO04).',
    descricao:
      "O robô final, definitivo. Na MESMA transação, a marca da **EF05CO04**: não atingiu se as ações encaminham antes de checar; atingiu se o enviado tem o laço, a condição pega o áudio do tio e as ações checam antes de encaminhar, e a PRIMEIRA ligação já era assim; em processo em todo o resto (inclusive enviar sem ligar). Quem fecha a missão é o `POST /concluir`, que a tela chama logo depois.",
    corpo: RoboSchema,
    resposta: EstadoSchema,
    notas: [
      NOTA_DA_PORTA,
      "Os mesmos **409** da ligação. Idempotente: o MESMO robô de novo devolve o estado; outro é **409** `robo-ja-enviado`.",
    ],
  })
  enviarRobo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { laco, condicao, acoes } = valida(RoboSchema, corpo);
    return this.missao.enviarRobo(req.auth.escolaId, req.auth.usuarioId, laco, condicao, acoes);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Encerra a missão, depois do robô do grupo.",
    descricao:
      "Não exige o alerta nem o robô: quem sai antes fica **Não avaliado** em EF05CO03/EF05CO04 (a ausência de marca), nunca \"não atingiu\".",
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

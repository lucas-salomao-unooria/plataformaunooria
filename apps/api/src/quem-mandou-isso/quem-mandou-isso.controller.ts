import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
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
  EncaminhamentoRespostaSchema,
  EncaminharSchema,
  EstadoSchema,
  GatePublicoSchema,
  MensagemIdSchema,
  MidiaSchema,
  ReflexaoSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

/**
 * Rotas do ESTUDANTE da exp-05-quem-mandou-isso.
 *
 * O gabarito fica no servidor: o cliente diz o que encaminhou, e a veracidade
 * de cada mensagem só desce DEPOIS de a professora acender o telão, dentro de
 * `revelacao` (regra inviolável nº 3). Identidade — inclusive a TURMA, que liga
 * o estudante ao gate da aula — sai sempre do token, nunca do body: com a turma
 * no corpo, a criança escolheria de qual sala é o histograma que ela vê.
 *
 * A guarda de liberação (ADR-69) está no FUNIL do service (`estudanteDaEscola`),
 * não aqui: rota nova nasce protegida sem ninguém lembrar de protegê-la.
 */

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`quem-mandou:${usuarioId}`, limite, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
  }
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

@Controller("quem-mandou-isso")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class QuemMandouIssoController {
  constructor(private readonly missao: QuemMandouIssoService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão e as 8 mensagens do grupo, sem o gabarito.",
    descricao:
      "As mensagens saem **sem `veracidade`, `tom` e `explicacao`** — o tipo do servidor é um `Omit`, então o gabarito é impossível de vazar aqui, não só ausente por descuido. Os três só aparecem dentro de `revelacao`, e `revelacao` é `null` até a professora acender o telão.\n\n`lote` é `null` enquanto a professora não homologou o grupo: **a missão nasce vazia**. Diferente da exp-08, não há banco curado de reserva — o lote é do TEMA que ela escolheu, e mostrar outro faria a criança ler mensagens sobre um acontecimento que não existiu na escola dela.",
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o cru. Quando os dois divergem e `aguardandoATurma` é `true`, ele confirmou o Mural e espera o telão.",
      "`revelacao.mensagens[].total` é quantos estudantes CONFIRMADOS encaminharam aquela mensagem — quem não confirmou não entra na conta, porque a curadoria em andamento ainda podia ser desfeita.",
      "`reflexao` é sempre a do PRÓPRIO estudante. Nenhuma rota devolve a de outra criança.",
      "O roteiro do podcast vem da api, e não do bundle, para que corrigir uma fala não exija republicar um caminho imutável no bucket.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está (polling de ~5s).",
    descricao:
      "Leve de propósito: sem lote e sem histograma. É o que deixa a docente conduzir 30 telas — a revelação acende para todos ao mesmo tempo.\n\n**Polling HTTP, nunca WebSocket** (ADR-93): a infraestrutura Cloud Run da plataforma não tem WebSocket de aplicação, e 'Iniciar revelação coletiva' é uma linha em `exp_05_gates_turma` que esta rota lê.\n\n`agora` é o instante do SERVIDOR: o relógio da máquina da escola atrasa, e não é ele que decide o momento da aula.",
    resposta: GatePublicoSchema,
    notas: [
      "`preparada: false` é a tela de espera do preparo, não um erro: a professora ainda não homologou o grupo desta turma.",
      "A guarda de liberação (ADR-69) e a de disponibilidade (ADR-87) valem AQUI também: esta rota passa pelo mesmo funil das demais, e a turma sem a missão liberada recebe 403 em vez de descobrir a etapa. É a única das quatro missões de clone em que o `gate` entra no funil — nas outras a nota não afirmava a guarda; aqui ela afirmava, e a afirmação tinha de virar verdade.",
      "Estudante sem turma recebe a etapa inicial em vez de ficar preso esperando uma aula que não existe.",
      "**Não recebe o passo por query.** `passoEfetivo` e `aguardandoATurma` são calculados sobre o passo GRAVADO da sessão: a tela não é ouvida sobre onde a criança está, porque toda mutação já o persistiu.",
    ],
  })
  gate(@Req() req: Autenticado) {
    // O teto é maior aqui porque esta é a rota do polling: 240/min cobre os 12
    // pedidos por minuto do intervalo de 5 s com folga para uma reconexão.
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("entrar")
  @HttpCode(200)
  @Contrato({
    resumo: 'Toca "Entrar no grupo" e abre a Turma 5ºB.',
    descricao:
      "Idempotente. Existe como rota para o `passo` andar no SERVIDOR: um F5 no meio da curadoria não pode devolver a criança à fala de contexto que ela já leu.\n\nÉ aqui que `entrou_em` é carimbado — e não no `criado_em` da linha. O relógio do indicativo de impulsividade começa quando a primeira mensagem aparece na tela, não quando o iframe abriu; e um F5 não o reinicia, senão o número do painel mediria a última recarga.\n\nSem lote homologado responde 409 `conteudo-nao-publicado`, que é espera, não bloqueio.",
    resposta: EstadoSchema,
  })
  entrar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.entrar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("encaminhar")
  @HttpCode(200)
  @Contrato({
    resumo: "Manda uma mensagem para o Mural da Turma.",
    descricao:
      "A dedupe é do servidor, pelo UNIQUE da tabela: tocar duas vezes na mesma setinha devolve 200 com `novo: false` e não conta de novo. Um contador incrementado no cliente seria um número que o estudante controla — e é justamente esse número que o telão mostra.\n\nO `mensagemId` é conferido contra o **lote DESTA turma** (400 `mensagem-desconhecida`), não contra a lista de ids: a professora homologou oito mensagens específicas, e um id fora delas é uma tela velha falando com um lote novo.",
    corpo: EncaminharSchema,
    resposta: EncaminhamentoRespostaSchema,
    notas: [
      "Recusa depois do latch (409 `curadoria-confirmada`) e depois do telão (409 `revelacao-iniciada`). As duas frases são diferentes de propósito: quem já confirmou não pode achar que perdeu o próprio envio.",
      "O PRIMEIRO encaminhamento carimba `primeiro_encaminhamento_em`. Com `entrou_em` ele vira o indicativo de impulsividade do painel — o dado central da missão.",
    ],
  })
  encaminhar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { mensagemId } = valida(EncaminharSchema, corpo);
    return this.missao.encaminhar(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      mensagemId,
    );
  }

  /**
   * `DELETE /encaminhar/:mensagemId`, e não `POST /desencaminhar`.
   *
   * O que a criança faz é APAGAR do Mural o que ela mesma mandou — a remoção do
   * recurso que o `POST /encaminhar` criou, com o id no caminho. Três
   * consequências práticas, e é por elas que a escolha não é de estilo: o verbo
   * já é idempotente por definição (apagar o que não está lá é 200 com
   * `novo: false`, não erro), um retry de rede não precisa de corpo para ser
   * seguro, e nenhum proxy no caminho da escola precisa carregar corpo em
   * DELETE — o que alguns descartam em silêncio.
   */
  @Delete("encaminhar/:mensagemId")
  @HttpCode(200)
  @Contrato({
    resumo: 'O "Apagar para todos" do Mural — tira a mensagem antes da confirmação.',
    descricao:
      "Existe porque a curadoria é revisível ATÉ o latch: a criança que repassou no impulso e voltou atrás fez exatamente o que a missão ensina, e tirar do Mural é o gesto que ela conhece do aplicativo real.\n\nDepois de \"Confirmar envio\" não se apaga mais (409 `curadoria-confirmada`), e depois do telão também não (409 `revelacao-iniciada`) — o snapshot que entrou na conta da sala não pode mudar enquanto a sala o discute.",
    params: z.object({ mensagemId: MensagemIdSchema }),
    resposta: EncaminhamentoRespostaSchema,
    notas: [
      "Idempotente: apagar o que já não estava no Mural devolve 200 com `novo: false`, pela mesma razão que encaminhar duas vezes devolve.",
      "`primeiro_encaminhamento_em` NÃO é apagado junto. O indicativo é sobre o impulso que aconteceu; desfazê-lo no Mural é o arrependimento, e apagar o carimbo esconderia justamente a parte que a missão quer mostrar.",
    ],
  })
  desencaminhar(@Param("mensagemId") mensagemId: string, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const id = valida(MensagemIdSchema, mensagemId);
    return this.missao.desencaminhar(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      id,
    );
  }

  @Post("leitura-integral")
  @HttpCode(200)
  @Contrato({
    resumo: "Marca que o estudante rolou até a 8ª mensagem do grupo.",
    descricao:
      "Junto com o piso de 3 encaminhamentos, é o que libera \"Confirmar envio\". Sem esta marca a criança fecha o Mural com as três primeiras mensagens e nunca lê o esclarecimento do professor, que é a `msg-7` — a mensagem que muda a leitura do grupo inteiro.\n\nIdempotente, e sem volta: ter lido não se desfaz.",
    resposta: EstadoSchema,
    notas: [
      "O cliente é quem observa a rolagem, mas quem guarda a marca é o servidor: `podeConfirmar` sai daqui, e o botão da tela é consequência dele — não o contrário.",
    ],
  })
  leituraIntegral(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.leituraIntegral(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("midia")
  @HttpCode(200)
  @Contrato({
    resumo: "Registra que a transcrição do áudio ou o card do link foi aberto.",
    descricao:
      "**Indicativo de leitura, nunca mérito.** Nada no produto depende deste array: ele não libera passo, não entra em conta nenhuma e o painel o mostra como conduta (\"ouviu o áudio\"), não como acerto.\n\nIdempotente: reabrir o mesmo balão não acrescenta duas vezes.",
    corpo: MidiaSchema,
    resposta: EstadoSchema,
    notas: [
      "Não há mídia binária na missão: o áudio é transcrição com player simulado, e o link é um card de texto. Nenhum arquivo é servido por esta rota.",
    ],
  })
  midia(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { mensagemId } = valida(MidiaSchema, corpo);
    return this.missao.midia(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      mensagemId,
    );
  }

  @Post("confirmar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Confirmar envio" — fecha o Mural da Turma (latch).',
    descricao:
      "O gesto que a missão mede. A partir daqui o Mural não muda mais, e é esta linha que entra no histograma da sala.\n\nA api confere as DUAS condições antes de aceitar, e as separa de propósito: 409 `piso-nao-atingido` quando faltam mensagens e 409 `leitura-incompleta` quando falta rolar o grupo. São coisas diferentes na cabeça da criança, e a frase de cada uma é outra.\n\nSegunda chamada responde 409 `curadoria-confirmada`. Com o telão já aceso, 409 `revelacao-iniciada`.",
    resposta: EstadoSchema,
    notas: [
      "O botão da tela já fica inerte sem as duas condições. A regra vale aqui porque `/quem-mandou-isso/confirmar` é endereço alcançável (regra inviolável nº 3).",
      "Depois da revelação não há como confirmar. Quem perdeu a janela volta pela professora, com \"Voltar para a exploração\" no painel — e é essa a saída que a mensagem de 409 manda pedir.",
    ],
  })
  confirmar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.confirmar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("avancar")
  @HttpCode(200)
  @Contrato({
    resumo: "Sai do Mural revelado e abre a pergunta do dilema do tio.",
    descricao:
      "O avanço é do ESTUDANTE, não da professora: ela libera a etapa no painel, ele decide quando termina de ler os selos. Sem a etapa aberta responde 409 `reflexao-nao-liberada`, que é uma tarja de espera — a criança não fez nada errado.\n\nA etapa `reflexao` NÃO empurra ninguém para a pergunta sozinha: quem chega atrasado vê o Mural revelado primeiro, e é dele que este botão sai. Pular direto seria responder sobre uma cena que a criança não viu.",
    resposta: EstadoSchema,
  })
  avancar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.avancarParaReflexao(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
    );
  }

  @Post("reflexao")
  @HttpCode(200)
  @Contrato({
    resumo: "A resposta ao dilema do áudio do tio — encerra a missão (latch).",
    descricao:
      "Texto livre de 5 a 500 caracteres. É o **único** campo livre da missão e o dado mais sensível dela: caixa escrita por menor de idade. Não vai a log, não vai à telemetria analítica, e a única rota que a devolve é o painel do professor DA TURMA dela (LGPD art. 14).\n\nGrava `concluido_em` e leva o `passo` a `fim`. Segunda chamada responde 409 `reflexao-ja-enviada`.",
    corpo: ReflexaoSchema,
    resposta: EstadoSchema,
    notas: [
      "O `trim` é anterior ao `min(5)`: um campo com cinco espaços é uma resposta em branco, e ela contaria como entregue no painel da professora.",
      "Exige o Mural confirmado (409 `curadoria-nao-confirmada`): o par (snapshot, reflexão) é o que a missão mede. Quem não confirmou volta pela professora, com \"Voltar para a exploração\" no painel.",
      "**Sem criptografia em nível de aplicação**, e a ausência é decisão: o repo não tem nenhuma, o Cloud SQL já cifra em repouso, e uma coluna cifrada só aqui criaria a chave que ninguém sabe onde rodar. Quem tranca é a RLS mais o recorte da rota.",
    ],
  })
  reflexao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { texto } = valida(ReflexaoSchema, corpo);
    return this.missao.reflexao(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      texto,
    );
  }
}

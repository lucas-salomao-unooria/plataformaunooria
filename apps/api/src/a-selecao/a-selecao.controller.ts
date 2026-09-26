import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { ASelecaoService } from "./a-selecao.service";
import {
  DecisaoSchema,
  EstadoSchema,
  GatePublicoSchema,
  MuralSchema,
  PedirPassoSchema,
  ReflexaoSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";

/**
 * Rotas do ESTUDANTE da exp07ef1b.
 *
 * O gabarito fica no servidor: o cliente diz QUAIS três posts publicou, e a
 * lente de cada um — a matriz, o par do Mural — sai daqui (regra inviolável
 * nº 3). Identidade, inclusive a TURMA, sai do token, nunca do corpo: com a
 * turma no corpo, a criança escolheria de qual sala é o Mural que ela vê.
 *
 * A guarda de liberação (ADR-69) está no FUNIL do service (`garantirSessao`),
 * não aqui: rota nova nasce protegida sem ninguém lembrar de protegê-la.
 */

type Autenticado = { auth: AuthClaims };

/**
 * Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. E o
 * 429 FREIA — lança, como na Vila do Lume. O `rateLimit` devolve um resultado,
 * e ignorá-lo (o do unooGPT) é ter um limite que não limita nada.
 */
function limitar(usuarioId: string, teto = 120) {
  const r = rateLimit(`a-selecao:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

@Controller("a-selecao")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class ASelecaoController {
  constructor(private readonly missao: ASelecaoService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão e os 12 posts do feed, sem o gabarito.",
    descricao:
      "Boot da experiência e o F5. Os posts saem **na ordem do feed** e **sem `enquadramento`, `tagFonte` e `tagAngulo`** — o post público é uma allowlist no servidor, então o gabarito não tem campo onde caber. Ele só desce no `GET /a-selecao/mural`, com as fichas acesas.\n\n**A missão não nasce vazia**: sem homologação, a turma roda o banco curado da Praça Central, e a cobertura `padrao` nasce na primeira entrada. `imagem.url` é `null` enquanto a professora não gerou as imagens — a tela desenha o card com o `alt`.",
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o gravado. A etapa só conduz quem PUBLICOU: antes do latch, a criança segue no feed ou nos salvos com o Mural aberto ou não.",
      "`coberturaId` é a ATIVIDADE e `rodada` é a rodada dela: mudam quando a professora troca o tema ou zera a turma, e a sessão é outra.",
      "Missão não liberada na turma responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`). Estudante sem turma responde **409** `sem-turma`.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está (polling de ~5 s).",
    descricao:
      "Magra de propósito (ADR-93): sem posts, sem contagem da sala, sem JOIN. É o que deixa a professora conduzir 30 telas — o Mural abre para todos ao mesmo tempo.\n\n**Polling HTTP, nunca WebSocket**: a infraestrutura Cloud Run da plataforma não tem WebSocket de aplicação.\n\n`agora` é o instante do SERVIDOR.",
    resposta: GatePublicoSchema,
    notas: [
      "Passa pelo MESMO funil de liberação das outras rotas (ADR-69 e ADR-87): turma sem a missão liberada recebe 403 em vez de descobrir a etapa.",
      "Não escreve nada. `rodada` e `coberturaId` são `null` só antes da primeira entrada da turma; quando mudam, a tela recarrega a sessão (a professora zerou ou trocou o tema).",
    ],
  })
  gate(@Req() req: Autenticado) {
    // 240/min cobre os 12 pedidos por minuto do intervalo de 5 s com folga
    // para uma reconexão.
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("passo")
  @HttpCode(200)
  @Contrato({
    resumo: "Registra o passo que a própria criança deu: feed, salvos ou reflexão.",
    descricao:
      "Existe para o passo andar no SERVIDOR: um F5 nos salvos não pode devolver a criança à DM da Amara.\n\n`feed` vale do desafio ou de volta dos salvos, e só antes do latch. `salvos` só de quem está no feed. `reflexao` só de quem publicou e com a explicação liberada — pedir de novo, ou depois de já ter enviado, devolve o passo em que ela está.",
    corpo: PedirPassoSchema,
    resposta: EstadoSchema,
    notas: [
      "Depois do latch, `feed` e `salvos` respondem **409** `latch-ja-confirmado`. `salvos` saindo do desafio responde **409** `passo-invalido`.",
      "`reflexao` sem publicação responde **409** `stories-nao-publicados`; antes da etapa `explicacao`, **409** `reflexao-nao-liberada`.",
      "`tempoFeedS` (0 a 3600) é o tempo de feed que a tela mediu. Indicativo, nunca mérito, e só gravado antes do latch.",
    ],
  })
  passo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const pedido = valida(PedirPassoSchema, corpo);
    return this.missao.pedirPasso(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), pedido);
  }

  @Post("decisao")
  @HttpCode(200)
  @Contrato({
    resumo: '"Confirmar publicação" — os 3 posts e a legenda nos Stories (latch).',
    descricao:
      "O gesto que a missão mede, e ele é IRREVERSÍVEL. A api confere a tríade contra a cobertura da turma, calcula a matriz de enquadramento AQUI (o cliente nunca a manda) e grava carimbo e passo juntos.\n\nA legenda passa pelo **sanitizador** antes: outro estudante vai lê-la no Mural. Link, telefone, e-mail, `@` de fora da ficção e palavrão respondem **422** com o código do que tirar — `legenda-com-link`, `legenda-com-telefone`, `legenda-com-email`, `legenda-com-mencao`, `legenda-com-palavrao`. As contas da ficção (`@folhaoficial_`, `@voz_coletiva`, `@metrica_urbana`, `@estudante_gremio`) podem ser citadas.\n\nDepois do latch, fora da transação dele, a legenda é graduada para a evidência pedagógica (Canal A). A resposta não diz o resultado: **o estudante não vê o nível**.",
    corpo: DecisaoSchema,
    resposta: EstadoSchema,
    notas: [
      "`selecao`: exatamente 3 ids diferentes, de `post_a_1` a `post_c_4`. `legenda`: 10 a 140 caracteres contados em code points, depois de juntar espaços e quebras de linha. (Os `.refine()` somem do OpenAPI; daí esta nota.)",
      "Segunda publicação — inclusive duas simultâneas — responde **409** `latch-ja-confirmado`. Id fora da cobertura da turma responde **400** `selecao-invalida`.",
      "Com o Mural já aberto, quem publica recebe o par do computador dele, ou o colega virtual mais distante (Tomás ou Malu).",
      "A graduação por IA tem teto de ~6 s. Sem saldo, fora do tempo ou com saída inválida, nada é marcado: fica \"Não avaliado\", e o professor decide.",
    ],
  })
  decisao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const decisao = valida(DecisaoSchema, corpo);
    return this.missao.decidir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), decisao);
  }

  @Get("mural")
  @Contrato({
    resumo: "O Mural da Turma: a própria tríade ao lado da do par.",
    descricao:
      "Antes das fichas, só imagem e legenda — a tela nua da Fase 1 do PRD. `fichas` e `equilibrio` são `null` e o gabarito NÃO está na resposta. Com a etapa `fichas` (ou depois), cada post ganha fonte ouvida, ângulo da imagem e lente, e cada tríade o equilíbrio editorial em percentuais.\n\nO par é o que o pareamento CONGELOU na abertura do Mural: um colega da sala (ou a equipe dele), com o rótulo que a tela escreve, ou o colega virtual.",
    resposta: MuralSchema,
    notas: [
      "Sem publicação responde **409** `stories-nao-publicados`; antes da etapa `mural`, **409** `mural-nao-liberado`.",
      "`par.rotulo` é o primeiro nome (desempatado quando repete na sala), o nome da equipe, ou Tomás/Malu — nunca o nome completo.",
    ],
  })
  mural(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.mural(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("reflexao")
  @HttpCode(200)
  @Contrato({
    resumo: "A reflexão individual da Etapa 6 (latch) — leva às enquetes.",
    descricao:
      "Texto livre de 100 a 500 caracteres, contados em code points. É caixa escrita por menor de idade: não vai a log nem à telemetria, e só o professor que leciona a turma o lê no painel (LGPD art. 14; recorte da ADR-108).\n\nDepois dela vêm as duas enquetes da DM da Amara, pelas rotas de `/evidencias/exp07ef1b/perguntas`.",
    corpo: ReflexaoSchema,
    resposta: EstadoSchema,
    notas: [
      "O `trim` é anterior à contagem: cem espaços são uma reflexão em branco.",
      "Sem publicação responde **409** `stories-nao-publicados`; antes da etapa `explicacao`, **409** `reflexao-nao-liberada`; a segunda, **409** `reflexao-ja-enviada`.",
    ],
  })
  reflexao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { texto } = valida(ReflexaoSchema, corpo);
    return this.missao.refletir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), texto);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: '"Missão concluída!" — idempotente.',
    descricao:
      "Leva a sessão a `fim` e carimba `concluidaEm`, no mesmo update. As enquetes não são exigidas (a enquete que falha pula para o fim); a reflexão, sim.",
    resposta: EstadoSchema,
    notas: ["Antes da reflexão responde **409** `reflexao-pendente`. Concluir de novo devolve o mesmo estado."],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }
}

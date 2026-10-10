import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AcaoDaGaleriaSchema,
  BatimentoDaCedulaSchema,
  CartoesSchema,
  EstadoSchema,
  EventosDoFeedSchema,
  FeedSchema,
  GaleriaSchema,
  GatePublicoSchema,
  OrdemDaCadeiaSchema,
  PedirPassoSchema,
  RevisaoDoVotoSchema,
  SessaoSchema,
  TentativaSchema,
  VotoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { JuriEstadualService } from "./juri-estadual.service";

/**
 * Rotas do ESTUDANTE da exp06ef1b — O Júri Estadual de Projetos.
 *
 * O motor e o gabarito ficam no servidor: o cliente diz o que MEDIU (curtiu,
 * ficou mais de 5 s) e o que ESCOLHEU (o voto, a ordem da cadeia), e o
 * próximo post, a taxa de invisibilidade e se a ordem confere saem daqui
 * (regra inviolável nº 3). Identidade, inclusive a TURMA, sai do token, nunca
 * do corpo.
 *
 * A guarda de liberação (ADR-69) está no FUNIL do service (`garantirSessao`),
 * não aqui: rota nova nasce protegida sem ninguém lembrar de protegê-la.
 */

type Autenticado = { auth: AuthClaims };

/** `POST galeria/acoes` e `POST cedula/batimento` respondem 204, sem corpo. */
const SemCorpoSchema = z.void();

/** `POST passo`: o feed (para `feed`) ou o estado curto (para `cadeia`). */
const RespostaDoPassoSchema = z.union([FeedSchema, EstadoSchema]);

/**
 * Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. E o
 * 429 FREIA — lança, com o código, como todo erro desta missão.
 */
function limitar(usuarioId: string, teto = 120) {
  const r = rateLimit(`juri-estadual:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw erroDeJogo("muitas-requisicoes");
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

const PORTA =
  "Missão não liberada na turma responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`); sem atividade em andamento, **403** `atividade-nao-preparada`. Estudante sem turma responde **409** `sem-turma`. Corpo fora do formato responde **400** `payload-invalido`.";

@Controller("juri-estadual")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class JuriEstadualController {
  constructor(private readonly missao: JuriEstadualService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão: o passo, o feed servido até aqui, o voto e os blocos do fim.",
    descricao:
      "Boot da experiência e o F5. O feed traz **só os posts que o motor serviu** — o acervo da mostra existe só no servidor até a Galeria Oculta. Nenhum peso, nenhuma área líder: a regra do feed é o que a Etapa 5 ensina, e a criança a descobre depois.\n\n`cadeia` (os quatro blocos embaralhados) e `mariana` (o caso e os cartões) só vêm do passo deles em diante, com ids OPACOS e estáveis num F5. Nenhum diz a posição certa, e nenhum cartão diz se é o certo.",
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o gravado. A etapa só conduz quem votou: quem ainda está no feed continua no feed com a galeria liberada.",
      "`pacoteId` é a ATIVIDADE e `rodada` é a rodada dela: mudam quando o professor põe outra atividade no ar ou zera a turma, e a sessão é outra.",
      "`imagem.url` é `null` enquanto o professor não gerou as imagens — a tela desenha a arte procedural do estande.",
      PORTA,
    ],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está (polling de ~3 s, na espera da plenária).",
    descricao:
      "Magra de propósito: sem acervo, sem contagem da sala, sem JOIN. **Polling HTTP, nunca WebSocket.** Quando `pacoteId` ou `rodada` mudam, a tela recarrega a sessão.",
    resposta: GatePublicoSchema,
    notas: [
      "Passa pelo MESMO funil de liberação das outras rotas (ADR-69 e ADR-87): turma sem a missão liberada recebe 403 em vez de descobrir a etapa.",
      "Não escreve nada. Sem atividade em andamento, **403** `atividade-nao-preparada`.",
    ],
  })
  gate(@Req() req: Autenticado) {
    // 240/min cobre os 20 pedidos por minuto do intervalo de 3 s com folga
    // para uma reconexão e para as outras rotas da mesma tela.
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("passo")
  @HttpCode(200)
  @Contrato({
    resumo: '"Acessar Feed da Mostra" (da credencial para o feed) e o "avançar" da revisão para a cadeia.',
    descricao:
      "`para: \"feed\"` grava o passo `feed` e, com o feed vazio, serve a ABERTURA: quatro posts, a apresentação de um projeto de cada área, em ordem sorteada pela sessão. Responde o feed.\n\n`para: \"cadeia\"` leva a sessão de `revisada` (a revisão do voto gravada) para a `cadeia` (Etapa 5). Responde o estado curto. Pedir de novo devolve o estado como está (a escada é de sentido único).",
    corpo: PedirPassoSchema,
    resposta: RespostaDoPassoSchema,
    notas: ["`cadeia` antes da revisão responde **409** `passo-invalido`.", PORTA],
  })
  passo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { para } = valida(PedirPassoSchema, corpo);
    return this.missao.pedirPasso(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), para);
  }

  @Post("feed/eventos")
  @HttpCode(200)
  @Contrato({
    resumo: "O que a tela mediu (curtidas e permanências) e, se pedido, o próximo post.",
    descricao:
      "A curtida e o salvo são ESTADO (`curtiu`/`salvou: true/false`), a permanência é FATO (mais de 5 s num post, uma vez por post). Curtir (3) e permanecer (1) pesam e entram antes de o motor escolher o próximo; **salvar é gravado e não pesa**. Com a área em foco, os posts seguintes são só dela, repetindo os projetos em formatos diferentes (`tipo`: apresentação, bastidor, protótipo, depoimento). `proximo: true` quando a tela chegou ao último post servido: o servidor serve UM a mais, até dez.\n\nO primeiro `proximo: true` é a 1ª rolagem e liga o relógio de **8 minutos do servidor** (`encerraEm`); recarregar não zera. Com o tempo esgotado (`tempoEsgotado`), o feed não serve mais post e `cedulaLiberada` fica `true`.",
    corpo: EventosDoFeedSchema,
    resposta: FeedSchema,
    notas: [
      "Post que o feed não serviu responde **400** `post-desconhecido` — o cliente não inventa post.",
      "Depois do voto responde **409** `voto-ja-lacrado`; antes do feed, **409** `passo-invalido`.",
      PORTA,
    ],
  })
  eventos(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    const eventos = valida(EventosDoFeedSchema, corpo);
    return this.missao.eventosDoFeed(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), eventos);
  }

  @Post("cedula/batimento")
  @HttpCode(204)
  @Contrato({
    resumo: "O batimento da cédula aberta (a cada 15 s): o sinalizador de ociosos do professor.",
    descricao:
      "Com a cédula aberta, a tela manda a cada 15 s há quantos segundos não há toque nela (`segundosSemToque`). O servidor grava o instante do batimento e o do último toque; o painel do professor acende o ícone de ocioso ao lado do nome com mais de 60 s. Sem batimento por 40 s (a cédula fechou, o voto foi), a marca some sozinha; `aberta: false` a apaga na hora. Viaja junto com o polling que a tela já faz — não há rota de polling nova.",
    corpo: BatimentoDaCedulaSchema,
    resposta: SemCorpoSchema,
    notas: ["Fora do feed (depois do voto) responde 204 sem gravar: o batimento atrasado não acende ninguém.", PORTA],
  })
  async batimento(@Body() corpo: unknown, @Req() req: Autenticado): Promise<void> {
    limitar(req.auth.usuarioId, 240);
    const batimento = valida(BatimentoDaCedulaSchema, corpo);
    await this.missao.batimentoDaCedula(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), batimento);
  }

  @Post("voto")
  @HttpCode(200)
  @Contrato({
    resumo: "A cédula lacrada — o projeto e a certeza (latch).",
    descricao:
      "O gesto que a missão confronta, e ele é IRREVERSÍVEL: grava o projeto, a certeza (`examinei_bem` = \"Sim\", `vi_tudo` = \"Com certeza\"), o carimbo e o passo `lacrada` juntos. A cédula tem quatro elementos e nenhuma justificativa. Depois dele, a criança espera a turma (o pico): o professor projeta a dispersão de votos e libera a auditoria.",
    corpo: VotoSchema,
    resposta: EstadoSchema,
    notas: [
      "Antes da cédula liberada (menos de dez posts E menos de 8 minutos desde a 1ª rolagem) responde **409** `feed-incompleto`; projeto que não apareceu no feed DESTA criança, **409** `projeto-fora-do-feed`.",
      "O segundo voto — inclusive dois simultâneos — responde **409** `voto-ja-lacrado`.",
      PORTA,
    ],
  })
  voto(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const voto = valida(VotoSchema, corpo);
    return this.missao.votar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), voto);
  }

  @Get("galeria")
  @Contrato({
    resumo: "A Galeria Oculta: os 16 estandes, os que não chegaram ao feed primeiro, e a taxa REAL.",
    descricao:
      "`invisibilidade` é o número desta sessão, calculado no servidor: os projetos que o feed nunca mostrou sobre os dezesseis — o do badge (\"{n}% dos projetos da feira ficaram fora do seu feed\") e o tamanho da grade de três colunas. Quem curte fica em 69% (11 de 16) com a saturação; quem não interagiu, perto de 38%. `exibidoNoSeuFeed` diz quais chegaram; `podeManter`, se o \"Manter meu voto inicial\" já vale (abriu um oculto).",
    resposta: GaleriaSchema,
    notas: [
      "Antes de a galeria abrir para esta criança (sem voto, ou com a etapa da turma ainda na exploração) responde **403** `galeria-nao-liberada`.",
      PORTA,
    ],
  })
  galeria(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.galeria(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("galeria/acoes")
  @HttpCode(204)
  @Contrato({
    resumo: "Registra o que a criança fez na galeria: abriu um estande ou buscou.",
    descricao:
      "É o registro da EF06CO10 e da EF06CO01, lido no latch da revisão do voto. Abrir de novo o mesmo estande não conta. Da busca, só o TIPO (`hashtag` ou `texto`) e a área que casou, ou `null` — **o texto digitado nunca sai do aparelho** (texto livre de menor). Até 30 buscas são gravadas.",
    corpo: AcaoDaGaleriaSchema,
    resposta: SemCorpoSchema,
    notas: [
      "Só na galeria: antes, **403** `galeria-nao-liberada`; depois da revisão do voto, **409** `passo-invalido`.",
      PORTA,
    ],
  })
  async acaoDaGaleria(@Body() corpo: unknown, @Req() req: Autenticado): Promise<void> {
    limitar(req.auth.usuarioId, 240);
    const acao = valida(AcaoDaGaleriaSchema, corpo);
    await this.missao.acaoDaGaleria(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), acao);
  }

  @Post("revisao")
  @HttpCode(200)
  @Contrato({
    resumo: '"Manter meu voto inicial" ou "Confirmar Voto Revisado", depois da galeria (latch).',
    descricao:
      "`manter` só vale depois de abrir ao menos UM estande oculto; `trocar` aceita qualquer um dos dezesseis, menos o do voto lacrado. Sem justificativa. Grava a ação, o voto final, o carimbo e o passo `revisada` juntos, e marca a EF06CO10 (`auditoria`: dois ocultos abertos E uma busca = atingiu; abriu algum = em processo) e a EF06CO01 (`classificacao`: buscou pela hashtag de uma categoria fora da bolha E abriu um projeto dela = atingiu; buscou ou abriu um oculto = em processo). Quem não fez nada fica SEM a marca de ação: decide a pergunta. Depois, `POST passo` com `para: \"cadeia\"`.",
    corpo: RevisaoDoVotoSchema,
    resposta: EstadoSchema,
    notas: [
      "`manter` sem nenhum oculto aberto responde **409** `galeria-sem-inspecao`; `trocar` com o mesmo projeto do voto, **400** `payload-invalido`.",
      "A segunda revisão — inclusive duas simultâneas — responde **409** `voto-ja-revisado`. Antes da galeria, **403** `galeria-nao-liberada`. Com a rodada trocada no meio (o professor zerou), **409** `rodada-mudou`.",
      PORTA,
    ],
  })
  revisao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const revisao = valida(RevisaoDoVotoSchema, corpo);
    return this.missao.revisar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), revisao);
  }

  @Post("cadeia")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma tentativa de montar a cadeia: Interações → Dados → Algoritmo → Bolha.",
    descricao:
      "Do passo `cadeia`. Cada envio é uma TENTATIVA. Na certa (200), o passo vai a `mariana` e a EF06CO03 (`cadeia`) é marcada pelo número de tentativas (1 = atingiu, 2–3 = em processo, mais = não atingiu). Na errada, **422** `ordem-incorreta` com `tentativas` no corpo — a tentativa CONTA, e a resposta nunca diz qual vaga errou. Com a cadeia já montada, responde `correta: true` sem contar outra tentativa.",
    corpo: OrdemDaCadeiaSchema,
    resposta: TentativaSchema,
    notas: [
      "`ordem`: os quatro ids OPACOS desta sessão (`bl-` e três caracteres), sem repetir. (O `.refine()` some do OpenAPI; daí esta nota.) Id de outra sessão responde **400** `payload-invalido`.",
      "Fora do passo `cadeia` responde **409** `passo-invalido`; com a rodada trocada no meio, **409** `rodada-mudou`.",
      PORTA,
    ],
  })
  cadeia(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { ordem } = valida(OrdemDaCadeiaSchema, corpo);
    return this.missao.montarCadeia(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), ordem);
  }

  @Post("cartoes")
  @HttpCode(200)
  @Contrato({
    resumo: "O caso Mariana: um cartão de mecanismo e um de atitude.",
    descricao:
      "Grava a escolha e o passo `enquetes`. **Não marca evidência e não diz qual é o certo**: é a transferência, conversada na plenária. Escolher de novo devolve o estado, sem trocar a primeira escolha.",
    corpo: CartoesSchema,
    resposta: EstadoSchema,
    notas: ["Fora do passo `mariana` responde **409** `passo-invalido`.", PORTA],
  })
  cartoes(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const cartoes = valida(CartoesSchema, corpo);
    return this.missao.escolherCartoes(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), cartoes);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "O crachá homologado — conclui a missão, idempotente.",
    descricao:
      "Leva a sessão de `enquetes` a `fim` e carimba a conclusão, no mesmo update. As três enquetes vão pelas rotas genéricas de `/evidencias/exp06ef1b/perguntas`, e não são exigidas para concluir.",
    resposta: EstadoSchema,
    notas: ["Antes das enquetes responde **409** `passo-invalido`. Concluir de novo devolve o mesmo estado.", PORTA],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }
}

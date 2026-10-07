import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AcaoDaGaleriaSchema,
  CartoesSchema,
  DesvioSchema,
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

/** `POST galeria/acoes` responde 204, sem corpo. */
const SemCorpoSchema = z.void();

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
    resumo: '"Acessar o feed da mostra" — da credencial para o feed, com a abertura.',
    descricao:
      "Grava o passo `feed` e, com o feed vazio, serve a ABERTURA: quatro posts, a apresentação de um projeto de cada área, em ordem sorteada pela sessão — a criança vê que a mostra é variada antes de a bolha fechar. Pedir de novo devolve o feed como está; depois do voto, também (a escada é de sentido único).",
    corpo: PedirPassoSchema,
    resposta: FeedSchema,
    notas: [PORTA],
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
      "A curtida e o salvo são ESTADO (`curtiu`/`salvou: true/false`; desfazer devolve o peso), a permanência é FATO (mais de 5 s num post, uma vez por post). Os três sinais entram antes de o motor escolher o próximo, porque são eles que afunilam: com duas curtidas na mesma área, o resto do feed é dela. Comentar e compartilhar não pesam e não viajam. `proximo: true` quando a tela chegou ao último post servido: o servidor serve UM a mais, até dez.",
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

  @Post("voto")
  @HttpCode(200)
  @Contrato({
    resumo: "A cédula lacrada — o voto, a convicção e a justificativa de antes (latch).",
    descricao:
      "O gesto que a missão confronta, e ele é IRREVERSÍVEL: grava o projeto, a convicção, a JUSTIFICATIVA (um cartão de motivo, `v1`–`v3`, e o trecho grifado: o índice de uma frase da legenda do estande votado), o carimbo e o passo `lacrada` juntos. Depois dele, a criança espera a turma (o pico): o professor projeta a dispersão de votos e libera a Galeria Oculta. A justificativa volta ao lado dos estandes escondidos, na revisão.",
    corpo: VotoSchema,
    resposta: EstadoSchema,
    notas: [
      "Com menos de dez posts servidos responde **409** `feed-incompleto`; projeto que não apareceu no feed DESTA criança, **409** `projeto-fora-do-feed`; `trecho` que não é uma frase da legenda dele, **400** `payload-invalido`.",
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
      "`invisibilidade` é o número desta sessão, calculado no servidor: os projetos que o feed nunca mostrou sobre os dezesseis. Quem curtiu duas vezes a mesma área fica perto de 56%; quem não interagiu, perto de 38%. Nada é cravado na copy, e a grade tem tamanho variável. `exibidoNoSeuFeed` diz quais chegaram.",
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
      "É o registro da EF06CO01, lido no latch da revisão do voto. Abrir de novo o mesmo estande não conta. Da busca, só o TIPO (`hashtag` ou `texto`) e a área que casou, ou `null` — **o texto digitado nunca sai do aparelho** (texto livre de menor). Até 30 buscas são gravadas.",
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
    resumo: "Manter, trocar ou complementar o voto, depois da galeria, com a justificativa de depois (latch).",
    descricao:
      "`trocar` aceita qualquer um dos dezesseis estandes (a galeria mostrou todos), menos o do voto lacrado; `complementar` mantém o voto e indica também outro estande. Toda ação leva a justificativa de DEPOIS — um cartão de motivo (`r1`–`r3`) e o trecho grifado, da legenda do estande da decisão (o do voto, ao manter). Grava a ação, o voto final, o complemento, a justificativa, o carimbo e o passo `revisada` (a espera da rodada de desvio) juntos, e marca a EF06CO10 (`auditoria`: quantos estandes ocultos ela abriu) e a EF06CO01 (`classificacao`: se buscou pela hashtag de outra área e abriu um oculto dela) pelo que a criança fez na galeria antes de decidir. Quem não abriu nem buscou nada fica SEM a marca de ação (ausência): decide a pergunta da habilidade.",
    corpo: RevisaoDoVotoSchema,
    resposta: EstadoSchema,
    notas: [
      "`trocar` ou `complementar` com o mesmo projeto do voto, ou `trecho` fora da legenda, responde **400** `payload-invalido`.",
      "A segunda revisão — inclusive duas simultâneas — responde **409** `voto-ja-revisado`. Antes da galeria, **403** `galeria-nao-liberada`. Com a rodada trocada no meio (o professor zerou), **409** `rodada-mudou`.",
      PORTA,
    ],
  })
  revisao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const revisao = valida(RevisaoDoVotoSchema, corpo);
    return this.missao.revisar(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      revisao,
    );
  }

  @Post("desvio/eventos")
  @HttpCode(200)
  @Contrato({
    resumo: "A rodada de desvio: o que a tela mediu e, se pedido, o próximo post.",
    descricao:
      "Depois da revisão, o professor libera uma rodada curta do feed (seis posts) para a criança interagir com o que o feed dela não mostrava — e ver o feed mudar. O MESMO corpo e o MESMO motor do feed do júri, com os pesos SÓ desta rodada: os dois primeiros posts vêm das duas áreas que menos apareceram para ela, e o resto segue as curtidas e os salvos que ela fizer agora. Na primeira chamada (mesmo vazia) serve a abertura. Com os seis servidos, `comparacao` traz quantos posts de cada área o feed do júri e o desvio trouxeram.",
    corpo: EventosDoFeedSchema,
    resposta: DesvioSchema,
    notas: [
      "Antes de o professor liberar (ou antes da revisão do voto) responde **403** `desvio-nao-liberado`; depois de concluído, **409** `desvio-ja-concluido`.",
      "Post que esta rodada não serviu responde **400** `post-desconhecido`.",
      PORTA,
    ],
  })
  desvio(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    const eventos = valida(EventosDoFeedSchema, corpo);
    return this.missao.eventosDoDesvio(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), eventos);
  }

  @Post("desvio/concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Encerra a rodada de desvio e abre a cadeia.",
    descricao:
      "Leva a sessão de `revisada` a `cadeia` e carimba o desvio, no mesmo update. Pede os seis posts servidos e ao menos uma curtida ou um salvo: sem interação, não houve desvio. **Não marca evidência** — a vivência é obrigatória, não medida; o painel mostra quem concluiu. Encerrar de novo devolve o mesmo estado.",
    resposta: EstadoSchema,
    notas: [
      "Com menos de seis posts responde **409** `desvio-incompleto`; sem curtida nem salvo, **409** `desvio-sem-interacao`; antes da liberação, **403** `desvio-nao-liberado`.",
      PORTA,
    ],
  })
  concluirDesvio(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluirDesvio(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("cadeia")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma tentativa de montar a cadeia: Interações → Dados → Algoritmo → Bolha.",
    descricao:
      "Do passo `cadeia` (depois da rodada de desvio). Cada envio é uma TENTATIVA. A resposta diz só se a ordem confere — nunca qual vaga errou. Na certa, o passo vai a `mariana` e a EF06CO03 (`cadeia`) é marcada pelo número de tentativas (1 = atingiu, 2–3 = em processo, mais = não atingiu). Com a cadeia já montada, responde `correta: true` sem contar outra tentativa.",
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

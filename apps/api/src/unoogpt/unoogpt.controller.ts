import { Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { erroDeJogo } from "./erros";
import { Contrato } from "../openapi/contrato";
import { CanalADaTempestade } from "./canal-a.service";
import {
  AlertaRespostaSchema,
  ESeRespostaSchema,
  ESeSchema,
  FechamentoSchema,
  FontesRespostaSchema,
  LeituraRespostaSchema,
  MoradoraRespostaSchema,
  RegistroSchema,
  SaudeRespostaSchema,
  SaudeSchema,
  WhatsappRespostaSchema,
  AlocacaoFeitaSchema,
  AlocacaoSchema,
  ConjuntosSchema,
  ContrafactualRespostaSchema,
  ContrafactualSchema,
  EstadoDoJogoSchema,
  PassoSchema,
  PerguntaSchema,
  ReinicioSchema,
  RelogioDoEstudanteSchema,
  ResultadoSchema,
  SessaoDoEstudanteSchema,
  SoASessaoSchema,
  TurnoDoCientistaSchema,
} from "./contrato-de-rotas";
import { UnoogptService } from "./unoogpt.service";

/**
 * As rotas do ESTUDANTE na Missão Tempestade.
 *
 * Note o que NÃO existe aqui: id de sessão. No projeto de origem toda rota era
 * `/api/missao/:id/*` e havia a guarda `donoDaSessao` para provar a posse; aqui
 * a identidade é `(escola, estudante)` vinda do TOKEN, e não há como pedir a sessão
 * de outra pessoa. A guarda desapareceu junto com a classe de bug que ela
 * protegia.
 *
 * Zod em TODO input externo, declarado aqui e nunca no service. Rate limit por
 * USUÁRIO, nunca por IP: a turma inteira sai pelo mesmo NAT da escola.
 */
@Controller("unoogpt")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class UnoogptController {
  constructor(
    private readonly service: UnoogptService,
    private readonly canalA: CanalADaTempestade,
  ) {}

  /**
   * Quem está falando. Vem SÓ do token — nunca do corpo da requisição: aceitar
   * `estudanteId` do cliente seria deixar uma aba pedir a partida de outra pessoa.
   */
  private quem(req: { auth: AuthClaims }) {
    const { usuarioId, escolaId, perfil } = req.auth;
    // Estudante sem escola não existe: escola vazia é exclusividade do
    // admin-contrato, e ele não joga.
    if (!escolaId) throw erroDeJogo("sessao-encerrada");
    return { estudanteId: usuarioId, escolaId, perfil };
  }

  private valida<T>(schema: z.ZodType<T>, corpo: unknown): T {
    const r = schema.safeParse(corpo);
    if (!r.success) throw erroDeJogo("payload-invalido");
    return r.data;
  }

  /** O bootstrap da tela. Cria a sessão na primeira visita. */
  @Get("sessao")
  @Contrato({
    resumo: "O bootstrap da Missão Tempestade. Cria a sessão na primeira visita.",
    descricao:
      "Repare no que NÃO existe nestas rotas: **id de sessão**. No app de origem toda rota era `/api/missao/:id/*` com uma guarda `donoDaSessao` para provar a posse; aqui a identidade é `(escola, estudante)` vinda do TOKEN, e não há como pedir a partida de outra pessoa. A guarda desapareceu junto com a classe de bug que ela protegia.",
    resposta: SessaoDoEstudanteSchema,
    notas: [
      "A `projecao` é SERVIDA, nunca calculada no navegador: um bundle capaz de computá-la deixaria o estudante prever o desfecho antes de enviar.",
      "O mapa começa vazio: só o que uma Pergunta revelou chega ao navegador — `estimativa: null` é o cartão em branco, e **branco é informação**.",
      "A `ficha` sai por allowlist, sem os números por bairro: eles são a verdade do mundo, e mandá-los daria de graça a resposta que a missão existe para o estudante não ter.",
    ],
  })
  async sessao(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    return this.service.sessao(escolaId, estudanteId);
  }

  /** Polling do relógio da turma (~5s). Leve: sem IA, sem mapa. */
  @Get("relogio")
  @Contrato({
    resumo: "O relógio da turma — polling de ~5s.",
    descricao:
      "Leve de propósito: sem IA e sem mapa. `agora` é o instante do SERVIDOR, senão o relógio da máquina da escola (que atrasa) decide quanto tempo a turma tem.",
    resposta: RelogioDoEstudanteSchema,
    notas: ["240 chamadas por minuto por estudante."],
  })
  async relogio(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    rateLimit(`unoogpt:relogio:${estudanteId}`, 240, 60_000);
    return this.service.relogio(escolaId, estudanteId);
  }

  /**
   * O turno do Cientista — a rota que fala com o modelo.
   *
   * Rate limit apertado (12/min) porque cada chamada custa tokens de verdade: o
   * teto por sessão é o controle de custo, e este é o freio contra o laço.
   */
  @Post("pergunta")
  @Contrato({
    resumo: "O turno do Cientista — a rota que fala com o modelo.",
    descricao:
      "Rate limit apertado (**12/min**) porque cada chamada custa tokens de verdade: o teto por sessão é o controle de custo, e este é o freio contra o laço.",
    corpo: PerguntaSchema,
    resposta: TurnoDoCientistaSchema,
    notas: [
      "Falha do PROVEDOR **não** chega ao estudante como 500: vira `cientista-indisponivel` (**503**), que a tela traduz em \"tente falar de novo\". E **não debita** — o débito acontece só depois de resposta válida.",
      "O log fica com o motivo técnico, **sem o texto do estudante**: é caixa livre escrita por menor de idade.",
      "O número que um botão de opção mostra sai do MOTOR, nunca da LLM.",
    ],
  })
  async pergunta(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId, perfil } = this.quem(req);
    // 600 caracteres: o campo do chat, não um formulário. Acima disso não é
    // fala de estudante — é colagem, e ela infla o prompt de todo turno seguinte.
    const { texto } = this.valida(PerguntaSchema, corpo);
    rateLimit(`unoogpt:pergunta:${estudanteId}`, 12, 60_000);
    return this.service.pergunta(escolaId, estudanteId, perfil, texto);
  }

  /** Carregar fontes pelo painel. `PUT`: é atribuição de conjunto. */
  @Put("conjuntos")
  @Contrato({
    resumo: "Carrega fontes no modelo pelo painel.",
    descricao: "`PUT` porque é atribuição de conjunto. As camadas ACUMULAM.",
    corpo: ConjuntosSchema,
    resposta: EstadoDoJogoSchema,
    notas: [
      "Só com o relógio da turma ABERTO e a tentativa em curso, como uma pergunta: antes da largada `relogio-nao-comecou`, depois do fim `relogio-encerrado`, depois de enviar `sessao-encerrada` (todos **409**). Sem isso, chamar a rota direto fabricava o \"pediu dados\" depois da investigação.",
    ],
  })
  async conjuntos(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { conjuntos } = this.valida(ConjuntosSchema, corpo);
    rateLimit(`unoogpt:conjuntos:${estudanteId}`, 60, 60_000);
    return this.service.carregarConjuntos(escolaId, estudanteId, conjuntos);
  }

  /** Alocar pelo mapa. `bairro: null` tira a equipe do destino. */
  @Post("alocacao")
  @Contrato({
    resumo: "Manda uma equipe para um bairro.",
    descricao:
      "`bairro: null` tira a equipe do destino. A justificativa é **portão de servidor**: só vale fonte que o estudante carregou, ou \"foi intuição\" — que está sempre disponível, porque sem essa saída a pergunta vira pegadinha e o estudante aprende a mentir para o formulário.",
    corpo: AlocacaoSchema,
    resposta: AlocacaoFeitaSchema,
  })
  async alocacao(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const dados = this.valida(AlocacaoSchema, corpo);
    rateLimit(`unoogpt:alocacao:${estudanteId}`, 60, 60_000);
    return this.service.alocar(
      escolaId,
      estudanteId,
      dados.equipe,
      dados.bairro,
      dados.justificativa ?? null,
    );
  }

  /** "Enviar equipes": congela a saída e abre o registro da operação (ADR-172). */
  @Post("mandar")
  @Contrato({
    resumo: "Manda as equipes: congela a saída e abre o registro da operação.",
    descricao:
      "Exige justificativa de **cada equipe com destino** — sem isso, `falta-justificar`; uma equipe na base é permitido, nenhuma com destino é `sem-destino`. A conversa com o Cientista NÃO manda: ela abre a tela deste botão (ADR-172). Devolve o REGISTRO DA OPERAÇÃO — o desfecho fica retido até ele (`GET /unoogpt/resultado` responde `registro-pendente`).",
    resposta: RegistroSchema,
  })
  async mandar(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    rateLimit(`unoogpt:simular:${estudanteId}`, 20, 60_000);
    return this.service.mandar(escolaId, estudanteId);
  }

  /** O ALIAS do cliente anterior ao registro. */
  @Post("simular")
  @Contrato({
    resumo: "Alias de `POST /mandar` para o cliente anterior ao registro (até a 1.4.x).",
    descricao:
      "Manda as equipes, fecha o registro da operação SEM tarefa e sem marca, e devolve o resultado como antes. Quem pula o registro por aqui só deixa de ser avaliado nele. Mesmo portão de `POST /mandar`.",
    resposta: ResultadoSchema,
  })
  async simular(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    rateLimit(`unoogpt:simular:${estudanteId}`, 20, 60_000);
    return this.service.simular(escolaId, estudanteId);
  }

  // ── o Canal A (ADR-172) ────────────────────────────────────────────────

  @Get("saude")
  @Contrato({
    resumo: "A ligação da Secretaria de Saúde: o estado do cartão.",
    descricao: "Sem gabarito: `entrega` é a consequência do pedido (a contagem; e, a quem pediu lista, o aviso de que os nomes ficaram no sistema).",
    resposta: SaudeSchema,
  })
  async saude(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    return this.canalA.saude(escolaId, estudanteId);
  }

  @Post("saude/abrir")
  @Contrato({
    resumo: "Faz a ligação da Saúde aparecer (ao abrir a decisão).",
    descricao: "O primeiro destino escolhido também a faz aparecer, no servidor. Uma vez por tentativa; só na investigação.",
    resposta: SaudeSchema,
  })
  async abrirSaude(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.abrirSaude(escolaId, estudanteId);
  }

  @Post("saude")
  @Contrato({
    resumo: "Responde à ligação da Saúde.",
    descricao: "`opcao: null` = fechou o cartão sem responder (sem marca). Vale a primeira resposta da tentativa; a marca, a primeira da rodada da turma.",
    corpo: SaudeRespostaSchema,
    resposta: SaudeSchema,
  })
  async responderSaude(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { opcao } = this.valida(SaudeRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderSaude(escolaId, estudanteId, opcao);
  }

  @Get("registro")
  @Contrato({
    resumo: "O registro da operação: a leitura dos dados, as fontes e o alerta.",
    descricao: "Montado no servidor e gravado (um F5 mostra o mesmo). Sem relógio e sem gabarito. Cada cartão é `null` quando não se aplica.",
    resposta: RegistroSchema,
  })
  async registro(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    return this.canalA.registro(escolaId, estudanteId);
  }

  @Post("registro/leitura")
  @Contrato({ resumo: "Responde à leitura dos dados (dois pares).", corpo: LeituraRespostaSchema, resposta: RegistroSchema })
  async registroLeitura(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { respostas } = this.valida(LeituraRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderLeitura(escolaId, estudanteId, respostas);
  }

  @Post("registro/fontes")
  @Contrato({ resumo: "Responde ao que precisaria saber de cada fonte (dois cartões).", corpo: FontesRespostaSchema, resposta: RegistroSchema })
  async registroFontes(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { respostas } = this.valida(FontesRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderFontes(escolaId, estudanteId, respostas);
  }

  @Post("registro/alerta")
  @Contrato({ resumo: "Monta o alerta para os bairros sem equipe.", corpo: AlertaRespostaSchema, resposta: RegistroSchema })
  async registroAlerta(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const respostas = this.valida(AlertaRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderAlerta(escolaId, estudanteId, respostas);
  }

  @Get("e-se")
  @Contrato({
    resumo: "\"E se…\": duas outras decisões nas mesmas 20 tempestades.",
    descricao: "Montadas pelo servidor (uma clara e uma que depende), em ordem embaralhada. Só com o registro feito.",
    resposta: ESeSchema,
  })
  async eSe(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    return this.canalA.eSe(escolaId, estudanteId);
  }

  @Post("e-se")
  @Contrato({ resumo: "Responde às duas comparações do \"E se…\".", corpo: ESeRespostaSchema, resposta: ESeSchema })
  async responderESe(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { respostas } = this.valida(ESeRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderESe(escolaId, estudanteId, respostas);
  }

  @Get("fechamento")
  @Contrato({
    resumo: "O fechamento: o pedido pelo WhatsApp e a resposta à moradora.",
    descricao: "**409 `fechamento-fechado`** enquanto o professor não abrir (`POST /unoogpt/professor/turmas/:turmaId/relogio` com `abrir-fechamento`).",
    resposta: FechamentoSchema,
  })
  async fechamento(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    return this.canalA.fechamento(escolaId, estudanteId);
  }

  @Post("fechamento/whatsapp")
  @Contrato({ resumo: "Responde ao pedido pelo WhatsApp.", corpo: WhatsappRespostaSchema, resposta: FechamentoSchema })
  async fechamentoWhatsapp(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { resposta, aviso } = this.valida(WhatsappRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderWhatsapp(escolaId, estudanteId, resposta, aviso);
  }

  @Post("fechamento/moradora")
  @Contrato({ resumo: "Monta a resposta à moradora.", corpo: MoradoraRespostaSchema, resposta: FechamentoSchema })
  async fechamentoMoradora(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const respostas = this.valida(MoradoraRespostaSchema, corpo);
    rateLimit(`unoogpt:canal-a:${estudanteId}`, 60, 60_000);
    return this.canalA.responderMoradora(escolaId, estudanteId, respostas);
  }

  @Get("resultado")
  @Contrato({
    resumo: "O resultado da tentativa, com a faixa e o que ele nunca consultou.",
    descricao:
      "A **faixa é a manchete**: corridas da MESMA decisão, para \"não repete igual\" sair do texto e virar gráfico. Uma rodada é anedota — o estudante lê 1.345 e conclui que tirou uma nota.",
    resposta: ResultadoSchema,
    notas: [
      "`sobrou` é um FATO com nome de bairro e número de pessoas, **não um veredito**: quem transforma fato em lição é o professor, no debate.",
      "`naoConsultados` traz só `comoFalar`/`rotuloCurto`/`serve` — o nome técnico, o viés e a cobertura são o instrumento, e ficam com o professor.",
    ],
  })
  async resultado(@Req() req: { auth: AuthClaims }) {
    const { escolaId, estudanteId } = this.quem(req);
    return this.service.resultado(escolaId, estudanteId);
  }

  /** "E se eu tivesse mandado para…". Não grava e não debita. */
  @Post("contrafactual")
  @Contrato({
    resumo: "\"E se eu tivesse mandado para…\" — calculado e descartado.",
    descricao:
      "**Não grava e não debita**: é a pergunta que o estudante faz ao VER o resultado, e transformá-la em tentativa nova apagaria a diferença entre a decisão que ele tomou e a que ele imaginou depois.\n\n**Pareado:** a decisão do estudante (`sua`) e a outra rodam nas MESMAS 200 tempestades, com a mesma sorte da operação em cada uma; `comparacao` conta em quantas a outra resgatou mais, menos ou igual.",
    corpo: ContrafactualSchema,
    resposta: ContrafactualRespostaSchema,
  })
  async contrafactual(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const dados = this.valida(ContrafactualSchema, corpo);
    rateLimit(`unoogpt:contrafactual:${estudanteId}`, 40, 60_000);
    return this.service.contrafactual(escolaId, estudanteId, dados);
  }

  @Post("passo")
  @Contrato({
    resumo: "Move a sessão para outro passo da missão.",
    corpo: PassoSchema,
    resposta: SoASessaoSchema,
  })
  async passo(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    const { para } = this.valida(PassoSchema, corpo);
    return this.service.irParaPasso(escolaId, estudanteId, para);
  }

  /** Recomeçar abre tentativa NOVA — não apaga a conversa anterior. */
  @Post("reiniciar")
  @Contrato({
    resumo: "Recomeça — abre uma tentativa NOVA.",
    descricao:
      "**Não apaga a conversa anterior.** Cada tentativa fica no resultado com o desfecho e a faixa DELA: é essa comparação que ensina que a mesma cidade dá números diferentes.\n\nO clique fica gravado na tentativa que fecha (marco `recomeco`), com o relógio da turma naquele instante. `origem` diz qual botão — é a única parte que só o cliente sabe.",
    corpo: ReinicioSchema,
    resposta: SoASessaoSchema,
  })
  async reiniciar(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, estudanteId } = this.quem(req);
    // Corpo vazio é válido: cliente anterior a `origem` não manda nada.
    const { origem } = this.valida(ReinicioSchema, corpo ?? {});
    rateLimit(`unoogpt:reiniciar:${estudanteId}`, 10, 60_000);
    return this.service.reiniciar(escolaId, estudanteId, origem ?? null);
  }
}

/** Exportado só para o teste conferir que nenhuma rota nova escapou do Zod. */
export const ROTAS_DO_ESTUDANTE = [
  "sessao",
  "relogio",
  "pergunta",
  "conjuntos",
  "alocacao",
  "mandar",
  "simular",
  "saude",
  "saude/abrir",
  "registro",
  "registro/leitura",
  "registro/fontes",
  "registro/alerta",
  "e-se",
  "fechamento",
  "fechamento/whatsapp",
  "fechamento/moradora",
  "resultado",
  "contrafactual",
  "passo",
  "reiniciar",
] as const;

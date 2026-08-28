import { Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { erroDeJogo } from "./erros";
import { Contrato } from "../openapi/contrato";
import {
  AlocacaoFeitaSchema,
  AlocacaoSchema,
  ConjuntosSchema,
  ContrafactualRespostaSchema,
  ContrafactualSchema,
  EstadoDoJogoSchema,
  PassoSchema,
  PerguntaSchema,
  RelogioDoAlunoSchema,
  ResultadoSchema,
  SessaoDoAlunoSchema,
  SoASessaoSchema,
  TurnoDoCientistaSchema,
} from "./contrato-de-rotas";
import { UnoogptService } from "./unoogpt.service";

/**
 * As rotas do ALUNO na Missão Tempestade.
 *
 * Note o que NÃO existe aqui: id de sessão. No projeto de origem toda rota era
 * `/api/missao/:id/*` e havia a guarda `donoDaSessao` para provar a posse; aqui
 * a identidade é `(escola, aluno)` vinda do TOKEN, e não há como pedir a sessão
 * de outra pessoa. A guarda desapareceu junto com a classe de bug que ela
 * protegia.
 *
 * Zod em TODO input externo, declarado aqui e nunca no service. Rate limit por
 * USUÁRIO, nunca por IP: a turma inteira sai pelo mesmo NAT da escola.
 */
@Controller("unoogpt")
@UseGuards(OidcGuard, RolesGuard)
@Roles("aluno")
export class UnoogptController {
  constructor(private readonly service: UnoogptService) {}

  /**
   * Quem está falando. Vem SÓ do token — nunca do corpo da requisição: aceitar
   * `alunoId` do cliente seria deixar uma aba pedir a partida de outra pessoa.
   */
  private quem(req: { auth: AuthClaims }) {
    const { usuarioId, escolaId, perfil } = req.auth;
    // Aluno sem escola não existe: escola vazia é exclusividade do
    // admin-contrato, e ele não joga.
    if (!escolaId) throw erroDeJogo("sessao-encerrada");
    return { alunoId: usuarioId, escolaId, perfil };
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
      "Repare no que NÃO existe nestas rotas: **id de sessão**. No app de origem toda rota era `/api/missao/:id/*` com uma guarda `donoDaSessao` para provar a posse; aqui a identidade é `(escola, aluno)` vinda do TOKEN, e não há como pedir a partida de outra pessoa. A guarda desapareceu junto com a classe de bug que ela protegia.",
    resposta: SessaoDoAlunoSchema,
    notas: [
      "A `projecao` é SERVIDA, nunca calculada no navegador: um bundle capaz de computá-la deixaria o aluno prever o desfecho antes de enviar.",
      "O mapa começa vazio: só o que uma Pergunta revelou chega ao navegador — `estimativa: null` é o cartão em branco, e **branco é informação**.",
      "A `ficha` sai por allowlist, sem os números por bairro: eles são a verdade do mundo, e mandá-los daria de graça a resposta que a missão existe para o aluno não ter.",
    ],
  })
  async sessao(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    return this.service.sessao(escolaId, alunoId);
  }

  /** Polling do relógio da turma (~5s). Leve: sem IA, sem mapa. */
  @Get("relogio")
  @Contrato({
    resumo: "O relógio da turma — polling de ~5s.",
    descricao:
      "Leve de propósito: sem IA e sem mapa. `agora` é o instante do SERVIDOR, senão o relógio da máquina da escola (que atrasa) decide quanto tempo a turma tem.",
    resposta: RelogioDoAlunoSchema,
    notas: ["240 chamadas por minuto por aluno."],
  })
  async relogio(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    rateLimit(`unoogpt:relogio:${alunoId}`, 240, 60_000);
    return this.service.relogio(escolaId, alunoId);
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
      "Falha do PROVEDOR **não** chega ao aluno como 500: vira `cientista-indisponivel` (**503**), que a tela traduz em \"tente falar de novo\". E **não debita** — o débito acontece só depois de resposta válida.",
      "O log fica com o motivo técnico, **sem o texto do aluno**: é caixa livre escrita por menor de idade.",
      "O número que um botão de opção mostra sai do MOTOR, nunca da LLM.",
    ],
  })
  async pergunta(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId, perfil } = this.quem(req);
    // 600 caracteres: o campo do chat, não um formulário. Acima disso não é
    // fala de aluno — é colagem, e ela infla o prompt de todo turno seguinte.
    const { texto } = this.valida(PerguntaSchema, corpo);
    rateLimit(`unoogpt:pergunta:${alunoId}`, 12, 60_000);
    return this.service.pergunta(escolaId, alunoId, perfil, texto);
  }

  /** Carregar fontes pelo painel. `PUT`: é atribuição de conjunto. */
  @Put("conjuntos")
  @Contrato({
    resumo: "Carrega fontes no modelo pelo painel.",
    descricao: "`PUT` porque é atribuição de conjunto. As camadas ACUMULAM.",
    corpo: ConjuntosSchema,
    resposta: EstadoDoJogoSchema,
  })
  async conjuntos(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const { conjuntos } = this.valida(ConjuntosSchema, corpo);
    rateLimit(`unoogpt:conjuntos:${alunoId}`, 60, 60_000);
    return this.service.carregarConjuntos(escolaId, alunoId, conjuntos);
  }

  /** Alocar pelo mapa. `bairro: null` tira a equipe do destino. */
  @Post("alocacao")
  @Contrato({
    resumo: "Manda uma equipe para um bairro.",
    descricao:
      "`bairro: null` tira a equipe do destino. A justificativa é **portão de servidor**: só vale fonte que o aluno carregou, ou \"foi intuição\" — que está sempre disponível, porque sem essa saída a pergunta vira pegadinha e o aluno aprende a mentir para o formulário.",
    corpo: AlocacaoSchema,
    resposta: AlocacaoFeitaSchema,
  })
  async alocacao(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const dados = this.valida(AlocacaoSchema, corpo);
    rateLimit(`unoogpt:alocacao:${alunoId}`, 60, 60_000);
    return this.service.alocar(
      escolaId,
      alunoId,
      dados.equipe,
      dados.bairro,
      dados.justificativa ?? null,
    );
  }

  /** Enfrentar a tempestade. Exige justificativa de cada equipe com destino. */
  @Post("simular")
  @Contrato({
    resumo: "Enfrenta a tempestade e fecha a tentativa.",
    descricao:
      "Exige justificativa de **cada equipe com destino** — sem isso, `falta-justificar`. Devolve o mesmo que `GET /unoogpt/resultado`.",
    resposta: ResultadoSchema,
  })
  async simular(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    rateLimit(`unoogpt:simular:${alunoId}`, 20, 60_000);
    return this.service.simular(escolaId, alunoId);
  }

  @Get("resultado")
  @Contrato({
    resumo: "O resultado da tentativa, com a faixa e o que ele nunca consultou.",
    descricao:
      "A **faixa é a manchete**: corridas da MESMA decisão, para \"não repete igual\" sair do texto e virar gráfico. Uma rodada é anedota — o aluno lê 1.345 e conclui que tirou uma nota.",
    resposta: ResultadoSchema,
    notas: [
      "`sobrou` é um FATO com nome de bairro e número de pessoas, **não um veredito**: quem transforma fato em lição é o professor, no debate.",
      "`naoConsultados` traz só `comoFalar`/`rotuloCurto`/`serve` — o nome técnico, o viés e a cobertura são o instrumento, e ficam com o professor.",
    ],
  })
  async resultado(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    return this.service.resultado(escolaId, alunoId);
  }

  /** "E se eu tivesse mandado para…". Não grava e não debita. */
  @Post("contrafactual")
  @Contrato({
    resumo: "\"E se eu tivesse mandado para…\" — calculado e descartado.",
    descricao:
      "**Não grava e não debita**: é a pergunta que o aluno faz ao VER o resultado, e transformá-la em tentativa nova apagaria a diferença entre a decisão que ele tomou e a que ele imaginou depois.",
    corpo: ContrafactualSchema,
    resposta: ContrafactualRespostaSchema,
  })
  async contrafactual(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const dados = this.valida(ContrafactualSchema, corpo);
    rateLimit(`unoogpt:contrafactual:${alunoId}`, 40, 60_000);
    return this.service.contrafactual(escolaId, alunoId, dados);
  }

  @Post("passo")
  @Contrato({
    resumo: "Move a sessão para outro passo da missão.",
    corpo: PassoSchema,
    resposta: SoASessaoSchema,
  })
  async passo(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const { para } = this.valida(PassoSchema, corpo);
    return this.service.irParaPasso(escolaId, alunoId, para);
  }

  /** Recomeçar abre tentativa NOVA — não apaga a conversa anterior. */
  @Post("reiniciar")
  @Contrato({
    resumo: "Recomeça — abre uma tentativa NOVA.",
    descricao:
      "**Não apaga a conversa anterior.** Cada tentativa fica no resultado com o desfecho e a faixa DELA: é essa comparação que ensina que a mesma cidade dá números diferentes.",
    resposta: SoASessaoSchema,
  })
  async reiniciar(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    rateLimit(`unoogpt:reiniciar:${alunoId}`, 10, 60_000);
    return this.service.reiniciar(escolaId, alunoId);
  }
}

/** Exportado só para o teste conferir que nenhuma rota nova escapou do Zod. */
export const ROTAS_DO_ALUNO = [
  "sessao",
  "relogio",
  "pergunta",
  "conjuntos",
  "alocacao",
  "simular",
  "resultado",
  "contrafactual",
  "passo",
  "reiniciar",
] as const;

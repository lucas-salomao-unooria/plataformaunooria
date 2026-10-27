import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { AssistenteInvisivelService } from "./assistente-invisivel.service";
import {
  AlgoritmoSchema,
  ApostaSchema,
  CartoesSchema,
  CriteriosSchema,
  DaTelaSchema,
  EstadoSchema,
  GateDoEstudanteSchema,
  NavegarSchema,
  PublicarSchema,
  RespostaDoRetesteSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp01em1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Muitas ações em pouco tempo. Aguarde um instante." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo ?? {});
  if (!r.success) throw erroDeJogo("payload-invalido");
  return r.data as z.output<S>;
}

const NOTA_DA_PORTA =
  "A porta da sala (ADR-69) e a disponibilidade (ADR-87) valem aqui: turma sem a missão liberada responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`).";
const NOTA_SEM_PACOTE = "Sem pacote no ar responde **409** `missao-em-preparo` — espera, não bloqueio.";
const NOTA_DO_PASSO =
  "Jogada à frente do passo: **409** `passo-invalido`; no passo certo com a turma ainda não liberada: **409** `aguardando-professor`. Repetir uma jogada já feita devolve o estado atual (200). `atividade` (opcional) diferente da do servidor: **409** `rodada-mudou`.";

/**
 * Rotas do ESTUDANTE da exp01em1b — O Assistente Invisível (ADR-185).
 *
 * O gabarito fica no servidor (regra 3): a tela manda a aposta, os cartões, os
 * passos, os critérios e os blocos; é o servidor que diz o resultado do
 * reteste e o que conta para a régua. A identidade — inclusive a TURMA — sai
 * do token e do banco. A guarda de liberação está no FUNIL do service. Não há
 * texto livre de estudante nem IA na aula.
 */
@Controller("assistente-invisivel")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class AssistenteInvisivelController {
  constructor(private readonly missao: AssistenteInvisivelService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão, o pacote no ar, o material fixo (sem o gabarito) e o medidor da turma.",
    descricao:
      "`passo` é DERIVADO no servidor: `boas-vindas → funcoes → aposta → simulacao → confronto → fichas → classificacao → algoritmo → criterios → reteste → publicacao → concluida`. `aguardandoProfessor` é a camada de espera por cima do passo (as travas e as pausas da turma).\n\nCom pacote no ar, a sessão desta rodada NASCE aqui (idempotente) — é ela que o 100% da E3 conta. O medidor só desce depois da aposta da própria unidade, e só com 3 apostas ou mais na rodada.",
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Sem pacote no ar: `preparada: false`, `pacote: null` e a tela é de espera."],
  })
  sessao(@Req() req: Autenticado) {
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Get("gate")
  @Contrato({
    resumo: "A fase da turma, a rodada, o passo, a espera e o medidor (polling de 3 s).",
    descricao: "**Polling HTTP, nunca WebSocket** (ADR-93). Read-only. A `fase` muda quando o professor libera ou pausa; a `rodada` sobe quando ele zera.",
    resposta: GateDoEstudanteSchema,
    notas: [NOTA_DA_PORTA],
  })
  gate(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("iniciar")
  @HttpCode(200)
  @Contrato({ resumo: 'E1 "Abrir Módulo de Teste" — só com a turma liberada ("Liberar Início dos Testes").', corpo: DaTelaSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DO_PASSO] })
  iniciar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.iniciar(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("navegar")
  @HttpCode(200)
  @Contrato({ resumo: 'E2 "Ir para Bateria de Testes": as funções expandidas (pelo menos uma).', corpo: NavegarSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DO_PASSO] })
  navegar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const c = valida(NavegarSchema, corpo);
    return this.missao.navegar(req.auth.escolaId, req.auth.usuarioId, c, c.abertas);
  }

  @Post("aposta")
  @HttpCode(200)
  @Contrato({
    resumo: 'E3 "Disparar Simulação" — o LATCH 1 ("Previsão arquivada").',
    descricao: "Irreversível. Depois dela a tela espera \"Liberar Início da Simulação\" (a turma em `simulacao`).",
    corpo: ApostaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "A mesma aposta de novo é idempotente; outra é **409** `ja-apostou`."],
  })
  aposta(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const c = valida(ApostaSchema, corpo);
    return this.missao.apostar(req.auth.escolaId, req.auth.usuarioId, c, c.aposta);
  }

  @Post("simulacao/concluir")
  @HttpCode(200)
  @Contrato({ resumo: "E4-ALU-01: as três sessões de chat terminaram.", corpo: DaTelaSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_DO_PASSO] })
  concluirSimulacao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluirSimulacao(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("fichas/abrir")
  @HttpCode(200)
  @Contrato({ resumo: 'E4-ALU-02 "Abrir Fichas de Auditoria de Acesso".', corpo: DaTelaSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_DO_PASSO] })
  abrirFichas(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.abrirFichas(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("inspecao/concluir")
  @HttpCode(200)
  @Contrato({
    resumo: 'E4-ALU-03 "Concluir Inspeção de Metadados" — depois dela, a Trava 1.',
    corpo: DaTelaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO],
  })
  concluirInspecao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluirInspecao(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("cartoes")
  @HttpCode(200)
  @Contrato({
    resumo: "E5-ALU-01: a alocação dos 6 cartões (incompleta vale).",
    descricao: "A resposta traz `classificacao.cadeiaCausal` (a tabela causal aparece); os acertos ficam no servidor.",
    corpo: CartoesSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO],
  })
  cartoes(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const c = valida(CartoesSchema, corpo);
    return this.missao.classificar(req.auth.escolaId, req.auth.usuarioId, c, c.classificacao);
  }

  @Post("algoritmo/abrir")
  @HttpCode(200)
  @Contrato({ resumo: 'E5-ALU-02: abriu o "[Opcional / Aprofundamento]" (o PQ-04). Idempotente.', corpo: DaTelaSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_DO_PASSO] })
  abrirAlgoritmo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.abrirAlgoritmo(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("algoritmo/marcar")
  @HttpCode(200)
  @Contrato({
    resumo: "E5-ALU-02: os passos marcados como dispensáveis — repetível até \"Pular Etapa\".",
    corpo: AlgoritmoSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "Sem abrir o painel: **409** `passo-invalido`."],
  })
  marcarAlgoritmo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    const c = valida(AlgoritmoSchema, corpo);
    return this.missao.marcarAlgoritmo(req.auth.escolaId, req.auth.usuarioId, c, c.marcados);
  }

  @Post("algoritmo/concluir")
  @HttpCode(200)
  @Contrato({ resumo: 'E5-ALU-02 "Pular Etapa": sai do painel opcional, tenha marcado ou não.', corpo: DaTelaSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_DO_PASSO] })
  concluirAlgoritmo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluirAlgoritmo(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("criterios")
  @HttpCode(200)
  @Contrato({
    resumo: 'E5-ALU-03 "Executar Novo Teste de Homologação": o reteste.',
    descricao:
      '`reteste.equidade`: `total` = "Homologação Aprovada"; `parcial`/`nenhuma` = "Alerta de Viés Mantido". `beatrizAvancada`/`thiagoLivre` = o que muda no chat do reteste.',
    corpo: CriteriosSchema,
    resposta: RespostaDoRetesteSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, 'A mesma configuração de novo devolve o último resultado; outra sem "Revisar Critérios" é **409** `passo-invalido`.'],
  })
  criterios(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const c = valida(CriteriosSchema, corpo);
    return this.missao.retestar(req.auth.escolaId, req.auth.usuarioId, c, c.criterios);
  }

  @Post("reteste/revisar")
  @HttpCode(200)
  @Contrato({ resumo: 'E5-ALU-04 "Revisar Critérios": de volta ao banco até o próximo reteste.', corpo: DaTelaSchema, resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_DO_PASSO] })
  revisar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.revisar(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("reteste/avancar")
  @HttpCode(200)
  @Contrato({
    resumo: 'E5-ALU-04 "Avançar para Homologação e Transparência" / "Avançar para Publicação" — depois dele, a Trava 2.',
    corpo: DaTelaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO],
  })
  avancar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.avancar(req.auth.escolaId, req.auth.usuarioId, valida(DaTelaSchema, corpo));
  }

  @Post("publicar")
  @HttpCode(200)
  @Contrato({
    resumo: 'E6 "Publicar Transparência e Comunicado" — o LATCH 2, que conclui.',
    descricao: "Sempre habilitado (bloco em branco publica). Marca as quatro habilidades (EM13CO20, EM13CO01, EM13CO18, EM13CO03) na mesma transação.",
    corpo: PublicarSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "A mesma publicação de novo é idempotente; outra é **409** `ja-publicado`."],
  })
  publicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const c = valida(PublicarSchema, corpo);
    return this.missao.publicar(req.auth.escolaId, req.auth.usuarioId, c, c.paginaAtiva, c.comunicado);
  }
}

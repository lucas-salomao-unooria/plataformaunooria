import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import { AssistenteInvisivelService } from "./assistente-invisivel.service";
import {
  EditarItemSchema,
  EmAndamentoSchema,
  EncerrarRespostaSchema,
  GateDaTurmaSchema,
  GateSchema,
  GerarRespostaSchema,
  GerarSchema,
  HomologarSchema,
  NovaRodadaRespostaSchema,
  NovaRodadaSchema,
  PacoteDaTurmaSchema,
  PacoteDoProfessorSchema,
  PacotesDaTurmaSchema,
  PainelSchema,
  ParamsDaTurmaSchema,
  PacoteDetalheSchema,
  ParamsDoPacoteSchema,
  QueryDaEscolaSchema,
  RascunhoSchema,
  RegenerarItemSchema,
  TurmasSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

function turmaDoCaminho(turmaId: string): string {
  const r = ParamsDaTurmaSchema.safeParse({ turmaId });
  if (!r.success) throw new BadRequestException({ codigo: "turma-nao-encontrada", mensagem: "Turma inválida." });
  return r.data.turmaId;
}

function pacoteDoCaminho(pacoteId: string): string {
  const r = ParamsDoPacoteSchema.shape.pacoteId.safeParse(pacoteId);
  if (!r.success) throw erroDeJogo("atividade-nao-encontrada");
  return r.data;
}

/** O corpo validado, ou 400 com o código da rota e TODAS as frases (é o professor quem lê). */
function corpoDe<S extends z.ZodTypeAny>(schema: S, corpo: unknown, codigo: "pacote-invalido" | "preparo-invalido" | "payload-invalido"): z.output<S> {
  const r = schema.safeParse(corpo ?? {});
  if (!r.success) {
    throw erroDeJogo(codigo, [...new Set(r.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`))]);
  }
  return r.data as z.output<S>;
}

/** As rotas que gastam IA: um teto por professor, além da quota do perfil. */
function limitarIa(usuarioId: string) {
  const r = rateLimit(`exp01em1b-ia:${usuarioId}`, 20, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Muitas gerações em pouco tempo. Aguarde um instante." }, 429);
}

const NOTA_DO_404 =
  "Turma em que o professor não tem matrícula responde **404** `turma-nao-encontrada`, não 403: um \"sem permissão\" já contaria que a turma existe.";
const NOTA_DO_RASCUNHO =
  "`rascunhoId` é o rascunho que o professor VIU: outro é **409** `rascunho-desatualizado`; sem rascunho, **404** `rascunho-nao-encontrado`.";

/**
 * A exp01em1b do lado de quem dá aula. Gestor e admin LEEM; quem PREPARA e
 * CONDUZ é só quem tem matrícula de professor na turma. `@Roles` por MÉTODO.
 */
@Controller("assistente-invisivel/turmas")
@UseGuards(OidcGuard, RolesGuard)
export class AssistenteInvisivelTurmasController {
  constructor(private readonly missao: AssistenteInvisivelService) {}

  @Get()
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "Turmas para o seletor.",
    descricao: "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. `gestor_contrato` precisa dizer `?escolaId=`.",
    query: QueryDaEscolaSchema,
    resposta: TurmasSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O pacote da turma: o em andamento e o rascunho da curadoria (com os itens editados), e as disciplinas do recorte.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PacoteDaTurmaSchema,
    notas: [NOTA_DO_404],
  })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacoteDaTurma(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Gerar Cenários de Teste com IA" (E0-PROF-02/03): o RASCUNHO do pacote inteiro.',
    descricao:
      "Quota do PERFIL `professor` (regra 5): `temSaldo` ANTES e o que o vendor cobrou debitado depois. A IA escreve as trilhas, as cinco dúvidas, as cinco respostas do assistente e a leitura; a saída passa pela mesma régua da homologação (que recusa horário, madrugada, noite, conexão, sinal, internet e rede). Sem saldo (`motivo: \"sem-saldo\"`) ou com o vendor fora (`motivo: \"indisponivel\"`), o rascunho é o banco padrão de Língua Portuguesa com `contingencia: true` (`usouIa: false`). Gerar de novo substitui o rascunho. **Não aprova.**",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GerarSchema,
    resposta: GerarRespostaSchema,
    notas: [NOTA_DO_404 + " A turma é conferida ANTES de gastar token.", "Recorte fora da régua: **400** `preparo-invalido` com `erros`."],
  })
  gerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const recorte = corpoDe(GerarSchema, corpo, "preparo-invalido");
    limitarIa(req.auth.usuarioId);
    return this.missao.gerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, req.auth.perfil, recorte);
  }

  @Post(":turmaId/rascunho/regenerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Regenerar Este Item" (E0-PROF-04): a IA reescreve UM item do rascunho.',
    descricao:
      "A mesma quota do `gerar-conteudo`. O pacote inteiro, com o item novo, passa pela régua. O item regenerado perde o \"Editado pelo professor\". Sem saldo: **429** `sem-saldo-de-ia`; com o vendor fora: **503** `ia-indisponivel` — e o rascunho fica como estava.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: RegenerarItemSchema,
    resposta: RascunhoSchema,
    notas: [NOTA_DO_404, NOTA_DO_RASCUNHO],
  })
  regenerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const pedido = corpoDe(RegenerarItemSchema, corpo, "payload-invalido");
    limitarIa(req.auth.usuarioId);
    return this.missao.regenerarItem(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, req.auth.perfil, pedido);
  }

  @Post(":turmaId/rascunho/editar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Editar Texto" (E0-PROF-04): o professor reescreve um item; ele ganha o "Editado pelo professor".',
    descricao: "`titulo` só nos itens que têm título (as trilhas e a leitura). O pacote inteiro passa pela régua.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: EditarItemSchema,
    resposta: RascunhoSchema,
    notas: [NOTA_DO_404, NOTA_DO_RASCUNHO, "Fora da régua: **400** `pacote-invalido` com `erros`."],
  })
  editar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const pedido = corpoDe(EditarItemSchema, corpo, "pacote-invalido");
    return this.missao.editarItem(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pedido);
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Aprovar Pacote Homologado": o rascunho vira uma atividade PRONTA (não no ar).',
    descricao: "O duplo clique devolve o mesmo pacote. Para pôr no ar (\"Liberar Atividade para a Turma\"): `pacotes/:pacoteId/em-andamento`.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: HomologarSchema,
    resposta: PacoteDoProfessorSchema,
    notas: [NOTA_DO_404, NOTA_DO_RASCUNHO, "Fora da régua: **400** `pacote-invalido` com `erros`."],
  })
  homologar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const pedido = corpoDe(HomologarSchema, corpo, "pacote-invalido");
    return this.missao.homologar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pedido);
  }

  @Post(":turmaId/banco-padrao")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Usar Banco Padrão da Rede" — aprova e põe no ar o pacote padrão, num toque.',
    descricao: "O caminho curto (§9a): sem IA, numa transação, sem tocar no rascunho. O mesmo padrão já aprovado nesta turma é reusado. Idempotente.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: EmAndamentoSchema,
    notas: [NOTA_DO_404],
  })
  bancoPadrao(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.usarBancoPadrao(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId);
  }

  @Get(":turmaId/historico")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "As atividades da turma: os pacotes aprovados, com o em andamento.", params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, resposta: PacotesDaTurmaSchema, notas: [NOTA_DO_404] })
  historico(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.historico(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "UMA atividade da turma, inteira (a aba Conteúdo, mesmo fora do ar).", params: ParamsDoPacoteSchema, query: QueryDaEscolaSchema, resposta: PacoteDetalheSchema, notas: [NOTA_DO_404] })
  pacoteDetalhe(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacote(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth), pacoteDoCaminho(pacoteId));
  }

  @Post(":turmaId/pacotes/:pacoteId/em-andamento")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Liberar Atividade para a Turma" (E0-PROF-05) — o pacote que a turma usa (ADR-130).',
    descricao: "A fase volta a `aguardando-inicio`; o pacote que já rodou abre a rodada seguinte.",
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    resposta: EmAndamentoSchema,
    notas: [NOTA_DO_404, "**Idempotente**: pôr no ar o que já está no ar devolve `mudou: false`."],
  })
  emAndamento(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.colocarEmAndamento(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacoteDoCaminho(pacoteId));
  }

  @Get(":turmaId/painel")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel da aula ao vivo e o relatório formativo: por estudante (ou computador), o resumo e o roteiro.",
    descricao:
      "Por linha: o passo e a espera, a aposta, a simulação, os cartões (acertos), o painel opcional, os critérios, o reteste, o Aviso Discreto, a publicação (com o comunicado em texto corrido e o alinhamento) e os níveis das quatro habilidades. `resumo.todosApostaram` acende \"Liberar Início da Simulação\"; `faltamApostar` diz quem segura o botão.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PainelSchema,
    notas: [NOTA_DO_404],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "As cinco liberações e as duas pausas da aula — só para a frente.",
    descricao:
      "`aguardando-inicio → testes → simulacao → [debate-1] → explicar → [debate-2] → publicar` (as pausas são opcionais). Pedir a fase em que a turma já está é idempotente; cada mudança entra no histórico. `simulacao` exige que TODAS as sessões abertas da rodada tenham apostado.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      NOTA_DO_404,
      "Sem atividade no ar: **409** `pacote-nao-aprovado`. Transição para trás ou que pula etapa: **409** `transicao-de-etapa-invalida`. Simulação sem 100%: **409** `apostas-pendentes`.",
    ],
  })
  gate(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { para } = corpoDe(GateSchema, corpo, "payload-invalido");
    return this.missao.mudarGate(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, para);
  }

  @Post(":turmaId/encerrar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Encerrar": quem apostou e não publicou recebe as quatro marcas, sem a publicação.',
    descricao: "O padrão \"conta ao encerrar\" (ADR-154): a EM13CO20 vira \"não atingiu\"; as outras seguem a régua com o que a sessão fez. Repetir é inofensivo (vale a melhor marca).",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: EncerrarRespostaSchema,
    notas: [NOTA_DO_404, "Sem atividade no ar: **409** `pacote-nao-aprovado`."],
  })
  encerrar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.encerrar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId);
  }

  @Post(":turmaId/zerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Zerar Turma para Nova Aplicação" — a rodada seguinte, a evidência do pacote apagada (ADR-155) e a fase de volta ao início.',
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: NovaRodadaSchema,
    resposta: NovaRodadaRespostaSchema,
    notas: [NOTA_DO_404, "Rodada que não é nem a atual nem a anterior: **409** `rodada-desatualizada`."],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { rodada } = corpoDe(NovaRodadaSchema, corpo, "payload-invalido");
    return this.missao.novaRodada(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, rodada);
  }
}

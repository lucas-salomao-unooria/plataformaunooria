import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import type { ConteudoDoPacote } from "./conteudo";
import {
  AncorasSchema,
  DecisaoSchema,
  MensagemSchema,
  ParamsDaTurmaSchema,
  ParamsDoPacoteSchema,
  PilulaEntradaSchema,
  ProtocoloSchema,
  QueryDaEscolaSchema,
  RequisicaoEmAndamentoSchema,
  RequisicaoGateSchema,
  RequisicaoGerarRecorteSchema,
  RequisicaoHomologarSchema,
  RequisicaoRegenerarItemSchema,
  RequisicaoZerarSchema,
  RespostaEmAndamentoSchema,
  RespostaGateSchema,
  RespostaGerarConteudoSchema,
  RespostaHomologarPacoteSchema,
  RespostaListarPacotesSchema,
  RespostaMaterialProfessorSchema,
  RespostaPacoteSchema,
  RespostaPainelSchema,
  RespostaZerarSchema,
  SessaoSchema,
  problemasDoRecorte,
} from "./contrato-de-rotas";
import { DossieInvisivelService } from "./dossie-invisivel.service";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp09ef1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ codigo: "muitas-requisicoes", mensagem: "Muitos comandos enviados. Aguarde alguns segundos." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo ?? {});
  if (!r.success) throw erroDeJogo("payload-invalido");
  return r.data as z.output<S>;
}

const NOTA_DA_PORTA =
  "A porta da sala (ADR-69) e a disponibilidade (ADR-87) valem aqui: turma sem a missão liberada responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`).";
const NOTA_SEM_PACOTE = "Sem pacote no ar responde **409** `atividade-nao-preparada` — espera, não bloqueio.";

/**
 * Rotas do ESTUDANTE da exp09ef1b — O Dossiê Invisível (ADR-202). O gabarito
 * fica no servidor: o cliente manda o que o estudante escreveu, escolheu ou
 * arrastou, e o servidor decide o que aquilo mediu (regra 3). A identidade —
 * inclusive a TURMA — sai do token e do banco. A guarda de liberação está no
 * FUNIL do service. Toda rota devolve a MESMA `SessaoSchema`.
 */
@Controller("dossie-invisivel")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class DossieInvisivelController {
  constructor(private readonly missao: DossieInvisivelService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão e o polling das travas (~3 s).",
    descricao:
      "`passo` é DERIVADO no servidor: `abertura → conversa → espera1 → revelacao → espera2 → explicar → concluida`. `revotoAberto` é a trava do debate (o 2º voto). Os cadernos só descem depois de digitalizados; o banco do protocolo desce embaralhado e sem gabarito.",
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Sem pacote no ar: `preparada: false` e a tela é de espera."],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("sessao/entrar")
  @HttpCode(200)
  @Contrato({ resumo: '"Começar Análise": abre a sessão desta rodada (E1 → E2). Idempotente.', resposta: SessaoSchema, notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE] })
  entrar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.entrar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("sessao/mensagem")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma pergunta ao assistente do conselho (E2): a IA classifica, a árvore é a reserva, a fala é do catálogo.",
    descricao:
      "A mensagem vai PRIMEIRO ao classificador de IA (quota do estudante, teto de 5 s, confiança mínima de 0,7), que devolve uma intenção da lista fechada; sem IA, vale a árvore de intenções do banco 01e. As três sugestões da copy e o texto que tenta mandar no classificador nunca vão à IA. A pergunta que desconfia da falta de registros do projeto em papel recebe a oferta dos cadernos. O texto do estudante é de menor: fica na sessão e não vai a painel, telemetria nem log.",
    corpo: MensagemSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, "Depois da 5ª mensagem: **409** `limite-do-chat`. Depois da escolha: **409** `ja-decidido`."],
  })
  mensagem(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 30);
    const { texto } = valida(MensagemSchema, corpo);
    return this.missao.mensagem(req.auth.escolaId, req.auth.usuarioId, texto);
  }

  @Post("sessao/ver-projetos")
  @HttpCode(200)
  @Contrato({ resumo: '"Ver Projetos": a lista dos inscritos, o parecer e a escolha liberada. Idempotente.', resposta: SessaoSchema, notas: [NOTA_DA_PORTA] })
  verProjetos(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.verProjetos(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("sessao/digitalizar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Digitalizar cadernos": o OCR. Na E2 depois da oferta (caminho A1); na E4 com a revelação liberada (B e A2). Idempotente.',
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Na E2 sem a oferta: **409** `escolha-nao-liberada`. Na E4 antes da trava: **409** `revelacao-nao-liberada`."],
  })
  digitalizar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.digitalizar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("sessao/decisao")
  @HttpCode(200)
  @Contrato({
    resumo: '"Registrar Decisão" — o latch 1: o projeto e o ranking dos três critérios. Marca a EF09CO08 de quem investigou.',
    corpo: DecisaoSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Antes de 3 consultas ou do \"Ver Projetos\": **409** `escolha-nao-liberada`. A mesma de novo é idempotente; outra, **409** `ja-decidido`."],
  })
  decisao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { projeto, ranking } = valida(DecisaoSchema, corpo);
    return this.missao.decidir(req.auth.escolaId, req.auth.usuarioId, projeto, ranking);
  }

  @Post("sessao/pilula")
  @HttpCode(200)
  @Contrato({ resumo: "Uma pílula dirigida da E4 (`custo` | `assinaturas`). Idempotente.", corpo: PilulaEntradaSchema, resposta: SessaoSchema, notas: [NOTA_DA_PORTA] })
  pilula(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { pilula } = valida(PilulaEntradaSchema, corpo);
    return this.missao.pilula(req.auth.escolaId, req.auth.usuarioId, pilula);
  }

  @Post("sessao/revoto")
  @HttpCode(200)
  @Contrato({
    resumo: '"Confirmar Decisão Final" — o latch 2, depois do debate: o projeto e o ranking. Marca a EF09CO08.',
    corpo: DecisaoSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Antes da trava do debate: **409** `revoto-nao-liberado`. Sem os cadernos ou sem pílula: **409**. A mesma de novo é idempotente; outra, **409** `ja-revotado`."],
  })
  revoto(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { projeto, ranking } = valida(DecisaoSchema, corpo);
    return this.missao.revotar(req.auth.escolaId, req.auth.usuarioId, projeto, ranking);
  }

  @Post("sessao/ancoras")
  @HttpCode(200)
  @Contrato({ resumo: "As âncoras marcadas no histórico (E5). Não é evidência.", corpo: AncorasSchema, resposta: SessaoSchema, notas: [NOTA_DA_PORTA] })
  ancoras(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { ancoras } = valida(AncorasSchema, corpo);
    return this.missao.marcarAncoras(req.auth.escolaId, req.auth.usuarioId, ancoras);
  }

  @Post("sessao/protocolo")
  @HttpCode(200)
  @Contrato({
    resumo: '"Enviar Proposta": o protocolo do assistente, que conclui a missão. Marca a EF09CO07.',
    descricao: "Sem trava no cliente (correção do PO de 29/10): qualquer composição com pelo menos um bloco na esteira entra; a régua ternária é do servidor e a resposta não diz se acertou.",
    corpo: ProtocoloSchema,
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Antes da trava do Explicar: **409** `explicar-nao-liberado`. O mesmo de novo é idempotente; outro depois de concluir, **409** `missao-concluida`."],
  })
  protocolo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const p = valida(ProtocoloSchema, corpo);
    return this.missao.enviarProtocolo(req.auth.escolaId, req.auth.usuarioId, p);
  }
}

// ─────────────────────────────────────────────────────────── o professor

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
    const custom = r.error.issues.filter((i) => i.code === "custom").map((i) => i.message);
    if (custom.length > 0 && codigo !== "payload-invalido") throw erroDeJogo(codigo, [...new Set(custom)]);
    throw erroDeJogo(codigo, r.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`));
  }
  return r.data as z.output<S>;
}

const NOTA_DO_404 = "Turma em que o professor não tem matrícula responde **404** `turma-nao-encontrada`, não 403.";

/**
 * A exp09ef1b do lado de quem dá aula. Gestor e admin LEEM; quem PREPARA e
 * CONDUZ é só quem tem matrícula de professor na turma. O preparo em 2
 * caminhos (one-pager §9a): o curto — `pacotes/padrao` (2 toques) —; e o da
 * IA — `gerar-conteudo` → `regenerar` → `homologar` → `em-andamento`. As três
 * travas: `gate` com `revelacao`, `revoto` e `explicar`.
 */
@Controller("dossie-invisivel/turmas")
@UseGuards(OidcGuard, RolesGuard)
export class DossieInvisivelTurmasController {
  constructor(private readonly missao: DossieInvisivelService) {}

  @Get(":turmaId/pacotes")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "Os pacotes da turma: o rascunho e os aprovados, o em andamento, o banco padrão e os componentes.", params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, resposta: RespostaListarPacotesSchema, notas: [NOTA_DO_404] })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacotes(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "UM pacote da turma (rascunho ou aprovado), inteiro.", params: ParamsDoPacoteSchema, query: QueryDaEscolaSchema, resposta: RespostaPacoteSchema, notas: [NOTA_DO_404] })
  pacote(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacote(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth), pacoteDoCaminho(pacoteId));
  }

  @Post(":turmaId/pacotes/gerar-conteudo")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Gerar com IA": o RASCUNHO do pacote (pré-aula). Não aprova.',
    descricao:
      "Quota do PERFIL (regra 5): `temSaldo` ANTES e o que o vendor cobrou debitado depois; custo medido pelo `MedidorDeProvider` (ADR-161). A saída passa pela régua da aprovação (a virada precisa se manter). Sem saldo ou com o vendor fora, o rascunho sai do BANCO CURADO (`usouIa: false`, `motivo`).",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoGerarRecorteSchema,
    resposta: RespostaGerarConteudoSchema,
    notas: [NOTA_DO_404, "Recorte fora da régua: **400** `preparo-invalido` com `erros`."],
  })
  gerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const recorte = corpoDe(RequisicaoGerarRecorteSchema, corpo, "preparo-invalido");
    const problemas = problemasDoRecorte(recorte);
    if (problemas.length > 0) throw erroDeJogo("preparo-invalido", problemas);
    return this.missao.gerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, req.auth.perfil, recorte);
  }

  @Post(":turmaId/pacotes/padrao")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({ resumo: '"Usar banco padrão": o banco curado JÁ aprovado e no ar (2 toques, sem IA). Idempotente.', params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, resposta: RespostaEmAndamentoSchema, notas: [NOTA_DO_404] })
  padrao(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.usarPadrao(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId);
  }

  @Post(":turmaId/pacotes/:pacoteId/regenerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Regenerar item pontual": UM projeto (`papel | parcial | nuvem`) ou os `cadernos`, de novo pela IA.',
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoRegenerarItemSchema,
    resposta: RespostaGerarConteudoSchema,
    notas: [NOTA_DO_404, "Pacote já aprovado: **409** `pacote-ja-homologado`."],
  })
  regenerar(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { item } = corpoDe(RequisicaoRegenerarItemSchema, corpo, "payload-invalido");
    return this.missao.regenerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, req.auth.perfil, pacoteDoCaminho(pacoteId), item);
  }

  @Post(":turmaId/pacotes/:pacoteId/homologar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Aprovar Pacote" — SÓ aprova: a atividade nasce PRONTA, não no ar.',
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoHomologarSchema,
    resposta: RespostaHomologarPacoteSchema,
    notas: [NOTA_DO_404, "Fora da régua: **400** `pacote-invalido` com `erros`. Mudar um pacote já aprovado: **409** `pacote-ja-homologado`."],
  })
  homologar(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { conteudo } = corpoDe(RequisicaoHomologarSchema, corpo, "pacote-invalido");
    return this.missao.homologar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacoteDoCaminho(pacoteId), conteudo as ConteudoDoPacote | undefined);
  }

  @Post(":turmaId/em-andamento")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({ resumo: '"Liberar para a Turma": o pacote aprovado que a turma usa.', params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, corpo: RequisicaoEmAndamentoSchema, resposta: RespostaEmAndamentoSchema, notas: [NOTA_DO_404, "Rascunho: **409** `pacote-nao-homologado`."] })
  emAndamento(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { pacoteId } = corpoDe(RequisicaoEmAndamentoSchema, corpo, "payload-invalido");
    return this.missao.colocarEmAndamento(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacoteId);
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: 'As três travas: "Liberar Próxima Pauta" (`revelacao`), "Abrir Revisão da Decisão" (`revoto`) e "Destravar Explicar e Protocolo" (`explicar`).',
    descricao: "O gate só anda para a frente (`exploracao → revelacao → revoto → explicar`); cada mudança entra no histórico.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoGateSchema,
    resposta: RespostaGateSchema,
    notas: [NOTA_DO_404, "Sem pacote no ar: **409** `pacote-nao-aprovado`."],
  })
  gate(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { etapa } = corpoDe(RequisicaoGateSchema, corpo, "payload-invalido");
    return this.missao.mudarGate(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, etapa);
  }

  @Post(":turmaId/zerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({ resumo: '"Zerar Turma" — a rodada seguinte, e a evidência do pacote apagada (ADR-155). As sessões ficam.', params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, corpo: RequisicaoZerarSchema, resposta: RespostaZerarSchema, notas: [NOTA_DO_404, "Rodada desatualizada: **409** `rodada-desatualizada`."] })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { rodada } = corpoDe(RequisicaoZerarSchema, corpo, "payload-invalido");
    return this.missao.zerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, rodada);
  }

  @Get(":turmaId/painel")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel da aula (polling ~5 s): contagens por passo, caminhos, a 1ª e a 2ª escolha por projeto, a migração e os protocolos.",
    descricao: "Só CONTAGENS na lousa, sem ranking nem nota individual; a folha nominal diz o passo e o tempo parado. O NÍVEL é da evidência (E14).",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: RespostaPainelSchema,
    notas: [NOTA_DO_404],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }
}

/** O material do guia da aula — catálogo da missão, igual para todo contrato. */
@Controller("dossie-invisivel/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class DossieInvisivelProfessorController {
  constructor(private readonly missao: DossieInvisivelService) {}

  @Get("material")
  @Contrato({ resumo: "O material do guia: o banco padrão, o roteiro do debate, a conta da virada, o gabarito do protocolo e as réguas.", resposta: RespostaMaterialProfessorSchema })
  material() {
    return this.missao.material();
  }
}

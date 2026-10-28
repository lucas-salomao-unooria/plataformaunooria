import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import type { ConteudoDoPacote } from "./conteudo";
import {
  ParamsDaTurmaSchema,
  ParamsDoPacoteSchema,
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
  RespostaPacoteSchema,
  RespostaPainelSchema,
  RespostaZerarSchema,
  problemasDoRecorte,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PortaVozDosDadosService } from "./porta-voz-dos-dados.service";

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
    const custom = r.error.issues.filter((i) => i.code === "custom").map((i) => i.message);
    if (custom.length > 0 && codigo !== "payload-invalido") throw erroDeJogo(codigo, [...new Set(custom)]);
    throw erroDeJogo(codigo === "payload-invalido" ? "payload-invalido" : codigo, r.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`));
  }
  return r.data as z.output<S>;
}

const NOTA_DO_404 =
  "Turma em que o professor não tem matrícula responde **404** `turma-nao-encontrada`, não 403: um \"sem permissão\" já contaria que a turma existe.";

/**
 * A exp03em1b do lado de quem dá aula. Gestor e admin LEEM; quem PREPARA e
 * CONDUZ é só quem tem matrícula de professor na turma. `@Roles` por MÉTODO.
 *
 * O preparo, em 2 caminhos (one-pager §9a): o curto — `pacotes/padrao` (o
 * banco curado já homologado E no ar, 2 toques); e o da IA — `gerar-conteudo`
 * (o rascunho) → `regenerar` (um item) → `homologar` (só aprova) →
 * `em-andamento` (põe no ar).
 */
@Controller("porta-voz-dos-dados/turmas")
@UseGuards(OidcGuard, RolesGuard)
export class PortaVozDosDadosTurmasController {
  constructor(private readonly missao: PortaVozDosDadosService) {}

  @Get(":turmaId/pacotes")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "Os pacotes da turma (API-001): o rascunho e os homologados, o em andamento, o banco padrão e os componentes.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: RespostaListarPacotesSchema,
    notas: [NOTA_DO_404],
  })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacotes(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "UM pacote da turma (rascunho ou homologado), inteiro.", params: ParamsDoPacoteSchema, query: QueryDaEscolaSchema, resposta: RespostaPacoteSchema, notas: [NOTA_DO_404] })
  pacote(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacote(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth), pacoteDoCaminho(pacoteId));
  }

  @Post(":turmaId/pacotes/gerar-conteudo")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "Gera com IA o RASCUNHO do pacote (API-002, pré-aula). Não homologa.",
    descricao:
      "A ÚNICA superfície de IA da missão, ANTES da aula. Quota do PERFIL (regra 5): `temSaldo` ANTES e o que o vendor cobrou debitado depois; o custo é medido pelo `MedidorDeProvider` (ADR-161). A saída passa pela régua da homologação. Sem saldo ou com o vendor fora, o rascunho sai do BANCO CURADO (`usouIa: false`, `motivo`). Um rascunho por turma: gerar de novo o substitui.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoGerarRecorteSchema,
    resposta: RespostaGerarConteudoSchema,
    notas: [NOTA_DO_404 + " A turma é conferida ANTES de gastar token.", "Recorte fora da régua: **400** `preparo-invalido` com `erros`."],
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
  @Contrato({
    resumo: '"Usar Banco Padrão e Liberar" (API-003): o banco curado (Vigilância Sanitária da Água) JÁ homologado e no ar.',
    descricao: "O caminho curto de 2 toques (one-pager §9a): sem IA, numa transação, sem tocar no rascunho da turma. Idempotente.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: RespostaEmAndamentoSchema,
    notas: [NOTA_DO_404],
  })
  padrao(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.usarPadrao(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId);
  }

  @Post(":turmaId/pacotes/:pacoteId/regenerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Regenerar Item": UM item do rascunho de novo pela IA (`grupo | servico | notaTecnica | camadas | reacoes | posAha`).',
    descricao: "O resto do pacote vai como contexto e a régua inteira vale na saída. Mesma quota do gerar. Sem IA, o item fica como estava (`usouIa: false`).",
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoRegenerarItemSchema,
    resposta: RespostaGerarConteudoSchema,
    notas: [NOTA_DO_404, "Pacote já homologado: **409** `pacote-ja-homologado`."],
  })
  regenerar(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { item } = corpoDe(RequisicaoRegenerarItemSchema, corpo, "payload-invalido");
    return this.missao.regenerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, req.auth.perfil, pacoteDoCaminho(pacoteId), item);
  }

  @Post(":turmaId/pacotes/:pacoteId/homologar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Homologar Pacote de Conteúdo" (API-004) — SÓ aprova: a atividade nasce PRONTA, não no ar.',
    descricao:
      "Com `conteudo`, a edição inline do professor entra junto; sem ele, aprova o rascunho como está. A régua inteira volta em `erros`. Homologar de novo o mesmo é idempotente.",
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoHomologarSchema,
    resposta: RespostaHomologarPacoteSchema,
    notas: [NOTA_DO_404, "Fora da régua: **400** `pacote-invalido` com `erros`. Mudar um pacote já homologado: **409** `pacote-ja-homologado`."],
  })
  homologar(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { conteudo } = corpoDe(RequisicaoHomologarSchema, corpo, "pacote-invalido");
    return this.missao.homologar(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaDoCaminho(turmaId),
      req.auth.usuarioId,
      pacoteDoCaminho(pacoteId),
      conteudo as ConteudoDoPacote | undefined,
    );
  }

  @Post(":turmaId/em-andamento")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Liberar Atividade para a Turma" (API-004b): o pacote homologado que a turma usa.',
    descricao: "O que estava no ar volta a ser pronto, o gate volta a `exploracao`, e o pacote que já rodou abre a rodada SEGUINTE. Idempotente: o mesmo no ar devolve `mudou: false`.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoEmAndamentoSchema,
    resposta: RespostaEmAndamentoSchema,
    notas: [NOTA_DO_404, "Rascunho: **409** `pacote-nao-homologado`. Pacote de outra turma: **404** `atividade-nao-encontrada`."],
  })
  emAndamento(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { pacoteId } = corpoDe(RequisicaoEmAndamentoSchema, corpo, "payload-invalido");
    return this.missao.colocarEmAndamento(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacoteId);
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Pausar Telas para Debate" (`pausa`) e "Liberar Retomada da Turma" (`liberada`).',
    descricao: "O gate só anda para a frente (`exploracao → pausa → liberada`); cada mudança entra no histórico (EVT-P05). Com `liberada`, quem já publicou recebe a oferta da errata.",
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
  @Contrato({
    resumo: '"Zerar Turma" — a rodada seguinte, e a evidência do pacote apagada (ADR-155). As sessões ficam.',
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: RequisicaoZerarSchema,
    resposta: RespostaZerarSchema,
    notas: [NOTA_DO_404, "Rodada que não é nem a atual nem a anterior: **409** `rodada-desatualizada`. Sem pacote no ar: **409** `pacote-nao-aprovado`."],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { rodada } = corpoDe(RequisicaoZerarSchema, corpo, "payload-invalido");
    return this.missao.zerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, rodada);
  }

  @Get(":turmaId/painel")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel da aula (polling ~5 s): contagens por passo, pausados, a escala da 1ª publicação, o anexo, a errata e a perícia.",
    descricao: "Só CONTAGENS na lousa, sem ranking nem nota individual; a folha nominal diz o passo e o tempo parado. O NÍVEL é da evidência (E14). A vista do professor conta no pacote (EVT-P04).",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: RespostaPainelSchema,
    notas: [NOTA_DO_404],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }
}

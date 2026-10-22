import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  EmAndamentoSchema,
  GateDaTurmaSchema,
  GateSchema,
  GerarRespostaSchema,
  GerarSchema,
  HomologarSchema,
  NovaRodadaRespostaSchema,
  NovaRodadaSchema,
  PacoteDaTurmaSchema,
  PacoteDetalheSchema,
  PacoteDoProfessorSchema,
  PacotesDaTurmaSchema,
  PainelSchema,
  ParamsDaTurmaSchema,
  ParamsDoPacoteSchema,
  QueryDaEscolaSchema,
} from "./contrato-de-rotas";
import { EfeitoAmplificadorService } from "./efeito-amplificador.service";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

function turmaDoCaminho(turmaId: string): string {
  const r = ParamsDaTurmaSchema.safeParse({ turmaId });
  if (!r.success) throw new BadRequestException({ codigo: "turma-nao-encontrada", mensagem: "Turma inválida." });
  return r.data.turmaId;
}

/** O corpo validado, ou 400 com o código da rota e TODAS as frases (é o professor quem lê). */
function corpoDe<S extends z.ZodTypeAny>(schema: S, corpo: unknown, codigo: "pacote-invalido" | "preparo-invalido" | "payload-invalido"): z.output<S> {
  const r = schema.safeParse(corpo);
  if (!r.success) {
    const custom = r.error.issues.filter((i) => i.code === "custom").map((i) => i.message);
    if (custom.length > 0 && codigo !== "payload-invalido") throw erroDeJogo(codigo, [...new Set(custom)]);
    throw erroDeJogo("payload-invalido", r.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`));
  }
  return r.data as z.output<S>;
}

function pacoteDoCaminho(pacoteId: string): string {
  const r = ParamsDoPacoteSchema.shape.pacoteId.safeParse(pacoteId);
  if (!r.success) throw erroDeJogo("atividade-nao-encontrada");
  return r.data;
}

const NOTA_DO_404 =
  "Turma em que o professor não tem matrícula responde **404** `turma-nao-encontrada`, não 403: um \"sem permissão\" já contaria que a turma existe.";

/**
 * A exp02em1b do lado de quem dá aula. Gestor e admin LEEM; quem PREPARA e
 * CONDUZ é só quem tem matrícula de professor na turma. `@Roles` por MÉTODO.
 */
@Controller("efeito-amplificador/turmas")
@UseGuards(OidcGuard, RolesGuard)
export class EfeitoAmplificadorTurmasController {
  constructor(private readonly missao: EfeitoAmplificadorService) {}

  @Get(":turmaId/pacote")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O pacote da turma: o em andamento, o rascunho e o banco curado — COM o gabarito.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PacoteDaTurmaSchema,
    notas: [NOTA_DO_404],
  })
  pacote(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacoteDaTurma(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "Gera com IA o RASCUNHO do pacote (pré-aula).",
    descricao:
      "A única chamada de IA desta missão, e ela roda **antes** da aula. Quota do PERFIL (regra 5): `temSaldo` ANTES e o que o vendor cobrou debitado depois. A saída passa pela mesma régua da homologação. Sem saldo ou com o vendor fora, o rascunho sai do BANCO CURADO (`usouIa: false`, `motivo`). **Não homologa.**",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GerarSchema,
    resposta: GerarRespostaSchema,
    notas: [NOTA_DO_404 + " A turma é conferida ANTES de gastar token.", "Recorte fora da régua: **400** `preparo-invalido` com `erros`."],
  })
  gerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const recorte = corpoDe(GerarSchema, corpo, "preparo-invalido");
    return this.missao.gerar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, req.auth.perfil, recorte);
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Homologar Pacote" — a curadoria humana; o pacote vira uma atividade PRONTA.',
    descricao:
      "O corpo leva o pacote INTEIRO como o professor o deixou. A régua (os três nós com a correção de cada um, o recorte dentro do trecho copiado, as três manchetes, os seis comentários de madrugada com saúde física, mental e risco) volta inteira em `erros`. Homologar de novo o mesmo é idempotente.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: HomologarSchema,
    resposta: PacoteDoProfessorSchema,
    notas: [NOTA_DO_404, "Fora da régua: **400** `pacote-invalido` com `erros`."],
  })
  homologar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const pacote = corpoDe(HomologarSchema, corpo, "pacote-invalido");
    return this.missao.homologar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacote);
  }

  @Post(":turmaId/banco-padrao")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Usar pacote padrão: Convivência Escolar e Celular" — homologa o banco curado e o põe no ar.',
    descricao: "O caminho curto (one-pager §9a): sem IA, numa transação. Idempotente.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: EmAndamentoSchema,
    notas: [NOTA_DO_404],
  })
  bancoPadrao(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.usarBancoPadrao(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId);
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Pausar Telas para Debate" e "Liberar Etapa 5".',
    descricao: "`pausar` → `debate`; `liberar_explicar` → `explicar`. Só para a frente; cada mudança entra no histórico.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [NOTA_DO_404, "Sem pacote no ar: **409** `pacote-nao-aprovado`."],
  })
  gate(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { acao } = corpoDe(GateSchema, corpo, "payload-invalido");
    return this.missao.mudarGate(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, acao);
  }

  @Get(":turmaId/painel")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel de condução: a lousa agregada e a folha por computador.",
    descricao:
      "`resumo` é a lousa: publicações, manchetes escolhidas e a curva de entrega — **nenhum nome**. As linhas trazem o passo e a manchete; o NÍVEL de cada habilidade é da evidência (E14), e o chat do estudante não sai daqui.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PainelSchema,
    notas: [NOTA_DO_404],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/zerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Zerar Turma" — a rodada seguinte, e a evidência do pacote apagada (ADR-155).',
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

  @Get(":turmaId/pacotes")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "As atividades da turma: os pacotes homologados.", params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, resposta: PacotesDaTurmaSchema, notas: [NOTA_DO_404] })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacotes(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Roles("professor", ...GESTORES)
  @Contrato({ resumo: "UMA atividade, inteira e COM o gabarito.", params: ParamsDoPacoteSchema, query: QueryDaEscolaSchema, resposta: PacoteDetalheSchema, notas: [NOTA_DO_404] })
  pacoteDetalhe(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacote(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth), pacoteDoCaminho(pacoteId));
  }

  @Post(":turmaId/pacotes/:pacoteId/em-andamento")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Iniciar Atividade com a Turma" — o professor escolhe o pacote que a turma usa (ADR-130).',
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    resposta: EmAndamentoSchema,
    notas: [NOTA_DO_404, "**Idempotente**: pôr no ar o que já está no ar devolve `mudou: false`."],
  })
  emAndamento(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.colocarEmAndamento(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacoteDoCaminho(pacoteId));
  }
}

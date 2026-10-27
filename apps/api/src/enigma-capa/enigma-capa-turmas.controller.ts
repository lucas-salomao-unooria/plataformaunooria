import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  AlvosDoRascunhoSchema,
  BancoPadraoSchema,
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
  RascunhoSchema,
  TurmasSchema,
} from "./contrato-de-rotas";
import { EnigmaCapaService } from "./enigma-capa.service";
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
    throw erroDeJogo(codigo, [...new Set(r.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`))]);
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
 * A exp02ef1b do lado de quem dá aula. Gestor e admin LEEM; quem PREPARA e
 * CONDUZ é só quem tem matrícula de professor na turma. `@Roles` por MÉTODO.
 */
@Controller("enigma-capa/turmas")
@UseGuards(OidcGuard, RolesGuard)
export class EnigmaCapaTurmasController {
  constructor(private readonly missao: EnigmaCapaService) {}

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

  @Get(":turmaId/pacote")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O pacote da turma: o em andamento, o rascunho e os prontos (Biblioteca, Horta, Museu) — COM o gabarito.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PacoteDaTurmaSchema,
    notas: [NOTA_DO_404],
  })
  pacote(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacoteDaTurma(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/rascunho")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O rascunho da curadoria (ou `null`), com as `pendencias` que ainda impedem aprovar.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: RascunhoSchema,
    notas: [NOTA_DO_404],
  })
  rascunho(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.rascunho(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Gerar com IA": o RASCUNHO da cena — o texto e a panorâmica (pré-aula).',
    descricao:
      "Quota do PERFIL `professor` (regra 5): `temSaldo` ANTES e o que o vendor cobrou (texto e imagem) debitado depois. A saída passa pela mesma régua da homologação. A cena da IA nasce SEM os alvos: o professor toca nos dois objetos (`rascunho/invariantes`). Sem saldo ou com o vendor fora, o rascunho sai do pacote PRONTO da disciplina (`usouIa: false`, `motivo`). Gerar de novo substitui o rascunho. **Não aprova.**",
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

  @Post(":turmaId/rascunho/invariantes")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Toque no {NOME}": o professor marca os dois objetos iguais na panorâmica do rascunho.',
    descricao: "Coordenadas da panorâmica (0–100). O raio é o padrão da missão. Os dois precisam estar na parte do meio, que aparece nas duas fotos.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: AlvosDoRascunhoSchema,
    resposta: PacoteDoProfessorSchema,
    notas: [NOTA_DO_404, "Fora da régua: **400** `pacote-invalido` com `erros`. Sem rascunho: **404** `rascunho-nao-encontrado`."],
  })
  alvos(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const alvos = corpoDe(AlvosDoRascunhoSchema, corpo, "payload-invalido");
    return this.missao.marcarAlvos(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, alvos);
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Aprovar": o rascunho vira uma atividade PRONTA (não no ar).',
    descricao:
      "`rascunhoId` é o rascunho que o professor VIU; `selos` e `falas` opcionais são os textos curtos editados. Exige os dois alvos marcados. O duplo clique devolve o mesmo pacote. Para pôr no ar: `pacotes/:pacoteId/em-andamento`.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: HomologarSchema,
    resposta: PacoteDoProfessorSchema,
    notas: [NOTA_DO_404, "Fora da régua: **400** `pacote-invalido` com `erros`. Outro rascunho: **409** `rascunho-desatualizado`."],
  })
  homologar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const pedido = corpoDe(HomologarSchema, corpo, "pacote-invalido");
    return this.missao.homologar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pedido);
  }

  @Post(":turmaId/banco-padrao")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"USAR BANCO PADRÃO (BIBLIOTECA)" e os prontos Horta e Museu — aprova e põe no ar, num toque.',
    descricao: "O caminho curto (one-pager §9a): sem IA, numa transação, sem tocar no rascunho. O mesmo pronto já aprovado nesta turma é reusado. Idempotente.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: BancoPadraoSchema,
    resposta: EmAndamentoSchema,
    notas: [NOTA_DO_404],
  })
  bancoPadrao(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    const { chave } = corpoDe(BancoPadraoSchema, corpo ?? {}, "payload-invalido");
    return this.missao.usarBancoPadrao(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, chave);
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"LIBERAR VIRADA" — geral da turma.',
    descricao: "`aberta → virada`, só para a frente; a mudança entra no histórico. Todos os que publicaram vão para a busca dos invariantes; quem publicar depois segue direto.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [NOTA_DO_404, "Sem atividade no ar: **409** `pacote-nao-aprovado`."],
  })
  gate(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Body() corpo: unknown, @Req() req: Autenticado) {
    corpoDe(GateSchema, corpo, "payload-invalido");
    return this.missao.mudarGate(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId);
  }

  @Get(":turmaId/painel")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel da aula: o progresso e as escolhas de cada estudante (ou computador).",
    descricao:
      "Por linha, pelo NOME do estudante: passo, lupa (o tempo sobre cada objeto do fundo e os alertas), a capa (foto, selo coerente, a fala da visitante, a ação na capa), os invariantes (erros, ajuda), o que marcou fora (\"marcou X de Y\"), o par e o motivo e a segunda foto. `aguardandoVirada` = publicou e a turma ainda não virou; `resumo.marcaramFora` = quantos marcaram ao menos uma coisa que ficou fora da capa. O NÍVEL de cada habilidade é da evidência (E14).",
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
    resumo: '"Zerar" — a rodada seguinte, a evidência do pacote apagada (ADR-155) e a fase de volta a `aberta`.',
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
  @Contrato({ resumo: "As atividades da turma: os pacotes aprovados.", params: ParamsDaTurmaSchema, query: QueryDaEscolaSchema, resposta: PacotesDaTurmaSchema, notas: [NOTA_DO_404] })
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
    resumo: '"Usar esta atividade agora" — o professor escolhe o pacote que a turma usa (ADR-130).',
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    resposta: EmAndamentoSchema,
    notas: [NOTA_DO_404, "**Idempotente**: pôr no ar o que já está no ar devolve `mudou: false`."],
  })
  emAndamento(@Param("turmaId") turmaId: string, @Param("pacoteId") pacoteId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.colocarEmAndamento(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacoteDoCaminho(pacoteId));
  }
}

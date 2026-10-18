import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  AprovarSchema,
  EmAndamentoSchema,
  GateDaTurmaSchema,
  GateSchema,
  GerarRespostaSchema,
  GerarSchema,
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
import { erroDeJogo } from "./erros";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

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

/** O id do pacote do caminho: inválido é 404, como o pacote de outra turma. */
function pacoteDoCaminho(pacoteId: string): string {
  const r = ParamsDoPacoteSchema.shape.pacoteId.safeParse(pacoteId);
  if (!r.success) throw erroDeJogo("atividade-nao-encontrada");
  return r.data;
}

const NOTA_DO_404 =
  "Turma em que o professor não tem matrícula responde **404** `turma-nao-encontrada`, não 403: um \"sem permissão\" já contaria que a turma existe.";

/**
 * A exp05ef1b do lado de quem dá aula.
 *
 * Gestor e admin LEEM (o pacote e o painel); quem PREPARA e CONDUZ — gerar,
 * aprovar, os três botões, zerar a turma — é só quem tem matrícula de
 * professor na turma, a mesma distinção da sala, das equipes e da evidência:
 * administrar a escola não é dar a aula. Por isso `@Roles` por MÉTODO.
 *
 * `gestor_contrato` é a exceção cross-escola (regra 1): diz `?escolaId=`.
 */
@Controller("quem-mandou-isso/turmas")
@UseGuards(OidcGuard, RolesGuard)
export class QuemMandouIssoTurmasController {
  constructor(private readonly missao: QuemMandouIssoService) {}

  @Get(":turmaId/pacote")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O pacote da turma: o ativo, o rascunho e o banco curado — COM o gabarito.",
    descricao:
      "**Rota de quem dá aula** — é aqui que `veracidade` e `tom` de cada mensagem aparecem, e são o roteiro do professor.\n\n`ativo` é o pacote aprovado que a turma usa (a ATIVIDADE da evidência); `rascunho` é o último gerado e ainda não aprovado; `padrao` é o banco curado \"O Mistério do Passeio ao Museu\", sempre à mão para \"Usar Preset Curado Padrão\" (a tela o carrega e aprova pelo `POST /aprovar`).",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PacoteDaTurmaSchema,
    notas: [NOTA_DO_404],
  })
  pacote(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacoteDaTurma(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaDoCaminho(turmaId),
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/gerar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "Gera com IA o RASCUNHO das 8 mensagens (pré-aula).",
    descricao:
      "A única chamada de IA desta missão, e ela roda **antes** da aula: em sala tudo é determinístico.\n\nA quota é a do PERFIL (regra 5): `temSaldo` ANTES, e o que o vendor cobrou — por tentativa, inclusive as rejeitadas — é debitado depois. A estrutura (o quadrante e o formato de cada posição) é SORTEADA no servidor e o modelo só escreve; a saída passa pela mesma régua da aprovação, e sair dela faz o modelo regerar.\n\nSem saldo ou com o vendor fora, o rascunho sai do BANCO CURADO (`usouIa: false`, `motivo` `sem-saldo` ou `indisponivel`, com a disciplina do recorte). O rascunho é GRAVADO (um por turma, substituído a cada geração): o preparo custou saldo, e um F5 não pode jogá-lo fora. **Não aprova**: isso é o `POST /aprovar`.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GerarSchema,
    resposta: GerarRespostaSchema,
    notas: [
      NOTA_DO_404 + " A turma é conferida ANTES de gastar token.",
      "O recorte é cobrado por regra (e some do documento, por ser `.superRefine()`): `tema` de 3 a 60 caracteres e até 8 palavras, sem \"atividade\", \"gabarito\", \"nota\" nem \"exercício\" (ele entra na fala da Nina, dentro do clone); `assuntos` de 3 a 6 fatos, cada um de 2 a 120 caracteres, até 600 somados; `contexto` opcional, até 300. Fora disso: **400** `preparo-invalido` com `erros` (a lista inteira).",
    ],
  })
  gerar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const recorte = corpoDe(GerarSchema, corpo, "preparo-invalido");
    return this.missao.gerar(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaDoCaminho(turmaId),
      req.auth.usuarioId,
      req.auth.perfil,
      recorte,
    );
  }

  @Post(":turmaId/aprovar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Criar atividade" — aprova o pacote como uma atividade PRONTA da turma.',
    descricao:
      "O corpo carrega o pacote INTEIRO como o professor o deixou: a curadoria é editar qualquer texto antes de aprovar.\n\n**Aprovar um pacote novo é uma ATIVIDADE nova** da evidência (E14), e ela nasce **pronta, não no ar** (ADR-130): o pacote em andamento continua em andamento, e a fase da turma não muda. Quem escolhe o que a turma joga é o professor (`POST :turmaId/pacotes/:pacoteId/em-andamento`). Aprovar de novo EXATAMENTE o pacote aprovado mais recente é idempotente (mesmo id, sem atividade nova).",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: AprovarSchema,
    resposta: PacoteDoProfessorSchema,
    notas: [
      NOTA_DO_404,
      "A régua do pacote é cobrada por regra (e some do documento, por ser `.superRefine()`): exatamente 8 mensagens (`msg_1` a `msg_8`, uma vez cada); exatamente 2 verdadeiras emocionais, 2 verdadeiras neutras, 2 falsas emocionais e 2 falsas neutras; exatamente 4 textos, 2 imagens e 2 links; a imagem e o link com UMA verdadeira e UMA falsa cada (senão o formato entrega a resposta); `legenda` obrigatória na imagem e no link e ausente no texto; texto até 45 palavras e legenda até 25; remetente de 2 a 30 caracteres; nenhum \"atividade\", \"gabarito\", \"nota\" nem \"exercício\" no que a criança lê; e o mesmo recorte do `POST /gerar`. Fora disso: **400** `pacote-invalido` com `erros`.",
    ],
  })
  aprovar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const pacote = corpoDe(AprovarSchema, corpo, "pacote-invalido");
    return this.missao.aprovar(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, pacote);
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "Os três botões do console: revelação, síntese e reflexão.",
    descricao:
      "`liberar_revelacao` → `revelacao`, `apresentar_sintese` → `explicar`, `liberar_reflexao` → `reflexao`. É a linha que o polling de 3 s do estudante lê (ADR-93).\n\nA fase só anda para a FRENTE: o clique repetido ou fora de ordem não muda nada, e pular a síntese é permitido.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [NOTA_DO_404, "Sem pacote aprovado: **409** `pacote-nao-aprovado`."],
  })
  gate(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { acao } = corpoDe(GateSchema, corpo, "payload-invalido");
    return this.missao.mudarGate(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, acao);
  }

  @Get(":turmaId/painel")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel ao vivo: o progresso, o Termômetro da Turma e a folha nominal.",
    descricao:
      "**Por COMPUTADOR quando há equipe** (`porComputador: true`): cada linha é uma unidade — a de quem jogou, com a equipe junto —, e os números contam unidades.\n\nAntes da revelação, SÓ progresso: `termometro` é `null`. Depois: % das unidades que encaminharam ≥ 1 falsa neutra; % das verdadeiras emocionais NÃO encaminhadas, (2·N - VE encaminhadas)/(2·N); e o cruzamento motivo × \"encaminhou falsa neutra\". **Nenhum nome no Termômetro.**\n\n`atividade` é o que o `PainelDeHabilidades` (E14) recebe: `GET /evidencias/turma/:turmaId/missao/exp05ef1b/atividade/:pacoteId`.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PainelSchema,
    notas: [
      NOTA_DO_404,
"Sem texto livre de menor: `cartao` traz os acertos (0–6, e por operador) e `regra` a regra em palavras, montada das peças, e o número de testes. Professor e gestor recebem a mesma linha. O NÍVEL de cada habilidade é da evidência (E14).",
      "Sem coluna de acerto por criança: o nível por habilidade é da evidência (E14), onde o professor também o ajusta.",
    ],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/nova-rodada")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Zerar Turma para Nova Aplicação" — abre a rodada seguinte e apaga a evidência pedagógica do pacote.',
    descricao:
      "A evidência pedagógica do pacote é apagada, de todas as rodadas (ADR-155): o painel de habilidades recomeça do zero. As sessões da rodada anterior ficam. A turma recomeça numa sessão nova, do mesmo pacote, e a fase volta à triagem.\n\n`rodada` é a que o professor VIU no painel: o segundo clique (a atual já é a seguinte) devolve sem avançar de novo.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    corpo: NovaRodadaSchema,
    resposta: NovaRodadaRespostaSchema,
    notas: [
      NOTA_DO_404,
      "Sem pacote aprovado: **409** `pacote-nao-aprovado`. Rodada que não é nem a atual nem a anterior: **409** `rodada-desatualizada`.",
    ],
  })
  novaRodada(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { rodada } = corpoDe(NovaRodadaSchema, corpo, "payload-invalido");
    return this.missao.novaRodada(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), req.auth.usuarioId, rodada);
  }

  @Get(":turmaId/pacotes")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "As atividades da turma: os pacotes aprovados, com o em andamento marcado.",
    descricao:
      "A lista de atividades da ficha (ADR-130) e o seletor do painel de habilidades: cada pacote APROVADO é uma ATIVIDADE, e o `id` dele é o `atividadeId` das equipes e da evidência. O rascunho não entra — ainda não é atividade.\n\n`emAndamento` é `null` quando o professor ainda não pôs nenhum no ar: a plataforma não cria atividade.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: PacotesDaTurmaSchema,
    notas: [NOTA_DO_404, "`rodadas` é a maior rodada com sessão daquele pacote; 0 = nunca rodou."],
  })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacotes(escolaAlvo(req.auth, escolaIdPedida), turmaDoCaminho(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "UMA atividade, inteira e COM o gabarito — em andamento ou pronta.",
    descricao: "A página da atividade. `ativo` diz se ela está em andamento; `rodadas` é a maior rodada com sessão (0 = nunca rodou).",
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    resposta: PacoteDetalheSchema,
    notas: [NOTA_DO_404, "O rascunho, ou o pacote de outra turma, responde **404** `atividade-nao-encontrada`."],
  })
  pacoteDetalhe(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.pacote(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaDoCaminho(turmaId),
      professorDoToken(req.auth),
      pacoteDoCaminho(pacoteId),
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/em-andamento")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: '"Usar esta atividade agora" — o professor escolhe o que a turma joga (ADR-130).',
    descricao:
      "O escolhido passa a ser a ATIVIDADE EM ANDAMENTO da turma; o que estava volta a ser pronto — fica, com as sessões e a evidência. A fase volta à triagem.\n\nA RODADA: o pacote que nunca rodou fica na 1; o que já rodou abre a SEGUINTE à última com sessão — retomar a mesma depois da revelação seria o \"voltar\" que os botões proíbem. As anteriores continuam no painel de habilidades.",
    params: ParamsDoPacoteSchema,
    query: QueryDaEscolaSchema,
    resposta: EmAndamentoSchema,
    notas: [
      NOTA_DO_404,
      "**Idempotente**: pôr no ar o que já está no ar devolve `mudou: false` e não muda nada.",
      "O rascunho, ou o pacote de outra turma, responde **404** `atividade-nao-encontrada`.",
    ],
  })
  emAndamento(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.colocarEmAndamento(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaDoCaminho(turmaId),
      req.auth.usuarioId,
      pacoteDoCaminho(pacoteId),
    );
  }
}

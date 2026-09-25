import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  AjustesSchema,
  PainelDaAtividadeSchema,
  ParamsDaAtividadeSchema,
  ParamsDaRodadaSchema,
  ParamsDoEstudanteSchema,
  PerfilDoEstudanteSchema,
  QueryDaEscolaSchema,
} from "./contrato-de-rotas";
import { EvidenciasService } from "./evidencias.service";

type Autenticado = { auth: AuthClaims };

/** Os parâmetros do caminho, validados — 400 com a causa dita (o campo e o formato). */
function doCaminho<S extends z.ZodTypeAny>(schema: S, valores: unknown): z.output<S> {
  const r = schema.safeParse(valores);
  if (!r.success) {
    const problema = r.error.issues[0];
    throw new BadRequestException({
      mensagem: `${problema?.path.join(".") ?? "parâmetro"}: ${problema?.message ?? "inválido"}`,
    });
  }
  return r.data as z.output<S>;
}

const NOTA_DO_404 =
  "Turma em que o professor não tem matrícula responde **404**, não 403: um \"sem permissão\" já contaria que a turma existe.";

/**
 * A EVIDÊNCIA PEDAGÓGICA, do lado de quem dá aula (E14).
 *
 * Gestor e admin LEEM (o painel e o perfil); quem CONFIRMA e AJUSTA é só quem
 * tem matrícula de professor na turma — a mesma distinção da liberação e das
 * equipes: administrar a escola não é dar a aula. Por isso `@Roles` por
 * MÉTODO, e não na classe.
 *
 * Os caminhos começam em `turma/` e `estudante/`; os do estudante, no
 * `:expId` seguido da literal `perguntas`. Nenhum caminho de um controller
 * casa com o do outro (o número de segmentos e as literais diferem), então a
 * ordem de registro não decide quem responde — a armadilha que
 * `/turmas/minhas` documenta.
 */
@Controller("evidencias")
@UseGuards(OidcGuard, RolesGuard)
export class EvidenciasProfessorController {
  constructor(private readonly evidencias: EvidenciasService) {}

  @Get("turma/:turmaId/missao/:expId/atividade/:atividadeId")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel da evidência de uma atividade: cada estudante, cada rodada, cada habilidade da BNCC.",
    descricao:
      "Para cada estudante da turma: a equipe dele nesta missão, a evidência de cada habilidade em cada rodada (`porRodada`, com `status`, `origem` e `situacao`) e o `resultado` — a MELHOR rodada por habilidade, só com o que vale.\n\nHabilidade ausente é **N/A** (\"Não avaliado\"). `pendentes` conta, por rodada, as cópias da projeção que esperam o professor confirmar.\n\nMissão sem ficha pedagógica responde **200** com `temFicha: false` e tudo vazio, e não 400: é por esta resposta que o hub decide se desenha o bloco.",
    params: ParamsDaAtividadeSchema,
    query: QueryDaEscolaSchema,
    resposta: PainelDaAtividadeSchema,
    notas: [
      NOTA_DO_404,
      "Gestor e admin leem a escola inteira, de propósito — e não confirmam nem ajustam.",
      "Sem ranking: a ordem dos estudantes é a alfabética, e nenhum campo soma níveis.",
    ],
  })
  painel(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Param("atividadeId") atividadeId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = doCaminho(ParamsDaAtividadeSchema, { turmaId, expId, atividadeId });
    return this.evidencias.painel(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      alvo.atividadeId,
      professorDoToken(req.auth),
    );
  }

  /**
   * `POST` de uma AÇÃO sobre o que já existe, daí o `@HttpCode(200)`: não cria
   * recurso — as cópias da projeção passam a valer.
   */
  @Post("turma/:turmaId/missao/:expId/atividade/:atividadeId/rodadas/:rodada/confirmar")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "Confirma para a turma as cópias da projeção desta rodada.",
    descricao:
      "Com a turma inteira diante de um computador só (a projeção), o que a missão viu é copiado para todos como `a_revisar` — e NÃO conta até o professor confirmar. Este botão passa todas as desta rodada a `valida`. Depois, o professor ainda pode ajustar cada criança.\n\nDevolve o painel já atualizado. Repetir não muda nada.",
    params: ParamsDaRodadaSchema,
    query: QueryDaEscolaSchema,
    resposta: PainelDaAtividadeSchema,
    notas: [NOTA_DO_404, "Missão sem ficha pedagógica responde **400** `missao-sem-ficha`."],
  })
  confirmar(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Param("atividadeId") atividadeId: string,
    @Param("rodada") rodada: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = doCaminho(ParamsDaRodadaSchema, { turmaId, expId, atividadeId, rodada });
    return this.evidencias.confirmar(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      alvo.atividadeId,
      alvo.rodada,
      req.auth.usuarioId,
    );
  }

  @Patch("turma/:turmaId/missao/:expId/atividade/:atividadeId/rodadas/:rodada/ajustes")
  @Roles("professor")
  @Contrato({
    resumo: "Ajusta a evidência de um ou vários estudantes numa rodada.",
    descricao:
      "**Só quem tem matrícula de professor na turma**, a qualquer momento — mesmo com a missão encerrada. O ajuste é a origem `professor`: nada o sobrescreve depois (nem a marca da criança, nem a cópia da equipe).\n\n`nao_participou` é o N/A explícito: barra a cópia da equipe e não conta no perfil.\n\nToda mudança vai para o histórico com de/para, quem e quando; ajuste que repete o que já estava é ignorado. Devolve o painel já atualizado.",
    params: ParamsDaRodadaSchema,
    query: QueryDaEscolaSchema,
    corpo: AjustesSchema,
    resposta: PainelDaAtividadeSchema,
    notas: [
      NOTA_DO_404,
      "Estudante de fora da turma, habilidade fora da ficha ou o mesmo par duas vezes respondem **400** `ajuste-invalido` com `erros`: a lista INTEIRA, em frases para o professor.",
      "Rodada depois da última que a atividade teve responde **400** `rodada-inexistente` (a rodada 1 sempre existe).",
      "Missão sem ficha pedagógica responde **400** `missao-sem-ficha`.",
    ],
  })
  ajustar(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Param("atividadeId") atividadeId: string,
    @Param("rodada") rodada: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const alvo = doCaminho(ParamsDaRodadaSchema, { turmaId, expId, atividadeId, rodada });
    const { ajustes } = AjustesSchema.parse(corpo);
    return this.evidencias.ajustar(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      alvo.atividadeId,
      alvo.rodada,
      req.auth.usuarioId,
      ajustes,
    );
  }

  @Get("estudante/:estudanteId")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O perfil de evidência de um estudante: cada missão, cada atividade, o nível de cada habilidade.",
    descricao:
      "Em cada atividade, a MELHOR rodada por habilidade — só com o que vale: sem a projeção que o professor ainda não confirmou, sem N/A e sem `nao_participou`. Sem origem: quem lê o perfil quer saber o que a criança demonstrou, não de que computador veio.\n\nO estudante NÃO tem rota para ver o próprio resultado.",
    params: ParamsDoEstudanteSchema,
    query: QueryDaEscolaSchema,
    resposta: PerfilDoEstudanteSchema,
    notas: [
      "Estudante que o professor não ensina (nenhuma turma dele) responde **404**, não 403.",
      "Gestor e admin leem qualquer estudante da escola.",
    ],
  })
  perfil(
    @Param("estudanteId") estudanteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = doCaminho(ParamsDoEstudanteSchema, { estudanteId });
    return this.evidencias.perfil(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.estudanteId,
      professorDoToken(req.auth),
    );
  }
}

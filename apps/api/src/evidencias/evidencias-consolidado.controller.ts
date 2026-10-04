import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { GESTORES, GESTORES_DO_CONTRATO } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  EscolaConsolidadaSchema,
  ParamsDaTurmaSchema,
  QueryDaEscolaSchema,
  RedeConsolidadaQuerySchema,
  RedeConsolidadaSchema,
  TurmaConsolidadaSchema,
} from "./contrato-de-rotas";
import { EvidenciasConsolidadoService } from "./evidencias-consolidado.service";

type Autenticado = { auth: AuthClaims };

const NOTA_SEM_RANKING =
  "**Sem ranking**: estudantes, turmas e escolas saem em ordem alfabética (turmas por série antes), e nenhum campo soma níveis numa nota.";
const NOTA_NAO_AVALIADO =
  "`naoAvaliado` é a criança SEM evidência que conte (não fez, saiu antes, projeção ainda não confirmada, \"Não participou\") — nunca entra em `naoAtingiu`.";
const NOTA_DA_MISSAO =
  "O nível de uma criança numa habilidade da missão é o MELHOR entre todas as atividades e rodadas da missão. A mesma habilidade em duas missões aparece duas vezes, uma por missão.";

/**
 * O PAINEL DE HABILIDADES (F14.7), em três alturas: a turma, a escola e a
 * rede. Só leitura — e por isso ninguém aqui confirma nem ajusta.
 *
 * Os caminhos não casam com os do professor (`turma/:turmaId/missao/…`, mais
 * longo) nem com os do estudante (`:expId/perguntas/…`): `escola` e `rede` são
 * literais de dois segmentos, e `estudante/:id` difere na literal.
 */
@Controller("evidencias")
@UseGuards(OidcGuard, RolesGuard)
export class EvidenciasConsolidadoController {
  constructor(private readonly consolidado: EvidenciasConsolidadoService) {}

  @Get("turma/:turmaId/consolidado")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "O painel de habilidades da turma: cada missão, cada habilidade da BNCC, quantas crianças em cada nível.",
    descricao:
      "As missões com ficha pedagógica da série da turma, mais as que a turma já fez de outra série, cada uma com a UNIDADE do ano (a coluna do painel). Para cada habilidade, a contagem de crianças da turma em `atingiu`, `emProcesso`, `naoAtingiu` e `naoAvaliado`.\n\n`aplicada: false` = a turma ainda não tem nenhuma evidência daquela missão — a tela mostra a missão sem barra.\n\n`estudantes` é a lista do drill-down, em ordem alfabética.",
    params: ParamsDaTurmaSchema,
    query: QueryDaEscolaSchema,
    resposta: TurmaConsolidadaSchema,
    notas: [
      "Turma em que o professor não tem matrícula responde **404**, não 403.",
      "A coordenação lê qualquer turma da escola; a REGIONAL pode pedir `?escolaId=` de qualquer escola da regional dela.",
      NOTA_DA_MISSAO,
      NOTA_NAO_AVALIADO,
      NOTA_SEM_RANKING,
    ],
  })
  async turma(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = ParamsDaTurmaSchema.safeParse({ turmaId });
    if (!alvo.success) throw new BadRequestException({ mensagem: "turmaId: precisa ser um UUID" });
    const escolaId = await this.consolidado.escolaDaConsulta(req.auth, escolaIdPedida);
    return this.consolidado.daTurma(escolaId, alvo.data.turmaId, professorDoToken(req.auth));
  }

  @Get("escola/consolidado")
  @Roles(...GESTORES)
  @Contrato({
    resumo: "O painel de habilidades da escola: as turmas do ano letivo vigente, por série.",
    descricao:
      "Cada turma do ano letivo vigente que tem alguma missão com ficha, com a distribuição por habilidade de cada missão — em contagem; a tela faz a porcentagem. As missões (nome, unidade, texto da BNCC) vêm uma vez só, em `missoes`.\n\nTurmas por série (na ordem da trilha) e, dentro dela, por nome.",
    query: QueryDaEscolaSchema,
    resposta: EscolaConsolidadaSchema,
    notas: [
      "Professor não chega aqui (403): a visão dele é a da turma.",
      "A REGIONAL pode pedir `?escolaId=` de qualquer escola da regional dela; fora dela, **403**.",
      NOTA_DA_MISSAO,
      NOTA_NAO_AVALIADO,
      NOTA_SEM_RANKING,
    ],
  })
  async escola(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    const escolaId = await this.consolidado.escolaDaConsulta(req.auth, escolaIdPedida);
    return this.consolidado.daEscola(escolaId);
  }

  @Get("rede/consolidado")
  @Roles("gestor_regional", ...GESTORES_DO_CONTRATO)
  @Contrato({
    resumo: "O painel de habilidades da rede: cada escola, cada série, a soma das turmas.",
    descricao:
      "A coordenação REGIONAL lê as escolas da própria regional; os perfis de contrato escolhem a regional (`?regionalId=`) ou leem a rede inteira. Por escola, as séries com turma no ano letivo vigente, e em cada uma a soma da distribuição das turmas — a turma que não aplicou a missão entra como `naoAvaliado`.\n\n**Atravessa escolas SEM afrouxar a RLS**: uma transação por escola, em lotes de 8, somando na aplicação — o padrão do relatório da diretoria (ADR-82).",
    query: RedeConsolidadaQuerySchema,
    resposta: RedeConsolidadaSchema,
    notas: [
      "Para a `gestor_regional` o `?regionalId=` é IGNORADO, não validado: aceitá-lo seria dar a diretoria do vizinho por querystring.",
      "**Nome de criança nunca aparece**: o painel da rede é contagem. Para ver uma criança, abre-se a escola e a turma dela.",
      NOTA_SEM_RANKING,
    ],
  })
  async rede(@Query() query: Record<string, string>, @Req() req: Autenticado) {
    const r = RedeConsolidadaQuerySchema.safeParse(query);
    if (!r.success) throw new BadRequestException({ mensagem: "regionalId: inválido" });
    return this.consolidado.daRede(req.auth, r.data.regionalId);
  }
}

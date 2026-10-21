import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { GESTORES, ehDoContrato } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { professorDoToken } from "../comum/turmas-do-professor";
import { ehUuid } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import {
  ConteudoDaTurmaSchema,
  GateDaTurmaSchema,
  GateSchema,
  HomologacaoSchema,
  PainelSchema,
  ParametrosDoPreparoSchema,
  TurmasSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { ManifestoIaService } from "./manifesto-ia.service";
import { PreparoDaExp08ef4bService } from "./preparo.service";

/**
 * Visão do PROFESSOR (e gestor) sobre a exp08ef4b — classe separada para o
 * `@Roles` ficar limpo, como na exp06ef2b e na exp07ef1b. A separação é decisão de
 * segurança, não de estilo: o gestor não tem rota que aceite `estudanteId`.
 *
 * `gestor_contrato` é a única exceção cross-escola (regra 1): o token dele tem
 * escola vazia, então precisa dizer `?escolaId=` — e o valor vai EXPLÍCITO ao
 * `comTenancy`, porque o `TenancyInterceptor` não abre contexto para ele.
 *
 * Quem conduz a aula é o professor, mas o GESTOR da escola alcança as mesmas
 * rotas — inclusive homologar o pacote —, e isso segue o padrão da exp06ef2b e da
 * exp07ef1b de propósito: `professorLeciona` exige matrícula de quem é professor e
 * aceita o gestor da escola. Restringir a curadoria ao regente daria ao gestor
 * uma tela em que o botão responde 404 sem dizer por quê, e a exigência 8.2
 * pede que um humano da escola aprove — não que seja o regente.
 */

type Autenticado = { auth: AuthClaims };

function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (ehDoContrato(auth.perfil)) {
    if (!escolaIdPedida) throw erroDeJogo("escola-obrigatoria");
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw new ForbiddenException("professor e gestor só veem a própria escola");
  }
  return auth.escolaId;
}

function turmaOu400(turmaId: string): string {
  if (!ehUuid(turmaId)) {
    throw new BadRequestException({
      codigo: "turma-nao-encontrada",
      mensagem: "Turma inválida.",
    });
  }
  return turmaId;
}

@Controller("manifesto-ia/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class ManifestoIaTurmasController {
  constructor(
    private readonly manifesto: ManifestoIaService,
    private readonly preparo: PreparoDaExp08ef4bService,
  ) {}

  @Get()
  @Contrato({
    resumo: "Turmas para o seletor do painel.",
    descricao:
      "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. `gestor_contrato` precisa dizer `?escolaId=`.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmasSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.manifesto.turmas(
      escolaAlvo(req.auth, escolaIdPedida),
      professorDoToken(req.auth),
    );
  }

  @Get(":turmaId/painel")
  @Contrato({
    resumo: "O painel de mediação ao vivo (Checkpoint A).",
    descricao:
      "Uma linha por estudante mais o resumo agregado. **Sem coluna de pontos, sem nível e sem taxa de acerto** (PED-07 / D6b e `PROIBIDO_NO_PAINEL`): nesta missão a tentação é específica — com quatro cláusulas e uma 'mais votada', calcular percentual de acerto é o erro natural de quem chegar depois, e as quatro são salvaguardas válidas.\n\n`distribuicao` conta os votos por cláusula: é o material das três perguntas do debate.\n\n`justificativaTexto` sai NESTA rota e só nela: é caixa livre de menor de idade, e quem a lê é o professor da turma dela (LGPD art. 14).",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: PainelSchema,
    notas: [
      "`ociosoMin` alimenta o alerta de inatividade (> 3 min). Serve para o professor ir até a carteira, não para punir.",
      "`auditouOMinimo` é o indicador central da missão: quantos contraditaram a máquina ao menos duas vezes antes de fixar a regra.",
      "`tags` no resumo é a nuvem agregada da sala. No nível do estudante ela é nominal, porque a professora precisa saber com quem conversar.",
    ],
  })
  painel(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.manifesto.painel(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/conteudo")
  @Contrato({
    resumo: "O pacote da turma, com o material de mediação.",
    descricao:
      "**Professor only**, e é aqui que a `replicaIa` de cada questionamento e a `justificativaSugerida` de cada cláusula aparecem — as duas coisas que a rota do estudante recorta. A professora as lê ANTES da aula, de propósito: são o roteiro dela.\n\nSem pacote homologado devolve o curado da Unooria com `aprovadoPorProfessor: false`. Não é erro: o banco default é homologado pela Unooria, e a missão roda inteira com ele.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: ConteudoDaTurmaSchema,
  })
  conteudo(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.manifesto.conteudoParaOProfessor(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera um RASCUNHO do pacote da turma com IA (pré-aula).",
    descricao:
      "A única chamada de IA desta experiência, e ela roda **antes** da aula, com o professor olhando. Em sala o motor é 100% determinístico: nenhum token de estudante é gasto e nenhuma aula depende de o Vertex estar de pé.\n\n**Não persiste nada.** O que volta é rascunho para a tela editar; publicar é o `POST /homologar` (exigência 8.2 / PED-04).\n\nFalha de vendor, quota esgotada ou saída fora do formato devolvem o pacote CURADO com `usouIa: false` — e a tela diz 'Utilizando pacote curado padrão da Unooria' em vez de fingir que a IA respondeu. O único jeito de esta rota estragar a aula seria bloquear a professora.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: ParametrosDoPreparoSchema,
    resposta: ConteudoDaTurmaSchema.extend({ usouIa: z.boolean() }),
    notas: [
      "A quota é a do PERFIL (ADR-74): `temSaldo` antes, e o que o vendor cobrou é debitado por TENTATIVA — inclusive as que a validação rejeitou, porque foram pagas igual.",
      "A validação rejeita balão acima de 60 palavras e termo proibido na tela, e rejeitar faz o modelo REGERAR: vale mais que aceitar e contar com a revisão humana de um texto que a professora talvez só passe o olho.",
      "Os ids das cláusulas e dos questionamentos são fixados pela ordem do catálogo, nunca pelo que o modelo devolveu: id inventado produziria uma cláusula que a tela mostra e o servidor não reconhece.",
    ],
  })
  async gerarConteudo(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() body: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const parsed = ParametrosDoPreparoSchema.safeParse(body);
    if (!parsed.success) throw erroDeJogo("payload-invalido");

    /* A leitura do conteúdo serve de guarda de turma ANTES de gastar token:
       gerar para uma turma que o professor não leciona seria pagar pelo erro
       antes de descobri-lo. */
    await this.manifesto.conteudoParaOProfessor(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );

    const { pacote, usouIa } = await this.preparo.gerar(
      escolaId,
      req.auth.usuarioId,
      req.auth.perfil,
      parsed.data,
    );
    return {
      ...pacote,
      usouIa,
      // Rascunho: nada foi gravado, então nada está aprovado.
      aprovadoPorProfessor: false,
      usouBancoDefault: !usouIa,
      atualizadoEm: null,
    };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: 'O clique em "Aprovar Conteúdo da Turma" — o portão da exigência 8.2.',
    descricao:
      "Grava o pacote como a professora o deixou e marca `aprovado_por_professor: true`. **É o único lugar que liga esse booleano**, e é ele que a rota do estudante consulta: sem homologação, a missão lê o banco curado da Unooria.\n\nO corpo carrega o pacote INTEIRO em vez de um `{ aprovado: true }` porque a curadoria é editar: a professora pode reescrever qualquer réplica ou cláusula antes de aprovar. Aprovar sem editar manda de volta o que a tela recebeu — o que também é curadoria, porque passou pelos olhos dela.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: HomologacaoSchema.extend({
      casoContextual: z.string().min(3).max(120),
      focoPrioritario: z.string().min(3).max(120),
      usouBancoDefault: z.boolean(),
    }),
    resposta: ConteudoDaTurmaSchema,
    notas: [
      "Idempotente: homologar duas vezes é exatamente o clique que se dá duas vezes.",
      "Sobrevive ao 'Zerar turma'. O preparo custou tempo da professora, e apagá-lo junto obrigaria a refazer a curadoria para aplicar a missão na turma seguinte no mesmo dia.",
    ],
  })
  homologar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() body: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const parsed = HomologacaoSchema.extend({
      casoContextual: z.string().trim().min(3).max(120),
      focoPrioritario: z.string().trim().min(3).max(120),
      usouBancoDefault: z.boolean(),
    }).safeParse(body);
    if (!parsed.success) throw erroDeJogo("payload-invalido");
    const { contexto, prompts, clausulas, casoContextual, focoPrioritario, usouBancoDefault } =
      parsed.data;
    return this.manifesto.homologar(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      { contexto, prompts: [...prompts], clausulas: [...clausulas] },
      usouBancoDefault,
      { casoContextual, focoPrioritario },
    );
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: "O botão mestre: Pausar para Debate / Retomar Missão.",
    descricao:
      "O Checkpoint A. É o que congela 30 telas ao mesmo tempo para o debate oral de 10 minutos — e é a rota que o polling de 5s do estudante lê (`GET /manifesto-ia/gate`), porque **não há WebSocket de aplicação no Cloud Run** (ADR-93).\n\n**Idempotente de propósito**: apertar duas vezes é exatamente o clique que se dá duas vezes, e a segunda não pode derrubar nada.\n\nO gate mexe só no TETO do passo, nunca no piso: pausar não empurra para a frente quem ainda estava auditando a máquina — e são justamente essas crianças que o debate tenta alcançar.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "Quem já assinou o percurso fica onde está: `pausar-para-debate` não o traz de volta. O latch é do estudante, não da turma.",
      "A missão corre inteira sem ninguém apertar nada: o congelamento é opcional, porque a spec admite a sessão assíncrona individual.",
    ],
  })
  gate(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() body: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const parsed = GateSchema.safeParse(body);
    if (!parsed.success) throw erroDeJogo("payload-invalido");
    return this.manifesto.mudarGate(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      parsed.data.acao,
    );
  }

  @Delete(":turmaId")
  @HttpCode(200)
  @Contrato({
    resumo: "Zerar a turma — a segunda aplicação.",
    descricao:
      "Apaga sessões, auditorias e percursos desta turma (CASCADE da sessão) e devolve o gate a `missao`, senão a turma nova nasceria congelada num debate que já aconteceu. **Preserva `telemetria_eventos`**, que é a trilha analítica imutável, **e preserva `exp08ef4b_conteudo_turma`**: a curadoria da professora não é execução de estudante.\n\nO percurso vai junto, e isso é deliberado: refazer a missão com o parágrafo da turma do ano passado na tela seria um portfólio que mistura duas turmas.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: ZerarTurmaSchema,
  })
  zerar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.manifesto.zerarTurma(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }
}

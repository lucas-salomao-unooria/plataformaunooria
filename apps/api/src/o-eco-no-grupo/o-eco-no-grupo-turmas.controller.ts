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
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { professorDoToken } from "../comum/turmas-do-professor";
import { ehUuid } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import {
  GateDaTurmaSchema,
  GateSchema,
  PainelDaTurmaSchema,
  PreparoDaMidiaSchema,
  TurmasDoEcoSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { OEcoNoGrupoService } from "./o-eco-no-grupo.service";
import { GESTORES, ehDoContrato} from "../auth/claims";

/**
 * Visão do PROFESSOR (e gestor) sobre a exp07ef1b — classe separada para o
 * `@Roles` ficar limpo, como em `unootube-turmas.controller.ts`. A separação é
 * decisão de segurança, não de estilo: o gestor não tem rota que aceite
 * `estudanteId`.
 *
 * `gestor_contrato` é a única exceção cross-escola (regra 1): o token dele tem
 * escola vazia, então precisa dizer `?escolaId=` — e o valor vai EXPLÍCITO ao
 * `comTenancy`, porque o TenancyInterceptor não abre contexto para ele.
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

@Controller("o-eco-no-grupo/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class OEcoNoGrupoTurmasController {
  constructor(private readonly eco: OEcoNoGrupoService) {}

  @Get()
  @Contrato({
    resumo: "Turmas para o seletor do painel.",
    descricao:
      "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. `gestor_contrato` precisa dizer `?escolaId=`.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmasDoEcoSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.eco.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/painel")
  @Contrato({
    resumo: "O que a turma está fazendo na missão, ao vivo.",
    descricao:
      "Uma linha por estudante mais o resumo agregado. **Sem coluna de pontos**: a leitura é de progresso e de estratégia, não uma ordenação de crianças (PED-07).\n\n`distribuicao` conta A/B/C entre quem respondeu — é o material do debate, e aparece na tela como percentual da turma, nunca como 'quem errou'.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: PainelDaTurmaSchema,
    notas: [
      "`ociosoMin` alimenta o alerta de inatividade (> 3 min). Serve para o professor ir até a carteira.",
      "`percursoComAsDuas` conta quem marcou as duas estratégias que a missão ensinou. Não é nota, e não aparece por estudante.",
    ],
  })
  painel(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.eco.painel(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: "Abre a Aula 2, congela o debate ou libera a reflexão.",
    descricao:
      "O relógio da AULA. É o que permite dizer 'agora é debate' e travar 30 telas de uma vez.\n\n**Idempotente de propósito**: `liberar-aula2` duas vezes é exatamente o clique que se dá duas vezes, e a segunda não pode derrubar nada. `redefinir` volta ao pré-aula SEM apagar percurso — é para quem abriu a aula antes da hora, não um 'zerar'.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "A etapa é PISO e TETO ao mesmo tempo: quem está adiantado não é puxado de volta (seria punir quem leu rápido), mas ninguém passa do breakpoint antes da Aula 2 nem da síntese antes do debate.",
      "`congelar-debate` é a exceção que trava: no debate a turma tem de estar na mesma tela, porque a conversa é entre pares.",
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
    return this.eco.mexerNoGate(
      escolaId,
      turmaOu400(turmaId),
      parsed.data.acao,
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/preparar-midia")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera as vozes e as fotos da missão (preparo da aula).",
    descricao:
      "Idempotente: o que já está no bucket é pulado, e preparar duas vezes é de graça.\n\nÉ o PROFESSOR quem prepara, não o primeiro estudante que abre a missão — a quota diária dele é 2 milhões de tokens contra 300 mil do estudante, e uma síntese de voz leva dezenas de segundos que ninguém deve esperar no meio da aula.\n\nA mídia é do CONTRATO, não da escola: toda a rede ouve a mesma Dona Lúcia. Duas turmas discutindo vozes diferentes do mesmo boato não estariam falando da mesma coisa.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: PreparoDaMidiaSchema,
    notas: [
      "Uma falha não derruba as outras: `falharam` lista o que não saiu, e a missão continua jogável — o áudio cai na transcrição e a foto na ilustração procedural.",
      "O print viral NÃO é gerado: ele é um recorte da foto da reportagem, para o par casado ser a mesma cena. Por isso a ordem de preparo importa.",
      "429 `teto-da-sessao` quando a quota diária de IA do professor acabou.",
    ],
  })
  prepararMidia(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.eco.prepararMidia(
      escolaId,
      turmaOu400(turmaId),
      req.auth.usuarioId,
      req.auth.perfil,
    );
  }

  @Delete(":turmaId")
  @Contrato({
    resumo: "Zerar a turma para uma segunda aplicação.",
    descricao:
      "Apaga o estado transacional da turma (sessões, conversa com Amara, percursos) e o gate da aula. **Preserva `telemetria_eventos`**, que é a trilha analítica imutável — a aula anterior continua legível para a rede.",
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
    return this.eco.zerarTurma(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }
}

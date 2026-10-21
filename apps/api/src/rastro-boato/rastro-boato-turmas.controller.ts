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
  PainelSchema,
  TurmasSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { RastroBoatoService } from "./rastro-boato.service";
import { GESTORES, ehDoContrato} from "../auth/claims";

/**
 * Visão do PROFESSOR (e gestor) sobre a exp06ef2b — classe separada para o
 * `@Roles` ficar limpo, como na exp07ef1b. A separação é decisão de segurança, não
 * de estilo: o gestor não tem rota que aceite `estudanteId`.
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

@Controller("rastro-boato/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class RastroBoatoTurmasController {
  constructor(private readonly rastro: RastroBoatoService) {}

  @Get()
  @Contrato({
    resumo: "Turmas para o seletor do painel.",
    descricao:
      "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. `gestor_contrato` precisa dizer `?escolaId=`.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmasSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.rastro.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/painel")
  @Contrato({
    resumo: "O que a turma está fazendo na missão, ao vivo.",
    descricao:
      "Uma linha por estudante mais o resumo agregado. **Sem coluna de pontos e sem nível** (PED-07 e `PROIBIDO_NO_PAINEL`): a leitura é de PROGRESSO. Uma coluna de pontos ordenaria crianças na leitura ainda que a tela não ordenasse.\n\n`distribuicao` conta A/B/C entre quem respondeu — é o material do debate, nunca 'quem errou'.\n\n`reflexaoTexto` sai NESTA rota e só nela: é caixa livre de menor de idade, e quem a lê é o professor da turma dela (LGPD art. 14).",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: PainelSchema,
    notas: [
      "`ociosoMin` alimenta o alerta de inatividade (> 3 min). Serve para o professor ir até a carteira, não para punir.",
      "`estouraramOAlerta` conta quem deixou o timer de 90s aparecer no pico. É o sinal da hipótese H3 do playtest, e um número alto pede intervenção oral — não uma anotação sobre a criança.",
      "`auditaramTudo` é o KPI-01 da missão: quantos inspecionaram 3 ou mais metadados antes de intervir.",
    ],
  })
  painel(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.rastro.painel(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: "Abre a Aula 2, ou pausa a simulação de volta na Aula 1.",
    descricao:
      "O relógio da AULA. É o que permite fechar a Aula 1 em 30 telas ao mesmo tempo e fazer a turma chegar junta ao mapa da rede.\n\n**Idempotente de propósito**: `liberar-aula2` duas vezes é exatamente o clique que se dá duas vezes, e a segunda não pode derrubar nada. `pausar-simulacao` volta para `aula1` SEM apagar nada — é para quem abriu a Aula 2 antes da hora.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "A etapa é PISO e TETO ao mesmo tempo: quem está adiantado não é puxado de volta (seria punir quem leu rápido), mas ninguém passa do breakpoint antes da Aula 2.",
      "Quem já entregou o percurso fica em `fim`: `pausar-simulacao` não o traz de volta. O latch é do estudante, não da turma.",
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
    return this.rastro.mexerNoGate(
      escolaId,
      turmaOu400(turmaId),
      parsed.data.acao,
      professorDoToken(req.auth),
    );
  }

  @Delete(":turmaId")
  @HttpCode(200)
  @Contrato({
    resumo: "Zerar a turma — a segunda aplicação.",
    descricao:
      "Apaga sessões, auditorias, percursos e o gate desta turma para a missão poder ser refeita no ano seguinte (PED-13). **Preserva `telemetria_eventos`**, que é a trilha analítica imutável.\n\nO percurso vai junto, e isso é deliberado: refazer a missão com a reflexão da turma do ano passado na tela seria um portfólio que mistura duas turmas.",
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
    return this.rastro.zerarTurma(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }
}

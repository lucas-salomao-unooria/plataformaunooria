import {
  Body,
  Controller,
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
import { Contrato } from "../openapi/contrato";
import {
  AprovarBodySchema,
  ConfigBodySchema,
  GeracaoSchema,
  LiberarRespostaSchema,
  PainelSchema,
  ProjecaoSchema,
  ResetRespostaSchema,
  TurmasSchema,
} from "./contrato-de-rotas";
import { erroDaMissao } from "./erros";
import { FotoContaService } from "./foto-conta.service";
import { IaDaFotoContaService } from "./ia.service";
import { PACOTE_PADRAO } from "./catalogo";

/**
 * Rotas do PROFESSOR da exp-04 (preparação, dashboard ao vivo, projeção da
 * lousa, latch e reset). Classe separada do estudante para o `@Roles` ficar
 * limpo — molde do `o-eco-no-grupo-turmas.controller.ts`.
 *
 * Toda rota com `turmaId` passa por `turmaVisivel` no service: `@Roles`
 * protege a rota, a MATRÍCULA protege a turma (a lição das seis rotas de
 * 2026-09-05).
 */

type Autenticado = { auth: AuthClaims };

/** Perfis de contrato têm escola vazia no token: precisam dizer `?escolaId=`. */
function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (ehDoContrato(auth.perfil)) {
    if (!escolaIdPedida) throw erroDaMissao("turma-nao-encontrada");
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw erroDaMissao("turma-nao-encontrada");
  }
  return auth.escolaId;
}

function turmaOu400(turmaId: string): string {
  const parsed = z.string().uuid().safeParse(turmaId);
  if (!parsed.success) throw erroDaMissao("payload-invalido");
  return parsed.data;
}

@Controller("foto-conta/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class FotoContaTurmasController {
  constructor(
    private readonly fotoConta: FotoContaService,
    private readonly ia: IaDaFotoContaService,
  ) {}

  @Get()
  @Contrato({
    resumo: "As turmas de quem pergunta, para o seletor do painel.",
    descricao:
      "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. Perfis de contrato precisam dizer `?escolaId=`.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: TurmasSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.fotoConta.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId")
  @Contrato({
    resumo: "O dashboard ao vivo: distribuição A/B, latch e a lista de hesitação.",
    descricao:
      "É o alvo do polling do painel durante a aula (~5s). `hesitando` traz id E nome — o nome é hidratado AQUI, da matrícula autenticada da turma (DAD-07): o modelo da run, a telemetria e o canal de status só conhecem o id opaco.\n\nSem ranking, sem nota, sem ordem de velocidade: as métricas proibidas do handoff não existem neste payload por desenho.",
    resposta: PainelSchema,
    notas: [
      "\"Hesitação\" é run parada na etapa de decisão há mais de 60s — a lista de mediação de leitura, não um alerta de desempenho.",
    ],
  })
  painel(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    return this.fotoConta.painel(
      req.auth.escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/configurar")
  @HttpCode(200)
  @Contrato({
    resumo: "Grava tema e nível de leitura da turma (o passo anterior à geração).",
    corpo: ConfigBodySchema,
    resposta: z.object({ ok: z.literal(true) }),
  })
  configurar(
    @Param("turmaId") turmaId: string,
    @Body() body: unknown,
    @Req() req: Autenticado,
  ) {
    const corpo = ConfigBodySchema.safeParse(body);
    if (!corpo.success) throw erroDaMissao("payload-invalido");
    return this.fotoConta.configurar(
      req.auth.escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      corpo.data,
    );
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera o pacote da aula com IA (Vertex), para o preview do professor.",
    descricao:
      "A IA escreve os TEXTOS (legendas e comentários) adaptados ao tema e ao nível de leitura; as fotos são sempre do banco curado, e a estrutura (3 posts, 2 legendas, 4 combinações) é fixa do servidor. `daIa: false` = a geração não deu (sem saldo, provider fora, saída reprovada) e o pacote devolvido é o banco curado padrão — a tela diz isso com todas as letras.\n\nNada disso chega à turma sem o `aprovar-pacote`: curadoria docente é obrigatória (bloco 14 do one-pager).",
    corpo: ConfigBodySchema,
    resposta: GeracaoSchema,
    notas: [
      "Passa pelo QuotaService por usuário/dia e POR PERFIL (regra inviolável 5); a recusa por saldo cai no mesmo `daIa: false`.",
      "Os comentários aparecem AQUI (preview do professor) — são o material da mediação dele; do estudante, continuam escondidos até a publicação.",
    ],
  })
  async gerar(
    @Param("turmaId") turmaId: string,
    @Body() body: unknown,
    @Req() req: Autenticado,
  ) {
    const corpo = ConfigBodySchema.safeParse(body);
    if (!corpo.success) throw erroDaMissao("payload-invalido");
    const turma = turmaOu400(turmaId);
    // Grava a configuração ANTES de gerar: se a IA falhar, o tema escolhido
    // não se perde — e é a mesma validação de matrícula das outras rotas.
    await this.fotoConta.configurar(
      req.auth.escolaId,
      turma,
      professorDoToken(req.auth),
      corpo.data,
    );
    const gerado = await this.ia.gerarPacote(
      req.auth.escolaId,
      req.auth.usuarioId,
      req.auth.perfil,
      corpo.data.tema,
      corpo.data.complexidade,
    );
    return gerado ? { pacote: gerado, daIa: true } : { pacote: PACOTE_PADRAO, daIa: false };
  }

  @Post(":turmaId/aprovar-pacote")
  @HttpCode(200)
  @Contrato({
    resumo: "Aprova o pacote conferido no preview — o `cfg_turma_ready` da spec.",
    descricao:
      "A api REVALIDA o pacote inteiro com o MESMO schema da geração: aprovação é o último portão antes da turma, não um carimbo. Sem aprovação até a aula, o banco curado padrão assume sozinho (fallback do bloco 9 — a aula nunca fica sem material).",
    corpo: AprovarBodySchema,
    resposta: z.object({ ok: z.literal(true) }),
  })
  aprovar(
    @Param("turmaId") turmaId: string,
    @Body() body: unknown,
    @Req() req: Autenticado,
  ) {
    const corpo = AprovarBodySchema.safeParse(body);
    if (!corpo.success) throw erroDaMissao("payload-invalido");
    return this.fotoConta.aprovar(
      req.auth.escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      corpo.data.pacote,
      corpo.data.daIa,
    );
  }

  @Get(":turmaId/projecao")
  @Contrato({
    resumo: "A projeção da lousa (E5): o par lado a lado, os rótulos e as 3 perguntas.",
    descricao:
      "O material do debate vem da API, nunca de cópia no hub: uma vírgula divergente entre o que os tablets mostraram e o que a lousa projeta põe a sala discutindo uma foto que ninguém viu. `noLatch`/`conectados` são o termômetro de \"a turma toda chegou\".",
    resposta: ProjecaoSchema,
  })
  projecao(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    return this.fotoConta.projecao(
      req.auth.escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/destravar-latch")
  @HttpCode(200)
  @Contrato({
    resumo: "LIBERAR REFLEXÃO FINAL: destrava os tablets da turma inteira.",
    descricao:
      "UPDATE simples e sem lock de linha (DAD-11): quem \"recebe o broadcast\" é o polling de 3s dos tablets. Liberar de novo responde `409 latch-ja-liberado` — idempotência por erro, e a mensagem diz que está tudo bem: a turma JÁ está liberada.",
    resposta: LiberarRespostaSchema,
    notas: [
      "`tabletsNoLatch` é a contagem no instante da liberação — a confirmação visual do painel (\"N tablets receberam o sinal\" chega pelo polling seguinte do dashboard).",
    ],
  })
  liberar(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    return this.fotoConta.liberarLatch(
      req.auth.escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/reset")
  @HttpCode(200)
  @Contrato({
    resumo: "Zerar e Reiniciar Turma: arquiva a tentativa e rearma o latch.",
    descricao:
      "Transação serializada (DAD-11): a `tentativa` incrementa e as runs anteriores ficam ARQUIVADAS na tentativa velha, imutáveis (DAD-06) — nada é apagado, e o histórico analítico não é tocado. Os tablets veem o número novo no boot seguinte e recomeçam do crachá.\n\nO guia do professor recomenda TROCAR o tema na reaplicação no mesmo ano (PED-13): repetir o pacote mede memória, não leitura de imagem — recomendação, não automatismo.",
    resposta: ResetRespostaSchema,
  })
  reset(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    return this.fotoConta.reset(
      req.auth.escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );
  }
}

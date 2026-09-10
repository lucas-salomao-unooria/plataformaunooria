import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import {
  DisponibilidadeGuard,
  Recurso,
  SemDisponibilidade,
} from "../comum/disponibilidade.guard";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { BemEstarService } from "./bemestar.service";
import { ResponderSchema } from "./catalogo";
import {
  ApagadoSchema,
  HistoricoSchema,
  HojeSchema,
  RespondidoSchema,
  ResumoSchema,
} from "./contrato-de-rotas";

/**
 * Rotas do PROFESSOR da exp-91-bem-estar. Identidade sempre do token; posse
 * checada em toda rota com id. NÃO existe rota de gestor/admin aqui de
 * propósito: as respostas são dado sensível de saúde do professor e só ele lê
 * (ver docs/DECISOES.md).
 */

type Autenticado = { auth: AuthClaims };

function limitar(chave: string, limite: number, janelaMs: number) {
  const r = rateLimit(chave, limite, janelaMs);
  if (!r.ok) {
    throw new HttpException(
      { codigo: "RATE_LIMIT", mensagem: `Muitas requisições seguidas. Tente de novo em ${r.retryAfterSeconds}s.` },
      429,
    );
  }
}

@Controller("bemestar")
@UseGuards(OidcGuard, RolesGuard, DisponibilidadeGuard)
@Roles("professor")
/* O interruptor da rede (ADR-87), por CLASSE: rota nova desta ferramenta nasce
   coberta. A exceção é declarada com `@SemDisponibilidade()`, e só vale para
   apagar os próprios dados. */
@Recurso("exp-91-bem-estar")
export class BemEstarController {
  constructor(private readonly bemEstar: BemEstarService) {}

  /** Estado leve para o card do hub — sem abrir ciclo nem chamar IA. */
  @Get("resumo")
  @Contrato({
    resumo: "Estado leve do check-in, para o card do hub.",
    descricao:
      "**Não abre ciclo e não chama IA** — é o que o card do hub lê a cada carregamento, e um card não pode custar uma geração.",
    resposta: ResumoSchema,
  })
  resumo(@Req() req: Autenticado) {
    limitar(`bemestar:resumo:${req.auth.usuarioId}`, 120, 60 * 60_000);
    return this.bemEstar.resumo(req.auth.escolaId, req.auth.usuarioId);
  }

  /** O check-in de hoje (cria o pendente se ainda não houver — pode chamar IA). */
  @Get("hoje")
  @Contrato({
    resumo: "O check-in de hoje — o já respondido, o pendente, ou um novo.",
    descricao:
      "**3 frases por dia; 7 check-ins fecham os 21 itens** do DASS-21. Cria o pendente se ainda não houver, e nesse caminho chama a IA para o entorno.\n\nOs 21 itens são FIXOS e *verbatim*: a IA nunca reescreve um item — reformular quebra a validação psicométrica e as faixas de corte. O que ela gera é a abertura do dia, a pergunta aberta e o acolhimento.",
    resposta: HojeSchema,
    notas: [
      "Todo texto de IA passa por `validarTextoDaIa` (sem vocabulário clínico, ordens, promessas, gestão, links). Barrado, sem saldo ou sem provider ⇒ texto fixo do catálogo: **o check-in nunca deixa de abrir**.",
      "A IA nunca recebe nome, escola, pontuação ou faixa — só dia da semana, mês, nº do check-in e o texto livre, delimitado como conteúdo.",
      "1 por dia, em `America/Sao_Paulo`. O ciclo expira em 21 dias sem fechar.",
    ],
  })
  hoje(@Req() req: Autenticado) {
    limitar(`bemestar:hoje:${req.auth.usuarioId}`, 60, 60 * 60_000);
    return this.bemEstar.hoje(req.auth.escolaId, req.auth.usuarioId, req.auth.perfil);
  }

  @Post("checkins/:id/respostas")
  @Contrato({
    resumo: "Responde as três frases do dia.",
    descricao:
      "No **7º** check-in a api soma por subescala (×2) e classifica pelas faixas publicadas — correção server-side (regra 3) —, e o ciclo fecha com `resultado` preenchido.",
    params: z.object({ id: z.string().uuid() }),
    corpo: ResponderSchema,
    resposta: RespondidoSchema,
    notas: [
      "**Sinal de apoio**: item 17 ou 21 ≥ 2, ou termo de risco no texto ⇒ mensagem FIXA (CVV 188, SAMU 192, CAPS/UBS) e **a IA não é chamada**.",
      "Responder duas vezes no mesmo dia é **409** com `codigo: JA_RESPONDIDO`.",
      "O texto livre nunca vai a log nem à telemetria — só contagens.",
    ],
  })
  responder(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    limitar(`bemestar:responder:${req.auth.usuarioId}`, 20, 60 * 60_000);
    const parsed = ResponderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ mensagem: "Responda às três frases (0 a 3); o texto livre tem até 600 caracteres." });
    }
    return this.bemEstar.responder(req.auth.escolaId, req.auth.usuarioId, req.auth.perfil, id, parsed.data);
  }

  @Get("historico")
  @Contrato({
    resumo: "Os ciclos concluídos e as anotações — só do próprio professor.",
    descricao:
      "Posse por `professor_id` em toda query, com RLS por cima. **Não existe rota de gestor nem agregado** em lugar nenhum: DASS-21 é dado sensível de saúde (LGPD art. 11), e só o professor lê o dele.",
    resposta: HistoricoSchema,
  })
  historico(@Req() req: Autenticado) {
    limitar(`bemestar:historico:${req.auth.usuarioId}`, 60, 60 * 60_000);
    return this.bemEstar.historico(req.auth.escolaId, req.auth.usuarioId);
  }

  /** LGPD (direito de eliminação): apaga tudo do professor logado. */
  /* Fora do interruptor: apagar os próprios dados (DASS-21, sensível). Um produto desligado fecha tudo, menos
     isto — interruptor que prende dado é indefensável (ADR-87). */
  @SemDisponibilidade()
  @Delete("dados")
  @Contrato({
    resumo: "Apaga TUDO do bem-estar do professor logado.",
    descricao:
      "Direito de eliminação (LGPD). Apaga de verdade — ciclos e check-ins —, e a resposta diz quanto sumiu.",
    resposta: ApagadoSchema,
  })
  apagar(@Req() req: Autenticado) {
    limitar(`bemestar:apagar:${req.auth.usuarioId}`, 5, 60 * 60_000);
    return this.bemEstar.apagarTudo(req.auth.escolaId, req.auth.usuarioId);
  }
}

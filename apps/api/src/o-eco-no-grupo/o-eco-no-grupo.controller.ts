import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AcaoSchema,
  AmaraRespostaSchema,
  AmaraSchema,
  EstadoSchema,
  GatePublicoSchema,
  IntervencaoRespostaSchema,
  IntervencaoSchema,
  MidiaSchema,
  ReflexaoRespostaSchema,
  ReflexaoSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { OEcoNoGrupoService } from "./o-eco-no-grupo.service";
import { PASSOS } from "./regras/passos";

/**
 * Rotas do ESTUDANTE da exp-07-o-eco-no-grupo.
 *
 * O gabarito fica no servidor: o cliente manda qual opção escolheu, a api
 * corrige contra o catálogo e devolve o desfecho e as reações do bairro
 * (regra inviolável nº 3). Identidade — inclusive a TURMA, que é o que liga o
 * estudante ao gate da aula — sai sempre do token, nunca do body.
 */

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`eco:${usuarioId}`, limite, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
  }
}

function valida<T>(schema: z.ZodType<T>, corpo: unknown): T {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

@Controller("o-eco-no-grupo")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class OEcoNoGrupoController {
  constructor(private readonly eco: OEcoNoGrupoService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão, o conteúdo do grupo e a matéria completa.",
    descricao:
      'As 3 opções de resposta saem **sem `desfecho` e sem `correta`** — o tipo do servidor é `Omit<Opcao, "desfecho" | "correta">`, então o gabarito é impossível de vazar aqui, não só ausente por descuido.\n\nO conteúdo do feed vem da api, e não do bundle, para que uma correção de texto não exija republicar um caminho imutável no bucket.',
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o cru. Quando os dois divergem e `aguardandoATurma` é `true`, o estudante está preso esperando a aula — e a tela de espera do breakpoint é diferente da tela congelada do debate.",
      "`midia.urls` com `null` num id significa que a mídia ainda não foi preparada: o cliente cai na transcrição e na ilustração procedural, em vez de esperar um arquivo que não existe.",
      "`reacoes` já gravadas voltam iguais depois de um F5 — regerar mostraria o bairro reagindo de outro jeito à mesma mensagem.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.eco.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está (polling de ~5s).",
    descricao:
      "Leve de propósito: sem catálogo e sem mídia. É o que deixa a professora conduzir 30 telas — a Aula 2 abre para todos ao mesmo tempo, e o debate congela todos na mesma tela.\n\n`agora` é o instante do SERVIDOR: o relógio da máquina da escola atrasa, e não é ele que decide o momento da aula.",
    query: z.object({ passo: z.enum(PASSOS).optional() }),
    resposta: GatePublicoSchema,
    notas: [
      "Estudante sem turma não tem gate: a missão corre no ritmo dele. Prendê-lo no breakpoint seria um beco sem saída, porque não há quem dê a largada.",
    ],
  })
  gate(@Query("passo") passo: string | undefined, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.eco.gate(req.auth.escolaId, turmaDo(req.auth), passo);
  }

  @Post("acao")
  @HttpCode(200)
  @Contrato({
    resumo: "Registra uma marca da investigação.",
    descricao:
      "Todas as marcas são idempotentes e só andam para a frente: abrir a matéria três vezes mantém o dado em `true`. O que a missão mede é se ela foi aberta ANTES de responder, não quantas vezes.",
    corpo: AcaoSchema,
    resposta: EstadoSchema,
    notas: [
      "`inspecionar-materia` é a evidência da BNCC EF07CO01 e a condição de enviar a intervenção.",
      "`ouvir-podcast` só vale na Aula 2: marcá-lo durante a investigação destravaria a decisão antes da largada.",
    ],
  })
  acao(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { acao } = valida(AcaoSchema, body);
    return this.eco.acao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), acao);
  }

  @Post("intervencao")
  @HttpCode(200)
  @Contrato({
    resumo: "Envia a resposta citando o print — o pico da missão.",
    descricao:
      "A api corrige contra o catálogo e devolve o `desfecho` com as reações do bairro. O cliente manda só qual opção foi escolhida e quanto tempo levou para decidir.\n\nDois portões, e os dois são pedagógicos: a Aula 2 precisa estar aberta, e a matéria íntegra precisa ter sido inspecionada (`sem-inspecao`) — este é o portão que a missão existe para instalar.",
    corpo: IntervencaoSchema,
    resposta: IntervencaoRespostaSchema,
    notas: [
      "`latenciaSeg` é o tempo de DECISÃO do estudante, cronometrado pelo cliente — não a latência da requisição.",
      "A resposta checada é LATCH: o Admin fixa a mensagem e o chat não regride. As outras duas abrem o 'Apagar para todos'.",
      "409 `sem-inspecao` quando ele tenta responder sem ter aberto a matéria.",
    ],
  })
  intervencao(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { opcao, latenciaSeg } = valida(IntervencaoSchema, body);
    return this.eco.intervencao(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      req.auth.perfil,
      opcao,
      latenciaSeg,
    );
  }

  @Post("desfazer")
  @HttpCode(200)
  @Contrato({
    resumo: '"Apagar para todos e tentar outra resposta".',
    descricao:
      "A recuperação formativa. Só existe para quem postou no impulso: depois da contraprova a mensagem está fixada pelo Admin, e desfazê-la desmontaria a única cena em que a criança vê a checagem funcionar.\n\nIncrementa `desfazerUsado`, que reduz o `score` de 100 para 70 — a recuperação é o caminho pedagógico, não a punição.",
    resposta: EstadoSchema,
  })
  desfazer(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.eco.desfazer(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("sintese")
  @HttpCode(200)
  @Contrato({
    resumo: "Sai do mensageiro e abre os quadros de sistematização.",
    descricao:
      "Só depois da contraprova aceita pelo grupo. É a fronteira da revelação: daqui em diante quem fala é a escola, não o app.",
    resposta: EstadoSchema,
  })
  sintese(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.eco.verSintese(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("reflexao")
  @HttpCode(201)
  @Contrato({
    resumo: 'Entrega o "Meu percurso" e fecha a missão (latch).',
    descricao:
      "Exatamente 2 estratégias distintas e 1 justificativa, todas de lista fechada — zero texto livre aqui, de propósito.\n\nÉ a única rota que devolve `score`, e ele vem de `regras/pontuacao.ts` sobre o que aconteceu NO GRUPO: o formulário reflexivo não entra na nota, porque transformá-lo em prova mudaria o que a criança marca nele. O estudante nunca vê esse número.",
    corpo: ReflexaoSchema,
    resposta: ReflexaoRespostaSchema,
    status: 201,
    notas: [
      "409 `reflexao-nao-liberada` enquanto a professora não abre a etapa: o registro é depois do debate.",
      "409 `reflexao-ja-enviada` na segunda tentativa — a interface congela em modo leitura.",
    ],
  })
  reflexao(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { estrategias, justificativa } = valida(ReflexaoSchema, body);
    return this.eco.reflexao(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      req.auth.perfil,
      estrategias,
      justificativa,
    );
  }

  @Get("midia")
  @Contrato({
    resumo: "As URLs das vozes e das fotos da missão.",
    descricao:
      "Mapa `id → URL pública`, com `null` no que ainda não foi preparado — e `null` é informação: o cliente cai na transcrição (que já está na tela por acessibilidade) e na ilustração procedural, em vez de esperar um arquivo que não existe.\n\nAs URLs são **públicas** de propósito: `<audio src>` e `<img src>` não mandam o bearer, e uma rota autenticada aqui daria um player mudo.",
    resposta: MidiaSchema,
    notas: [
      "Esta rota NÃO gera nada. Quem gera é o preparo do professor — a quota dele é 2 milhões de tokens contra 300 mil do estudante, e ninguém deve esperar uma síntese de voz no meio da aula.",
    ],
  })
  async midia() {
    return { urls: await this.eco.midiaDaMissao() };
  }

  @Post("amara")
  @HttpCode(200)
  @Contrato({
    resumo: "Uma fala para Amara, no chat privado.",
    descricao:
      "Só existe DEPOIS da decisão no grupo. Antes disso ela responde `amara-em-silencio`: o silêncio dela durante a investigação é não-negociável — se ela apontasse qual mensagem é falsa, o reconhecimento de padrão que a missão mede deixaria de acontecer.\n\nÉ o **único texto livre** da experiência. Teto de 600 caracteres e 3 turnos; o texto é gravado sob RLS para a conversa voltar depois de um F5, e nunca entra em log nem em telemetria.",
    corpo: AmaraSchema,
    resposta: AmaraRespostaSchema,
    notas: [
      "409 `sem-turno` no 4º envio — ela é amiga, não assistente.",
      "503 `amara-indisponivel` quando o modelo não responde; 429 `teto-da-sessao` sem saldo de IA. As duas frases ficam dentro da ficção, sem vocabulário de infraestrutura.",
    ],
  })
  amara(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 30);
    const { texto } = valida(AmaraSchema, body);
    return this.eco.amara(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      req.auth.perfil,
      texto,
    );
  }
}

/** Só para o teste conferir que nenhuma rota nova escapou do Zod. */
export const ROTAS_DO_ESTUDANTE = [
  "sessao",
  "gate",
  "midia",
  "acao",
  "intervencao",
  "desfazer",
  "sintese",
  "reflexao",
  "amara",
] as const;

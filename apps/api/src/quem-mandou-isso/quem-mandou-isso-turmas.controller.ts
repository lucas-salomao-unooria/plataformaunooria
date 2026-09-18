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
import { PreparoDaExp05Service } from "./preparo.service";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

/**
 * Visão do PROFESSOR (e gestor) sobre a exp-05 — classe separada para o
 * `@Roles` ficar limpo, como na exp-06 e na exp-08. A separação é decisão de
 * segurança, não de estilo: o gestor não tem rota que aceite `estudanteId`.
 *
 * `gestor_contrato` é a única exceção cross-escola (regra 1): o token dele tem
 * escola vazia, então precisa dizer `?escolaId=` — e o valor vai EXPLÍCITO ao
 * `comTenancy`, porque o `TenancyInterceptor` não abre contexto para ele.
 *
 * O GESTOR da escola alcança as mesmas rotas do professor, inclusive homologar
 * o lote, e isso segue o padrão da exp-06 e da exp-08 de propósito:
 * `professorLeciona` exige matrícula de quem é professor e aceita o gestor da
 * escola. Restringir a curadoria ao regente daria ao gestor uma tela em que o
 * botão responde 404 sem dizer por quê.
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

@Controller("quem-mandou-isso/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class QuemMandouIssoTurmasController {
  constructor(
    private readonly missao: QuemMandouIssoService,
    private readonly preparo: PreparoDaExp05Service,
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
    return this.missao.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/painel")
  @Contrato({
    resumo: "O painel ao vivo: a barra de prontidão e o telão da sala.",
    descricao:
      "Uma linha por estudante mais o resumo agregado. `percentualConfirmados` é a barra de prontidão — é ela que diz à professora quando o telão pode acender.\n\n`histograma` é o telão: uma barra por mensagem, **anonimizada**, contando só quem CONFIRMOU. Nenhum nome chega até ele, e não por disciplina — a função pura que o monta não tem parâmetro para nome (PED-07).\n\n**Sem nenhuma coluna de acerto por criança** (PED-11 e `PROIBIDO_NO_PAINEL`, que tem o teste que cobra a ausência). Aqui a tentação é específica: com o gabarito a um JOIN de distância, \"quantas falsas cada um encaminhou\" é a coluna que se escreve sozinha — e ela é um ranking de quem caiu no boato. A leitura do gabarito é da SALA, no histograma.\n\n`reflexaoTexto` sai NESTA rota e só nela, e **só vem preenchido para quem LECIONA a turma**: é caixa livre de menor de idade (LGPD art. 14). Gestor, diretor e admin recebem a mesma linha com o campo em `null` — eles veem `entregouReflexao`, que responde \"a criança respondeu?\" sem entregar o que ela escreveu.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    resposta: PainelSchema,
    notas: [
      "`segundosAteOPrimeiroEncaminhamento` é o indicativo de impulsividade — o dado central da missão. `null` quando falta uma das pontas: \"repassou no mesmo segundo\" e \"não dá para saber\" são leituras opostas para quem conduz a aula.",
      "`ociosoMin` alimenta o alerta de inatividade (> 3 min). Serve para o professor ir até a carteira, não para punir.",
      "O histograma aparece antes da revelação, e só aqui: é como a professora decide a hora de acender o telão. A tela do estudante só o recebe depois do gate.",
      "`turma.preparada: false` significa que esta turma ainda não tem lote homologado — e que a missão dela está em tela de espera.",
    ],
  })
  painel(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    return this.missao.painel(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/conteudo")
  @Contrato({
    resumo: "O lote da turma, COM o gabarito.",
    descricao:
      "**Professor only**, e é aqui que `veracidade`, `tom` e `explicacao` de cada mensagem aparecem. A professora os lê ANTES da aula, de propósito: são o roteiro dela.\n\nSem lote gravado devolve o BANCO CURADO da Unooria com `aprovadoPorProfessor: false` — é o rascunho que a tela do preparo abre para editar, e o que ela aprova com um clique quando não quer gerar nada. **A tela do estudante não tem essa queda**: lá, sem homologação, é espera.",
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
    return this.missao.conteudoParaOProfessor(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera um RASCUNHO das 8 mensagens do grupo com IA (pré-aula).",
    descricao:
      "A única chamada de IA desta experiência, e ela roda **antes** da aula, com a professora olhando. Em sala o motor é 100% determinístico: nenhum token de estudante é gasto e nenhuma aula depende de o Vertex estar de pé.\n\n**Não persiste nada.** O que volta é rascunho para a tela editar; publicar é o `POST /homologar` (RF-001).\n\nFalha de vendor, quota esgotada ou saída fora do molde devolvem o lote CURADO com `usouIa: false` — e a tela diz 'Utilizando o lote curado padrão' em vez de fingir que a IA respondeu. O único jeito de esta rota estragar a aula seria bloquear a professora.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: ParametrosDoPreparoSchema,
    resposta: ConteudoDaTurmaSchema.extend({ usouIa: z.boolean() }),
    notas: [
      "A quota é a do PERFIL (ADR-105): `temSaldo` antes, e o que o vendor cobrou é debitado por TENTATIVA — inclusive as que a validação rejeitou, porque foram pagas igual.",
      "`id`, `tipo`, `veracidade` e `tom` são fixados pela ORDEM do molde, nunca pelo que o modelo devolveu: com o áudio livre para cair na posição que o modelo quiser, a simetria formal do lote se perde — e 'áudio é sempre mentira' vira a heurística que a criança aprende.",
      "A validação rejeita mensagem fora do teto de palavras da faixa e termo proibido na tela, e rejeitar faz o modelo REGERAR: vale mais que aceitar e contar com a revisão de um texto que a professora talvez só passe o olho.",
      "O teto de 60 caracteres do `tema` é a primeira barreira contra injeção de instrução no gerador; a segunda é o `system` de `prompts.ts`, que fixa o formato da saída.",
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
    await this.missao.conteudoParaOProfessor(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
    );

    const { rascunho, usouIa } = await this.preparo.gerar(
      escolaId,
      req.auth.usuarioId,
      req.auth.perfil,
      parsed.data,
    );
    return {
      tema: rascunho.tema,
      gatilho: parsed.data.gatilho,
      // A origem do rascunho é o que ele É, não o que se pediu: sem IA o que
      // está na tela é o banco curado, e homologá-lo como `ia` mentiria no
      // único registro que responde se a curadoria assistida está sendo usada.
      origem: usouIa ? ("ia" as const) : ("padrao" as const),
      mensagens: rascunho.mensagens,
      // Rascunho: nada foi gravado, então nada está aprovado.
      aprovadoPorProfessor: false,
      atualizadoEm: null,
      usouIa,
    };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: 'O clique em "Aprovar e liberar para a turma" — o portão do RF-001.',
    descricao:
      "Grava o lote como a professora o deixou e marca `aprovado_por_professor: true`. **É o único lugar que liga esse booleano**, e é ele que a tela do estudante consulta: sem homologação, a missão é uma tela de espera.\n\nO corpo carrega as 8 mensagens INTEIRAS em vez de um `{ aprovado: true }` porque a curadoria é editar: a professora pode reescrever qualquer texto antes de aprovar. Aprovar sem editar manda de volta o que a tela recebeu — o que também é curadoria, porque passou pelos olhos dela.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: HomologacaoSchema,
    resposta: ConteudoDaTurmaSchema,
    notas: [
      "A paridade é cobrada no corpo: exatamente 3 verdadeiras, 3 falsas e 2 ambíguas, e cada id de `msg-1` a `msg-8` uma vez. Não é preferência — é o que impede a heurística 'se está em maiúscula é mentira' de fechar a conta sozinha, e o que dá ao histograma uma barra longa para cada lado. (`.refine()` some do OpenAPI; daí esta nota.)",
      "Idempotente: homologar duas vezes é exatamente o clique que uma docente nervosa dá.",
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
    const parsed = HomologacaoSchema.safeParse(body);
    if (!parsed.success) throw erroDeJogo("payload-invalido");
    const { tema, gatilho, origem, mensagens } = parsed.data;
    return this.missao.homologar(escolaId, turmaOu400(turmaId), professorDoToken(req.auth), {
      tema,
      gatilho,
      origem,
      mensagens: [...mensagens],
    });
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: 'Os dois botões mestres: "Iniciar revelação coletiva" e "Liberar reflexão final".',
    descricao:
      "É o que acende o telão para 30 telas ao mesmo tempo — e é a rota que o polling de 5 s do estudante lê (`GET /quem-mandou-isso/gate`), porque **não há WebSocket de aplicação no Cloud Run** (ADR-93).\n\n`iniciar-revelacao` mexe no PISO do passo, não só no teto: quem ainda não tinha confirmado é empurrado para o Mural revelado. Deixá-lo continuar encaminhando com o gabarito projetado na parede mediria outra coisa.\n\n`voltar-exploracao` é o inverso dos dois, para quem revelou antes da hora. **Não é um 'zerar'**: nada é apagado, os snapshots confirmados continuam confirmados, e quem já entregou a reflexão fica em `fim`.\n\n**Idempotente de propósito**: apertar duas vezes é exatamente o clique que se dá duas vezes.",
    params: z.object({ turmaId: z.string().uuid() }),
    query: z.object({ escolaId: z.string().optional() }),
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "São TRÊS etapas e não quatro: o card de síntese da sala entra JUNTO da revelação, ao fim do Mural. Um terceiro botão para ele seria controle morto no painel.",
      "`liberar-reflexao` não empurra ninguém para a pergunta do tio: quem chega atrasado vê o Mural revelado primeiro, e é dele que o botão do estudante sai.",
      "Quem já entregou a reflexão fica onde está. O latch é do estudante, não da turma.",
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
    return this.missao.mudarGate(
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
      "Apaga as sessões, os encaminhamentos e as reflexões desta turma (CASCADE da sessão) e devolve o gate a `exploracao`, senão a turma nova nasceria com o telão já aceso. **Preserva `telemetria_eventos`**, que é a trilha analítica imutável, **e preserva `exp_05_conteudo_turma`**: a curadoria da professora não é execução de estudante.\n\nA reflexão vai junto, e isso é deliberado: refazer a missão com a resposta da turma do ano passado na tela seria um portfólio que mistura duas turmas.",
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
    return this.missao.zerarTurma(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
  }
}

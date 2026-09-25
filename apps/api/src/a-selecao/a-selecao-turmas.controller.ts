import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { professorDoToken } from "../comum/turmas-do-professor";
import { ehUuid } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import { ASelecaoService } from "./a-selecao.service";
import {
  CoberturaHomologadaSchema,
  CoberturasSchema,
  GateDaTurmaSchema,
  GateSchema,
  HomologacaoSchema,
  PainelSchema,
  ParametrosDoPreparoSchema,
  ProgressoDaMidiaSchema,
  RascunhoSchema,
  TurmasSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { MidiaDaExp07ef1bService } from "./midia.service";
import { PreparoDaExp07ef1bService } from "./preparo.service";

/**
 * Visão do PROFESSOR (e dos gestores) sobre a exp07ef1b — classe separada do
 * estudante para o `@Roles` ficar limpo, como na exp05ef1b. A separação é
 * decisão de segurança: o gestor não tem rota que aceite `estudanteId`.
 *
 * Toda rota com `turmaId` passa por `turmaVisivel` no service: o `@Roles`
 * protege a rota, a MATRÍCULA protege a turma — turma que o professor não
 * leciona é **404**, nunca 403 (a tela não pode contar que a turma existe).
 *
 * `gestor_contrato` e `admin` têm escola vazia no token (regra 1) e dizem
 * `?escolaId=` — `comum/escola-alvo.ts`, e o valor vai EXPLÍCITO ao
 * `comTenancy`, porque o `TenancyInterceptor` não abre contexto para eles.
 *
 * O gestor da escola alcança as mesmas rotas do professor, inclusive o botão
 * da aula e a homologação — o padrão da exp05ef1b, pelo mesmo motivo: restringir
 * ao regente daria ao gestor uma tela em que o botão responde 404 sem dizer por
 * quê. O que o gestor NÃO recebe é o texto livre (recorte da ADR-108).
 */

type Autenticado = { auth: AuthClaims };

const PARAMS = z.object({ turmaId: z.string().uuid() });
const QUERY = z.object({ escolaId: z.string().optional() });

function turmaOu400(turmaId: string): string {
  if (!ehUuid(turmaId)) throw new BadRequestException({ codigo: "turma-nao-encontrada", mensagem: "Turma inválida." });
  return turmaId;
}

/** As rotas que gastam IA do professor têm um teto a mais: o de requisição. */
function limitar(usuarioId: string, rota: string, teto: number) {
  const r = rateLimit(`a-selecao:${rota}:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Muitas tentativas em pouco tempo. Espere um minuto." }, 429);
}

function valida<S extends z.ZodTypeAny>(
  schema: S,
  corpo: unknown,
  codigo: "payload-invalido" | "lote-invalido" = "payload-invalido",
): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    /* Na homologação, as frases do `superRefine` (`problemasDoLote`) são para a
       professora: vão juntas, e nenhuma repete texto de post. */
    const erros = [...new Set(parsed.error.issues.map((i) => i.message))];
    throw erroDeJogo(codigo, { erros });
  }
  return parsed.data;
}

@Controller("a-selecao/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class ASelecaoTurmasController {
  constructor(
    private readonly missao: ASelecaoService,
    private readonly preparo: PreparoDaExp07ef1bService,
    private readonly midia: MidiaDaExp07ef1bService,
  ) {}

  @Get()
  @Contrato({
    resumo: "Turmas para o seletor do painel.",
    descricao:
      "Filtradas por MATRÍCULA para o professor; o gestor vê a escola. `gestor_contrato` precisa dizer `?escolaId=`.",
    query: QUERY,
    resposta: TurmasSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/painel")
  @Contrato({
    resumo: "O painel da aula: o botão da próxima etapa e quem publicou, POR COMPUTADOR.",
    descricao:
      "Uma linha por computador quando a turma montou equipes para esta missão (`colapsarEmUnidades`), uma por criança quando não — `resumo.porComputador` diz qual. `resumo.computadores` é o \"X de Y computadores publicaram\": o Y sai da montagem das equipes, porque o colapso conta também quem faltou.\n\n`proximaEtapa` é o rótulo do botão único (`null` depois da explicação).\n\n**Sem nível, nota ou acerto por criança** (`PROIBIDO_NO_PAINEL`, com teste). O nível da EF07CO11 mora no painel de habilidades, em `/evidencias/turma/:turmaId/missao/exp07ef1b/atividade/:coberturaId`.",
    params: PARAMS,
    query: QUERY,
    resposta: PainelSchema,
    notas: [
      "`legenda` e `reflexaoTexto` são texto livre de menor e só vêm preenchidos para quem LECIONA a turma. Gestor, gestor de contrato e admin recebem `null` e leem `publicou` e `entregouReflexao` (recorte da ADR-108).",
      "A primeira leitura de uma turma sem cobertura cria a `padrao` (o banco curado) e o gate na rodada 1.",
    ],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: 'O botão único da aula: "Liberar Mural", "Revelar fichas", "Liberar conclusão".',
    descricao:
      "O corpo diz a etapa de DESTINO. Anda uma etapa por vez — `exploracao → mural → fichas → explicacao` —, nunca pula e nunca volta; destino igual ao atual é aceito e não muda nada (o segundo clique).\n\nAbrir o **Mural** é o momento do PAREAMENTO: na mesma transação, cada computador que publicou recebe o par de matriz mais distante; quem sobra, quem não tem par divergente e a sala de um computador só recebem o colega virtual (Tomás ou Malu). `pareadas` diz quantas sessões receberam par nesta chamada.",
    params: PARAMS,
    query: QUERY,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "Destino fora de ordem responde **409** `transicao-de-etapa-invalida`, com `etapaAtual` e `proximaEtapa` no corpo.",
      "É a linha que o polling de 5 s do estudante lê (`GET /a-selecao/gate`): não há WebSocket de aplicação (ADR-93).",
    ],
  })
  gate(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { para } = valida(GateSchema, corpo);
    return this.missao.mudarEtapa(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      para,
    );
  }

  @Post(":turmaId/zerar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Zerar a turma" — abre a próxima rodada, sem apagar nada.',
    descricao:
      "Sobe a rodada da atividade e volta a etapa para a exploração. **Nada é apagado**: as sessões, as tríades, os pares e as reflexões da rodada anterior ficam, e são elas que o painel de habilidades mostra como a rodada passada (ADR-112). A cobertura também fica — o preparo custou tempo da professora.",
    params: PARAMS,
    query: QUERY,
    resposta: ZerarTurmaSchema,
    notas: [
      "Repetir o mesmo tema com a mesma turma mede memória, não leitura (PED-13): a tela avisa antes, e o guia recomenda homologar um tema novo, que abre OUTRA atividade na rodada 1.",
    ],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.zerar(escolaAlvo(req.auth, escolaIdPedida), turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/coberturas")
  @Contrato({
    resumo: "A cobertura em andamento, COM o gabarito, e o histórico das atividades da turma.",
    descricao:
      "**Professor only**: é aqui que `enquadramento`, `tagFonte` e `tagAngulo` de cada post aparecem — são o roteiro de quem conduz. `historico` lista todas as coberturas (a ativa inclusa): cada uma é uma ATIVIDADE, e o `id` dela é o `atividadeId` do painel de habilidades.",
    params: PARAMS,
    query: QUERY,
    resposta: CoberturasSchema,
    notas: ["`rodadas` é a maior rodada com sessão daquela cobertura; 0 = nunca rodou."],
  })
  coberturas(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.coberturas(escolaAlvo(req.auth, escolaIdPedida), turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera um RASCUNHO dos 12 posts com IA, sobre o tema da professora (pré-aula).",
    descricao:
      "**Não persiste nada**: o que volta é rascunho para a tela editar, e publicar é o `POST homologar`.\n\nSem saldo de IA, com o provedor fora do ar ou com a saída fora do molde, volta o BANCO CURADO com `usouIa: false` e `origem: \"padrao\"` — e a tela diz que o tema padrão foi carregado, em vez de fingir que a IA respondeu.",
    params: PARAMS,
    query: QUERY,
    corpo: ParametrosDoPreparoSchema,
    resposta: RascunhoSchema,
    notas: [
      "Quota do PERFIL do professor (ADR-105): `temSaldo` antes, e o que o vendor cobrou é debitado por tentativa, inclusive as recusadas.",
      "O lote gerado é recusado — e regerado uma vez — fora do 4:4:4, com legenda fora de 20 a 45 palavras ou com termo que antecipe a revelação (\"viés\", \"enquadramento\", \"lado da história\"…).",
      "Os tetos de `tema` (5 a 100) e `foco` (até 100) são a primeira barreira contra injeção de instrução no gerador.",
    ],
  })
  async gerarConteudo(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const parametros = valida(ParametrosDoPreparoSchema, corpo);
    limitar(req.auth.usuarioId, "gerar-conteudo", 10);
    /* A guarda de turma ANTES de gastar token: gerar para uma turma que o
       professor não leciona seria pagar pelo erro antes de descobri-lo. */
    await this.missao.exigirTurmaVisivel(escolaId, turmaOu400(turmaId), professorDoToken(req.auth));
    const { rascunho, usouIa } = await this.preparo.gerar(escolaId, req.auth.usuarioId, req.auth.perfil, parametros);
    return {
      tema: rascunho.tema,
      foco: rascunho.foco,
      // A origem é o que o rascunho É, não o que se pediu: sem IA, o que está
      // na tela é o banco curado, e homologá-lo como `ia` mentiria no único
      // registro que responde se a curadoria assistida está sendo usada.
      origem: usouIa ? ("ia" as const) : ("padrao" as const),
      usouIa,
      posts: rascunho.posts,
    };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Aprovar Cobertura e Abrir Turma" — a curadoria humana (ADR-66/67).',
    descricao:
      "Grava os 12 posts como a professora os deixou e os torna a ATIVIDADE em andamento. **Tema novo é atividade nova**: a cobertura anterior é desativada (fica, com as sessões dela) e o gate volta à rodada 1, na exploração.\n\nO corpo carrega os posts INTEIROS porque curadoria é editar: a professora pode reescrever qualquer legenda antes de aprovar.",
    params: PARAMS,
    query: QUERY,
    corpo: HomologacaoSchema,
    resposta: CoberturaHomologadaSchema,
    notas: [
      "O lote é recusado com **400** `lote-invalido` e a LISTA de problemas em `erros`, em frases para a professora: 12 posts; ids de `post_a_1` a `post_c_4`, cada um uma vez; bloco `a` = `@folhaoficial_`/institucional, `b` = `@voz_coletiva`/comunitário, `c` = `@metrica_urbana`/estatístico (4:4:4); legenda de 20 a 45 palavras; nenhum termo que antecipe a revelação na legenda, na descrição da imagem ou nos comentários. (`.superRefine()` some do OpenAPI; daí esta nota.)",
      "As imagens de post com a MESMA descrição da cobertura anterior são herdadas — o arquivo no bucket é o hash da descrição.",
      "Homologar no meio da aula recomeça a aula: a etapa volta à exploração.",
    ],
  })
  homologar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const lote = valida(HomologacaoSchema, corpo, "lote-invalido");
    return this.missao.homologar(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      lote,
    );
  }

  @Post(":turmaId/gerar-midia")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera as próximas imagens dos posts da cobertura em andamento — incremental.",
    descricao:
      "Doze imagens não cabem nos 30 s que o BFF dá a uma chamada: cada chamada gera ATÉ DUAS imagens novas, grava as URLs na cobertura e devolve o progresso. **Repita enquanto `completo` for `false` e a chamada anterior tiver gerado alguma** — `falharam` diz o que não saiu, e esses posts seguem com o card da descrição.\n\nIdempotente: o que já tem URL é pulado, e a imagem de mesma descrição que já está no bucket entra sem custo. Os posts de métricas do banco curado não pedem imagem: a experiência desenha o gráfico.",
    params: PARAMS,
    query: QUERY,
    resposta: ProgressoDaMidiaSchema,
    notas: [
      "Quota do professor, com custo ESTIMADO por imagem (a geração não devolve contagem de tokens). Sem saldo responde **429** `sem-saldo-de-ia` — e a missão roda igual, com os cards.",
      "Duas chamadas simultâneas para a mesma cobertura recebem o mesmo trabalho (lock de processo).",
    ],
  })
  gerarMidia(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    limitar(req.auth.usuarioId, "gerar-midia", 20);
    return this.midia.gerar(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
    );
  }
}

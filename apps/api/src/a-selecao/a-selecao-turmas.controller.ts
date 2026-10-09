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
import { ehIdDePost } from "./catalogo";
import {
  CoberturaDetalheSchema,
  CoberturaHomologadaSchema,
  CoberturasSchema,
  EmAndamentoSchema,
  GateDaTurmaSchema,
  GateSchema,
  HomologacaoSchema,
  ImagemRegeradaSchema,
  ImagensAprovadasSchema,
  PainelSchema,
  ParametrosDoPreparoSchema,
  ProgressoDaMidiaSchema,
  QueryDaCoberturaSchema,
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
 * da aula e a homologação — o padrão da v1 da exp05ef1b, pelo mesmo motivo: restringir
 * ao regente daria ao gestor uma tela em que o botão responde 404 sem dizer por
 * quê. O que o gestor NÃO recebe é o texto livre (recorte da ADR-108).
 */

type Autenticado = { auth: AuthClaims };

const PARAMS = z.object({ turmaId: z.string().uuid() });
const PARAMS_DA_COBERTURA = z.object({ turmaId: z.string().uuid(), coberturaId: z.string().uuid() });
const QUERY = z.object({ escolaId: z.string().optional() });

function turmaOu400(turmaId: string): string {
  if (!ehUuid(turmaId)) throw new BadRequestException({ codigo: "turma-nao-encontrada", mensagem: "Turma inválida." });
  return turmaId;
}

/** O `?coberturaId=` opcional: inválido é 404, como a cobertura de outra turma. */
function coberturaOpcional(coberturaId: string | undefined): string | undefined {
  if (coberturaId === undefined || coberturaId === "") return undefined;
  if (!ehUuid(coberturaId)) throw erroDeJogo("atividade-nao-encontrada");
  return coberturaId;
}

/** A nota de toda rota que lê a atividade em andamento (ADR-130). */
const NOTA_SEM_ATIVIDADE =
  "Sem atividade em andamento na turma, **403** `atividade-nao-preparada`: a plataforma não cria atividade — a professora cria e põe em andamento (`POST :turmaId/coberturas/:coberturaId/em-andamento`).";

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
      NOTA_SEM_ATIVIDADE,
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
      NOTA_SEM_ATIVIDADE,
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
    resumo: '"Zerar a turma" — abre a próxima rodada e apaga a evidência pedagógica da atividade.',
    descricao:
      "Sobe a rodada da atividade e volta a etapa para a exploração. **A evidência pedagógica da cobertura é apagada**, de todas as rodadas (ADR-155): o painel de habilidades recomeça do zero. As sessões, as tríades, os pares e as reflexões da rodada anterior ficam na folha da turma, e a cobertura também — o preparo custou tempo da professora.",
    params: PARAMS,
    query: QUERY,
    resposta: ZerarTurmaSchema,
    notas: [
      "Repetir o mesmo tema com a mesma turma mede memória, não leitura (PED-13): a tela avisa antes, e o guia recomenda criar um tema novo, que é OUTRA atividade.",
      NOTA_SEM_ATIVIDADE,
    ],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.zerar(escolaAlvo(req.auth, escolaIdPedida), turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/coberturas")
  @Contrato({
    resumo: "As atividades da turma: a em andamento, COM o gabarito, e a lista de todas.",
    descricao:
      "**Professor only**: é aqui que `enquadramento`, `tagFonte` e `tagAngulo` de cada post aparecem — são o roteiro de quem conduz. `historico` lista todas as coberturas (a em andamento inclusa, com `ativa: true`): cada uma é uma ATIVIDADE, e o `id` dela é o `atividadeId` das equipes e do painel de habilidades (ADR-130).\n\n`ativa` é `null` quando nenhuma está em andamento: a plataforma não cria atividade.",
    params: PARAMS,
    query: QUERY,
    resposta: CoberturasSchema,
    notas: ["`rodadas` é a maior rodada com sessão daquela cobertura; 0 = nunca rodou."],
  })
  coberturas(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.coberturas(escolaAlvo(req.auth, escolaIdPedida), turmaOu400(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/coberturas/:coberturaId")
  @Contrato({
    resumo: "UMA atividade, inteira e COM o gabarito — em andamento ou pronta.",
    descricao:
      "A página da atividade. `rodada` e `etapa` só vêm quando ela está em andamento; `rodadas` é a maior rodada com sessão (0 = nunca rodou).",
    params: PARAMS_DA_COBERTURA,
    query: QUERY,
    resposta: CoberturaDetalheSchema,
    notas: ["Cobertura de outra turma, ou que não existe, responde **404** `atividade-nao-encontrada`."],
  })
  cobertura(
    @Param("turmaId") turmaId: string,
    @Param("coberturaId") coberturaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.cobertura(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      coberturaOpcional(coberturaId) ?? "",
    );
  }

  @Post(":turmaId/coberturas/:coberturaId/em-andamento")
  @HttpCode(200)
  @Contrato({
    resumo: '"Usar esta atividade agora" — a professora escolhe o que a turma faz (ADR-130).',
    descricao:
      "A escolhida passa a ser a ATIVIDADE EM ANDAMENTO da turma; a que estava volta a ser pronta — fica, com as sessões e as rodadas. A etapa volta à exploração.\n\nA RODADA: a atividade que nunca rodou começa na 1; a que já rodou abre a SEGUINTE à última — retomar a mesma rodada depois do Mural seria o \"voltar\" que o botão único proíbe. As rodadas anteriores continuam no painel de habilidades.",
    params: PARAMS_DA_COBERTURA,
    query: QUERY,
    resposta: EmAndamentoSchema,
    notas: [
      "**Idempotente**: pôr no ar a que já está no ar devolve `mudou: false` e não muda nada.",
      "Trocar com a aula correndo leva quem está jogando para a atividade nova: a experiência nota o `coberturaId` novo no polling do gate e recarrega. A tela pede confirmação antes.",
      "Cobertura de outra turma responde **404** `atividade-nao-encontrada`.",
      "Sem a segunda fase da aprovação (as imagens, `POST …/aprovar-imagens`), **409** `imagens-nao-aprovadas` (ADR-146).",
      "Pôr no ar NÃO libera a missão na sala por aqui: quem faz o `PUT /salas/turma/:turmaId/missoes/exp07ef1b` é o hub, logo depois (ADR-146).",
    ],
  })
  emAndamento(
    @Param("turmaId") turmaId: string,
    @Param("coberturaId") coberturaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.colocarEmAndamento(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      coberturaOpcional(coberturaId) ?? "",
    );
  }

  @Post(":turmaId/coberturas/:coberturaId/aprovar-imagens")
  @HttpCode(200)
  @Contrato({
    resumo: "A segunda fase da aprovação: o professor viu as imagens dos posts e as aprova (ADR-146).",
    descricao:
      "A primeira fase é o `POST homologar` (os textos). As imagens se geram em seguida, no card de cada post (`POST gerar-midia?coberturaId=`), e o professor regera a que não serve (`POST …/imagens/:postId/regerar`). Só depois desta rota a atividade vai ao ar: `POST em-andamento` responde **409** `imagens-nao-aprovadas` sem ela.",
    params: PARAMS_DA_COBERTURA,
    query: QUERY,
    resposta: ImagensAprovadasSchema,
    notas: [
      "**Idempotente**: a segunda aprovação devolve o carimbo da primeira.",
      "Não exige imagem pronta em todo post: a geração pode falhar ou a quota acabar, e o post segue com o card da descrição, que o professor viu no mesmo card. Quem segura o botão até a geração terminar é a tela.",
      "As coberturas criadas antes desta regra entraram aprovadas (migração `20261005150000`).",
    ],
  })
  aprovarImagens(
    @Param("turmaId") turmaId: string,
    @Param("coberturaId") coberturaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.aprovarImagens(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      coberturaOpcional(coberturaId) ?? "",
    );
  }

  @Post(":turmaId/coberturas/:coberturaId/imagens/:postId/regerar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Gerar outra imagem": uma imagem nova para UM post, enquanto as imagens estão em validação (ADR-146).',
    descricao:
      "O professor viu a imagem no card do post e ela não serve. Gera outra, SEMPRE paga, num arquivo novo — sobrescrever o da descrição trocaria a imagem de toda cobertura que a herdou, inclusive a de uma turma em aula.",
    params: PARAMS_DA_COBERTURA.extend({ postId: z.string() }),
    query: QUERY,
    resposta: ImagemRegeradaSchema,
    notas: [
      "Depois de `aprovar-imagens`, **409** `imagens-ja-aprovadas`: a turma pode estar olhando para elas.",
      "Post de gráfico (o banco curado tem quatro) responde **400** `post-sem-imagem`: o gráfico é desenhado a partir dos números.",
      "Quota do professor, com o custo estimado de uma imagem. Sem saldo, **429** `sem-saldo-de-ia`.",
    ],
  })
  regerarImagem(
    @Param("turmaId") turmaId: string,
    @Param("coberturaId") coberturaId: string,
    @Param("postId") postId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehIdDePost(postId)) throw erroDeJogo("post-sem-imagem");
    limitar(req.auth.usuarioId, "regerar-imagem", 20);
    return this.midia.regerar(
      escolaId,
      turmaOu400(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      coberturaOpcional(coberturaId) ?? "",
      postId,
    );
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
      "`podcast` traz as três falas do Bloco 2 do podcast de recapitulação — o que a Folha Oficial, a Voz Coletiva e a Métrica Urbana mostraram NESTE tema —, escritas junto com o lote e sob a mesma régua (12 a 60 palavras, até 400 bytes, sem link, e-mail nem @). No banco curado, são as do sheet.",
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
      podcast: rascunho.podcast,
    };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Criar atividade" — a curadoria humana (ADR-66/67).',
    descricao:
      "Grava os 12 posts como a professora os deixou, numa ATIVIDADE NOVA que nasce **pronta, não no ar** (ADR-130): a em andamento continua em andamento, e quem escolhe o que a turma faz é a professora (`POST :turmaId/coberturas/:coberturaId/em-andamento`).\n\nO corpo carrega os posts INTEIROS porque curadoria é editar: a professora pode reescrever qualquer legenda antes de aprovar.",
    params: PARAMS,
    query: QUERY,
    corpo: HomologacaoSchema,
    resposta: CoberturaHomologadaSchema,
    notas: [
      "O lote é recusado com **400** `lote-invalido` e a LISTA de problemas em `erros`, em frases para a professora: 12 posts; ids de `post_a_1` a `post_c_4`, cada um uma vez; bloco `a` = `@folhaoficial_`/institucional, `b` = `@voz_coletiva`/comunitário, `c` = `@metrica_urbana`/estatístico (4:4:4); legenda de 20 a 45 palavras; nenhum termo que antecipe a revelação na legenda, na descrição da imagem ou nos comentários. (`.superRefine()` some do OpenAPI; daí esta nota.)",
      "As imagens de post com a MESMA descrição de uma cobertura recente da turma são herdadas — o arquivo no bucket é o hash da descrição.",
      "`podcast` é obrigatório: as três falas do Bloco 2 que a professora revisou (no tema curado, as do sheet). Fora de 12 a 60 palavras, acima de 400 bytes, ou com link, e-mail ou @, o 400 `lote-invalido` diz qual fala.",
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
    resumo: "Gera as próximas imagens dos posts de uma atividade — incremental.",
    descricao:
      "Doze imagens não cabem nos 30 s que o BFF dá a uma chamada: cada chamada gera ATÉ DUAS imagens novas, grava as URLs na cobertura e devolve o progresso. **Repita enquanto `completo` for `false` e a chamada anterior tiver gerado alguma** — `falharam` diz o que não saiu, e esses posts seguem com o card da descrição.\n\nIdempotente: o que já tem URL é pulado, e a imagem de mesma descrição que já está no bucket entra sem custo. Os posts de métricas do banco curado não pedem imagem: a experiência desenha o gráfico.",
    params: PARAMS,
    query: QueryDaCoberturaSchema,
    resposta: ProgressoDaMidiaSchema,
    notas: [
      "`?coberturaId=` diz a atividade (a pronta, preparada antes de ir ao ar); sem ele, a em andamento — e sem nenhuma, **403** `atividade-nao-preparada`.",
      "Quota do professor, com custo ESTIMADO por imagem (a geração não devolve contagem de tokens). Sem saldo responde **429** `sem-saldo-de-ia` — e a missão roda igual, com os cards.",
      "Duas chamadas simultâneas para a mesma cobertura recebem o mesmo trabalho (lock de processo).",
    ],
  })
  gerarMidia(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("coberturaId") coberturaId: string | undefined,
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
      coberturaOpcional(coberturaId),
    );
  }
}

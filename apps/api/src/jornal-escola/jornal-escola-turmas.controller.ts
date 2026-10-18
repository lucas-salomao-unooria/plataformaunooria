import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { professorDoToken } from "../comum/turmas-do-professor";
import { ehUuid } from "../motor/guardas";
import { Contrato } from "../openapi/contrato";
import {
  AprovarImagensSchema,
  EmAndamentoSchema,
  GateDaTurmaSchema,
  GateSchema,
  HomologacaoSchema,
  IdDeNoticiaSchema,
  ImagemRegeradaSchema,
  ImagensAprovadasSchema,
  NoticiaRegeneradaSchema,
  PacoteDetalheSchema,
  PacoteHomologadoSchema,
  PacotesSchema,
  PainelSchema,
  ParametrosDoPreparoSchema,
  ProgressoDaMidiaSchema,
  QueryDoPacoteSchema,
  RascunhoSchema,
  RegenerarNoticiaSchema,
  TurmasSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { JornalEscolaService } from "./jornal-escola.service";
import { MidiaDaExp04ef1bService } from "./midia.service";
import { PreparoDaExp04ef1bService } from "./preparo.service";

/**
 * Visão do PROFESSOR (e dos gestores) sobre a exp04ef1b — classe separada do
 * estudante para o `@Roles` ficar limpo, como na exp07ef1b. A separação é
 * decisão de segurança: o gestor não tem rota que aceite `estudanteId`.
 *
 * Toda rota com `turmaId` passa por `turmaVisivel` no service: o `@Roles`
 * protege a rota, a MATRÍCULA protege a turma — turma que o professor não
 * leciona é **404**, nunca 403 (a tela não pode contar que a turma existe).
 *
 * `gestor_contrato` e `admin` têm escola vazia no token (regra 1) e dizem
 * `?escolaId=` — `comum/escola-alvo.ts`, e o valor vai EXPLÍCITO ao
 * `comTenancy`, porque o `TenancyInterceptor` não abre contexto para eles.
 */

type Autenticado = { auth: AuthClaims };

const PARAMS = z.object({ turmaId: z.string().uuid() });
const PARAMS_DO_PACOTE = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
const PARAMS_DA_IMAGEM = PARAMS_DO_PACOTE.extend({ noticiaId: IdDeNoticiaSchema });

/** A nota de toda rota que lê a atividade em andamento (ADR-130). */
const NOTA_SEM_ATIVIDADE =
  "Sem atividade em andamento na turma, **403** `atividade-nao-preparada`: a plataforma não cria atividade — o professor cria e põe em andamento (`POST :turmaId/pacotes/:pacoteId/em-andamento`).";

/** O `?pacoteId=` opcional: inválido é 404, como o pacote de outra turma. */
function pacoteOpcional(pacoteId: string | undefined): string | undefined {
  if (pacoteId === undefined || pacoteId === "") return undefined;
  if (!ehUuid(pacoteId)) throw erroDeJogo("atividade-nao-encontrada");
  return pacoteId;
}
const QUERY = z.object({ escolaId: z.string().optional() });

function turmaOu404(turmaId: string): string {
  if (!ehUuid(turmaId)) throw erroDeJogo("turma-nao-encontrada");
  return turmaId;
}

/** As rotas que gastam IA do professor têm um teto a mais: o de requisição. */
function limitar(usuarioId: string, rota: string, teto: number) {
  const r = rateLimit(`jornal-escola:${rota}:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw erroDeJogo("muitas-requisicoes");
}

function valida<S extends z.ZodTypeAny>(
  schema: S,
  corpo: unknown,
  codigo: "payload-invalido" | "pacote-invalido" = "payload-invalido",
): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    /* Na homologação, as frases do `superRefine` (`problemasDoPacote`) são
       para o professor: vão juntas, e nenhuma repete texto de notícia. */
    const erros = [
      ...new Set(
        parsed.error.issues.map((i) =>
          i.code === "custom" || i.path.length === 0 ? i.message : `Campo ${i.path.join(".")}: ${i.message}`,
        ),
      ),
    ];
    throw erroDeJogo(codigo, { erros });
  }
  return parsed.data;
}

@Controller("jornal-escola/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class JornalEscolaTurmasController {
  constructor(
    private readonly missao: JornalEscolaService,
    private readonly preparo: PreparoDaExp04ef1bService,
    private readonly midia: MidiaDaExp04ef1bService,
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
    resumo: "O painel da aula: o botão da próxima etapa e o progresso, POR COMPUTADOR.",
    descricao:
      "Uma linha por computador quando a turma montou equipes para esta missão (`colapsarEmUnidades`), uma por criança quando não — `resumo.porComputador` diz qual. `resumo.computadores` é o \"X de Y computadores publicaram\": o Y sai da montagem das equipes, porque o colapso conta também quem faltou.\n\n**Só progresso por linha.** Quantas verificadas cada computador teve NÃO está na linha: está no histograma anônimo (`resumo.histograma`, [0, 1, 2, 3 verificadas]). O radar é do OBJETO editorial — em quantas capas cada notícia foi —, e o nível por habilidade mora no painel de habilidades (`/evidencias/turma/:turmaId/missao/exp04ef1b/atividade/:pacoteId`).",
    params: PARAMS,
    query: QUERY,
    resposta: PainelSchema,
    notas: [
      NOTA_SEM_ATIVIDADE,
      "A leitura do PROFESSOR conta o EVT-P04 (`painel_visto_em`, `painel_vistas`); a do gestor não.",
      "Turma que o professor não leciona responde **404** `turma-nao-encontrada`.",
    ],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: 'O botão único da aula: "Liberar resultado", depois "Liberar revisão".',
    descricao:
      "O corpo diz a etapa de DESTINO. Anda uma etapa por vez — `exploracao → resultado → revisao` —, nunca pula e nunca volta; destino igual ao atual é aceito e não muda nada (o segundo clique). Grava quando cada portão abriu (EVT-P05).\n\nQuem ainda não publicou continua montando a página com o portão aberto: a publicação atrasada é caminho previsto.",
    params: PARAMS,
    query: QUERY,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "Destino fora de ordem responde **409** `transicao-de-etapa-invalida`, com `etapaAtual` e `proximaEtapa` no corpo.",
      "É a linha que o polling de 5 s do estudante lê (`GET /jornal-escola/gate`): não há WebSocket de aplicação (ADR-93).",
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
    return this.missao.mudarEtapa(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth), para);
  }

  @Post(":turmaId/zerar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Zerar a turma" — abre a próxima rodada e apaga a evidência pedagógica da atividade.',
    descricao:
      "Sobe a rodada da atividade e volta a etapa para a exploração, com os portões fechados. **A evidência pedagógica do pacote é apagada**, de todas as rodadas (ADR-155): o painel de habilidades recomeça do zero. As sessões, as edições e as pistas da rodada anterior ficam na folha da turma, e o pacote também.",
    params: PARAMS,
    query: QUERY,
    resposta: ZerarTurmaSchema,
    notas: [
      "Na rodada nova do MESMO pacote, quem já foi avaliado numa anterior refaz sem marca nova nas ações (ADR-120): já viu o resultado e a Chave. O guia recomenda criar outro pacote, que é OUTRA atividade.",
      NOTA_SEM_ATIVIDADE,
    ],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.zerar(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes")
  @Contrato({
    resumo: "As atividades da turma: o pacote em andamento, COM o gabarito, e a lista de todos.",
    descricao:
      "**Professor e gestores**: é aqui que o gabarito, as pistas e a consequência de cada notícia aparecem — são o roteiro de quem conduz e a tela do preparo. `historico` lista todos os pacotes (o em andamento incluso, com `ativo: true`): cada um é uma ATIVIDADE, e o `id` dele é o `atividadeId` das equipes e do painel de habilidades (ADR-130).\n\n`ativo` é `null` quando nenhum está em andamento: a plataforma não cria atividade.",
    params: PARAMS,
    query: QUERY,
    resposta: PacotesSchema,
    notas: ["`rodadas` é a maior rodada com sessão daquele pacote; 0 = nunca rodou."],
  })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacotes(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Contrato({
    resumo: "UMA atividade, inteira e COM o gabarito — em andamento ou pronta.",
    descricao:
      "A página da atividade. `rodada` e `etapa` só vêm quando ela está em andamento; `rodadas` é a maior rodada com sessão (0 = nunca rodou).",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: PacoteDetalheSchema,
    notas: ["Pacote de outra turma, ou que não existe, responde **404** `atividade-nao-encontrada`."],
  })
  pacote(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.pacote(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      pacoteOpcional(pacoteId) ?? "",
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/em-andamento")
  @HttpCode(200)
  @Contrato({
    resumo: '"Usar esta atividade agora" — o professor escolhe o que a turma faz (ADR-130).',
    descricao:
      "O escolhido passa a ser a ATIVIDADE EM ANDAMENTO da turma; o que estava volta a ser pronto — fica, com as sessões e as rodadas. A etapa volta à exploração, com os portões fechados.\n\nA RODADA: o pacote que nunca rodou começa na 1; o que já rodou abre a SEGUINTE à última — retomar a mesma depois do resultado liberado seria o \"voltar\" que o botão único proíbe. As rodadas anteriores continuam no painel de habilidades.",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: EmAndamentoSchema,
    notas: [
      "**Idempotente**: pôr no ar o que já está no ar devolve `mudou: false` e não muda nada.",
      "Trocar com a aula correndo leva quem está jogando para a atividade nova: a experiência nota o `pacoteId` novo no polling do gate e recarrega. A tela pede confirmação antes.",
      "Pacote de outra turma responde **404** `atividade-nao-encontrada`.",
      "Sem as imagens de TODAS as notícias que pedem imagem geradas E aprovadas, **409** `imagens-nao-aprovadas` (ADR-147). Só na entrada no ar: a atividade que já está no ar não sai por causa de um \"Gerar outra\".",
    ],
  })
  emAndamento(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.colocarEmAndamento(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      pacoteOpcional(pacoteId) ?? "",
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/aprovar-imagens")
  @HttpCode(200)
  @Contrato({
    resumo: '"Aprovar imagens" — o professor viu as imagens das notícias e dá o OK (ADR-147).',
    descricao:
      "As imagens são geradas por IA (`POST gerar-midia?pacoteId=`) e só chegam à turma depois daqui. A aprovação é POR IMAGEM: o corpo traz as URLs que estavam na tela do professor, e só se aprova a notícia cuja URL ainda é a do pacote. \"Gerar outra\" (`POST …/imagens/:noticiaId/regerar`) troca a URL, e aquela notícia espera o novo OK desenhada pelo meio.",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    corpo: AprovarImagensSchema,
    resposta: ImagensAprovadasSchema,
    notas: [
      "URL que já não é a do pacote (outra aba gerou outra) não entra: volta em `desatualizadas`, e a tela relê.",
      "**Idempotente**: aprovar de novo a mesma URL não muda nada.",
      "As atividades criadas antes desta regra entraram com as imagens que tinham aprovadas (migração `20261005190000`).",
      "Pacote de outra turma responde **404** `atividade-nao-encontrada`.",
    ],
  })
  aprovarImagens(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { imagens } = valida(AprovarImagensSchema, corpo, "payload-invalido");
    return this.missao.aprovarImagens(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      pacoteOpcional(pacoteId) ?? "",
      imagens,
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/imagens/:noticiaId/regerar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Gerar outra" — uma imagem nova para UMA notícia (ADR-147).',
    descricao:
      "O professor viu a imagem e ela não serve. Sai um arquivo NOVO, cobrado na quota como qualquer imagem, e a notícia fica sem imagem para a turma até o novo `aprovar-imagens` — as outras continuam.",
    params: PARAMS_DA_IMAGEM,
    query: QUERY,
    resposta: ImagemRegeradaSchema,
    notas: [
      "Notícia sem descrição de imagem (a mensagem, o blog do banco padrão): **400** `noticia-sem-imagem`.",
      "Sem saldo, **429** `sem-saldo-de-ia`; o provedor falhou, **503** `ia-indisponivel` — a imagem anterior continua no pacote.",
      "Vale também na atividade em andamento: a turma deixa de ver a imagem daquela notícia até o novo OK.",
    ],
  })
  regerarImagem(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Param("noticiaId") noticiaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const noticia = IdDeNoticiaSchema.safeParse(noticiaId);
    if (!noticia.success) throw erroDeJogo("noticia-sem-imagem");
    limitar(req.auth.usuarioId, "regerar-imagem", 10);
    return this.midia.regerar(
      escolaId,
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      pacoteOpcional(pacoteId) ?? "",
      noticia.data,
    );
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera um RASCUNHO das 8 notícias com IA, sobre o tema do professor (pré-aula).",
    descricao:
      "**Não persiste nada**: o que volta é rascunho para a tela editar, e publicar é o `POST homologar`. A estrutura (que notícia é de que meio e que papel tem no gabarito) é sorteada no servidor; a IA escreve o conteúdo e a saída que foge do molde ou das regras da missão é regerada uma vez.\n\n**Sem saldo ou com a IA fora do ar, a resposta é o ERRO** — e o hub oferece o banco padrão em um toque (`GET /jornal-escola/professor/material`).",
    params: PARAMS,
    query: QUERY,
    corpo: ParametrosDoPreparoSchema,
    resposta: RascunhoSchema,
    notas: [
      "Quota do PERFIL do professor (ADR-105): `temSaldo` antes, e o que o vendor cobrou é debitado por tentativa, inclusive as recusadas. Sem saldo responde **429** `sem-saldo-de-ia`; com o provedor fora do ar ou a saída fora das regras, **503** `ia-indisponivel`.",
      "Cada geração que chamou a IA conta no EVT-P02 (`geracoes`, `tokens_usados`) do pacote em sala.",
      "Os tetos de `disciplina` (2 a 60), `tema` (5 a 60) e `topicos` (até 600) são a primeira barreira contra injeção de instrução no gerador.",
    ],
  })
  async gerarConteudo(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const turma = turmaOu404(turmaId);
    const parametros = valida(ParametrosDoPreparoSchema, corpo);
    limitar(req.auth.usuarioId, "gerar-conteudo", 10);
    /* A guarda de turma ANTES de gastar token. */
    await this.missao.exigirTurmaVisivel(escolaId, turma, professorDoToken(req.auth));
    const r = await this.preparo.gerar(escolaId, req.auth.usuarioId, req.auth.perfil, parametros);
    if (r.chamouIa) await this.missao.registrarGeracao(escolaId, turma, r.tokens);
    if (!r.ok) throw erroDeJogo(r.codigo);
    return {
      disciplina: parametros.disciplina,
      tema: parametros.tema,
      topicos: parametros.topicos?.trim() || null,
      origem: "ia" as const,
      usouIa: true,
      noticias: r.valor.noticias,
      simulacao: r.valor.simulacao,
    };
  }

  @Post(":turmaId/regenerar-noticia")
  @HttpCode(200)
  @Contrato({
    resumo: "Regenera UMA notícia do rascunho, mantendo o id, o meio e o papel no gabarito.",
    descricao:
      "\"Regenerar Notícia\" (E0-PROF-04). A nova mantém o id, o MEIO e o papel no gabarito (publicável, antiga, sem fonte ou sem autoria) da que sai — senão a regeneração de uma desmontaria a composição das oito —, vem com imagem em todo meio menos a mensagem, e não repete a manchete de outra. Não persiste.",
    params: PARAMS,
    query: QUERY,
    corpo: RegenerarNoticiaSchema,
    resposta: NoticiaRegeneradaSchema,
    notas: [
      "`noticias` leva, de cada uma das oito, só `id`, `meio`, `manchete` e o papel no gabarito — sem régua de tamanho: um campo vazio em outra notícia não trava esta.",
      "A mesma quota do `gerar-conteudo`: sem saldo responde **429** `sem-saldo-de-ia`. Com a IA fora do ar ou a saída fora das regras, responde **200** com `usouIa: false` e a notícia COMO ESTAVA (a do pacote ativo da turma, ou a do banco padrão, pelo id).",
    ],
  })
  async regenerarNoticia(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const turma = turmaOu404(turmaId);
    const pedido = valida(RegenerarNoticiaSchema, corpo);
    limitar(req.auth.usuarioId, "regenerar-noticia", 20);
    await this.missao.exigirTurmaVisivel(escolaId, turma, professorDoToken(req.auth));
    const { noticiaId, noticias, ...parametros } = pedido;
    const r = await this.preparo.regenerar(escolaId, req.auth.usuarioId, req.auth.perfil, parametros, noticiaId, noticias);
    if (r.chamouIa) await this.missao.registrarGeracao(escolaId, turma, r.tokens);
    if (r.ok) return { noticia: r.valor, usouIa: true };
    if (r.codigo === "sem-saldo-de-ia") throw erroDeJogo(r.codigo);
    /* A IA não respondeu: a notícia volta COMO ESTAVA, e a tela diz que nada mudou. */
    const alvo = noticias.find((n) => n.id === noticiaId);
    if (!alvo) throw erroDeJogo("payload-invalido");
    return { noticia: await this.missao.noticiaComoEstava(escolaId, turma, alvo), usouIa: false };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Criar atividade" — a curadoria humana (ADR-66/67).',
    descricao:
      "Grava as 8 notícias como o professor as deixou, numa ATIVIDADE NOVA que nasce **pronta, não no ar** (ADR-130): o pacote em andamento continua em andamento, e quem escolhe o que a turma faz é o professor (`POST :turmaId/pacotes/:pacoteId/em-andamento`). O mesmo conteúdo do pacote mais recente não cria outro: é o segundo clique.\n\nO corpo carrega as notícias INTEIRAS porque curadoria é editar — e editar uma notícia edita também o gabarito e a consequência dela (PDF §10). O banco padrão também passa por aqui (`origem: \"padrao\"`) quando o professor o aprova em um toque.",
    params: PARAMS,
    query: QUERY,
    corpo: HomologacaoSchema,
    resposta: PacoteHomologadoSchema,
    notas: [
      "O pacote é recusado com **400** `pacote-invalido` e a LISTA de problemas em `erros`, em frases para o professor: 8 notícias com os ids `n1` a `n8`, nesta ordem; os oito meios, um por notícia; pelo menos 3 publicáveis, 2 ou 3 antigas apresentadas como atuais e 2 ou 3 sem confirmação ou sem autoria; publicáveis e não publicáveis misturando meios tradicionais e digitais, e com imagem; pelo menos 4 notícias com imagem, e sempre na TV e na rede social; locutor no rádio e perfil com @ na rede social; manchete de 3 a 10 palavras, resumo de 25 a 35, texto de 15 a 80; e nenhum termo de carimbo (\"falsa\", \"fake news\", \"você errou\"...) no que a criança lê. (`.superRefine()` some do OpenAPI; daí esta nota.)",
      "As imagens de notícia com a MESMA descrição de um pacote recente da turma são herdadas — o arquivo no bucket é o hash da descrição.",
    ],
  })
  homologar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const pacote = valida(HomologacaoSchema, corpo, "pacote-invalido");
    return this.missao.homologar(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      pacote,
    );
  }

  @Post(":turmaId/gerar-midia")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera as próximas imagens das notícias de uma atividade — incremental.",
    descricao:
      "As imagens não cabem nos 30 s que o BFF dá a uma chamada: cada chamada gera ATÉ DUAS novas, grava as URLs no pacote e devolve o progresso. **Repita enquanto `completo` for `false` e a chamada anterior tiver gerado alguma** — `falharam` diz o que não saiu: sem todas geradas e aprovadas, a atividade não vai ao ar (ADR-147).\n\nIdempotente: o que já tem URL é pulado, e a imagem de mesma descrição que já está no bucket entra sem custo.",
    params: PARAMS,
    query: QueryDoPacoteSchema,
    resposta: ProgressoDaMidiaSchema,
    notas: [
      "`?pacoteId=` diz a atividade (a pronta, preparada antes de ir ao ar); sem ele, a em andamento — e sem nenhuma, **403** `atividade-nao-preparada`.",
      "Quota do professor, com custo ESTIMADO por imagem (a geração não devolve contagem de tokens). Sem saldo responde **429** `sem-saldo-de-ia`.",
      "Imagem gerada NÃO vai à turma: espera o `aprovar-imagens` (ADR-147). E a atividade só vai ao ar com todas geradas e aprovadas.",
      "Duas chamadas simultâneas para o mesmo pacote recebem o mesmo trabalho (lock de processo).",
    ],
  })
  gerarMidia(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Query("pacoteId") pacoteId: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    limitar(req.auth.usuarioId, "gerar-midia", 20);
    return this.midia.gerar(
      escolaId,
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      pacoteOpcional(pacoteId),
    );
  }
}

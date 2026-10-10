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
import { conteudoDoBancoPadrao } from "./banco-padrao";
import {
  BancoPadraoSchema,
  EmAndamentoSchema,
  GateDaTurmaSchema,
  GateSchema,
  HomologacaoSchema,
  IdDeProjetoSchema,
  ImagemRefeitaSchema,
  ImagensAprovadasSchema,
  PacoteDetalheSchema,
  PacoteHomologadoSchema,
  PacotesSchema,
  PainelSchema,
  ParametrosDoPreparoSchema,
  ProgressoDaMidiaSchema,
  ProjetoRegeneradoSchema,
  QueryDoPacoteSchema,
  RascunhoSchema,
  RegenerarProjetoSchema,
  TurmasSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { JuriEstadualService } from "./juri-estadual.service";
import { MidiaDaExp06ef1bService } from "./midia.service";
import { PreparoDaExp06ef1bService } from "./preparo.service";

/**
 * Visão do PROFESSOR (e dos gestores) sobre a exp06ef1b — classe separada do
 * estudante para o `@Roles` ficar limpo, como no Jornal. A separação é decisão
 * de segurança: o gestor não tem rota que aceite `estudanteId`.
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
const QUERY = z.object({ escolaId: z.string().optional() });

/** A nota de toda rota que lê a atividade em andamento (ADR-130). */
const NOTA_SEM_ATIVIDADE =
  "Sem atividade em andamento na turma, **403** `atividade-nao-preparada`: a plataforma não cria atividade — o professor gera, cria e põe em andamento (`POST :turmaId/pacotes/:pacoteId/em-andamento`).";

/** O `?pacoteId=` opcional: inválido é 404, como o pacote de outra turma. */
function pacoteOpcional(pacoteId: string | undefined): string | undefined {
  if (pacoteId === undefined || pacoteId === "") return undefined;
  if (!ehUuid(pacoteId)) throw erroDeJogo("atividade-nao-encontrada");
  return pacoteId;
}

function turmaOu404(turmaId: string): string {
  if (!ehUuid(turmaId)) throw erroDeJogo("turma-nao-encontrada");
  return turmaId;
}

/** As rotas que gastam IA do professor têm um teto a mais: o de requisição. */
function limitar(usuarioId: string, rota: string, teto: number) {
  const r = rateLimit(`juri-estadual:${rota}:${usuarioId}`, teto, 60_000);
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
       para o professor: vão juntas, e nenhuma repete texto de projeto. */
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

@Controller("juri-estadual/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class JuriEstadualTurmasController {
  constructor(
    private readonly missao: JuriEstadualService,
    private readonly preparo: PreparoDaExp06ef1bService,
    private readonly midia: MidiaDaExp06ef1bService,
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
    resumo: "O painel da aula: o botão da auditoria, o progresso POR COMPUTADOR, os ociosos e a lousa do pico.",
    descricao:
      "Uma linha por computador quando a turma montou equipes para esta atividade (`colapsarEmUnidades`), uma por criança quando não — `resumo.porComputador` diz qual. `resumo.computadores` é o \"X de Y computadores votaram\": o Y sai da montagem das equipes.\n\n**Só progresso por linha.** O painel é PROJETADO na lousa no pico, então o voto, a taxa e o nível de cada criança NÃO estão na linha. A lousa lê o resumo ANÔNIMO: `votosPorArea` (o voto lacrado), `invisibilidadeMedia` (a média da taxa real de quem votou), `revisao` (quantos mantiveram e trocaram) e `votosRevisadosPorArea` (o voto final).\n\n**O sinalizador de ociosos**: `ocioso` na linha (e `resumo.ociosos`) acende com a cédula aberta e mais de 60 s sem toque (o batimento da tela, a cada 15 s); apaga sozinho. `categoriasBuscadas` diz quais categorias a criança buscou pela hashtag na galeria (a leitura da EF06CO01). Cada leitura conta em `painel_vistas` (EVT-P04). O nível por habilidade mora no painel de habilidades (`/evidencias/turma/:turmaId/missao/exp06ef1b/atividade/:pacoteId`).",
    params: PARAMS,
    query: QUERY,
    resposta: PainelSchema,
    notas: [NOTA_SEM_ATIVIDADE, "Turma que o professor não leciona responde **404** `turma-nao-encontrada`."],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: '"Liberar Auditoria" — o botão único da aula (a Galeria Oculta).',
    descricao:
      "O corpo diz a etapa de DESTINO: `exploracao → galeria`, nunca volta; destino igual ao atual é aceito e não muda nada (o segundo clique). Grava quando o portão abriu e uma linha em `exp06ef1b_gates_historico` (EVT-P05).\n\nQuem ainda não votou continua no feed com a galeria liberada: o voto atrasado é caminho previsto, e a galeria abre para ele depois do voto. A rodada de desvio da 0.3.0 saiu.",
    params: PARAMS,
    query: QUERY,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "Destino fora de ordem responde **409** `transicao-de-etapa-invalida`, com `etapaAtual` e `proximaEtapa` no corpo.",
      "É a linha que o polling de 3 s do estudante lê (`GET /juri-estadual/gate`): não há WebSocket de aplicação (ADR-93).",
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
      "Sobe a rodada da atividade e volta a etapa para a exploração, com a galeria fechada. **A evidência pedagógica do pacote é apagada**, de todas as rodadas (ADR-155): o painel de habilidades recomeça do zero. As sessões, os votos e o que cada criança fez na galeria ficam na folha da turma.",
    params: PARAMS,
    query: QUERY,
    resposta: ZerarTurmaSchema,
    notas: [
      "Na rodada nova do MESMO pacote, quem já foi avaliado numa anterior refaz sem marca nova nas ações (ADR-120): já viu a galeria e a regra. O guia recomenda criar outra atividade.",
      NOTA_SEM_ATIVIDADE,
    ],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.zerar(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes")
  @Contrato({
    resumo: "As atividades da turma: a mostra em andamento, inteira, e a lista de todas.",
    descricao:
      "**Professor e gestores.** `historico` lista todos os pacotes (o em andamento incluso, com `ativo: true`): cada um é uma ATIVIDADE, e o `id` dele é o `atividadeId` das equipes e do painel de habilidades (ADR-130).\n\n`ativo` é `null` quando nenhum está em andamento: a plataforma não cria atividade.",
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
    resumo: "UMA atividade, inteira — em andamento ou pronta.",
    descricao:
      "A página da atividade. `rodada` e `etapa` só vêm quando ela está em andamento; `rodadas` é a maior rodada com sessão (0 = nunca rodou). `imagens` traz as URLs já geradas, por projeto.",
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
      "O escolhido passa a ser a ATIVIDADE EM ANDAMENTO da turma; o que estava volta a ser pronto — fica, com as sessões e as rodadas. A etapa volta à exploração, com a galeria fechada.\n\nA RODADA: o pacote que nunca rodou começa na 1; o que já rodou abre a SEGUINTE à última — retomar a mesma depois da galeria liberada seria o \"voltar\" que o botão único proíbe.",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: EmAndamentoSchema,
    notas: [
      "**Idempotente**: pôr no ar o que já está no ar devolve `mudou: false` e não muda nada.",
      "Trocar com a aula correndo leva quem está jogando para a atividade nova: a experiência nota o `pacoteId` novo no polling do gate e recarrega.",
      "Sem a segunda fase da aprovação (`POST aprovar-imagens`), **409** `imagens-nao-aprovadas`: a turma abriria com imagem que o professor não viu. Os pacotes criados antes desta regra entraram aprovados (migração `20261006120000`).",
      "Pacote de outra turma responde **404** `atividade-nao-encontrada`.",
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
    resumo: "A segunda fase da aprovação: o professor viu as imagens dos estandes e as aprova.",
    descricao:
      "A primeira fase é o `POST homologar` (os textos). As imagens se geram em seguida (`POST gerar-midia?pacoteId=`), o professor vê cada uma e refaz a que não serve (`POST …/imagens/:projetoId/refazer`). Só depois desta rota a atividade vai ao ar: `POST em-andamento` responde **409** `imagens-nao-aprovadas` sem ela. Depois dela, as imagens não mudam mais.",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: ImagensAprovadasSchema,
    notas: [
      "**Idempotente**: a segunda aprovação devolve o carimbo da primeira.",
      "Não exige imagem em todo estande: a geração pode falhar ou a quota acabar, e o estande segue com a arte procedural, que o professor vê marcada na grade. Quem segura o botão até a geração terminar é a tela.",
      "Pacote de outra turma responde **404** `atividade-nao-encontrada`.",
    ],
  })
  aprovarImagens(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    return this.missao.aprovarImagens(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      pacoteOpcional(pacoteId) ?? "",
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/imagens/:projetoId/refazer")
  @HttpCode(200)
  @Contrato({
    resumo: '"Gerar outra imagem": uma imagem nova para UM estande, enquanto as imagens estão em validação.',
    descricao:
      "O professor viu a imagem do estande e ela não serve, ou o estande ficou sem imagem. Gera outra, SEMPRE paga, num arquivo novo — sobrescrever o da descrição trocaria a imagem de todo pacote que a herdou, inclusive o de uma turma em aula.",
    params: PARAMS_DO_PACOTE.extend({ projetoId: IdDeProjetoSchema }),
    query: QUERY,
    resposta: ImagemRefeitaSchema,
    notas: [
      "Depois de `aprovar-imagens`, **409** `imagens-ja-aprovadas`: a turma pode estar olhando para elas.",
      "Quota do professor, com o custo estimado de uma imagem. Sem saldo, **429** `sem-saldo-de-ia`; com o provedor fora do ar, **503** `ia-indisponivel` — e o estande fica com a imagem que tinha.",
      "`projetoId` fora de `proj-a1`…`proj-d4` responde **400** `payload-invalido`.",
    ],
  })
  refazerImagem(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Param("projetoId") projetoId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!IdDeProjetoSchema.safeParse(projetoId).success) throw erroDeJogo("payload-invalido");
    limitar(req.auth.usuarioId, "refazer-imagem", 20);
    return this.midia.refazer(
      escolaId,
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      pacoteOpcional(pacoteId) ?? "",
      projetoId,
    );
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera um RASCUNHO da mostra com IA: 4 áreas e 16 projetos sobre o tema do professor — ou o banco padrão.",
    descricao:
      "**Não persiste nada**: o que volta é rascunho para a tela editar, e criar a atividade é o `POST homologar`. A IA escreve as quatro áreas e os dezesseis projetos (com os quatro formatos de post); a saída que fere as regras da missão é regerada uma vez.\n\n**Fallback (RF-007, §12.2):** sem saldo de IA ou com a IA fora do ar, a resposta é **200** com o BANCO PADRÃO (os dezesseis projetos do PRD), `usouIa: false`, `origem: \"padrao\"` e `motivo` (`sem-saldo-de-ia` ou `ia-indisponivel`). A tela mostra o aviso e segue com um toque.",
    params: PARAMS,
    query: QUERY,
    corpo: ParametrosDoPreparoSchema,
    resposta: RascunhoSchema,
    notas: [
      "Quota do PERFIL do professor (ADR-105): `temSaldo` antes, e o que o vendor cobrou é debitado por tentativa, inclusive as recusadas.",
      "Os tetos de `tema` (3 a 60), `assuntos` (10 a 600) e `contexto` (até 120) são a primeira barreira contra injeção de instrução no gerador.",
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
    if (r.ok) return { parametros, conteudo: r.valor, usouIa: true, origem: "ia" as const, motivo: null };
    /* Sem cota ou sem IA: o banco padrão, para a aula acontecer (RF-007, §12.2). */
    return { parametros, conteudo: conteudoDoBancoPadrao(), usouIa: false, origem: "padrao" as const, motivo: r.codigo };
  }

  @Post(":turmaId/banco-padrao")
  @HttpCode(200)
  @Contrato({
    resumo: '"Usar Banco Padrão Oficial" — a atividade pronta, sem IA, em um toque (e no ar, com `porNoAr`).',
    descricao:
      "O caminho curto do professor (E0-PROF-02, RF-007): cria a ATIVIDADE com os dezesseis projetos do banco padrão (`origem: \"padrao\"`), sem chamada de IA, sem curadoria e com as imagens já aprovadas (os estandes usam a arte procedural). Se a turma já tem esse pacote, reaproveita. Com `porNoAr: true`, põe em andamento na mesma chamada — o \"Usar Banco Padrão e Pôr no ar\" (as mesmas regras de `POST …/em-andamento`). O podcast dele é o roteiro fixo do sheet: não há falas a revisar.",
    params: PARAMS,
    query: QUERY,
    corpo: BancoPadraoSchema,
    resposta: PacoteHomologadoSchema,
    notas: ["Turma que o professor não leciona responde **404** `turma-nao-encontrada`."],
  })
  bancoPadrao(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { porNoAr } = valida(BancoPadraoSchema, corpo ?? {});
    return this.missao.usarBancoPadrao(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      porNoAr,
    );
  }

  @Post(":turmaId/regenerar-projeto")
  @HttpCode(200)
  @Contrato({
    resumo: "Regenera UM projeto do rascunho, mantendo o id e a área.",
    descricao:
      "O novo projeto mantém o id e a ÁREA do que sai (a hashtag da área primeiro), não repete o título de outro, e o pacote inteiro, com ele no lugar, continua válido. Não persiste.",
    params: PARAMS,
    query: QUERY,
    corpo: RegenerarProjetoSchema,
    resposta: ProjetoRegeneradoSchema,
    notas: [
      "A mesma quota do `gerar-conteudo`: sem saldo responde **429** `sem-saldo-de-ia`. Com a IA fora do ar ou a saída fora das regras, responde **200** com `usouIa: false` e o projeto COMO ESTAVA no rascunho enviado.",
    ],
  })
  async regenerarProjeto(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const turma = turmaOu404(turmaId);
    const pedido = valida(RegenerarProjetoSchema, corpo);
    limitar(req.auth.usuarioId, "regenerar-projeto", 20);
    await this.missao.exigirTurmaVisivel(escolaId, turma, professorDoToken(req.auth));
    const { conteudo, projetoId, ...parametros } = pedido;
    const r = await this.preparo.regenerar(escolaId, req.auth.usuarioId, req.auth.perfil, parametros, conteudo, projetoId);
    if (r.chamouIa) await this.missao.registrarGeracao(escolaId, turma, r.tokens);
    if (r.ok) return { projeto: r.valor, usouIa: true };
    if (r.codigo === "sem-saldo-de-ia") throw erroDeJogo(r.codigo);
    /* A IA não respondeu: o projeto volta COMO ESTAVA, e a tela diz que nada mudou. */
    const comoEstava = conteudo.projetos.find((p) => p.id === projetoId);
    if (!comoEstava) throw erroDeJogo("payload-invalido");
    return { projeto: comoEstava, usouIa: false };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Criar atividade" — a curadoria humana (ADR-66/67).',
    descricao:
      "Grava a mostra como o professor a deixou, numa ATIVIDADE NOVA que nasce **pronta, não no ar** (ADR-130): o pacote em andamento continua em andamento, e quem escolhe o que a turma faz é o professor (`POST :turmaId/pacotes/:pacoteId/em-andamento`). O mesmo conteúdo do pacote mais recente não cria outro: é o segundo clique.\n\nÉ a PRIMEIRA fase da aprovação (os textos): o pacote nasce com `imagensAprovadasEm` nulo e só vai ao ar depois da segunda (`POST :turmaId/pacotes/:pacoteId/aprovar-imagens`).\n\nAs imagens de projeto com a MESMA descrição de um pacote recente da turma são herdadas — o arquivo no bucket é o hash da descrição.",
    params: PARAMS,
    query: QUERY,
    corpo: HomologacaoSchema,
    resposta: PacoteHomologadoSchema,
    notas: [
      "O pacote é recusado com **400** `pacote-invalido` e a LISTA de problemas em `erros`, em frases para o professor: quatro categorias, uma por área, com hashtags diferentes no formato `#minusculas`; os dezesseis projetos `proj-a1` a `proj-d4`, cada um na área que o id diz e começando pela hashtag da área; perfil com @; legenda até 60 palavras, e bastidor, protótipo e depoimento até 40; e nenhuma marca ou plataforma real no que a criança lê. (`.superRefine()` some do OpenAPI; daí esta nota.)",
      "`podcast` são as três falas do podcast de recapitulação que o professor revisou na criação (ADR-150, ADR-151): `dois`, `rafa` e `mesa`, cada uma de 12 a 60 palavras, até 400 bytes, sem link, e-mail nem @. Vão para `podcast_roteiros` na MESMA transação, também no segundo clique — que as substitui.",
      "O conteúdo IGUAL ao banco padrão (o fallback homologado como veio) cria o pacote com `origem: \"padrao\"`. `preparoIniciadoEm` (opcional) é quando a tela de criação abriu (EVT-P01); a homologação grava `aprovado_em`/`aprovado_por` (EVT-P03).",
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
    resumo: "Gera as próximas imagens dos estandes de uma atividade — incremental.",
    descricao:
      "As dezesseis imagens não cabem nos 30 s que o BFF dá a uma chamada: cada chamada gera ATÉ DUAS novas (4:3), grava as URLs no pacote e devolve o progresso. **Repita enquanto `completo` for `false` e a chamada anterior tiver gerado alguma** — `falharam` diz o que não saiu, e esses estandes seguem com a arte procedural.\n\nIdempotente: o que já tem URL é pulado, e a imagem de mesma descrição que já está no bucket entra sem custo.",
    params: PARAMS,
    query: QueryDoPacoteSchema,
    resposta: ProgressoDaMidiaSchema,
    notas: [
      "`?pacoteId=` diz a atividade (a pronta, preparada antes de ir ao ar); sem ele, a em andamento — e sem nenhuma, **403** `atividade-nao-preparada`.",
      "Quota do professor, com custo ESTIMADO por imagem (a geração não devolve contagem de tokens). Sem saldo responde **429** `sem-saldo-de-ia` — e a missão roda igual, com a arte procedural.",
      "Duas chamadas simultâneas para o mesmo pacote recebem o mesmo trabalho (lock de processo).",
      "Só antes da aprovação das imagens: depois de `aprovar-imagens`, **409** `imagens-ja-aprovadas` — gerar a que falta levaria à turma uma imagem que o professor não viu.",
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

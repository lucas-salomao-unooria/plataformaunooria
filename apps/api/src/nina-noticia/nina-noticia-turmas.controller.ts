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
import { ImagensDoBancoPadraoDaExp03ef1bService } from "./banco-padrao-imagens.service";
import {
  BancoPadraoSchema,
  ChaveDaImagemSchema,
  EmAndamentoSchema,
  GateDaTurmaSchema,
  GateSchema,
  HomologacaoSchema,
  ImagemRefeitaSchema,
  ImagensAprovadasSchema,
  MaterialSchema,
  PacoteDetalheSchema,
  PacoteHomologadoSchema,
  PacotesSchema,
  PainelSchema,
  ParametrosDoPreparoSchema,
  ProgressoDaMidiaSchema,
  RascunhoSchema,
  RegenerarReportagemSchema,
  ReportagemRegeneradaSchema,
  TurmasSchema,
  ZerarTurmaSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { MidiaDaExp03ef1bService } from "./midia.service";
import { NinaNoticiaService } from "./nina-noticia.service";
import { PreparoDaExp03ef1bService } from "./preparo.service";
import { imagensDoPacote } from "./regras/imagens";

/**
 * Visão da PROFESSORA (e dos gestores) sobre a exp03ef1b — classe separada do
 * estudante para o `@Roles` ficar limpo. Toda rota com `turmaId` passa por
 * `turmaVisivel` no service: turma que a professora não leciona é **404**,
 * nunca 403. `gestor_contrato` e `admin` dizem `?escolaId=`
 * (`comum/escola-alvo.ts`).
 */

type Autenticado = { auth: AuthClaims };

const PARAMS = z.object({ turmaId: z.string().uuid() });
const PARAMS_DO_PACOTE = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
const QUERY = z.object({ escolaId: z.string().optional() });

const NOTA_SEM_ATIVIDADE =
  "Sem atividade em andamento na turma, **403** `atividade-nao-preparada`: a professora cria a atividade (banco padrão ou IA) e a põe em andamento.";
const NOTA_DA_TURMA = "Turma que a professora não leciona responde **404** `turma-nao-encontrada`.";

function pacoteOpcional(pacoteId: string | undefined): string | undefined {
  if (pacoteId === undefined || pacoteId === "") return undefined;
  if (!ehUuid(pacoteId)) throw erroDeJogo("atividade-nao-encontrada");
  return pacoteId;
}

function turmaOu404(turmaId: string): string {
  if (!ehUuid(turmaId)) throw erroDeJogo("turma-nao-encontrada");
  return turmaId;
}

/** As rotas que gastam IA da professora têm um teto a mais: o de requisição. */
function limitar(usuarioId: string, rota: string, teto: number) {
  if (!rateLimit(`nina-noticia:${rota}:${usuarioId}`, teto, 60_000).ok) throw erroDeJogo("muitas-requisicoes");
}

function valida<S extends z.ZodTypeAny>(
  schema: S,
  corpo: unknown,
  codigo: "payload-invalido" | "pacote-invalido" = "payload-invalido",
): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    /* Na homologação, as frases do `superRefine` (`problemasDoPacote`) são para a professora: vão juntas. */
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

@Controller("nina-noticia/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class NinaNoticiaTurmasController {
  constructor(
    private readonly missao: NinaNoticiaService,
    private readonly preparo: PreparoDaExp03ef1bService,
    private readonly midia: MidiaDaExp03ef1bService,
    private readonly imagensDoBanco: ImagensDoBancoPadraoDaExp03ef1bService,
  ) {}

  @Get()
  @Contrato({
    resumo: "Turmas para o seletor do painel.",
    descricao: "Filtradas por MATRÍCULA para a professora; o gestor vê a escola. `gestor_contrato` precisa dizer `?escolaId=`.",
    query: QUERY,
    resposta: TurmasSchema,
  })
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/painel")
  @Contrato({
    resumo: '"Painel da Sala em Tempo Real": o progresso POR COMPUTADOR, as escolhas da Etapa 2 e os alertas.',
    descricao:
      "Uma linha por computador quando a turma montou equipes para esta atividade, uma por criança quando não (`resumo.porComputador`). **A linha diz só progresso e alerta** — nunca acerto, escolha nem nível. `resumo.porEtapa` é o \"Equipes na etapa N\"; `resumo.escolhas` é o card \"Escolhas da Etapa 2\" (quantos escolheram 1, 2 ou 3 notícias e qual ficou de fora), anônimo; `resumo.alertas` conta \"repetição sem parada\" (> 3 testes da rotina sem a válida) e \"carimbos uniformes\". Polling de 5 s.",
    params: PARAMS,
    query: QUERY,
    resposta: PainelSchema,
    notas: [NOTA_SEM_ATIVIDADE, NOTA_DA_TURMA],
  })
  painel(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.painel(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/gate")
  @HttpCode(200)
  @Contrato({
    resumo: '"Liberar Filtro" / "Liberar Inspeção" e "Pausar Turma" / "Retomar Turma".',
    descricao:
      "`liberar` abre a PRÓXIMA etapa (`aposta → filtro → inspecao`; `para`, se vier, tem de ser a próxima — a mesma é no-op). `pausar` congela todas as telas; `retomar` solta. Liberar com a turma pausada não despausa. Cada clique que muda algo grava uma linha em `exp03ef1b_gates_historico`.",
    params: PARAMS,
    query: QUERY,
    corpo: GateSchema,
    resposta: GateDaTurmaSchema,
    notas: [
      "Fora de ordem (pular, voltar, liberar depois da última): **409** `transicao-de-etapa-invalida`, com `etapaAtual` e `proximaEtapa` no corpo.",
      NOTA_SEM_ATIVIDADE,
      NOTA_DA_TURMA,
    ],
  })
  gate(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const pedido = valida(GateSchema, corpo);
    return this.missao.mudarGate(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      pedido,
    );
  }

  @Post(":turmaId/zerar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Zerar Turma" — abre a próxima rodada e apaga a evidência pedagógica da atividade.',
    descricao:
      "Sobe a rodada, volta à etapa da escolha e despausa. **A evidência do pacote é apagada**, de todas as rodadas (ADR-155). As sessões anteriores ficam.",
    params: PARAMS,
    query: QUERY,
    resposta: ZerarTurmaSchema,
    notas: [NOTA_SEM_ATIVIDADE, NOTA_DA_TURMA],
  })
  zerar(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.zerar(
      escolaAlvo(req.auth, escolaIdPedida),
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
    );
  }

  @Get(":turmaId/material")
  @Contrato({
    resumo: "O guia da aula: o esqueleto COM gabarito, o roteiro de mediação e os gatilhos.",
    descricao:
      "Os cartões K1–K6 com o certo, a sequência da rotina, as fichas-teste, a regra do reparo, as três perguntas de mediação com o cuidado de cada uma e os gatilhos de condução. `pacote` é a atividade em andamento (ou `null`).",
    params: PARAMS,
    query: QUERY,
    resposta: MaterialSchema,
    notas: ["`cartoes[].certo` é gabarito e só existe em rota de professor.", NOTA_DA_TURMA],
  })
  material(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.material(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Post(":turmaId/banco-padrao")
  @HttpCode(200)
  @Contrato({
    resumo: '"Usar Banco Padrão" — a Feira de Troca de Livros, pronta, em um toque (e no ar, com `porNoAr`).',
    descricao:
      "Cria (ou reaproveita) a atividade `padrao`, sem IA, com as imagens já APROVADAS: as do banco que o `admin` já gerou entram na `midia`; a que falta segue com a ilustração local. Com `porNoAr: true`, põe em andamento na mesma chamada.",
    params: PARAMS,
    query: QUERY,
    corpo: BancoPadraoSchema,
    resposta: PacoteHomologadoSchema,
    notas: [NOTA_DA_TURMA],
  })
  async bancoPadrao(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const { porNoAr } = valida(BancoPadraoSchema, corpo ?? {});
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const turma = turmaOu404(turmaId);
    await this.missao.exigirTurmaVisivel(escolaId, turma, professorDoToken(req.auth));
    return this.missao.usarBancoPadrao(
      escolaId,
      turma,
      professorDoToken(req.auth),
      req.auth.usuarioId,
      porNoAr,
      await this.imagensDoBanco.existentes(),
    );
  }

  @Post(":turmaId/gerar-conteudo")
  @HttpCode(200)
  @Contrato({
    resumo: '"Gerar Notícias com IA": um RASCUNHO das três reportagens — ou o banco padrão.',
    descricao:
      "**Não persiste nada**: o rascunho volta para a tela revisar, e criar a atividade é o `POST homologar`. A IA escreve só TEXTO (tema, cartaz, manchete, legenda e a descrição de cada cena); a ESTRUTURA (os três suportes, o Onde vazio no telão, o pátio) é do servidor, e o pacote passa pela régua (`problemasDoPacote`) antes de voltar — reprovado, a tentativa é regerada.\n\n**Fallback:** sem saldo ou com a IA fora do ar, **200** com o BANCO PADRÃO, `usouIa: false`, `origem: \"padrao\"`, `motivo` e as imagens do banco que já existem. O rascunho da IA vem com `imagens` vazio.",
    params: PARAMS,
    query: QUERY,
    corpo: ParametrosDoPreparoSchema,
    resposta: RascunhoSchema,
    notas: [
      "Quota do PERFIL da professora (ADR-105): `temSaldo` antes; o que o vendor cobrou é debitado por tentativa. Medido no painel de custos no recurso `nina-noticia`.",
      NOTA_DA_TURMA,
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
    if (r.ok) return { parametros, conteudo: r.valor, usouIa: true, origem: "ia" as const, motivo: null, imagens: {} };
    return {
      parametros,
      conteudo: conteudoDoBancoPadrao(),
      usouIa: false,
      origem: "padrao" as const,
      motivo: r.codigo,
      imagens: imagensDoPacote(await this.imagensDoBanco.existentes()),
    };
  }

  @Post(":turmaId/regenerar-reportagem")
  @HttpCode(200)
  @Contrato({
    resumo: '"Regenerar Notícia": UMA reportagem do rascunho, no mesmo suporte.',
    descricao:
      "A nova mantém o suporte e a ficha dele (a estrutura é do servidor), não repete a manchete das outras, e o pacote inteiro continua válido. Não persiste.",
    params: PARAMS,
    query: QUERY,
    corpo: RegenerarReportagemSchema,
    resposta: ReportagemRegeneradaSchema,
    notas: [
      "Sem saldo: **429** `sem-saldo-de-ia`. Com a IA fora do ar ou a saída fora das regras: **200** com `usouIa: false` e a reportagem COMO ESTAVA.",
      NOTA_DA_TURMA,
    ],
  })
  async regenerarReportagem(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const turma = turmaOu404(turmaId);
    const { conteudo, suporte, ...parametros } = valida(RegenerarReportagemSchema, corpo);
    limitar(req.auth.usuarioId, "regenerar-reportagem", 20);
    await this.missao.exigirTurmaVisivel(escolaId, turma, professorDoToken(req.auth));
    const r = await this.preparo.regenerar(escolaId, req.auth.usuarioId, req.auth.perfil, parametros, conteudo, suporte);
    if (r.chamouIa) await this.missao.registrarGeracao(escolaId, turma, r.tokens);
    if (r.ok) return { reportagem: r.valor, usouIa: true };
    if (r.codigo === "sem-saldo-de-ia") throw erroDeJogo(r.codigo);
    const comoEstava = conteudo.reportagens.find((x) => x.suporte === suporte);
    if (!comoEstava) throw erroDeJogo("payload-invalido");
    return { reportagem: comoEstava, usouIa: false };
  }

  @Post(":turmaId/homologar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Homologar Pacote" — a primeira fase da aprovação (os textos).',
    descricao:
      "Grava o pacote como a professora o deixou, numa ATIVIDADE NOVA que nasce **pronta, não no ar**, com `imagensAprovadasEm` nulo: as imagens se geram em seguida (`POST …/pacotes/:pacoteId/gerar-midia`), a professora confere (a do telão precisa mostrar o pátio) e aprova (`POST …/aprovar-imagens`). O mesmo conteúdo do pacote mais recente é o segundo clique.",
    params: PARAMS,
    query: QUERY,
    corpo: HomologacaoSchema,
    resposta: PacoteHomologadoSchema,
    notas: [
      "Pacote fora das regras: **400** `pacote-invalido` com a LISTA de problemas em `erros`, em frases para a professora (três suportes na ordem, fichas da estrutura, manchete até 4 palavras, legenda até 15, a cena do telão com o pátio, nenhuma marca). (`.superRefine()` some do OpenAPI; daí esta nota.)",
      "O conteúdo IGUAL ao banco padrão vira `origem: \"padrao\"` e leva as imagens do banco que já existem.",
      NOTA_DA_TURMA,
    ],
  })
  async homologar(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const pacote = valida(HomologacaoSchema, corpo, "pacote-invalido");
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const turma = turmaOu404(turmaId);
    await this.missao.exigirTurmaVisivel(escolaId, turma, professorDoToken(req.auth));
    return this.missao.homologar(
      escolaId,
      turma,
      professorDoToken(req.auth),
      req.auth.usuarioId,
      pacote,
      await this.imagensDoBanco.existentes(),
    );
  }

  @Get(":turmaId/pacotes")
  @Contrato({
    resumo: "As atividades da turma: a em andamento, inteira, e a lista de todas.",
    descricao: "Cada pacote é uma ATIVIDADE; o `id` é o `atividadeId` das equipes e do painel de habilidades (ADR-130).",
    params: PARAMS,
    query: QUERY,
    resposta: PacotesSchema,
    notas: ["`rodadas` é a maior rodada com sessão daquele pacote; 0 = nunca rodou.", NOTA_DA_TURMA],
  })
  pacotes(@Param("turmaId") turmaId: string, @Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.missao.pacotes(escolaAlvo(req.auth, escolaIdPedida), turmaOu404(turmaId), professorDoToken(req.auth));
  }

  @Get(":turmaId/pacotes/:pacoteId")
  @Contrato({
    resumo: "UMA atividade, inteira — em andamento ou pronta.",
    descricao: "`imagens` traz as URLs já geradas das quatro imagens do pacote (`mural`, `portal`, `telao`, `cartaz`).",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: PacoteDetalheSchema,
    notas: ["Pacote de outra turma, ou que não existe: **404** `atividade-nao-encontrada`."],
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

  @Post(":turmaId/pacotes/:pacoteId/gerar-midia")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera as imagens que faltam no pacote: as três cenas e o cartaz.",
    descricao:
      "Até quatro novas por chamada, em paralelo. Repita enquanto `completo` for `false` e a chamada anterior tiver gerado alguma; `falharam` diz o que não saiu (segue a ilustração local). O que já está no bucket (o mesmo pedido) entra sem custo. As cenas fixas do caso novo e do Desafio Extra vêm do banco do `admin`, de graça, se já existirem.",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: ProgressoDaMidiaSchema,
    notas: [
      "Quota da professora, com custo ESTIMADO por imagem. Sem saldo: **429** `sem-saldo-de-ia`.",
      "Depois de `aprovar-imagens`: **409** `imagens-ja-aprovadas`.",
      "Pacote de outra turma: **404** `atividade-nao-encontrada`.",
    ],
  })
  gerarMidia(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
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
      pacoteOpcional(pacoteId) ?? "",
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/imagens/:chave/refazer")
  @HttpCode(200)
  @Contrato({
    resumo: '"Refazer imagem": uma imagem nova para UMA chave (a do telão é a que a tela destaca).',
    descricao: "Sempre paga, num arquivo novo — sobrescrever o do pedido trocaria a imagem de todo pacote que a herdou.",
    params: PARAMS_DO_PACOTE.extend({ chave: ChaveDaImagemSchema }),
    query: QUERY,
    resposta: ImagemRefeitaSchema,
    notas: [
      "`chave` fora de `mural`, `portal`, `telao`, `cartaz`: **400** `imagem-desconhecida`.",
      "Depois de `aprovar-imagens`: **409** `imagens-ja-aprovadas`. Sem saldo: **429** `sem-saldo-de-ia`; provedor fora: **503** `ia-indisponivel` (fica a imagem que tinha).",
    ],
  })
  refazerImagem(
    @Param("turmaId") turmaId: string,
    @Param("pacoteId") pacoteId: string,
    @Param("chave") chave: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const lida = ChaveDaImagemSchema.safeParse(chave);
    if (!lida.success) throw erroDeJogo("imagem-desconhecida");
    limitar(req.auth.usuarioId, "refazer-imagem", 20);
    return this.midia.refazer(
      escolaId,
      turmaOu404(turmaId),
      professorDoToken(req.auth),
      req.auth.usuarioId,
      req.auth.perfil,
      pacoteOpcional(pacoteId) ?? "",
      lida.data,
    );
  }

  @Post(":turmaId/pacotes/:pacoteId/aprovar-imagens")
  @HttpCode(200)
  @Contrato({
    resumo: "A segunda fase da aprovação: a professora viu as imagens (e o pátio na do telão).",
    descricao: "Só depois dela a atividade vai ao ar (`em-andamento` responde 409 `imagens-nao-aprovadas` sem ela); depois dela, as imagens não mudam. Idempotente.",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: ImagensAprovadasSchema,
    notas: ["Pacote de outra turma: **404** `atividade-nao-encontrada`."],
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

  @Post(":turmaId/pacotes/:pacoteId/em-andamento")
  @HttpCode(200)
  @Contrato({
    resumo: '"Liberar Atividade para a Turma" — a atividade escolhida vai ao ar (ADR-130).',
    descricao:
      "O escolhido vira a atividade EM ANDAMENTO; o que estava volta a ser pronto. O gate volta à etapa da escolha, despausado; o pacote que já rodou abre a rodada SEGUINTE à última. Idempotente (`mudou: false`).",
    params: PARAMS_DO_PACOTE,
    query: QUERY,
    resposta: EmAndamentoSchema,
    notas: [
      "Sem a segunda fase da aprovação: **409** `imagens-nao-aprovadas`.",
      "Pacote de outra turma: **404** `atividade-nao-encontrada`.",
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
}

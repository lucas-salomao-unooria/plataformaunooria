import { BadRequestException, Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { atividadeDoProfessor, ehUuid, naoEncontrado } from "../motor/guardas";
import { PrismaService } from "../prisma/prisma.service";
import { metricasDaAtividade } from "./metricas";
import { analiseDeProduto, resumoDeTodasAsAtividades } from "./produto";
import { analiseDaTurma, turmaEmCsv } from "./turma";
import { Contrato } from "../openapi/contrato";
import {
  AnaliseDaTurmaSchema,
  AnaliseDeProdutoSchema,
  CsvSchema,
  EscolaQuery,
  NivelQuery,
  ResumoDeProdutoSchema,
} from "./contrato-de-rotas";

/**
 * As duas superfícies de ANÁLISE — porte fiel de `app/api/activities/[id]/analise/**`
 * e `app/api/analise/**` do origem.
 *
 * Elas respondem perguntas diferentes e por isso têm perfis diferentes: o nível
 * PEDAGÓGICO (doc 11 §4) é do professor e é identificado — é a turma dele; o
 * nível de PRODUTO (doc 11 §5) é da Unooria e olha se a ATIVIDADE funciona, não
 * se a turma aprendeu. No origem o segundo era do perfil `analista`, que aqui
 * não existe: virou `admin-contrato` (auth/claims.ts).
 */

type Autenticado = { auth: AuthClaims };

/**
 * Só o que os handlers de CSV precisam da resposta do Express — evita depender
 * de `@types/express` (não instalado) para dois `setHeader`.
 */
type RespostaHttp = { setHeader(nome: string, valor: string): void };

/**
 * TENANCY DA ANÁLISE DE PRODUTO — a única exceção cross-escola do sistema.
 *
 * `admin-contrato` tem `escolaId` VAZIO no token (auth/claims.ts): ele enxerga o
 * contrato inteiro, não uma escola. Como `comTenancy` sem escola falha alto de
 * propósito, estas rotas exigem `?escolaId=` e o repassam explicitamente. Assim
 * escolher a escola é ato deliberado de quem chama — visível na URL e no log —
 * em vez de um "sem escola = todas" silencioso. A RLS fica armada com essa
 * escola, então as varreduras "de todas as atividades" (doc 11 §5.3) são
 * varreduras DAQUELA escola, e a regra 1 continua valendo linha a linha.
 */
const EscolaSchema = z.object({ escolaId: z.string().trim().min(1).max(64) });

function escolaPedida(query: unknown): string {
  const parsed = EscolaSchema.safeParse(query);
  if (!parsed.success) {
    throw new BadRequestException({
      mensagem: "Informe ?escolaId= — a análise de produto lê uma escola por vez.",
    });
  }
  return parsed.data.escolaId;
}

@Controller("atividades")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class AnaliseDaTurmaController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /atividades/:id/analise — nível pedagógico (doc 11 §4).
   *
   * Identificado: é a turma dele, e o professor precisa saber com quem falar. Só o
   * professor DONO da atividade lê (`atividadeDoProfessor`).
   */
  @Get(":id/analise")
  @Contrato({
    resumo: "A análise pedagógica da turma — identificada.",
    descricao:
      "É a turma DELE, e o professor precisa saber com quem falar. Só o professor DONO da atividade lê.\n\nA peça central é `conclusaoPorLadoSemeado`: se o lado em que o feed nasceu prevê a conclusão que o estudante escreveu, o resultado experimental da turma está nessa grade — e é ela que o professor projeta no momento-espelho. Tudo o mais na tela existe para explicar essa grade.",
    params: z.object({ id: z.string().uuid() }),
    resposta: AnaliseDaTurmaSchema,
    notas: [
      "`imersao.total` nunca aparece sem os componentes — regra do doc, e vale para o relatório, o monitor e a análise.",
      "`ociosoHaMs` é `null` quando a run acabou: ninguém precisa ser cutucado por estar \"ocioso\" num relatório.",
      "`colecao` conta o ÚLTIMO evento por post (salvar e dessalvar se anulam); `interacoes.salvos` conta eventos.",
    ],
  })
  async daTurma(@Param("id") id: string, @Req() req: Autenticado) {
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();
      return analiseDaTurma(tx, id);
    });
  }

  /**
   * GET .../analise/csv — a mesma análise, em planilha (doc 11 §4.2).
   *
   * O nome do arquivo sai no `content-disposition`; o caminho não termina em
   * `.csv` porque no origem segmento de rota com ponto quebrava a validação de
   * tipos do App Router (docs/07-api-routes.md). Mantido igual: é o path que as
   * telas portadas chamam, e o cliente nomeia o download pelo header.
   */
  @Get(":id/analise/csv")
  @Contrato({
    resumo: "A mesma análise da turma, em planilha.",
    descricao:
      "O nome do arquivo sai no `content-disposition`. O caminho **não** termina em `.csv` porque no app de origem segmento de rota com ponto quebrava a validação de tipos do App Router — mantido igual, porque é o path que as telas portadas chamam.",
    params: z.object({ id: z.string().uuid() }),
    resposta: CsvSchema,
    tipoDaResposta: "text/csv",
    notas: ["BOM UTF-8 **e** `charset=utf-8`: um sem o outro ainda quebra acento em alguma planilha."],
  })
  async csvDaTurma(
    @Param("id") id: string,
    @Req() req: Autenticado,
    @Res({ passthrough: true }) res: RespostaHttp,
  ): Promise<string> {
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, req.auth.usuarioId, req.auth.escolaId);
      if (!atividade) naoEncontrado();

      const analise = await analiseDaTurma(tx, id);
      const arquivo = `analise-${analise.atividade.titulo
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .toLowerCase()
        .slice(0, 40)}.csv`;

      // `charset=utf-8` mais o BOM do próprio conteúdo: um sem o outro ainda
      // quebra acento em alguma das duas planilhas.
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${arquivo}"`);
      return turmaEmCsv(analise);
    });
  }
}

/** Teto do export por evento — o origem parava no mesmo número. */
const LIMITE_DE_EVENTOS = 200_000;

@Controller("analise")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin-contrato")
export class AnaliseDeProdutoController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /analise/resumo — uma linha por atividade, para o time da Unooria
   * (doc 11 §5.1 e §5.3).
   *
   * Guarda de papel própria: `admin-contrato` não é professor nem estudante, e as
   * guardas existentes recusariam os dois. O professor NÃO alcança esta rota.
   */
  @Get("resumo")
  @Contrato({
    resumo: "Uma linha por atividade — o nível de produto.",
    descricao:
      "Guarda de papel própria: `admin-contrato` não é professor nem estudante, e as guardas existentes recusariam os dois. **O professor NÃO alcança esta rota.**",
    query: EscolaQuery,
    resposta: ResumoDeProdutoSchema,
  })
  async resumo(@Query() query: unknown) {
    const escolaId = escolaPedida(query);
    return this.prisma.comTenancy(
      async (tx) => ({ atividades: await resumoDeTodasAsAtividades(tx) }),
      escolaId,
    );
  }

  /**
   * GET /analise/atividades/:id — o detalhe de uma atividade, incluindo a
   * **eficácia da escrita por perfil** (doc 11 §5.2), a única métrica do sistema
   * capaz de refutar a premissa do produto.
   */
  @Get("atividades/:id")
  @Contrato({
    resumo: "O detalhe de uma atividade, com a eficácia da escrita por perfil.",
    descricao:
      "`eficaciaDaEscrita` é **a única métrica do sistema capaz de refutar a premissa do produto**: o dwell dos posts de um perfil entre estudantes daquele perfil, menos o dwell dos MESMOS posts entre estudantes de outro — sempre com a exposição no denominador.\n\nSem o denominador, mediria o próprio viés do feed (que serve mais posts do perfil do estudante) e \"confirmaria\" a premissa por construção. Se o delta for zero, as fichas de linguagem não funcionam — e a gente descobre com número em vez de achismo.",
    params: z.object({ id: z.string().uuid() }),
    query: EscolaQuery,
    resposta: AnaliseDeProdutoSchema,
  })
  async atividade(@Param("id") id: string, @Query() query: unknown) {
    const escolaId = escolaPedida(query);
    if (!ehUuid(id)) naoEncontrado();
    return this.prisma.comTenancy((tx) => analiseDeProduto(tx, id), escolaId);
  }

  /**
   * GET /analise/csv?nivel=run|evento — export do nível de produto (doc 11 §5).
   *
   * Dois níveis porque as perguntas são diferentes: **por run** responde "como as
   * turmas se comparam"; **por evento** é a matéria-prima para quem quer recalcular
   * tudo fora daqui, inclusive contestando as definições do doc 11 §3. Um sistema de
   * análise que não deixa auditar o próprio cálculo não deveria ser levado a sério.
   *
   * Mesmo formato do CSV do professor: BOM UTF-8 e `;` como separador.
   */
  @Get("csv")
  @Contrato({
    resumo: "Export do nível de produto — por run ou por evento.",
    descricao:
      "Dois níveis porque as perguntas são diferentes: **por run** responde \"como as turmas se comparam\"; **por evento** é a matéria-prima para quem quer recalcular tudo fora daqui, inclusive contestando as definições. Um sistema de análise que não deixa auditar o próprio cálculo não deveria ser levado a sério.",
    query: NivelQuery,
    resposta: CsvSchema,
    tipoDaResposta: "text/csv",
    notas: ["Teto de 200.000 eventos no nível `evento`."],
  })
  async csv(
    @Query() query: unknown,
    @Query("nivel") nivelBruto: string | undefined,
    @Res({ passthrough: true }) res: RespostaHttp,
  ): Promise<string> {
    const escolaId = escolaPedida(query);
    const nivel = nivelBruto === "evento" ? "evento" : "run";

    const corpo = await this.prisma.comTenancy(async (tx) => {
      const atividades = await tx.activity.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, titulo: true, status: true },
      });

      const sep = ";";
      const num = (valor: number) => String(valor).replace(".", ",");
      const txt = (valor: string) => `"${valor.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

      let corpo: string;

      if (nivel === "run") {
        const colunas = [
          "atividade",
          "status",
          "usuario",
          "fase",
          "perfil_do_jogo",
          "lado_semeado",
          "origem_do_lado",
          "lado_final",
          "inverteu",
          "bloco_da_inversao",
          "conclusao",
          "posts_consumidos",
          "ms_de_feed",
          "ms_ativos",
          "ms_no_lado_semeado",
          "ms_no_outro_lado",
          "usos_da_busca",
          "considerou_o_oposto",
          "imersao_total",
          "continuidade",
          "atencao",
          "gestos",
          "voluntariedade",
          "exploracao",
          "posts_por_minuto",
          "variacao_do_ritmo",
          "perfil_observado",
          "veredito_do_perfil",
        ];

        const linhas: string[] = [];
        for (const atividade of atividades) {
          for (const estudante of await metricasDaAtividade(tx, atividade.id)) {
            const outro = estudante.bolha.ladoInicial === "A" ? "B" : "A";
            const ponto = (chave: string) =>
              num(estudante.imersao.componentes.find((c) => c.chave === chave)?.pontos ?? 0);

            linhas.push(
              [
                txt(atividade.titulo),
                atividade.status,
                estudante.estudante.username,
                estudante.fase,
                estudante.perfilJogo?.dominante ?? "ausente",
                estudante.bolha.ladoInicial,
                estudante.bolha.ladoOrigem,
                estudante.ladoDominante,
                estudante.bolha.inverteu ? "sim" : "nao",
                estudante.bolha.blocoDaInversao ?? "",
                estudante.conclusao?.inclinacao ?? "nao concluiu",
                estudante.postsConsumidos,
                estudante.tempo.feedMs,
                estudante.tempo.ativoMs,
                estudante.tempo.porLadoMs[estudante.bolha.ladoInicial],
                estudante.tempo.porLadoMs[outro],
                estudante.investigacao.usosDaBusca,
                estudante.investigacao.consideracaoDoOposto,
                num(estudante.imersao.total),
                ponto("continuidade"),
                ponto("atencao"),
                ponto("gestos"),
                ponto("voluntariedade"),
                ponto("exploracao"),
                num(estudante.ritmo.postsPorMinuto),
                num(estudante.ritmo.variacaoDoRitmo),
                estudante.perfilObservado.dominante ?? "nenhum",
                estudante.perfilObservado.veredito,
              ].join(sep),
            );
          }
        }
        corpo = `﻿${colunas.join(sep)}\n${linhas.join("\n")}\n`;
      } else {
        /**
         * Por evento: junta o post para que quem recalcular fora daqui tenha lado,
         * perfil e intensidade — sem isso o CSV não permite refazer nem a métrica
         * mais simples.
         */
        const eventos = await tx.event.findMany({
          orderBy: { id: "asc" },
          take: LIMITE_DE_EVENTOS,
          select: {
            id: true,
            tipo: true,
            payload: true,
            clientTs: true,
            createdAt: true,
            run: {
              select: {
                id: true,
                ladoInicial: true,
                estudante: { select: { username: true } },
                activity: { select: { titulo: true } },
              },
            },
            post: { select: { lado: true, perfil: true, intensidade: true, categoria: true } },
          },
        });

        const colunas = [
          "atividade",
          "usuario",
          "run_id",
          "lado_semeado",
          "evento",
          "post_lado",
          "post_perfil",
          "post_intensidade",
          "post_categoria",
          "dwell_ms",
          "termo",
          "aba",
          "client_ts",
          "gravado_em",
        ];

        const campo = (payload: unknown, chave: string) => {
          if (payload === null || typeof payload !== "object") return "";
          const valor = (payload as Record<string, unknown>)[chave];
          return valor === undefined || valor === null ? "" : String(valor);
        };

        corpo = `﻿${colunas.join(sep)}\n${eventos
          .map((evento) =>
            [
              txt(evento.run.activity.titulo),
              evento.run.estudante.username,
              evento.run.id,
              evento.run.ladoInicial,
              evento.tipo,
              evento.post?.lado ?? "",
              evento.post?.perfil ?? "",
              evento.post?.intensidade ?? "",
              evento.post?.categoria ?? "",
              campo(evento.payload, "dwellMs"),
              txt(campo(evento.payload, "termo")),
              campo(evento.payload, "aba"),
              String(evento.clientTs),
              evento.createdAt.toISOString(),
            ].join(sep),
          )
          .join("\n")}\n`;
      }

      return corpo;
    }, escolaId);

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="instanooria-por-${nivel}.csv"`);
    return corpo;
  }
}

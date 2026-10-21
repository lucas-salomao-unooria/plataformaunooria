import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ModalidadeDeIa } from "../ai/consumo-de-ia";
import type { AuthClaims } from "../auth/oidc.guard";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { diaDaPlataforma, fusoDaPlataforma } from "../comum/fuso";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import {
  DefinirPrecoDeIaSchema,
  PainelDeCustosSchema,
  PeriodoDosCustosSchema,
  PrecoDeIaSchema,
  PrecosDeIaSchema,
} from "./contrato-de-rotas";
import { atualizarCotacoes } from "./cotacao-do-dolar";
import {
  MODELO_DO_AVATAR,
  PERIODO_MAXIMO_EM_DIAS,
  diasEntre,
  nomeDaEscola,
  porRecurso,
  somarDias,
  totaisDe,
  type ComponenteDePreco,
  type LinhaAgregada,
} from "./custos-de-ia";

/** O período padrão do painel: os últimos 30 dias, hoje incluído. */
const DIAS_DO_PERIODO_PADRAO = 30;

/** Uma linha da consulta agregada: os `GROUPING()` dizem a qual recorte ela pertence. */
type LinhaDoBanco = {
  g_dia: number;
  g_recurso: number;
  g_modelo: number;
  g_modalidade: number;
  g_escola: number;
  dia: Date | null;
  recurso: string | null;
  modelo: string | null;
  modalidade: ModalidadeDeIa | null;
  escola_id: string | null;
  usd: number;
  brl: number | null;
  tokens_entrada: number;
  tokens_saida: number;
  chamadas: number;
  falhas: number;
  imagens: number;
  segundos: number;
  minutos: number;
  estimado: boolean;
  sem_preco: boolean;
  sem_cotacao: boolean;
};

type Recorte = "dia" | "recurso" | "modelo" | "modalidade" | "escola" | "total";

/**
 * A qual dos seis `GROUPING SETS` a linha pertence. `GROUPING(col)` é 0 quando
 * a coluna está NO agrupamento — o par (modelo, modalidade) é o único recorte
 * com duas colunas.
 */
export function recorteDa(l: Pick<LinhaDoBanco, "g_dia" | "g_recurso" | "g_modelo" | "g_modalidade" | "g_escola">): Recorte {
  const chave = `${l.g_dia}${l.g_recurso}${l.g_modelo}${l.g_modalidade}${l.g_escola}`;
  switch (chave) {
    case "01111":
      return "dia";
    case "10111":
      return "recurso";
    case "11001":
      return "modelo";
    case "11101":
      return "modalidade";
    case "11110":
      return "escola";
    default:
      return "total";
  }
}

function numeros(l: LinhaDoBanco): LinhaAgregada {
  return {
    usd: l.usd,
    brl: l.brl,
    tokensEntrada: l.tokens_entrada,
    tokensSaida: l.tokens_saida,
    chamadas: l.chamadas,
    falhas: l.falhas,
    imagens: l.imagens,
    segundos: l.segundos,
    minutos: l.minutos,
    estimado: l.estimado,
    semPreco: l.sem_preco,
    semCotacao: l.sem_cotacao,
  };
}

const maisCaroPrimeiro = (a: { usd: number }, b: { usd: number }) => b.usd - a.usd;

/**
 * O PAINEL DE CUSTOS DE IA (ADR-161) — o FinOps da Unooria.
 *
 * `@Roles("admin")` e nada mais, pela razão da quota (ADR-105): é o custo
 * variável da fornecedora. Mostrar à rede quanto a IA dela custa à Unooria é
 * entregar a margem do contrato ao cliente.
 *
 * **O custo é DERIVADO aqui, nunca gravado**: consumo (`ia_consumo_diario`,
 * mais os minutos do avatar em `ajuda_sessoes`) × o preço vigente NAQUELE DIA
 * (`ia_precos`) × a PTAX do dia (`cotacoes_dolar`). Corrigir um preço com
 * vigência no passado corrige o painel para trás — é o ponto de não gravar.
 *
 * Mora no módulo `recursos` pelo mesmo motivo da quota: mesma guarda, mesmo
 * prefixo do BFF do hub. Quem MEDE é `src/ai` (`RegistroDeConsumo`).
 */
@Controller("recursos/custos-de-ia")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class CustosDeIaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Contrato({
    resumo: "O custo de IA da rede num período, por dia, produto, modelo, modalidade e escola.",
    descricao:
      "Soma o que cada chamada de IA pagou (tokens de entrada e de saída, imagens, segundos de voz, minutos de avatar) e converte com o preço vigente em cada dia e a PTAX de venda do Banco Central do mesmo dia (dia sem PTAX usa a do último dia útil). Antes de somar, tenta trazer do BCB as cotações que faltam — sem o BCB, converte com o que já tem e diz que falhou.",
    query: PeriodoDosCustosSchema,
    resposta: PainelDeCustosSchema,
    notas: [
      "Só `admin` (ADR-161): é o custo da fornecedora, não informação do cliente.",
      "Período padrão: os últimos 30 dias, hoje incluído, no fuso da plataforma. Teto de 366 dias.",
      "Modelo sem preço vigente entra com custo ZERO e sai em `modelosSemPreco` — a conta está incompleta, e a tela diz isso.",
      "A voz (Cloud Text-to-Speech) não devolve contagem de tokens: sai ESTIMADA pelo tamanho do roteiro e do MP3 (`estimado`).",
      "Sem `usuario_id` em lugar nenhum: o painel responde EM QUÊ se gastou, nunca QUEM gastou.",
    ],
  })
  async painel(@Query() query: unknown) {
    const p = PeriodoDosCustosSchema.parse(query ?? {});
    const ate = p.ate ?? diaDaPlataforma(new Date());
    const de = p.de ?? somarDias(ate, -(DIAS_DO_PERIODO_PADRAO - 1));
    if (de > ate) throw new BadRequestException("O início do período vem depois do fim.");
    if (diasEntre(de, ate) + 1 > PERIODO_MAXIMO_EM_DIAS) {
      throw new BadRequestException(`O período passa de ${PERIODO_MAXIMO_EM_DIAS} dias. Escolha um intervalo menor.`);
    }

    const cotacao = await atualizarCotacoes(this.prisma, de, ate);
    const linhas = await this.consultar(de, ate);
    const doRecorte = (r: Recorte) => linhas.filter((l) => recorteDa(l) === r);

    const porModelo = doRecorte("modelo")
      .map((l) => ({ ...numeros(l), modelo: l.modelo!, modalidade: l.modalidade! }))
      .sort(maisCaroPrimeiro);

    const escolas = doRecorte("escola");
    const ids = escolas.map((l) => l.escola_id!).filter((id) => id !== "");
    const nomes = new Map(
      (ids.length > 0
        ? await this.prisma.escola.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
        : []
      ).map((e) => [e.id, e.nome]),
    );
    const [total] = doRecorte("total");

    return {
      periodo: { de, ate },
      cotacao: { ...cotacao, fonte: "Banco Central do Brasil — PTAX de venda" as const },
      totais: totaisDe(total ? numeros(total) : undefined),
      porDia: doRecorte("dia")
        .map((l) => ({ ...numeros(l), dia: l.dia!.toISOString().slice(0, 10) }))
        .sort((a, b) => a.dia.localeCompare(b.dia)),
      porRecurso: porRecurso(doRecorte("recurso").map((l) => ({ ...numeros(l), recurso: l.recurso! }))),
      porModelo,
      porModalidade: doRecorte("modalidade")
        .map((l) => ({ ...numeros(l), modalidade: l.modalidade! }))
        .sort(maisCaroPrimeiro),
      porEscola: escolas
        .map((l) => ({ ...numeros(l), escolaId: l.escola_id!, nome: nomeDaEscola(l.escola_id!, nomes) }))
        .sort(maisCaroPrimeiro),
      modelosSemPreco: porModelo.filter((m) => m.semPreco).map((m) => m.modelo),
    };
  }

  /**
   * UMA consulta, seis recortes (`GROUPING SETS`), para os números baterem
   * entre si: o total do topo, a soma dos dias e a soma dos produtos saem da
   * mesma leitura, sem chance de uma linha entrar num recorte e não no outro.
   *
   * O preço é o de maior `vigente_desde` <= o dia, e casa o modelo EXATO ou a
   * família (`gemini-3.7-flash` vale para `gemini-3.7-flash-001`, que é como o
   * Agent Engine pode nomear o modelo); o mais específico ganha.
   */
  private async consultar(de: string, ate: string): Promise<LinhaDoBanco[]> {
    const fuso = fusoDaPlataforma();
    const preco = (componente: ComponenteDePreco) => Prisma.sql`(
      SELECT p.usd FROM ia_precos p
       WHERE p.componente = ${componente}
         AND (c.modelo = p.modelo OR starts_with(c.modelo, p.modelo || '-'))
         AND p.vigente_desde <= c.dia
       ORDER BY length(p.modelo) DESC, p.vigente_desde DESC
       LIMIT 1)`;

    return this.prisma.$queryRaw<LinhaDoBanco[]>`
      WITH consumo AS (
        SELECT dia, escola_id, recurso, modelo, modalidade,
               chamadas, falhas, tokens_entrada, tokens_saida, imagens, segundos,
               0::float8 AS minutos, estimado
          FROM ia_consumo_diario
         WHERE dia BETWEEN ${de}::date AND ${ate}::date
        UNION ALL
        -- O AVATAR em vídeo (LiveAvatar) cobra MINUTO, e o medidor dele já
        -- existe: ajuda_sessoes (ADR-132). Sessão sem fim conta o teto inteiro
        -- (a regra dos minutos da Ajuda: falha para o lado do custo); sessão
        -- que o vendor nunca abriu (sem avatar_sessao_id) não custa.
        SELECT (s.inicio AT TIME ZONE ${fuso})::date, coalesce(s.escola_id, ''), 'ajuda', ${MODELO_DO_AVATAR}, 'video',
               1, 0, 0::bigint, 0::bigint, 0, 0::bigint,
               (LEAST(s.duracao_max_s::float8,
                      greatest(0, extract(epoch FROM coalesce(s.fim, s.inicio + make_interval(secs => s.duracao_max_s)) - s.inicio)::float8))
                / 60.0)::float8,
               false
          FROM ajuda_sessoes s
         WHERE s.atendente = 'avatar' AND s.avatar_sessao_id IS NOT NULL
           AND (s.inicio AT TIME ZONE ${fuso})::date BETWEEN ${de}::date AND ${ate}::date
      ),
      custeado AS (
        SELECT c.*,
               ((coalesce(pe.usd, 0) * c.tokens_entrada + coalesce(ps.usd, 0) * c.tokens_saida) / 1000000.0
                 + coalesce(pm.usd, 0) * c.minutos::numeric)::float8 AS usd,
               (pe.usd IS NULL AND c.tokens_entrada > 0) OR (ps.usd IS NULL AND c.tokens_saida > 0)
                 OR (pm.usd IS NULL AND c.minutos > 0) AS sem_preco,
               px.venda
          FROM consumo c
          LEFT JOIN LATERAL ${preco("entrada")} pe(usd) ON true
          LEFT JOIN LATERAL ${preco("saida")} ps(usd) ON true
          LEFT JOIN LATERAL ${preco("minuto")} pm(usd) ON true
          LEFT JOIN LATERAL (
            SELECT d.venda FROM cotacoes_dolar d WHERE d.dia <= c.dia ORDER BY d.dia DESC LIMIT 1
          ) px ON true
      )
      SELECT GROUPING(dia)::int AS g_dia, GROUPING(recurso)::int AS g_recurso,
             GROUPING(modelo)::int AS g_modelo, GROUPING(modalidade)::int AS g_modalidade,
             GROUPING(escola_id)::int AS g_escola,
             dia, recurso, modelo, modalidade, escola_id,
             coalesce(sum(usd), 0)::float8 AS usd,
             sum(usd * venda::float8)::float8 AS brl,
             coalesce(sum(tokens_entrada), 0)::float8 AS tokens_entrada,
             coalesce(sum(tokens_saida), 0)::float8 AS tokens_saida,
             coalesce(sum(chamadas), 0)::float8 AS chamadas,
             coalesce(sum(falhas), 0)::float8 AS falhas,
             coalesce(sum(imagens), 0)::float8 AS imagens,
             coalesce(sum(segundos), 0)::float8 AS segundos,
             coalesce(sum(minutos), 0)::float8 AS minutos,
             coalesce(bool_or(estimado), false) AS estimado,
             coalesce(bool_or(sem_preco), false) AS sem_preco,
             coalesce(bool_or(venda IS NULL AND usd > 0), false) AS sem_cotacao
        FROM custeado
       GROUP BY GROUPING SETS ((dia), (recurso), (modelo, modalidade), (modalidade), (escola_id), ())`;
  }

  /** A tabela inteira, a vigência mais nova primeiro dentro de cada componente. */
  private async listarPrecos() {
    const [linhas, emUso] = await Promise.all([
      this.prisma.iaPreco.findMany({ orderBy: [{ modelo: "asc" }, { componente: "asc" }, { vigenteDesde: "desc" }] }),
      this.prisma.$queryRaw<Array<{ modelo: string }>>`
        SELECT modelo FROM ia_consumo_diario
        UNION SELECT ${MODELO_DO_AVATAR}
        ORDER BY modelo`,
    ]);
    return {
      precos: linhas.map((l) =>
        PrecoDeIaSchema.parse({
          id: l.id,
          modelo: l.modelo,
          componente: l.componente,
          usd: Number(l.usd),
          vigenteDesde: l.vigenteDesde.toISOString().slice(0, 10),
          motivo: l.motivo,
          definidoPorNome: l.definidoPorNome,
          definidoEm: l.definidoEm.toISOString(),
        }),
      ),
      modelosEmUso: emUso.map((m) => m.modelo),
    };
  }

  @Get("precos")
  @Contrato({
    resumo: "A tabela de preços de IA, com o histórico de vigências.",
    descricao:
      "Uma linha por (modelo, componente, vigente desde). Vale num dia o preço de maior `vigenteDesde` que não passa dele. A semente da migration é o preço de LISTA da Vertex e da LiveAvatar lido em 13/10/2026 (`definidoPorNome` nulo).",
    resposta: PrecosDeIaSchema,
    notas: ["`usd` é por 1 milhão de tokens em `entrada`/`saida`, e por minuto em `minuto` (o avatar em vídeo)."],
  })
  async precos() {
    return this.listarPrecos();
  }

  @Post("precos")
  @Contrato({
    resumo: "Grava um preço de IA a partir de uma data.",
    descricao:
      "Acrescenta uma vigência. **Nunca apaga a anterior**: a tabela é o próprio histórico. Mesma (modelo, componente, data) substitui o valor daquela vigência — é a correção de um preço digitado errado. Data no passado RECALCULA o painel daquele dia em diante; é assim que um desconto de contrato descoberto depois entra na conta.",
    corpo: DefinirPrecoDeIaSchema,
    resposta: PrecosDeIaSchema,
    notas: [
      "Motivo obrigatório (Zod), como na quota (ADR-105).",
      "Teto de sanidade de US$ 10.000 por unidade: um zero a mais no campo não vira a fatura do mês.",
      "O nome de quem gravou é CONGELADO na linha, como em `recursos_auditoria`.",
    ],
  })
  async definirPreco(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const dados = DefinirPrecoDeIaSchema.parse(body);
    const autor = await this.prisma.user.findUnique({ where: { id: req.auth.usuarioId }, select: { displayName: true } });
    const vigenteDesde = new Date(`${dados.vigenteDesde}T00:00:00Z`);
    const valores = {
      usd: new Prisma.Decimal(dados.usd),
      motivo: dados.motivo,
      definidoPor: req.auth.usuarioId,
      definidoPorNome: autor?.displayName ?? "(conta sem nome)",
      definidoEm: new Date(),
    };
    await this.prisma.iaPreco.upsert({
      where: { modelo_componente_vigenteDesde: { modelo: dados.modelo, componente: dados.componente, vigenteDesde } },
      create: { modelo: dados.modelo, componente: dados.componente, vigenteDesde, ...valores },
      update: valores,
    });
    // O log é do plantão; a tela lê a tabela, que já é o histórico.
    logger.info(
      {
        codigo: "ia-preco-definido",
        modelo: dados.modelo,
        componente: dados.componente,
        usd: dados.usd,
        vigenteDesde: dados.vigenteDesde,
        motivo: dados.motivo,
      },
      "preço de IA definido",
    );
    return this.listarPrecos();
  }
}

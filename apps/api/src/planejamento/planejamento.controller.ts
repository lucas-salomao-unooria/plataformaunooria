import { z } from "zod";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import {
  DisponibilidadeGuard,
  Recurso,
  SemDisponibilidade,
} from "../comum/disponibilidade.guard";
import { Contrato } from "../openapi/contrato";
import { rotuloDaSerie, type Serie } from "../comum/series";
import { componentePorSlug } from "../curriculo/componentes";
import { DIVISOES_DO_ANO, type DivisaoDoAno } from "../curriculo/carga-horaria";
import { paraDataCivil, rotuloDaSemana } from "./calendario";
import { PlanejamentoService } from "./planejamento.service";
import {
  CalendarioDoAnoSchema,
  ConfiguracaoSchema,
  CriarConfiguracaoSchema,
  GerarPeriodoSchema,
  FiltroDePeriodosSchema,
  ListaDeConfiguracoesSchema,
  ListaDePlanosAnuaisSchema,
  ListaDePlanosDePeriodoSchema,
  OkSchema,
  PlanoAnualComConteudoSchema,
  PlanoAnualCriadoSchema,
  PlanoAnualSchema,
  PlanoDePeriodoCriadoSchema,
  PlanoDePeriodoSchema,
  SalvarAulasSchema,
  SalvarConteudoSchema,
  SalvarDistribuicaoSchema,
} from "./contrato-de-rotas";

/**
 * Rotas do PROFESSOR da exp-92-plano-de-ensino.
 *
 * Identidade (professor, escola) SEMPRE do token, nunca do body: o plano é
 * autoral, e um `professorId` que viesse do corpo deixaria qualquer professor
 * escrever no caderno de outro. Posse conferida em toda rota com id.
 */

type Autenticado = { auth: AuthClaims };

const IdParam = z.object({ id: z.string().uuid() });
const OrdemParam = z.object({ id: z.string().uuid(), ordem: z.coerce.number().int().positive() });

@Controller("planejamento")
@UseGuards(OidcGuard, RolesGuard, DisponibilidadeGuard)
@Roles("professor")
/* O interruptor da rede (ADR-87), por CLASSE: rota nova desta ferramenta nasce
   coberta. A exceção é declarada com `@SemDisponibilidade()`, e só vale para
   apagar os próprios dados. */
@Recurso("exp-92-plano-de-ensino")
export class PlanejamentoController {
  constructor(private readonly planejamento: PlanejamentoService) {}

  // ------------------------------------------------------- configurações

  @Get("configuracoes")
  @Contrato({
    resumo: "As regências configuradas por ESTE professor.",
    descricao:
      "Cada uma é um par componente × ano com carga horária e grade de horários. `dimensionamento` traz o total de aulas no ano e a conversão para horas-relógio (hora-aula NÃO é hora-relógio: Parecer CNE/CEB 8/2004), além do aviso `gradeCoerente: false` quando os horários marcados não somam as aulas semanais declaradas.",
    resposta: ListaDeConfiguracoesSchema,
  })
  async configuracoes(@Req() req: Autenticado) {
    const lista = await this.planejamento.listarConfiguracoes(
      req.auth.escolaId,
      req.auth.usuarioId,
    );
    const configuracoes = [];
    for (const c of lista) configuracoes.push(await this.paraResposta(c));
    return { configuracoes };
  }

  @Post("configuracoes")
  @Contrato({
    resumo: "Cria ou atualiza a regência de um componente × ano.",
    descricao:
      "Idempotente na chave (professor, ano letivo, série, componente): reenviar atualiza. Recusa componente que a rede não oferta naquele ano e componente sem habilidade da BNCC — os dois produziriam um plano vazio de que o professor levaria a culpa. `inicioDoAnoLetivo` alimenta `periodos_letivos`, que é catálogo do CONTRATO (a rede inteira compartilha o calendário).",
    corpo: CriarConfiguracaoSchema,
    resposta: ConfiguracaoSchema,
  })
  async criarConfiguracao(@Req() req: Autenticado, @Body() corpo: unknown) {
    const dados = CriarConfiguracaoSchema.parse(corpo);
    const criada = await this.planejamento.criarConfiguracao(
      req.auth.escolaId,
      req.auth.usuarioId,
      dados,
    );
    return this.paraResposta(criada);
  }

  @Get("configuracoes/:id/calendario")
  @Contrato({
    resumo: "Os períodos de avaliação e as semanas de planejamento do ano.",
    descricao:
      "As 40 semanas que o professor vai planejar, cada uma com quantas aulas ela tem de fato (da grade real) e o plano já gerado, se houver. O passo é sempre semanal (ADR-76): entregar de duas em duas semanas, ou o período inteiro, é recorte de EXPORTAÇÃO e não de planejamento. Como os períodos são divididos em semanas fechadas, nenhuma semana atravessa a virada do bimestre.",
    params: IdParam,
    resposta: CalendarioDoAnoSchema,
  })
  calendario(@Req() req: Autenticado, @Param("id") id: string) {
    return this.planejamento.calendario(req.auth.escolaId, req.auth.usuarioId, IdParam.parse({ id }).id);
  }

  /* Fora do interruptor: apagar a própria regência. Um produto desligado fecha tudo, menos
     isto — interruptor que prende dado é indefensável (ADR-87). */
  @SemDisponibilidade()
  @Delete("configuracoes/:id")
  @Contrato({
    resumo: "Apaga o planejamento inteiro daquele componente × ano.",
    descricao:
      "A regência, o plano anual dela e todas as semanas planejadas. O banco faz a cascata; o object storage não tem cascata, então os prefixos de cada plano anual são varridos ANTES do delete — depois dele não haveria mais como saber quais eram. Irreversível, e é a tela que confirma.",
    params: IdParam,
    resposta: OkSchema,
  })
  apagarConfiguracao(@Req() req: Autenticado, @Param("id") id: string) {
    return this.planejamento.apagarConfiguracao(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
    );
  }

  // --------------------------------------------------------- plano anual

  @Get("planos-anuais")
  @Contrato({
    resumo: "Os planos anuais DESTE professor.",
    resposta: ListaDePlanosAnuaisSchema,
  })
  async planosAnuais(@Req() req: Autenticado) {
    const planos = await this.planejamento.listarPlanosAnuais(
      req.auth.escolaId,
      req.auth.usuarioId,
    );
    return { planos: planos.map(planoAnualParaResposta) };
  }

  @Post("configuracoes/:id/plano-anual")
  @Contrato({
    resumo: "Cria o plano anual de uma regência.",
    descricao:
      "Nasce com a distribuição VAZIA: escolher que habilidade cai em que período é decisão pedagógica do professor, não do gerador. A geração só é liberada depois de `PUT /planos-anuais/:id/distribuicao`.",
    params: IdParam,
    resposta: PlanoAnualSchema,
  })
  async criarPlanoAnual(@Req() req: Autenticado, @Param("id") id: string) {
    const plano = await this.planejamento.criarPlanoAnual(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
    );
    return planoAnualParaResposta(plano);
  }

  @Put("planos-anuais/:id/distribuicao")
  @Contrato({
    resumo: "Salva a distribuição de habilidades pelos períodos.",
    descricao:
      "É a decisão pedagógica central do produto, e o insumo do gerador. Recusa código que não pertence ao recorte (componente × ano): um `EF67LP42` colado à mão chegaria ao prompt e sairia no documento como se fosse currículo, e o professor levaria à coordenação um plano citando habilidade inexistente.",
    params: IdParam,
    corpo: SalvarDistribuicaoSchema,
    resposta: PlanoAnualSchema,
  })
  async salvarDistribuicao(
    @Req() req: Autenticado,
    @Param("id") id: string,
    @Body() corpo: unknown,
  ) {
    const { distribuicao, distribuicaoComputacao } = SalvarDistribuicaoSchema.parse(corpo);
    const plano = await this.planejamento.salvarDistribuicao(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
      distribuicao as Record<string, string[]>,
      distribuicaoComputacao as Record<string, string[]>,
    );
    return planoAnualParaResposta(plano);
  }

  /** 202: a geração corre em background; acompanhar por GET /planos-anuais/:id. */
  @Post("planos-anuais/:id/gerar")
  @HttpCode(202)
  @Contrato({
    resumo: "Dispara a geração do plano anual.",
    descricao:
      "202 porque um plano anual leva minutos. O claim é atômico (`updateMany` condicionado ao status), então duas instâncias não geram o mesmo plano. Quota de IA conferida ANTES (regra 5 do AGENTS.md) e consumida depois — inclusive quando o resultado é rejeitado, porque o token foi gasto.",
    params: IdParam,
    resposta: PlanoAnualCriadoSchema,
  })
  gerarPlanoAnual(@Req() req: Autenticado, @Param("id") id: string) {
    return this.planejamento.gerarPlanoAnual(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
      req.auth.perfil,
    );
  }

  @Get("planos-anuais/:id")
  @Contrato({
    resumo: "O plano anual com o conteúdo.",
    descricao:
      "`html` é `null` enquanto o status não for `pronto` — é assim que a tela sabe que deve continuar o polling. Vem com a configuração e os períodos de avaliação, para a tela não precisar de três chamadas.",
    params: IdParam,
    resposta: PlanoAnualComConteudoSchema,
  })
  async planoAnual(@Req() req: Autenticado, @Param("id") id: string) {
    const { plano, html } = await this.planejamento.obterPlanoAnual(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
    );
    const calendario = await this.planejamento.calendario(
      req.auth.escolaId,
      req.auth.usuarioId,
      plano.configuracaoId,
    );
    return {
      plano: planoAnualParaResposta(plano),
      configuracao: await this.paraResposta(plano.configuracao),
      periodos: calendario.periodos,
      html,
    };
  }

  @Put("planos-anuais/:id/conteudo")
  @Contrato({
    resumo: "Salva o plano anual editado pelo professor.",
    descricao:
      "O HTML passa por allowlist antes de ir ao storage: ele volta ao navegador de outro usuário (o próprio professor depois, ou quem herdar a turma), então é XSS armazenado se passar cru. O Markdown original fica intocado em `gerado.md`.",
    params: IdParam,
    corpo: SalvarConteudoSchema,
    resposta: OkSchema,
  })
  async salvarConteudo(@Req() req: Autenticado, @Param("id") id: string, @Body() corpo: unknown) {
    const { html } = SalvarConteudoSchema.parse(corpo);
    await this.planejamento.salvarConteudoDoPlanoAnual(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
      html,
    );
    return { ok: true as const };
  }

  /* Fora do interruptor: apagar o próprio plano anual. Um produto desligado fecha tudo, menos
     isto — interruptor que prende dado é indefensável (ADR-87). */
  @SemDisponibilidade()
  @Delete("planos-anuais/:id")
  @Contrato({
    resumo: "Apaga o plano anual e os planos de período dele.",
    descricao: "O conteúdo no object storage vai junto (`apagarPrefixo`).",
    params: IdParam,
    resposta: OkSchema,
  })
  apagar(@Req() req: Autenticado, @Param("id") id: string) {
    return this.planejamento.apagarPlanoAnual(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
    );
  }

  // ---------------------------------------------------- plano de período

  /** 202: a geração corre em background; acompanhar por GET /planejamento/periodos/:id. */
  @Post("planos-anuais/:id/periodos/:ordem/gerar")
  @HttpCode(202)
  @Contrato({
    resumo: "Gera o plano aula a aula de uma semana.",
    descricao:
      "O esqueleto das aulas (quantas, em que data, em que horário) NÃO vem do modelo: sai do calendário e da grade real do professor. O modelo preenche o conteúdo pedagógico das aulas que existem — deixá-lo decidir quantas caberiam produzia cinco, o número redondo, para um professor de Arte que tem uma. `feriados` REMOVE a aula em vez de deslocá-la: repor é decisão pedagógica, não conta do sistema. Reenviar REGERA a semana, e o `update` recalcula início, fim e período de avaliação: a `ordem` é a única chave, e o que ela endereça muda se a regência corrigir o início do ano letivo.",
    params: OrdemParam,
    corpo: GerarPeriodoSchema,
    resposta: PlanoDePeriodoCriadoSchema,
  })
  gerarPeriodo(
    @Req() req: Autenticado,
    @Param("id") id: string,
    @Param("ordem") ordem: string,
    @Body() corpo: unknown,
  ) {
    const params = OrdemParam.parse({ id, ordem });
    const { feriados } = GerarPeriodoSchema.parse(corpo ?? {});
    return this.planejamento.gerarPlanoDePeriodo(
      req.auth.escolaId,
      req.auth.usuarioId,
      params.id,
      params.ordem,
      feriados,
      req.auth.perfil,
    );
  }

  @Get("planos-anuais/:id/periodos")
  @Contrato({
    resumo: "As semanas JÁ PLANEJADAS, com as aulas — para exportar várias juntas.",
    descricao:
      "Só as `pronto`, em ordem: é a fonte do documento de mais de uma semana (duas, para a escola que recolhe de quinze em quinze dias, ou o período de avaliação inteiro). Um documento que a coordenação recebe não leva semana que falhou na geração nem semana que ninguém planejou. Com `periodoDeAvaliacao` o filtro é no BANCO — baixar o 1º bimestre não tem por que carregar as aulas dos outros três.",
    params: IdParam,
    query: FiltroDePeriodosSchema,
    resposta: ListaDePlanosDePeriodoSchema,
  })
  async periodos(
    @Req() req: Autenticado,
    @Param("id") id: string,
    @Query() query: unknown,
  ) {
    const { periodoDeAvaliacao } = FiltroDePeriodosSchema.parse(query ?? {});
    const lista = await this.planejamento.listarPlanosDePeriodo(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
      periodoDeAvaliacao,
    );
    return { periodos: lista.map(periodoParaResposta) };
  }

  @Get("periodos/:id")
  @Contrato({
    resumo: "O plano de uma semana, aula a aula.",
    params: IdParam,
    resposta: PlanoDePeriodoSchema,
  })
  async periodo(@Req() req: Autenticado, @Param("id") id: string) {
    const p = await this.planejamento.obterPlanoDePeriodo(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
    );
    return periodoParaResposta(p);
  }

  @Put("periodos/:id/aulas")
  @Contrato({
    resumo: "Salva as aulas editadas — e o registro do que foi cumprido.",
    descricao:
      "As aulas são dado estruturado, não prosa: o professor edita a aula de quinta sem tocar na de terça. `cumprida` e `observacaoDoProfessor` são preenchidos DEPOIS da aula e não vêm da IA — é o registro do que aconteceu, e é ele que faz o plano deixar de ser intenção.",
    params: IdParam,
    corpo: SalvarAulasSchema,
    resposta: PlanoDePeriodoSchema,
  })
  async salvarAulas(@Req() req: Autenticado, @Param("id") id: string, @Body() corpo: unknown) {
    const { aulas } = SalvarAulasSchema.parse(corpo);
    const p = await this.planejamento.salvarAulas(
      req.auth.escolaId,
      req.auth.usuarioId,
      IdParam.parse({ id }).id,
      aulas,
    );
    return periodoParaResposta(p);
  }

  // ------------------------------------------------------------ mapeadores

  private async paraResposta(c: {
    id: string;
    anoLetivo: number;
    serie: string;
    componente: string;
    turmaId: string | null;
    turma?: { nome: string } | null;
    divisaoDoAno: string;
    minutosPorAula: number;
    aulasSemanais: number;
    grade: unknown;
    incluirComputacao: boolean;
    inicioDoAnoLetivo: Date | null;
    criadoEm: Date;
    atualizadoEm: Date;
  }) {
    return {
      id: c.id,
      anoLetivo: c.anoLetivo,
      serie: c.serie,
      serieRotulo: rotuloDaSerie(c.serie as Serie),
      componente: c.componente,
      componenteRotulo: componentePorSlug(c.componente)?.rotulo ?? c.componente,
      turmaId: c.turmaId,
      turmaNome: c.turma?.nome ?? null,
      divisaoDoAno: c.divisaoDoAno as never,
      minutosPorAula: c.minutosPorAula,
      aulasSemanais: c.aulasSemanais,
      grade: (Array.isArray(c.grade) ? c.grade : []) as never,
      incluirComputacao: c.incluirComputacao,
      inicioDoAnoLetivo: await this.planejamento.inicioDoAnoLetivo(c.anoLetivo, c.inicioDoAnoLetivo),
      dimensionamento: this.planejamento.dimensionar(c),
      criadoEm: c.criadoEm.toISOString(),
      atualizadoEm: c.atualizadoEm.toISOString(),
    };
  }
}

function planoAnualParaResposta(p: {
  id: string;
  configuracaoId: string;
  titulo: string;
  status: string;
  erro: string | null;
  tokensUsados: number;
  distribuicao: unknown;
  distribuicaoComputacao: unknown;
  criadoEm: Date;
  atualizadoEm: Date;
}) {
  return {
    id: p.id,
    configuracaoId: p.configuracaoId,
    titulo: p.titulo,
    status: p.status as never,
    erro: p.erro,
    tokensUsados: p.tokensUsados,
    distribuicao: (p.distribuicao ?? {}) as never,
    distribuicaoComputacao: (p.distribuicaoComputacao ?? {}) as never,
    criadoEm: p.criadoEm.toISOString(),
    atualizadoEm: p.atualizadoEm.toISOString(),
  };
}

function periodoParaResposta(p: {
  id: string;
  planoAnualId: string;
  ordem: number;
  inicio: Date;
  fim: Date;
  periodoDeAvaliacao: number;
  status: string;
  erro: string | null;
  tokensUsados: number;
  aulas: unknown;
  criadoEm: Date;
  atualizadoEm: Date;
}) {
  return {
    id: p.id,
    planoAnualId: p.planoAnualId,
    ordem: p.ordem,
    rotulo: rotuloDaSemana(p.ordem),
    inicio: paraDataCivil(p.inicio),
    fim: paraDataCivil(p.fim),
    periodoDeAvaliacao: p.periodoDeAvaliacao,
    status: p.status as never,
    erro: p.erro,
    tokensUsados: p.tokensUsados,
    aulas: (Array.isArray(p.aulas) ? p.aulas : []) as never,
    criadoEm: p.criadoEm.toISOString(),
    atualizadoEm: p.atualizadoEm.toISOString(),
  };
}

/** Reexportado para o `DIVISOES_DO_ANO` não virar import morto no futuro. */
export const DIVISOES_CONHECIDAS = Object.keys(DIVISOES_DO_ANO) as DivisaoDoAno[];

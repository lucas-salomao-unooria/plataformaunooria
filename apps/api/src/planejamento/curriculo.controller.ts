import { z } from "zod";
import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { SERIES, rotuloDaSerie, type Serie } from "../comum/series";
import {
  AREAS,
  componentePorSlug,
  componentesDoAno,
  rotuloDoOrganizador,
  tipoDeOrganizador,
} from "../curriculo/componentes";
import {
  agruparPorOrganizador,
  habilidadesDe,
  habilidadesDeComputacao,
} from "../curriculo/consulta";
import {
  HORAS_MINIMAS_ANUAIS,
  aulasSemanaisDeReferencia,
  cumpreMinimoLegal,
} from "../curriculo/carga-horaria";
import {
  CatalogoDeComponentesSchema,
  HabilidadesDoComponenteSchema,
} from "./contrato-de-rotas";

/**
 * O CATÁLOGO CURRICULAR — leitura pura da BNCC extraída, sem banco.
 *
 * Separado do controller de planejamento de propósito: aqui não há tenancy a
 * respeitar (a BNCC é a mesma em toda escola do país) e não há nada a escrever.
 * Juntar as duas coisas num controller convidaria a esquecer, numa rota nova,
 * de qual lado da fronteira ela está.
 *
 * Exige autenticação mesmo sendo dado público: quem consome é a exp-92 dentro
 * do iframe, com o token do professor, e uma rota aberta aqui seria um endpoint
 * a mais para varrer.
 */

const AnoSchema = z.object({ ano: z.enum(SERIES) });
const ComponenteQuery = z.object({ ano: z.enum(SERIES), componente: z.string() });

const rotuloDaArea = (slug: string, etapa: "EF" | "EM") => {
  const area = AREAS.find((a) => a.slug === slug);
  if (!area) return slug;
  return etapa === "EM" ? (area.rotuloEm ?? area.rotulo) : area.rotulo;
};

const etapaDoAno = (ano: string): "EF" | "EM" => (ano.endsWith("EM") ? "EM" : "EF");

@Controller("planejamento/curriculo")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", "gestor", "admin-contrato")
export class CurriculoController {
  @Get("componentes")
  @Contrato({
    resumo: "Os componentes curriculares que a rede oferta naquele ano.",
    descricao:
      "Com o total de habilidades da BNCC de cada um e as aulas semanais da matriz mediana de referência. `habilidadesPorArea: true` avisa que as habilidades vêm da ÁREA e não do componente — o caso de Biologia, Física e Química no Ensino Médio, que compartilham as habilidades de Ciências da Natureza. A BNCC não define grade horária: `aulasSemanaisDeReferencia` é a mediana observada em nove redes públicas e serve de ponto de partida editável, nunca de obrigação legal.",
    query: AnoSchema,
    resposta: CatalogoDeComponentesSchema,
  })
  componentes(@Query("ano") anoBruto: string) {
    const { ano } = AnoSchema.parse({ ano: anoBruto });
    const etapa = etapaDoAno(ano);

    const componentes = componentesDoAno(ano).map((c) => ({
      slug: c.slug,
      rotulo: c.rotulo,
      area: c.area,
      areaRotulo: rotuloDaArea(c.area, etapa),
      totalDeHabilidades: habilidadesDe(c.slug, ano).length,
      aulasSemanaisDeReferencia: aulasSemanaisDeReferencia(c.slug, ano as Serie),
      habilidadesPorArea: c.habilidadesPorArea ?? false,
      opcional: c.opcional ?? false,
      observacao: c.observacao ?? null,
    }));

    const aulasSemanais = componentes.reduce(
      (t, c) => t + (c.aulasSemanaisDeReferencia ?? 0),
      0,
    );
    const { horas, cumpre } = cumpreMinimoLegal(aulasSemanais, etapa);

    return {
      ano,
      etapa,
      componentes,
      referenciaDaMatriz: {
        aulasSemanais,
        horasRelogio: horas,
        minimoLegal: HORAS_MINIMAS_ANUAIS[etapa],
        cumpreMinimo: cumpre,
      },
    };
  }

  @Get("habilidades")
  @Contrato({
    resumo: "As habilidades da BNCC daquele componente naquele ano, agrupadas.",
    descricao:
      "Agrupadas pelo organizador que a BNCC usa NAQUELE componente — a Base não é uniforme: sete componentes usam unidade temática, Língua Portuguesa usa prática de linguagem, Língua Inglesa usa eixo, e o Ensino Médio agrupa por competência específica da área. `rotuloDoOrganizador` diz como nomear o agrupador na tela. `computacao` traz a camada transversal do ano (Res. CNE/CEB 1/2022) separada, com a explicação e os exemplos oficiais do anexo — a articulação entre uma habilidade de Computação e uma do componente é PROPOSTA pedagógica, não dado normativo: não existe mapeamento oficial.",
    query: ComponenteQuery,
    resposta: HabilidadesDoComponenteSchema,
  })
  habilidades(@Query("ano") anoBruto: string, @Query("componente") componenteBruto: string) {
    const { ano, componente } = ComponenteQuery.parse({
      ano: anoBruto,
      componente: componenteBruto,
    });
    const meta = componentePorSlug(componente);
    if (!meta) throw new BadRequestException(`componente desconhecido: ${componente}`);
    if (!meta.anos.includes(ano)) {
      throw new BadRequestException(
        `${meta.rotulo} não é ofertado no ${rotuloDaSerie(ano as Serie)}`,
      );
    }

    const etapa = etapaDoAno(ano);
    const lista = habilidadesDe(componente, ano);
    const grupos = agruparPorOrganizador(lista, etapa, meta.componenteBncc);

    return {
      ano,
      componente,
      componenteRotulo: meta.rotulo,
      rotuloDoOrganizador: rotuloDoOrganizador(tipoDeOrganizador(meta.componenteBncc, etapa)),
      habilidadesPorArea: meta.habilidadesPorArea ?? false,
      grupos: grupos.map((g) => ({
        organizador: g.organizador,
        habilidades: g.habilidades.map(paraResposta),
      })),
      total: lista.length,
      computacao: habilidadesDeComputacao(ano).map(paraResposta),
    };
  }
}

function paraResposta(h: {
  codigo: string;
  descricao: string;
  objetoDeConhecimento?: string | null;
  unidadeTematica?: string | null;
  eixo?: string | null;
  competenciaEspecifica?: number | null;
  explicacao?: string | null;
  exemplos?: string | null;
}) {
  return {
    codigo: h.codigo,
    descricao: h.descricao,
    objetoDeConhecimento: h.objetoDeConhecimento ?? null,
    organizador: h.eixo ?? h.unidadeTematica ?? null,
    competenciaEspecifica: h.competenciaEspecifica ?? null,
    explicacao: h.explicacao ?? null,
    exemplos: h.exemplos ?? null,
  };
}

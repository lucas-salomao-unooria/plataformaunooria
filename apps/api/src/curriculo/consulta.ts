import { habilidadesEf } from "./dados/habilidades-ef";
import { habilidadesEm } from "./dados/habilidades-em";
import { habilidadesComputacao } from "./dados/habilidades-computacao";
import { componentePorSlug, tipoDeOrganizador } from "./componentes";
import type { HabilidadeBncc } from "./tipos";

/**
 * Consulta ao currículo. Funções puras sobre o dado extraído — nenhuma toca
 * banco, o que as torna testáveis sem fixture e utilizáveis dentro do gerador
 * de plano sem passar por um serviço.
 *
 * POR QUE NÃO HÁ RAG AQUI
 * -----------------------
 * A tentação num produto assim é indexar a BNCC num vetor e recuperar por
 * similaridade. Não precisa, e seria pior: a pergunta que o produto faz é
 * sempre "quais habilidades de <componente> no <ano>", que é uma consulta
 * EXATA por dois campos estruturados. Busca vetorial responderia com
 * aproximação onde existe resposta certa, e um plano anual que "esqueceu" a
 * EF67LP08 porque ela ficou fora do top-k é um plano que descumpre o currículo.
 * O índice abaixo é um Map; a recuperação é determinística e completa.
 */

const TODAS: readonly HabilidadeBncc[] = [
  ...habilidadesEf,
  ...habilidadesEm,
  ...habilidadesComputacao,
];

/** `${componenteBncc}|${ano}` → habilidades. Uma habilidade de faixa de anos
 *  entra em todas as chaves dos anos que ela cobre. */
const INDICE = new Map<string, HabilidadeBncc[]>();
for (const h of TODAS) {
  for (const ano of h.anos) {
    const chave = `${h.componente}|${ano}`;
    const lista = INDICE.get(chave);
    if (lista) lista.push(h);
    else INDICE.set(chave, [h]);
  }
}

const POR_CODIGO = new Map(TODAS.map((h) => [h.codigo, h]));

export function habilidadePorCodigo(codigo: string): HabilidadeBncc | null {
  return POR_CODIGO.get(codigo.toUpperCase().trim()) ?? null;
}

/**
 * As habilidades que o professor daquele componente, naquele ano, tem para
 * garantir. Recebe o slug do componente DA REDE e resolve para a origem certa
 * — que no Ensino Médio é a área, não o componente (Biologia lê Ciências da
 * Natureza).
 */
export function habilidadesDe(componenteSlug: string, ano: string): readonly HabilidadeBncc[] {
  const componente = componentePorSlug(componenteSlug);
  if (!componente) return [];
  return ordenar(INDICE.get(`${componente.componenteBncc}|${ano}`) ?? []);
}

/** Habilidades de Computação daquele ano — a camada transversal. */
export function habilidadesDeComputacao(ano: string): readonly HabilidadeBncc[] {
  return ordenar(INDICE.get(`computacao|${ano}`) ?? []);
}

/** Código sobe na ordem natural, que é a ordem do documento. */
function ordenar(lista: HabilidadeBncc[]): HabilidadeBncc[] {
  return [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
}

export interface GrupoDeHabilidades {
  /** O rótulo do organizador, como veio do documento. */
  readonly organizador: string;
  readonly habilidades: readonly HabilidadeBncc[];
}

/**
 * Agrupa por organizador — e é isso que transforma uma lista plana de 60
 * habilidades numa tela que o professor lê. Em Matemática do 6º ano são cinco
 * unidades temáticas; em Língua Portuguesa, práticas de linguagem; no Ensino
 * Médio, competências específicas da área.
 *
 * O grupo `Sem classificação` existe porque a extração do PDF não alcança 100%:
 * 26 das 1.304 habilidades do EF ficaram sem objeto de conhecimento. Preferimos
 * mostrá-las num grupo honesto a escondê-las — habilidade escondida é currículo
 * não cumprido.
 */
export function agruparPorOrganizador(
  habilidades: readonly HabilidadeBncc[],
  etapa: "EF" | "EM",
  componenteBncc: string,
): readonly GrupoDeHabilidades[] {
  const tipo = tipoDeOrganizador(componenteBncc, etapa);
  const grupos = new Map<string, HabilidadeBncc[]>();

  for (const h of habilidades) {
    const chave =
      tipo === "competencia"
        ? h.competenciaEspecifica
          ? `Competência específica ${h.competenciaEspecifica}`
          : "Sem classificação"
        : (h.eixo ?? h.unidadeTematica ?? "Sem classificação");
    const lista = grupos.get(chave);
    if (lista) lista.push(h);
    else grupos.set(chave, [h]);
  }

  // "Sem classificação" vai para o fim: é resíduo, não categoria.
  return [...grupos.entries()]
    .sort(([a], [b]) => {
      if (a === "Sem classificação") return 1;
      if (b === "Sem classificação") return -1;
      return a.localeCompare(b, "pt-BR");
    })
    .map(([organizador, lista]) => ({ organizador, habilidades: ordenar(lista) }));
}

/** Objetos de conhecimento distintos daquele recorte, na ordem do documento. */
export function objetosDeConhecimento(habilidades: readonly HabilidadeBncc[]): readonly string[] {
  const vistos = new Set<string>();
  for (const h of habilidades) if (h.objetoDeConhecimento) vistos.add(h.objetoDeConhecimento);
  return [...vistos];
}

/** Quantas habilidades existem por componente e ano — alimenta o seletor. */
export function inventario(): ReadonlyArray<{ componente: string; ano: string; total: number }> {
  return [...INDICE.entries()].map(([chave, lista]) => {
    const [componente = "", ano = ""] = chave.split("|");
    return { componente, ano, total: lista.length };
  });
}

export const TOTAL_DE_HABILIDADES = TODAS.length;

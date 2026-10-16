import { aleatorioDe, embaralhar, type Nivel } from "../../evidencias/regras";
import {
  CATEGORIA_DO_NEUTRO_NO_TEMA,
  MARCADOR_DA_TAREFA,
  MARCADOR_DO_ENVIO_LIMITADO,
  ehFofocaOuHumor,
  type TipoDeMensagem,
} from "./vocabulario";

/**
 * O 6c — MANDAR PRA QUEM NÃO VIU (EF08CO07, ADR-167). Regras PURAS, testadas
 * sem banco.
 *
 * "Um colega de outra turma não viu nada e perguntou: 'o que estão discutindo
 * aí?'." O estudante escolhe até 3 posts e uma mensagem. As miniaturas NÃO
 * mostram o lado (decisão de 16/10): quem monta "os dois lados" tem de
 * reconhecê-los. O servidor classifica a seleção pelo lado gravado.
 */

/** O mínimo que o envio precisa saber de um post do acervo. */
export interface PostDoEnvio {
  id: string;
  lado: string;
  categoria: string;
  aprovado: boolean;
  /** O tipo do AUTOR (`pagina_tema`, `fofoca_tema`, `checagem`, `humor`, …). */
  tipoDoAutor: string;
}

export const POSTS_DO_ENVIO = 9;

/**
 * A ATIVIDADE MEDE A CONFIABILIDADE? Só quando os DOIS lados têm um post
 * aprovado de página de fofoca ou de humor. Sem isso, o envio vai no máximo a
 * "em processo" (a casa que a trava muda grava o marcador limitado).
 */
export function medeConfiabilidade(posts: readonly PostDoEnvio[]): boolean {
  return (["A", "B"] as const).every((lado) =>
    posts.some((p) => p.aprovado && p.lado === lado && ehFofocaOuHumor(p.tipoDoAutor)),
  );
}

/**
 * OS 9 POSTS, tirados do acervo inteiro (não do que ele viu): 3 de cada lado e
 * 3 neutros sobre o tema. Em cada lado, EXATAMENTE 1 de página de fofoca ou de
 * humor (quando o lado tem). Atividade sem neutro sobre o tema: 4 ou 5 de cada
 * lado. A ordem é embaralhada e estável por sessão. Sem lado nenhum no
 * acervo, `null`.
 */
export function montarEnvio(posts: readonly PostDoEnvio[], semente: string): string[] | null {
  const aleatorio = aleatorioDe(`envio:${semente}`);
  const aprovados = posts.filter((p) => p.aprovado);
  const neutros = embaralhar(
    aprovados.filter((p) => p.lado === "neutro" && p.categoria === CATEGORIA_DO_NEUTRO_NO_TEMA),
    aleatorio,
  ).slice(0, 3);

  /* Sem neutro sobre o tema: 4 ou 5 de cada lado, o lado dos 5 por sorteio. */
  const [primeiro, segundo] = aleatorio() < 0.5 ? (["A", "B"] as const) : (["B", "A"] as const);
  const porLado: Record<"A" | "B", number> =
    neutros.length > 0 ? { A: 3, B: 3 } : ({ [primeiro]: 5, [segundo]: 4 } as Record<"A" | "B", number>);

  const deTese: PostDoEnvio[] = [];
  for (const lado of ["A", "B"] as const) {
    const doLado = embaralhar(
      aprovados.filter((p) => p.lado === lado),
      aleatorio,
    );
    const fofoca = doLado.filter((p) => ehFofocaOuHumor(p.tipoDoAutor));
    const outros = doLado.filter((p) => !ehFofocaOuHumor(p.tipoDoAutor));
    const escolhidos = [...fofoca.slice(0, 1), ...outros.slice(0, porLado[lado] - Math.min(1, fofoca.length))];
    /* Lado com poucas páginas de tese: completa com o que houver, para fechar a conta. */
    for (const p of doLado) {
      if (escolhidos.length >= porLado[lado]) break;
      if (!escolhidos.includes(p)) escolhidos.push(p);
    }
    deTese.push(...escolhidos);
  }
  if (!deTese.some((p) => p.lado === "A") || !deTese.some((p) => p.lado === "B")) return null;
  return embaralhar([...deTese, ...neutros], aleatorio).map((p) => p.id);
}

/** A linha da régua: o que a SELEÇÃO tem. */
export type LinhaDoEnvio = "dois-lados" | "dois-lados-com-fofoca" | "um-lado" | "so-neutros";

export function linhaDaSelecao(selecao: readonly PostDoEnvio[]): LinhaDoEnvio {
  const temA = selecao.some((p) => p.lado === "A");
  const temB = selecao.some((p) => p.lado === "B");
  if (temA && temB) {
    return selecao.some((p) => ehFofocaOuHumor(p.tipoDoAutor)) ? "dois-lados-com-fofoca" : "dois-lados";
  }
  return temA || temB ? "um-lado" : "so-neutros";
}

/**
 * A RÉGUA 4×4: a seleção nas linhas, a mensagem nas colunas. "Os dois lados" =
 * pelo menos um post de cada lado. O "atingiu" pede as três coisas da
 * habilidade: o quadro completo, a dinâmica da rede (o aviso) e a
 * confiabilidade (nada de fofoca ou humor mandado como informação).
 */
const REGUA: Record<LinhaDoEnvio, Record<TipoDeMensagem, Nivel>> = {
  "dois-lados": { aviso: "atingiu", neutra: "em_processo", encerra: "em_processo", ridiculariza: "nao_atingiu" },
  "dois-lados-com-fofoca": {
    aviso: "em_processo",
    neutra: "em_processo",
    encerra: "em_processo",
    ridiculariza: "nao_atingiu",
  },
  "um-lado": { aviso: "em_processo", neutra: "nao_atingiu", encerra: "nao_atingiu", ridiculariza: "nao_atingiu" },
  "so-neutros": { aviso: "em_processo", neutra: "em_processo", encerra: "nao_atingiu", ridiculariza: "nao_atingiu" },
};

/**
 * O NÍVEL DO ENVIO e o MARCADOR que ele grava.
 *
 * Na atividade que não mede a confiabilidade, só UMA casa muda — "os dois
 * lados, nenhum de fofoca ou humor × Aviso" vai de "atingiu" a "em processo" —
 * e só ela grava o marcador limitado (`envio-sem-confiabilidade`, que o
 * consolidado conta à parte). As outras 15 casas gravam o envio comum.
 */
export function nivelDoEnvio(entrada: {
  linha: LinhaDoEnvio;
  mensagem: TipoDeMensagem;
  medeConfiabilidade: boolean;
}): { nivel: Nivel; marcador: string } {
  const nivel = REGUA[entrada.linha][entrada.mensagem];
  if (!entrada.medeConfiabilidade && entrada.linha === "dois-lados" && entrada.mensagem === "aviso") {
    return { nivel: "em_processo", marcador: MARCADOR_DO_ENVIO_LIMITADO };
  }
  return { nivel, marcador: MARCADOR_DA_TAREFA.envio };
}

export const REGUA_DO_ENVIO = REGUA;

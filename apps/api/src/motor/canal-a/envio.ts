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

/**
 * OS TRÊS CRITÉRIOS do envio — a régua do PO, validada com a pedagogia em
 * 2026-10-21 (ADR-179): (1) os posts cobrem os dois lados; (2) nenhum é de
 * página de fofoca ou de humor; (3) a mensagem é a que avisa que aquilo é só
 * um pedaço. 3 de 3, atingiu; 1 ou 2, em processo; nenhum, não atingiu.
 * A mensagem que ridiculariza o outro lado dá "não atingiu" qualquer que seja
 * a contagem (ADR-180, o PO em 2026-10-22).
 */
export function criteriosDoEnvio(selecao: readonly PostDoEnvio[], mensagem: TipoDeMensagem) {
  return {
    doisLados: selecao.some((p) => p.lado === "A") && selecao.some((p) => p.lado === "B"),
    semFofoca: !selecao.some((p) => ehFofocaOuHumor(p.tipoDoAutor)),
    aviso: mensagem === "aviso",
  };
}

/**
 * O NÍVEL DO ENVIO e o MARCADOR que ele grava.
 *
 * Na atividade que não mede a confiabilidade (sem fofoca ou humor nos dois
 * lados), o critério 2 não tem como falhar: o envio que fecha os três vai a
 * "em processo" e grava o marcador limitado (`envio-sem-confiabilidade`, que o
 * consolidado conta à parte). Os outros gravam o envio comum.
 */
export function nivelDoEnvio(entrada: {
  selecao: readonly PostDoEnvio[];
  mensagem: TipoDeMensagem;
  medeConfiabilidade: boolean;
}): { nivel: Nivel; marcador: string; criterios: number } {
  const c = criteriosDoEnvio(entrada.selecao, entrada.mensagem);
  const criterios = [c.doisLados, c.semFofoca, c.aviso].filter(Boolean).length;
  if (entrada.mensagem === "ridiculariza") {
    return { nivel: "nao_atingiu", marcador: MARCADOR_DA_TAREFA.envio, criterios };
  }
  if (criterios === 3 && !entrada.medeConfiabilidade) {
    return { nivel: "em_processo", marcador: MARCADOR_DO_ENVIO_LIMITADO, criterios };
  }
  const nivel: Nivel = criterios === 3 ? "atingiu" : criterios > 0 ? "em_processo" : "nao_atingiu";
  return { nivel, marcador: MARCADOR_DA_TAREFA.envio, criterios };
}

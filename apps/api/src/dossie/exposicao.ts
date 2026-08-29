/**
 * O QUE O ALGORITMO ESCONDEU — uma conta só, para as duas telas.
 *
 * Havia duas, e elas discordavam. A tela do aluno ("32 posts que nunca chegaram
 * até você") decidia o lado dele CONTANDO os posts servidos; o relatório do
 * professor ("o algoritmo escondeu 30 posts do outro lado dele") decidia pelo
 * `dominioDe()`, que é o score do motor — dwell, sinais, escada de intensidade.
 *
 * Enquanto os dois apontam o mesmo lado, os números batem. Eles divergem
 * exatamente quando o aluno VIRA O JOGO, porque virar o jogo *é* a definição de
 * a atenção ter terminado do lado oposto ao que o feed empurrou. Ou seja: as
 * duas telas se contradiziam justamente sobre os alunos que o professor mais
 * quer discutir, e cada uma nomeava um lado diferente para a mesma criança.
 *
 * A exposição venceu (ADR-42). "O algoritmo escondeu" é uma afirmação sobre o
 * que o feed SERVIU — o algoritmo escolheu o que entregar, não o que o aluno
 * olhou. Medir isso pelo domínio credita ao algoritmo o resultado do
 * comportamento da criança, que é o contrário do que a tela existe para mostrar.
 *
 * `ladoDominante` continua existindo e continua no relatório: ele responde
 * "para onde a atenção dele foi", que é outra pergunta e é a que sustenta o
 * "virou o jogo".
 */

/** O mínimo que este módulo precisa saber de um post. */
export interface PostParaExposicao {
  id: string;
  lado: string;
  aprovado: boolean;
}

export interface Exposicao {
  /**
   * O lado que o feed mais serviu — `null` quando não houve NENHUM post de tese
   * servido. Aí não há lado a nomear, e dizer "A" por desempate seria inventar.
   */
  ladoDele: "A" | "B" | null;
  /** O oposto do acima; `null` pelo mesmo motivo. */
  ladoPerdido: "A" | "B" | null;
  /** Aprovados do lado perdido que existiam no acervo. */
  totalNoAcervo: number;
  /** Desses, quantos chegaram a ser servidos. */
  vistos: number;
  /** E quantos nunca chegaram: `totalNoAcervo - vistos`. */
  perdidos: number;
  /** Os ids dos que nunca chegaram, para quem precisa mostrá-los. */
  idsPerdidos: string[];
}

/**
 * Calcula tudo a partir do que o motor registrou como servido. Só conta post
 * APROVADO: o que o professor tirou do banco nunca teve chance de aparecer para
 * ninguém, e contá-lo como "escondido pelo algoritmo" seria culpar a máquina
 * por uma decisão editorial.
 */
export function calcularExposicao(
  servedPostIds: readonly string[],
  posts: readonly PostParaExposicao[],
): Exposicao {
  const servidos = new Set(servedPostIds);
  const deTese = posts.filter(
    (post) => post.aprovado && (post.lado === "A" || post.lado === "B"),
  );

  const consumo = { A: 0, B: 0 };
  for (const post of deTese) {
    if (servidos.has(post.id)) consumo[post.lado as "A" | "B"] += 1;
  }

  if (consumo.A === 0 && consumo.B === 0) {
    return {
      ladoDele: null,
      ladoPerdido: null,
      totalNoAcervo: 0,
      vistos: 0,
      perdidos: 0,
      idsPerdidos: [],
    };
  }

  const ladoDele: "A" | "B" = consumo.A >= consumo.B ? "A" : "B";
  const ladoPerdido: "A" | "B" = ladoDele === "A" ? "B" : "A";

  const doLadoPerdido = deTese.filter((post) => post.lado === ladoPerdido);
  const naoServidos = doLadoPerdido.filter((post) => !servidos.has(post.id));

  return {
    ladoDele,
    ladoPerdido,
    totalNoAcervo: doLadoPerdido.length,
    vistos: doLadoPerdido.length - naoServidos.length,
    perdidos: naoServidos.length,
    idsPerdidos: naoServidos.map((post) => post.id),
  };
}

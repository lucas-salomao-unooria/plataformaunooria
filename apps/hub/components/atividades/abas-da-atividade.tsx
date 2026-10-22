import type { ReactNode } from "react";

import { AbasDaPagina, type AbaDaPagina } from "@/components/abas-da-pagina";

/**
 * O TEMPLATE da página de uma atividade (ADR-182): o que vem DEPOIS do estado
 * da atividade ("pronta", "em preparo", o "Usar esta atividade agora") mora em
 * cinco abas, sempre com o mesmo nome e na mesma ordem, em toda missão.
 *
 * A página empilhava tudo na ordem da aula — equipes, as 40 a 160 imagens, os
 * estandes, o painel ao vivo, o zerar, o podcast e as habilidades — e o painel
 * da aula, a única coisa que o professor usa NA FRENTE da turma, chegava depois
 * de 5 a 11 mil pixels de grade de imagens já aprovadas. Agora:
 *
 * - **Aula ao vivo** — o painel com o botão da etapa e a folha, e o zerar. Só
 *   existe com a atividade EM ANDAMENTO, e é a aba que abre;
 * - **Conteúdo** — o que a turma vê (pacote, estandes, posts, notícias) e as
 *   imagens. É a que abre EM PREPARO: aprovar as imagens é o passo que falta;
 * - **Equipes** — quem divide computador. A que abre quando a atividade está
 *   PRONTA e ainda não foi ao ar;
 * - **Podcast** — o episódio de recapitulação, para depois da aula;
 * - **Habilidades** — o painel da evidência (E14), invisível sem ficha.
 *
 * Aba sem conteúdo (`null`) não aparece. A missão nova passa os seus blocos
 * aqui e ganha a mesma página das outras, com o mesmo caminho para o mesmo
 * botão. As abas ficam todas MONTADAS (`components/abas-da-pagina.tsx`): o
 * painel da aula segue consultando a api, e chamando `router.refresh()` quando a
 * evidência muda, com a aba de habilidades aberta.
 */
export type EstadoDaAtividade = "em-andamento" | "pronta" | "em-preparo";

export function AbasDaAtividade({
  estado,
  aula,
  conteudo,
  equipes,
  podcast,
  habilidades,
}: {
  estado: EstadoDaAtividade;
  /** O painel da aula e o zerar — só com a atividade em andamento. */
  aula?: ReactNode;
  conteudo?: ReactNode;
  equipes?: ReactNode;
  podcast?: ReactNode;
  habilidades?: ReactNode;
}) {
  const abas: AbaDaPagina[] = [
    { id: "aula", rotulo: "Aula ao vivo", icone: "cast_for_education", selo: aula ? "no ar" : undefined, conteudo: aula },
    {
      id: "conteudo",
      rotulo: "Conteúdo",
      icone: "photo_library",
      selo: estado === "em-preparo" ? "a aprovar" : undefined,
      conteudo,
    },
    { id: "equipes", rotulo: "Equipes", icone: "groups", conteudo: equipes },
    { id: "podcast", rotulo: "Podcast", icone: "podcasts", conteudo: podcast },
    { id: "habilidades", rotulo: "Habilidades", icone: "school", conteudo: habilidades },
  ];
  const inicial = estado === "em-andamento" && aula ? "aula" : estado === "em-preparo" ? "conteudo" : "equipes";

  return <AbasDaPagina abas={abas} inicial={inicial} rotulo="A atividade" prefixo="atividade" />;
}

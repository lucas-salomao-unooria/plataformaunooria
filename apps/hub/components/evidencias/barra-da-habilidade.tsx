"use client";

import { StackedProgressBar } from "@edu/ui/ds";
import { segmentosDaBarra, type Distribuicao } from "@/lib/painel-de-habilidades";

/**
 * A BARRA DE UMA HABILIDADE (F14.7): quantas crianças atingiram, estão em
 * processo, não atingiram e não foram avaliadas — o "card de pontuação" do
 * painel de habilidades.
 *
 * É o `StackedProgressBar` do DS, que já desenha o título, o total e a legenda
 * com "contagem (porcentagem)": a mesma barra serve ao professor, que quer
 * saber QUANTOS, e à coordenação, que compara turmas de tamanhos diferentes.
 * `subtitle` vai sempre preenchido — vazio, o DS mostra o texto de exemplo dele
 * ("Distribuição de solicitações por status").
 *
 * O total vai SÓ com o número: a linha do título do DS não quebra, e "40
 * estudantes" ao lado do código vazava do cartão nas colunas estreitas. Quantos
 * estudantes a turma tem, a tela diz no cabeçalho.
 */
export function BarraDaHabilidade({
  titulo,
  subtitulo,
  distribuicao,
}: {
  titulo: string;
  subtitulo: string;
  distribuicao: Distribuicao;
}) {
  return (
    <StackedProgressBar
      title={titulo}
      subtitle={subtitulo}
      segments={segmentosDaBarra(distribuicao)}
      totalValue={distribuicao.total}
    />
  );
}

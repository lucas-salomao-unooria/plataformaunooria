/**
 * A linha de orientação sob o reprodutor.
 *
 * É a única voz que acompanha o estudante durante o feed, e por isso ela é uma
 * FUNÇÃO PURA e não texto espalhado pelos componentes: o que a criança lê em
 * cada momento da missão é decisão de design, e decisão de design que mora em
 * quatro `&&` dentro do JSX não tem como ser revisada nem testada.
 *
 * A dica fala só do que já aconteceu. Nenhuma variante comenta a ESCOLHA — nem
 * elogia, nem corrige, nem insinua que um vídeo era melhor que outro. A
 * comparação entre popularidade e credibilidade acontece depois da conclusão,
 * no ranking, e antecipá-la aqui destruiria a medida.
 */

export interface EstadoDaDica {
  /** O vídeo em foco ainda está sendo preparado. */
  carregando: boolean;
  /** Quantos favoritos o estudante já salvou. */
  salvos: number;
  /** O teto de favoritos (o servidor manda; hoje, 3). */
  limite: number;
}

export function dicaDoFeed({ carregando, salvos, limite }: EstadoDaDica): string {
  if (carregando) return "Aguarde um instante: o Short está sendo preparado.";
  if (salvos >= limite) {
    return `Pronto! Seus ${limite} favoritos estão escolhidos. Toque em Concluir missão.`;
  }
  if (salvos > 0) return `Vídeo salvo! Você já escolheu ${salvos} de ${limite} favoritos.`;
  return "Use Anterior e Próximo para ver todos os Shorts.";
}

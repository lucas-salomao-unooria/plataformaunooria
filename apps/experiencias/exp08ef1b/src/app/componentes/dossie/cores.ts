/**
 * As cores das três séries do relatório, por FUNDO — e não por gosto: as do
 * escuro (#7FA5E2 / #F97607) reprovam sobre branco, e um gráfico que ninguém
 * enxerga não é um gráfico.
 *
 * Vive num módulo SEM CSS de propósito. `graficos.tsx` importa o `unooria.css`
 * do Design System, e é carregado por `React.lazy` justamente para esse CSS não
 * acompanhar o feed; se as cores morassem lá, o `exportar.ts` — que é importado
 * direto pelo relatório — arrastaria a folha inteira junto.
 *
 * As duas versões ficam lado a lado porque o PNG de compartilhar continua sendo
 * uma peça de fundo escuro: sem isto ele duplicaria os hexadecimais, e os dois
 * divergiriam na primeira revisão de paleta.
 */
export const CORES_DE_SERIE = {
  claro: { A: '#3F6FB5', B: '#C25600', neutro: '#7E8D91' },
  escuro: { A: '#7FA5E2', B: '#F97607', neutro: '#CBD4D6' },
} as const;

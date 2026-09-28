/**
 * A copy da EXPLICAÇÃO (E5) — os três cards conceituais e a DM de fechamento
 * da Amara.
 *
 * Mora num arquivo à parte, importado SÓ por `app/clone/explicar.tsx`, que
 * entra por `React.lazy` quando a professora libera a conclusão. O card 2 é a
 * lente de cada veículo escrita por extenso ("a Folha Oficial focou nas
 * autoridades, a Voz Coletiva nos moradores e a Métrica Urbana nos números") —
 * no chunk principal, ele estaria legível no DevTools durante o garimpo, e a
 * missão inteira depende de a criança NÃO saber disso ao salvar.
 *
 * **Um desvio do sheet, de propósito:** o card 2 e a DM de fechamento diziam
 * "a mesma praça", o tema do banco curado. Com um tema gerado por IA no
 * preparo a frase ficava errada, então virou "o mesmo acontecimento", que vale
 * para qualquer cobertura.
 *
 * Fonte: o sheet congelado (`design/06-copy-strings-revisada.md`).
 */
export const E5 = {
  /** `e5.narrativa.c1_*`, `c2_*`, `c3_*` */
  cards: [
    {
      titulo: "A ilusão da neutralidade",
      corpo:
        "Quando você escolheu 3 posts para contar o que aconteceu, pareceu uma decisão simples e justa. Mas toda escolha de notícia deixa outras de fora. Não existe publicação neutra: decidir o que mostrar já é tomar um lado sobre o que é mais importante.",
    },
    {
      titulo: "A anatomia das três lentes",
      corpo:
        "Cada veículo cobriu o mesmo acontecimento com uma lente própria: a Folha Oficial focou nas autoridades, a Voz Coletiva nos moradores e a Métrica Urbana nos números. Nenhum deles mentiu, mas nenhum contou o acontecimento por inteiro.",
    },
    {
      titulo: "Quem fala define a história",
      corpo:
        "Em A Reportagem Que Não Saiu, o jornal encerrou o caso ouvindo apenas o secretário da prefeitura. Ao montar seus Stories, você sentiu na prática o poder do editor: as vozes que você escolheu ouvir construíram a realidade que a escola enxergou.",
    },
  ],
  /** `e5.feedback.trava_tempo` */
  travaTempo: (segundos: number) => `Continue lendo para liberar o avanço (${segundos}s)`,
  /** `e5.ui.btn_proximo_card` */
  proximo: "Próximo",
  /** `e5.narrativa.dm_fechamento` */
  dmFechamento:
    "Vi os Stories que a turma postou! Ficou evidente que cada seleção criou uma versão completamente diferente do mesmo acontecimento. Agora que você percebeu como o recorte de fontes constrói a notícia, quero ver como você avalia esse mesmo desafio fora da nossa escola.",
  /** `e5.ui.btn_ir_reflexao` */
  irReflexao: "Ir para a Reflexão",
} as const;

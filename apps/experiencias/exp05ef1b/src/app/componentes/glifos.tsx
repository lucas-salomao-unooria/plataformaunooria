/**
 * (b) COMPENSAÇÃO — os glifos que a seção `whatsappmobile` não publica.
 *
 * O pacote tem 40 ícones, e a missão usa direto os que existem: `forward` (a
 * seta de encaminhar e o selo "Encaminhada"), `lock` (o cadeado do header na
 * espera), `tick` (a fita "Confirmada") e `sbAlert` (o banner fixo do grupo).
 * Faltam três, e cada um sustenta um não-negociável:
 *
 * - **play/pausa**: não há player de áudio na seção, então também não há o
 *   triângulo. Sem ele, um balão de voz sem alvo de toque.
 * - **`Xis`**: não existe `close` nem `x`. Ele é o "sair da seleção" da barra
 *   de seleção E o pictograma da fita "Falsa ou distorcida".
 * - **`MeiaLua`**: o pictograma da fita "Parcialmente verdadeira". As três
 *   fitas precisam se distinguir SEM cor (RNF-A11Y: daltonismo), e três formas
 *   diferentes é o que faz isso — a cor é redundância, não a informação.
 *
 * PEDIDO ao `storybook-unooria`: `play`, `pause` e `close` em
 * `whatsappmobile/Icon`; a meia-lua é de uso desta missão e pode ficar aqui.
 *
 * Os desenhos são geométricos e mínimos de propósito: não são cópia de glifo de
 * marca nenhuma, e a cor sai de `currentColor` para herdar o token de quem os
 * usa, como os do pacote fazem.
 */

type Props = { size?: number; className?: string };

export function Play({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

export function Pausa({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}

export function Xis({ size = 16, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
    </svg>
  );
}

/** Meio preenchida: "parte disso é verdade". Lida sem cor, que é o ponto. */
export function MeiaLua({ size = 16, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17V3.5Z" fill="currentColor" />
    </svg>
  );
}

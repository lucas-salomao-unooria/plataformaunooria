/**
 * (b) COMPENSAÇÃO — os dois glifos que a seção `whatsappmobile` não publica.
 *
 * O pacote tem 44 ícones, e entre eles `forward` (o selo de encaminhada, que a
 * missão usa direto). Faltam dois, e os dois sustentam não-negociáveis:
 *
 * - **alfinete**: é com ele que o Admin fixa a contraprova no topo do chat, e
 *   essa é a cena que fecha a missão (Beat 7). O pacote tem o TONE `pin`, com a
 *   cor certa, mas nenhum glifo com esse nome.
 * - **play/pausa**: não há player de voz na seção, então também não há o
 *   triângulo. Sem ele, um balão de áudio sem alvo de toque.
 *
 * PEDIDO ao `storybook-unooria`: `pin`, `play` e `pause` em
 * `whatsappmobile/Icon`. Quando chegarem, este arquivo some e os três vêm pela
 * ponte — o `AGENTS.md` da experiência tem a lista de compensações abertas.
 *
 * Os desenhos são geométricos e mínimos de propósito: não são cópia de glifo de
 * marca nenhuma, e a cor sai de `currentColor` para herdar o token de quem os
 * usa, como os do pacote fazem.
 */

type Props = { size?: number; className?: string };

export function Alfinete({ size = 16, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.5 2 22 9.5l-2.1 2.1-1-.3-3.6 3.6.4 3.3-1.7 1.7-4-4-4.3 4.3-1.4-1.4 4.3-4.3-4-4L6.3 8.8l3.3.4 3.6-3.6-.3-1L14.5 2Z" />
    </svg>
  );
}

export function Play({ size = 14, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

export function Pausa({ size = 14, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}

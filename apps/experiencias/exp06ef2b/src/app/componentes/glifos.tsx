/**
 * (b) COMPENSAÇÃO — os dois glifos que a seção `whatsappmobile` não publica.
 *
 * O pacote tem 40 ícones, e a missão usa direto os que existem: `forward` (o
 * selo de encaminhada), `filePdf` (o anexo do laudo) e `sbAlert` (o banner de
 * contágio). Faltam dois, e os dois sustentam o balão de voz:
 *
 * - **play/pausa**: não há player de áudio na seção, então também não há o
 *   triângulo. Sem ele, um balão de voz sem alvo de toque.
 *
 * PEDIDO ao `storybook-unooria`: `play` e `pause` em `whatsappmobile/Icon`.
 * Quando chegarem, este arquivo some e os dois vêm pela ponte — o `AGENTS.md`
 * da experiência tem a lista de compensações abertas.
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

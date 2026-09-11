import { PLATAFORMA } from "../../lib/textos";

/**
 * E4-SIS-01 — o congelamento para o debate presencial (Checkpoint A).
 *
 * **Esta tela não fecha, e é por isso que ela não é um `Modal`.** Quem a solta
 * é a professora, pelo painel; um diálogo do design system traz `closeOnEscape`
 * e botão de fechar, que dariam à criança o jeito de sair do congelamento que
 * ele existe para impedir. A compensação está marcada em `globals.css`, com o
 * pedido de `BlockingOverlay`.
 *
 * O bloqueio real é o `inert` que `ManifestoApp` põe no conteúdo de baixo:
 * `pointer-events: none` pararia o clique e deixaria o Tab passar — 30 botões
 * focáveis atrás de um véu é a mesma classe de defeito que o `Collapse` da
 * exp-92 produziu.
 *
 * `role="status"` e não `role="alertdialog"`: não é uma pergunta, é um aviso de
 * que a aula mudou de modo. E `aria-live="polite"` porque o leitor de tela deve
 * anunciá-lo sem cortar o que estiver lendo.
 */
export function Pausa() {
  return (
    <div className="pausa" role="status" aria-live="polite">
      <div className="pausa__cartao">
        {/* Pictograma de diálogo, em traço. Dois balões: é a conversa da turma
            que está acontecendo fora da tela. */}
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect
            x="6"
            y="10"
            width="26"
            height="18"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M14 28v6l7-6" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect
            x="20"
            y="20"
            width="22"
            height="15"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.55"
          />
        </svg>
        <p className="pausa__texto">{PLATAFORMA.overlayDePausa}</p>
      </div>
    </div>
  );
}

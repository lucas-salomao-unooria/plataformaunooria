import { Button } from "@edu/ui/ds-chatgpt";
import { CLONE } from "../../lib/textos";

/**
 * E4-ALU-01 e E4-ALU-02 — a rendição da máquina e o documento promulgado.
 * **Seção `chatgpt`.**
 *
 * O bloco de código é COMPENSAÇÃO MARCADA, e é a maior desta missão: a seção
 * `chatgpt` não publica `CodeBlock` (confirmado na 0.1.19). O não-negociável 4
 * exige a moldura nativa com o cabeçalho "markdown" e o botão de cópia, porque
 * é ela que faz o documento parecer emitido PELO SISTEMA em vez de escrito pela
 * escola. O pedido está registrado no CSS e no `AGENTS.md` da experiência.
 */
export function Processando() {
  /* O delay de 2000ms é não-negociável 2, e quem o conta é `ManifestoApp`.
     Aqui só existe o indicador — e ele PARA sob `prefers-reduced-motion` em vez
     de sumir: sem nenhum sinal, a tela pareceria travada por dois segundos. */
  return (
    <div className="miolo">
      <p className="processando" role="status" aria-live="polite">
        <span className="processando__anel" aria-hidden="true" />
        {CLONE.latenciaDoSistema}
      </p>
    </div>
  );
}

export function Manifesto({
  markdown,
  copiado,
  onCopiar,
  onAvancar,
}: {
  markdown: string;
  copiado: boolean;
  onCopiar: () => void;
  onAvancar: () => void;
}) {
  return (
    <div className="miolo">
      <div className="decisao">
        <div className="bloco">
          <div className="bloco__barra">
            <span className="bloco__lingua">markdown</span>
            <Button variant="ghost" size="sm" onClick={onCopiar} data-acao="copiar-manifesto">
              {copiado ? CLONE.copiado : CLONE.copiarTexto}
            </Button>
          </div>
          {/*
            `tabIndex={0}` no `<pre>`: o documento é longo e rola, e uma região
            rolável que o teclado não alcança prende quem navega por Tab. É o
            mesmo motivo pelo qual a região tem `role`/`aria-label`.
          */}
          <pre
            className="bloco__texto"
            tabIndex={0}
            role="region"
            aria-label="Manifesto de Direitos Digitais dos Estudantes"
            data-manifesto="promulgado"
          >
            {markdown}
          </pre>
        </div>

        <div className="decisao__rodape">
          <Button variant="primary" onClick={onAvancar} data-acao="avancar-percurso">
            {CLONE.avancarParaPercurso}
          </Button>
        </div>
      </div>
    </div>
  );
}

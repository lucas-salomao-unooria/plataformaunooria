import { numeroBr } from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { PontoDaSerie } from "../lib/tipos";

/**
 * A planilha consolidada da subprefeitura (E2-ALU-01), como IMAGEM desenhada:
 * é o anexo que o bot manda no chat, não uma tabela de dados da interface —
 * por isso mora dentro do `MessageBubble.Media` (que dá o `alt` e o toque) e
 * abre no `MediaViewer` para ampliar (a "Visualização Ampliada", [D0-1]). Não
 * importa ponte; a cor é `--grafico-*` (`globals.css`), como no gráfico.
 */
export function TabelaDoBoletim({ serie, ampliada = false }: { serie: readonly PontoDaSerie[]; ampliada?: boolean }) {
  const L = 300;
  const linha = 30;
  const cabeca = 44;
  const A = cabeca + linha * (serie.length + 1) + 8;
  const meio = 132;
  return (
    <svg
      className={ampliada ? "tabela tabela--ampliada" : "tabela"}
      viewBox={`0 0 ${L} ${A}`}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width={L} height={A} className="grafico__fundo" />
      <text x="12" y="26" className="tabela__titulo">
        {TEXTOS.assistente.tituloDaTabela}
      </text>
      <rect x="8" y={cabeca - 8} width={L - 16} height={linha} rx="4" className="tabela__cabeca" />
      <text x="20" y={cabeca + 12} className="tabela__th">
        {TEXTOS.assistente.colPeriodo}
      </text>
      <text x={meio + 12} y={cabeca + 12} className="tabela__th">
        {TEXTOS.assistente.colIndicador}
      </text>
      {serie.map((p, i) => {
        const y = cabeca - 8 + linha * (i + 1);
        return (
          <g key={p.periodo}>
            <line x1="8" x2={L - 8} y1={y + linha} y2={y + linha} className="grafico__grade" />
            <text x="20" y={y + 20} className="tabela__td">
              {p.periodo}
            </text>
            <text x={meio + 12} y={y + 20} className="tabela__td tabela__td--valor">
              {numeroBr(p.valor)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** O `alt` da planilha: os quatro períodos com o valor. */
export function descricaoDaTabela(serie: readonly PontoDaSerie[]): string {
  const linhas = serie.map((p) => `${p.periodo}: ${numeroBr(p.valor)}%`).join("; ");
  return `${TEXTOS.assistente.tituloDaTabela}. ${TEXTOS.assistente.colIndicador} por ${TEXTOS.assistente.colPeriodo.toLowerCase()}: ${linhas}.`;
}

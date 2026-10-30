import { alturasDasBarras, numeroBr, rotuloDoEixo, type Barra } from "../lib/regras";

/**
 * O gráfico de barras da missão — UM componente só, usado na prévia da E2, na
 * prévia ao vivo do compositor, no post publicado, no post espelho da escola
 * rival, nos cartões da perícia e na régua do laudo. "Publica exatamente a
 * prévia" vira garantia de código: é o mesmo desenho com os mesmos números.
 *
 * É CONTEÚDO desenhado (a imagem que o post carrega), não controle: por isso
 * mora fora do DS, dentro do `MessageBubble.Media` (clone) ou do `Card`
 * (laudo), que dão o `alt`. Não importa ponte nenhuma, e a cor vem das
 * variáveis `--grafico-*` que cada seção define com os PRÓPRIOS tokens
 * (`globals.css`) — o mesmo desenho fala `--unc-*` no clone e `--unooria-*`
 * no laudo, sem cruzar as famílias.
 *
 * O eixo é o dilema: `origem` e `teto` decidem a altura; as linhas de grade
 * marcam origem, meio e teto com o valor escrito, para a origem 80% aparecer
 * — sem rótulo que dê gabarito.
 */
export function GraficoDoBoletim({
  barras,
  origem,
  teto,
  unidade = "%",
}: {
  barras: readonly Barra[];
  origem: number;
  teto: number;
  unidade?: string;
}) {
  if (import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).get("falha") === "grafico") {
    throw new Error("falha de renderização simulada (só em desenvolvimento)");
  }
  const L = 300;
  const A = 180;
  const esq = 44;
  const topo = 22;
  const base = A - 28;
  const largura = L - esq - 10;
  const altura = base - topo;
  const alturas = alturasDasBarras(
    barras.map((b) => b.valor),
    origem,
    teto,
  );
  const vao = largura / barras.length;
  const barra = Math.min(46, vao * 0.56);
  const grade = [origem, (origem + teto) / 2, teto];
  /* Quantos caracteres do rótulo cabem no vão (11px de fonte, ~6,6 de largura média). */
  const cabe = Math.floor((vao - 4) / 6.6);

  return (
    <svg className="grafico" viewBox={`0 0 ${L} ${A}`} role="presentation" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width={L} height={A} className="grafico__fundo" />
      {grade.map((g) => {
        const y = base - ((g - origem) / (teto - origem)) * altura;
        return (
          <g key={g}>
            <line x1={esq} x2={L - 8} y1={y} y2={y} className="grafico__grade" />
            <text x={esq - 6} y={y + 4} textAnchor="end" className="grafico__eixo">
              {numeroBr(g)}
              {unidade}
            </text>
          </g>
        );
      })}
      {barras.map((b, i) => {
        const h = alturas[i]! * altura;
        const x = esq + vao * i + (vao - barra) / 2;
        /* Perto do teto, o valor cairia sobre a linha de grade: vai para dentro da barra. */
        const dentro = h > altura - 16;
        return (
          <g key={b.rotulo}>
            <rect x={x} y={base - h} width={barra} height={Math.max(h, 0.5)} rx="3" className="grafico__barra" />
            <text
              x={x + barra / 2}
              y={dentro ? base - h + 15 : base - h - 5}
              textAnchor="middle"
              className={dentro ? "grafico__valor grafico__valor--dentro" : "grafico__valor"}
            >
              {numeroBr(b.valor)}
              {unidade}
            </text>
            <text x={x + barra / 2} y={base + 16} textAnchor="middle" className="grafico__rotulo">
              {rotuloDoEixo(b.rotulo, cabe)}
            </text>
          </g>
        );
      })}
      <line x1={esq} x2={esq} y1={topo - 4} y2={base} className="grafico__linha" />
      <line x1={esq} x2={L - 8} y1={base} y2={base} className="grafico__linha" />
    </svg>
  );
}

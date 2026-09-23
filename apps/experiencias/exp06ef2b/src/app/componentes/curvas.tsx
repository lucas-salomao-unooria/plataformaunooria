import type { Curvas } from "../../lib/tipos";

/**
 * O gráfico da Etapa 4: a velocidade do boato contra a da nota oficial.
 *
 * SVG inline e sem biblioteca. Não é economia de dependência: são duas
 * polilinhas de seis pontos, e um pacote de charting traria escalas,
 * tooltips e temas próprios — tokens de fora do design system dentro de uma
 * tela que a missão usa como instrumento.
 *
 * **A assimetria tem de ser geométrica, não legendada.** A curva do boato é
 * traço grosso e sobe exponencial; a do laudo é tracejado fino e quase reta. Se
 * a diferença dependesse de ler os números, a criança de 11 anos que ainda lê
 * gráfico com esforço perderia a descoberta que a tela existe para entregar.
 */

const L = 34;
const R = 10;
const T = 12;
const B = 26;
const LARGURA = 340;
const ALTURA = 220;

export function GraficoDasCurvas({ curvas }: { curvas: Curvas }) {
  const { minutos, boato, laudo } = curvas;
  const maxY = Math.max(...boato, ...laudo, 1);
  const maxX = Math.max(...minutos, 1);

  const x = (m: number) => L + ((LARGURA - L - R) * m) / maxX;
  const y = (v: number) => ALTURA - B - ((ALTURA - T - B) * v) / maxY;

  const pontos = (serie: number[]) =>
    serie.map((v, i) => `${x(minutos[i] ?? 0)},${y(v)}`).join(" ");

  return (
    <svg
      className="telemetria__grafico"
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={
        `Em ${maxX} minutos, o aviso não confirmado chegou a ${boato.at(-1)} conexões ` +
        `e a nota oficial a ${laudo.at(-1)}.`
      }
    >
      {/* Eixos discretos: eles recuam para o traçado saltar. */}
      <line className="eixo" x1={L} y1={T} x2={L} y2={ALTURA - B} />
      <line className="eixo" x1={L} y1={ALTURA - B} x2={LARGURA - R} y2={ALTURA - B} />

      <polyline className="curva--laudo" points={pontos(laudo)} />
      <polyline className="curva--boato" points={pontos(boato)} />

      {minutos.map((m) => (
        <text
          key={m}
          x={x(m)}
          y={ALTURA - 8}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          opacity="0.55"
        >
          {m}
        </text>
      ))}
      <text x={4} y={T + 8} fontSize="10" fill="currentColor" opacity="0.55">
        {maxY}
      </text>
      <text x={LARGURA / 2} y={ALTURA - 8} fontSize="10" fill="currentColor" opacity="0" >
        minutos
      </text>
    </svg>
  );
}

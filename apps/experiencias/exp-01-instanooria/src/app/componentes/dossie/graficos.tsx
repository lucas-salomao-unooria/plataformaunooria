/**
 * Gráficos do dossiê com o Design System da plataforma.
 *
 * Este módulo é carregado por `React.lazy` a partir do dossiê — assim o CSS
 * do DS entra num chunk próprio e NÃO acompanha o feed do aluno (o disfarce
 * continua intacto até a revelação).
 */
import '@unooria/design-system/unooria.css';

import { DonutChart } from '@edu/ui/ds';

export interface SerieBloco {
  bloco: number;
  A: number;
  B: number;
  neutro: number;
  intensidadeMediaDominante: number;
}

const COR_A = '#7FA5E2';
const COR_B = '#F97607';
const COR_NEUTRO = '#CBD4D6';

/** Seção 1: donut da proporção final do feed. */
export function DonutProporcao({
  proporcao,
  rotuloA,
  rotuloB,
}: {
  proporcao: { A: number; B: number; neutro: number };
  rotuloA: string;
  rotuloB: string;
}) {
  return (
    <DonutChart
      theme="dark"
      title="Seu mundo no fim da sessão"
      subtitle="% dos posts que chegaram até você"
      size={200}
      data={[
        { label: rotuloA, value: Math.round(proporcao.A * 100), color: COR_A },
        { label: rotuloB, value: Math.round(proporcao.B * 100), color: COR_B },
        { label: 'Outros assuntos', value: Math.round(proporcao.neutro * 100), color: COR_NEUTRO },
      ]}
    />
  );
}

/**
 * Seção 1: barras EMPILHADAS por bloco — a bolha se fechando no tempo.
 * O BarChart do Design System agrupa as barras (não empilha) e tem largura
 * mínima de 400px com scroll interno, o que escondia justamente os últimos
 * blocos. Este gráfico é SVG próprio: empilha de verdade e cabe na tela.
 */
export function BarrasPorBloco({
  series,
  rotuloA,
  rotuloB,
}: {
  series: SerieBloco[];
  rotuloA: string;
  rotuloB: string;
}) {
  const largura = 320;
  const altura = 170;
  const margemInferior = 22;
  const larguraBarra = Math.max(8, Math.min(28, (largura - 16) / Math.max(1, series.length) - 6));
  const passo = series.length > 0 ? (largura - 16) / series.length : 0;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[13px] font-semibold text-white">A bolha se fechando</figcaption>

      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="h-auto w-full"
        role="img"
        aria-label="Composição de cada bloco do feed, do primeiro ao último"
      >
        {[0, 0.5, 1].map((linha) => (
          <line
            key={linha}
            x1={0}
            x2={largura}
            y1={(altura - margemInferior) * linha}
            y2={(altura - margemInferior) * linha}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
        ))}

        {series.map((bloco, indice) => {
          const alturaUtil = altura - margemInferior;
          const x = 8 + indice * passo + (passo - larguraBarra) / 2;
          const segmentos = [
            { valor: bloco.A, cor: COR_A },
            { valor: bloco.B, cor: COR_B },
            { valor: bloco.neutro, cor: COR_NEUTRO },
          ];

          let y = alturaUtil;
          return (
            <g key={bloco.bloco}>
              {segmentos.map((segmento) => {
                const h = segmento.valor * alturaUtil;
                y -= h;
                return (
                  <rect
                    key={segmento.cor}
                    x={x}
                    y={y}
                    width={larguraBarra}
                    height={Math.max(0, h)}
                    fill={segmento.cor}
                    rx={1.5}
                  />
                );
              })}
              <text
                x={x + larguraBarra / 2}
                y={altura - 6}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(255,255,255,0.55)"
              >
                {bloco.bloco}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="flex flex-wrap gap-3 text-[11px] text-white/70">
        {[
          [rotuloA, COR_A],
          [rotuloB, COR_B],
          ['Outros assuntos', COR_NEUTRO],
        ].map(([rotulo, cor]) => (
          <li key={rotulo} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
            {rotulo}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Seção 4: a escalada da intensidade média do lado dominante.
 *
 * O LineChart do Design System tem `min-width: 400px` com scroll interno e
 * escala os valores em 0–100 ignorando os rótulos do eixo — dentro do viewport
 * de celular (271px úteis) isso escondia justamente os últimos blocos e fazia a
 * curva 1→3 colapsar rente ao fundo. Este gráfico é SVG com `viewBox`: escala
 * junto com a tela e mostra a escalada de verdade.
 */
export function LinhaDaEscalada({ series }: { series: SerieBloco[] }) {
  const largura = 320;
  const altura = 150;
  const margemEsquerda = 22;
  const margemInferior = 22;
  const alturaUtil = altura - margemInferior;
  const passo = series.length > 1 ? (largura - margemEsquerda - 8) / (series.length - 1) : 0;

  const y = (intensidade: number) => alturaUtil - (Math.min(3, Math.max(0, intensidade)) / 3) * (alturaUtil - 10);
  const x = (indice: number) => margemEsquerda + indice * passo;

  const pontos = series.map((item, indice) => `${x(indice)},${y(item.intensidadeMediaDominante)}`);
  const area = `M ${margemEsquerda},${alturaUtil} L ${pontos.join(' L ')} L ${x(series.length - 1)},${alturaUtil} Z`;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[13px] font-semibold text-white">A escalada</figcaption>

      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="h-auto w-full"
        role="img"
        aria-label="Intensidade média dos posts do lado dominante, bloco a bloco"
      >
        {[0, 1, 2, 3].map((nivel) => (
          <g key={nivel}>
            <line
              x1={margemEsquerda}
              x2={largura}
              y1={y(nivel)}
              y2={y(nivel)}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
            <text x={0} y={y(nivel) + 3} fontSize={9} fill="rgba(255,255,255,0.55)">
              {nivel}
            </text>
          </g>
        ))}

        {series.length > 1 ? (
          <>
            <path d={area} fill={COR_B} opacity={0.18} />
            <polyline
              points={pontos.join(' ')}
              fill="none"
              stroke={COR_B}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {series.map((item, indice) => (
          <g key={item.bloco}>
            <circle cx={x(indice)} cy={y(item.intensidadeMediaDominante)} r={3.5} fill={COR_B} />
            <text x={x(indice)} y={altura - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.55)">
              {item.bloco}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/**
 * Painel usado pelo dossiê: por padrão mostra o donut da proporção final + as
 * barras por bloco; com `apenas="escalada"`, só a linha da intensidade.
 */
export function PainelDeGraficos({
  dossie,
  apenas,
}: {
  dossie: {
    proporcaoFinal: { A: number; B: number; neutro: number };
    porBloco: SerieBloco[];
    atividade: { ladoALabel: string; ladoBLabel: string };
  };
  apenas?: 'escalada' | 'donut';
}) {
  const rotuloA = dossie.atividade.ladoALabel;
  const rotuloB = dossie.atividade.ladoBLabel;

  /**
   * Modo do relatório enxuto: **um gráfico só**. O donut responde "de que era
   * feito o meu feed" num relance; as barras por bloco respondem algo mais
   * subtil, que pede leitura — e num relatório para 13 anos, depois de 40 minutos
   * de atividade, o relance ganha. As barras seguem no export em texto e na
   * análise do professor.
   */
  if (apenas === 'donut') {
    return (
      <div className="flex justify-center rounded-xl bg-white/5 p-3">
        <DonutProporcao proporcao={dossie.proporcaoFinal} rotuloA={rotuloA} rotuloB={rotuloB} />
      </div>
    );
  }

  if (apenas === 'escalada') {
    return (
      <div className="rounded-xl bg-white/5 p-3">
        <LinhaDaEscalada series={dossie.porBloco} />
        <p className="mt-2 text-[11px] text-white/60">
          Intensidade média dos posts do lado dominante, bloco a bloco (1 = informativo, 3 = sensacionalista).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center rounded-xl bg-white/5 p-3">
        <DonutProporcao proporcao={dossie.proporcaoFinal} rotuloA={rotuloA} rotuloB={rotuloB} />
      </div>
      <div className="rounded-xl bg-white/5 p-3">
        <BarrasPorBloco series={dossie.porBloco} rotuloA={rotuloA} rotuloB={rotuloB} />
        <p className="mt-2 text-[11px] text-white/60">Cada barra é um bloco do feed, do começo ao fim da sessão.</p>
      </div>
    </div>
  );
}

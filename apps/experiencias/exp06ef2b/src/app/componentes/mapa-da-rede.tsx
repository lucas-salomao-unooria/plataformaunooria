import type { Topologia } from "../../lib/tipos";

/**
 * A malha de nós — o beat MEMORÁVEL da missão.
 *
 * **Os anéis já vêm agrupados do servidor.** Cada anel traz `nos` (o número
 * REAL, que a legenda escreve por extenso) e `desenhar` (quantos círculos pôr
 * no DOM). Desenhar 1.200 elementos SVG travaria o Chromebook da escola, e
 * mentir no número desfaria o Aha! — a resposta é desenhar uma amostra densa e
 * dizer o total. O `RISCO-001` do PRD é fechado aqui e em `regras/topologia.ts`.
 *
 * **O nó 3 é o estudante**, e o contraste é geométrico: anel duplo espesso
 * contra a dispersão. Quando ele interrompe, os anéis que existiriam continuam
 * na tela APAGADOS — o estudante precisa ver o que NÃO aconteceu, e um grafo
 * que simplesmente acaba não mostra o que foi evitado.
 */

const LARGURA = 340;
const ALTURA = 380;
const CENTRO_X = LARGURA / 2;

export function MapaDaRede({ topologia }: { topologia: Topologia }) {
  const { aneis, nivelDoEstudante } = topologia;
  const maxNivel = Math.max(...aneis.map((a) => a.nivel), 1);
  const passoY = (ALTURA - 40) / (maxNivel + 1);

  return (
    <svg
      className="mapa"
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={topologia.legenda}
    >
      {aneis.map((anel) => {
        const y = 24 + anel.nivel * passoY;
        const yAnterior = 24 + (anel.nivel - 1) * passoY;
        const eu = anel.nivel === nivelDoEstudante;
        /* Leque simétrico em torno do centro. A largura cresce com a
           quantidade, então a mancha comunica escala mesmo com o teto de
           círculos — que é justamente o ponto. */
        const espalhamento = Math.min(anel.desenhar * 9, LARGURA - 32);
        const passoX =
          anel.desenhar > 1 ? espalhamento / (anel.desenhar - 1) : 0;
        const x0 = CENTRO_X - espalhamento / 2;

        return (
          <g key={`${anel.nivel}-${anel.aceso ? "on" : "off"}`}>
            {Array.from({ length: anel.desenhar }, (_, i) => {
              const cx = anel.desenhar === 1 ? CENTRO_X : x0 + i * passoX;
              return (
                <g key={i}>
                  {anel.nivel > 0 && (
                    <line
                      className={anel.aceso ? "mapa__ligacao" : "mapa__ligacao--cortada"}
                      x1={CENTRO_X}
                      y1={yAnterior}
                      x2={cx}
                      y2={y}
                    />
                  )}
                  <circle
                    className={
                      eu ? "mapa__eu" : anel.aceso ? "mapa__no" : "mapa__no--apagado"
                    }
                    cx={cx}
                    cy={y}
                    r={eu ? 9 : anel.desenhar > 20 ? 2.5 : 4}
                  />
                  {/* O anel externo do nó do estudante: o contorno duplo é o
                      que faz a interrupção saltar sem uma linha de texto. */}
                  {eu && (
                    <circle
                      className="mapa__eu"
                      cx={cx}
                      cy={y}
                      r={14}
                      fill="none"
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

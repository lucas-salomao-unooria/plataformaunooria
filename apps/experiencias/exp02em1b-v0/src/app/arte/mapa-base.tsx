/**
 * O terreno de Serra do Sauá: quarteirões, malha viária, rio, lago, mata e as
 * duas vias que decidem a Missão — a Ponte do Sauá e a Rua da Ladeira.
 *
 * É cenário, não dado: nada aqui é informação de missão, e por isso não depende
 * de Camada revelada. Mas o desenho não é enfeite — a cidade é longa no eixo
 * norte-sul, e é essa geografia que faz cada base alcançar só um lado.
 *
 * viewBox 600x800, o mesmo retângulo em que os bairros são posicionados por
 * porcentagem.
 *
 * SOBRE AS CORES, e por que este é o único arquivo de `/app` com valor de cor
 * próprio: o terreno é ILUSTRAÇÃO, não interface. Verde de mata e verde de
 * quarteirão não são decisão de Design System — são as duas cores de uma
 * paisagem, e `@unooria/design-system` não publica paleta de paisagem (o verde
 * que a seção tem, `--uai-status-success`, é o verde de "deu certo", saturado
 * demais para ser campo — e ela não publica cor primitiva nenhuma).
 *
 * Tudo que é INTERFACE dentro do desenho vem do pacote: as vias, a ferrovia, a
 * água e os rótulos usam token. A paleta de terreno abaixo é declarada uma vez
 * só, com nome, para que ninguém volte a espalhar hexadecimal pelo `<svg>`.
 */

/**
 * A paisagem. Só o que o pacote não tem: os verdes.
 */
const TERRENO = {
  campo: '#EDF2E9',
  mata: '#DCE8D3',
  bosque: '#D3E2C8',
  quarteirao: '#E1EADB',
  // A água é paisagem pelo mesmo motivo que os verdes. O azul que a seção tem
  // (`--uai-status-info`) é azul de AVISO, e é também a cor da Equipe Alfa:
  // usado no rio, ele acende a cidade inteira e puxa o olho para onde não há
  // informação nenhuma.
  rio: '#CFE3F5',
  'rio-raso': '#DDEDF9',
} as const;

/**
 * O que é interface dentro do mapa. Tudo token de `@unooria/design-system`.
 */
const MALHA = {
  via: 'var(--uai-bg-primary)',
  ferrovia: 'var(--uai-border-default)',
  /** As duas vias frágeis: cinza, porque não são caminho garantido. */
  fragil: 'var(--uai-text-soft-30)',
  rotulo: 'var(--uai-text-soft-60)',
  bussola: 'var(--uai-text-soft-40)',
} as const;

/** Quarteirões: retângulos claros que dão textura urbana entre as vias. */
function Quarteiroes() {
  const linhas = [
    { y: 40, alturas: [54, 40, 62], xs: [40, 190, 360, 500] },
    { y: 140, alturas: [50, 66, 44], xs: [30, 200, 350, 470] },
    { y: 250, alturas: [58, 44, 52], xs: [50, 180, 330, 480] },
    { y: 360, alturas: [46, 60, 50], xs: [40, 210, 370, 500] },
    { y: 470, alturas: [62, 46, 58], xs: [30, 190, 340, 470] },
    { y: 580, alturas: [50, 58, 44], xs: [50, 200, 360, 490] },
    { y: 690, alturas: [54, 44, 60], xs: [40, 180, 330, 480] },
  ];
  return (
    <g fill={TERRENO.quarteirao}>
      {linhas.flatMap((l, i) =>
        l.xs.map((x, j) => (
          <rect
            key={`${i}-${j}`}
            x={x}
            y={l.y}
            width={j % 2 === 0 ? 96 : 78}
            height={l.alturas[j % l.alturas.length]}
            rx={4}
          />
        )),
      )}
    </g>
  );
}

export function MapaBase() {
  return (
    <svg
      viewBox="0 0 600 800"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect width="600" height="800" fill={TERRENO.campo} />

      {/* Mata e lago da encosta norte: terreno, acima do Vale Verde. Quem
          sobe de verdade é o Morro Alto, no sudeste — e é a Rua da Ladeira que
          conta isso, subindo até ele. */}
      <path d="M470 0 C 560 40, 600 120, 600 210 L600 0 Z" fill={TERRENO.mata} />
      <ellipse cx="520" cy="120" rx="70" ry="52" fill={TERRENO.bosque} />

      {/* Lago. */}
      <ellipse cx="512" cy="126" rx="34" ry="22" fill={TERRENO.rio} />

      <Quarteiroes />

      {/* Rio: corta a cidade e explica a cota baixa da Ribeirinha. */}
      <path
        d="M-20 430 C 140 400, 300 470, 620 432 L620 470 C 300 508, 140 438, -20 468 Z"
        fill={TERRENO.rio}
      />
      <path
        d="M-20 486 C 160 462, 320 520, 620 486 L620 504 C 320 540, 160 482, -20 504 Z"
        fill={TERRENO['rio-raso']}
      />

      {/* Malha viária. Três larguras: rodovia, avenida, rua. */}
      <g stroke={MALHA.via} fill="none" strokeLinecap="round">
        <path d="M150 -20 L150 820" strokeWidth="20" />
        <path d="M420 -20 C 440 200, 400 560, 420 820" strokeWidth="18" />
        <path d="M-20 220 L620 220" strokeWidth="18" />
        <path d="M-20 620 C 180 606, 400 634, 620 618" strokeWidth="18" />
        <path d="M60 -20 L60 820" strokeWidth="10" />
        <path d="M280 -20 L280 820" strokeWidth="10" />
        <path d="M540 220 L540 820" strokeWidth="10" />
        <path d="M-20 120 L620 120" strokeWidth="10" />
        <path d="M-20 330 L620 330" strokeWidth="10" />
        <path d="M-20 720 L620 720" strokeWidth="10" />
        <path d="M-20 540 L300 540" strokeWidth="8" />
        <path d="M330 660 L620 660" strokeWidth="8" />
      </g>

      {/* Ferrovia, cortando o Industrial. */}
      <g>
        <path d="M-20 80 L620 62" stroke={MALHA.ferrovia} strokeWidth="5" fill="none" />
        <path
          d="M-20 80 L620 62"
          stroke={MALHA.via}
          strokeWidth="5"
          strokeDasharray="3 10"
          fill="none"
        />
      </g>

      {/* As duas vias que decidem a Missão. Desenhadas em cinza porque são
          infraestrutura frágil, não caminho garantido. */}
      <g>
        <path d="M96 452 L186 476" stroke={MALHA.fragil} strokeWidth="13" strokeLinecap="round" />
        <text x="70" y="440" fontSize="15" fill={MALHA.rotulo} fontWeight="600">
          Ponte do Sauá
        </text>
      </g>
      <g>
        <path d="M470 620 L520 570" stroke={MALHA.fragil} strokeWidth="10" strokeLinecap="round" />
        <text x="424" y="556" fontSize="15" fill={MALHA.rotulo} fontWeight="600">
          Rua da Ladeira
        </text>
      </g>

      {/* Rótulos de orientação: a cidade é longa, e o estudante precisa saber para
          que lado está arrastando. */}
      <text x="24" y="34" fontSize="16" fill={MALHA.bussola} fontWeight="700" letterSpacing="2">
        NORTE
      </text>
      <text x="24" y="786" fontSize="16" fill={MALHA.bussola} fontWeight="700" letterSpacing="2">
        SUL
      </text>
    </svg>
  );
}

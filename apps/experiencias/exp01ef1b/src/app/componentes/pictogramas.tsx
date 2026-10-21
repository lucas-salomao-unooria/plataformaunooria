/**
 * Pictogramas vetoriais da missão — SVG inline, 48×48 (spec do brief de
 * assets, seção D): formas geométricas reconhecíveis, traço 3px, sem
 * ornamento. São ASSETS da experiência (compensação local declarada), não
 * componentes de UI: pictograma pedagógico por missão não é papel do DS.
 * Se a arte final da Ilustração chegar diferente, troca-se aqui, num lugar.
 */
import type { JSX } from "react";
import type { MarcaId } from "../../lib/tipos";

const caixa = { width: 48, height: 48, viewBox: "0 0 48 48", "aria-hidden": true } as const;

export function PicCoruja(): JSX.Element {
  return (
    <svg {...caixa}>
      <circle cx="24" cy="26" r="16" fill="#2196F3" stroke="#0D3B66" strokeWidth="3" />
      <path d="M8 14 L18 20 M40 14 L30 20" stroke="#0D3B66" strokeWidth="3" fill="none" />
      <circle cx="17" cy="24" r="5.5" fill="#fff" stroke="#0D3B66" strokeWidth="3" />
      <circle cx="31" cy="24" r="5.5" fill="#fff" stroke="#0D3B66" strokeWidth="3" />
      <circle cx="17" cy="24" r="2" fill="#0D3B66" />
      <circle cx="31" cy="24" r="2" fill="#0D3B66" />
      <path d="M24 29 l-3 4 h6 z" fill="#FF9800" stroke="#0D3B66" strokeWidth="2" />
    </svg>
  );
}

export function PicEstrela(): JSX.Element {
  return (
    <svg {...caixa}>
      <path
        d="M24 5 l5.6 11.4 12.6 1.8 -9.1 8.9 2.1 12.5 L24 33.7 12.8 39.6 l2.1 -12.5 -9.1 -8.9 12.6 -1.8 Z"
        fill="#FFC107"
        stroke="#7A5200"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PicSol(): JSX.Element {
  return (
    <svg {...caixa}>
      <circle cx="24" cy="24" r="10" fill="#FF9800" stroke="#8A4B00" strokeWidth="3" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 24 + Math.cos(a) * 14;
        const y1 = 24 + Math.sin(a) * 14;
        const x2 = 24 + Math.cos(a) * 20;
        const y2 = 24 + Math.sin(a) * 20;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8A4B00" strokeWidth="3" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

export function PicBloco(): JSX.Element {
  return (
    <svg {...caixa}>
      <rect x="9" y="28" width="14" height="11" rx="2" fill="#E53935" stroke="#5D1210" strokeWidth="3" />
      <rect x="25" y="28" width="14" height="11" rx="2" fill="#1E88E5" stroke="#0D3B66" strokeWidth="3" />
      <rect x="17" y="15" width="14" height="11" rx="2" fill="#FDD835" stroke="#7A5200" strokeWidth="3" />
      <circle cx="24" cy="19" r="1.6" fill="#7A5200" />
      <circle cx="16" cy="32" r="1.6" fill="#5D1210" />
      <circle cx="32" cy="32" r="1.6" fill="#0D3B66" />
    </svg>
  );
}

export function PicVassoura(): JSX.Element {
  return (
    <svg {...caixa}>
      <line x1="30" y1="6" x2="19" y2="28" stroke="#8D6E63" strokeWidth="4" strokeLinecap="round" />
      <path d="M13 28 h13 l3 12 h-19 z" fill="#FFB300" stroke="#7A5200" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 32 v6 M21 31 v8 M26 31 v7" stroke="#7A5200" strokeWidth="2" />
      <path d="M35 34 h5 M36 39 h4" stroke="#8D6E63" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PicLupa(): JSX.Element {
  return (
    <svg {...caixa}>
      <circle cx="20" cy="20" r="12" fill="#B3E5FC" fillOpacity="0.6" stroke="#0D3B66" strokeWidth="3.5" />
      <circle cx="20" cy="20" r="4" fill="#0D3B66" />
      <line x1="29" y1="29" x2="41" y2="41" stroke="#0D3B66" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function PicGlobo(): JSX.Element {
  return (
    <svg {...caixa}>
      <circle cx="24" cy="24" r="17" fill="#81C784" fillOpacity="0.5" stroke="#1B5E20" strokeWidth="3.5" />
      <ellipse cx="24" cy="24" rx="8" ry="17" fill="none" stroke="#1B5E20" strokeWidth="2.5" />
      <line x1="7" y1="24" x2="41" y2="24" stroke="#1B5E20" strokeWidth="2.5" />
      <path d="M9 15 h30 M9 33 h30" stroke="#1B5E20" strokeWidth="2" fill="none" />
    </svg>
  );
}

/** Insígnia da conclusão (100×100): medalha com lupa dourada e louros. */
export function PicMedalhaDetetive(): JSX.Element {
  return (
    <svg width={100} height={100} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="42" fill="#FFF8E1" stroke="#1A4B8F" strokeWidth="5" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="#C9A227" strokeWidth="2.5" />
      <path d="M20 62 q8 14 20 16 M80 62 q-8 14 -20 16" stroke="#7CB342" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="45" cy="44" r="12" fill="none" stroke="#C9A227" strokeWidth="5" />
      <line x1="54" y1="53" x2="66" y2="65" stroke="#C9A227" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function PictogramaDaMarca({ marca }: { marca: MarcaId }): JSX.Element {
  if (marca === "coruja") return <PicCoruja />;
  if (marca === "estrela") return <PicEstrela />;
  return <PicSol />;
}

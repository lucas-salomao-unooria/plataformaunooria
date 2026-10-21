/**
 * Composições locais da CASCA UNOORIA (E1, E5, E6, ERR) — família `ds`.
 *
 * DES-09/TEC-11: os candidatos viraram composição inline sobre as primitivas
 * de `@edu/ui/ds`, nunca um mini-DS paralelo. O que é local aqui é MONTAGEM
 * (grade, overlay, pareamento pictograma+áudio); botão é `Button` do DS.
 *
 * Lacuna declarada para o storybook-unooria: um "botão de repetição de áudio"
 * com glifo de alto-falante (usado em toda missão de anos iniciais). Ele tem
 * 64×64 desde a 1.0.6 (H06.1.1): com 48 a criança de 6 anos errava o toque, e
 * repetir o áudio é a ação que ela mais repete quando ainda não lê.
 * Enquanto não existe, `AudioReplayButton` compõe `Button` + SVG local — e
 * este comentário existe para o componente morrer quando o pacote publicar.
 */
import type { JSX } from "react";
import { Button } from "@edu/ui/ds";
import { tocar } from "../../lib/audio";
import type { MarcaId } from "../../lib/tipos";
import { TEXTO } from "../../lib/textos";
import { AUDIO_REPLAY_PX } from "./medidas";
import { PictogramaDaMarca } from "./pictogramas";

function GlifoAltoFalante(): JSX.Element {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 9 h4 l5 -4 v14 l-5 -4 H4 z" fill="currentColor" />
      <path d="M16 9 q3 3 0 6 M18 6.5 q5 5.5 0 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Botão dedicado de repetição de áudio (64×64; a spec E1 pedia 48). */
export function AudioReplayButton({ audioId, rotulo }: { audioId: string; rotulo?: string }): JSX.Element {
  return (
    <Button
      variant="secondary"
      aria-label={rotulo ?? "OUVIR DE NOVO"}
      onClick={() => tocar(audioId)}
      style={{ width: AUDIO_REPLAY_PX, height: AUDIO_REPLAY_PX, padding: 0, borderRadius: AUDIO_REPLAY_PX / 2, flexShrink: 0 }}
    >
      <GlifoAltoFalante />
    </Button>
  );
}

const MARCAS: Array<{ id: MarcaId; rotulo: string }> = [
  { id: "coruja", rotulo: TEXTO.e1.marcaCoruja },
  { id: "estrela", rotulo: TEXTO.e1.marcaEstrela },
  { id: "sol", rotulo: TEXTO.e1.marcaSol },
];

/**
 * A grade dos 3 crachás (E1). Exatamente 3 opções na tela, seleção unária —
 * o teto cognitivo do 1º EF é regra, não estilo.
 */
export function BadgeSelectorGrid({
  selecionada,
  aoEscolher,
}: {
  selecionada: MarcaId | null;
  aoEscolher: (marca: MarcaId) => void;
}): JSX.Element {
  return (
    <div className="fc-grade-marcas" role="radiogroup" aria-label={TEXTO.e1.escolhaMarca}>
      {MARCAS.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={selecionada === m.id}
          className={`fc-cartao-marca${selecionada === m.id ? " fc-cartao-marca--ativa" : ""}`}
          onClick={() => aoEscolher(m.id)}
        >
          <PictogramaDaMarca marca={m.id} />
          <span>{m.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * O congelamento da Roda (E5-SIS-01): overlay de tela cheia SEM nenhum botão,
 * link ou scroll — o tablet vira porta-retrato (não-negociável 3). Toques são
 * ignorados sem erro; quem destrava é o professor, e quem percebe é o polling.
 */
export function FreezeOverlayFrame(): JSX.Element {
  return (
    <div className="fc-congelamento" aria-live="polite">
      <IlustracaoNinaMegafone />
      <h1>{TEXTO.e5.rodaConversa}</h1>
      <p>{TEXTO.e5.esperaDocente}</p>
    </div>
  );
}

/** Nina com megafone (ilustração de cena `ilu-exp01-02` do brief; placeholder
 *  vetorial até a arte final da Ilustração chegar). */
export function IlustracaoNinaMegafone(): JSX.Element {
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
      <circle cx="70" cy="46" r="22" fill="#FFE0B2" stroke="#5D4037" strokeWidth="3" />
      <path d="M48 44 q22 -26 44 0 v-8 q-22 -20 -44 0 z" fill="#5D4037" />
      <circle cx="62" cy="46" r="2.6" fill="#3E2723" />
      <circle cx="78" cy="46" r="2.6" fill="#3E2723" />
      <path d="M63 56 q7 5 14 0" stroke="#3E2723" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M42 110 q28 -34 56 0 z" fill="#7E57C2" stroke="#4527A0" strokeWidth="3" />
      <path d="M96 78 l26 -12 v30 l-26 -10 z" fill="#42A5F5" stroke="#0D3B66" strokeWidth="3" strokeLinejoin="round" />
      <rect x="88" y="80" width="10" height="14" rx="3" fill="#0D3B66" />
    </svg>
  );
}

/** Nina fotógrafa (E1 — `ilu-exp01-01`; placeholder vetorial). */
export function IlustracaoNinaFotografa(): JSX.Element {
  return (
    <svg width="120" height="120" viewBox="0 0 140 140" aria-hidden>
      <circle cx="70" cy="46" r="22" fill="#FFE0B2" stroke="#5D4037" strokeWidth="3" />
      <path d="M48 44 q22 -26 44 0 v-8 q-22 -20 -44 0 z" fill="#5D4037" />
      <circle cx="62" cy="44" r="2.6" fill="#3E2723" />
      <circle cx="78" cy="44" r="2.6" fill="#3E2723" />
      <path d="M63 55 q7 5 14 0" stroke="#3E2723" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M42 112 q28 -34 56 0 z" fill="#26A69A" stroke="#00695C" strokeWidth="3" />
      <rect x="52" y="76" width="36" height="24" rx="5" fill="#FDD835" stroke="#7A5200" strokeWidth="3" />
      <circle cx="70" cy="88" r="7" fill="#fff" stroke="#7A5200" strokeWidth="3" />
      <rect x="58" y="71" width="10" height="6" rx="2" fill="#7A5200" />
    </svg>
  );
}

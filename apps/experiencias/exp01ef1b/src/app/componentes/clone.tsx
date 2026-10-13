/**
 * Composições locais do CLONE (E2–E4) — família `ds-insta`, nunca a da
 * plataforma: um token institucional dentro do mural quebra o disfarce que a
 * experiência mede.
 *
 * DES-09/TEC-11: montagem local sobre `ButtonInsta`/primitivas da ponte. O
 * botão de áudio do clone é a MESMA lacuna declarada em `casca.tsx`, na
 * família de cá — duas composições finas, uma por família, nunca um botão
 * único misturando tokens.
 */
import { useEffect, useState, type JSX } from "react";
import { ButtonInsta } from "@edu/ui/ds-insta";
import { tocar } from "../../lib/audio";
import { AUDIO_REPLAY_PX } from "./medidas";
import { TEXTO } from "../../lib/textos";
import type { LegendaDoPar } from "../../lib/tipos";
import { PicBloco, PicVassoura } from "./pictogramas";

/** A foto de um id do pacote — asset do bundle (`public/fotos/<id>.svg`,
 *  placeholders vetoriais até as fotografias WebP da Curadoria chegarem). */
export function urlDaFoto(fotoId: string): string {
  return `fotos/${fotoId}.svg`;
}

function GlifoAltoFalanteInsta(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 9 h4 l5 -4 v14 l-5 -4 H4 z" fill="currentColor" />
      <path d="M16 9 q3 3 0 6 M18 6.5 q5 5.5 0 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Botão de repetição de áudio DENTRO do clone (64×64, tokens do clone). */
export function AudioReplayButtonClone({ audioId, rotulo }: { audioId: string; rotulo?: string }): JSX.Element {
  return (
    <ButtonInsta
      variant="secondary"
      aria-label={rotulo ?? "OUVIR DE NOVO"}
      onClick={() => tocar(audioId)}
      style={{ width: AUDIO_REPLAY_PX, height: AUDIO_REPLAY_PX, padding: 0, borderRadius: AUDIO_REPLAY_PX / 2, flexShrink: 0 }}
    >
      <GlifoAltoFalanteInsta />
    </ButtonInsta>
  );
}

/**
 * O seletor A/B do par decisório (E3): mesmas medidas, mesma moldura — a
 * criança não pode deduzir a "foto certa" pela apresentação (regra de
 * não-adivinhação do brief). Borda de 4px na selecionada + check.
 */
export function PhotoComparisonSelector({
  fotoAId,
  fotoBId,
  selecionada,
  aoEscolher,
}: {
  fotoAId: string;
  fotoBId: string;
  selecionada: string | null;
  aoEscolher: (fotoId: string) => void;
}): JSX.Element {
  const fotos = [fotoAId, fotoBId];
  return (
    <div className="fc-seletor-fotos" role="radiogroup" aria-label={TEXTO.e3.selecionarFoto}>
      {fotos.map((id, i) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={selecionada === id}
          /* Nome NEUTRO, de propósito: descrever a foto entregaria a escolha
             (regra de não-adivinhação). Sem nenhum, o leitor de tela dizia só
             "botão de opção" (WCAG 4.1.2, ADR-162). */
          aria-label={`Foto ${i + 1}`}
          className={`fc-foto-opcao${selecionada === id ? " fc-foto-opcao--ativa" : ""}`}
          onClick={() => aoEscolher(id)}
        >
          <img src={urlDaFoto(id)} alt="" />
          {selecionada === id ? <span className="fc-foto-check" aria-hidden>✓</span> : null}
        </button>
      ))}
    </div>
  );
}

/** O card de legenda com pictograma e botão de áudio próprio (E3, 72px). */
export function CaptionPictogramCard({
  legenda,
  audioId,
  selecionada,
  aoEscolher,
}: {
  legenda: LegendaDoPar;
  audioId: string;
  selecionada: boolean;
  aoEscolher: (id: LegendaDoPar["id"]) => void;
}): JSX.Element {
  return (
    <div className={`fc-card-legenda${selecionada ? " fc-card-legenda--ativa" : ""}`}>
      <button
        type="button"
        role="radio"
        aria-checked={selecionada}
        className="fc-card-legenda-corpo"
        onClick={() => aoEscolher(legenda.id)}
      >
        {legenda.icone === "bloco" ? <PicBloco /> : <PicVassoura />}
        <span>{legenda.texto}</span>
      </button>
      <AudioReplayButtonClone audioId={audioId} rotulo={`OUVIR: ${legenda.texto}`} />
    </div>
  );
}

/**
 * O micro-spinner contido do PICO (E3-ALU-02): exatamente 800ms sobre o botão
 * antes da troca de rota — a duração é instrumento (solenidade do envio),
 * fixada aqui e não no CSS.
 */
export const SPINNER_MS = 800;

export function MicroSpinnerOverlay({ aoTerminar }: { aoTerminar: () => void }): JSX.Element {
  const [, forcar] = useState(0);
  useEffect(() => {
    const t = setTimeout(aoTerminar, SPINNER_MS);
    forcar(1);
    return () => clearTimeout(t);
  }, [aoTerminar]);
  return (
    <span className="fc-spinner" role="status" aria-label={TEXTO.e3.publicando}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="fc-spinner-svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
        <path d="M12 3 a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      {TEXTO.e3.publicando}
    </span>
  );
}

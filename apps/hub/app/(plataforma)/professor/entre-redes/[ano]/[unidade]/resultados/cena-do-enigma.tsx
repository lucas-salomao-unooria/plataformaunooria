"use client";

import { useRef, type MouseEvent } from "react";

import {
  FOTOS,
  RECORTE_DA_FOTO,
  pontoNaPanoramica,
  urlDaImagem,
  type ConteudoDoPacote,
  type MarcaNaCena,
} from "@/lib/enigma-capa-tipos";

/* `MarcaNaCena` e `marcasDoConteudo` moram em `lib/enigma-capa-tipos.ts`: este
   arquivo é "use client", e uma FUNÇÃO exportada daqui não pode ser chamada
   por um Server Component (o guia e a página da atividade) — o Next derruba a
   página com 500. */
export type { MarcaNaCena };

const COR_DA_MOLDURA: Record<(typeof FOTOS)[number], string> = {
  "foto-1": "var(--unooria-color-brandnavy-700, #2a3550)",
  "foto-2": "var(--unooria-color-brandnavy-500, #49699f)",
};

/**
 * A PANORÂMICA da exp02ef1b vista pelo professor (ADR-184): a imagem inteira,
 * com as DUAS molduras das fotos (foto 1 = x 0–68%, foto 2 = x 32–100% — a
 * faixa do meio aparece nas duas) e os círculos dos objetos iguais.
 *
 * É a peça da curadoria (o professor toca no objeto, e `aoTocar` recebe o
 * ponto em 0–100 da panorâmica) e do conteúdo da atividade (só leitura).
 *
 * COMPENSAÇÃO LOCAL, marcada: o DS não tem "imagem com áreas marcadas e toque
 * em coordenada". O que está aqui é só posicionamento (as molduras e os
 * círculos são caixas absolutas em % sobre a imagem) — nenhum controle novo:
 * os botões da curadoria são do DS e moram fora desta peça. O toque é de
 * ponteiro; quem não usa ponteiro aprova um pacote pronto, que já vem marcado.
 */
export function CenaDoEnigma({
  conteudo,
  baseDoBundle,
  marcas,
  aoTocar,
  rotuloDoToque,
}: {
  conteudo: ConteudoDoPacote;
  baseDoBundle: string | null;
  marcas: MarcaNaCena[];
  /** Com ele, a imagem aceita o toque (a curadoria); sem ele, é só leitura. */
  aoTocar?: (ponto: { x: number; y: number }) => void;
  /** O que o toque vai marcar agora ("Toque no RELÓGIO na imagem") — vira o `aria-label`. */
  rotuloDoToque?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = conteudo.cena;
  const src = urlDaImagem(cena.imagem, baseDoBundle);

  function tocar(e: MouseEvent<HTMLDivElement>) {
    if (!aoTocar || !caixa.current) return;
    const r = caixa.current.getBoundingClientRect();
    aoTocar(pontoNaPanoramica({ x: e.clientX, y: e.clientY }, { left: r.left, top: r.top, width: r.width, height: r.height }));
  }

  return (
    <figure className="m-0 flex flex-col gap-2" data-cena-do-enigma={cena.chave}>
      <div
        ref={caixa}
        className="relative w-full overflow-hidden rounded-lg bg-unooria-neutral-100"
        style={{ aspectRatio: "16 / 9", cursor: aoTocar ? "crosshair" : undefined }}
        onClick={aoTocar ? tocar : undefined}
        role={aoTocar ? "application" : undefined}
        aria-label={aoTocar ? rotuloDoToque : undefined}
        data-toque-na-cena={aoTocar ? "ligado" : undefined}
      >
        {src ? (
          <img src={src} alt={cena.alt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-unooria-neutral-600">
            {cena.alt}
          </p>
        )}
        {FOTOS.map((id, i) => {
          const r = RECORTE_DA_FOTO[id];
          return (
            <div
              key={id}
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.w}%`,
                height: `${r.h}%`,
                border: `3px ${i === 0 ? "solid" : "dashed"} ${COR_DA_MOLDURA[id]}`,
                borderRadius: 8,
              }}
            >
              <span
                className="absolute rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                style={{ background: COR_DA_MOLDURA[id], top: 4, [i === 0 ? "left" : "right"]: 4 }}
              >
                {`FOTO ${i + 1}`}
              </span>
            </div>
          );
        })}
        {marcas.map((m) => (
          <div
            key={m.id}
            aria-hidden
            className="pointer-events-none absolute flex items-center justify-center rounded-full"
            style={{
              left: `${m.alvo.x}%`,
              top: `${m.alvo.y}%`,
              width: `${m.alvo.r * 2}%`,
              aspectRatio: "1 / 1",
              transform: "translate(-50%, -50%)",
              border: "3px solid var(--unooria-color-warning-500, #f5a623)",
              boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.85)",
            }}
            data-alvo={m.id}
          >
            <span className="translate-y-[140%] whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-bold text-unooria-neutral-950">
              {m.nome}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="text-[12px] text-unooria-neutral-600">
        {`${cena.espaco} · ${cena.hora} — a moldura cheia é a FOTO 1, a tracejada é a FOTO 2; a faixa do meio aparece nas duas.`}
      </figcaption>
    </figure>
  );
}


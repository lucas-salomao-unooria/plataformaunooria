"use client";

import { useRef, useState, type PointerEvent } from "react";

import { Icon, ProgressBar } from "@edu/ui/ds";
import {
  FAIXA_COMUM,
  FOTOS,
  RECORTE_DA_FOTO,
  areaDoArraste,
  areaDoToque,
  ehArraste,
  pontoNaPanoramica,
  urlDaImagem,
  type ConteudoDoPacote,
  type MarcaNaCena,
  type Retangulo,
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
const COR_DA_AREA = "var(--unooria-color-warning-500, #f5a623)";

/**
 * A PANORÂMICA da exp02ef1b vista pelo professor (ADR-184): a imagem inteira,
 * com as DUAS molduras das fotos (foto 1 = x 0–68%, foto 2 = x 32–100% — a
 * faixa do meio aparece nas duas) e as ÁREAS dos objetos iguais.
 *
 * É a peça da curadoria e do conteúdo da atividade (só leitura). Na curadoria
 * (`aoDesenhar`), o professor ARRASTA uma caixa em volta do objeto inteiro
 * (ADR-188: era um toque com um círculo de tamanho fixo, e objeto maior que o
 * círculo fazia a lupa "errar" com a lente em cima dele). A caixa fica presa à
 * faixa do meio, que aparece destacada enquanto ele desenha; um clique sem
 * arraste vira uma caixa média centrada nele. `ocupada` cobre a imagem com a
 * espera animada da geração.
 *
 * COMPENSAÇÃO LOCAL, marcada: o DS não tem "imagem com áreas marcadas e
 * desenho de retângulo em coordenada". O que está aqui é posicionamento (as
 * molduras, as áreas e o véu são caixas absolutas em % sobre a imagem) e o
 * gesto de arrastar; a espera usa a `ProgressBar` e o `Icon` do DS, e os
 * botões da curadoria são do DS e moram fora desta peça. O desenho é de
 * ponteiro; quem não usa ponteiro aprova um pacote pronto, que já vem marcado.
 */
export function CenaDoEnigma({
  conteudo,
  baseDoBundle,
  marcas,
  aoDesenhar,
  rotuloDoDesenho,
  ocupada,
}: {
  conteudo: ConteudoDoPacote;
  baseDoBundle: string | null;
  marcas: MarcaNaCena[];
  /** Com ele, a imagem aceita o desenho da área (a curadoria); sem ele, é só leitura. */
  aoDesenhar?: (area: Retangulo) => void;
  /** O que o desenho vai marcar agora ("Desenhe a área do RELÓGIO") — vira o `aria-label`. */
  rotuloDoDesenho?: string;
  /** A espera da geração por cima da imagem (o texto lúdico), ou nada. */
  ocupada?: string | null;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);
  const [rascunho, setRascunho] = useState<Retangulo | null>(null);
  const cena = conteudo.cena;
  const src = urlDaImagem(cena.imagem, baseDoBundle);
  const desenhando = Boolean(aoDesenhar) && !ocupada;

  function ponto(e: PointerEvent<HTMLDivElement>) {
    const r = caixa.current!.getBoundingClientRect();
    return pontoNaPanoramica({ x: e.clientX, y: e.clientY }, { left: r.left, top: r.top, width: r.width, height: r.height });
  }

  function aoBaixar(e: PointerEvent<HTMLDivElement>) {
    if (!desenhando || !caixa.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = ponto(e);
    setInicio(p);
    setRascunho(areaDoArraste(p, p));
  }

  function aoMover(e: PointerEvent<HTMLDivElement>) {
    if (!inicio || !caixa.current) return;
    setRascunho(areaDoArraste(inicio, ponto(e)));
  }

  function aoSoltar(e: PointerEvent<HTMLDivElement>) {
    if (!inicio || !caixa.current) return;
    const area = areaDoArraste(inicio, ponto(e));
    const final = ehArraste(area) ? area : areaDoToque(inicio);
    setInicio(null);
    setRascunho(null);
    aoDesenhar?.(final);
  }

  const areas: { id: string; nome: string; area: Retangulo; provisoria?: boolean }[] = [
    ...marcas.map((m) => ({ id: m.id, nome: m.nome, area: m.alvo })),
    ...(rascunho ? [{ id: "desenhando", nome: "", area: rascunho, provisoria: true }] : []),
  ];

  return (
    <figure className="m-0 flex flex-col gap-2" data-cena-do-enigma={cena.chave}>
      <div
        ref={caixa}
        className="relative w-full touch-none select-none overflow-hidden rounded-lg bg-unooria-neutral-100"
        style={{ aspectRatio: "16 / 9", cursor: desenhando ? "crosshair" : undefined }}
        onPointerDown={desenhando ? aoBaixar : undefined}
        onPointerMove={desenhando ? aoMover : undefined}
        onPointerUp={desenhando ? aoSoltar : undefined}
        onPointerCancel={() => {
          setInicio(null);
          setRascunho(null);
        }}
        role={desenhando ? "application" : undefined}
        aria-label={desenhando ? rotuloDoDesenho : undefined}
        aria-busy={ocupada ? true : undefined}
        data-desenho-na-cena={desenhando ? "ligado" : undefined}
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
        {/* Desenhando: o que fica FORA da faixa do meio escurece — a caixa só cabe nela. */}
        {desenhando ? (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 bg-black/45" style={{ width: `${FAIXA_COMUM.de}%` }} />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 bg-black/45" style={{ width: `${100 - FAIXA_COMUM.ate}%` }} />
          </>
        ) : null}
        {areas.map((m) => (
          <div
            key={m.id}
            aria-hidden
            className="pointer-events-none absolute rounded-md"
            style={{
              left: `${m.area.x}%`,
              top: `${m.area.y}%`,
              width: `${m.area.w}%`,
              height: `${m.area.h}%`,
              border: `3px ${m.provisoria ? "dashed" : "solid"} ${COR_DA_AREA}`,
              background: m.provisoria ? "rgba(245, 166, 35, 0.18)" : undefined,
              boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.85)",
            }}
            data-alvo={m.provisoria ? undefined : m.id}
          >
            {m.nome ? (
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-bold text-unooria-neutral-950">
                {m.nome}
              </span>
            ) : null}
          </div>
        ))}
        {ocupada ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/75 p-6 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            data-gerando-imagem
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-unooria-neutral-100 motion-safe:animate-pulse">
              <Icon name="auto_awesome" size={32} />
            </span>
            <div className="w-full max-w-sm">
              <ProgressBar indeterminate label={ocupada} valuePosition="none" />
            </div>
            <p className="text-center text-[12px] text-unooria-neutral-700">Leva até um minuto. Pode continuar nesta página.</p>
          </div>
        ) : null}
      </div>
      <figcaption className="text-[12px] text-unooria-neutral-600">
        {`${cena.espaco} · ${cena.hora} — a moldura cheia é a FOTO 1, a tracejada é a FOTO 2; a faixa do meio aparece nas duas.`}
      </figcaption>
    </figure>
  );
}

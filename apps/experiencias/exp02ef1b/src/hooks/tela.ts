import { useCallback, useEffect, useState } from "react";

/**
 * O tamanho (px) de um elemento, acompanhando o redimensionamento. Zero até a
 * primeira medida. A ref é de CALLBACK: se o elemento medido trocar (a tela
 * muda de momento e o contêiner é outro), a medida segue o novo.
 */
export function useTamanho<T extends HTMLElement>(): [(el: T | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<T | null>(null);
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTamanho((t) => (Math.round(t.w) === Math.round(r.width) && Math.round(t.h) === Math.round(r.height) ? t : { w: r.width, h: r.height }));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  const ref = useCallback((novo: T | null) => setEl(novo), []);
  return [ref, tamanho];
}

/**
 * Inatividade (one-pager §7: "Não escolheu nada"): `true` depois de `ms` sem
 * toque nem tecla. Qualquer gesto zera — e o Bento sai. Não há avanço
 * involuntário nem perda de estado.
 */
export function useInatividade(ms: number, ativo: boolean): boolean {
  const [inativo, setInativo] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let id = window.setTimeout(() => setInativo(true), ms);
    const zerar = () => {
      setInativo(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setInativo(true), ms);
    };
    window.addEventListener("pointerdown", zerar);
    window.addEventListener("keydown", zerar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", zerar);
      window.removeEventListener("keydown", zerar);
    };
  }, [ms, ativo]);
  return ativo && inativo;
}

/** `true` depois de `ms` desde a montagem (ou desde `chave` mudar). */
export function useDepoisDe(ms: number, chave: unknown = null): boolean {
  const [passou, setPassou] = useState(false);
  useEffect(() => {
    setPassou(false);
    const id = window.setTimeout(() => setPassou(true), ms);
    return () => window.clearTimeout(id);
  }, [ms, chave]);
  return passou;
}

/** O usuário pediu menos movimento? (WCAG 2.3.3) — a vibração e as animações respeitam. */
export function prefereMenosMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

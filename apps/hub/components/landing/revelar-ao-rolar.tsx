"use client";

import { useEffect } from "react";

/**
 * Revelação ao rolar (o `fade-in-up` do modelo): marca a raiz com
 * `.landing--animada` — só a partir daí o CSS esconde os `.landing-revelar` —
 * e um IntersectionObserver devolve cada um quando entra 10% no viewport.
 *
 * A ordem importa: sem JS (ou com o bundle atrasado) a classe nunca entra e a
 * página nasce visível. Esconder no CSS puro e revelar no JS deixaria a landing
 * em branco para quem o script não alcança.
 */
export function RevelarAoRolar({ raizId }: { raizId: string }) {
  useEffect(() => {
    const raiz = document.getElementById(raizId);
    if (!raiz) return;
    const elementos = Array.from(raiz.querySelectorAll<HTMLElement>(".landing-revelar"));
    if (!("IntersectionObserver" in window)) return;

    raiz.classList.add("landing--animada");
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.add("landing-revelar--visivel");
          observador.unobserve(entrada.target);
        }
      },
      { threshold: 0.1 },
    );
    elementos.forEach((el) => observador.observe(el));

    return () => {
      observador.disconnect();
      raiz.classList.remove("landing--animada");
    };
  }, [raizId]);

  return null;
}

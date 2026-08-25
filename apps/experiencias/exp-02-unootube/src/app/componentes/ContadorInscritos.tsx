import { useEffect, useRef, useState } from "react";

/** Contagem animada (ease-out cúbico, 1,1 s); respeita prefers-reduced-motion. */
export function ContadorInscritos({ valor }: { valor: number }) {
  const [exibido, setExibido] = useState(0);
  const exibidoRef = useRef(0);

  useEffect(() => {
    const inicio = exibidoRef.current;
    if (inicio === valor) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      exibidoRef.current = valor;
      setExibido(valor);
      return;
    }

    const duracao = 1100;
    const comecou = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const progresso = Math.min(1, (agora - comecou) / duracao);
      const suavizado = 1 - Math.pow(1 - progresso, 3);
      const proximo = Math.round(inicio + (valor - inicio) * suavizado);
      exibidoRef.current = proximo;
      setExibido(proximo);
      if (progresso < 1) quadro = window.requestAnimationFrame(passo);
    };
    quadro = window.requestAnimationFrame(passo);
    return () => window.cancelAnimationFrame(quadro);
  }, [valor]);

  return <strong aria-hidden="true">{exibido.toLocaleString("pt-BR")}</strong>;
}

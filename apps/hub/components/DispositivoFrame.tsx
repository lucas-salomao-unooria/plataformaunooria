"use client";

import { useEffect, useState } from "react";

/**
 * Viewport de celular embutido na página — port da casca do projeto origem.
 *
 * A experiência roda num iframe com EXATAMENTE `largura`×`altura` px lógicos.
 * Não é enfeite: dentro do iframe, `100dvh`, `position: fixed`, `sticky`, as
 * porcentagens de altura dos sheets e — o mais importante — o
 * `IntersectionObserver` que mede o dwell passam a se referir ao APARELHO, e
 * não à janela do navegador. Com um `<div>` e `overflow`, o dwell mediria
 * contra a janela e inflaria silenciosamente o sinal central do motor.
 *
 * Sem bezel, sem status bar: só o viewport travado, centralizado num fundo
 * neutro. Se a janela for menor que o aparelho, tudo reduz proporcionalmente —
 * a página nunca rola. Aplicado quando o manifesto da experiência declara
 * `viewport`; sem viewport, o ExpFrame ocupa a janela inteira.
 */
export function DispositivoFrame({
  largura,
  altura,
  children,
}: {
  largura: number;
  altura: number;
  children: React.ReactNode;
}) {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const recalcular = () => {
      // 56px de header + 32px de respiro: sem descontar, o aparelho fica alto
      // demais e a página do navegador volta a rolar (lição do origem).
      const folgaVertical = 56 + 32;
      const folgaHorizontal = 16;
      const cabeVertical = (window.innerHeight - folgaVertical) / altura;
      const cabeHorizontal = (window.innerWidth - folgaHorizontal) / largura;
      setEscala(Math.min(1, cabeVertical, cabeHorizontal));
    };
    recalcular();
    window.addEventListener("resize", recalcular);
    window.addEventListener("orientationchange", recalcular);
    return () => {
      window.removeEventListener("resize", recalcular);
      window.removeEventListener("orientationchange", recalcular);
    };
  }, [largura, altura]);

  return (
    <div
      style={{
        // absolute (não fixed): o ExpHost pode empilhar um "chrome" acima (a
        // moldura dos perdidos) — fixed cobriria a moldura.
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          width: largura,
          height: altura,
          transform: `scale(${escala})`,
          transformOrigin: "center center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

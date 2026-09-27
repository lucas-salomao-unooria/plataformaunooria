"use client";

import { useEffect, useRef, useState } from "react";

/** Respiro entre o aparelho e as bordas da área disponível. */
const FOLGA = { vertical: 32, horizontal: 16 };

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
 * neutro — mais uma borda de 1px e uma sombra fraca, para o aparelho não se
 * dissolver no fundo (o feed é branco e o fundo quase branco). Se a área for
 * menor que o aparelho, tudo reduz proporcionalmente — a página nunca rola.
 *
 * A escala vem do TAMANHO DA PRÓPRIA ÁREA (ResizeObserver), não de
 * `window.innerHeight` menos um número mágico de header: o header padrão do hub
 * mora acima e já sai da conta sozinho. Antes eram 56+32px chumbados, que
 * passaram a mentir quando o header virou 64px.
 *
 * Aplicado quando o manifesto da experiência declara `viewport`; sem viewport,
 * o ExpFrame ocupa a área inteira (era o caso do UnooTube, desenhado para
 * desktop e hoje arquivado como `backup-exp04ef1b`).
 *
 * `expandido` solta o aparelho e deixa a experiência ocupar a área toda — hoje
 * só o relatório do estudante, DEPOIS da revelação, onde não há mais disfarce a
 * proteger e 375px comprimiam a tela mais densa do produto.
 *
 * Ele muda ESTILO, nunca a árvore. Tirar o `children` daqui para renderizá-lo
 * fora desmontaria o `<iframe>`, e o estudante voltaria à revelação com a sessão
 * recarregada. É por isso que o modo expandido é uma prop, e não um `if` no
 * `ExpHost` trocando o wrapper.
 *
 * E é por isso que quem liga a prop precisa ser conservador: o
 * `IntersectionObserver` que mede o dwell se refere ao APARELHO, então um feed
 * numa área larga inflaria o sinal central do motor. Fora do relatório, a
 * resposta certa é sempre "contraído".
 */
export function DispositivoFrame({
  largura,
  altura,
  expandido = false,
  children,
}: {
  largura: number;
  altura: number;
  expandido?: boolean;
  children: React.ReactNode;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const alvo = area.current;
    if (!alvo || expandido) return;

    const recalcular = () => {
      const { width, height } = alvo.getBoundingClientRect();
      // Antes do primeiro layout a caixa vem 0×0: manter a escala atual em vez
      // de encolher o aparelho para zero.
      if (width === 0 || height === 0) return;
      const cabeVertical = (height - FOLGA.vertical) / altura;
      const cabeHorizontal = (width - FOLGA.horizontal) / largura;
      setEscala(Math.max(0.1, Math.min(1, cabeVertical, cabeHorizontal)));
    };

    recalcular();
    const observador = new ResizeObserver(recalcular);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [largura, altura, expandido]);

  return (
    <div
      ref={area}
      style={{
        // absolute (não fixed): o ExpHost pode empilhar um "chrome" acima (a
        // moldura dos perdidos) — fixed cobriria a moldura e o header.
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
          width: expandido ? "100%" : largura,
          height: expandido ? "100%" : altura,
          transform: expandido ? "none" : `scale(${escala})`,
          transformOrigin: "center center",
          flexShrink: 0,
          overflow: "hidden",
          background: "#fff",
          // `outline`, não `border`: o preflight do Tailwind põe
          // `box-sizing: border-box` em tudo, e 1px de borda comeria 2px do
          // viewport — o iframe deixaria de ter EXATAMENTE 375×812.
          outline: expandido ? "none" : "1px solid #e5e5e5",
          boxShadow: expandido ? "none" : "0 8px 32px rgb(0 0 0 / 8%)",
          // Sem `width`/`height` na transição: animá-las faria o iframe
          // relayoutar quadro a quadro, e o conteúdo dentro dele piscaria.
          transition: "transform 260ms ease, outline-color 260ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

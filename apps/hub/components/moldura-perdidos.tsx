"use client";

/**
 * A moldura do hub em volta do aparelho, durante os posts perdidos — o "chrome"
 * que a experiência aciona via `exp:estado { fase: "perdidos" }`.
 *
 * Vive em arquivo próprio e é carregada por dynamic import de propósito: a copy
 * fala de **algoritmo**, e um texto assim no bundle da casca — que carrega
 * desde o primeiro segundo — daria para ler no DevTools antes da revelação.
 * Foi o teste de disfarce do origem que pegou isso.
 *
 * Por que existe: o aparelho tem 375px e mostra o feed em cinza. O cinza diz
 * "isto passou por você"; a moldura diz DE QUE feed se trata, em tamanho que se
 * lê de longe. As duas coisas juntas é que tornam o momento óbvio.
 *
 * Cores fixas (não tokens do DS institucional): esta tela acompanha a
 * linguagem do aparelho do estudante, que NÃO carrega o CSS da plataforma.
 */
export function MolduraPerdidos() {
  return (
    <div
      style={{
        flexShrink: 0,
        background: "#0B0B10", // `night` do clone
        padding: "16px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.6)",
          margin: 0,
        }}
      >
        o feed que você não recebeu
      </p>
      <p
        style={{
          margin: "4px auto 0",
          maxWidth: 560,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.375,
          color: "#fff",
        }}
      >
        Estes posts existiam todo esse tempo. O algoritmo não escolheu nenhum deles para você.
      </p>
    </div>
  );
}

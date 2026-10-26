import { useRef, type ReactNode } from "react";
import { arrastarDeslocamento, deslocarPorTecla, molduraDe, proporcaoDaJanela, retanguloVisivel } from "../lib/geometria";
import type { Deslocamento, Moldura, Retangulo } from "../lib/tipos";
import { Janela } from "./Janela";

/**
 * A MOLDURA DE TAMANHO FIXO (E3, a capa; E5, a segunda foto) — a regra única
 * de arraste do one-pager §16: o gesto altera SÓ a posição da foto dentro da
 * moldura, limitado à área válida da imagem, sem espaço vazio. Sem alça, sem
 * zoom por pinça (o segundo dedo é ignorado), sem controle de escala. As setas
 * do teclado fazem o mesmo arraste, em décimos da folga.
 *
 * O `deslocamento` é a fração da folga (0–1) — é ele, e não pixel, que vai à
 * api; o servidor deriva a janela publicada com a mesma conta
 * (`retanguloVisivel`).
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: a seção
 * `unoovista` não tem enquadramento (o `StoryComposer` não recorta foto em
 * moldura fixa). Composição de posicionamento sobre a `Janela`.
 */
export function MolduraFixa({
  src,
  alt,
  recorte,
  moldura,
  proporcaoDaImagem,
  deslocamento,
  aoMudar,
  largura,
  rotulo,
  children,
}: {
  src: string;
  alt: string;
  /** O pedaço da imagem que é "a foto" (na capa, o recorte da panorâmica; na 2ª foto, a imagem inteira). */
  recorte: Retangulo;
  moldura: Moldura;
  proporcaoDaImagem: number;
  deslocamento: Deslocamento;
  aoMudar: (d: Deslocamento) => void;
  largura: number;
  rotulo: string;
  children?: ReactNode;
}) {
  const m = molduraDe(recorte, moldura);
  const proporcao = proporcaoDaJanela({ x: 0, y: 0, w: m.w, h: m.h }, proporcaoDaImagem);
  const caixa = { w: largura, h: largura / proporcao };
  const janela = retanguloVisivel(recorte, deslocamento, moldura);
  const arraste = useRef<{ id: number; x: number; y: number } | null>(null);
  const atual = useRef(deslocamento);
  atual.current = deslocamento;

  return (
    <div
      className="moldura"
      role="group"
      aria-label={rotulo}
      tabIndex={0}
      style={{ width: caixa.w, height: caixa.h }}
      onPointerDown={(e) => {
        if (arraste.current) return; /* o segundo dedo (pinça) não faz nada */
        arraste.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const a = arraste.current;
        if (!a || a.id !== e.pointerId) return;
        const novo = arrastarDeslocamento(atual.current, e.clientX - a.x, e.clientY - a.y, caixa, recorte, moldura);
        arraste.current = { id: a.id, x: e.clientX, y: e.clientY };
        atual.current = novo;
        aoMudar(novo);
      }}
      onPointerUp={(e) => {
        if (arraste.current?.id === e.pointerId) arraste.current = null;
      }}
      onPointerCancel={() => {
        arraste.current = null;
      }}
      onKeyDown={(e) => {
        const novo = deslocarPorTecla(deslocamento, e.key);
        if (!novo) return;
        e.preventDefault();
        aoMudar(novo);
      }}
    >
      <Janela src={src} alt={alt} janela={janela} className="moldura__janela" />
      {children}
    </div>
  );
}

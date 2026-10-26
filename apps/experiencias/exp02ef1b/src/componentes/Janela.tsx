import { useState, type CSSProperties, type ReactNode } from "react";
import { ButtonUnv, IconUnv } from "@edu/ui/ds-unoovista";
import { estiloDaJanela } from "../lib/geometria";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Retangulo } from "../lib/tipos";

/**
 * Uma caixa que mostra a `janela` (0–100) de UMA imagem — as duas fotos, a
 * capa, a revelação e a cena inteira saem da mesma panorâmica, recortada por
 * CSS (`estiloDaJanela`). A caixa tem o tamanho que o pai der; quem garante a
 * proporção é o pai (`proporcaoDaJanela`), senão a imagem estica.
 *
 * Falha de carregamento (one-pager §8): o card "CARREGANDO CAPA..." com o
 * ícone de câmera e "TENTAR DE NOVO", que recarrega com outro endereço (o
 * cache do navegador guardaria o erro).
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: o `PostCard.Media`
 * do Unoovista tem o estado de erro, mas só para a imagem INTEIRA; a janela
 * sobre uma imagem maior (recorte por CSS) não existe na seção.
 */
export function Janela({
  src,
  alt,
  janela,
  className,
  style,
  children,
}: {
  src: string;
  alt: string;
  janela: Retangulo;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const [tentativa, setTentativa] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const endereco = tentativa === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}tentativa=${tentativa}`;

  return (
    <div className={["janela", className].filter(Boolean).join(" ")} style={style}>
      {falhou ? (
        <div className="janela__erro" role="status">
          <IconUnv name="camera" size="lg" tone="secondary" />
          <p className="janela__erro-texto">{TEXTOS.erros.carregando}</p>
          <ButtonUnv
            variant="secondary"
            size="md"
            onClick={() => {
              setFalhou(false);
              setTentativa((n) => n + 1);
            }}
          >
            {TEXTOS.erros.tentarDeNovo}
          </ButtonUnv>
        </div>
      ) : (
        <>
          <img
            key={endereco}
            className="janela__imagem"
            src={endereco}
            alt={alt}
            draggable={false}
            style={estiloDaJanela(janela)}
            onError={() => {
              setFalhou(true);
              telemetria.imagem();
            }}
          />
          {children}
        </>
      )}
    </div>
  );
}

import type { CSSProperties } from "react";
import onde from "../../assets/icones/onde.svg";
import quem from "../../assets/icones/quem.svg";
import quando from "../../assets/icones/quando.svg";
import carimboV from "../../assets/icones/carimbo-v.svg";
import carimboX from "../../assets/icones/carimbo-x.svg";
import carimboDuvida from "../../assets/icones/carimbo-duvida.svg";
import seloNao from "../../assets/icones/selo-nao.svg";
import lupa from "../../assets/icones/lupa.svg";
import foto from "../../assets/icones/foto.svg";
import cadeado from "../../assets/icones/cadeado.svg";
import enquanto from "../../assets/blocos/enquanto.svg";
import pegar from "../../assets/blocos/pegar.svg";
import se from "../../assets/blocos/se.svg";
import ok from "../../assets/blocos/ok.svg";
import senao from "../../assets/blocos/senao.svg";
import revisar from "../../assets/blocos/revisar.svg";
import fim from "../../assets/blocos/fim.svg";

/**
 * Os pictogramas da missão (brief de assets, `pic-exp03ef1b-08/09/10`): os
 * três campos da ficha, os três carimbos e o selo NÃO, e os sete blocos da
 * rotina. Desenhos em `src/assets`, com geometria própria para cada um (o
 * círculo, o quadrado e o triângulo dos carimbos não dependem de cor).
 *
 * (b) COMPENSAÇÃO — sem par no DS. As duas seções desenham ícone por LIGADURA
 * do Material Symbols, e nenhuma tem o pin com furo, o carimbo em triângulo
 * ou os blocos da rotina do brief. O desenho é MÁSCARA sobre `currentColor`:
 * a cor sai do token de quem o envolve (o rótulo do bloco, o botão
 * selecionado), nunca do arquivo. Decorativo sempre — quem nomeia é o texto
 * ao lado. Pedido ao `storybook-unooria`: um `Icon` que aceite SVG próprio.
 */
export const ICONES = {
  onde,
  quem,
  quando,
  "carimbo-v": carimboV,
  "carimbo-x": carimboX,
  "carimbo-duvida": carimboDuvida,
  "selo-nao": seloNao,
  lupa,
  foto,
  cadeado,
  enquanto,
  pegar,
  se,
  ok,
  senao,
  revisar,
  fim,
} as const;

export type NomeDoIcone = keyof typeof ICONES;

export function Icone({ nome, tamanho = 20, className }: { nome: NomeDoIcone; tamanho?: number; className?: string }) {
  const estilo = { "--icone": `url("${ICONES[nome]}")`, "--icone-tamanho": `${tamanho}px` } as CSSProperties;
  return <span aria-hidden="true" className={["icone", className].filter(Boolean).join(" ")} style={estilo} />;
}

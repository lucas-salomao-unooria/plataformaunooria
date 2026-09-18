"use client";

import { useEffect, useRef } from "react";
import { iniciarEstrelasDaRolagem } from "./efeitos/estrelas-da-rolagem";
import { iniciarInfinito } from "./efeitos/infinito";
import { iniciarNavegacao } from "./efeitos/navegacao";
import { iniciarProgressoes } from "./efeitos/progressoes";

/**
 * O container do site público, e o lugar onde os cinco efeitos são ligados.
 *
 * Ele EMBRULHA a marcação (que continua sendo renderizada no servidor, como
 * `children`) em vez de ser dono dela: o conteúdo do site é estático, e passá-lo
 * por um componente client mandaria o texto inteiro para o bundle sem ganho
 * nenhum.
 *
 * `js` e `at-opening` nascem aqui, no HTML do servidor — o porquê está em
 * `efeitos/navegacao.ts`.
 *
 * A ORDEM de montagem é a das tags `<script>` do material original: a navegação
 * primeiro (é ela que revela o conteúdo), depois o infinito, o campo de
 * estrelas e as progressões. Ela importa porque `infinito` amostra o logo do
 * cabeçalho e `progressoes` mede a arte já disposta na página.
 *
 * DOIS EFEITOS SAÍRAM na revisão 19 (2026-09-18): `atmosfera` (a poeira em
 * `#ambient-dust`) e `estrelas-de-abertura` (o campo do hero, em
 * `#opening-stars`). A folha da revisão esconde os dois canvas e põe um campo
 * ÚNICO no lugar, e animar canvas com `display:none` é queimar bateria para
 * desenhar o que ninguém vê. **Os módulos ficam no repositório**, e a marcação
 * dos dois canvas também: o que os desligou foi uma decisão de arte, e ela se
 * desfaz tirando uma linha do CSS e devolvendo a chamada aqui.
 */
export function PalcoDoSite({ children }: { children: React.ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;
    const desligar = [
      iniciarNavegacao(elemento),
      iniciarInfinito(),
      iniciarEstrelasDaRolagem(elemento),
      iniciarProgressoes(),
    ];
    return () => desligar.forEach((cancelar) => cancelar());
  }, []);

  return (
    <div className="site-entre-redes js at-opening" ref={raiz}>
      {children}
    </div>
  );
}

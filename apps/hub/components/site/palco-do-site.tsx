"use client";

import { useEffect, useRef } from "react";
import { iniciarAtmosfera } from "./efeitos/atmosfera";
import { iniciarEstrelasDeAbertura } from "./efeitos/estrelas-de-abertura";
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
 * primeiro (é ela que revela o conteúdo), depois o infinito, a atmosfera, as
 * estrelas e as progressões. Ela importa porque `infinito` amostra o logo do
 * cabeçalho e `progressoes` mede a arte já disposta na página.
 */
export function PalcoDoSite({ children }: { children: React.ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;
    const desligar = [
      iniciarNavegacao(elemento),
      iniciarInfinito(),
      iniciarAtmosfera(),
      iniciarEstrelasDeAbertura(),
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

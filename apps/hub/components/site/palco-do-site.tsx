"use client";

import { useEffect, useRef } from "react";
import { iniciarCarrossel } from "./efeitos/carrossel";
import { iniciarEstrelasDaRolagem } from "./efeitos/estrelas-da-rolagem";
import { iniciarImagemAmpliada } from "./efeitos/imagem-ampliada";
import { iniciarInfinito } from "./efeitos/infinito";
import { iniciarNavegacao } from "./efeitos/navegacao";
import { iniciarPaginasDoLivro } from "./efeitos/paginas-do-livro";
import { iniciarProgressoes } from "./efeitos/progressoes";

/**
 * O container do site público, e o lugar onde os efeitos são ligados.
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
 * rodapé e `progressoes` mede a arte já disposta na página.
 *
 * TRÊS EFEITOS ENTRARAM na versão final do material (2026-10-28), depois dos
 * quatro de antes e na ordem dos `<script>` dela: o carrossel das missões, o
 * ajuste da imagem ampliada à tela e o folhear das páginas dos livros. Os dois
 * últimos somam comportamento à janela que o `navegacao.ts` abre, e por isso
 * vêm depois dele.
 *
 * DOIS EFEITOS SAÍRAM na revisão 19 (2026-09-18) e não voltaram: `atmosfera`
 * (a poeira) e `estrelas-de-abertura` (o campo do hero). Na versão final nem
 * os dois `<canvas>` deles estão mais na marcação; os módulos ficam no
 * repositório só como referência do desenho anterior.
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
      iniciarCarrossel(elemento),
      iniciarImagemAmpliada(elemento),
      iniciarPaginasDoLivro(elemento),
    ];
    return () => desligar.forEach((cancelar) => cancelar());
  }, []);

  return (
    <div className="site-entre-redes js at-opening" ref={raiz}>
      {children}
    </div>
  );
}

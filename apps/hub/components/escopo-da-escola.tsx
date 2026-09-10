import { Fragment } from "react";

import { auth } from "@/lib/auth";

/**
 * A fronteira de remontagem da ESCOLA ATIVA.
 *
 * Trocar de escola no cabeçalho (`SeletorDeEscola` → `POST /api/escola-ativa`)
 * termina em `router.refresh()`, e o `refresh()` re-renderiza **só os Server
 * Components**. Ele não remonta um Client Component já montado, não re-executa
 * os `useEffect` dele (as dependências não mudaram), não reinicializa um
 * `useState(propDoServidor)` e não recarrega um `<iframe>`. O resultado medido
 * em 2026-09-09, com um gestor lotado em duas unidades:
 *
 *  - `/admin/usuarios` seguia mostrando as 49 pessoas da escola anterior com o
 *    cabeçalho já dizendo o nome da nova — as 1004 da nova só apareciam com F5;
 *  - `/admin/turmas` seguia com as 27 turmas da outra unidade;
 *  - em `/professor/plano-de-aula` o hub já emitia token de `escola-demo-2` e o
 *    iframe continuava com o de `escola-demo` em memória. Esse é o caso grave:
 *    não é tela velha, é ESCRITA na escola errada, e a RLS não tem como barrar
 *    porque o token é legítimo — só é o da escola de antes.
 *
 * Envolver o miolo da área numa `key` que é a escola ativa resolve os três de
 * uma vez: quando a escola muda, o React desmonta a subárvore inteira e monta
 * outra, com estado zerado, efeitos refeitos e iframe recarregado. É o mesmo
 * mecanismo pelo qual uma lista trocada por outra não herda o estado da
 * anterior.
 *
 * **É do LAYOUT da área, nunca da página** — pela mesma razão da trilha: página
 * nova nasce escopada sem escrever uma linha, e ninguém precisa lembrar. As
 * quatro telas que quebraram eram quatro esquecimentos independentes do mesmo
 * detalhe. Área nova precisa de layout novo, e layout novo envolve o miolo
 * aqui.
 *
 * **Envolve o MIOLO, não o cabeçalho.** O `HeaderPlataforma` fica fora de
 * propósito: ele é quem hospeda o próprio seletor, e remontá-lo tiraria o foco
 * do teclado de quem acabou de trocar de escola pelo campo.
 *
 * `Fragment` e não `<div>`: a árvore de layout do hub distribui altura por flex
 * (`main:has(> .tela-cheia)` em `plataforma.css`), e um elemento a mais no meio
 * quebraria o seletor de filho direto — a barra de rolagem parada das telas de
 * embed voltaria.
 */
export async function EscopoDaEscola({ children }: { children: React.ReactNode }) {
  const session = await auth();
  /* Sem sessão não há escola a escopar (a casca também cobre `/login`), e a
     chave precisa ser estável: `undefined` faria o React cair no índice e a
     fronteira deixaria de existir em silêncio. */
  return <Fragment key={session?.usuario?.escolaId || "sem-escola"}>{children}</Fragment>;
}

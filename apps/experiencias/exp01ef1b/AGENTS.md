# apps/experiencias/exp-04-o-que-a-foto-conta — a missão do 1º ano no mural

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`. Porta de dev
**5183** (`strictPort`; a 5182 é da exp-08), rota do hub `/exp/exp-04-o-que-a-foto-conta`,
módulo da api `apps/api/src/foto-conta/` (`/foto-conta/*` — NÃO `/instanooria/*`,
que pertence à exp-01), produto `entre-redes`, 1º ano EF, unidade 1.

## O que quebra se você não souber

- **O leitor tem 6 anos e está em alfabetização inicial.** Todo texto de
  estudante é CAIXA ALTA, máx. 8 palavras, com pictograma E áudio
  (redundância tripla — não-negociável do handoff). Instrução nova sem par de
  áudio é regressão de acessibilidade, não detalhe.
- **As duas famílias do DS convivem no MESMO bundle e não se misturam.** O mapa
  é por tela ("quem está falando"): E1/E5/E6/erros = casca Unooria
  (`@edu/ui/ds` + `unooria.css` + `fonts/unooria.css`); E2–E4 = clone
  (`@edu/ui/ds-insta` + `instanooria.css` + @fontsource Inter/Grand Hotel).
  Os arquivos espelham a fronteira: `telas-casca.tsx` vs `telas-clone.tsx`,
  `componentes/casca.tsx` vs `componentes/clone.tsx`.
- **A matriz causal do Aha NUNCA entra neste bundle.** O boot recebe o pacote
  SEM `comentarios`; o par escolhido volta na resposta de `POST /publicar`,
  uma linha por vez. Guardar a matriz aqui deixaria a surpresa legível no
  DevTools antes da postagem — é o `factual` do UnooTube desta missão.
- **A cadência do eco é instrumento**: Leo a 1,5s, Sofia a 3,0s, transição 2s
  depois (`CADENCIA_AHA` em `lib/tipos.ts`). Mudar o ritmo muda a medida.
- **O latch (etapa `roda`) é porta-retrato**: `FreezeOverlayFrame` não tem
  botão, link nem scroll, e toque é ignorado sem erro. Quem destrava é o
  professor; quem percebe é o polling de 3s (`ADR-94` — polling, nunca
  WebSocket/SSE). F5 no latch renderiza o latch de novo.
- **Áudio tolera ausência** (`lib/audio.ts`): as locuções profissionais ainda
  não foram gravadas e o código referencia os nomes CANÔNICOS do brief
  (`public/audio/aud_*.mp3`). Não transforme falha de play em erro de tela.
- **As fotos são placeholders vetoriais** (`public/fotos/*.svg`) com os ids
  canônicos (`gato`, `corrida`, `lanche`, `par_a`, `par_b`). As fotografias
  WebP da Curadoria os substituem mantendo id e o caminho muda em UM lugar
  (`urlDaFoto` em `componentes/clone.tsx`).
- **A versão vive em TRÊS lugares** (`experiencia.json`, `package.json`,
  `lib/versao.ts`) e `versao.test.ts` cobra os três.
- **Sem nota, sem ranking, sem "resposta certa" visível**: a reflexão final é
  decidida no SERVIDOR (`conclui: boolean`); o Globo é retry formativo sem
  vermelho punitivo. Não escreva gabarito em lugar nenhum daqui.

## Pedidos abertos no storybook-unooria

- Botão de repetição de áudio 48×48 (as duas famílias) — hoje é composição
  local marcada em `componentes/casca.tsx` e `componentes/clone.tsx`.

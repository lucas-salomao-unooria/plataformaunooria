# apps/experiencias/exp03ef1b — Nina e a Notícia que Desapareceu

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp03ef1b` · 3EF · unidade 1 · `entre-redes` · SEM `viewport` (desktop 1024×768, o hub não põe casca de aparelho) · `permissoes: ["forms"]` · versão **0.2.0** | `:5189` (`strictPort`), hub `/exp/exp03ef1b` ou `/dev-embed?src=http://localhost:5189` | DS HÍBRIDO (ADR-197): `@edu/ui/ds-unoojornal` (o jornal) + `@edu/ui/ds` (a mecânica) | `apps/api/src/nina-noticia` ↔ `/nina-noticia/*` (contrato em `contrato-de-rotas.ts`, índice `ROTAS`) | `scripts/e2e/estudante/17-nina-noticia.mjs` (dois contextos) |

## O DS híbrido: a separação é POR ARQUIVO

A única experiência com duas seções na mesma tela por decisão registrada
(ADR-197). Para a mistura não virar vazamento, cada pasta importa UMA ponte:

| Pasta | Ponte | O que mora lá |
|---|---|---|
| `src/app/jornal/` | SÓ `@edu/ui/ds-unoojornal` | topo (`LogoUjn`, `TagUjn`), reportagens (`ArticleCard`), foto ampliada (`ModalUjn` + `Figure` + `GalleryImage`), erro de mídia (`EmptyStateUjn`), pastilhas (`FilterPill`), botões e selos do jornal, `Toast` sem sinal, ferramentas do caso, Painel da Investigação |
| `src/app/mecanica/` | SÓ `@edu/ui/ds` | Nina (`SpeechBubble`, `Avatar`), caixa da escolha e etiquetas (`PuzzleTrack`/`PuzzleBlock`), carimbos (`Card` + `Button`), ficha de campos (uma `PuzzleTrack` de UMA vaga por campo), esteira, quadro central, espera/pausa, 403 (`AlertBox`) |
| `src/app/telas/` | NENHUMA | compõe peças das duas pastas; não importa o DS direto |
| `src/app/comum/` | NENHUMA | pictogramas por máscara e as ilustrações locais |

Tela nova importando `@edu/ui/*` direto quebra a regra: ponha a peça na pasta
da seção dela. **Os tokens seguem a pasta**: `--ujn-*` no CSS do jornal,
`--unooria-*` no da mecânica (`estilos/globals.css`, seções separadas).

## O passo manda na tela

A api devolve o passo JÁ reconciliado com a etapa da turma. A tela lê
`sessao.passo`; a única coisa local é a TELA SEGURADA (`regras.ts#telaVisivel`):
o servidor já andou (o 3º selo, a ficha aberta, a rotina válida) e a criança
ainda não tocou "Avançar"/"Ir para o Caso Novo". Rodada nova solta a segurada.
O polling de 3 s (`GET gate`) roda em TODO passo até concluir: a pausa da
professora pode chegar a qualquer momento; só a pausa não relê a sessão.

Espelho declarado da api em `lib/tipos.ts` e `lib/regras.ts#passoEfetivo`;
`lib/espelho.test.ts` LÊ `apps/api/src/nina-noticia/*` e reprova divergência
nas listas, nos tempos e nos campos dos schemas que a tela lê.

## O que o bundle NÃO sabe (regra 3)

O certo dos carimbos K1–K6, a sequência da rotina e a regra do reparo. Os
blocos chegam embaralhados com ids opacos, e a tela NUNCA reordena; o recuo da
esteira (`RECUO_DA_VAGA`) é o desenho, igual para todos. A tela do reparo não
julga onde está o Pátio — avalia o servidor, só no Concluir. Conferência do
`dist/`: `grep -l -F -e "certo:" -e "SEQUENCIA_CERTA"` vazio. "aposta" aparece
no bundle só como NOME INTERNO do passo; na tela é "escolha" (spec §7.1, com
teste em `textos.test.ts`).

## Decisões que divergem do protótipo

- **Nenhuma pastilha nasce escolhida no filtro** (o protótipo abria com Onde):
  acertar o campo na 1ª busca é a evidência da EF15CO08.
- **Sem "Ir para o Filtro" depois de travar, sem "[Demo: Liberar Inspeção]",
  sem "Simular Erro"/"Simular Sem Parada"**: quem libera é a professora.
- **Toque E arraste** (ADR-201; a spec §0.2 dizia só toque): o `PuzzleBlock`
  `selected` + a vaga acionável (`onSlotActivate`) — toca a peça, toca a vaga;
  toca a encaixada para devolver; na caixa da escolha o toque vai direto ao 1º
  nicho vazio. POR CIMA disso, `comum/arrastar.ts` (`useArrastar`): a zona é o
  `data-soltar` do contêiner (`bandeja`, `caixa`, `esteira`, `campo:<campo>`) e
  a vaga é a posição da `.unooria-puzzle-track__slot` no DOM. Só arrasta depois
  de 8 px, e engole o clique que o navegador dispara no fim do arraste — sem
  isso, soltar uma peça encaixada a devolveria à bandeja.
- **Sem Desafio Extra** (ADR-201): o fim é só o Painel da Investigação.
- **Imagem**: a `url` da api, ou a ilustração de `src/assets/cenas/`; a foto
  que não baixa mostra o erro de mídia, e na 2ª falha seguida a tela segue com
  a ilustração (a criança nunca fica presa).

## Compensações locais — marcadas `(b) COMPENSAÇÃO — sem par no DS`

Cada uma no comentário do componente e no CSS; pedido ao `storybook-unooria`
entre parênteses:

- `comum/icone.tsx` — pictograma SVG por máscara em `currentColor` (as duas
  seções só têm ícone de ligadura; pedido: `Icon` com SVG próprio). Pin no
  rodapé do `ArticleCard` pela mesma máscara, no CSS.
- `jornal/reportagem.tsx` — selo posicionado sobre o rodapé do `ArticleCard`
  e a moldura forte/tracejada (pedido: `footer` no `ArticleCard`).
- `jornal/quadro.tsx`, `jornal/ferramentas.tsx` — o quadro do jornal (fio e
  recuo); `jornal/painel.tsx` — a coluna do Painel da Investigação.
- `comum/arrastar.ts` — o ARRASTE por cima do toque (o DS só toca; pedido:
  arraste no `PuzzleBlock`/`PuzzleTrack`), com as classes `.arraste-*` no CSS.
- `mecanica/meta.tsx` — as molduras da Meta de Nina; `mecanica/figura.tsx` —
  a figura dos cartões; `mecanica/caixa.tsx#VidroDaEscolha` — o vidro sobre a
  caixa travada; `mecanica/espera.tsx` — a faixa fixa da espera/pausa.
- CSS: alvo de 64px (`.alvo-64`, Button/ButtonUjn param em 52px e o
  `FilterPill` em 36px), `Card` sem o `max-width: 398px`, a calha da caixa com
  os três nichos lado a lado, o recuo da esteira, a altura da foto do telão.

## Vitrine (só desenvolvimento)

`vitrine.html` + `src/vitrine/` desenham cada estado com dados de exemplo, sem
api nem hub: `pnpm exec vite --port 5244` e `/vitrine.html?q=<nome do print>`.
O `vite build` usa só o `index.html`: a vitrine nunca entra no `dist/`.

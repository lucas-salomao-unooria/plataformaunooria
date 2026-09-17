# apps/hub/components/site — o site público ENTRE REDES (ADR-107)

Complementa o `AGENTS.md` de `apps/hub/components`, que vence em conflito.

## Esta pasta é um PORTE, e a fidelidade é o requisito

O material chegou pronto, aprovado e fora deste repositório
(`Unooria_Entre_Redes_site_completo`: HTML, CSS e cinco arquivos de JS servidos
por um Worker). O que ele pede daqui não é melhoria — é **continuar sendo o que
é**, dentro do Next.

Por isso, nesta pasta e só nela:

- **`site.css` é cópia integral.** Uma única regra foi acrescentada, marcada no
  arquivo: `.site-entre-redes{font-family:…}`. O `<body>` do hub traz
  `font-family` INLINE (layout raiz), e estilo inline vence folha — sem ela o
  site sai inteiro em system-ui, com o desenho intacto. O sintoma é "a
  tipografia está diferente", sem nada quebrado para procurar.
- **A marcação de `site-entre-redes.tsx` é 1:1** com o HTML de origem: mesma
  árvore, mesmas classes, mesmos ids, mesma ordem. O CSS casa por classe e por
  id; trocar um `div` por um `section`, agrupar irmãos ou "limpar" uma classe
  aparece como defeito de layout.
- **`efeitos/*.ts` é porte literal** dos cinco scripts. Eles não leem sessão, não
  chamam a api e não conhecem o DS. O que mudou: viraram funções que devolvem o
  cancelamento, e todo listener nasce preso a um `AbortController` — a página
  desmonta quando alguém vai para `/login`, e `requestAnimationFrame` pendurado
  em canvas fora do DOM é vazamento.

**O DS não se aplica aqui, e isso é decisão, não esquecimento.** O design system
vale da porta do login para dentro; esta é a superfície de marketing, com
tipografia, paleta e movimento próprios. A landing ANTERIOR era o contrário —
feita de DS (ADR-40) — e continua viva em `/landing-anterior`.

## Duas coisas mudaram de dono, e é bom saber quais

**`js` e `at-opening`** moravam em `<html>`/`<body>`; aqui nascem no container do
site, renderizadas pelo servidor. O CSS as usa como ancestral (`.js .reveal`,
`.at-opening .floating-cta`), então o efeito é o mesmo — mas postas num
`useEffect` elas só chegariam depois da hidratação, e `.js .reveal` começa em
`opacity:0`: o texto apareceria inteiro e SUMIRIA quando a classe entrasse.
`locked` continua no `<body>`, onde o seletor é de elemento e o que ele trava é
a rolagem do documento.

## O que o porte prova, e como provar de novo

A conferência não é impressão: o site de origem sobe com
`node scripts/preview.mjs --port 4173` (na pasta do material) e as duas telas se
comparam pelas MEDIDAS. Em 390px e em 1440px, no dia do porte:

| | origem | hub |
|---|---|---|
| altura do documento (390 / 1440) | 20286 / 21230 | 20286 / 21230 |
| topo de cada uma das 13 seções | — | **idêntico ao pixel** |
| `.reveal`, `<img>`, `main > section` | 31 / 8 / 13 | 31 / 8 / 13 |

Screenshot lado a lado não basta para o infinito de estrelas: ele é animação
viva, e dois instantes diferentes parecem duas telas diferentes. O que compara é
a medida.

## O formulário é a ÚNICA parte que não é porte

`formulario-de-cadastro.tsx` tem a marcação do original e destino novo: posta em
`/api/cadastro-de-interesse` (rota do hub), que repassa à api, que grava no
Postgres. No bundle de origem ele escrevia num SQLite próprio (Cloudflare D1),
com uma página de listagem protegida por token no fragmento da URL — um banco,
um runtime e um modelo de autorização fora da plataforma. Quem lê os cadastros
hoje é o `admin`, em `/unooria/prospeccao`.

**A frase do consentimento é contrato com a api.** Ela aparece aqui como rótulo
da caixa e lá como `TEXTO_DO_CONSENTIMENTO` (`api/src/prospeccao/`), que é o que
o banco guarda. Mudou uma, muda a outra no mesmo commit — senão o banco registra
um aceite que ninguém deu.

## Os assets moram em `public/site/`

`site/assets/*` (webp, png e as três Manrope). Os `src` do JSX e os `url()` das
`@font-face` apontam para lá, e é a única reescrita de caminho do porte.

**`<img>` cru, nunca `next/image`, na marca do cabeçalho**: `efeitos/infinito.ts`
lê a imagem PIXEL A PIXEL para formar o infinito de estrelas. O `next/image`
serviria outro arquivo, em outro formato e outro tamanho, e o contorno amostrado
deixaria de ser o da marca — o `catch` do módulo esconderia os palcos e a seção
das missões ficaria sem a peça central, sem erro nenhum na tela.

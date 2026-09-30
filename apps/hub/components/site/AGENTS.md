# apps/hub/components/site — o site público ENTRE REDES (ADR-107)

Complementa o `AGENTS.md` de `apps/hub/components`, que vence em conflito.

## Esta pasta é um PORTE, e a fidelidade é o requisito

O material chegou pronto, aprovado e fora deste repositório
(`Unooria_Entre_Redes_site_completo`: HTML, CSS e cinco arquivos de JS servidos
por um Worker). O que ele pede daqui não é melhoria — é **continuar sendo o que
é**, dentro do Next.

Por isso, nesta pasta e só nela:

- **`site.css` é cópia integral, mais três acréscimos, cada um marcado no
  arquivo**: a linha da tipografia (`.site-entre-redes{font-family:…}`), o bloco
  da janela do cadastro e o bloco da Revisão 19. O da tipografia existe porque o
  `<body>` do hub traz `font-family` INLINE (layout raiz), e estilo inline vence
  folha — sem ela o site sai inteiro em system-ui, com o desenho intacto. O
  sintoma é "a tipografia está diferente", sem nada quebrado para procurar.
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

## A REVISÃO 19 (2026-09-18): como um pacote de revisão chega

O material volta de tempos em tempos revisado, e o segundo pacote
(`Unooria_Entre_Redes_Revisao_19_Ajustes`, em `~/Downloads`) mostrou o formato:

| Arquivo | O que é |
|---|---|
| `alteracoes.json` | o MAPA das trocas de texto: `before`/`after`/`occurrences` |
| `index.html` | uma PRÉVIA — e ela é uma exportação **deste site**, com o CSS novo embutido |
| `assets/*.png` | a arte trocada, nas mesmas dimensões da anterior |
| `LEIA-ME.txt` | o resumo em prosa |

**O `alteracoes.json` não é a lista completa.** Ele cobriu os ajustes de
TEXTO; o pacote trazia também um redesenho do hero e a troca do campo de
estrelas, que só apareceram comparando o **CSS computado** da prévia com o
nosso. O texto batia 100% e a tela estava diferente — foi o dono do produto que
viu ("o primeiro título está centralizado e o que você fez não está").

**A receita, então, é comparar as duas coisas.** Abra a prévia (`file://`) e o
site local lado a lado e compare:

1. **o texto**: a lista de blocos visíveis dos dois `<main>` — precisa dar
   diferença ZERO;
2. **o CSS**: percorra `document.styleSheets` nos dois, ignore `@font-face` (a
   prévia embute as fontes em base64 e o diff fica ilegível) e compare por
   seletor. As regras que a revisão acrescenta vêm **prefixadas com
   `.site-entre-redes`** — é assim que elas vencem as de cima sem editar nada;
3. **as medidas**: altura do documento e topo de cada seção (ver abaixo).

Ruído conhecido nessa comparação de CSS, que NÃO é diferença: `background: none`
serializado como `background: 0px 0px`, e as regras do reset do Tailwind que só
o hub carrega (`.container{width:100%}`, `dialog{padding:0}`,
`summary{display:list-item}`).

## O que o porte prova, e como provar de novo

A conferência não é impressão: o site de origem sobe com
`node scripts/preview.mjs --port 4173` (na pasta do material) e as duas telas se
comparam pelas MEDIDAS, em 390px e em 1440px:

- a **altura do documento**, igual nas duas;
- o **topo de cada seção** e o do rodapé, **idêntico ao pixel**;
- as contagens de `.reveal`, `<img>` e `main > section`, iguais.

Os números não moram aqui: mudam a cada pacote (o hero passou a ocupar `100svh`,
e a altura do documento mudou com ele), e numeral congelado vira afirmação
falsa. O que não muda é o método: **a medida é a prova, e ela se refaz a cada
pacote**, lida do site de origem naquele dia.

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

### E desde 2026-09-17 ele abre numa JANELA, não no corpo da página

Pedido do dono do produto. Os três convites do site — o do cabeçalho
(`.floating-cta`), o do fechamento (`#contato`) e o da seção `#cadastro` — dizem
**"Quero conhecer a solução"** e abrem o mesmo `<dialog id="cadastro-dialog">`.
O que saber antes de mexer:

- **Quem ABRE a janela é o `efeitos/navegacao.ts`; quem a FECHA no sucesso é o
  componente.** Os outros dois diálogos do site já são operados por lá, e é de
  lá que vêm o Esc, o clique fora, o `[data-close]` e o `locked` do `<body>`.
  Duplicar isso no React daria duas fontes para o mesmo comportamento.
- **`[data-close]` no PLURAL.** A janela tem DUAS saídas além do Esc: o `×`
  discreto do topo e o "Cancelar" ao lado de "Enviar". O `navegacao.ts` ligava
  só o primeiro (`querySelector`), e o Cancelar era um botão que não fazia nada
  — sem erro, sem nada no console.
- **O id da janela, o atributo que a abre e o rótulo dos convites são
  CONSTANTES exportadas** pelo componente, porque são usados em três arquivos.
  Escritos à mão em cada um, o primeiro erro de digitação vira um botão morto.
- **DOIS estados, não um com três valores**: `envio` (do formulário) e
  `confirmado` (da página). Com um só, reabrir a janela depois de um envio —
  coisa que os outros dois convites permitem — trazia o botão travado em
  "enviado", sem nada explicando.
- **Enviar FECHA a janela e deixa a confirmação na página**, no lugar onde o
  convite da seção estava; se ela ficou fora da tela, o componente rola até lá.
  Fechar sem deixar rastro pareceria "sumiu e não aconteceu nada". **No ERRO a
  janela fica aberta**: é ali que a pessoa corrige o campo, e fechar levaria
  embora o que ela digitou.
- **O CSS da janela reaproveita o do material** (as medidas do `.index-dialog`,
  a moldura da regra `dialog`, o `.button.outline` do Cancelar). Está num bloco
  marcado no `site.css` — o segundo dos três acréscimos à folha (o primeiro é a
  linha da tipografia; o terceiro, a Revisão 19).
- **Empilhado, "Enviar" fica EM CIMA** (`order:-1` abaixo de 600px). Com o
  Cancelar no topo, o polegar encontra primeiro o botão que descarta o que a
  pessoa acabou de digitar.

**A frase do consentimento é contrato com a api.** Ela aparece aqui como rótulo
da caixa e lá como `TEXTO_DO_CONSENTIMENTO` (`api/src/prospeccao/`), que é o que
o banco guarda. Mudou uma, muda a outra no mesmo commit — senão o banco registra
um aceite que ninguém deu.

## O campo de estrelas: um, e não três (revisão 19)

`efeitos/estrelas-da-rolagem.ts` desenha `#unooria-scroll-stars` — um canvas
fixo, criado pelo próprio efeito (é o único que não tem marcação portada), que
cobre a janela e responde à rolagem e ao ponteiro.

**Ele substituiu dois.** `atmosfera.ts` (a poeira, em `#ambient-dust`) e
`estrelas-de-abertura.ts` (o campo do hero, em `#opening-stars`) continuam no
repositório e os dois `<canvas>` continuam na marcação — **mas a folha os
esconde e o `palco-do-site.tsx` não os monta**. Animar canvas com
`display:none` é queimar bateria para desenhar o que ninguém vê.

Desfazer é tirar a linha do CSS e devolver as duas chamadas ao palco. Se um dia
alguém tirar só a linha do CSS, os canvas aparecem VAZIOS — e é por isso que a
suíte `publico/01-site` cobra os dois estados: o nó existe **e** está desligado.

## Os assets moram em `public/site/`

`site/assets/*` (webp, png e as três Manrope). Os `src` do JSX e os `url()` das
`@font-face` apontam para lá, e é a única reescrita de caminho do porte.

**Arte que chega depois do porte ganha nome descritivo e vira webp.** A jornada
dos Anos Iniciais veio na revisão 19 como PNG de 1,7 MB; entrou como
`jornada-anos-iniciais.webp` (204 KB, `cwebp -q 90`), abaixo das outras artes
(230-238 KB), e a anterior saiu do repositório. Os nomes em hash são do
pipeline de origem — não vale imitá-los para um arquivo que já não vem de lá.

**`<img>` cru, nunca `next/image`, na marca do cabeçalho**: `efeitos/infinito.ts`
lê a imagem PIXEL A PIXEL para formar o infinito de estrelas. O `next/image`
serviria outro arquivo, em outro formato e outro tamanho, e o contorno amostrado
deixaria de ser o da marca — o `catch` do módulo esconderia os palcos e a seção
das missões ficaria sem a peça central, sem erro nenhum na tela.

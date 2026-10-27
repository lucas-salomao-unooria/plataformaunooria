# apps/experiencias — bundles Vite estáticos

Complementa o `AGENTS.md` da raiz. Uma experiência NUNCA vira serviço no Cloud
Run: o build gera `dist/` 100% estático, publicado em
`gs://{contrato}-exp/{expId}/{versao}/`.

## Os dois contratos que não moram aqui

Valem para o sdk, para o hub e para a api juntos, então vivem em `docs/regras/`
e chegam sozinhos pelas pontes de cada ferramenta (ADR-102):

- [`docs/regras/bridge-postmessage.md`](../../docs/regras/bridge-postmessage.md)
  — o `postMessage` hub ⇄ experiência, e o Clarity dentro do iframe
- [`docs/regras/manifesto-de-experiencias.md`](../../docs/regras/manifesto-de-experiencias.md)
  — o manifesto, a versão, o que o deploy faz e os sourcemaps

## Como criar uma experiência nova

0. `pnpm worktree criar <código> --fatia exp/<código>,…` — uma frente por
   experiência. O **código** é o da ADR-110: missão da trilha é
   `exp` + ano (01–09 EF, 01–03 EM) + etapa + unidade + `b` (`exp06ef3b` = 6º ano,
   unidade 3); o que não é missão é `app-NN-nome`. O código de missão NÃO se
   escolhe — ele SAI da série e da unidade, e `apps/api/tests/codigo-da-experiencia.spec.ts`
   reprova o manifesto que discordar dele.
1. `pnpm new:exp <código>` (copia `_template`, ajusta nomes e já preenche
   `series`/`unidade` a partir do código). O template
   nasce com a **fiação inteira** — manifesto completo, handshake em
   `bootstrap.tsx`, `lib/{api,telemetria,tipos,textos}.ts`, folhas da seção
   `unooria`, `versao.test.ts` e `vitest` — e **sem componente de interface**,
   de propósito (`_template/AGENTS.md` diz o que trocar primeiro).
2. Implementar em `src/App.tsx`+; usar SOMENTE a SDK para auth/api/telemetria e
   SOMENTE o `@unooria/design-system` para interface — a seção do clone que a
   experiência imita (`unoovista`, `instanooria`, `unootube`, `chatgpt`, `unooriaai`, `whatsappmobile`, `unoochat`; a
   `tiktooria` já está no DS, mas `packages/ui` ainda não tem ponte para ela)
   pela ponte em `packages/ui`. Falta componente? Ele nasce no repo
   `storybook-unooria` e chega por versão nova, não como arquivo local.
3. Declarar capabilities no `experiencia.json` (`telemetria`, `progresso`,
   `ia`, `avaliacao`, `tempo-real`) — o hub e a api usam isso. **E `produto`**
   (ADR-87), que é o que a põe no painel da Unooria: depois de semear, confirme
   que ela aparece em `/unooria/recursos/<produto>`. Sem o campo ela funciona e
   fica invisível para quem liga e desliga a rede — falha muda.
4. `verbo`/`objeto` de telemetria: documentar no README da experiência.
5. Build gera `dist/` 100% estático. Testar embedado: rota `/dev-embed` do hub.
6. **Uma suíte de ponta a ponta**, e ela vai pelo PAPEL de quem usa, não pelo
   número da experiência (ADR-51): missão de estudante entra em
   `scripts/e2e/estudante/NN-slug.mjs`; ferramenta de professor, em
   `scripts/e2e/professor/`. Se a experiência é conduzida pelo relógio da turma,
   a suíte sobe DOIS contextos e mora no papel do protagonista — a da exp08ef1b é
   `estudante/02-instanooria.mjs`, ainda que metade dos prints seja do docente.
   Cada `registrar()` escreve `titulo`/`mostra`/`prova`: é deles que saem o
   slide do deck e a legenda do vídeo.

## Toda experiência é React 19, e a divergência só aparece no CI

O `@unooria/design-system` é compilado contra os tipos do **React 19**. Uma
experiência em React 18 resolve `@types/react@18` para si e vê a cópia 19 chegando
pelo DS: o `tsc` então recusa QUALQUER componente do pacote com
`TS2786: 'Button' cannot be used as a JSX component` — e a pista real
(`Type 'bigint' is not assignable to type 'ReactNode'`) está três linhas abaixo,
numa mensagem aninhada que o resumo do turbo não mostra.

**O sintoma é de ambiente, não de código: passa na máquina e falha no CI.** O
`node_modules` local cresceu por instalações incrementais e mantém uma resolução;
o runner faz `--frozen-lockfile` do zero e resolve outra. A exp01ef1b foi a única
que nasceu em 18, porque o `_template` estava em 18. Toda experiência e o template
ficam em `^19.2.0` juntos, e é assim que tem de continuar: **o template é a fonte de
toda experiência nova**, e uma divergência ali reaparece na próxima que alguém
criar. Pelo mesmo motivo o template traz o DS, o `@edu/ui` e a fiação da exp08ef4b
(ADR-106): sem eles, cada missão nova refazia à mão o bootstrap, a telemetria e o
teste de versão.

Mudou dependência de uma experiência? O bundle mudou: **sobe a versão nos três
lugares** e commita o `pnpm-lock.yaml` junto com o `package.json`. **Subiu o
DS? Sobem TODAS as publicáveis**, mesmo a que saiu idêntica (ADR-187, a regra
em `docs/regras/design-system.md`): a versão de cada missão diz o DS dela.

## Design System nas experiências

A seção do clone entra pela ponte de `packages/ui` — nunca o `styles.css`
consolidado, que arrasta os tokens da plataforma para dentro do disfarce. **A
folha de fonte é uma linha SEPARADA e obrigatória** (as folhas de componente não
declaram `@font-face`); numa marca de clone, esquecê-la cai
no fallback — feio, mas não quebra.

**A linha que separa as seções é a REVELAÇÃO, não o arquivo.** O critério é
"quem está falando?", nunca "é depois no tempo?". Na backup-exp04ef1b: feed, cromo,
playlists, canal, o toast e o diálogo de limite falam de dentro da ficção
(`ds-unootube`); ranking, os dois diálogos da missão, "Concluir missão" e a TELA
DE ENTRADA falam pela escola (`ds`). A entrada é a única ANTES do feed e não é
exceção: na tela de entrada quem fala é a escola, e não há disfarce a proteger
porque a criança ainda não viu um Short. O disfarce começa no toque em "Começar missão".

**Tema**: a seção do clone lê `data-uni-theme` na raiz; a da plataforma recebe
`theme` por PROP. Quem troca escreve nos dois (`backup-exp04ef1b/src/lib/tema.ts`), senão
o estudante escolhe escuro no feed e o ranking volta branco.

**O idioma do disfarce: o nome do app real, em português.** `Shorts`, `Stories`,
`Feed`, `Playlists`, `Ranking` FICAM dentro do clone — são os nomes que o
YouTube e o Instagram usam nas versões brasileiras deles, e traduzi-los quebra a
fidelidade que a experiência está medindo. **Fora do clone, tudo é pt-BR** (a
regra completa, com as três zonas e a lista de anglicismos que ficam por
decisão, está em "O idioma da interface" no `AGENTS.md` da raiz — ADR-91).

Duas armadilhas de experiência, das quais uma já cobrou:

- **Rótulo visível que tem espelho na api muda nos DOIS.** `ROTULO_PASSO` de
  `exp02em1b-v0/src/lib/textos.ts` espelha `apps/api/src/unoogpt/regras/passos.ts`.
  Quando o `Briefing` virou `A missão`, mudar só a experiência faria a trilha do
  estudante divergir do que a api devolve — e o typecheck não vê.
- **A versão vive em TRÊS lugares, não dois.** Mudou texto visível? Sobe
  `public/experiencia.json`, `package.json` **e** o `EXP_VERSION` do código, que mora
  em `src/lib/versao.ts` ou em `src/lib/tipos.ts`, conforme a experiência
  (`grep -rn "EXP_VERSION =" src`). O `src/versao.test.ts` cobra os três — foi ele
  que pegou o esquecimento na troca de terminologia, e a ADR-84 conta o que o
  terceiro lugar esquecido custou. **A exceção é a app-70**: o `EXP_VERSION` dela está
  em `src/main.ts` e ela não tem `versao.test.ts`, então nada cobra o terceiro
  lugar — confira à mão.

Detalhes de mecânica (CSS, frames, compensações) em `packages/ui/AGENTS.md`.
O específico de cada experiência está no `AGENTS.md` da pasta dela.

## app-70: `public/jogo/` é zona congelada

JS clássico com globais compartilhados e `three.min.js` vendorizado. É um instrumento com distâncias e tempos calibrados, e o compilador
não tem como saber que uma refatoração mudou a medida. Está nos `ignores` do
ESLint; o shim (`src/`, TS strict) é a única porta: `window.VILA`. A rede que
substitui o `tsc` ali é a suíte de ponta a ponta (`scripts/e2e/estudante/05-vila-do-lume.mjs`).

## Barra de rolagem: `ScrollBar` do DS só nas telas da seção `unooria`

O hub rola com o `<ScrollBar>` do design system (ADR-75), e ele é da seção
`unooria`. A regra das duas famílias decide o resto: **em tela da seção `unooria` o
contêiner que rola pode ser o `ScrollBar`; dentro de um clone ele NÃO entra** — uma
barra com o token da plataforma dentro do Unoovista é do mesmo tipo de vazamento
que um `Button` institucional no feed. Hoje o usam a redação inteira da exp04ef1b e
a casca da exp05ef1b (`telas-da-escola.tsx`); o clone dela (`telas-do-clone.tsx`)
não importa o componente.

No clone, e nas experiências que não adotaram o `ScrollBar`, a barra continua sendo
a do SISTEMA OPERACIONAL, com `overflow-y: auto` no contêiner que rola. O que muda
por sistema fica como está: no macOS com trackpad ela some sozinha, no Windows e no
ChromeOS é permanente.

**Esconder a barra continua permitido, e é decisão de FIDELIDADE.** As faixas que
imitam um app sem barra (`.sem-scrollbar` da exp08ef1b, `.feed-scroll` da backup-exp04ef1b)
usam `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`. Se você
esconder uma barra, diga no CSS QUAL app imitado não a tem — sem essa linha, a
próxima pessoa lê como defeito e "conserta".

Se um dia a seção do clone publicar a própria barra, ela entra por aqui como
qualquer outro componente: pela ponte, na seção certa.

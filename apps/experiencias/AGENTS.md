# apps/experiencias — bundles Vite estáticos

Complementa o `AGENTS.md` da raiz. Uma experiência NUNCA vira serviço no Cloud
Run: o build gera `dist/` 100% estático, publicado em
`gs://{contrato}-exp/{expId}/{versao}/`.

## postMessage hub ⇄ experiência (`packages/sdk/src/bridge.ts`)
```
exp → hub : { type: "exp:ready", protocolVersion: 2 }
hub → exp : { type: "hub:init", token, estudante:{id,nome,serie,turmaId,escolaId}, config, apiUrl }
exp → hub : { type: "exp:concluir", payload:{ score?, dados? } }
exp → hub : { type: "exp:token-expirando" }   → hub responde { type:"hub:token", token }
exp → hub : { type: "exp:estado", estado:{...} }   → p/ "chrome" opcional do hub (aditivo)
hub → exp : { type: "hub:pause" | "hub:resume" }   → emitidos por visibilidade/foco da página
```
O `?hubOrigin=` que o hub põe na URL do iframe é ENTRADA NÃO CONFIÁVEL: o bundle
é público, então quem embeda a experiência num iframe próprio escolheria, por
aquele parâmetro, de quem ela aceita o `hub:init` e para onde vai tudo o que sai
depois. `normalizarHubOrigin()` (bridge.ts) reduz a origem canônica, recusa
esquema fora de http(s), credencial e origem opaca, exige hub em https quando a
experiência está em https, e confere contra `location.ancestorOrigins[0]` — a
origem REAL de quem embedou, que VENCE a query string (ADR-46). Sintoma novo:
"hubOrigin não é quem embedou" onde antes o handshake só expirava em 8s.

O `blur` da janela do hub NÃO é sempre o estudante saindo: clicar dentro do iframe
move o foco para a experiência e dispara `blur` no documento de cima — e o
`focus` correspondente não volta enquanto ele continuar ali, então um
`hub:pause` ali é DEFINITIVO (o vídeo da exp-02 parava no 1º toque em "Salvar").
Quando o foco foi para a nossa experiência, `document.activeElement` é o próprio
`<iframe>`; o `ExpFrame` não emite nada nesse caso.
Versione com `protocolVersion` (hoje **2**; o major é verificado nos DOIS lados
e incompatível falha alto). Toda mensagem pós-init é validada com Zod nos dois
lados; inválida é descartada com aviso. Mudança ADITIVA de mensagem pós-init não
pede bump; mudar a FORMA do `hub:init` pede. **Rollback só funciona entre versões
do mesmo major** — bundle atrás do protocolo tem de ser republicado, não
revertido.


## Manifesto de experiências (tabela `experiencias` na api)
O CI, ao publicar `gs://{contrato}-exp/{expId}/{versao}/`, faz upsert
(`PUT /experiencias/:expId`, admin-contrato) lendo o `public/experiencia.json`
da experiência (`id, nome, versao, series, capabilities, viewport?, publico?`).
O hub monta a URL do iframe com `versaoAtiva`; rollback = trocar `versaoAtiva`
(`node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao x.y.z`).
`viewport` presente ⇒ o hub embeda dentro do `DispositivoFrame` (casca de
aparelho com escala; exp-01 é 375×812, exp-02 não tem viewport porque foi
desenhada para desktop). SEM linha na tabela, o `viewport` é lido do
`experiencia.json` servido ao lado do index do bundle — não só em dev: uma
stack com a tabela vazia (compose local, ambiente novo antes do 1º publish do
CI) servia o Instanooria esticado na janela em vez do aparelho. Essa leitura é
server-side (o público `NEXT_PUBLIC_CDN_EXP_URL` é o endereço do BROWSER), então
em container use `EXP_INTERNAL_HOST` — que troca só o HOST e PRESERVA a porta,
porque em dev cada exp tem um dev server numa porta diferente e um
`EXP_INTERNAL_URL` fixo faria as três lerem o manifesto de uma só (o UnooTube,
sem `viewport`, apareceria dentro do aparelho da Instanooria). `EXP_INTERNAL_URL`
continua valendo para quando há UMA origem de bundles (o CDN, em produção).
Os dev servers das exps declaram `allowedHosts: ["host.docker.internal"]`: o
Vite 5.4+ recusa `Host` que não conheça, e sem isso o hub em container não lê o
manifesto e a experiência aparece esticada na janela.
`permissoes` (aditivo) lista o que o IFRAME daquela experiência precisa — hoje
`pointer-lock` e `forms`, que o `ExpFrame` traduz nos tokens
`allow-pointer-lock` e `allow-forms`. **`forms` custou um bug inteiro para ser
descoberto**: o `Composer` do DS é um `<form>`, e sem o token o navegador BLOQUEIA
o submit — o estudante da exp-03 digitava a pergunta, apertava Enter e nada
acontecia. O sintoma engana porque a conversa parece viva (a fala de abertura do
agente já está na tela) e o único rastro é um aviso de console sobre "form's
frame is sandboxed". Typecheck, lint e a primeira versão do smoke passaram por
cima disso.
Vazio (o default) = nenhuma, que é o que toda experiência tinha antes. É POR
EXPERIÊNCIA de propósito: prender o ponteiro do estudante é capacidade de quem
declarou, não default do frame. Medido em `scripts/probe-pointerlock.mjs`: num
iframe com sandbox, sem o token o `requestPointerLock()` morre com `SecurityError`
e com ele funciona — e o Chromium do Playwright não concede pointer lock nem no
topo da página, então essa verificação exige o Chrome do sistema.
`series: []` significa **todas as séries**, não nenhuma: é assim que uma
experiência TRANSVERSAL se declara (exp-70). Quando o filtro por série voltar a
valer, vazio tem de continuar querendo dizer "todas" — o contrário faz a
experiência desaparecer da tela sozinha.
`publico: "professor"` ⇒ ferramenta do professor
(exp-90-plano-de-aula em `/professor/plano-de-aula`; exp-91-bem-estar em
`/professor/bem-estar`), e `/exp/*` responde 404 para elas. Sem manifesto (dev) o hub cai na raiz do Vite **da
experiência mapeada em `apps/hub/lib/experiencias-dev.ts`** (uma porta por exp:
5173 exp-01, 5174 exp-02, 5175 exp-90, 5176 exp-91, 5177 exp-70, 5178 exp-03);
teste local: rota `/dev-embed?src=http://localhost:5174`.
A montagem do embed (token, manifesto, dev server, origin) é uma só:
`apps/hub/lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed`,
`/professor/plano-de-aula` e `/professor/bem-estar`.
O estudante tem hub próprio (`/estudante`): ele ESCOLHE a missão, sem filtro por série
por enquanto (`apps/hub/lib/missoes-do-estudante.ts`, derivado do catálogo do Entre
Redes; a série volta a filtrar quando o manifesto virar a fonte). Missão só
aparece lá se tiver copy de estudante (`missao.estudante` no catálogo) — a copy do
professor entrega a virada. **As TRANSVERSAIS vêm primeiro na lista**: não
pertencem a ano nenhum, logo não são "depois" de nada, e a Vila do Lume é o Ato 1
do Instanooria — com ela no fim, a criança encontrava o Ato 2 antes do Ato 1 e
nada dizia o que faltou. Não há GATE, e não deve haver: falta de partida na Vila
nunca bloqueia a exp-01, ela só cai no sorteio. O caminho entre as duas fichas do
professor agora é clicável nos DOIS sentidos (`AtoDaMissao.link` no catálogo).
`/estudante` e `/exp/*` são a MESMA área no middleware
(`lib/papeis.ts`). A trilha do professor cobre a Educação Básica inteira
(1º–9º ano + 3 séries do EM), 4 unidades por ano.

## Como criar uma experiência nova

0. `git switch -c exp-NN-slug` a partir da `main` — uma branch por experiência.
1. `pnpm new:exp exp-NN-slug` (copia `_template`, ajusta nomes).
2. Implementar em `src/App.tsx`+; usar SOMENTE a SDK para auth/api/telemetria e
   SOMENTE o `@unooria/design-system` para interface — a seção do clone que a
   experiência imita (`instanooria`, `unitube`, `chatgpt`, `whatsappmobile`,
   `tiktooria`) pela ponte em `packages/ui`. Falta componente? Ele nasce no repo
   `storybook-unooria` e chega por versão nova, não como arquivo local.
3. Declarar capabilities no `experiencia.json` (`telemetria`, `progresso`,
   `ia`, `avaliacao`, `tempo-real`) — o hub e a api usam isso.
4. `verbo`/`objeto` de telemetria: documentar no README da experiência.
5. Build gera `dist/` 100% estático. Testar embedado: rota `/dev-embed` do hub.
6. **Uma suíte de ponta a ponta**, e ela vai pelo PAPEL de quem usa, não pelo
   número da experiência (ADR-51): missão de estudante entra em
   `scripts/e2e/estudante/NN-slug.mjs`; ferramenta de professor, em
   `scripts/e2e/professor/`. Se a experiência é conduzida pelo relógio da turma,
   a suíte sobe DOIS contextos e mora no papel do protagonista — a da exp-01 é
   `estudante/02-instanooria.mjs`, ainda que metade dos prints seja do docente.
   Cada `registrar()` escreve `titulo`/`mostra`/`prova`: é deles que saem o
   slide do deck e a legenda do vídeo.


## Design System nas experiências

A seção do clone entra pela ponte de `packages/ui` — nunca o `styles.css`
consolidado, que arrasta os tokens da plataforma para dentro do disfarce. **A
folha de fonte é uma linha SEPARADA e obrigatória** (0.1.17: as folhas de
componente não declaram mais `@font-face`); numa marca de clone, esquecê-la cai
no fallback — feio, mas não quebra.

**A linha que separa as seções é a REVELAÇÃO, não o arquivo.** O critério é
"quem está falando?", nunca "é depois no tempo?". Na exp-02: feed, cromo,
playlists, canal, o toast e o diálogo de limite falam de dentro da ficção
(`ds-unootube`); ranking, os dois diálogos da missão, "Concluir missão" e a TELA
DE ENTRADA falam pela escola (`ds`). A entrada é a única ANTES do feed e não é
exceção: no briefing quem fala é a escola, e não há disfarce a proteger porque a
criança ainda não viu um Short. O disfarce começa no toque em "Começar missão".

**Tema**: a seção do clone lê `data-uni-theme` na raiz; a da plataforma recebe
`theme` por PROP. Quem troca escreve nos dois (`exp-02/src/lib/tema.ts`), senão
o estudante escolhe escuro no feed e o ranking volta branco.

Detalhes de mecânica (CSS, frames, compensações) em `packages/ui/AGENTS.md`.
O específico de cada experiência está no `AGENTS.md` da pasta dela.

## exp-70: `public/jogo/` é zona congelada

~10k linhas de JS clássico com globais compartilhados e `three.min.js`
vendorizado. É um instrumento com distâncias e tempos calibrados, e o compilador
não tem como saber que uma refatoração mudou a medida. Está nos `ignores` do
ESLint; o shim (`src/`, TS strict) é a única porta: `window.VILA`. A rede que
substitui o `tsc` ali é a suíte de ponta a ponta (`scripts/e2e/estudante/05-vila-do-lume.mjs`).

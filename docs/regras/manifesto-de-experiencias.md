---
paths:
  - "apps/experiencias/*/public/experiencia.json"
  - "apps/api/src/experiencias/**"
  - "scripts/**"
---

# O manifesto de experiências, e o que o deploy faz com ele

Contrato entre o bundle, o CI e a tabela `experiencias` da api. Complementa o
`AGENTS.md` da raiz, que vence em conflito.

## Manifesto de experiências (tabela `experiencias` na api)
O CI, ao publicar `gs://{contrato}-exp/{expId}/{versao}/`, faz upsert
(`PUT /experiencias/:expId`, `gestor_contrato` ou `admin`) lendo o `public/experiencia.json`
da experiência (`id, nome, versao, series, capabilities, viewport?, publico?`).
O `id` é o **código da experiência** (ADR-110) e é igual ao nome da pasta:
missão da trilha é `expNNefUb`/`expNNemUb`, DERIVADO de `series[0]` + `unidade`
(`8EF` + unidade 1 = `exp08ef1b`); o que não é missão — sem `unidade` — é
`app-NN-nome`. `apps/api/tests/codigo-da-experiencia.spec.ts` reprova manifesto
fora disso, e o validador (`EXP_ID_RE`) mora em `apps/api/src/comum/` e em
`packages/sdk/src/`, as duas cópias amarradas pelo mesmo teste.
O hub monta a URL do iframe com `versaoAtiva`; rollback = trocar `versaoAtiva`
(`node apps/hub/scripts/publicar-manifesto.mjs <exp> --versao x.y.z`).
`viewport` presente ⇒ o hub embeda dentro do `DispositivoFrame` (casca de
aparelho com escala; exp08ef1b é 375×812, o UnooTube (hoje arquivado) não tinha viewport porque foi
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
`pointer-lock`, `forms` e `downloads`, que o `ExpFrame` traduz nos tokens
`allow-pointer-lock`, `allow-forms` e `allow-downloads`.

**`downloads` (app-90 e app-92) tem uma armadilha A MAIS: a rota do hub precisa
REPASSAR `permissoes` ao `ExpFrame`.** `/exp/[expId]` e `/dev-embed` repassam, e as
três rotas de professor (`plano-de-aula`, `plano-de-ensino`, `bem-estar`)
renderizam o `ExpFrame` direto, então cada uma tem de repassar também: declarar a
permissão no manifesto não tem efeito nenhum numa rota que não a passa adiante.
Sem o token, o navegador bloqueia o download em silêncio (o Chrome registra no
painel Issues, não no console) e o `a.click()` volta como se tivesse funcionado:
o professor clica em "Baixar .doc" e nada acontece. Confira com
`document.querySelector('iframe').getAttribute('sandbox')` no console do hub
(ADR-76).

**`forms` custou um bug inteiro para ser descoberto**: o `Composer` do DS é um `<form>`, e sem o token o navegador BLOQUEIA
o submit — o estudante da exp02em1b digitava a pergunta, apertava Enter e nada
acontecia. O sintoma engana porque a conversa parece viva (a fala de abertura do
agente já está na tela) e o único rastro é um aviso de console sobre "form's
frame is sandboxed". Typecheck, lint e a primeira versão do smoke passaram por
cima disso.
Vazio (o default) = nenhuma permissão. É POR
EXPERIÊNCIA de propósito: prender o ponteiro do estudante é capacidade de quem
declarou, não default do frame. Medido em `scripts/probe-pointerlock.mjs`: num
iframe com sandbox, sem o token o `requestPointerLock()` morre com `SecurityError`
e com ele funciona — e o Chromium do Playwright não concede pointer lock nem no
topo da página, então essa verificação exige o Chrome do sistema.
`series: []` significa **todas as séries**, não nenhuma: é assim que uma
experiência TRANSVERSAL se declara (app-70). Quando o filtro por série voltar a
valer, vazio tem de continuar querendo dizer "todas" — o contrário faz a
experiência desaparecer da tela sozinha.
`publico: "professor"` ⇒ ferramenta do professor
(app-90-plano-de-aula em `/professor/plano-de-aula`; app-91-bem-estar em
`/professor/bem-estar`), e `/exp/*` responde 404 para elas. Sem manifesto (dev) o hub cai na raiz do Vite **da
experiência mapeada em `apps/hub/lib/experiencias-dev.ts`** (uma porta por exp:
5173 exp08ef1b, 5174 exp04ef1b, 5175 app-90, 5176 app-91, 5177 app-70, 5178 exp02em1b,
5179 exp07ef1b, 5181 exp06ef2b, 5182 exp08ef4b, 5183 exp01ef1b, 5184 exp05ef1b — a
5180 é da app-92);
teste local: rota `/dev-embed?src=http://localhost:5174`.
A montagem do embed (token, manifesto, dev server, origin) é uma só:
`apps/hub/lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed`,
`/professor/plano-de-aula`, `/professor/plano-de-ensino` e `/professor/bem-estar`.
O estudante tem hub próprio (`/estudante`), e desde a sala de aula (ADR-69) ele
abre pela TURMA: `GET /salas/minhas` devolve a grade da série dela, e o estudante
só entra no que o professor LIBEROU naquela sala. Missão bloqueada aparece com
CADEADO — não some —, e a encerrada fica com o rótulo. `apps/hub/lib/missoes-do-estudante.ts`
é só a COPY (`copyDaMissao`), não a lista; missão sem copy de
estudante não vai à tela, mesmo liberada — a do professor entrega a virada.

**`series` do manifesto é LIDO**: é ele que decide se a missão entra na
grade de uma turma, e `series: []` continua querendo dizer TODAS (a transversal).
Errar esse campo tira a missão da tela sozinha. **`unidade` (1 a 4) ORDENA a grade**: ausente na transversal e na ferramenta de professor, que
não moram numa unidade. Sem ela a ordem cai no `expId` — numeração de experiência,
não do ano letivo, e o 7º ano viria depois do 8º.

**Campo novo no `experiencia.json` tem de ser acrescentado ao
`apps/hub/scripts/publicar-manifesto.mjs` também.** Já valeu para `permissoes`,
para `unidade` e para `produto`: esquecer é invisível em dev (o hub lê o arquivo do bundle) e
quebra em produção, onde ele lê a coluna. E **a versão tem TRÊS fontes** —
`public/experiencia.json`, `package.json` e a constante `EXP_VERSION` do código.
Toda experiência, exceto a app-70, tem `src/versao.test.ts` cobrando as três. O UnooTube, que ocupava o código `exp04ef1b` antes de ser
arquivado como `backup-exp04ef1b` (ADR-116), chegou a viver com as três divergentes.

**A ORIGEM do bundle é do AMBIENTE, não do manifesto** (`emDev = !emProducao`, em
`montarEmbed`). Decidir "estou em dev" por "a tabela `experiencias` está vazia"
quebra assim que o seed a popula: com manifesto e sem CDN, a URL versionada cai
no default `localhost:5173` (o dev server da exp08ef1b), que responde a QUALQUER
caminho com a SPA dele — toda missão abre o Instanooria, com handshake completo e
403 na experiência errada. **As TRANSVERSAIS vêm primeiro na lista**: não
pertencem a ano nenhum, logo não são "depois" de nada, e a Vila do Lume é o Ato 1
do Instanooria — com ela no fim, a criança encontraria o Ato 2 antes do Ato 1 e
nada diria o que faltou. Não há GATE, e não deve haver: falta de partida na Vila
nunca bloqueia a exp08ef1b, ela só cai no sorteio. O caminho entre as duas fichas do
professor é clicável nos DOIS sentidos (`AtoDaMissao.link` no catálogo).
`/estudante` e `/exp/*` são a MESMA área no middleware
(`lib/papeis.ts`). A trilha do professor cobre a Educação Básica inteira
(1º–9º ano + 3 séries do EM), 4 unidades por ano.

**`produto` (ADR-87) é o que põe a experiência no PAINEL da Unooria** —
`entre-redes`, `plano-de-aula`, `plano-de-ensino` ou `bem-estar` —, e é o que lhe
dá o TETO do produto: produto desligado numa rede desliga tudo dentro dele. A
composição produto → experiências é DERIVADA deste campo, e é por isso que ele
existe em vez de uma lista no hub: lista à mão é a que ninguém atualiza quando a
experiência seguinte nasce. **Esquecer o campo é MUDO** — a coluna nasce nula, a
experiência não aparece dentro de nenhum produto no painel, e continua abrindo
normalmente para estudante e professor: nada quebra e nada avisa. Quem cobra é
`apps/api/tests/manifestos-declaram-produto.spec.ts`, no CI, e NÃO o Zod da rota
(um 400 no `PUT` mataria a ativação depois de os bundles já terem subido).

**A cadeia de um campo de manifesto tem CINCO pontos, não dois:** o Zod
(`apps/api/src/experiencias/contrato-de-rotas.ts`), a coluna, o
`apps/hub/scripts/publicar-manifesto.mjs`, a interface `Manifesto` do seed
(`apps/api/prisma/catalogo-e-liberacoes.ts`) e o **`_template`** — este porque
`pnpm new:exp` copia o `experiencia.json` dele, e um template incompleto faz TODA
experiência nova nascer errada.

## Sourcemaps: `hidden`, e o `.map` NÃO vai para o bucket público

Todo `vite.config.ts` (o `_template` inclusive) tem `build.sourcemap: "hidden"`:
o `.map` é gerado, mas o bundle não ganha o comentário `sourceMappingURL` — o
navegador nunca o pede. O CI exclui `*.map` do `rsync` para `gs://{contrato}-exp`
e os sobe num bucket **privado** à parte (`{project}-exp-mapas`): o bucket dos
bundles tem acesso uniforme, então qualquer objeto lá é público, e o mapa é o
fonte — na exp08ef1b, a revelação legível antes da hora. Nunca `sourcemap: true`,
nunca `inline`. Para traduzir a stack de um erro de cliente: o `.map` da
versão exata está em `gs://{project}-exp-mapas/{expId}/{versao}/`.

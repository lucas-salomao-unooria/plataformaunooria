# exp-70-vila-do-lume

Jogo 3D em primeira pessoa: a criança reacende as 8 fogueiras de uma vila no escuro.
**Transversal** — não pertence a nenhum ano (`series: []` no manifesto), e aparece
como card próprio no Entre Redes, fora da grade de etapas.

## Duas camadas que não se cruzam

**Camada 1** — o que a criança vive: a vila, o objetivo, e escolhas pelo caminho que
ninguém pontua. **Camada 2** — o que o adulto lê, fora do jogo: um retrato de valores
(Schwartz) derivado de escolhas com custo, e a leitura da missão "A Noite Longa".

A criança não sabe da Camada 2, e **não existe tela de resultado dentro do jogo** —
nem retrato, nem lista de partidas, nem rota atrás de parâmetro de URL. No instante em
que ela se sabe medida, a próxima partida vira atuação.

## Dois instrumentos na mesma partida, e eles não se tocam

O perfil de valores lê escolhas com custo dentro do jogo. A missão "A Noite Longa" lê
julgamento sobre 5 mensagens que chegam durante a partida — 2 verdadeiras, 3 golpe.

As mensagens **leem** o estado do jogo (para escolher a hora) e **nunca escrevem** nele:
um golpe que custasse fagulha faria a criança que caiu aparecer como menos generosa no
retrato de valores, e nada no relatório mostraria a contaminação.

## Estrutura

| pasta | o que é |
|---|---|
| `src/` | o shim — TS strict, compilado pelo Vite. Handshake do SDK, abertura da partida, injeção dos scripts |
| `public/jogo/` | o jogo: JS clássico, CSS pixel, `three.min.js`. Não é compilado por nada. Ver `ADR-0001` |

`window.VILA` (`src/tipos.ts`) é a **única** porta entre os dois.

## Identidade

Vem da sessão autenticada da plataforma, via `hub:init`. Não há tela de escolha de
aluno, não há link por aluno, não há modo livre: sem handshake o shim não sobe o jogo,
porque partida órfã é pior que partida nenhuma — ela desaparece e o professor lê a
lista achando que a criança não jogou.

O jogo recebe só o **primeiro nome** dela, e ele vive apenas na Camada 1 (a fala do
Lume e a Pedra dos Nomes). Nunca é serializado: o payload não tem campo de nome, o
jogo confere isso antes de entregar e a api recusa payload que tenha.

## Rodar

```bash
pnpm --filter @edu/exp-70-vila-do-lume dev   # :5177
# embedado, com sessão de aluno:
#   /dev-embed?src=http://localhost:5177   ou   /exp/exp-70-vila-do-lume
```

Abrir `http://localhost:5177` direto **não** funciona, e é de propósito: sem hub não há
handshake, sem handshake não há identidade.

## Smoke visual

`tsc` não cobre quase nada aqui: o jogo está fora dele (ADR-0001), e o que quebra é
tudo runtime — a ordem dos 19 scripts, o WebGL dentro do iframe, o pointer lock.

```bash
node scripts/walkthrough-vila-do-lume.mjs testes/walkthrough-vila
```

Ele usa o **Chrome do sistema**, não o Chromium do Playwright: só o Chrome real
concede pointer lock em automação, e sem isso a checagem não distingue "o sandbox
está errado" de "o navegador não faz isso".

Dois passos dele cobrem coisas que nenhum teste de unidade alcança e que já
quebraram: o **sandbox** trazer `allow-pointer-lock` (sem o token a criança entra
na vila e a câmera não gira) e o **pausa-e-volta** — perder o ponteiro e o aviso
"Clique pra voltar pro jogo" aparecer. O segundo existe porque o
`pointerlockchange` do `16-boot.js` vivia dentro de `window.addEventListener('load')`,
e aqui os scripts entram DEPOIS do load: o listener nunca era registrado, e como
o `pausedHint` é o único `controls.lock()` fora dos diálogos, a partida ficava
sem caminho de volta. A tabela medida está no cabeçalho de
`scripts/probe-pointerlock.mjs`. Sem Chrome instalado o script roda e avisa que a
checagem de pointer lock não valeu.

Um `404 favicon.ico` no console é esperado — vale para toda experiência embedada.

## Telemetria

`verbo`/`objeto` estão em `public/experiencia.json`. O canal analítico é `track()` do
SDK; a partida em si vai por `window.VILA.concluir()` → `POST /vila/sessoes/:id/concluir`.

## Front e back separados

O app de origem era **um Next.js só**, e a partida existia primeiro no navegador: o
jogo escolhia o próprio id, cravava o próprio horário de início, decidia a própria
bolha (`alunoSlot % 3`) e classificava as próprias respostas. Quando o dado chegava ao
banco, tudo já estava decidido.

Aqui a linha é essa:

| decide | quem |
|---|---|
| id da partida, horário de início, retenção | api |
| bolha (balanceada na turma, estável por aluno) | api |
| **quais** cartões esta criança recebe | api |
| **quando** cada cartão chega (gatilho) | jogo — só ele sabe o estado da partida |
| o que ela respondeu (índice, se viu, quanto tempo) | jogo |
| o que aquilo significa (golpe aceito? ajuda recusada?) | api |
| o retrato de valores | api, recalculado das medidas brutas |

O jogo não conhece HTTP nem token: ele recebe `window.VILA` pronto e entrega o payload
por `concluir`. Nada de gabarito no bundle.

## Estado

**M1** o jogo roda embedado com identidade da plataforma · **M2** módulo `vila` na api
(3 tabelas com RLS, contrato, mapeamento e leitura portados) · **M3** jogo e api
ligados: partida abre e fecha no servidor, cartões servidos sem gabarito, telemetria
nos 4 verbos do manifesto, replay abre partida nova · **M4** telas do professor
(card transversal na trilha, ficha, resultados por turma, relatório individual) e
card no hub do aluno · **M5** Ato 1 nativo: o perfil alimenta a largada do
Instanooria (`POST /atividades/:id/perfis/da-vila`).

**M6** guia do debate do professor, e a decisão de retenção fechada (ver abaixo).

**Retenção: não há prazo declarado.** Houve um `expires_at` de 90 dias no schema
e nenhuma rotina que o cumprisse — coluna de prazo que ninguém lê é pior que
prazo nenhum, porque quem lê o schema acredita nela. A coluna saiu. Em troca, o
REPROCESSAMENTO fica preservado: `payload` é a única fonte para recomputar o
perfil quando `VERSAO_MAPEAMENTO` subir, e o mapeamento é hipótese de design que
vai mudar. Se um contrato exigir prazo, ele volta junto com a rotina que o cumpre.

## O Ato 1

A ficha do Instanooria sempre descreveu um "Ato 1" em que *"fora da plataforma,
um jogo mede o perfil de valores do aluno"*. Este é o jogo, e ele deixou de estar
fora: o professor traz os perfis pela tela da atividade, e eles decidem de que
lado o feed de cada aluno nasce.

Os dez valores colapsam nos quatro quadrantes do Instanooria
(`apps/api/src/vila/quadrantes.ts`) com duas travas que **custam alunos**, de
propósito: valor não observado fica FORA da média (nunca entra como zero), e
quadrante sem nenhum membro observado invalida o perfil inteiro. Sem perfil, o
Instanooria cai no sorteio balanceado — que é honesto sobre não saber, e é o que
acontecia com a turma toda antes desta integração existir.

## As telas do professor

`/professor/entre-redes/vila-do-lume` — ficha, com as três bolhas explicadas.
`…/guia` — o debate: o roteiro, a folha `P/S/N/?` e a revelação com as três
versões do golpe lado a lado.
`…/resultados?turmaId=` — agregado da turma, uma linha por aluno, e o botão de
**zerar os dados da turma** (apaga partidas, perfis E bolhas: sem sortear de novo,
a segunda rodada serviria o mesmo golpe e não mediria nada).
`…/alunos/:id` — o relatório de uma partida.

## Documentação de design

`docs/` traz o registro do jogo, vindo do repositório de origem e revisado no porte:
`GAME_DESIGN.md` (o que o jogo é hoje), `CONTEXT.md` (glossário), `CLAUDE.md` (as regras
para quem mexe), `MISSAO-a-noite-longa.md` (a missão das mensagens), `DEBATE.md` e os dois
`GRILL-*` (registro histórico, com cabeçalho de aviso), e `adr/`.

Três travas de leitura, e cada uma tem asserção no smoke
(`scripts/walkthrough-professor-vila.mjs`):

- **nenhum valor de Schwartz na LISTAGEM da turma.** Listagem é ordenável, e uma
  coluna "Poder" viraria um ranking de crianças. Os valores vivem na tela
  individual, uma criança por vez, com o grau de sustentação ao lado;
- **os dez valores aparecem sempre**, inclusive os sem número, cada um dizendo por
  quê. Mostrar só os quatro que deram número faria a página parecer completa;
- **a seção das mensagens abre pelo NÍVEL** que ela recebeu, antes do que ela fez.

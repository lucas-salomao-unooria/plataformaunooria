# apps/api/src/podcast — o podcast de recapitulação (ADR-150)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

O podcast de recapitulação de TODA missão: rotas únicas (`/podcast/:expId/…`),
o motor do áudio, a escrita das falas pela IA e a tabela `podcast_roteiros`.
Nasceu na A Seleção (ADR-119) e virou recurso da plataforma quando o 4º e o 5º
ano o ganharam. **É do PROFESSOR** (decisão do dono do produto, 2026-09-26):
nenhuma rota de estudante; o texto fala com a turma, e quem decide tocar é quem
conduz.

## Missão nova com podcast

A missão declara uma `FonteDoPodcast` (`fonte.ts`) e a registra no
`onModuleInit` com `PodcastService.registrarFonte` — o desenho do
`EvidenciasService.registrarContexto`: este módulo não importa missão nenhuma.
O molde é o par de arquivos do Jornal (`jornal-escola/podcast.ts`, puro, e
`podcast-fonte.ts`, o provider):

- **o roteiro** é o do sheet aprovado, em blocos (cada bloco é UM trecho de
  áudio e UMA chamada de síntese, ≤ 4.000 bytes), com as **vagas do tema** — as
  falas que contam o que a turma viu NESTA atividade — no lugar delas;
- **`atividade(...)`** reusa o carregador que a missão já tem para as imagens:
  a guarda de turma (404) e o "sem atividade em andamento" (403) são DELA;
- **`escrita`** (opcional) é o Zod do rascunho da customização, o "é o banco
  padrão?" e o material que a IA lê;
- **a homologação da missão** recebe `podcast: { vaga: fala }` no corpo,
  valida com `falasDoTemaSchema(vagas)` e grava com `gravarFalasDoPodcast`
  DENTRO da transação dela — inclusive no segundo clique, que devolve o pacote
  existente.

## O que não é óbvio

- **O professor SEMPRE revisa as falas na customização** (decisão do Lucas,
  2026-10-06). `POST …/falas-do-tema` devolve rascunho e não grava; a tela
  mostra as vagas editáveis e manda as revisadas na homologação. Sem saldo ou
  com a IA fora, a resposta é 200 com as falas do sheet e o `motivo` — o
  professor nunca fica sem texto, e a tela avisa que ele conta o banco padrão.
- **Sem linha na tabela**: se a atividade é o banco padrão INTOCADO (origem
  `padrao` e o conteúdo igual ao catálogo), valem as falas do sheet; senão,
  409 `roteiro-indisponivel` — a atividade da IA criada antes do podcast.
  Uma linha torta (vaga faltando, régua ferida) é ignorada com aviso no log,
  nunca derruba a tela.
- **O nome do trecho é o hash do texto e do pedido de voz** (`roteiro.ts`): o
  bloco sem vaga sai UMA vez por contrato, e só o bloco com fala reescrita custa
  síntese. A forma do nome e os insumos do hash são os que a A Seleção já
  gravou no bucket (`selecao/podcast/`); `a-selecao-podcast.spec.ts` congela os
  nomes. Mudou direção, timbre ou texto fixo? Suba a `versao` do pedido de voz
  da missão.
- **Podcast FIXO (a Missão Tempestade, ADR-156)**: missão sem customização
  declara `vagas: []`, nenhuma `escrita` e `padrao: true` na `atividade()` — o
  motor devolve o roteiro inteiro do código, sem procurar linha nem dar 409, e
  `falas-do-tema` responde 404. A atividade dela é `"turma"` (a das equipes e
  da evidência): `?atividadeId=` aceita esse literal além do uuid, e a fonte de
  missão com atividade de verdade o recusa com o 404 dela.
- **O Unoovista grava as falas no ATIVAR** (`POST /atividades/:id/ativar`,
  `podcast` opcional), não numa homologação: a missão não tem tela de criação
  que termine numa. Opcional porque o "pôr no ar" da sala reativa sem passar
  pela revisão — e aí valem as falas gravadas.
- **A A Seleção não usa a tabela**: as falas dela nascem no lote do preparo e
  moram na cobertura (`exp07ef1b_coberturas.podcast`); a fonte as entrega como
  `falasProprias` e não tem `escrita`.
- **Um trecho por chamada** (`POST …/gerar`), e o cliente repete até
  `completo`: o episódio inteiro não cabe no teto do BFF. Trava de processo por
  episódio, quota do professor com custo estimado por trecho.
- **Sem áudio, nada quebra**: o roteiro é a transcrição, e a tela a mostra
  sempre. O mock falha fechado (`ai/AGENTS.md`).
- **O podcast pode dizer "falso"**: ele toca DEPOIS da revelação. A régua das
  vagas proíbe link, e-mail, @ e delimitador — não as palavras do gabarito.

## As suítes

- `tests/podcast.spec.ts` — SEM banco: a régua, os roteiros do 4º ao 8º ano e
  o fixo da Tempestade
  (vagas no lugar, trechos no teto, nomes), quem é o banco padrão, a homologação
  exigindo as falas, a escrita com IA falsa e as falas que o motor escolhe.
- `tests/a-selecao-podcast.spec.ts` — o motor de áudio (um trecho por chamada,
  a emenda, sem saldo, falha) pela fonte da A Seleção, e os nomes congelados.
- `tests/podcast-postgres.spec.ts` — a RLS isolando `podcast_roteiros` (role
  sem `BYPASSRLS`), os CHECKs e a homologação do 4º e do 5º gravando as falas.

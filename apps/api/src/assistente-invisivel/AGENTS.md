# apps/api/src/assistente-invisivel — O Assistente Invisível (exp01em1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão da 1ª série EM, unidade 1 (ADR-185), vinda da esteira
(`artefatos_exp01em1b`, one-pager do PO v1.5). Prefixo
`/assistente-invisivel`, porta do Vite 5188.

A turma é a comissão de auditoria do UnooriaAI da escola: Lucas, Beatriz e
Thiago pediram a mesma Trilha Avançada, e o assistente rebaixou a Beatriz pelo
HORÁRIO (23h45) e travou o Thiago pela CONEXÃO. O estudante aposta (LATCH 1),
vê as três sessões de chat, abre as fichas, classifica os cartões
(fornecidos × observados), opcionalmente marca as etapas dispensáveis do
algoritmo, troca os critérios e reteste, e publica a transparência com o
comunicado em 4 blocos (LATCH 2, que conclui). Quatro tabelas:
`exp01em1b_pacotes`, `_gates_turma`, `_gates_historico`, `_sessoes`
(migração `20261026180000_exp01em1b_assistente_invisivel`).

## As fontes, e quem vence

O **Figma** (`9QyrVdEBJZkOS64ZauPfmk`) é a referência de tela e de copy; as
respostas do Vinicius no card e o one-pager v1.5 dão a mecânica e a régua. O
núcleo PURO (`conteudo.ts`, `regras/*.ts`, `contrato-de-rotas.ts`) é o que a
experiência e o hub espelham: **mudou a forma de um `…Schema`, avise as duas
frentes** — elas importam os tipos por `z.infer`.

## O que não é óbvio

- **Cinco liberações e duas pausas são a FASE da turma** (`regras/passos.ts`):
  `aguardando-inicio → testes → simulacao → [debate-1] → explicar → [debate-2]
  → publicar`, só para a frente (`transicaoValida`), pausas puláveis, e pedir
  a fase atual é idempotente (sem linha nova em `_gates_historico`). O passo
  do estudante NÃO muda com a fase: `aguardandoProfessor` é a camada de espera
  por cima dele. Jogada no passo certo com a turma travada = 409
  `aguardando-professor`.
- **O 100% da E3 conta as sessões ABERTAS da rodada**, por unidade
  (`regras/medidor.ts#todosApostaram`), e a sessão NASCE no primeiro `GET
  /sessao` com o pacote no ar — por isso o GET escreve (idempotente,
  `skipDuplicates`). Quem abriu a tela e saiu segura o botão; o painel lista
  quem falta (`faltamApostar`). `gate` para `simulacao` sem 100% = 409
  `apostas-pendentes`.
- **O medidor da turma** desce só agregado, só com ≥ 3 apostas, e só para
  quem JÁ apostou (antes do latch, o percentual dos colegas viraria a
  resposta). É o único dado de colegas que o estudante recebe.
- **Toda jogada declara o passo dela** (`jogada` no service): à frente = 409
  `passo-invalido`; já feita = o estado (200), salvo os latches com outra
  escolha (`ja-apostou`, `ja-publicado`) e o reteste com OUTROS critérios sem
  "Revisar Critérios" (409 `passo-invalido`). A sessão sai trancada por
  `SELECT … FOR UPDATE`. Os POSTs aceitam `atividade` opcional; diferente da do
  servidor (o professor zerou ou trocou o pacote) = 409 `rodada-mudou` — a fila
  de reenvio da tela não aplica jogada velha na rodada nova.
- **O gabarito não desce** (regra 3): os acertos dos cartões, os passos
  dispensáveis, os critérios equitativos e a opção certa dos blocos ficam no
  servidor. Desce o que a MECÂNICA mostra: `cadeiaCausal` (a tabela causal),
  o resultado do reteste e o efeito no chat. O alinhamento do comunicado e os
  níveis só vão ao painel do professor.
- **A IA só no preparo** (`preparo.service.ts`, quota do perfil `professor`):
  o pacote inteiro (trilhas, as cinco dúvidas, as cinco respostas do
  assistente, a leitura) e o "Regenerar Este Item". Sem saldo ou com o vendor
  fora, o `gerar` devolve o PACOTE_PADRAO de Língua Portuguesa com
  `contingencia: true` e o `motivo` (a faixa do E3-SIS-01 na tela do
  estudante); o `regenerar` responde 429 `sem-saldo-de-ia` / 503
  `ia-indisponivel` e o rascunho fica como estava. O "Usar Banco Padrão da
  Rede" deliberado NÃO é contingência.
- **A régua do pacote** (`regras/pacote.ts#problemasDoPacote`) é uma só para a
  IA, o regenerar, o editar e a homologação: a forma e os limites do contrato,
  cinco dúvidas diferentes, títulos das trilhas diferentes, e **nenhum texto
  que cite horário, madrugada, noite, conexão, sinal, internet ou rede** — o
  pacote não pode antecipar a inferência que a turma vai descobrir. As fichas,
  os avisos de sistema e a bancada são FIXOS (`conteudo.ts`) e ficam fora dela.
- **A sessão é da UNIDADE** (o estudante, ou quem está logado no computador da
  equipe, E13). O painel colapsa por computador (`colapsarEmUnidades`) e a
  evidência copia a marca a cada integrante. Projeção = equipe de 1 computador.
- **A atividade é o PACOTE; a rodada é o "Zerar"** (ADR-130/155), como na
  exp02ef1b: aprovar cria a atividade PRONTA; `em-andamento` a põe no ar e
  devolve a fase ao início; `banco-padrao` faz os dois num toque; `zerar` apaga
  a evidência do pacote, guarda as sessões e devolve a fase a
  `aguardando-inicio`.
- **O podcast é FIXO** (`podcast.ts`): o §11 literal (Alex e Sam), sem troca.
- **Vocabulário em dois lugares**: disciplina, origem, fase, aposta, funções,
  itens do pacote, equidade e alinhamento estão no código e nos CHECKs;
  `tests/assistente-invisivel-regras.spec.ts` compara os textos.

## A régua (E14) — 100% Canal A (`regras/evidencia.ts`)

As quatro marcam JUNTAS no LATCH 2. Quem apostou e não publicou recebe as
quatro quando o professor ENCERRA a missão na Sala de Aula, com `publicou:
false` (o "conta ao encerrar" da ADR-154): o service se registra em
`SalasService.aoEncerrarMissao` no `onModuleInit` e roda na transação de quem
encerrou. A rota `POST …/encerrar` faz o mesmo e fica para a api; o hub não
tem botão (o Figma não tem), o encerramento é o da sala.

| habilidade | atingiu | em processo | não atingiu |
|---|---|---|---|
| EM13CO20 (foco) | página ativa e os 4 blocos certos | página ativa com bloco em branco ou só o bloco 1 trocado; ou os 4 certos sem a página | não publicou; ou erro nos blocos 2, 3 ou 4 |
| EM13CO01 | último reteste com F1 e F2 ∈ {A, C} | só uma das duas | manteve 1B e 2B, ou não retestou |
| EM13CO18 | equidade total e publicação plena | uma das pontas | nenhuma |
| EM13CO03 | abriu o painel e marcou exatamente {2, 3, 4} | abriu e marcou outro conjunto | não abriu, pulou ou não marcou |

A F3 (sugestões) e os cartões vão só ao painel. Falha técnica = sem marca.

## As duas suítes

- `tests/assistente-invisivel-regras.spec.ts` — sem banco: o passo e a espera
  por fase, as transições, a bancada, as quatro réguas (tabela-verdade), o
  medidor, a régua do pacote (o padrão e a saída da IA), o gabarito fora do
  `SessaoSchema`/`EstadoSchema`, o podcast e o espelho dos CHECKs.
- `tests/assistente-invisivel-postgres.spec.ts` — a porta da sala em toda rota
  de estudante, a missão que nasce vazia, o preparo com a quota e a reserva, a
  curadoria, a homologação, o banco padrão, as fases só para a frente e o 409
  sem 100%, os dois latches, o reteste e o revisar, as marcas no publicar e no
  encerrar, o painel, a RLS com a role sem `BYPASSRLS` e o zerar.

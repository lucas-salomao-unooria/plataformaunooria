# apps/api/src/juri-estadual — O Júri Estadual de Projetos (exp06ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp06ef1b, rotas `/juri-estadual/*`)

Missão de 6º ano, unidade 1, no Unoovista (clone de rede social, seção
`unoovista` do DS). A criança é jurada de uma mostra científica estadual: rola
um feed de dez posts que as curtidas dela AFUNILAM em silêncio, vota numa
cédula lacrada (o LATCH 1) e espera a turma (o PICO: o professor projeta a
dispersão de votos). O professor libera a Galeria Oculta: ela vê o que nunca
chegou ao feed dela, com a taxa REAL de invisibilidade, busca por hashtag e
mantém, troca ou COMPLEMENTA o voto (o LATCH 2). Espera de novo, e o professor
libera a RODADA DE DESVIO (seis posts em que ela interage com o que o feed
escondia e vê o feed virar). Depois monta a cadeia Interações → Dados →
Algoritmo → Bolha (EF06CO03), resolve o caso Mariana e responde as enquetes
(P1–P3, pelas rotas de `/evidencias`).

**O ciclo do voto (2026-10-07, o que o PO pediu e a spec perdeu)** — quatro
peças, todas na migração `20261007120000`:

- **Salvar pesa no feed** (curtir 3, salvar 2, ficar > 5 s 1): os três sinais
  do desenho do PO. Comentar e compartilhar respondem na TELA e não viajam.
- **A justificativa antes e depois** ("Antes eu pensava… Agora eu percebo…"):
  na cédula e na revisão, um cartão de motivo (`v1`–`v3`, `r1`–`r3`, texto em
  `conteudo.ts`) e o trecho GRIFADO — o índice de uma frase da legenda do
  estande (`regras/justificativa.ts`, espelhado na experiência), conferido no
  servidor. Índice, nunca texto. Não vira nível: é o registro que a plenária lê.
- **Complementar** mantém o voto e grava `complemento_projeto` (CHECK: só nele,
  nunca o próprio voto); o painel conta `complementaram`.
- **A rodada de desvio** é a TERCEIRA etapa da turma (`exploracao → galeria →
  desvio`), com o passo gravado `revisada` (a espera) e o efetivo `desvio`
  (nunca gravado, como a `galeria`). O MESMO motor, com um estado só dela
  (`desvio_*`, `proximoDoDesvio`): abre por dois posts das duas áreas MENOS
  vistas e depois segue os pesos da rodada. Concluir pede os seis e uma
  curtida ou salvo (`desvio-sem-interacao`). **Sem evidência** — a vivência é
  obrigatória, não medida. As sessões que já tinham passado da revisão entraram
  com o desvio concluído no carimbo da revisão. **Não há mais o passo `pacotes`**
(a curtida remontada, EF06CO07): o PO o tirou com a habilidade em 2026-10-06, e
a migração `20261006120000` moveu para `cadeia` as sessões que estavam nele e
apagou as colunas `pacotes_*` (a marca antiga continua em `evidencias_marcas`). Três tabelas: `exp06ef1b_pacotes`, `exp06ef1b_gates_turma`,
`exp06ef1b_sessoes`.

**A espinha é contrato com a experiência e o hub**: `vocabulario.ts`,
`conteudo.ts`, `invariantes.ts`, `erros.ts`, `contrato-de-rotas.ts`,
`regras/passos.ts` e `regras/afunilamento.ts`. Os dois lados têm espelhos
declarados dessas listas; mudar a forma aqui sem avisar quebra os dois em
silêncio.

- **Não há acervo padrão** (decisão de 2026-10-02): os dezesseis projetos (4
  áreas × 4) são da ATIVIDADE, gerados por IA no preparo e homologados pelo
  professor. Sem saldo de IA, não há atividade. O esqueleto fixo (blocos,
  Mariana, cartões, plenária) vive em `conteudo.ts` e desce com o
  gabarito só em `GET professor/material`.
- **Atividade = o PACOTE; rodada = o "Zerar".** O gate (PK `turma_id`) diz qual
  (pacote, rodada) está em andamento, e a sessão é por essa dupla (UNIQUE
  `pacote_id, rodada, estudante_id`). Zerar sobe a rodada e volta à exploração
  **sem apagar nada**. Um ativo por turma: índice único PARCIAL
  (`exp06ef1b_pacotes_um_ativo`). `homologar` cria PRONTO (ADR-130) e é
  idempotente para o mesmo conteúdo; `colocarEmAndamento` desliga o anterior,
  liga o escolhido e aponta o gate para a rodada SEGUINTE à última com sessão.
- **A aprovação tem DUAS fases** (o pedido do PO, no molde da exp07ef1b,
  ADR-146): `homologar` é a dos textos e grava o pacote com
  `imagens_aprovadas_em` NULO; `POST …/pacotes/:p/aprovar-imagens` (idempotente)
  é a das imagens. Sem ela, `colocarEmAndamento` responde 409
  `imagens-nao-aprovadas`. NÃO exige imagem em todo estande (a geração falha, a
  quota acaba): o estande segue com a arte procedural, que o professor vê
  marcada na grade. **Depois de aprovar, as imagens congelam**: `gerar-midia` e
  `…/imagens/:projetoId/refazer` respondem 409 `imagens-ja-aprovadas`
  (`pacoteParaMidia`) — gerar a que falta levaria à turma uma imagem que
  ninguém viu, que é o que o PO pediu para acabar. Os pacotes de antes entraram
  aprovados na migração.
- **O motor do feed roda no SERVIDOR** (`regras/afunilamento.ts`, puro): o
  cliente mede (curtiu, ficou mais de 5 s) e manda em `POST feed/eventos`; o
  servidor aplica as curtidas ANTES de escolher o próximo, e serve um a mais
  com `proximo: true`. A sessão guarda `semente` (aleatória, de servidor) e as
  três listas; os pesos são DERIVADOS, nunca gravados.
- **O acervo não desce antes da galeria.** O post é uma ALLOWLIST
  (`regras/publico.ts`): antes da galeria, só os posts SERVIDOS; a `descricao`
  da imagem (o pedido ao gerador) nunca desce. A galeria (os dezesseis, os
  ocultos primeiro, e `invisibilidade` real) exige o passo efetivo `galeria` —
  o voto E a etapa: quem não votou não a abre nem com a etapa aberta.
- **A cadeia tem ids OPACOS** (`regras/ordem.ts`): `bl-` + 3 caracteres
  derivados da semente, estáveis num F5, e a ordem de chegada NUNCA coincide
  com a certa (re-embaralha com outro rótulo; a rotação é a garantia).
  Os cartões de Mariana descem embaralhados e sem `certo`.
- **Os CHECKs dos latches são equivalências com o passo gravado**: `votado_em ⇔
  passo ∉ {credencial, feed}`, `revisado_em ⇔ passo ≥ revisada`,
  `desvio_concluido_em ⇔ passo ≥ cadeia`, cadeia ⇔ ≥ `mariana`, cartões ⇔ ≥
  `enquetes`, `fim ⇔ concluida_em` — e `galeria` e `desvio` nunca são GRAVADOS
  (a etapa os impõe a quem está em `lacrada` e `revisada`). O voto revisado
  guarda o voto FINAL (manter e complementar repetem o inicial; CHECK). O
  service grava carimbo e passo no MESMO update.
- **Os locks**: por estudante (o funil `garantirSessao`) e da TURMA — exclusivo
  para o botão, zerar, homologar e pôr no ar; compartilhado para as duas
  jogadas que MARCAM evidência (revisão, cadeia), que relêem o gate
  depois dele e respondem 409 `rodada-mudou` se o professor zerou no meio.
- **O painel conta por COMPUTADOR** (`colapsarEmUnidades`; o representante é
  quem VOTOU) e é PROJETADO na lousa no pico (PED-07): a linha diz só progresso
  (`regras/painel.ts#PROIBIDO_NA_LINHA_DO_PAINEL`, com teste por chave e por
  valor). Votos por área (inicial e revisado), taxa média e mantiveram/trocaram
  vivem no resumo, anônimos.
- **A IA só existe do lado do professor, antes da aula.** `preparo.service.ts`:
  `temSaldo(professor)` → `generateJson` com `validar` (`regras/preparo.ts`:
  normaliza `semExclamacao`, hashtag, perfil e a hashtag da área primeiro;
  depois o MESMO `ConteudoDoPacoteSchema` da homologação, mais títulos e perfis
  sem repetir), duas tentativas, débito no `aoUsarTokens`. Sem saldo = 429;
  falha = 503. `regenerar-projeto` sem saldo = 429; falha = 200 com `usouIa:
  false` e o projeto como estava no rascunho enviado. O prompt pede personas de
  11 e 12 anos, nomes brasileiros com gênero equilibrado e escolas fictícias.
- **As imagens** (`midia.service.ts`) são INCREMENTAIS (duas por chamada, 16 no
  total), 4:3 em 800×600, nome = hash da `imagem.descricao` em
  `experiencias/exp06ef1b/mostra/`, gravadas com `midia || jsonb_build_object`.
  Sem imagem, a tela desenha a arte procedural. "Gerar outra imagem"
  (`midia.refazer`) é a exceção ao hash: o nome leva uma variação, é arquivo
  NOVO e sempre pago — sobrescrever o da descrição trocaria a imagem de todo
  pacote que a herdou. O provedor fora do ar ali é 503, e o estande fica com a
  imagem que tinha.
- **O podcast de recapitulação é da plataforma** (ADR-150, ADR-151,
  `src/podcast/`): aqui ficam o roteiro do one-pager ("A Mostra que Ninguém Viu
  Inteira", Bia e Rafa, em `podcast.ts`, puro) e a fonte (`podcast-fonte.ts`).
  O roteiro foi CORRIGIDO: sem número cravado ("os outros 12 projetos" e "três
  quartos" contradiziam a taxa real), Unoovista no lugar do `instanooria`, sem
  "da Unooria" dentro da ficção, e o texto fixo sem área (a mostra é da IA). As
  três vagas (os dois estandes de áreas diferentes, o feed do Rafa, o da mesa
  ao lado) a IA escreve com os estandes do rascunho e o professor revisa na
  criação; `homologar` as grava em `podcast_roteiros` na MESMA transação,
  também no segundo clique. **Sem banco padrão**, `padrao` é sempre `false`:
  atividade sem falas gravadas (a de antes do podcast) é 409
  `roteiro-indisponivel`. A atividade do podcast é `pacoteParaPodcast` — NÃO o
  `pacoteParaMidia`, que recusa o pacote de imagens aprovadas. **Ele revela a
  virada e toca depois da Galeria Oculta**: o módulo não tem trava por etapa,
  então quem avisa é o cartão da aula (pela etapa do gate) e o guia.

## A evidência (E14)

A ficha é `evidencias/fichas/exp06ef1b.ts` (versão 2, 2026-10-06): **EF06CO10**
(o foco primário) por `auditoria` e **EF06CO01** por `classificacao`, as duas no
latch da revisão sobre o MESMO registro da galeria, com réguas DIFERENTES
(`regras/evidencia.ts`): a CO10 conta os estandes OCULTOS abertos (≥ 2 =
atingiu; alguma coisa = em processo), a CO01 pede a hashtag de uma área ≠ do
voto E um oculto daquela área (buscou outra coisa = em processo). **Quem não
explorou fica SEM marca de ação** (ficha versão 3, 2026-10-07): não abrir nem
buscar é ausência de comportamento, não "não atingiu" — a régua devolve `null`,
o `marcar` não grava, e decide a pergunta da habilidade (vale o melhor). **EF06CO03** por `cadeia` (tentativas: 1
= atingiu, 2–3 = em processo, mais = não atingiu). E `p1` (CO10, a frase do
jurado), `p2` (CO01) e `p3` (CO03), verbatim da spec 9.6 — vale o melhor. A
`p1` tem alternativas `D1`–`D3`: as `A1`–`A3` eram da EF06CO07. Toda rodada mede as três AÇÕES de novo
(ADR-145). O resolvedor (`contextoDaAtividade`) devolve `null` antes de
`enquetes` e fora do (pacote, rodada) do gate. O texto da busca da galeria
nunca é gravado (só o tipo e a área); `certo` está em
`observabilidade/redaction.ts`.

## As suítes

- `tests/juri-estadual-regras.spec.ts` — SEM banco: a mostra da fixture contra
  a régua, o motor (abertura, bolha com duas curtidas = 9 de 16, feed passivo
  variado = 6 de 16, descurtir, permanência), `passoEfetivo` × etapa, ids
  opacos e a ordem nunca certa em 400 sementes, as réguas (e que a CO10 e a
  CO01 não medem a mesma coisa), o Zod da IA com casos ruins, a allowlist e o
  painel sem campo proibido.
- `tests/juri-estadual-midia.spec.ts` — SEM banco: "gerar outra imagem" (arquivo
  novo, pago, um por clique duplo, 503 sem gravar, 409 depois de aprovadas).
- `tests/juri-estadual-postgres.spec.ts` — RLS ISOLANDO (role sem
  `BYPASSRLS`), CHECKs e o vocabulário igual ao do código, a porta, o feed
  servido, os latches concorrentes, o portão, a auditoria (CO10 e CO01), a
  cadeia, as duas fases da aprovação, Mariana, o resolvedor, zerar e ADR-120, atividade × rodada, imagens, o painel
  por computador e o preparo com IA falsa.
- O podcast: `juri-estadual-regras.spec.ts` (o roteiro na régua e no teto,
  sem número cravado nem `instanooria`), `podcast.spec.ts` (as vagas, o texto
  fixo sem área, a escrita sempre com IA, o 409 sem falas) e
  `juri-estadual-postgres.spec.ts` (a homologação grava as falas na transação,
  o segundo clique as troca, e a atividade vale com as imagens aprovadas).
- A fixture (`tests/juri-estadual-fixture.ts`) é a mostra que a IA devolveria:
  não há acervo padrão para a suíte usar.

# apps/api/src/juri-estadual — O Júri Estadual de Projetos (exp06ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp06ef1b, rotas `/juri-estadual/*`)

Missão de 6º ano, unidade 1, no Unoovista (clone de rede social, seção
`unoovista` do DS). A criança é jurada de uma mostra científica estadual: rola
um feed de dez posts que as curtidas dela AFUNILAM em silêncio, vota numa
cédula lacrada (o LATCH 1) e espera a turma (o PICO: o professor projeta a
dispersão de votos). O professor libera a Galeria Oculta: ela vê o que nunca
chegou ao feed dela, com a taxa REAL de invisibilidade, busca por hashtag e
mantém ou troca o voto (o LATCH 2). Depois remonta a curtida em pacotes
(EF06CO07), monta a cadeia Interações → Dados → Algoritmo → Bolha (EF06CO03),
resolve o caso Mariana e responde as enquetes (P1–P3, pelas rotas de
`/evidencias`). Três tabelas: `exp06ef1b_pacotes`, `exp06ef1b_gates_turma`,
`exp06ef1b_sessoes`.

**A espinha é contrato com a experiência e o hub**: `vocabulario.ts`,
`conteudo.ts`, `invariantes.ts`, `erros.ts`, `contrato-de-rotas.ts`,
`regras/passos.ts` e `regras/afunilamento.ts`. Os dois lados têm espelhos
declarados dessas listas; mudar a forma aqui sem avisar quebra os dois em
silêncio.

- **Não há acervo padrão** (decisão de 2026-10-02): os dezesseis projetos (4
  áreas × 4) são da ATIVIDADE, gerados por IA no preparo e homologados pelo
  professor. Sem saldo de IA, não há atividade. O esqueleto fixo (pacotes,
  blocos, Mariana, cartões, plenária) vive em `conteudo.ts` e desce com o
  gabarito só em `GET professor/material`.
- **Atividade = o PACOTE; rodada = o "Zerar".** O gate (PK `turma_id`) diz qual
  (pacote, rodada) está em andamento, e a sessão é por essa dupla (UNIQUE
  `pacote_id, rodada, estudante_id`). Zerar sobe a rodada e volta à exploração
  **sem apagar nada**. Um ativo por turma: índice único PARCIAL
  (`exp06ef1b_pacotes_um_ativo`). `homologar` cria PRONTO (ADR-130) e é
  idempotente para o mesmo conteúdo; `colocarEmAndamento` desliga o anterior,
  liga o escolhido e aponta o gate para a rodada SEGUINTE à última com sessão.
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
- **Pacotes e cadeia têm ids OPACOS** (`regras/ordem.ts`): `pk-`/`bl-` + 3
  caracteres derivados da semente, estáveis num F5, e a ordem de chegada NUNCA
  coincide com a certa (re-embaralha com outro rótulo; a rotação é a garantia).
  Os cartões de Mariana descem embaralhados e sem `certo`.
- **Os CHECKs dos latches são equivalências com o passo gravado**: `votado_em ⇔
  passo ∉ {credencial, feed}`, `revisado_em ⇔ passo ≥ pacotes`, remontados ⇔ ≥
  `cadeia`, cadeia ⇔ ≥ `mariana`, cartões ⇔ ≥ `enquetes`, `fim ⇔ concluida_em`
  — e `galeria` nunca é GRAVADO (a etapa o impõe a quem está em `lacrada`). O
  voto revisado guarda o voto FINAL (manter repete o inicial; CHECK). O service
  grava carimbo e passo no MESMO update.
- **Os locks**: por estudante (o funil `garantirSessao`) e da TURMA — exclusivo
  para o botão, zerar, homologar e pôr no ar; compartilhado para as três
  jogadas que MARCAM evidência (revisão, pacotes, cadeia), que relêem o gate
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
  Sem imagem, a tela desenha a arte procedural. O podcast não existe.

## A evidência (E14)

A ficha é `evidencias/fichas/exp06ef1b.ts`: EF06CO01 por `auditoria` (no latch
da revisão, sobre o que a criança abriu e buscou na galeria —
`regras/evidencia.ts#nivelDaAuditoria`), EF06CO07 por `pacotes` e EF06CO03 por
`cadeia` (tentativas: 1 = atingiu, 2–3 = em processo, mais = não atingiu), e
`p1`–`p3` — vale o melhor. As três AÇÕES perguntam antes `jaAvaliadaAntes`
(ADR-120). O resolvedor (`contextoDaAtividade`) devolve `null` antes de
`enquetes` e fora do (pacote, rodada) do gate. O texto da busca da galeria
nunca é gravado (só o tipo e a área); `certo` está em
`observabilidade/redaction.ts`.

## As suítes

- `tests/juri-estadual-regras.spec.ts` — SEM banco: a mostra da fixture contra
  a régua, o motor (abertura, bolha com duas curtidas = 9 de 16, feed passivo
  variado = 6 de 16, descurtir, permanência), `passoEfetivo` × etapa, ids
  opacos e a ordem nunca certa em 400 sementes, as réguas, o Zod da IA com
  casos ruins, a allowlist e o painel sem campo proibido.
- `tests/juri-estadual-postgres.spec.ts` — RLS ISOLANDO (role sem
  `BYPASSRLS`), CHECKs e o vocabulário igual ao do código, a porta, o feed
  servido, os latches concorrentes, o portão, a auditoria, pacotes e cadeia,
  Mariana, o resolvedor, zerar e ADR-120, atividade × rodada, imagens, o painel
  por computador e o preparo com IA falsa.
- A fixture (`tests/juri-estadual-fixture.ts`) é a mostra que a IA devolveria:
  não há acervo padrão para a suíte usar.

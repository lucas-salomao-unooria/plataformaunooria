# apps/api/src/equipes — quem divide um computador na missão (E13, ADR-111)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## O que é uma equipe aqui

**Equipe é quem DIVIDE UM COMPUTADOR numa missão.** Não é grupo pedagógico: é a
resposta física a uma sala pública com menos máquinas que crianças. Dois ou três
estudantes sentam diante da mesma tela, com o login de um deles — e, sem isto, o
painel do professor contava a sala como se cada criança tivesse a própria tela
("12 não começaram", com os 12 sentados ao lado de quem começou).

Três tabelas de PLATAFORMA (sem prefixo de experiência, como `liberacoes`), todas
com `escola_id` + RLS forçada:

| Tabela | O que guarda |
|---|---|
| `equipes_montagens` | a decisão da aula por turma × missão: `modo`, `computadores`, `ausentes`, e a `versao` da concorrência otimista |
| `equipes` | cada computador: nome (1–30 depois do `trim`) e `ordem` |
| `equipes_membros` | quem senta diante de cada um — `turma_id`/`exp_id` repetidos para o UNIQUE de **uma equipe por criança por missão** |

## As regras

- **Só quatro missões aceitam equipe**: `EXPERIENCIAS_COM_EQUIPE` em `regras.ts`
  (exp08ef1b, exp02em1b, exp04ef1b, exp07ef1b). Lista no CÓDIGO, não coluna no catálogo:
  "funciona com duas crianças numa tela" é propriedade do desenho da missão, e
  missão que entra sem conferência abre para equipe e continua contando por
  criança no painel.
- **O tamanho é rígido** (`tamanhos`): diferem em no máximo 1, e `computadores`
  é limitado a `[1, n]`. `computadores ≥ presentes` = cada um no seu, e é
  legítimo.
- **O sorteio evita juntar os dois lados do Instanooria na mesma tela**, com os
  NEUTROS como enchimento, e CONTA as mistas quando a aritmética não fecha
  (`equipesMistas`). Quem sabe o lado é o módulo da missão, via
  `EquipesService.registrarFonteDeGrupo(expId, fonte)` — hoje NINGUÉM registra;
  sem fonte, `agrupamento` volta `null`.
- **Quem MONTA é só quem leciona** (`professorLeciona`, 404 e nunca 403 — mesma
  razão da sala). Gestor e admin só LEEM (`GET`).
- **A `sugestao` e a `ultima` NUNCA gravam.** Só o `PUT` escreve, e a troca é
  INTEIRA (apaga as equipes, grava as novas) — diff por equipe custaria a regra
  de "quem se moveu para onde" para economizar dezenas de linhas.
- **Concorrência otimista pela `versao`.** O `PUT` diz a versão em que a tela se
  baseou (`0` sem montagem); versão velha é 409 com `versaoAtual`. A trava é o
  banco: `updateMany ... WHERE versao = $esperada` pega o lock da linha, e a
  primeira montagem é `createMany` com `skipDuplicates` (`ON CONFLICT DO
  NOTHING`). **Não troque por `create` + captura de `P2002`**: erro dentro da
  transação a aborta, e a consulta da versão atual já não roda.
- **Estudantes da turma = `users.turma_id`** (`role = 'estudante'`), a mesma
  fonte dos painéis de missão. `users` está FORA da RLS: o `escolaId` no `where`
  é a tranca. Membro que saiu da turma some das leituras (`consulta.ts`), e a
  `ultima` o conta em `saidas`.
- **`GET /equipes/minha` é SEMPRE 200** (`equipe: null` quando não há): um 404
  viraria `api-recusou` no log do hub a cada abertura de missão. E `colegas` leva
  SÓ o primeiro nome (regra 6), desempatado AQUI quando repete na equipe, o
  próprio estudante incluso (`regras.ts#rotulosSemRepeticao`, cópia de
  `hub/lib/equipes.ts#rotulosCurtos` — mexeu numa escada, mexa na outra).
- **`GET` de missão sem equipe é 200 com `permitida: false`**, não 400: é por ele
  que o hub decide se desenha o bloco.
- **A sala do professor mostra a contagem** (`missoes[].equipes`, via
  `contarEquipesDaTurma`) — SÓ no schema do professor. `MissaoNaGradeSchema`
  também responde `/salas/minhas`, e o estudante não tem o que fazer com ela.

## Para os painéis

`consulta.ts` é a porta dos outros módulos, no molde de `comum/liberacao.ts`:
funções livres com `tx`, sem DI — `mapaDeEquipes`, `equipeDoEstudante`,
`contarEquipesDaTurma`, `computadoresDaMontagem`.

**Quem depende de a montagem MUDAR se registra em `aoMudarEquipes`** — hoje só a
evidência pedagógica (E14, `src/evidencias/`), que recalcula as cópias da rodada
em andamento. O `salvar` e o `desfazer` chamam os registrados DENTRO da
transação, depois da escrita: eles veem as equipes novas, e um erro neles desfaz
a montagem junto. A dependência vai num sentido só — evidencias importa
equipes, nunca o contrário.

**O UnooTube, o unooGPT e A Seleção já contam por COMPUTADOR.** O painel lê
`mapaDeEquipes` DENTRO do `comTenancy` e passa as linhas por
`regras.ts#colapsarEmUnidades`: uma unidade por equipe, representada pela linha
de quem INICIOU (com dois logins, o mais recente pelo `atualizado_em` da
sessão), e quem não tem equipe fica sozinho. A linha leva `equipe`, os totais
contam unidades e o resumo diz `porComputador`. Sem montagem, o painel sai
exatamente como era. Missão que entra em `EXPERIENCIAS_COM_EQUIPE` faz o mesmo
no painel dela, no mesmo trabalho — senão abre para equipe e segue contando por
criança.

**A Seleção (exp07ef1b) é a primeira que NASCE com equipe**, e leva o
computador além do painel: o PAREAMENTO do Mural colapsa as equipes
(`iniciou` = publicou, recência = a publicação) e pareia computadores, e o "X
de Y computadores" tira o Y de `computadoresDaMontagem` — o colapso conta
também os ausentes. O par fica CONGELADO na sessão dela (o rótulo é o nome da
equipe no momento do pareamento), e nunca `equipe:<id>`: o `PUT` recria os ids.

**O Instanooria é a próxima frente** (`feat/equipes-instanooria`): registrar a
fonte de lado, equipes do MESMO lado do feed, e o lado da equipe resolvido na
LARGADA do run (o run de um colega, ou a maioria; origem de lado `'equipe'`).
Nunca numa tabela pendurada em `equipes`: o `PUT` troca tudo e a cascata a
apagaria a cada edição (ADR-111).

## Armadilhas

- **Fora de `comTenancy`, tudo volta VAZIO, em silêncio** — as três tabelas têm
  RLS. O painel voltaria a contar por criança sem ninguém saber por quê.
- **Vocabulário em dois lugares**: `MODOS`/`NOME_MAX` e os CHECKs da migration
  `20260925120000_equipes_na_missao`. `tests/equipes-postgres.spec.ts` compara
  os dois — o par que já custou um deploy em `permissoes`.
- **Sem FK de `exp_id` para `experiencias`** (catálogo vazio em dev), como em
  `liberacoes`. E `atualizado_por` também não tem FK: é carimbo, e a saída de um
  professor da rede não pode travar a montagem da turma.
- **Postgres desmonta o `BETWEEN`** do CHECK em `>= 1 AND <= 30` no
  `pg_get_constraintdef` — teste que procura o texto original não casa.

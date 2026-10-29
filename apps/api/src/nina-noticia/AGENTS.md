# apps/api/src/nina-noticia — Nina e a Notícia que Desapareceu (exp03ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A missão (exp03ef1b 0.1.0 — instrumento 1.0.0 —, ADR-197, rotas `/nina-noticia/*`)

Missão de 3º ano, unidade 1, no Unoojornal (DS HÍBRIDO, ADR-197). A feira de
livros saiu em TRÊS suportes (mural, portal, telão), as três fotos mostram o
pátio, mas a ficha do telão tem o campo Onde VAZIO: a busca "Onde: Pátio" do
jornal o deixa de fora. Passos: `galeria → aposta → filtro → omissao → ficha →
carimbos → reparo → desfecho → ponte → rotina → caso → fim`. Dois portões da
professora: "Liberar Filtro" (`aposta → filtro`) e "Liberar Inspeção" (`filtro →
inspecao`), mais Pausar/Retomar (flag `pausada`) e Zerar (nova rodada, ADR-155).
Tabelas `exp03ef1b_*` (pacotes, gates_turma, gates_historico, sessoes).

O desenho é o do Júri (`src/juri-estadual/`): `nina-noticia.service.ts` (o
funil, os locks, o gate, o painel), `preparo.service.ts` (o texto com IA),
`midia.service.ts` (as imagens do pacote), `banco-padrao-imagens.service.ts`
(as do banco, do `admin`) e três controllers por papel (estudante, turmas,
banco padrão). Migração `20261028180000_exp03ef1b_nina_noticia`.

**A espinha é contrato com a experiência e o hub**: `vocabulario.ts`,
`conteudo.ts`, `banco-padrao.ts`, `invariantes.ts`, `erros.ts`,
`contrato-de-rotas.ts` (com o índice `ROTAS`) e `regras/`. Os dois lados têm
espelhos dessas listas; mudar a forma aqui sem avisar quebra os dois.

- **"aposta" é nome INTERNO** (passo e etapa). Na tela é "escolha" (ajuste do PO,
  spec §7.1); nenhuma frase de `erros.ts` diz "aposta", e o teste cobra.
- **A ESTRUTURA é do servidor, nunca da IA** (`conteudo.ts#FICHA_DO_SUPORTE`,
  `aplicarEstrutura`): três suportes na ordem; Quem = estudantes e Quando = sexta
  nas três; Onde = pátio no mural e no portal e VAZIO no telão; a foto é do pátio
  nas três. A IA escreve só texto e descrição de cena (`TextosGeradosSchema`);
  `invariantes.ts#problemasDoPacote` confere, inclusive que a cena do telão FALA
  do pátio — o prompt (`promptDaImagem`) exige o pátio inequívoco, porque K1
  ("A foto mostra o pátio?") é ✔.
- **O filtro é HONESTO** (`regras/filtro.ts`): booleano por campo, campo vazio
  nunca casa. Os valores de Quem e Quando oferecidos (`VALORES_DO_FILTRO`) NÃO são
  os da feira — só assim "Quem/Quando devolvem 0" (decisão 8) sem mentir no
  resultado. Só Onde = Pátio resolve; o resto conta em `filtro_tentativas`.
- **Gabaritos só no servidor**: os carimbos (K1 ✔ K2 ✖ K3 ✔ K4 ✔ K5 ? K6 ✖, em
  `conteudo.ts#CARTOES_DA_MISSAO`), a `SEQUENCIA_CERTA` da rotina e a regra do
  reparo. Ids OPACOS por sessão (`regras/ordem.ts`): `rp-` reportagens, `et-`
  etiquetas, `bl-` blocos. A bandeja da rotina é sorteada pela semente e NUNCA
  sai na ordem certa (teste em 500 sementes).
- **O reparo (spec §7.6, supera o item 7 da §0)**: a ficha do telão começa com
  os três campos vazios; `POST reparo` manda a ficha MONTADA (uma etiqueta por
  campo, as três); válido ⇔ Pátio em Onde, as outras duas gravadas e não
  avaliadas. Desfecho `sucesso | erro`, os dois com "Continuar".
- **Passo efetivo = min(passo, teto da etapa)** (`regras/passos.ts`): teto
  `aposta`/`omissao`/`fim`. Gravado acima do teto = aguardando a professora.
  `podeAgir`: pausada → 409 `turma-pausada`; jogada além do teto → 403
  `etapa-nao-liberada`; outra → 409 `passo-fora-de-ordem`. O gate só avança.
- **O painel** (`regras/painel.ts`): a linha diz progresso e os dois alertas
  (`semParada`: > 3 testes da rotina sem a válida; `uniformes`: os três carimbos
  de uma etapa iguais) — nunca acerto, escolha nem nível
  (`PROIBIDO_NA_LINHA_DO_PAINEL`, com teste). A escolha da E2 só no agregado.
- **Sem Canal B e sem podcast** nesta frente (spec §0.1 e §0.9).

## O funil e os dois relógios (o que quebra se você esquecer)

- **Toda jogada passa por `jogar`**: `garantirSessao` (escola, `exigirMissaoLiberada`
  — disponibilidade E liberação —, turma, gate, sessão criada com o lock POR
  ESTUDANTE antes da leitura) → lock COMPARTILHADO da turma com o gate RELIDO
  (rodada trocada = 409 `rodada-mudou`) → pausada = 409 `turma-pausada` →
  `exigirPasso` (`podeAgir`). Os botões da professora, o zerar, o homologar e o
  pôr no ar pegam o lock EXCLUSIVO. Rota nova de estudante que não passar por
  `jogar` (ou pelo `sessao`/`gate`) fura a porta da sala.
- **Os latches** (escolha, ficha, carimbos de cada etapa, reparo) têm três
  trancas: o lock por estudante, o `WHERE` com o estado anterior no `updateMany`
  e o CHECK. Concluído de novo = o código `*-ja-*`; os "avanços" (selos, filtro
  depois do certo, ficha aberta, rotina válida, concluir, `POST passo`) são
  idempotentes e devolvem o estado.
- **A semente é `id + rodada`** (`regras/ordem.ts#sementeDaSessao`), sem coluna:
  o zerar abre outra linha e sorteia tudo de novo. O banco grava SUPORTES,
  ETIQUETAS e BLOCOS, nunca o id opaco.
- **O gate**: `etapa` + `pausada`, com um carimbo por portão e `pausada_em`
  (CHECKs amarram os dois). Histórico append-only com `acao`
  `liberar|pausar|retomar|zerar` e quem apertou (`professor_id`, SET NULL).
- **O estudante não vê ficha antes do passo `ficha` EFETIVO**: quem confrontou
  e espera a "Liberar Inspeção" tem o gravado `ficha` e o efetivo `omissao` —
  `sessao.ficha` continua `null`.

## O preparo e as imagens

- **A IA escreve só texto** (`prompts.ts`, uma chamada): `pacoteDaIa` passa o
  texto pelo `TextosGeradosSchema`, põe a estrutura por cima e só aceita com
  `problemasDoPacote` vazio — reprovado, LANÇA e o provider regera. A
  homologação aplica `aplicarEstrutura` de novo antes de gravar; a LEITURA
  também (pacote torto sai com as fichas do servidor).
- **Fallback é da ROTA** (`gerar-conteudo`): sem saldo ou IA fora → 200 com o
  banco padrão, `usouIa: false`, `motivo` e as imagens do banco.
- **O banco padrão passa pela grade** (ADR-199): `usarBancoPadrao` cria o
  pacote com `imagens_aprovadas_em` NULO e as imagens do banco que existem; a
  professora gera as que faltam (`gerar-midia`), refaz e aprova. O
  reaproveitado FORA do ar ganha as que faltavam e, se ainda falta imagem do
  pacote, volta à aprovação; no ar, não muda. `porNoAr: true` aprova como está. Quota do
  perfil `professor` (`temSaldo` antes, o pago por tentativa depois); a medição
  é do `MedidorDeProvider`, recurso `nina-noticia` em `RECURSOS_DE_IA`.
- **Oito imagens, dois donos** (`regras/imagens.ts`): as do PACOTE (`mural`,
  `portal`, `telao`, `cartaz`), da professora, com quota e as duas fases de
  aprovação (ADR-146); as CENAS FIXAS (`caso-a`, `caso-b`, `extra-1`,
  `extra-2`), da PLATAFORMA — sem quota, atribuição `nina-noticia-banco-padrao`
  —, que nascem por dois caminhos (ADR-199): o `admin` em
  `/unooria/recursos/imagens-da-nina` (`POST /nina-noticia/banco-padrao/imagens`)
  ou o `gerar-midia` da professora, que gera em PARALELO as que faltam
  (`garantirCenasFixas`), inclusive quando ela está sem saldo (429 para as
  dela). A trava por ARQUIVO (`gerandoArquivo`, no serviço do banco) é dividida
  pelo `admin` e pelas professoras: cada cena é paga uma vez por processo. O
  arquivo é o hash do PEDIDO (`feira/<hash>.webp`): o que existe no bucket entra
  de graça; o refeito leva variação no nome. O pacote APROVADO antes de a cena
  existir fica sem ela (ilustração local) até outro pacote.
- **`TAMANHO_DA_IMAGEM` mora em `regras/imagens.ts`**: o `midia.service`
  injeta o serviço do banco, e o banco importar do `midia.service` faria ciclo
  de import (o decorator do Nest lê `undefined`).
- **As telas da professora só veem as quatro do pacote** (`imagensDoPacote`): o
  `z.record` do contrato recusa outra chave.

## A evidência (E14) — `regras/evidencia.ts`

Ficha `evidencias/fichas/exp03ef1b.ts` versão 1, só ação:
`inspecao` EF15CO08 (no `POST ficha`: certo de primeira e sem o pulso =
atingiu), `carimbos` EF03CO01 (no `POST carimbos` da E6; a UNIFORMIDADE vence:
uniforme = não atingiu; K3 ✔ e K5 ? e ≥ 5 de 6 = atingiu), `rotina` EF03CO02 (≤ 2
tentativas contando a válida), `reparo` EF03CO03 e `previsao` EF15CO01 (os dois no
`POST reparo`). Tarefa não feita = sem marca (`null`).

## As suítes

- `tests/nina-noticia-regras.spec.ts` — SEM banco: banco padrão e régua,
  gabaritos, filtro, latch da escolha, reparo, rotina (500 sementes), níveis,
  passos e gate, painel, allowlist do contrato e disciplinas contra o catálogo.
- `tests/nina-noticia-postgres.spec.ts` — a aula na ordem: porta da sala, banco
  padrão no ar, sessão sem gabarito, latch (inclusive concorrente), portões e
  pausa, filtro que conta, ficha, carimbos, reparo certo/errado, rotina, fim, as
  cinco marcas, painel, CHECKs comparados ao vocabulário, RLS e zerar.
- `tests/nina-noticia-midia.spec.ts` — SEM banco, com IA FALSA (só aqui): o
  preparo, a régua que regera, o fallback, as imagens do pacote, as cenas
  fixas no preparo (conta da plataforma, uma vez só com duas turmas, sem saldo)
  e as do banco (guarda de `admin` e a atribuição no painel de custos).

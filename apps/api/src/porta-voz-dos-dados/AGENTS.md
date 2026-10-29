# apps/api/src/porta-voz-dos-dados — O Porta-Voz dos Dados (exp03em1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão da 3ª série do EM, unidade 1 (ADR-198). Fonte: `artefatos_exp03em1b`
(PRD §11–§14, banco `01e`, copy `06`) com o **plano aprovado** por cima — as
diretrizes do PO e as decisões do Lucas de 2026-10-28. Onde o PRD diverge do
plano, vale o plano. Molde: `efeito-amplificador` (exp02em1b).

O estudante é o Porta-Voz Oficial de Dados da escola: recebe do Assistente de
Dados (bot determinístico, sem IA na aula) a tabela 95 → 94 → 92 → 88, abre (ou
não) a nota técnica, escolhe a escala (eixo em 0% ou recortado em 80%) e as
três camadas no compositor e **publica** no grupo da cidade (latch 1, slot
3 → 2). O grupo reage pelo ramo da escala dele, a Escola Santos Dumont publica
a mesma planilha com a escala oposta, o professor **pausa** as telas para o
debate e **libera a retomada**: a errata (slot 2 → 1) ou "Avançar sem publicar
errata", o laudo (Fator de Mentira ≈ 6,3) e a perícia dos dois cartões
eleitorais, que conclui.

## O que não é óbvio

- **O que é fixo mora em `conteudo.ts`, nunca no pacote**: os números
  95/94/92/88, as amostras, o laudo, a escola rival, os cartões A/B e o
  gabarito da perícia. A IA só escreve a ROUPAGEM (`ConteudoDoPacote`): o
  recorte do grupo (TC-02), a tabela, a nota técnica, os textos das camadas (a
  explicação da escala tem variante 0 e 80), as reações nos ramos 0 e 80 e o
  pós-Aha. A régua (`regras/pacote.ts`) recusa texto que crava outro número em
  % — ele desmentiria a tabela.
- **Correções de texto do PO**: Fator de Mentira "≈ 6,3" (nunca 6,37),
  variação visual ~46,7%; podcast TC-32 "renomados", TC-33 "que vocês
  montaram". O texto do `01e` tem as versões antigas: não copie de lá.
- **As publicações são LINHAS** (`exp03em1b_publicacoes`, única por sessão +
  tipo): a 1ª fica no histórico quando a errata sai. Não há 3ª publicação.
- **Quando cada habilidade é marcada** (`regras/evidencia.ts`): CO13 no
  publicar da 1ª; CO12, CO21, CO22 e CO26 na DECISÃO DA ERRATA (publicar ou
  pular) — elas leem o conjunto FINAL, e a porta `marcar` guarda a MELHOR
  marca: marcar na 1ª deixaria um "atingiu" que uma errata regressiva não
  apagaria. CO14 no parecer (ou no pular). Quem não chega ao gesto fica "Não
  avaliado".
- **CO26 (decisão 4)**: adequada = eixo 0 + fonte. 0 → 80 na errata é
  regressão (não atingiu); 80 → 0 conta como correção mesmo tirando a fonte.
  CO21: ligada na 1ª e desligada na errata = em processo.
- **O gate da turma**: `exploracao → pausa → liberada`, só para a frente, com
  histórico (EVT-P05). A pausa é camada: TODA rota POST do estudante responde
  409 `telas-pausadas` para quem não concluiu. A errata só abre com o gate em
  `liberada`; quem publica DEPOIS da liberação não pausa e vai direto à errata
  (decisão 7). O passo é derivado (`regras/passos.ts`).
- **`GET sessao` é read-only e é o polling**; toda rota POST faz o
  `garantirSessao` (cria a sessão da rodada) e devolve o estado inteiro.
- **Os marcos são do SERVIDOR** (`POST sessao/marco`): o horário que a CO13 lê
  é o da chegada, nunca o do cliente. O publicar carimba compositor e chat se a
  tela não os informou.
- **O gabarito não desce**: os cartões da perícia vão como peças (título,
  partido, eixo, fonte), e a resposta ao parecer não diz se acertou. O
  material do professor (`GET professor/material`) traz o gabarito.
- **O preparo**: `pacotes/padrao` = o banco curado JÁ homologado e no ar (2
  toques, não toca no rascunho); `gerar-conteudo` → rascunho (um por turma,
  índice parcial) → `regenerar {item}` → `homologar` (SÓ aprova, aceita a
  edição inline em `conteudo`) → `em-andamento {pacoteId}` (409 se não
  homologado; abre a rodada seguinte; o gate volta ao início). Quota do perfil
  `professor`, `temSaldo` → `consumir` por tentativa; a medição de custo é do
  `MedidorDeProvider`. Sem IA, o banco curado (ou o item como estava).
- **Zerar = ADR-155**: rodada + 1, evidência do pacote apagada, sessões ficam.
- **O podcast é FIXO e só do professor** (decisão 1): a sessão do estudante
  não leva nada do podcast.
- **Missão individual**: sem equipe (E13), e o painel não colapsa por
  computador. O painel é só contagem: sem ranking, sem nível, sem a escala de
  ninguém na folha nominal.
- **Sem texto livre do estudante**: nenhuma coluna guarda texto de menor.
- **Vocabulário em dois lugares**: disciplina, gate, escala, tipo, motivo e os
  CHECKs da migração `20261028190000`; `tests/porta-voz-dos-dados-regras.spec.ts`
  compara os textos.

## As duas suítes

- `tests/porta-voz-dos-dados-regras.spec.ts` — sem banco: as seis réguas em
  tabela, o passo e o gate, o parecer, a régua do pacote, o banco padrão e as
  correções do PO, o podcast e o espelho dos CHECKs.
- `tests/porta-voz-dos-dados-postgres.spec.ts` — a porta da sala em toda rota
  de estudante, o preparo com quota, a curadoria, a aula com o latch, a pausa,
  a errata e a perícia com as marcas, os latches concorrentes, a
  idempotência, o painel, a RLS com a role sem `BYPASSRLS` e o zerar.

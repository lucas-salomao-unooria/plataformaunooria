# apps/api/src/dossie-invisivel — O Dossiê Invisível (exp09ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 9º ano do EF, unidade 1 (ADR-202). Fonte: `artefatos_exp09ef1b`
(one-pager v5, banco `01e`, copy `06`, protótipo `08`) com o **plano
aprovado** de 2026-10-29 por cima — as diretrizes do PO e as decisões do
Lucas. Onde o PRD diverge do plano, vale o plano. Molde: `porta-voz-dos-dados`
(exp03em1b), com o classificador da `efeito-amplificador` (exp02em1b).

O estudante é o Conselheiro Relator: conversa com o assistente do conselho no
UnooriaAI sobre três projetos que disputam R$ 12.000 indivisíveis, registra a
escolha inicial com o ranking de três critérios (latch 1), vê os cadernos do
projeto em papel serem digitalizados e a recomendação se inverter com os
MESMOS critérios, confirma ou revisa a decisão depois do debate (latch 2),
lê Amara e monta o protocolo do assistente, que conclui.

## Fora desta versão (decisão do Lucas, 2026-10-29)

A Etapa 6 (Lia, Davi e a Linha 302 — a transferência) e o Canal B, inclusive
o "motivo estruturado" do 2º voto. O podcast foi reescrito no bloco 4 para não
citar o caso que saiu (`podcast.ts`).

## O que não é óbvio

- **Os PAPÉIS dos projetos são fixos; os nomes são do pacote.** O id que
  circula é `papel | parcial | nuvem`; o volume documental (1 → 180, 7, 12)
  mora em `conteudo.ts`. A régua do pacote (`regras/pacote.ts`) exige que a
  VIRADA sobreviva ao tema gerado: a nuvem vence antes, o papel depois.
- **A IA da aula só CLASSIFICA** (decisão do Lucas: híbrido). A pergunta vai
  primeiro ao classificador (quota `estudante`, teto de 5 s, confiança ≥ 0,7)
  FORA da transação; sem IA, a árvore do `01e` (`regras/intencoes.ts`). As
  sugestões exatas e o texto que tenta mandar no classificador nunca vão à IA.
  A fala é SEMPRE do catálogo. A mensagem do estudante guarda `intencao`,
  `classificador` e `arvore` (auditoria do piloto), que não descem.
- **A bifurcação**: a intenção `investigar_lacuna_cadernos` faz a oferta dos
  cadernos. Digitalizar antes da escolha = A1; ter a oferta e não digitalizar
  = A2; nunca ter perguntado = B. O caminho congela no latch 1.
- **Três travas do professor** (gate `exploracao → revelacao → revoto →
  explicar`, só para a frente, com histórico): a revelação abre a E4 (os
  cadernos de quem não digitalizou, a tabela, as pílulas); `revoto` é o
  DEBATE (o 2º voto só abre depois dele — o PO; o fluxo do design pulava); e
  `explicar` abre Amara e o editor. Não há pausa: as esperas são passos.
- **A conversa é texto livre de MENOR** (`exp09ef1b_sessoes.conversa`): fica
  para o F5 e para as âncoras da E5; não vai a painel, telemetria nem log.
- **As marcas** (`regras/evidencia.ts`): EF09CO08 no latch 1 (A1/A2 já
  atinge) e no latch 2 (o conjunto); EF09CO07 no protocolo. A reordenação do
  ranking sem a urgência acima da regularidade é "em processo" — proposta da
  implementação (G4), a régua do PO não cobria.
- **O protocolo não tem trava no cliente** (correção do PO de 29/10): ≥ 1 bloco
  entra; o gabarito (`GABARITO_DO_PROTOCOLO`, `BLOCO_DANOSO`) não desce, e o
  banco desce embaralhado por sessão (`embaralhar`). O ranking da E3 também
  nasce embaralhado (G7).
- **A fala de Amara** afirma a indução da turma só se ≥ 50% votou na nuvem na
  E3; senão, a variante neutra (G9).
- **As lacunas da copy** (as pílulas, "Ver Projetos", a espera do debate, o
  botão da 3ª trava, a fala neutra de Amara) foram escritas pela implementação
  e aceitas pelo Lucas em 30/10 — sem marcação no texto, que o estudante lê.
- **O preparo, o zerar e o podcast** seguem a exp03em1b: `pacotes/padrao` é o
  banco curado já aprovado e no ar; `gerar-conteudo` → rascunho →
  `regenerar` → `homologar` → `em-andamento`; zerar = ADR-155; podcast fixo,
  só do professor.
- **Missão individual**: sem equipe (E13).

## As duas suítes

- `tests/dossie-invisivel-regras.spec.ts` — sem banco: a conta da virada, a
  régua do pacote e o banco padrão, a árvore e a decisão IA × árvore, as duas
  réguas em tabela, o passo e o gate, o embaralhar, o podcast e o espelho dos
  CHECKs.
- `tests/dossie-invisivel-postgres.spec.ts` — a porta da sala, o caminho A1,
  A2 e B, os latches, as travas, as marcas, o gabarito ausente, o painel sem o
  texto do menor, a RLS e o zerar.

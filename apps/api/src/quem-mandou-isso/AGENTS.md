# apps/api/src/quem-mandou-isso — Quem Mandou Isso? v2.2 (exp05ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 5º ano, unidade 1. Esta é a v2.2, que substitui a v1 com o MESMO
código (ADR-114). Oito mensagens num grupo de WhatsApp simulado, na matriz 2x2
(verdadeira/falsa × emocional/neutra); o estudante encaminha EXATAMENTE três
ao Mural da Turma, vota no motivo, e só então o professor abre a revelação:
crachás e o **cartão de frases** (EF05CO03). Depois, a síntese e a reflexão:
a **regra do tio montada com peças** (EF05CO04). **Nasce com ficha (E14) e
com equipe (E13).** **Só Canal A desde o instrumento 2.4.0 (ADR-171)**: as
perguntas P1/P2 saíram (ficha v4, sem pergunta), como no 8º ano (ADR-167).
A regra Se/Então de TEXTO LIVRE saiu na ADR-145 e não volta: a tabela
`_reflexoes` e o carimbo `reflexao_em` ficam só pelo histórico, e nenhuma rota
os escreve — a regra nova é peça, guardada na sessão.

Quatro tabelas (`exp05ef1b_pacotes`, `_gates_turma`, `_sessoes`,
`_reflexoes`); CHECKs, índices parciais e RLS na migration
`20260926130000_exp05ef1b_quem_mandou_isso_v2`. O cartão e a regra são colunas
de `_sessoes` (`20261017090000_exp05ef1b_canal_a`).

## O que não é óbvio

- **O passo NÃO é coluna.** É `regras/passos.ts#passoEfetivo(latches, fase)`:
  `… → revelacao → sintese → cartao → regra → concluida`. Os latches são
  carimbos da sessão (`confirmado_em`, `votou_em`, `operacoes_em`, `regra_em`,
  `concluido_em`), cada um com CHECK exigindo o anterior; o do fim exige SÓ o
  voto (migração `20261005120000`): quem sai antes do cartão ou da regra fica
  "Não avaliado", nunca travado. O CHECK vale por statement — carimbo e dado
  no MESMO `UPDATE`. Uma coluna `passo` seria a terceira fonte de uma verdade
  que os carimbos já dizem. `grupo` cobre o grupo E o Mural.
- **A revelação NÃO empurra a triagem.** Quem não confirmou quando o professor
  abre a revelação continua no grupo, confirma, vota — e só então recebe a
  própria `revelacao` (e o `cartao`), junto com o passo da turma. O servidor
  não guarda "já viu os crachás"; a experiência os mostra antes do passo
  corrente.
- **O cartão segue o caminho DA CRIANÇA, não o botão do professor.** Abre na
  revelação DELA (voto dado + revelação aberta), em qualquer fase dali em
  diante, e fecha no envio. Na fase `reflexao`, quem não o enviou cai no passo
  `cartao` ANTES da `regra` — ninguém chega ao tio sem os crachás. A regra só
  aceita na `reflexao`, com o cartão enviado (`exigirEtapaDaRegra`).
- **O gabarito desce SÓ depois do voto E da revelação aberta**, e só o das três
  do estudante. As mensagens saem por `mensagensPublicas` (um `Omit`). O teste
  varre as CHAVES (`veracidade`, `tom`), não o texto. As frases do cartão
  descem SEM `esperado` (o servidor as RECALCULA da semente da sessão no envio
  e as grava com a resposta certa); as peças da regra descem só com id e
  rótulo — o tipo de cada ação e quais condições pegam o áudio
  (`regras/regra.ts`) são o gabarito, e quem simula é o servidor. Nada do
  acerto volta ao estudante.
- **A atividade da evidência é o PACOTE aprovado; a rodada é a reaplicação.**
  Aprovar cria a atividade PRONTA (ADR-130): o pacote em andamento continua, e
  a fase da turma não muda; aprovar de novo o MESMO que o aprovado mais recente
  é idempotente (a comparação é por `assinatura`, porque o JSONB reordena as
  chaves). Quem põe no ar é `colocarEmAndamento` (`POST
  :turmaId/pacotes/:pacoteId/em-andamento`): liga `ativo` no escolhido, abre a
  rodada SEGUINTE à última com sessão e volta a fase a `triagem` — senão a
  atividade nova nasceria com a revelação aberta. A lista das atividades é
  `GET :turmaId/pacotes` (os APROVADOS; o rascunho não é atividade). "Zerar a
  turma" é `rodada_atual + 1` e apaga a evidência do pacote (ADR-155); as
  sessões ficam.
- **As três marcas são de AÇÃO, cada uma na MESMA transação do seu latch.**
  Se a evidência falhar, o envio não fecha (há teste com o `marcar` quebrado).
  **Toda rodada marca de novo**, também no mesmo pacote (ADR-145).
  - **EF05CO08** no `POST /mural`: `regras/evidencia.ts#nivelCO08` (régua v2,
    ADR-120: só três verdadeiras atingem), nas 56 combinações.
  - **EF05CO03** no `POST /operacoes` (o cartão): `regras/operacoes.ts` — 6
    frases (2 E, 2 OU, 2 NÃO; cada mensagem em 2, com operadores diferentes;
    3 Sim e 3 Não, então "tudo igual" acerta 3). 5–6 atingiu, 3–4 em
    processo, 0–2 não atingiu; 10,9% de atingir no chute (testes exaustivos).
    Mesmas respostas = idempotente; outras = 409 `cartao-ja-enviado`.
  - **EF05CO04** no `POST /regra`: `regras/regra.ts#nivelCO04`, sobre a regra
    enviada E os testes (`POST /regra/teste`, com a PREVISÃO antes, até 5).
    Não atingiu = encaminha antes de checar; atingiu = a 1ª regra testada já
    pega o áudio e manda checar, a 1ª previsão acertou e a enviada continua
    assim; em processo = o resto, com TETO para quem checa e encaminha de
    qualquer jeito e para quem envia sem testar. A peça
    `encaminhar_se_confirmar` é o fim certo, depois de uma checagem; 5,0% de
    atingir no chute.
- **Não há resolvedor de contexto da E14** (saiu na 2.4.0, com o
  `OnModuleInit`): sem pergunta na ficha, `GET /evidencias/exp05ef1b/perguntas/*`
  responde 404, como na exp08ef1b. Não registre um de volta para "uma pergunta
  só": é reabrir o Canal B (ADR-171). Quem não faz a ação fica "Não avaliado"
  — a ausência de marca —, e o professor ajusta no painel de habilidades.
- **A turma do estudante é `users.turma_id`**, a mesma fonte do painel e das
  equipes — não o claim do token. Se divergissem, a criança jogaria numa sala
  que o painel do professor não mostra.
- **O painel conta por COMPUTADOR**: `mapaDeEquipes` DENTRO do `comTenancy` +
  `colapsarEmUnidades` (a linha de quem jogou representa a equipe). O
  Termômetro é `null` antes da revelação e não tem lugar para nome. A revelação
  do estudante leva as mesmas duas barras (sala sem projetor).
- **Não há texto livre novo.** O "Então" de antes da ADR-145 continua na
  tabela confinada e na redação do log (`entao`, `acaoEntao`, `acao_entao` em
  `observabilidade/redaction.ts`); não tire a redação. A regra do tio é PEÇA
  (`CONDICOES` e `ACOES`), e a folha mostra a regra em palavras
  (`regraEmPalavras`) e os acertos do cartão por operador.
- **A IA não decide a estrutura.** `regras/pacote.ts#sortearMolde` sorteia o
  tipo e o quadrante de cada posição (sorteado para a posição não virar pista
  entre turmas); o modelo só escreve, e a saída passa pela MESMA régua da
  curadoria (`validarPacote`). Sem saldo ou com o vendor fora, o rascunho sai
  do banco curado com `motivo` `sem-saldo`/`indisponivel` — a frase 429 × 503 da
  copy. A turma é conferida (404) ANTES de gastar token.
- **O rascunho é gravado** (um por turma, índice único parcial): o preparo
  custou saldo, e um F5 não pode jogá-lo fora. O ativo também é único por turma.
- **O GAP do preset** (default até o Lucas responder): imagem e link têm UMA
  verdadeira e UMA falsa cada. No preset, `msg_5` virou link (a prévia é texto
  novo) e `msg_7` virou texto. A versão original dos artefatos REPROVA na régua,
  e há teste que prende isso.
- **Tema = a frase da Nina.** "Rolou uma confusão sobre {tema}." — por isso o
  preset tem `tema: "o passeio ao museu"` (minúsculo, e a fala reproduz a copy
  literal) e `nome: "O Mistério do Passeio ao Museu"` para a vitrine. O tema
  herda as réguas do clone: ≤ 60 caracteres, ≤ 8 palavras, sem termo proibido.
- **Termos proibidos no clone**: `atividade`, `gabarito`, `nota`, `exercício`,
  por PALAVRA INTEIRA, sem acento, com plural ("notícia" passa). "Professor"
  fica de fora de propósito: a "Professora Helena" escreve no grupo da turma.
- **Vocabulário em dois lugares**: disciplina, origem, motivo, condição e fase
  estão no código e nos CHECKs (a condição em DOIS CHECKs: o de `_reflexoes` e
  `exp05ef1b_sessoes_regra_check`); a suíte de Postgres compara os textos.
- **O podcast de recapitulação é da plataforma** (ADR-150, `src/podcast/`):
  aqui ficam o roteiro do one-pager v2.2 (`podcast.ts`, Lucas e Camila, com o
  Unoochat no lugar do WhatsApp e sem a "regra da tela final" do Se/Então que
  saiu) e a fonte (`podcast-fonte.ts`). As três vagas (o que o grupo trazia, a
  falsa calma, a verdadeira desesperada) o professor revisa na criação, e
  `aprovar` as grava em `podcast_roteiros` na MESMA transação.

## As duas suítes

- `tests/quem-mandou-isso-regras.spec.ts` — sem banco: a régua do pacote, o
  preset e o GAP, o passo derivado, a EF05CO08 exaustiva, o cartão e a regra
  exaustivos (as chances no chute), as contas do
  Termômetro por unidade, o molde da IA em 500 sorteios, as falas da Nina, e a
  redação.
- `tests/quem-mandou-isso-postgres.spec.ts` — o que só o banco responde: RLS
  isolando com a role sem `BYPASSRLS`, CHECKs, a porta da sala em TODA rota de
  estudante (o cartão e a regra inclusive), latches sob toques simultâneos, as
  três marcas na transação de cada envio, a cópia para a equipe, o painel por
  computador, a rodada nova e o pacote novo.

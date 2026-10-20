# apps/api/src/quem-mandou-isso — Quem Mandou Isso? v2.2 (exp05ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 5º ano, unidade 1. Esta é a v2.2, que substitui a v1 com o MESMO
código (ADR-114). Oito mensagens num grupo de WhatsApp simulado, na matriz 2x2
(verdadeira/falsa × emocional/neutra); o estudante encaminha EXATAMENTE três
ao Mural da Turma, vota no motivo, e só então o professor abre a revelação:
crachás e o **alerta do grupo** (EF05CO03). Depois, a síntese e a reflexão:
o **robô do grupo montado com blocos** (EF05CO04). **Nasce com ficha (E14) e
com equipe (E13).** **Só Canal A desde o instrumento 2.4.0 (ADR-171)**: as
perguntas P1/P2 saíram, como no 8º ano (ADR-167). **Na 2.5.0 (ficha v5, ADR-177)** o
cartão de frases virou o alerta do grupo e a regra do tio com previsão virou
o robô do grupo, sem previsão.
A regra Se/Então de TEXTO LIVRE saiu na ADR-145 e não volta: a tabela
`_reflexoes` e o carimbo `reflexao_em` ficam só pelo histórico, e nenhuma rota
os escreve — a regra nova é peça, guardada na sessão.

Quatro tabelas (`exp05ef1b_pacotes`, `_gates_turma`, `_sessoes`,
`_reflexoes`); CHECKs, índices parciais e RLS na migration
`20260926130000_exp05ef1b_quem_mandou_isso_v2`. O alerta e o robô são colunas
de `_sessoes`: `alertas`/`alertas_em` (`20261020120000_exp05ef1b_alerta_e_robo`)
e `regra_testes`/`regra_final`/`regra_em`, reusadas da regra do tio
(`20261017090000_exp05ef1b_canal_a`). As colunas do cartão
(`frases_operacoes`, `respostas_operacoes`, `operacoes_em`) ficam pelo
histórico; nenhuma rota as escreve.

## O que não é óbvio

- **O passo NÃO é coluna.** É `regras/passos.ts#passoEfetivo(latches, fase)`:
  `… → revelacao → sintese → regra → concluida` (o passo `regra` é o robô; o
  nome ficou da 2.4.0, e o `cartao` saiu). Os latches são carimbos da sessão
  (`confirmado_em`, `votou_em`, `alertas_em`, `regra_em`, `concluido_em`),
  cada um com CHECK exigindo o VOTO; o do fim também (migração
  `20261005120000`): quem sai antes do alerta ou do robô fica "Não avaliado",
  nunca travado. O CHECK vale por statement — carimbo e dado
  no MESMO `UPDATE`. Uma coluna `passo` seria a terceira fonte de uma verdade
  que os carimbos já dizem. `grupo` cobre o grupo E o Mural.
- **A revelação NÃO empurra a triagem.** Quem não confirmou quando o professor
  abre a revelação continua no grupo, confirma, vota — e só então recebe a
  própria `revelacao` (e o `alerta`), junto com o passo da turma. O servidor
  não guarda "já viu os crachás"; a experiência os mostra antes do passo
  corrente.
- **O alerta NÃO é passo: é uma JANELA da revelação** (`passos.ts#alertaAberto`).
  Aceita jogada com o voto dado, a revelação DELA aberta e a turma AINDA na
  `revelacao`; a síntese fecha (409 `alerta-fechado`), e não reabre. Quem
  votou atrasado, depois da síntese, não tem alerta — fica "Não avaliado"
  (ADR-177: o cartão da 2.4.0 seguia o caminho da criança; o alerta, não).
  Na reflexão, TODO mundo vai ao robô: ele não exige o alerta
  (`exigirEtapaDoRobo`), e os CHECKs dele exigem só o voto.
- **O gabarito desce SÓ depois do voto E da revelação aberta.** `revelacao`
  traz o das três do estudante; `alerta.quadro` traz o das OITO (decisão de
  produto: o quadro mostra os crachás de todas para o filtro ter sobre o que
  operar). As mensagens do pacote saem por `mensagensPublicas` (um `Omit`), e
  o teste varre as CHAVES (`veracidade`, `tom`), não o texto. O que NUNCA
  desce: a expressão esperada de cada pedido (`regras/alerta.ts#PEDIDOS`) e o
  TIPO de cada ação do robô (`regras/robo.ts`). Quem executa o filtro e o robô
  é o servidor; a tela só pinta e anima.
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
  - **EF05CO03** no QUARTO `POST /alerta/envio`: `regras/alerta.ts`. Quatro
    pedidos fixos, um por vez; o filtro é `{a, op?, b?}` com `{attr, nao}`
    (36 possíveis; `op` e `b` juntos). `POST /alerta/execucao` grava cada
    "Ver resultado" (até 3 por pedido, 409 `limite-execucoes`; fora de ordem,
    409 `alerta-fora-de-ordem`); o envio exige a ÚLTIMA executada (400
    `execute-antes`). Equivalência por TABELA-VERDADE (a comutada vale). Cada
    pedido: 2 se a 1ª execução já era equivalente (e a enviada também), 1 se
    só a enviada, 0 senão; soma 6–8 atingiu, 3–5 em processo, 0–2 não
    atingiu. No chute (um filtro ao acaso por pedido, executado e enviado,
    36⁴ casos): 0,07% atingem, 1,65% em processo, 98,28% não atingem.
    Mesmo envio = idempotente (até depois de fechar); outro = 409
    `alerta-ja-enviado`. Menos de 4 enviados = sem marca.
  - **EF05CO04** no `POST /robo`: `regras/robo.ts#nivelCO04`, sobre o robô
    enviado E as ligações (`POST /robo/ligar`, até 5, 409
    `ligacoes-esgotadas`). O servidor executa o robô nas quatro mensagens
    fixas (`MENSAGENS_DO_ROBO`, sinais ABERTOS; a vizinha é o controle); sem
    o laço ele só olha a primeira. Os sinais são os do Figma: "urgente e
    alarmante" está nas TRÊS mensagens de risco (tio, banco, corrente), e
    parente, link e promessa em uma só — é o que dá sentido ao laço. Não
    atingiu = encaminha antes de checar; atingiu = laço + "urgente e
    alarmante" + ações que checam antes de encaminhar, já na PRIMEIRA
    ligação, e o enviado continua assim; em processo = o resto (inclusive
    condição que pega uma só e enviar sem ligar). No chute (512 robôs,
    ligado uma vez e enviado): 6,25% / 62,5% / 31,25%. Sem previsão: o Figma
    a tirou, e ligar o robô é a simulação. A duração do áudio ("0:23") é
    parte do `remetente` fixo, não campo.
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
  `observabilidade/redaction.ts`); não tire a redação. O robô é BLOCO
  (`CONDICOES` e `ACOES`), e a folha mostra o robô em palavras
  (`roboEmPalavras`) e os pontos do alerta (`{pontos}/8 · {enviados}/4`).
- **O rótulo do quadro é DERIVADO do remetente** ("Mensagem de Pedro
  Henrique"; no alerta, "a mensagem de …"), sem campo novo no pacote: um
  rótulo curto escrito pelo professor ou pela IA seria mais uma régua no
  preparo, e o remetente já é o que a criança reconhece no grupo.
- **Linha da 2.4.0 continua legível.** O teste da regra do tio (com
  `previsao`, sem `laco`) é lido como ligação de robô SEM laço, e a regra
  enviada, como robô sem laço — a folha não quebra no histórico.
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
  `exp05ef1b_sessoes_regra_check`, que vale para o robô); a suíte de Postgres
  compara os textos.
- **O podcast de recapitulação é da plataforma** (ADR-150, `src/podcast/`):
  aqui ficam o roteiro do one-pager v2.2 (`podcast.ts`, Lucas e Camila, com o
  Unoochat no lugar do WhatsApp e sem a "regra da tela final" do Se/Então que
  saiu) e a fonte (`podcast-fonte.ts`). As três vagas (o que o grupo trazia, a
  falsa calma, a verdadeira desesperada) o professor revisa na criação, e
  `aprovar` as grava em `podcast_roteiros` na MESMA transação.

## As duas suítes

- `tests/quem-mandou-isso-regras.spec.ts` — sem banco: a régua do pacote, o
  preset e o GAP, o passo derivado, a EF05CO08 exaustiva, o alerta (36⁴) e o
  robô (512) exaustivos (as chances no chute), as contas do
  Termômetro por unidade, o molde da IA em 500 sorteios, as falas da Nina, e a
  redação.
- `tests/quem-mandou-isso-postgres.spec.ts` — o que só o banco responde: RLS
  isolando com a role sem `BYPASSRLS`, CHECKs, a porta da sala em TODA rota de
  estudante (o alerta e o robô inclusive), latches sob toques simultâneos, as
  três marcas na transação de cada envio, a janela do alerta (a síntese
  fecha), os 400/409 do alerta e do robô, os CHECKs novos, a cópia para a
  equipe, o painel por computador, a rodada nova e o pacote novo.

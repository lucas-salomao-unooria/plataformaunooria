# apps/api/src/a-selecao — A Seleção (exp07ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A Seleção (exp07ef1b, `apps/api/src/a-selecao`, rotas `/a-selecao/*`)

Missão de 7º ano, unidade 1, no clone do Instagram, conduzida pelo **relógio da
turma** numa aula. O estudante rola 12 posts de três veículos sobre o mesmo
evento, poda os salvos até três, publica nos Stories com uma legenda (o LATCH),
e no Mural vê a própria tríade ao lado da de um colega que contou outra
história com os mesmos fatos. Quatro tabelas: `exp07ef1b_coberturas`,
`exp07ef1b_gates_turma`, `exp07ef1b_sessoes`, `exp07ef1b_reflexoes`. É a
**segunda missão com ficha pedagógica** (E14), depois de Quem Mandou Isso? v2.2,
e a primeira em que o dado do MURAL é do computador (E13, o gatilho da ADR-111).

- **Atividade = a COBERTURA; rodada = o "Zerar".** O gate da turma diz qual
  (cobertura, rodada) está em andamento, e a sessão é por essa dupla. Zerar
  sobe a rodada e volta à exploração **sem apagar nada** — a rodada passada é o
  que o painel de habilidades mostra (ADR-112): zerar que apaga é o que a
  evidência não pode ter (ADR-114). Uma ativa (= EM ANDAMENTO) por turma:
  índice único PARCIAL, que o Prisma não enxerga (não está no schema nem no
  `migrate diff`).
- **A plataforma NUNCA cria a cobertura (ADR-130).** `homologar` cria a
  atividade PRONTA (`ativa: false`) — a em andamento continua —, e
  `colocarEmAndamento` (`POST :turmaId/coberturas/:coberturaId/em-andamento`) é
  o "Usar esta atividade agora": desliga a anterior, liga a escolhida e aponta o
  gate para a rodada SEGUINTE à última com sessão, na exploração (retomar a
  mesma depois do Mural seria o "voltar" proibido). Sem gate, `exigirGate`
  responde 403 `atividade-nao-preparada` em toda rota que lê a em andamento —
  a tela de "ainda não foi aberta" que a experiência já mostra, sem mudar o
  bundle. O banco curado da Praça Central virou o ponto de partida da CRIAÇÃO
  (`GET professor/material` traz também as falas do podcast).
- **A aprovação tem DUAS fases (ADR-146).** `homologar` é a dos textos e grava a
  cobertura com `imagens_aprovadas_em` NULO; `POST …/coberturas/:c/aprovar-imagens`
  (idempotente) é a das imagens. Sem ela, `colocarEmAndamento` responde 409
  `imagens-nao-aprovadas`: a turma abriria com imagem que ninguém viu. NÃO exige
  todas as imagens prontas — a geração falha e a quota acaba, e o post segue com
  o card da descrição, que o professor viu no mesmo card. As coberturas de antes
  entraram aprovadas na migração (nenhuma turma trava por regra posterior).
- **Imagens e podcast aceitam `?coberturaId=`**: a professora prepara a
  atividade PRONTA antes de pô-la no ar. Sem o parâmetro, a em andamento.
- **O gabarito do post (enquadramento, fonte, ângulo) e a matriz só descem no
  Mural, com `etapa ≥ fichas`.** O post do estudante sai por `postPublico`, uma
  ALLOWLIST: campo novo no catálogo nasce fora da resposta. A matriz é calculada
  no servidor a partir da cobertura; o cliente manda três ids.
- **A etapa só conduz quem PUBLICOU** (`regras/passos.ts#passoEfetivo`): antes do
  latch a criança segue no feed com o Mural aberto, e publica atrasada. Por isso
  o CHECK `(publicada_em IS NOT NULL) = (passo NOT IN ('desafio','feed','salvos'))`
  é uma equivalência — o passo gravado só sai da zona de antes pelo latch.
- **O botão único** (`POST :turmaId/gate {para}`) diz a etapa de DESTINO:
  idempotente, uma por vez, nunca pula nem volta (409
  `transicao-de-etapa-invalida`).
- **O Mural é do COMPUTADOR** (a resposta ao gatilho da ADR-111). Abrir o Mural
  pareia a sala na mesma transação, com o lock EXCLUSIVO da turma; a publicação
  pega o COMPARTILHADO e relê o gate depois dele — uma publicação em voo não fica
  fora do pareamento, nem é pareada com a etapa velha. As sessões viram unidades
  por `colapsarEmUnidades` (`iniciou` = publicou), e `regras/pareamento.ts` pareia
  pela DISTÂNCIA MÁXIMA das matrizes, gulosa. Recebem o colega virtual (Tomás ou
  Malu, o mais distante): quem sobra, quem só tem par de tríade igual, a sala de
  um computador (projeção) e quem publica depois do Mural aberto (a não ser que
  um colega de tela já tenha par: aí é o mesmo).
- **O par é CONGELADO na sessão** — `par_sessao_id` (sem FK), `par_virtual`,
  `par_rotulo` (o nome da equipe, ou o primeiro nome por `rotulosSemRepeticao`).
  Nunca `equipe:<id>`: o `PUT` das equipes recria os ids, e o Mural de quem já viu
  a sala perderia o par. Renomear a equipe depois não muda o rótulo.
- **O painel conta por computador.** O "X de Y computadores"
  tira o Y de `computadoresDaMontagem`, porque o colapso conta também quem faltou.
  O representante do computador é quem PUBLICOU antes de quem só entrou.
- **O recorte da ADR-108**: `legenda` e `reflexaoTexto` só vêm preenchidos com
  `professorId`. `professorLeciona` responde `true` a `undefined` (gestor vê a
  escola), então quem só olha o `@Roles` conclui o contrário do que acontece.
  Sem nível nem nota por criança (`PROIBIDO_NO_PAINEL`, com teste).
- **O CANAL A** (`classificacao.service.ts`): a legenda graduada para a EF07CO11
  DEPOIS do latch, fora da transação dele — rate limit, `temSaldo`, `generateJson`
  (padrão, temperatura 0, uma tentativa, schema com enum, `validar` que recusa
  motivo incoerente, SEM teto de saída — o Gemini 3 raciocina e o raciocínio sai do mesmo orçamento, ADR-148), teto de ~6 s por `Promise.race` (o provider não
  tem timeout) e o débito no `aoUsarTokens`, para cobrar a chamada que perde a
  corrida. A marca vai numa transação SÓ DELA, e só se a (cobertura, rodada) do
  gate ainda é a lida no latch. **Falhou qualquer passo, nada é marcado** ("Não
  avaliado"); em dev e na e2e, com o mock, é sempre assim. Nada do que a IA
  escreve é gravado; o log leva o código. Nunca derruba a resposta: a
  publicação já foi gravada.
- **O sanitizador da legenda** (`sanitizador.ts`) barra link, telefone, e-mail,
  `@` de fora da ficção e palavrão com 422 e código estável — outra criança vai
  ler. As contas da ficção (`ARROBAS_DA_FICCAO`) podem ser citadas: citar a fonte
  É o critério editorial que a EF07CO11 procura.
- **Code points dos dois lados**: Zod com `[...s].length`, a coluna `chars` com o
  mesmo número, e o CHECK `chars = char_length(texto)`. Zod em `length` com banco
  em `char_length` divergem em emoji (dois code units, um code point).
- **As imagens** (`midia.service.ts`) são do professor, INCREMENTAIS (até duas
  novas por chamada: o BFF corta em 30 s), com o nome do arquivo = hash da
  descrição em `experiencias/exp07ef1b/selecao/` — a mesma cena serve a rede
  inteira, e a mídia do Eco (fora de `selecao/`) não colide. As URLs moram em
  `coberturas.midia`, gravadas com `midia || jsonb_build_object(...)`. Os posts de
  métricas do banco curado não pedem imagem: a experiência desenha o gráfico.
- **"Gerar outra imagem" é a exceção ao hash** (`midia.regerar`, ADR-146): o
  nome leva uma variação (`nomeDaImagem(descricao, randomUUID())`), então é
  arquivo NOVO e sempre pago. Sobrescrever o da descrição trocaria a imagem de
  toda cobertura que a herdou, inclusive a de uma turma em aula. Só antes de
  `aprovar-imagens` (409 `imagens-ja-aprovadas`); post de gráfico, 400
  `post-sem-imagem`.
- **Comentário de leitor é `{autor, mensagem}`** (ADR-146), nunca `texto`: esse
  nome está em `CAMPOS_SENSIVEIS` (é a reflexão da criança) e o teste do
  `postPublico` o recusa. A IA escreve o autor; `autorConferido` exige
  `/^[a-z0-9._]{3,24}$/`, tira o `@` e recusa perfil de veículo, e o fora disso
  (e a cobertura antiga, de strings) recebe o `autorDeReserva` do post e da
  posição — o lote não é regerado por causa de um apelido.

## A evidência (E14)

A ficha é `evidencias/fichas/exp07ef1b.ts`: EF07CO11 por `legenda-publicada`
(ação, o Canal A) e `p1`; EF07CO08 por `p2`. As enquetes usam as rotas genéricas
`/evidencias/exp07ef1b/perguntas/:id`, que embaralham as alternativas a cada
leitura para toda ficha (ADR-118). O resolvedor
(`contextoDaAtividade`) devolve `null` antes de `enquetes` e quando a sessão não é
a (cobertura, rodada) do gate — por isso o zerar tranca a resposta atrasada.

## O podcast de recapitulação (é do PROFESSOR)

O "Podcast de Recapitulação" do PRD (Lucas e Clara, ~3m45s) — o roteiro é o do
sheet aprovado (`podcast.ts`). O texto fala com o estudante, mas a decisão do
dono do produto é que ele é do professor, que toca à turma depois
da aula se quiser: rotas em `a-selecao-turmas.controller.ts`, nenhuma de
estudante.

- **Só três falas mudam com o tema** — as do Bloco 2 que dizem o que cada
  veículo mostrou (`FalasDoTema`). Num tema da IA elas saem do MESMO lote do
  preparo (`prompts.ts#SCHEMA_DO_PREPARO.podcast`), sob a mesma régua da
  homologação (`problemasDasFalasDoTema`), e a professora as revisa antes de
  aprovar. Moram em `exp07ef1b_coberturas.podcast`; NULO = as do sheet.
- **A voz é o TTS do Gemini pelo provider** (`generateSpeech`: Cloud TTS com os
  modelos Gemini, `VERTEX_TTS_MODEL`), Lucas e Clara numa chamada de DIÁLOGO por
  bloco, com a direção do brief (`DIRECAO_DO_PODCAST`). Um trecho por
  `POST gerar-podcast` — o episódio inteiro não cabe nos 30 s do BFF — e, com os
  cinco, a mesma chamada emenda o MP3 (`regras/mp3.ts`: tira as ID3 e o quadro
  Xing/Info de cada trecho, que declararia a duração errada).
- **O nome do trecho é o hash do texto e do pedido de voz** (`nomeDoTrecho`):
  os Blocos 1, 3, 4 e 5 saem uma vez por contrato, e só o Bloco 2 de um tema novo
  custa síntese. Mudou direção, timbre ou texto fixo? Suba
  `VERSAO_DO_PEDIDO_DE_VOZ`, senão o contrato mistura gravações de dois pedidos.
- **Sem áudio, nada quebra**: o roteiro É a transcrição, e a tela a mostra
  sempre. O mock falha fechado, então em dev e na e2e o caminho que roda é o da
  transcrição com o player desabilitado.

## As suítes

- `tests/a-selecao-regras.spec.ts` — SEM banco: matriz, pareamento, `passoEfetivo`
  × etapa, transições do gate, sanitizador, code points no limite, o catálogo
  contra os critérios do brief (4:4:4, 20–45 palavras, termo proibido), o Zod do
  lote da IA e o Canal A caindo em "Não avaliado" (com provider falso e quota em
  memória).
- `tests/a-selecao-podcast.spec.ts` — SEM banco: o roteiro (os blocos fixos não
  mudam com o tema; todo trecho cabe nos 4.000 bytes da síntese), a régua das
  três falas, os nomes pelo hash, a emenda com quadros MP3 sintéticos e o serviço
  com provider, bucket e quota falsos (um trecho por chamada, a emenda no fim, o
  tema novo que só paga o Bloco 2, sem saldo e falha).
- `tests/a-selecao-postgres.spec.ts` — o que só o banco responde: a RLS ISOLANDO
  (com a role sem `BYPASSRLS`), os CHECKs, o latch sob dois toques, zerar e tema
  novo, pares por computador e o par que sobrevive ao `PUT` das equipes, o recorte
  do gestor, o resolvedor, o Canal A com IA falsa (válida, inválida, sem saldo,
  atrasada) e a cópia para a equipe e a projeção `a_revisar`.

Armadilha que a suíte já pagou: **o rate limit do Canal A é em memória e por
estudante** (três por janela), e cada publicação passa por ele mesmo com a IA
desligada. Um estudante que publica em vários blocos da suíte esgota o limite, e
o Canal A do bloco seguinte cai em `limite` em silêncio — daí os estudantes
próprios do bloco do Canal A.

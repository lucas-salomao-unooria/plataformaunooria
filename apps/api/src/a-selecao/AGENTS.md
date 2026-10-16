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
  sobe a rodada, volta à exploração e **apaga a evidência da cobertura**, de
  todas as rodadas (ADR-155, `evidencias/apagar-da-atividade.ts`); as sessões
  ficam. Uma ativa (= EM ANDAMENTO) por turma:
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
- **O CANAL A da legenda** (EF07CO11, ADR-170, `classificacao.service.ts`): a
  leitura nasce `pendente` no latch e roda DEPOIS da resposta (`agendarLeitura`,
  `void` — a suíte espera com `esperarLeituras`): rate limit, a QUOTA DE
  AVALIAÇÃO da escola (ADR-169, nunca a do estudante), `generateJson` (padrão,
  temperatura 0, SEM teto de saída, ADR-148), teto de 60 s por tentativa e até
  3 tentativas para a falha técnica. A IA devolve só INDICADORES (`razao`,
  `conteudo`, `semRelacao`); o nível é `prompts.ts#nivelDosIndicadores`. A marca
  vai numa transação só dela, e só se a (cobertura, rodada) do gate ainda é a do
  latch. **Falhou tudo: a RESERVA** (`regras/legenda-reserva.ts`) grava os
  indicadores dela e a SUGESTÃO na sessão (`legenda_leitura = 'reserva'`), SEM
  marca — "Não avaliado" até o professor ajustar; ela nunca sugere
  `nao_atingiu`. Nada do que a IA escreve é gravado.
- **A MARCAÇÃO** (EF07CO08, ADR-170): etapa `marcacao` da turma, obrigatória,
  entre `mural` e `fichas`. `POST marcacao` (`{postId}` do PAR ou `{nenhum}`,
  a última vale; 409 `marcacao-fechada` fora da etapa, 422
  `marcacao-fora-do-par`) e `POST marcacao/porque` (texto de menor, sanitizado,
  só o professor lê; em `CAMPOS_SENSIVEIS`). O nível CONGELA na
  transição para `fichas` (`congelarMarcacoes`, `regras/marcacao.ts`); sem
  marcação, sem marca. "Alternou para o colega" não entra: o Mural já abre no
  par.
- **A conferência do enquadramento** (ADR-170, `conferencia.service.ts`): na
  `homologar`, os posts que a professora EDITOU (`editados`) passam por UMA
  chamada de IA, na quota do professor; divergiu → 422
  `enquadramento-divergente` com `posts`, e nada é gravado; a IA falhou → cria
  mesmo assim, com `conferencia: "nao-conferida"`.
- **Sem enquetes** (o Canal B saiu): a reflexão leva ao `fim`. O passo
  `enquetes` fica no vocabulário só para sessão de antes; `concluir` a fecha.
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

A ficha é `evidencias/fichas/exp07ef1b.ts`, versão 2 (ADR-170): EF07CO11 por
`legenda-publicada` e EF07CO08 por `marcacao-colega`, as duas AÇÃO e com
`rotulo`, e nenhuma pergunta. Sem resolvedor de contexto: nenhuma rota de
pergunta conta aqui. O painel da aula NÃO leva nível (`PROIBIDO_NO_PAINEL`): a
leitura da legenda vai como ESTADO (`leituraDaLegenda`) e a marcação como o post
apontado.

## O podcast de recapitulação (é do PROFESSOR)

O "Podcast de Recapitulação" do PRD (Lucas e Clara, ~3m45s) — o roteiro é o do
sheet aprovado (`podcast.ts`). Desde a ADR-150 as rotas e o motor do áudio são
da plataforma (`src/podcast/`, `/podcast/exp07ef1b/…`); aqui ficam o roteiro e
a fonte (`podcast-fonte.ts`, registrada no `onModuleInit`).

- **Só três falas mudam com o tema** — as do Bloco 2 que dizem o que cada
  veículo mostrou (`FalasDoTema`). Num tema da IA elas saem do MESMO lote do
  preparo (`prompts.ts#SCHEMA_DO_PREPARO.podcast`), sob a régua do módulo
  `podcast` (`problemasDasFalasDoTema`), e a professora as revisa antes de
  aprovar. Moram em `exp07ef1b_coberturas.podcast` (NULO = as do sheet) — a
  A Seleção é a única missão que NÃO usa a tabela `podcast_roteiros` nem a
  escrita `falas-do-tema`, e a fonte as entrega como `falasProprias`.
- **Os nomes no bucket não mudaram com o motor comum**: o prefixo
  `selecao/podcast/` e os insumos do hash são os de antes, e
  `tests/a-selecao-podcast.spec.ts` congela os nomes dos cinco trechos e do
  episódio. Mudou direção, timbre ou texto fixo? Suba
  `VERSAO_DO_PEDIDO_DE_VOZ`, senão o contrato mistura gravações de dois pedidos.

## As suítes

- `tests/a-selecao-regras.spec.ts` — SEM banco: matriz, pareamento, `passoEfetivo`
  × etapa, transições do gate, sanitizador, code points no limite, o catálogo
  contra os critérios do brief (4:4:4, 20–45 palavras, termo proibido), o Zod do
  lote da IA e o Canal A caindo em "Não avaliado" (com provider falso e quota em
  memória).
- `tests/a-selecao-podcast.spec.ts` — SEM banco: o roteiro (os blocos fixos não
  mudam com o tema; todo trecho cabe nos 4.000 bytes da síntese), a régua das
  três falas, os nomes pelo hash (congelados), a emenda com quadros MP3 sintéticos e o motor
  da plataforma pela fonte da A Seleção, com provider, bucket e quota falsos (um trecho por chamada, a emenda no fim, o
  tema novo que só paga o Bloco 2, sem saldo e falha).
- `tests/a-selecao-postgres.spec.ts` — o que só o banco responde: a RLS ISOLANDO
  (com a role sem `BYPASSRLS`), os CHECKs, o latch sob dois toques, zerar e tema
  novo, pares por computador e o par que sobrevive ao `PUT` das equipes, o recorte
  do gestor, a marcação (janela, par, por quê, congelamento), a leitura da
  legenda com IA falsa (indicadores, pendente, reserva, sem saldo de avaliação)
  e a cópia para a equipe e a projeção `a_revisar`.

Armadilha que a suíte já pagou: **o rate limit do Canal A é em memória e por
estudante** (seis por janela: duas leituras de três tentativas), e cada publicação passa por ele mesmo com a IA
desligada. Um estudante que publica em vários blocos da suíte esgota o limite, e
o Canal A do bloco seguinte cai em `limite` em silêncio — daí os estudantes
próprios do bloco do Canal A.

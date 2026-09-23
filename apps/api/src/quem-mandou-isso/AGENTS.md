# apps/api/src/quem-mandou-isso — Quem Mandou Isso? (exp05ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Quem Mandou Isso? (exp05ef1b, `apps/api/src/quem-mandou-isso`)

Missão de 5º ano conduzida pelo **relógio da turma**, numa aula. Cinco tabelas
(`exp05ef1b_conteudo_turma`, `exp05ef1b_sessoes`, `exp05ef1b_encaminhamentos`,
`exp05ef1b_reflexoes`, `exp05ef1b_gates_turma`), gabarito no lote da turma, e IA numa
superfície só — o preparo pré-aula.

- **A missão NASCE VAZIA.** Sem lote homologado (`aprovado_por_professor`), o
  estudante vê tela de espera, e não o banco curado. É a diferença para a
  exp08ef4b, onde o não-preparo cai no default e a aula corre: aqui o lote inteiro
  é escrito em cima do TEMA que a professora escolheu, e mostrar outro faria a
  criança ler mensagens sobre um acontecimento que não existiu na escola dela.
  **A tela do PROFESSOR tem a queda** (`GET turmas/:id/conteudo` devolve o banco
  curado como rascunho); a do estudante, não.
- **O gabarito só existe dentro de `revelacao`, e `revelacao` só é montada
  quando a etapa da turma passou de `exploracao`.** O lote do estudante sai por
  `mensagensPublicas`, que é um `Omit` de `veracidade`/`tom`/`explicacao` — o
  vazamento pelo lote reprova no `tsc`, não no DevTools de uma criança. Antes do
  telão, `revelacao` é `null` e nenhum pedaço do gabarito está na resposta.
- **`iniciar-revelacao` mexe no PISO do passo**, diferente do gate da exp08ef4b que
  só mexe no teto: quem não confirmou é empurrado para `revelado`. Deixá-lo
  continuar encaminhando com o gabarito projetado na parede mediria outra coisa.
- **Só quem CONFIRMOU entra no histograma** (`confirmado_em IS NOT NULL`).
  Contar a curadoria em andamento mostraria à turma uma escolha que a criança
  ainda podia desfazer. E nenhum nome chega a `contaDaTurma` — a assinatura não
  tem lugar para ele (PED-07).
- **Carimbo e passo no MESMO `update`.** Os CHECKs da migration valem por
  STATEMENT, não por transação: `confirmado_em` com `passo`, e `passo = 'fim'`
  com `concluido_em` (a segunda é uma EQUIVALÊNCIA — um sem o outro reprova). Um
  service que grave os dois em UPDATEs separados passa nos testes e quebra em
  produção, no meio da aula.
- **Quem não confirmou antes do telão não entrega a reflexão** (409
  `curadoria-nao-confirmada`): o par (snapshot do Mural, reflexão) é o que a
  missão mede. A saída não é código — é a professora apertando
  `voltar-exploracao`, que reabre a curadoria sem apagar nada. A frase do erro
  manda chamá-la, de propósito.
- **O texto da reflexão é do PROFESSOR DA TURMA, e aqui isso é verdade de
  código.** A rota do painel responde a `professor` e aos GESTORES; dentro dela,
  `reflexaoTexto` só vem preenchido quando há `professorId` — gestor de escola,
  gestor de contrato e `admin` recebem `null`, e `entregouReflexao` continua
  respondendo "a criança entregou?". A armadilha que produziu isso:
  `professorDoToken` devolve `undefined` para quem não é professor, e
  `professorLeciona` responde `true` a `undefined` (gestor vê a escola inteira),
  então quem só olha o `@Roles` conclui o contrário do que acontece.
  **A exp06ef2b (`rastro-boato`) e a exp08ef4b (`manifesto-ia`) ainda entregam o texto
  a qualquer gestor**, com a mesma frase no comentário. A divergência é
  conhecida e deliberada: apertar as duas muda o que a tela de gestor delas
  mostra hoje, e isso é frente própria.
- **O painel não tem NENHUMA coluna de acerto por criança**
  (`invariantes.ts:PROIBIDO_NO_PAINEL`, com teste que cobra a ausência). Aqui a
  tentação é específica: com o gabarito a um JOIN de distância, "quantas falsas
  cada um encaminhou" é a coluna que se escreve sozinha — e ela é um ranking de
  quem caiu no boato. O que existe é o histograma da SALA, por mensagem.
- **`DELETE /encaminhar/:mensagemId`**, não `POST /desencaminhar`: é a remoção
  do recurso que o `POST /encaminhar` criou, idempotente por definição, e sem
  corpo — que alguns proxies descartam em silêncio no DELETE.
- **Zero mídia binária, e é desenho.** O áudio é transcrição com player
  simulado, a imagem é legenda com rótulo, o link é card de texto. Sem
  `AssetsModule`. Quando o áudio chegar, entra AO LADO da transcrição.
- **Lote com forma inesperada = turma NÃO preparada**, com `logger.warn`
  (`exp05ef1b-lote-invalido`). Cair no banco curado ali seria trocar o tema da
  professora sem avisar; o log existe para o "ainda estamos organizando o grupo"
  não ser mudo para quem diagnostica.
- **`public/experiencia.json` da pasta da experiência precisa declarar
  `"series": ["5EF"]`** (e o `produto`, pela regra 8). Com o `["6EF"]` herdado do
  `_template`, `serveASerie` (`salas/regras.ts`) marca a missão como
  `deOutraSerie` e o card some da grade da professora da 5A — a liberação e a
  guarda continuam funcionando, o que torna o sintoma difícil de ler.

## As duas suítes, e o que cada uma responde

- `tests/quem-mandou-isso-regras.spec.ts` — SEM banco. A mecânica pedagógica: a
  paridade e os tetos de palavra do lote, o `Omit` que faz o gabarito não caber
  na resposta, o piso + leitura do Mural, o histograma que não divide por zero e
  a polaridade que VIRA quando a sala filtra bem, o que `validarLote` recusa da
  IA, e as réguas de `invariantes.ts` aplicadas à própria copy.
- `tests/quem-mandou-isso-postgres.spec.ts` — o que só o banco responde: a RLS
  ISOLANDO (com a role sem `BYPASSRLS`, senão o teste passa em falso), os CHECK
  recusando o que dizem recusar, o UNIQUE do encaminhamento sob dois toques em
  paralelo, o latch sob duas confirmações simultâneas, e o gabarito ausente da
  resposta antes do telão.

Duas armadilhas que elas já pagaram, e que quem escrever a próxima herda:
`toContain("falsa")` sobre a resposta INTEIRA casa com o roteiro do podcast ("as
notícias falsas"), então o escaneamento do gabarito é sobre `lote`; e fixture de
reflexão crua — a que a RLS precisa antes de a aula chegar à Etapa 6 — some no
`afterAll` do `describe`, senão o painel conta como entregue uma criança que
nunca respondeu ao tio.

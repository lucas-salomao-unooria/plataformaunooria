# apps/hub/app/(plataforma)/admin — a área do gestor

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. Os quatro papéis
de gestão (`gestor_escola`, `gestor_regional`, `gestor_contrato` e `admin`) dividem
esta MESMA área do middleware: quem os separa é o `RolesGuard` da api, não o hub.

## Regionais e Escolas são DUAS telas (ADR-79)

`/admin/regionais` antes de `/admin/escolas` no menu — a ordem da hierarquia, e a
ordem em que quem chega lê a lateral. As duas são do contrato, `gestor_contrato` e `admin` (o id novo
entrou em `SO_ADMIN_DO_CONTRATO` de `components/nav-admin.tsx`, e a página faz
`redirect` como a de escolas já fazia).

**Não junte os níveis numa tela só — a mistura é o problema**: os três níveis na
mesma `Table` com o tipo numa `Tag` pedem `"—"` nas colunas de turma e estudante
das linhas de regional, um resumo que soma níveis diferentes ("3 registros · 2
unidades") e um filtro de **Tipo** cuja única função é desfazer a mistura.
Separar as telas REMOVEU um controle — se o filtro de Tipo voltar a `/admin/escolas`, é porque a
tabela voltou a misturar. A suíte e2e cobra isso.

**Três armadilhas de rótulo que a separação corrigiu, e que valem para qualquer
tela de lista:**

- **"Sem regional" MENTIA.** A opção tinha `value: ""`, e o `carregar()` só manda
  `paiId` quando ele é truthy: escolher "Sem regional" limpava o filtro e
  mostrava a rede inteira. Hoje é "Todas as regionais", que é o que ela sempre
  fez. Opção de filtro cujo valor é o vazio do "sem filtro" nunca pode se chamar
  pelo nome de um subconjunto.
- **"Professores" no resumo era vínculo, não pessoa.** Por escola o número é de
  pessoas (índice único por escola+pessoa+papel); o total SOMADO conta duas vezes
  o professor lotado em duas escolas. A coluna diz "Professores", o resumo diz
  "vínculos de professores".
- **A regional é informação DA ESCOLA**, na segunda linha da célula junto do id.
  Sem isso, o filtro seria o único lugar do produto que diz a que diretoria a
  unidade pertence.

**A tela de Regionais não soma turma nem estudante das unidades.** É permitido
(`gestor_contrato` e `admin` são a exceção cross-escola) e seria útil, mas aproxima a tela da
visão somada de diretoria que a ADR-34 recusa, e custaria uma agregação sobre
cinco mil escolas. O único número dela é `unidades` — quantas escolas agrupa —, e
ele vem de um `groupBy` FORA do filtro da consulta: com `tipo=regional` as filhas
não estão no resultado, e contá-las ali daria zero em toda linha.

**O botão Excluir abre SEMPRE o diálogo**, mesmo quando a exclusão é impossível.
Decidir na hora do clique e não fazer nada é indistinguível de botão quebrado: o
diálogo é onde a última regional da rede e a regional com escolas explicam o
impedimento (e, no segundo caso, oferecem a transferência). Os códigos de
conflito (`regional-unica`, `regional-com-escolas`) estão em
`apps/api/src/tenancy/AGENTS.md`.

## O modal de vínculo busca na REDE (ADR-80)

**Não filtre por "onde a pessoa está hoje"**: `users.escola_id` é o cache da
lotação PRINCIPAL — quem trabalha em duas escolas só seria achado pela
principal, e procurando pela outra a lista voltaria vazia. A busca é
`GET /escolas/profissionais`, sem escola de origem.

- **Quatro estados de busca distintos**: inicial (orienta), buscando, vazia
  (só DEPOIS de uma busca concluída) e erro. A tela dizia "nenhum professor
  encontrado nesta escola" **antes** de qualquer busca — afirmação sobre uma
  consulta que nunca aconteceu.
- **O botão fica sempre visível**, e a seleção da tabela é SUGESTÃO de destino,
  editável. Aparecer só com linha marcada duplicaria o botão da barra de
  seleção — dois botões idênticos lado a lado.
- **Destino já vinculado é marcado e sai da criação**; se todos estiverem, a tela
  diz que não há o que criar e o botão não habilita.
- **UM perfil no resumo, com a frase dizendo que vale em todas as escolas.**
  `users.role` é global e é ele que o `RolesGuard` lê; o papel da lotação é
  registro, não autorização. Um seletor de perfil por escola prometeria o que o
  guard não cumpre — é a mesma armadilha que a ADR-79 fechou em outro lugar.

## `/admin/relatorios` — o relatório da diretoria (ADR-82)

Duas tabelas: o consolidado por missão e a quebra por escola. Só
`gestor_regional` (a própria regional) e os perfis de contrato (com seletor).

- **O seletor de regional NÃO existe para o `gestor_regional`.** Ele lê a dele, e
  a api ignora o parâmetro. Se o seletor aparecer para ele, a tela passou a
  oferecer a diretoria do vizinho — a suíte e2e cobra a ausência.
- **As duas medidas ficam lado a lado, sempre.** "Turmas encerradas" é a AULA;
  "Estudantes com registro" é a CRIANÇA. Juntar numa coluna apaga os dois casos
  que interessam (aula fechada sem a sala entrar; sala no meio do caminho).
- **Nome de criança não entra**, e o CSV também não o leva: o relatório é
  contagem. Para ver uma criança, abre-se a escola dela.
- **O CSV é montado no CLIENTE**, com os números que a tela já tem. Uma rota de
  exportação seria a segunda fonte da mesma conta, e as duas divergiriam na
  primeira coluna nova. (O `﻿` no começo do arquivo é o que faz o Excel abrir
  acento certo.)

## O vocabulário das telas administrativas

Decidido no card de textos, e vale para texto de TELA (rótulo, título,
descrição, placeholder, mensagem) — não para nome de campo da api:

- **escola**, nunca "unidade". **regional**, nunca "diretoria" (nem alternando
  com ela). **vínculo/vincular**, nunca "lotação/lotar" — `lotacoes` segue sendo
  o nome da tabela, porque é o termo que a rede pública usa para o registro.
- **"Coordenação"** para `gestor_escola` na interface; o identificador continua
  `gestor_escola` (contrato replicado em quatro fontes).
- **"Código interno"** para o id de escola e de regional NOS FORMULÁRIOS. Na
  LISTAGEM ele aparece sem rótulo, e de propósito: é a chave que a secretaria
  usa nas planilhas de importação — a e2e registra isso como prova. Um
  "Código interno:" em cada linha dobraria a altura da célula.
- **Pessoa ≠ vínculo, e a tela diz qual é qual.** A coluna "Professores" conta
  pessoas naquela escola; o total do resumo conta vínculos na rede, e leva a
  frase "Um professor pode ter vínculo com mais de uma escola." Essa confusão já
  custou duas conversas.

O `unidades` da resposta de `GET /escolas` **não** foi renomeado: é campo de
contrato publicado (OpenAPI + apêndice C), e trocá-lo por pureza de vocabulário
é churn sem ganho para quem usa a tela. Fica registrado que ele diverge.

## Quem atende a rede ESCOLHE a escola, não digita o código (H03.4.2)

Usuários, Turmas, Importar e `/analise` pedem a escola a quem viaja sem
`escola_id` no token (o administrador do contrato e o `admin`). Era um
"Escola (id)" digitado — só funcionava para quem sabia de cor o código interno.
Hoje é `components/escolha-de-escola.tsx`: um `TextField` de busca que filtra o
`Selection` ao lado (o DS não publica seleção com busca). A lista vem de
`GET /escolas?tipo=escola` UMA vez e o filtro é local. **Só monte para
`ehDoContrato`**: para a Coordenação a rota responde 403, e a tela de análise
mostrava o erro na casca de quem nem precisa escolher.

## `/admin/habilidades` — o painel de habilidades (F14.7, ADR-144)

Os QUATRO papéis de gestão, uma entrada só no menu, duas alturas pelo papel: a
`gestor_escola` lê a própria escola (`PainelDaEscola`); a regional e os perfis de
contrato leem a rede (`PainelDaRede`), e só o contrato tem o seletor de regional
(`?regionalId=`) — para a regional ele ofereceria a diretoria do vizinho.

- **O drill-down carrega a escola na URL**: `escolas/[escolaId]` →
  `turmas/[turmaId]?escolaId=` → `estudantes/[estudanteId]?escolaId=`. É o que deixa
  a regional, que não tem lotação, abrir a turma de outra escola da regional; a
  api confere (403 fora dela) e as páginas tratam `null` como "não encontrada".
- **A turma e o estudante são as MESMAS telas do professor** (`PainelDaTurma`,
  `HabilidadesDoPerfil`), só de leitura; o que muda é para onde o nome leva.
- **Os painéis carregam `plataforma-largura-cheia`**: o `Card` do DS tem teto de
  398px, e a grade de barras não cabe nele.
- Suíte: `gestor_escola/05-painel-de-habilidades` (coordenação e regional).

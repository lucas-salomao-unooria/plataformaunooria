# apps/api — NestJS + Postgres

Complementa o `AGENTS.md` da raiz (regras invioláveis, convenções, comandos).
Aqui está o que só importa quando se mexe na api.

**Padrão de módulo de domínio**: `catalogo.ts` (dados) + `regras.ts` (puro) +
service com `comTenancy` + controllers por papel. Lógica de uma experiência vive
num módulo de prefixo igual ao slug (`src/unootube/` ↔ `/unootube/*`) — o client
nunca recebe gabarito (regra 3).

## A rede: escola, lotação e CPF (2026-08-28)

**Uma rede estadual não é uma escola grande.** São milhares de unidades,
professores em mais de uma, e crianças que se transferem. A decisão que torna
isso barato é o que NÃO muda: **o token continua carregando UMA escola**. As 31
tabelas com `escola_id` e a política de RLS ficam intocadas, e a regra 1 continua
literalmente verdadeira (ADR-30).

- **`lotacoes`** — pessoa × escola, datado (o termo da rede pública para alocação
  de servidor a uma unidade). **Professor e gestor ACUMULAM**: lotação nova não
  encerra a anterior. **Estudante tem UMA ativa**, garantida por índice único parcial
  no banco — "estudante em duas escolas" é indistinguível de transferência pela
  metade. FORA da RLS pelo mesmo motivo de `users`: é lida no login, antes de se
  saber a escola, e é ela que responde "quais escolas são suas".
- **Escola ativa é estado de SESSÃO.** Quem tem mais de uma escolhe no cabeçalho
  (`components/seletor-de-escola.tsx`); a troca passa por `POST /api/escola-ativa`,
  que valida contra `GET /escolas/minhas` **da api** — nunca contra a lista que o
  cookie carrega. `users.escola_id` é o cache da lotação principal.
- **Criar escola é `admin-contrato` e ninguém mais**, inclusive no `orgs.csv`:
  escola é tenant, e abrir inquilino com RLS e dados de menores por trás não é
  operação de quem administra uma unidade. `/admin/escolas` é a tela.
- **A REGIONAL agrupa; quem autoriza é a lotação** (ADR-34). `escolas.tipo` tem
  vocabulário fechado — `escola` (a unidade, onde há turma, estudante e dado),
  `regional` (Diretoria de Ensino, polo, secretaria municipal) e `rede` (a raiz)
  —, e `pai_id` liga unidade a regional, com trigger no banco recusando pai que
  seja `escola` ou a própria linha. **Estar numa diretoria não dá acesso a nada**:
  a hierarquia serve para MONTAR a lista de escolas que o admin confirma antes de
  conceder (`POST /escolas/lotacoes-em-lote`, que recebe a **lista** de
  `escolaIds`, nunca o critério). Autorizar por hierarquia seria uma segunda fonte
  de verdade sobre acesso, divergente da lotação no dia em que alguém corrigisse
  um pai. Regional e rede **não recebem lotação** — não têm turma nem dado, e
  virariam escola fantasma no seletor do cabeçalho — e essa regra vale nas DUAS
  portas desde a ADR-79: `lotarEmLote` filtrava por tipo desde o início, `lotar`
  (a rota individual `POST /escolas/:id/lotacoes`) não filtrava nada.
  Estas colunas existiram por um tempo sem NENHUMA query que as lesse: era a
  mesma armadilha do `expires_at` sem rotina. Coluna nasce com o consumidor.
- **TODA escola tem regional, e a rede nunca fica sem nenhuma** (ADR-79).
  `pai_id` é obrigatório em `tipo='escola'` (CHECK `escolas_escola_tem_regional_check`)
  e o pai tem de ser `regional` — **não mais `rede`**. Três camadas sustentam
  isso, e cada uma serve a um chamador diferente: o Zod (`NovaEscolaSchema`) devolve
  à tela o texto do produto (`SEM_REGIONAL`), o service confere que a regional
  EXISTE e é regional (senão o 500 do trigger chegaria cru na tela), e o banco
  não deixa a linha existir órfã. A camada do banco **ADOTA pela regional padrão**
  em vez de recusar: sem isso, as ~30 suítes que criam uma escola de mentira para
  testar outra coisa (vila, unoogpt, bem-estar, salas) quebrariam todas, e
  emendá-las seria editar o módulo do vizinho — o que a ADR-71 identifica como a
  causa de conflito de merge insolúvel. Sem padrão na rede o trigger não inventa
  destino: `pai_id` fica nulo e o CHECK recusa.
- **`escolas.regional_padrao`**: a regional que a plataforma cria sozinha, para a
  rede sem divisão administrativa. **No máximo uma** (índice único PARCIAL), e é
  ele que dá idempotência de graça a quem tenta criar a segunda. Nasce chamada
  `Rede` e o nome é **editável** — o nome real do contrato NÃO existe no banco (o
  contrato é a stack, não uma linha; `CONTRATO_NOME` é env do hub e uma migração
  não a lê). Ela nasce em dois casos e em nenhum outro: rede sem regional nenhuma
  (contrato recém-provisionado) ou rede com escola órfã para adotar — criá-la
  sempre daria uma regional vazia numa rede já organizada em diretorias.
- **Exclusão: só REGIONAL, nunca escola.** `DELETE /escolas/:id` recusa
  `tipo='escola'` — escola é tenant, com turma, dado de menor e histórico atrás.
  Duas recusas, as duas de produto: `regional-unica` (409) e
  `regional-com-escolas` (409, com `escolas` e `destinos` no corpo — é com esses
  números que a tela decide entre abrir o diálogo de transferência e explicar que
  não há destino). `?transferirPara=` move as escolas e exclui na MESMA transação:
  em duas chamadas existiria a janela em que as escolas já mudaram de regional e a
  antiga continua na lista. A regional PADRÃO não tem proteção própria — depois
  que a rede se organizou, ela é a sobra que se quer remover.
- **A importação `orgs.csv` mudou de política** (ADR-79). Antes a escola entrava
  com `pai_id` nulo e um aviso quando o `parentSourcedId` era desconhecido. Agora:
  com UMA regional na rede, vínculo automático + aviso; com VÁRIAS, a linha é
  **erro** com o número dela. É mudança observável para quem já usa — `orgs.csv`
  que hoje importa passa a falhar.
- **O panorama da diretoria SOMA** (ADR-81, revendo a ADR-34).
  `GET /escolas/minhas/resumo` devolve **uma linha por escola**; quem soma é a
  TELA (`/admin/minhas-escolas`) — ela já somava turmas e estudantes antes desta
  ADR, e agora se intitula pela diretoria quando quem olha é `gestor_regional`.
  **A soma não custou RLS**, e uma avaliação anterior deste projeto errou ao
  dizer que custaria: os números saem de `lotacoes`, `turmas` e `users`, as três
  tabelas que já estão FORA da RLS, com `escola_id IN (...)` explícito. O custo de
  RLS existiria só para dado PEDAGÓGICO (`progresso`, `runs`, `exp_*`), que é
  território do `/analise`.
  **Turmas, estudantes e primeiro acesso somam limpo** (o estudante tem UMA
  lotação ativa; o primeiro acesso é por `users.escola_id`); **professor é
  VÍNCULO**, porque quem dá aula em duas conta duas vezes.
  As escolas do panorama saem de `escolasDaPessoa`, **nunca de `lotacoes`
  direto**: lendo lotação, o panorama do `gestor_regional` voltava vazio com o
  item de menu aparecendo — tela em branco sem erro nenhum. O item de menu
  aparece com mais de uma lotação **ou** para `gestor_regional` (para ele a tela
  é a diretoria, não "minhas lotações").
- **`users.cpf` é a identidade IMUTÁVEL do estudante** — e o que torna a
  transferência possível: nome, login e matrícula mudam, o CPF não. Guardado como
  **11 dígitos, sem pontuação** (a formatação é da tela; CHECK no banco), **único
  por CONTRATO**, não por escola — é essa unicidade que transforma "esse CPF já
  existe na escola B" em transferência reconhecida.
  **O gestor VÊ o número** (ADR-33): ele confere identidade contra o sistema da
  rede, preenche documento e atende a família no balcão — e a lista de
  `/admin/usuarios` mostra o CPF formatado e busca por ele, com ou sem pontuação.
  CPF é dado pessoal COMUM, não do art. 11 (que é saúde, raça, religião,
  biometria), com base legal clara em contrato de educação pública.
  O que sustenta a decisão não é a coluna, é a **contenção**: `users.cpf` é o
  ÚNICO lugar onde o número existe. Nunca em log (nem em mensagem de erro), nunca
  em telemetria, JSONB, claim de token ou bundle de experiência — e
  `tests/identidade-unica.spec.ts` cobra as duas coisas: que só exista essa
  coluna, e que nenhum JSONB de telemetria/progresso carregue 11 dígitos seguidos.
  Uma versão anterior guardava só o hash; a decisão foi revista porque hash é de
  mão única e o gestor não conseguia ver o número (ADR-31, superada pela ADR-33).
- **Na transferência, o dado FICA e a identidade SEGUE** (ADR-32). Tudo o que a
  criança produziu continua com o `escola_id` de onde foi produzido — verdade
  histórica. O que atravessa é `GET /estudantes/:id/historico`: uma porta só, restrita
  a quem tem lotação na escola onde ela está HOJE, devolvendo participações e
  **nunca** o conteúdo dos instrumentos. É também a única operação que troca o
  `app.escola_id` no meio de uma transação — sem isso o update na origem não veria
  linha nenhuma (a RLS o esconderia, sem erro) e a criança ficaria nas duas.
- Na importação, **o CPF é a primeira chave**: achado em outra escola da rede, a
  linha vira transferência (estudante) ou lotação a mais (professor). Reimportar não
  troca a senha de quem já entrou.


## Papéis: seis nomes e uma cadeia (ADR-80, 2026-09-08)

`estudante | professor | gestor_escola | gestor_regional | gestor_contrato | admin`

- **`gestor_escola`** era `gestor`; **`gestor_contrato`** era `admin-contrato` (o
  hífen saiu: era o único do vocabulário, e separador diferente dos outros é a
  diferença que ninguém lembra na hora de escrever a comparação).
- **O vocabulário vive em `auth/claims.ts`**, e nada de comparar papel na mão:
  use os grupos (`GESTORES_DA_ESCOLA`, `GESTORES_DO_CONTRATO`, `GESTORES`) nos
  `@Roles` e `ehDoContrato(...)` no lugar de `perfil === "gestor_contrato"`. São
  quarenta decoradores e ~20 comparações: com os nomes espalhados, o papel novo
  que falta em UM deles continua compilando e continua respondendo 403 — não há
  teste que aponte para isso, só uma tela que não abre.
- **A CADEIA DE ATRIBUIÇÃO** (`usuarios/regras.ts`): cada nível atribui o de
  baixo, e o alcance real é o **fechamento transitivo** —
  `admin → gestor_contrato → gestor_regional → gestor_escola → professor/estudante`.
  **Para cima, nunca, nem o próprio nível**: `gestor_contrato` deixou de criar
  outro `gestor_contrato` e `gestor_escola` deixou de criar outra coordenação de
  escola. As duas coisas valiam antes, e o aperto é a decisão de produto.
  A tranca é `podeCriarPapel`, **não** o `@Roles`: o guard protege a ROTA, não o
  campo `papel` do corpo.
- **`gestor_regional` NÃO toca a RLS, e é isso que o tornou viável.** Ele
  trabalha UMA escola por vez, como o `gestor_escola`; o token continua
  carregando um `escola_id` e a política de RLS fica intocada. O que a regional
  dele determina é a **lista de escolas que ele pode ativar**, e isso mora em UM
  lugar — `escolasDaPessoa` —, por onde login, seletor do cabeçalho e validação
  da troca de escola já passam. Espalhada, faltaria em um dos três, e o sintoma
  é um supervisor sem escola nenhuma para escolher.
  `temLotacao` também aceita "a escola é da minha regional": sem isso o histórico
  do estudante transferido daria 403 ao supervisor da diretoria onde a criança
  está.
- **`users.regional_id`** é o escopo dele, e SÓ dele (CHECK bicondicional +
  trigger exigindo que a linha apontada seja `tipo='regional'` — CHECK não aceita
  subconsulta no Postgres). Coluna, e não lotação na regional: a ADR-79 proibiu
  isso, e a razão continua valendo (escola fantasma no seletor).
- **`admin` é a conta da Unooria**, com as MESMAS capacidades de
  `gestor_contrato`. Inventar capacidade para justificar o nome seria criar
  acesso sem ninguém pedir. O que ele tem de próprio é a ponta da cadeia.
- **`POST /usuarios/admin-contrato` virou `POST /usuarios/sem-escola`**, com
  `papel` no corpo: a rota serve os dois papéis sem escola, e um caminho com o
  nome de um deles mentiria sobre o outro. `gestor_regional` exige `regionalId`
  e `gestor_contrato` o recusa (Zod com `refine` bicondicional).
- **O nome canônico é sinônimo de si mesmo em `SINONIMOS_DE_PAPEL`.** A chave da
  busca passa por `replace(/[\s._-]/g, "")`, então `gestor_escola` chega como
  `gestorescola` — e o cadastro unitário, que serializa o papel numa linha de
  planilha antes de chamar o importador (ADR-59), reprovava o próprio valor que
  acabara de escrever. Passou no typecheck e caiu no teste.
- **O hub tem uma SEGUNDA cópia da cadeia** (`hub/lib/papeis.ts`), porque o
  middleware roda no edge. Ela serve só para montar o formulário; quem decide é
  a api. O que segura a divergência é o `Record` exaustivo de rótulos — papel
  novo sem rótulo não compila.

## Buscar profissional na REDE (ADR-80)

`GET /escolas/profissionais?busca=` — professor e coordenação, por nome, login,
matrícula ou CPF, **sem escola de origem**. Só os perfis de contrato.

**Existe por um DEFEITO, não por conforto.** A busca anterior era
`GET /usuarios?escolaId=`, que filtra `users.escola_id` — o *cache* da lotação
PRINCIPAL. Quem trabalha em duas escolas só era encontrado pela principal;
procurando pela outra — uma escola onde a pessoa realmente está — a lista voltava
vazia e quem administra concluía que ela não existe. Era exatamente a população
que a lotação em lote existe para administrar.

- **Não devolve CPF.** A busca o ACEITA (com ou sem pontuação, piso de 5
  dígitos), mas o número numa lista que varre a rede é superfície nova — a ADR-33
  restringe o CPF visível ao balcão da escola. Login e as escolas em que a pessoa
  está já distinguem homônimos, que é o que a tela precisa.
- **Sem `comTenancy`, e não é exceção nova**: `users` e `lotacoes` já estão fora
  da RLS, e quem pergunta é o único papel que atravessa escolas.
- **`lotarEmLote` diz o que FEZ**, por escola: `criadas`, `reabertas`,
  `jaVinculadas`, `ignoradas`. Era `lotadas: number`, que contava também as
  escolas onde a pessoa já estava — "agora está em 3 escolas" saía igual tendo
  criado três vínculos ou nenhum.
- **Papel divergente de `users.role` é RECUSA.** A chave única de `lotacoes` é
  (escola, pessoa, PAPEL): com papel diferente, a mesma pessoa ganharia uma
  SEGUNDA linha na mesma escola, e a contagem da tela a somaria nas duas colunas.
  Era o caminho por onde "não alterar o perfil silenciosamente" se quebrava.

## Relatório da diretoria: laço, não política de RLS (ADR-82)

`GET /escolas/minhas/relatorio` — consolidado por missão + quebra por escola,
para `gestor_regional` (a própria regional) e os perfis de contrato
(`?regionalId=`).

- **`liberacoes` e `progresso` estão SOB a RLS**, e o relatório atravessa escolas
  abrindo a tranca **uma escola por vez** (`comTenancy` por escola, em lotes de
  8 com `aosPares`), somando na aplicação. A política **não** é tocada. É o mesmo
  padrão de `lotarEmLote` e da transferência.
  **Afrouxar a política seria UMA linha** (ela é gerada por laço sobre ~29
  tabelas) — o custo não é escrever, é que ela É a garantia de que a escola A
  nunca vê a criança da escola B. O laço mantém a garantia literal.
- **A autorização mora em `regionalDoRelatorio`**, um método, não no controller.
  Para `gestor_regional` a regional vem de `users.regional_id` e o
  `?regionalId=` é **IGNORADO** — ignorado, e não validado contra o dele: o
  efeito é o mesmo, mas por um caminho em que esquecer a comparação não vira "leia
  a diretoria do vizinho por querystring".
- **As DUAS medidas, lado a lado**: `estudantes` é a CRIANÇA com registro (a PK
  de `progresso` é (escola, estudante, exp), então contar linha já é contar
  criança distinta); `turmasLiberadas`/`turmasEncerradas` é a AULA. A diferença
  entre elas é a informação — turma encerrada com poucos registros é aula que
  passou sem a sala entrar.
- **Cobre as nove experiências sem código por experiência**, porque as duas
  tabelas são da PLATAFORMA. A décima entra de graça.
- **Fora, e não por esquecimento**: bem-estar (dado de saúde, sem rota de gestor
  nenhum), o retrato de valores da Vila agregado (listagem ordenável vira ranking
  de criança) e **nome de criança** — o relatório é contagem.
- **O teto**: uma transação por escola. Diretoria muito grande ficar lenta é
  gatilho para agregado materializado, **não** para afrouxar a política.

## "Quem trabalha nesta escola" é LOTAÇÃO, nunca `users.escola_id`

Isto já estava escrito acima como desenho, e **foi violado na prática** — o
defeito da contagem de professores nasceu daí. Fica como regra operacional:

- **`users.escola_id` é CACHE da lotação principal.** Perguntar "quem está nesta
  escola" a ele responde "quem tem esta escola como principal" — e para quem
  trabalha em duas, a segunda escola volta VAZIA.
- **Toda listagem e toda contagem por escola sai de `lotacoes`** (`escola_id` +
  `papel` + `fim IS NULL`). `usuarios.listar` filtrava pelo cache enquanto
  `escolas.listar` contava lotações: a coluna "Professores" dizia 1 e a lista da
  mesma escola dizia 0, com "Ninguém por aqui ainda". Dois lados perguntando
  coisas diferentes com o mesmo rótulo.
- **O papel e o nome da escola da LINHA também saem da lotação daquela escola**,
  não de `users.role`/`users.escola`: senão a listagem da escola secundária
  mostra a escola principal da pessoa na coluna Escola — a escola errada,
  justamente na linha que o defeito escondia.
- `escolas.pessoasDaEscola` (a outra listagem, `GET /escolas/:id/pessoas`) já
  fazia certo desde o começo. Duas listas de pessoas com critérios diferentes é
  o que permitiu a divergência passar.
- **A regressão é a IGUALDADE, não a query**: `tests/usuarios.spec.ts` compara
  contagem e lista na mesma escola, com o professor de duas escolas montado de
  propósito. Verificado que ela REPROVA sem a correção.

## Identidade e enturmamento (2026-08-28)

**Uma conta por PESSOA, a mesma no hub e em todas as experiências.** As
experiências vieram de projetos onde cada atividade tinha cadastro próprio; a
unificação técnica já existia (todas recebem `estudante.id` pelo `hub:init` e gravam
`estudante_id` com FK para `users`), mas a conta era de ASSENTO — está escrito no
schema: `exp_01_runs.nome_no_app` existe *"porque a conta é do APARELHO: outra
turma reusa o mesmo login"*. `nome_no_app` continua existindo como APELIDO dentro
da ficção do Instanooria, nunca como identidade em tela de professor ou
relatório. O teste `tests/identidade-unica.spec.ts` falha se alguém criar uma
segunda tabela de credencial ou uma coluna de pessoa sem FK para `users`.

**O modelo é isomórfico ao OneRoster 1.2, com nomes em pt-BR** — `periodos_letivos`
(≈ `academicSessions`) e `matriculas` (≈ `enrollments`: usuário × turma × escola,
com papel, `principal`, `inicio`/`fim`). O padrão vive SÓ na fronteira
`apps/api/src/rostering/`, como o vendor de IA vive em `src/ai`: nada do domínio
conhece `sourcedId`, e o `hub:init` não muda (ADR-28).

- **A chave da pessoa é `users.matricula_externa`** (o RA da rede), com índice
  único parcial por escola. Sem ela o upsert cai no `username`, e corrigir um
  login cria um segundo estudante com o histórico preso no primeiro.
- **`users.turma_id` sobrevive como CACHE da matrícula principal.** O login e o
  claim `turma_id` o leem antes de haver escola no contexto, onde `matriculas`
  (que tem RLS) não é alcançável. A verdade é `matriculas`.
- **Turma vive dentro de um período letivo**: `UNIQUE (escola_id,
  periodo_letivo_id, nome)`. O "8A de 2026" e o "8A de 2027" são turmas
  DIFERENTES — é isso que impede a virada do ano de reescrever o histórico de
  2026 em silêncio.
- **`matriculas.papel` só admite `estudante` e `professor`.** Gestor é papel da
  ESCOLA (o `roles.csv` do padrão), não matrícula de turma — e é por isso que ele
  continua vendo a escola inteira. "Coordenação" é `gestor`: `PAPEIS` é contrato
  congelado, e o CSV aceita sinônimos (`coordenacao`, `diretor`, `principal`).
- **As turmas do professor são as em que ele tem matrícula.** `comum/turmas-do-professor.ts`
  (`ondeAsTurmasSaoVisiveis`, `professorLeciona`, `professorEnsinaOEstudante`) é a
  porta única; os seletores do
  UnooTube, da Vila e do unooGPT passam por ela. Antes, qualquer professor abria
  bem-estar e Vila de qualquer turma da escola, porque a única prova exigida era
  "mesma escola", que é a regra de tenancy e não a de quem dá aula ali.
  **Rota de professor que recebe `turmaId` ou `estudanteId` passa pela porta —
  TODA, inclusive a que só lê e a que APAGA.** Seis ficaram de fora até
  2026-09-05, e o `@Roles("professor")` não protegia nada nelas: o "zerar turma"
  da Vila e do unooGPT, os cartões da Vila, os dois relatórios individuais e o
  **relógio da aula** do unooGPT — este último deixava um professor da escola dar
  a largada, ou encerrar, a aula de uma turma que não é dele, no meio dela. O
  molde certo é o `o-eco-no-grupo`, que nasceu depois da porta e passa
  `professorDoToken` em todas.
  **Tela de UMA criança usa `professorEnsinaOEstudante`, não `professorLeciona`**:
  a pergunta ali não é "esta turma é minha?", é "esta criança é de alguma turma
  minha?". Ele aceita a matrícula ativa **ou** o cache `users.turma_id` — as duas
  fontes de propósito, porque as listagens destes módulos partem do cache, e
  olhando só a matrícula o nome apareceria na folha e a tela dele responderia
  "não encontrado". Prova em `tests/professor-por-matricula-tenancy.spec.ts`, que
  roda como superusuário para a RLS não mascarar a falta do `where`.
- **ARMADILHA**: query que leia `matriculas` fora de `comTenancy` volta VAZIA, em
  silêncio. O sintoma é lista de pessoas "sem turma".
- **ARMADILHA: `catch` que consulta com o MESMO `tx` nunca funciona.** No
  Postgres o primeiro erro aborta a transação inteira — todo comando seguinte
  responde `25P02 current transaction is aborted`, e o que aparece no log é a
  consulta de RECUPERAÇÃO, não a que quebrou. O padrão "tenta criar, se bater no
  UNIQUE relê o que a outra requisição criou" precisa da releitura numa
  `comTenancy` NOVA. Custou um 500 no boot da exp-91: o `catch` estava escrito
  para salvar a corrida do check-in do dia e era justamente o que a virava erro,
  derrubando a suíte `professor/04-bem-estar` antes do formulário.
  Regressão em `tests/bemestar.spec.ts` ("duas chamadas concorrentes").
- **ARMADILHA MAIOR, e do lado oposto**: `users`, `turmas` e `lotacoes` estão
  FORA da RLS (são lidas no login, antes de haver escola). Nelas o `comTenancy`
  NÃO protege nada — ele arma `app.escola_id`, que só as políticas leem —, e o
  `escola_id` no `where` é a ÚNICA tranca, não defesa em profundidade. Custou um
  vazamento real: `distribuicaoDaTurma` (painel do Instanooria) rodava
  `user.findMany({ where: { role: 'estudante' } })` dentro de um `comTenancy` e
  listava crianças de TODAS as escolas do contrato (ADR-49).
  `tests/perfis-distribuicao-tenancy.spec.ts` roda como superusuário de
  propósito, para a RLS não mascarar a falta do `where`.
- **A atividade do Instanooria declara a turma, e desde 2026-09-05 é
  OBRIGATÓRIO** (`exp_01_activities.turma_id`, ADR-49 revista pela ADR-69).
  `POST /atividades` exige `turmaId` e o "Todas as turmas da escola" saiu do
  formulário: era ele que fazia 2EM-A e 2EM-B virarem uma lista só no painel de
  perfis, no monitor e na análise. A **coluna** continua anulável e sem backfill
  — `NULL` = atividade anterior à mudança, que vale para a escola inteira, e o
  painel DIZ isso numa faixa; `ondeAAtividadeVale` continua lendo as duas formas.
  Com turma, painel, listagem de perfis,
  importação da Vila e `POST /runs` falam todos da MESMA sala; a turma é
  conferida contra a MATRÍCULA (`professorLeciona`), nunca contra a escola do
  token. Sem o ajuste no `POST /runs`, o estudante do 8B entrava na atividade do 8A.
- Sair da turma é `fim`, não `DELETE`; sair da rede é `ativo = false`. Há dado de
  estudante pendurado em oito tabelas. Mover de turma (`PATCH /matriculas/:id` com
  `turmaDestinoId`) é UM passo: à mão, o gestor tira da antiga e esquece de pôr
  na nova, e o estudante fica sem turma — invisível para o professor, sem nada na
  tela dizendo o que faltou.

## A sala de aula: a missão dentro da turma (2026-09-05, ADR-69)

`liberacoes` (turma × experiência × estado) é a camada que faltava entre
`turmas` e `experiencias`. **Sem linha, a missão não abre para aquela sala.**

- **A porta é `comum/liberacao.ts#exigirMissaoLiberada`**, e ela fica no FUNIL
  das rotas de estudante de cada experiência — `estudanteDaEscola` no UnooTube e
  no Eco, `garantirSessao` no unooGPT, `abrir` na Vila, e o controller em
  `POST /runs` + `GET /runs/boot` (a exp-01 é a única cuja entrada está no
  controller). Pô-la só na rota de leitura deixa a de escrita aberta a quem
  chamar direto: no UnooTube, `POST /salvos` cria a sessão sozinho.
- **Fica na CRIAÇÃO da sessão, não em toda rota.** Quem já entrou fica —
  encerrar fecha a entrada, não expulsa a criança no meio da aula.
- **Experiência nova declara o próprio `EXP_ID`** (`comum/insta/defaults.ts`,
  `unootube/catalogo.ts`, `unoogpt/regras/defaults.ts`, `vila/catalogo.ts`,
  `o-eco-no-grupo/midia.ts`) e ele tem de bater com o `id` do
  `public/experiencia.json`. Divergir faz a missão NUNCA abrir, com a liberação
  gravada e visível na tela do professor — não há erro que aponte para isso.
- **`bloqueada` não é estado do banco**: é a ausência de linha. E ela aparece na
  tela COM CADEADO, não some — a grade do ano é a promessa do que vem depois.
  `encerrada` também continua visível, com o rótulo.
- **`exp_id` não tem FK** para `experiencias`: aquele catálogo é escrito pelo CI
  ao publicar, e em dev está vazio. Quem o preenche em dev é o seed
  (`prisma/catalogo-e-liberacoes.ts`, lendo os mesmos manifestos que o CI envia)
  — **sem catálogo não há grade**, e o professor abre a sala sem nada para liberar.
- **Estudante sem turma não vê missão nenhuma**, e isso mudou o comportamento da
  exp-03 (que servia o relógio "aguardando" a quem estava solto). Sem sala não há
  missão; quem explica é a tela do hub, porque um erro dentro do aparelho não
  diria "peça para a coordenação te matricular" sem sair do disfarce.
- **Fixture de teste que abre experiência precisa de `tests/liberar-de-teste.ts`.**
  Quatro suítes quebraram quando a guarda entrou — quem quebrar com
  `missao-nao-liberada` não tem bug, tem fixture faltando.

**Pessoa NASCE por importação — e o cadastro unitário DELEGA a ela.** As
chamadas que ESCREVEM em `users` continuam sendo duas:
`POST /rostering/importar` e `POST /rostering/oneroster/users`.
`POST /usuarios` (o formulário de `/admin/usuarios`) **não é a terceira**: ele
valida a forma com Zod, pergunta se a identidade já existe e serializa os campos
como UMA linha de planilha (`planilhaDeUmaPessoa`, em `rostering/planilha.ts`,
sobre a mesma `COLUNAS_MODELO` que o leitor consome) antes de chamar
`importarPlanilha` (ADR-59, acionando o gatilho da ADR-54). Consequência
prática: **não valide domínio no Zod dessa rota** — CPF com dígito verificador,
série, turno e formato de login são do leitor da planilha, e repetir a regra ali
recria a divergência que a ADR-54 recusou.

Duas diferenças em relação a importar um arquivo de uma linha:
- **Criar é criar.** `conflitoDeIdentidade` pergunta ANTES (CPF na rede;
  matrícula e login na escola, sempre com `escolaId` no `where` — `users` está
  fora da RLS) e responde **409 sem escrever**. A importação atualizaria, o que
  é certo para um lote e errado para um botão chamado "Novo usuário".
- **409 de CPF em outra escola não revela nada**: sem id, sem nome, sem o nome
  da unidade. A mensagem aponta a importação, que reconhece o CPF e transfere.

**`admin-contrato` tem rota própria** (`POST /usuarios/admin-contrato`,
`@Roles("admin-contrato")` no MÉTODO — sobrescreve o da classe e é o que sai em
`x-papeis`): não passa pelo importador porque não cabe numa planilha da escola
(`escola_id` nulo, sem lotação, sem turma; `PAPEIS_IMPORTAVEIS` sempre o
excluiu). O login dele é checado na REDE inteira, não na escola: o índice
`(escola_id, username)` não cobre linha com `escola_id` nulo, e o login procura
o username na rede toda — dois donos do mesmo login viram recusa nos dois.
`podeCriarPapel` (`usuarios/regras.ts`) é a segunda tranca, porque o `@Roles`
protege a ROTA e não o campo `papel` do corpo.

O resto do balcão segue unitário: `PATCH /usuarios/:id` e
`POST /usuarios/:id/reset-senha`.

**Entrada de pessoas**: `POST /rostering/importar` (gestor/admin), corpo
`text/csv` cru, até 30MB (o teto de BYTES vale para as duas fronteiras e sai de
`TETO_DO_ARQUIVO`, que o `bodyParser` de `main.ts` também lê) e 50k linhas — o
limite de linhas é da planilha simples, não do OneRoster. **Os 30MB são
escolhidos para caber DEBAIXO do teto do ambiente**: o Cloud Run recusa
requisição acima de 32 MiB em HTTP/1, antes do contêiner, com um 413 que não é
nosso e não deixa linha no log (ADR-48). Prometer mais do que o ambiente entrega
é o que produz o erro que ninguém diagnostica. Folga: o pior caso realista de um
contrato (~10 mil estudantes, 5 componentes cada) dá ~7MB de `enrollments.csv`.
Planilha de UMA linha por pessoa, cabeçalho
lido por NOME (ordem livre; coluna desconhecida é erro, não coluna ignorada):
`matricula,nome,usuario,email,papel,turma,serie,turno` — só `nome` e `papel` são
obrigatórios (estudante também exige `turma`+`serie`). `usuario` vazio ⇒ o login é
gerado e devolvido no relatório. O header legado
`nome,usuario,senha,papel,turma,serie` continua aceito, e
`POST /usuarios/importar-csv` delega. O modelo para download
(`GET /rostering/modelos/usuarios.csv`) é gerado da MESMA constante que o parser
lê — modelo escrito à mão divergiria no primeiro campo novo.

**OneRoster CSV** (para rede COM sistema de gestão):
`POST /rostering/oneroster/:arquivo`, **um arquivo por chamada**, na ordem
`manifest → orgs → academicSessions → classes → users → enrollments → roles`,
com `?modo=bulk|delta`. Fora de ordem não corrompe: a linha que aponta para um
`sourcedId` inexistente volta no relatório dizendo QUAL arquivo falta. Quatro
regras que não são óbvias: `orgs.csv` só APRENDE o código INEP desta escola
(escola é tenant, não nasce de upload); sem a coluna `role` (que saiu de
`users.csv` na 1.2) a pessoa entra como **estudante**, o menor privilégio, e o
`roles.csv` corrige; a coluna `password` do padrão é IGNORADA e a contagem vai ao
relatório; e em `bulk` a ausência de linha **não desativa ninguém** — é contada e
listada, porque lote que chegou pela metade não pode apagar uma rede por omissão.
`status = tobedeleted` desativa (pessoa) ou encerra (matrícula), nunca apaga.
Cada um dos sete tem **modelo** (`GET /rostering/modelos/oneroster/:arquivo`, só o
cabeçalho) e **exemplo** (`.../:arquivo/exemplo`), o mesmo par da planilha da
escola. Duas coisas neles não são detalhe: as colunas do modelo são um
SUBCONJUNTO conferido de `COLUNAS_POR_ARQUIVO` (o teste cobra as duas direções —
obrigatória que falte e coluna que o parser não leia), e o exemplo é gerado com a
escola de VERDADE no `sourcedId`, porque um `esc.exemplo` fixo voltaria como
"escola não é a desta importação" para o gestor e, para `admin-contrato` (que
PODE criar escola por CSV), abriria um tenant de mentira. Os sete exemplos são um
lote coerente: enviados na ordem, entram inteiros —
`tests/oneroster-modelos.spec.ts` aplica os sete contra o banco.

**Contas de assento**: `GET /rostering/contas-de-assento` lista as contas sem
`matricula_externa` com quanto cada uma acumulou de dado, para o gestor desativar
o que era conta de aparelho. **Não existe fundir contas** — juntar duas move o que
uma criança fez para outra pessoa, e depois ninguém audita de quem era. Teto de
200 linhas, dito na resposta (`truncado`).

**Senha (ADR-29)**: a planilha NÃO tem coluna de senha. A senha inicial é
escolhida na tela (uma para o lote, ou uma por pessoa — recomendada para estudantes),
marca `senha_provisoria` e o primeiro acesso cai em `/trocar-senha` sem saída. A
trava é TRIPLA: middleware, BFF e `/api/exp-token` — só com o middleware,
bastaria digitar `/exp/...` para pular. Ao trocar, a sessão é REFEITA com a senha
nova (novo `signIn`), não remendada: o cookie antigo ainda diz "precisa trocar", e
sem refazê-lo a pessoa volta à mesma tela com a senha anterior já inválida.
Reimportar NÃO reseta a senha de quem já entrou. Os usuários do seed nascem com
`senha_provisoria: false` — prendê-los na troca pararia as suítes de estudante.

**Área administrativa** (gestor/admin-contrato): `/admin/usuarios` (busca,
filtros, **cadastrar uma pessoa**, editar, ativar/desativar, reset — o modal fica
em `usuarios/novo-usuario.tsx`, e a TURMA se escolhe numa lista, nunca se digita:
o importador cria a turma que falta, e "8A " com espaço abriria uma segunda),
`/admin/turmas` e `/admin/turmas/[id]`
(enturmamento, mover, tornar referência), `/admin/importar` e
`/admin/periodos-letivos` (o calendário do contrato — a tela da virada do ano). O
professor tem `/professor/turmas` e `/professor/turmas/[id]` — as turmas dele, com
os estudantes nominais.

**A virada do ano tem duas etapas, e nenhuma é automática:** criar o período novo
em `/admin/periodos-letivos` (a partir da data de início ele passa a ser o
vigente, e toda turma nova nasce nele) e importar o enturmamento do ano seguinte.
As turmas e matrículas do ano anterior ficam onde estão — é isso que preserva o
histórico. `vigente` é DERIVADO das datas, nunca coluna.


## Perfil portátil: sair da REDE (2026-08-28)

**Transferir é dentro do contrato; o perfil portátil é para FORA dele.** A
criança que vai da rede estadual para a municipal sai da instalação — outro
contrato, outro banco, nenhum JOIN — e **não há garantia de que o destino comprou
o produto**. Por isso a saída é um DOCUMENTO ASSINADO, não uma integração
(ADR-35): `{ perfil, assinatura }` em JSON, emitido a pedido do titular (LGPD
art. 18, V) e importado como ato da escola de destino. Numa rede que nunca vai
instalar a plataforma, o mesmo arquivo continua legível.

- **O hub assina; a api verifica.** A chave é a MESMA dos tokens de experiência
  (`lib/chave-token.ts`, JWKS em `/.well-known/jwks.json`) — nenhum material novo
  entrou —, e `aud: "perfil-portatil"` separa os dois usos. Verificar é na api
  porque é o passo que **não pode confiar em quem chama**.
- **A assinatura cobre o HASH CANÔNICO**, não o documento como payload: o arquivo
  vai para a FAMÍLIA e precisa ser legível. `jsonCanonico` (chaves ordenadas
  recursivamente) existe nos DOIS lados — `apps/api/src/portabilidade/regras.ts` e
  `apps/hub/lib/perfil-portatil.ts` —, e a duplicação é deliberada: emissor e
  verificador são instalações diferentes, em versões possivelmente diferentes. Um
  **fixture de hash** afirmado nos dois testes derruba um deles se as
  implementações divergirem.
- **Assinatura inválida é RECUSA; emissor inalcançável é rótulo.** A classificação
  é pelo `code` da jose, NUNCA pelo texto: "signature verification failed" contém
  "failed", e uma versão anterior classificava documento FORJADO como "não deu
  para conferir".
- **`PORTABILIDADE_EMISSORES` é a decisão de confiança**, não o esquema da URL: o
  `emissor.hub` vem de dentro do arquivo, então o documento **seleciona** entre
  origens que o operador escreveu e nunca introduz uma (sem isso, SSRF). Vazia =
  tudo entra `nao-verificada`, e a tela sai em âmbar.
  Cada entrada é `origem` ou **`origem=urlDoJwks`** — a segunda forma pelo mesmo
  motivo do `EXP_INTERNAL_HOST`: o `emissor.hub` é o endereço do NAVEGADOR, e de
  dentro do container da api `localhost:3000` é a própria api. É o default do
  `docker-compose.dev.yml`
  (`http://localhost:3000=http://hub:3000/.well-known/jwks.json`), e é o que faz o
  caminho criptográfico ser exercível em dev — sem ele o smoke registrava o
  caminho degradado como se fosse o normal. **JWKS por http só FORA de produção**,
  com aviso no log; em produção, https ou nada.
- **O que vem de fora NUNCA se mistura**: vive só em `perfis_portateis`, não vira
  matrícula, progresso nem perfil da Vila, e não entra em média. É a afirmação de
  outra instalação, possivelmente de outra `VERSAO_MAPEAMENTO`.
- **Importar não cria estudante**: liga pelo CPF a quem já está aqui. Matricular é ato
  da escola (planilha ou OneRoster); o perfil se anexa depois.
- **`perfis_portateis.documento` é a ÚNICA exceção à contenção do CPF** (ADR-33):
  o número é o conteúdo do documento, e alterá-lo destruiria a assinatura. A
  exceção está numa lista explícita em `tests/identidade-unica.spec.ts`, que varre
  todo JSONB do schema procurando os CPFs QUE EXISTEM — não "onze dígitos", que
  casa com qualquer `Date.now()`.
- **Bem-estar (exp-91) nunca entra no documento**: dado de saúde, posse do
  professor, sem rota de gestor em lugar nenhum. Documento que o gestor emite não
  carrega o que nem o gestor lê.
- Envs: `CONTRATO_ID` + `CONTRATO_NOME` no hub (sem o primeiro, a emissão é 503);
  `PORTABILIDADE_EMISSORES` na api. Tela: `/admin/turmas/:id` → "Perfil portátil".


## Telemetria: dois canais, não um (decisão da migração)
- **Operacional (motor)**: `POST /runs/:id/eventos` e `GET /runs/:id/feed` —
  síncrono, transacional, lido em tempo quase real para curar o próximo bloco.
  Dwell NUNCA passa por Pub/Sub: latência e falta de ordenação quebrariam a
  adaptação e o lock por run.
- **Analítico (SDK)**: `track()` → batch 50/10s → `POST /telemetry/batch` →
  Pub/Sub → push subscription → `POST /telemetry/ingest` → `telemetria_eventos`
  (`ON CONFLICT DO NOTHING`: o Pub/Sub entrega *at least once*). No `pagehide`,
  `POST /telemetry/beacon` com o token no CORPO — `sendBeacon` não manda header.
  `/telemetry/ingest` não tem OidcGuard (quem chama é o Pub/Sub) e por isso tem
  o `PubSubPushGuard`: ID token do Google, `aud` == `TELEMETRIA_PUSH_AUDIENCE`,
  `email` == `TELEMETRIA_PUSH_SA`. Envs ausentes = rota 401, nunca aberta.
  **Destino: Postgres, não BigQuery** (decisão de 2026-08-27). O canal analítico
  fica no mesmo banco: se um relatório precisar dele um dia, é um JOIN local com
  `turmas`/`users`, e é uma plataforma de dados a menos para operar. O que
  sustenta isso na escala são duas coisas, e nenhuma delas é um serviço novo:
  o `INSERT` do `ingest` é **multi-linha** (um lote de 50 custava 50
  round-trips; no pico de ~4k simultâneos isso era ~800 INSERTs/s numa
  instância pequena) e `telemetria_eventos` é **particionada por mês**
  (`particoes.telemetria_eventos_YYYY_MM`, migration
  `20260827100000_telemetria_particionada`).
  **Nada de Redis como buffer.** Quem amortece o pico já é o Pub/Sub — e ele é
  DURÁVEL: um buffer em memória perde os eventos do processo que morre antes do
  flush. Redis só entra com gargalo medido, e o gargalo medido aqui era o laço
  de INSERT.
  A PK é `(event_id, ts)` porque o Postgres exige a chave de partição em índice
  único; a dedupe segue correta (reentrega da mesma mensagem traz o mesmo `ts`).
  As partições vivem no schema `particoes`, fora do alcance do Prisma — em
  `public` cada uma viraria drift. Há uma partição DEFAULT como rede de
  segurança: sem ela, evento com `ts` fora das faixas seria RECUSADO, e
  telemetria perdida em silêncio é pior que telemetria mal guardada. Ela
  encher é sinal de que faltou criar partição — não há job agendado nesta
  plataforma, de propósito, e as faixas vão até 2028-12.


## Log e contexto de requisição (2026-09-02)

**O log é o pino, em JSON, com os nomes do Cloud Logging.** Nada de `console.*`
em `src/` — a saída do processo É o sinal operacional (cap. 17), e `console`
sai sem `severity`, sem `requestId` e sem redaction. Dois jeitos de logar, os
dois passando pelo mesmo `criarOpcoesDoPino` (`observabilidade/logger.ts`):
o `Logger` do Nest (`new Logger(X.name)`, que o `app.useLogger` roteia para o
pino) e o `logger` raiz importado de `observabilidade/logger` — este é o
único que existe fora do container do Nest (`main.ts`, `worker.ts`, funções
puras). Os dois carregam o contexto da requisição via `mixin`.

- **Toda linha leva um `codigo` estável** (`telemetria.descartado`,
  `planos.geracao-com-erro`, `query-lenta`): é por ele que se filtra no Logs
  Explorer e que se deriva métrica de log. A mensagem é para gente; o `codigo`
  é para máquina. Não invente `codigo` com valor variável (id, nome).
- **PII entra por CHAVE e sai redigida.** `redigirObjeto` apaga
  `authorization`, `cookie`, `token`, `senha`, `cpf`, `username`, `email`,
  `nome`, `texto`, `mensagem`, `transcricao`, `observacao` em qualquer
  profundidade; `redigirTexto` apaga e-mail, CPF, `Bearer …` e query string na
  mensagem e na `stack`. Isso é rede, não licença: o `username` do
  `auth.controller.ts` foi REMOVIDO do log, não redigido. Um campo novo com
  dado de pessoa ganha o nome da lista, ou entra na lista — nunca um sinônimo.
- **Sem log de requisição da aplicação** (`autoLogging: false`). O Cloud Run
  já grava um por requisição, com trace. O que a api loga é o que ele não
  sabe: escola, motivo de um 4xx, a decisão de degradar.
- **O contexto (`tenancy/tenancy-context.ts`) é UM objeto mutável por
  requisição**, aberto pelo `contextoMiddleware` em `main.ts` — o PRIMEIRO
  `app.use`, antes dos parsers e dos guards, para o 401 sair com
  `x-request-id` — e preenchido com `escolaId`/`perfil` pelo
  `TenancyInterceptor`. O `FiltroDeExcecao` roda FORA da cadeia do interceptor
  e lê a escola desse mesmo objeto; é por isso que o interceptor MUTA em vez
  de abrir um store novo. `comEscolaNoContexto` (seed, worker, teste) continua
  abrindo o próprio. `requestId` = `traceId` do `traceparent` ou do
  `X-Cloud-Trace-Context` do LB; sem eles, UUID.
- **`FiltroDeExcecao` (global, `APP_FILTER`)**: `HttpException` mantém o corpo
  (5xx loga `ERROR`, 4xx `debug`); `ZodError` que escapou de um `parse(body)`
  vira **400** `{ codigo: "corpo-invalido", problemas: "path: code" }` — era
  500 mudo; o resto vira 500 `{ codigo: "erro-interno", requestId }` com UMA
  linha `ERROR` + `stack_trace`, que o Error Reporting agrupa. Não faça
  `try/catch` que engole erro para "não dar 500": o filtro é quem transforma
  o erro em sinal.
- **Rota sem guard não loga por requisição recusada.** O `/telemetry/beacon`
  é público por natureza; os 5 descartes dele são `logger.debug` (invisível em
  `info`) — o sinal contável é métrica (PR das métricas). Uma linha `warn` por
  lote recusado seria um vetor de inundação de log, cobrado por GiB.
- **Prisma**: `PrismaService` liga o evento `query` sempre; acima de
  `LIMIAR_DE_QUERY_LENTA_MS` (500) sai `WARNING` com o SQL (com `$1`, sem os
  parâmetros — é neles que mora o CPF); em `LOG_LEVEL=debug` toda query sai.
- **OpenTelemetry: `src/otel.ts` é a PRIMEIRA linha do `main.ts`**, antes
  de `@nestjs/core`. A instrumentação automática altera `http`, `express`,
  `undici` e o Prisma no `start()`; importado depois do `AppModule`, o trace
  teria só o HTTP de entrada — sem banco e sem IA, em silêncio. Nada em
  `otel.ts` importa código da aplicação (o Zod ainda não rodou). Gate em
  `observabilidade/otel-config.ts`: `OBS_TRACE_RATIO > 0` E (`GCP_PROJECT_ID`
  ou `OBS_DEBUG=1`); desligado, nenhum objeto do SDK existe — é o que mantém
  o Jest e o `nest start --watch` sem GCP intocados. Para ver um trace em dev:
  `OBS_DEBUG=1 OBS_TRACE_RATIO=1 pnpm dev` (spans no console).
  **Prisma não é `pg`**: é `@prisma/instrumentation`, que acompanha a versão
  do `prisma` — subir um é subir o outro. O `sampler.ts` decide por rota
  (IA e feed a 10x, até 1) e **ignora a flag do pai remoto** (o `traceparent`
  vem da internet; honrá-la deixaria qualquer cliente forçar 100%). Exportador
  direto para o Cloud Trace, sem sidecar (ADR-57). O `DesligamentoDoOtel`
  faz o flush no SIGTERM via `enableShutdownHooks`.
- **Métricas (`observabilidade/metricas.ts`)**: um provider global com os
  instrumentos (`unooria.ia.*`, `unooria.telemetria.*`, `unooria.web.*`,
  `unooria.observabilidade.*`); injete `Metricas` onde a medida acontece.
  **No Cloud Monitoring elas aparecem como
  `prometheus.googleapis.com/unooria.ia.latencia/histogram`**, no recurso
  monitorado `prometheus_target` (`job` = `service.name`, `instance` = a
  instância do Cloud Run, `location` = a região) — NÃO em
  `workload.googleapis.com`, que é onde o exportador legado do Google as
  colocava. Procurar no domínio errado faz parecer que nada foi exportado
  (aconteceu em 2026-09-02). Os rótulos ganham `otel_scope_name`.
  **Nenhum rótulo com `escola_id`, `estudante_id`, sessão ou URL crua** —
  cem escolas multiplicam cada série por cem. Rótulos são conjuntos fechados
  (`modelo` da env, `operacao`, `resultado`, `perfil`, `motivo`, `finishReason`
  por allowlist, `rota` normalizada por `normalizar-rota.ts`). **A IA se mede
  no `MedidorDeProvider`** (decorator na factory do `AiModule`), nunca no
  consumidor; a quota conta recusas em `temSaldo`. Exportação a cada 60 s por
  **OTLP/JSON para `telemetry.googleapis.com`** (`otlp-google.ts`) — NÃO
  instale `@google-cloud/opentelemetry-cloud-monitoring-exporter`: ele
  arrasta 202 MB de `googleapis` (medido). **O `resource` precisa de
  `gcp.project_id`** (`observabilidade/recurso.ts`): sem ele a Telemetry API
  recusa todo lote com `HTTP 400 Resource is missing required attribute` a cada
  60 s, com log e trace funcionando — falha silenciosa para quem olha o painel.
  O `gcpDetector` não preenche esse atributo. Nos testes,
  `tests/metricas-em-memoria.ts` dá um `Metricas` com MeterProvider em
  memória para ler o que saiu.
- **`/observabilidade/*`** (erros-cliente, vitals, v1/traces): rotas com
  `OidcGuard`, Zod `.strict()`, cota em memória por (escola, usuário) via
  `comum/rate-limit.ts`, e **sem linha de log por requisição recusada** (o
  sinal é contador). O proxy OTLP (`otlp-proxy.service.ts`) SUBSTITUI o
  `resource` do cliente e filtra atributos por allowlist antes de reexportar —
  nada do que o navegador manda vai ao Google como veio.
- Envs: `LOG_LEVEL` (default `info`), `GCP_PROJECT_ID` (correlação com o
  trace, cliente OTLP; vazio em dev = métricas e spans do navegador contados
  e descartados), `OBS_TRACE_RATIO` (fração exportada; 0 desliga),
  `OBS_DEBUG` (spans e métricas no console). Fora de produção o formato é `pino-pretty`; `LOG_FORMATO=json`
  mostra a linha como o Cloud Logging a verá. Em teste (`NODE_ENV=test`) é
  JSON sem transporte — o pino-pretty abre um worker que o Jest não fecha.
- Testes: `tests/observabilidade-*.spec.ts` e `tests/tenancy-contexto.spec.ts`
  provam redaction, severity, trace, filtro e o store mutável. São puros
  (sem banco): rodam sozinhos com `pnpm exec jest tests/observabilidade`.


## Documentação da api: OpenAPI derivado do Zod (2026-08-28)

`/docs` (Swagger UI) e `/docs-json` na **api** — `localhost:3001/docs`, não 3000,
que é o hub. **Derivado dos schemas Zod que as rotas já usam para validar**
(ADR-36): a api não tem DTO de classe, e anotar `@ApiBody` à mão nas 146 rotas
criaria uma segunda descrição do contrato que nada obriga a concordar com a
primeira — a armadilha do `expires_at`.

- **`@Contrato({...})` só grava metadata.** Ele NÃO chama `@ApiOperation`/
  `@ApiResponse`, porque um decorator não enxerga o verbo da rota (o `@Get` pode
  ser aplicado depois dele) nem o `@Roles`. Quem monta a operação é
  `openapi/documento.ts`, percorrendo as rotas já registradas.
- **Papel vem do `@Roles` real**, nunca de campo repetido no `@Contrato`.
- O esqueleto de caminhos vem do roteador do Nest; o conteúdo, do `@Contrato`.
  As duas travessias têm de concordar, e divergir num caminho é erro na subida.
- **`.refine()` some da conversão, em silêncio** — JSON Schema não expressa
  função. O campo `notas` do `@Contrato` existe para essas restrições virarem
  texto: sem ele o documento mente por omissão.
- **Schema de resposta é CONFERIDO, não só publicado** (ADR-37): `.parse()`
  estrito nos testes, `safeParse` com aviso no log fora de produção
  (`ContratoInterceptor`), e **no-op em produção** — schema estrito demais não
  pode transformar rota que funciona em 500. O aviso carrega só caminho e código
  do problema, nunca o valor: a resposta desta api tem nome de criança e CPF.
- **Senha: `SWAGGER_USUARIO` + `SWAGGER_SENHA` (mín. 16).** Ausentes ⇒ a rota
  **não é montada** e o 404 é do roteador — não 401, que confirmaria o mapa.
  Meia credencial derruba a subida. Nos dois compose há default de DEV
  (`docs` / `unooria-docs-local`): sem ele o `/docs` só funcionaria para quem
  descobrisse que precisa exportar env, ou seja, para ninguém. Em produção as
  duas vêm do Secret Manager (`{contrato}-swagger-senha`).
- **A trava é `tests/openapi-cobertura.spec.ts`**: percorre o roteador e cobra
  `@Contrato` de toda rota, salvo as da lista `SEM_CONTRATO_AINDA`, **que só
  encolhe**. Cada commit cobre um módulo (`<modulo>/contrato-de-rotas.ts` — o
  nome `contrato.ts` já é o payload do jogo na exp-70) e apaga as linhas dele,
  copiando a prosa daquele módulo do `c-endpoints.tex` para a `descricao`. Feito:
  `health`, `auth`, `experiencias`, `progresso`, `telemetry`, `ai`, `rostering`
  (escolas, turmas, matrículas, períodos, lotações, estudantes), `usuarios`,
  `planos` (+referências), `bemestar`, `vila`, `unootube`, `portabilidade`,
  `perfis`, `analise`, `unoogpt`, `o-eco-no-grupo`, `atividades`, `geracao`,
  `motor` (runs/posts).
  **As 167 rotas estão cobertas, e a lista está VAZIA** — rota nova sem contrato
  fica vermelha.
- **`docs/openapi.json` é versionado** e o **apêndice C do LaTeX é GERADO dele**
  (`scripts/gerar-endpoints-tex.mjs`) — eram 547 linhas de prosa à mão que nada
  obrigava a concordar com o código. A coluna de autorização do apêndice vem das
  extensões `x-papeis`/`x-acesso` do documento, nunca de parsing da descrição:
  gerador que lê a própria prosa quebra em silêncio na primeira reescrita da
  frase. Mudou rota? Regere os dois e recompile o PDF.


## Provider de IA (`apps/api/src/ai/provider.ts`)
Interface única `AiProvider { generate(req): Promise<AiResult> }`. Implementações:
`vertex.provider.ts` (default), `mock.provider.ts` (testes). Para trocar de
provedor, cria-se novo arquivo — nada fora de `src/ai` conhece o vendor.

**O mock falha FECHADO em `generateJson` e `generateImage`** (lançam sempre) e
NÃO falha em `conversar` — conversa não tem fallback autorado, e falhar ali
deixaria a exp-03 sem abrir em dev. Quem chama `generateJson` precisa decidir o
que fazer com isso: reações ao vivo caem em lista vazia, geração de posts vira
job falho que o painel mostra, e **`/destilar` devolve 503 com a causa** (ADR-52)
— era o único sem tratamento, e em `AI_PROVIDER=mock` fazia criar atividade
responder 500 opaco. Consumidor novo de `generateJson` decide isso explicitamente.
`AiRequest.modelo: "padrao" | "longo"` escolhe a família (o `longo` mapeia para
`VERTEX_MODEL_LONGO`, Gemini 2.5, saída até 65k — planos anuais); quem gera texto
longo checa `AiResult.finishReason` (`MAX_TOKENS` = conteúdo cortado, é erro).

**Credencial: ADC, nunca chave de API.** O provider pega o token com
`google-auth-library`, que resolve na mesma ordem nos três ambientes:
`GOOGLE_APPLICATION_CREDENTIALS` → arquivo do `gcloud auth application-default
login` → metadata server (Cloud Run). Antes daqui só havia o metadata server, e
por isso NENHUMA chamada de IA funcionava fora do Cloud Run — nem no host nem no
container, onde `metadata.google.internal` não resolve; em dev a api ficava presa
no `AI_PROVIDER=mock` e a exp-90 devolvia um plano falso. Os dois compose montam
o ADC do host em `/adc` (só leitura); em Cloud Run a service account do serviço
já é a credencial, e ela precisa de `roles/aiplatform.user`.

**Modelo × região (decisão, 2026-08).** O modelo é `gemini-3.6-flash` e a
localização é `global` — para texto E para o plano de aula. Medido no projeto do
contrato: o 3.6-flash dá 404 em `southamerica-east1`, `us-east1` e `us-central1`;
só o endpoint `global` (sem host regional) o serve. A consequência é explícita e
foi aceita: o tráfego de IA sai de São Paulo, inclusive o do estudante. Voltar para
`VERTEX_LOCATION=southamerica-east1` é possível a qualquer momento, mas exige
trocar TAMBÉM o modelo pelo que a região publica (família 2.5 — a 2.0 saiu do
catálogo e a 3.x nunca esteve lá). A arte da exp-01 usa `gemini-3.1-flash-image`
(o `gemini-2.0-flash-exp` que era o default não existe mais em lugar nenhum, e
por isso toda geração de imagem caía no fallback procedural), e PEDE a proporção
`4:5` no `imageConfig`: sem isso o 3.1 devolve 1408×768 e o `cover` do
`AssetsService` (1080×1350) descarta mais da metade da largura. O modelo aceita
1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9 e 21:9 pelo MESMO custo em tokens —
experiência com outro formato deve pedir o formato, não recortar depois.

**Raciocínio conta como saída.** Nos modelos 2.5 e 3.x os tokens de pensamento saem do
`maxOutputTokens`: com pensamento livre o plano anual voltava VAZIO com
`finishReason: MAX_TOKENS`. `VERTEX_THINKING_BUDGET` (default `0`, desligado)
mantém a paridade com o app origem, que usava Claude sem essa etapa; `-1` volta
ao dinâmico.

**Voz (`generateSpeech`) não é o aiplatform** — é a **Cloud Text-to-Speech**
(`texttospeech.googleapis.com/v1/text:synthesize`), com os mesmos modelos Gemini
por trás e o MESMO ADC, mas host, caminho e corpo próprios (por isso não passa
por `endpointVertex`). `VERTEX_TTS_MODEL`, default `gemini-2.5-flash-tts`. Saída
em **MP3**, decidida na origem: não há ffmpeg neste repositório, e um WAV de
3m30 passaria de 10 MB.

Três coisas que custaram tempo e não se descobrem por typecheck:
- **A API precisa estar habilitada** (`gcloud services enable
  texttospeech.googleapis.com`), e sem isso a resposta é 403.
- **Com ADC de USUÁRIO ela exige um "quota project"**, que a credencial de quem
  fez `gcloud auth application-default login` não carrega — e o aiplatform NÃO
  exige. O sintoma engana: no mesmo preparo, imagem funciona e voz responde 403
  `PERMISSION_DENIED`, com uma mensagem que não fala de voz. O provider manda
  `x-goog-user-project: $VERTEX_PROJECT_ID` para resolver sem mexer no ADC de
  ninguém; em Cloud Run a SA já traz o projeto.
- **Os tetos são em BYTES** (4.000 para o texto, 4.000 para a direção de
  atuação): em pt-BR cada acento conta 2, e medir por `length` deixa passar um
  roteiro que a API recusa com 400. `generateSpeech` valida antes de chamar.

**Diálogo é UMA chamada**, com `turnos` e `multiSpeakerMarkup`: o modelo ajusta
pausa e entonação entre as vozes. Sintetizar cada fala à parte e concatenar
devolveria duas leituras em voz alta, não uma conversa — e a concatenação exigiria
o ffmpeg que não existe aqui. `AiTimbre` é neutro de vendor (`jovem-feminino`,
`idoso-feminino`…) pelo mesmo motivo de `AiRequest.modelo`: quem escreve o
roteiro descreve QUEM fala, não o nome de catálogo de uma voz do Google. O mapa
timbre → voz é a única tradução, e vive no `vertex.provider.ts`.

**O mock falha fechado em `generateSpeech`**, como em `generateJson` e
`generateImage`: um MP3 de silêncio seria pior que a ausência (o estudante
apertaria o play e concluiria que o áudio quebrou). Quem chama cai na
transcrição, que já está na tela por acessibilidade.


## Plano de aula (exp-90, `apps/api/src/planos`)
Ferramenta do professor: `POST /planos` (202) gera em background (claim atômico
em `exp_90_planos`, `marked` roda na api), o cliente faz polling em `GET /planos/:id`.
Conteúdo em object storage PRIVADO (`{contrato}-planos`; `PLANOS_DRIVER=local`
em dev → `storage-privado/`): `gerado.md` imutável + `atual.html` do editor
(sanitizado com allowlist). Referências curriculares = texto no Postgres
(`exp_90_referencias`, catálogo do contrato, sem RLS), importadas por
`scripts/importar-referencias-plano.mjs` com `PLANOS_IMPORT_TOKEN`.
O teto de saída é 64k tokens, não os 32k do app origem (que eram o limite do
Claude): com o material real (currículo da rede + as 4 unidades do ano, ~190k
tokens só de prompt) o gemini-2.5-flash é cortado em 32k e o professor recebe
"o plano ficou grande demais" sem plano nenhum.


## Vila do Lume (exp-70, `apps/api/src/vila`)
Jogo 3D **transversal** — não pertence a ano nenhum (`series: []`), e é o "Ato 1"
que o catálogo do Entre Redes sempre descreveu: *"fora da plataforma, um jogo
mede o perfil de valores do estudante"*. O perfil dele alimenta `perfis_importados`
(a largada do Instanooria) — M5.

**Duas leituras de uma partida, e elas NÃO SE TOCAM.** O retrato Schwartz
(`mapeamento.ts`, 10 valores + 2 eixos) lê escolhas com custo dentro do jogo; a
missão "A Noite Longa" (`mensagens.ts`) lê julgamento sobre 5 mensagens. A
separação é de MEDIDA: um golpe que custasse fagulha faria a criança que caiu
aparecer como menos generosa no retrato, e nada no relatório mostraria isso.

**O servidor recalcula; nunca aceita o perfil do cliente.** O jogo sabe computar
o retrato e deliberadamente não o envia — `CHAVES_DE_PERFIL` no contrato recusa
payload que traga. É isso que permite reprocessar o histórico quando
`VERSAO_MAPEAMENTO` subir (hoje 3, herdada do piloto para os dados serem
comparáveis).

**`grau` é invariante de API, não regra de tela.** Valor com UMA fonte de medida
não recebe número. A api devolve linhas em que só a variante `scored` tem
`numero: number`; as outras têm `null` POR TIPO (`leitura.ts`). O hub fica
estruturalmente incapaz de imprimir "Poder 100" a partir de um sinal só. E a
diferença entre `zero` ("teve a chance e não foi", entra na média) e `none` ("a
oportunidade não chegou", sai da conta) é a coisa mais importante do modelo.

**A bolha é do SERVIDOR.** `POST /vila/sessoes` atribui A/B/C balanceada dentro
da TURMA, persiste em `vila_bolhas` (estável entre partidas: a folha do professor
diz "esse estava na C") e devolve os cartões — **só os desta criança e sem
gabarito**, como o `factual` do UnooTube. Era `estudanteSlot % 3` no navegador, o que
punha no bundle a condição do próprio instrumento e deixava as três versões
legíveis antes da aula. Nos anos iniciais (1EF–5EF) a bolha B não é servida
("suporte" exige entender o que é suporte) — regra que só a api pode aplicar,
porque só ela sabe a série. O lock consultivo por turma não é zelo: a sala clica
junto, e sem ele os 25 caem todos na bolha A.

**O relatório abre pelo NÍVEL, antes do que ela fez.** "Caiu em 2 de 3" sem dizer
que era o nível C faz o adulto concluir que a criança é ingênua — o rótulo que
este projeto existe para não produzir.

**`cartoesServidos` ≠ `apareceram`.** O primeiro é quantos a api entregou; o
segundo, quantos chegaram a aparecer. Zero aparecidos ⇒ a tela diz "as mensagens
não chegaram nesta partida", **nunca** "ela ignorou tudo" — é a mesma distinção
entre `zero` e `none`.

**Sem tabela de evento fino.** O bruto vive em `vila_sessoes.payload` (fonte do
reprocessamento) e o canal analítico do SDK já grava em `telemetria_eventos`.
`eventos[].dados` só aceita número, booleano ou string de um **vocabulário
fechado** — o `texto` livre que existia era o único canal de texto arbitrário do
payload, e o caminho por onde o nome de uma criança chegaria a um JSONB de 90
dias. Trava estrutural, não lista de proibidos.

**Telas do professor** (`/professor/entre-redes/vila-do-lume`): ficha (para que
serve, quem consome o perfil, passo a passo), `/guia` (o debate),
`/resultados?turmaId=` (com o botão de **zerar a turma**) e `/estudantes/:id`.

**O `/guia` precisa saber a TURMA.** Nos anos iniciais a api não serve a bolha B,
e uma tela que projetasse as três mandaria o professor esperar a reação de um
grupo que a sala dele não tem — `GET /vila/professor/cartoes?turmaId=` filtra
pela mesma regra de `abrir` (`bolhasElegiveis`).

**Zerar a turma apaga as BOLHAS junto.** Rodar de novo com a mesma bolha serviria
à criança o mesmo golpe: ela reconhece, e a segunda rodada não mede nada. O que
NÃO é tocado é `perfis_importados` — aquilo pertence à atividade do Instanooria, e
apagar de lá trocaria os lados de uma aula em andamento. O `/guia` projeta as mensagens das TRÊS bolhas lado a lado — é a
revelação da missão, e a primeira vez que a turma vê as outras versões. Os textos
vêm de `GET /vila/professor/cartoes` (COM gabarito, professor only), nunca de
cópia no hub: os textos SÃO o instrumento, e uma vírgula divergente entre o que o
jogo serviu e o que o professor projeta põe a sala discutindo uma mensagem que
ninguém recebeu. A LISTAGEM da
turma não mostra valor de Schwartz nenhum — listagem é ordenável, e uma coluna
"Poder" viraria ranking de crianças; os valores vivem na tela individual, uma
criança por vez, com o grau ao lado. O agregado (`/vila/agregado/*`) abre para
gestor; a linha de uma criança, não — são controllers separados, e não um
`@Roles` misto com exceção por método.

**Dois avisos do repo de origem sobre o DS estão OBSOLETOS na 0.1.11**, medidos
no pacote: o `MetricCard` **não inventa mais tendência** (o prop é `tagText?` e a
doc diz "sem ela a etiqueta não é renderizada"), e o `PositiveNegativeBarChart`
tem escala **fixa** em ±100 (`h = (val / 100) * 110`) — é exatamente o que os
eixos do circumplexo pedem, então a barra divergente NÃO é mais escrita à mão. O
terceiro segue valendo: `AlertBox` é diálogo de 436px; para faixa de contexto,
`FeedbackAlert` (o prop é `type`, não `variant`).

**Cor da plataforma vem de classe escrita à mão** em
`packages/ui/styles/plataforma.css`, e o tema do Tailwind está VAZIO
(`theme.extend: {}`). Classe de cor que não existe ali não é erro em lugar
nenhum: em texto ela herda a cor e passa desapercebida, em FUNDO o elemento fica
branco no branco. Foi o que aconteceu com `bg-unooria-neutral-900` (letra da
bolha invisível). O smoke da exp-70 checa o `backgroundColor` COMPUTADO do
círculo por isso — `toBeVisible()` não pega. Só existem hoje:
`bg-unooria-{navy-800,neutral-50,neutral-100,neutral-200}`,
`border-unooria-neutral-200`,
`text-unooria-{danger,navy-900,neutral-500,neutral-700,neutral-800,neutral-950}`.

**Ato 1 do Instanooria: deixou de ser externo.** `POST
/atividades/:id/perfis/da-vila` (professor) colapsa o perfil da Vila nos quatro
quadrantes e grava em `perfis_importados` com `origem: "jogo"` — é o que decide
de que lado o feed nasce (`largada.ts`). `PERFIL_IMPORT_TOKEN` e
`POST /perfis/importar` continuam vivos como compatibilidade.
O colapso (`vila/quadrantes.ts`) tem duas travas que CUSTAM estudantes, de propósito:
valor não observado (`indicative`/`none`) **fica fora da média**, nunca entra como
zero; e quadrante sem nenhum membro observado **invalida o perfil inteiro** —
sem perfil, o Instanooria cai no sorteio balanceado, que é honesto sobre não
saber. Exige `amostraSuficiente`: o `dominante` vira coluna no CSV do `/analise`
ao lado da identidade da criança, e deixar uma partida curta decidir isso seria
dizer pelas costas o que o relatório se recusa a dizer na frente.
O disparo é do PROFESSOR e `ladoForcado` é PRESERVADO no upsert: importar
sozinho, ou levar o objeto inteiro no `update`, desfaria em silêncio uma
redistribuição que ele fez antes da aula.

**O perfil importado guarda a PARTIDA e a VERSÃO** (`vila_sessao_id`,
`versao_mapeamento` — ADR-50). Sem elas, subir `VERSAO_MAPEAMENTO` recalculava
`exp_70_perfis` e deixava a CÓPIA que decide o feed na geração anterior, em
silêncio: a armadilha do `expires_at` de novo. **Sem FK** para `vila_sessoes`, de
propósito — zerar a turma na Vila apaga sessões, e a cascata levaria o perfil que
está decidindo o lado de uma aula em andamento; é rastro da medida, não
integridade. Gravadas no `create` E no `update`, senão reimportar não tiraria a
linha do estado "desatualizada" e o aviso da tela nunca sumiria. Nenhum valor
novo de `origem`: duas CHECKs congelam o vocabulário, e `vila_sessao_id IS NULL`
já diz "não veio da Vila desta instalação". Não há rotina de reprocessamento, e
continua não havendo — o que existe é o AVISO no painel.

**Retenção: NÃO HÁ PRAZO DECLARADO** (decisão de 2026-08-26). Houve um
`expires_at` de 90 dias no schema e nenhuma rotina que o cumprisse — e coluna de
prazo que ninguém lê é pior que prazo nenhum, porque quem lê o schema acredita
nela. É a mesma armadilha do `turmas.consentimento_em` do app de origem: a regra
saiu do código, a coluna ficou, e todo mundo continuou acreditando.

O que se ganha em troca é o REPROCESSAMENTO, que é requisito de verdade deste
instrumento: `payload` é a única fonte para recomputar o perfil quando
`VERSAO_MAPEAMENTO` subir, e o mapeamento é hipótese de design que VAI mudar.
90 dias matavam exatamente a comparação entre duas gerações.

Se um contrato exigir prazo, ele volta **junto com a rotina que o cumpre** —
nunca só a coluna. A mesma pergunta está aberta para `telemetria_eventos`, que
guarda evento por `estudante_id` de todas as experiências e também não tem prazo: se
a resposta importar, ela é da plataforma inteira, não de um módulo.


## Missão Tempestade (exp-03, `apps/api/src/unoogpt`)

- **Marco novo leva o relógio do INSTANTE, nunca `sessoes.minutos_gastos`.**
  `gravarMarco(..., estado)` recebe o `EstadoDoRelogio` de `relogioAgora(tx,
  escolaId, turmaId)` e grava `minuto`, `segundos_restantes` e `motivo_do_fim`
  dele. `minutos_gastos` é o retrato do último turno do Cientista — um turno
  leva 10–30 s (2–6 minutos da cidade), e as rotas diretas (`alocar`,
  `carregarConjuntos`, `simular`) gravavam com ele; a saída das equipes saía
  no minuto de um turno atrás (ADR-64). O relatório do professor lê o
  cronômetro gravado; reconstruí-lo depois é inviável ("+2 min" muda a duração
  sem histórico, "zerar" apaga o relógio).
- **O que o professor lê de TEMPO é derivado na leitura, não coluna**:
  `mudancasDeDestino` (pares consecutivos distintos — o cartão de duas opções
  manda dois POSTs e justificar passa pela mesma rota), `coberturaDoRisco`,
  `posicaoNaFaixa` (`regras/trilha.ts`, `regras/desfecho.ts`). Só se grava o
  que não dá para recalcular: o cronômetro do marco e `simulacoes.esperado`.
- **A fala do estudante é datada por `agora`** (a hora do envio), porque a
  gravação acontece depois do `await` do provedor. Sem isso a hora é o fim do
  turno.
- **`reiniciar` grava `recomeco` na tentativa que FECHA**, com `origem` (vem do
  corpo, opcional — cliente antigo não manda) e `fase`/`modo` do relógio. Não
  existe "liberar recomeço" pelo professor; o que ele controla é o relógio.
- **`GET /resultado` do estudante filtra os tipos** `fontes|leitura|alocacao|envio`:
  a linha do tempo do cliente cai no ramo de `envio` para tipo desconhecido, e
  narraria `inicio` como "enviou 0 resgatadas".
- Número de resgate **só na rota individual** (`doEstudante`); a folha da turma
  fala de conduta, e `tests/unoogpt-postgres.spec.ts` quebra se `salvas`
  entrar nela.

## O Eco no Grupo (exp-07, `apps/api/src/o-eco-no-grupo`)

Missão de 7º ano conduzida pelo **relógio da turma**, em duas aulas. Quatro
tabelas (`exp_07_sessoes`, `exp_07_reflexoes`, `exp_07_mensagens`,
`exp_07_gates_turma`), gabarito só no `catalogo.ts`, e IA em três superfícies.

- **A etapa da turma é PISO e TETO** (`regras/passos.ts`, molde de
  `comum/insta/etapas.ts`). Piso porque quem chegou atrasado não fica para trás;
  teto só na etapa `debate`, que é o que "congelar as telas" quer dizer — e ali
  congela **todos**, não só quem já leu os cards. **Estudante sem turma
  (`etapa: null`) não tem gate**: uma criança fora de turma não pode ficar presa
  esperando uma aula que não existe.
- **O cliente nunca recebe a letra certa; ele recebe `desfecho`**
  (`checada | ruido | conflito`), calculado no servidor. A primeira versão
  deixava a tela decidir por `opcao === "B"`, e a resposta certa ia legível para
  o JS público (regra 3).
- **`POST /intervencao` recusa com `sem-inspecao` (409) quem não abriu a matéria
  completa.** É portão pedagógico, não validação: a missão existe para ensinar a
  conferir antes de repassar.
- **A cadência da cascata é do servidor** (`atrasoMs`: 2 s → 3 s → 2 s). A espera
  é o pico da missão; decidi-la no cliente a tornaria alterável pelo DevTools.
- **A conversa com Amara é o único texto livre de estudante do produto.** Só
  depois da decisão, teto de 3 turnos e 600 caracteres, sanitizador nos dois
  sentidos, e **fora de log, telemetria e painel** — o professor vê quantos
  turnos, nunca o quê (ADR-66).
- **A mídia é preparada pelo PROFESSOR**, uma vez, e cacheada no bucket
  (`midia.service.ts`, idempotente, com lock). `GET /midia` devolve `null` no
  que falta, e `null` é informação: o cliente cai na transcrição e na ilustração
  procedural em vez de esperar arquivo que não existe (ADR-67).
- **`praca-cerrada` é RECORTE de `praca-aberta`**, não uma segunda geração: o par
  print/matéria só funciona se a foto for a mesma. A janela do recorte tem de
  ter a **proporção do destino** — com proporção diferente, o `cover` recorta de
  novo e come o que importava. E a origem se lê pelo mesmo driver
  (`lerMidiaDeExperiencia`), nunca por HTTP: a URL pública aponta para outro
  processo e dá 404.
- **`[mock]` está deliberadamente FORA de `MARCAS_DO_PROMPT`** no sanitizador.
  Se entrasse, Amara ficaria muda em desenvolvimento com `AI_PROVIDER=mock`.

## Check-in de bem-estar (exp-91, `apps/api/src/bemestar`)
Ferramenta do professor: o **DASS-21** (Lovibond & Lovibond 1995; versão
brasileira Vignola & Tucci 2014; domínio público) em **microdoses** — 3 frases
por dia, 7 check-ins fecham os 21 itens, um texto livre opcional. Decisões:
- **Os 21 itens são fixos e verbatim** (`catalogo.ts`). A IA NUNCA reescreve
  um item: reformular quebra a validação psicométrica e as faixas de corte.
  O que a IA gera é o entorno — abertura do dia, pergunta aberta, acolhimento
  ao texto — e cada texto passa por `regras.validarTextoDaIa` (sem vocabulário
  clínico, ordens, promessas, gestão, links, tamanho). Barrado, sem saldo ou
  sem provider ⇒ texto fixo do catálogo; o check-in nunca deixa de abrir.
  A IA nunca recebe nome, escola, pontuação ou faixa (só dia da semana, mês,
  nº do check-in e o texto livre, delimitado como conteúdo).
- **Correção server-side** (regra 3): ao 7º check-in a api soma por subescala
  (×2) e classifica pelas faixas publicadas. `pontuar`/`faixaDe` em `regras.ts`.
- **Sinal de apoio**: item 17 ou 21 ≥ 2, ou termo de risco no texto ⇒ mensagem
  FIXA de apoio (CVV 188, SAMU 192, CAPS/UBS) e a IA não é chamada.
- **Dado sensível (LGPD art. 11)**: `bem_estar_ciclos`/`bem_estar_checkins`
  com RLS + posse por `professor_id` em toda query; **nenhuma rota de gestor
  ou agregado** — só o professor lê, e `DELETE /bemestar/dados` apaga tudo.
  Texto livre nunca vai a log nem à telemetria (só contagens).
- 1 check-in por dia (`dia` em `America/Sao_Paulo`); ciclo expira em 21 dias
  sem fechar. `GET /bemestar/resumo` é leve (sem IA) — é o que o card do hub lê.


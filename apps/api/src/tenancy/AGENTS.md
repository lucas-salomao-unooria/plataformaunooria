# apps/api/src/tenancy — rede, escola, lotação e CPF

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A rede: escola, lotação e CPF (2026-08-28)

**Uma rede estadual não é uma escola grande.** São milhares de unidades,
professores em mais de uma, e crianças que se transferem. A decisão que torna
isso barato é o que NÃO muda: **o token continua carregando UMA escola**. As
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
- **Criar escola é dos perfis de contrato (`gestor_contrato` e `admin`) e de mais ninguém**, inclusive no `orgs.csv`:
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
- **A importação `orgs.csv` não cria escola sem regional** (ADR-79): com UMA
  regional na rede, `parentSourcedId` ausente ou desconhecido vira vínculo
  automático + aviso; com VÁRIAS, a linha é **erro** com o número dela. Pai nulo
  deixaria a escola órfã, que o CHECK do banco recusa.
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

# apps/api/src/rostering — identidade e enturmamento

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito. **Quem escreve
pessoa é o importador** — `POST /usuarios` monta a mesma linha de planilha e
delega para cá (ADR-54, ADR-59).

## Identidade e enturmamento (2026-08-28)

**Uma conta por PESSOA, a mesma no hub e em todas as experiências.** As
experiências vieram de projetos onde cada atividade tinha cadastro próprio; a
unificação técnica já existia (todas recebem `estudante.id` pelo `hub:init` e gravam
`estudante_id` com FK para `users`), mas a conta era de ASSENTO — está escrito no
schema: `exp08ef1b_runs.nome_no_app` existe *"porque a conta é do APARELHO: outra
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
  molde certo passa `professorDoToken` (`comum/turmas-do-professor.ts`) em
  todas as rotas de turma, sem exceção.
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
  `comTenancy` NOVA. Custou um 500 no boot da app-91: o `catch` estava escrito
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
  OBRIGATÓRIO** (`exp08ef1b_activities.turma_id`, ADR-49 revista pela ADR-69).
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

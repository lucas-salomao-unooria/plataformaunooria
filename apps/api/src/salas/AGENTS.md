# apps/api/src/salas — a missão dentro da turma (ADR-69)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## A sala de aula: a missão dentro da turma (2026-09-05, ADR-69)

`liberacoes` (turma × experiência × estado) é a camada que faltava entre
`turmas` e `experiencias`. **Sem linha, a missão não abre para aquela sala.**

- **A porta é `comum/liberacao.ts#exigirMissaoLiberada`**, e ela fica no FUNIL
  das rotas de estudante de cada experiência — `estudanteDaEscola` no UnooTube e
  no Eco, `garantirSessao` no unooGPT, `abrir` na Vila, e o controller em
  `POST /runs` + `GET /runs/boot` (a exp08ef1b é a única cuja entrada está no
  controller). Pô-la só na rota de leitura deixa a de escrita aberta a quem
  chamar direto: no UnooTube, `POST /salvos` cria a sessão sozinho.
- **Fica na CRIAÇÃO da sessão, não em toda rota.** Quem já entrou fica —
  encerrar fecha a entrada, não expulsa a criança no meio da aula.
- **Experiência nova declara o próprio `EXP_ID`** (`comum/insta/defaults.ts`,
  `unootube/catalogo.ts`, `unoogpt/regras/defaults.ts`, `vila/catalogo.ts`)
  e ele tem de bater com o `id` do
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
  exp02em1b (que servia o relógio "aguardando" a quem estava solto). Sem sala não há
  missão; quem explica é a tela do hub, porque um erro dentro do aparelho não
  diria "peça para a coordenação te matricular" sem sair do disfarce.
- **Fixture de teste que abre experiência precisa de `tests/liberar-de-teste.ts`.**
  Quatro suítes quebraram quando a guarda entrou — quem quebrar com
  `missao-nao-liberada` não tem bug, tem fixture faltando.
- **A sala do professor diz quantas equipes cada missão tem** (`missoes[].equipes`,
  E13/ADR-111, de `equipes/consulta.ts#contarEquipesDaTurma`) — só no schema do
  PROFESSOR: `MissaoNaGradeSchema` também responde `/salas/minhas`, e a contagem da
  sala inteira não é assunto do estudante.

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

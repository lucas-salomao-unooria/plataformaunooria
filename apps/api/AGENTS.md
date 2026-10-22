# apps/api — a API (NestJS + Postgres)

Complementa o `AGENTS.md` da raiz, que vence em conflito.

Aqui fica **o que vale para TODA a api**. O que é de um módulo vive no
`AGENTS.md` dele, e chega sozinho quando você abre a pasta:

| Módulo | O que está lá |
|---|---|
| [`src/tenancy/`](src/tenancy/AGENTS.md) | rede, escola, lotação e CPF; buscar profissional na rede |
| [`src/rostering/`](src/rostering/AGENTS.md) | identidade e enturmamento — **quem escreve pessoa** |
| [`src/salas/`](src/salas/AGENTS.md) | a missão dentro da turma (ADR-69) |
| [`src/equipes/`](src/equipes/AGENTS.md) | quem divide um computador na missão (E13, ADR-111) |
| [`src/evidencias/`](src/evidencias/AGENTS.md) | a evidência pedagógica por habilidade da BNCC — a ficha, a porta `marcar` das missões (E14, ADR-112) |
| [`src/recursos/`](src/recursos/AGENTS.md) | disponibilidade: o interruptor da rede (ADR-87, ADR-89) |
| [`src/prospeccao/`](src/prospeccao/AGENTS.md) | o cadastro de interesse do site — **sem token e sem tenancy** (ADR-107) |
| [`src/experiencias/`](src/experiencias/AGENTS.md) | catálogo e versão — duas alavancas que não se misturam |
| [`src/analise/`](src/analise/AGENTS.md) | o relatório da diretoria (ADR-82) |
| [`src/observabilidade/`](src/observabilidade/AGENTS.md) | log e contexto de requisição |
| [`src/telemetry/`](src/telemetry/AGENTS.md) | telemetria: dois canais, não um |
| [`src/portabilidade/`](src/portabilidade/AGENTS.md) | perfil portátil: sair da rede |
| [`src/openapi/`](src/openapi/AGENTS.md) | OpenAPI derivado do Zod |
| [`src/ai/`](src/ai/AGENTS.md) | o provider de IA — **nenhuma chamada acontece fora daqui** |
| [`src/agente-professor/`](src/agente-professor/AGENTS.md) | o agente de IA do professor: posse da conversa e o SSE do turno (contrato em `docs/regras/agente-professor.md`) |
| [`src/ajuda/`](src/ajuda/AGENTS.md) | a Ajuda (ADR-132, ADR-158): o avatar (o LLM OpenAI-compatível que o LiveAvatar chama) e o mascote (o proxy WebSocket do Gemini Live, com bilhete), o medidor de minutos dos dois — **fora da quota de tokens** |
| [`src/podcast/`](src/podcast/AGENTS.md) | o podcast de recapitulação de toda missão (ADR-150): rotas únicas, a fonte que a missão registra e as falas do tema que o professor revisa |

E os módulos de experiência, um por missão:

| Módulo | Experiência |
|---|---|
| [`src/comum/insta/`](src/comum/insta/AGENTS.md) | exp08ef1b Unoovista — o relógio da aula (ADR-92); com ficha (E14) e o Canal A (ADR-167): as tarefas e a leitura da reflexão em `src/motor/canal-a/` |
| [`src/efeito-amplificador/`](src/efeito-amplificador/AGENTS.md) | exp02em1b O Efeito Amplificador (ADR-180): o UnooriaAI por intenções (sem IA na aula), o latch do Publicar, o feed da madrugada e a Etapa 5; ficha só Canal A (sem transferência nem Canal B, decisão do PO), equipe (E13) e podcast fixo |
| [`src/unoogpt/`](src/unoogpt/AGENTS.md) | exp02em1b-v0 — a Missão Tempestade, VERSÃO ANTERIOR (ADR-180): no ar e fora do catálogo; tabelas `exp02em1b_v0_*` — com ficha (E14: atividade "turma", conta ao encerrar) e o Canal A (ADR-172): as sete tarefas em `canal-a.service.ts`; e equipe (E13) |
| [`src/a-selecao/`](src/a-selecao/AGENTS.md) | exp07ef1b A Seleção — com ficha (E14) e o Mural pareado por computador (E13) |
| [`src/quem-mandou-isso/`](src/quem-mandou-isso/AGENTS.md) | exp05ef1b Quem Mandou Isso? v2.2 — com ficha (E14) e equipe (E13) |
| [`src/jornal-escola/`](src/jornal-escola/AGENTS.md) | exp04ef1b Jornal da Escola: A Edição de Bento — com ficha (E14) e o Canal A (ADR-168): julgar cada pista, a Chave montada, a simulação e o boato; equipe (E13) e a IA que só diagrama |
| [`src/juri-estadual/`](src/juri-estadual/AGENTS.md) | exp06ef1b O Júri Estadual de Projetos — 40 projetos (o pacote de 16 da 0.4.x segue legível), o motor do feed no servidor (sem repetir post, 8 min), a Galeria Oculta (o por área e o contrafactual seguem calculados, fora da tela desde a 0.7.0), a concentração na lousa, a mostra da IA (cinco chamadas) ou o banco padrão de 40 com as imagens geradas pelo `admin`, ficha (E14) e o Canal A (ADR-174/176): a separação nas pastas do feed, corrigida no voto, e a regra SE … ENTÃO, que conclui; equipe (E13) |
| [`src/vila/`](src/vila/AGENTS.md) | app-70 Vila do Lume |
| [`src/backup-unootube/`](src/backup-unootube/AGENTS.md) | o UnooTube ARQUIVADO (`backup-exp04ef1b`, ADR-116): compila e é testado, mas não está no `app.module` |
| [`src/planos/`](src/planos/AGENTS.md) | app-90 Plano de aula |
| [`src/bemestar/`](src/bemestar/AGENTS.md) | app-91 Check-in de bem-estar |

**Módulo novo nasce com `AGENTS.md` + `CLAUDE.md` de uma linha**, e entra nesta
tabela no mesmo commit — a tabela é o que faz a pasta ser encontrada por quem
não sabe que ela existe.

## Papéis: seis nomes e uma cadeia (ADR-80, 2026-09-08)

`estudante | professor | gestor_escola | gestor_regional | gestor_contrato | admin`

- **`gestor_escola`** era `gestor`; **`gestor_contrato`** era `admin-contrato` (o
  hífen saiu: era o único do vocabulário, e separador diferente dos outros é a
  diferença que ninguém lembra na hora de escrever a comparação).
- **O vocabulário vive em `auth/claims.ts`**, e nada de comparar papel na mão:
  use os grupos (`GESTORES_DA_ESCOLA`, `GESTORES_DO_CONTRATO`, `GESTORES`) nos
  `@Roles` e `ehDoContrato(...)` no lugar de `perfil === "gestor_contrato"`. São
  dezenas de decoradores e de comparações: com os nomes espalhados, o papel novo
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

## "Quem trabalha nesta escola" é LOTAÇÃO, nunca `users.escola_id`

O desenho está em `src/tenancy/AGENTS.md` e **foi violado na prática** — o
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

## O teardown de uma suíte não pode falar pelo setup

**Cliente de banco de suíte nasce no MÓDULO, com `const` — nunca dentro do
`beforeAll`.** Criado no FIM do `beforeAll`, qualquer falha do setup ANTES
daquela linha deixa a variável `undefined`, e o `afterAll` estoura com
`TypeError: Cannot read properties of undefined (reading '$disconnect')` — e
**é o erro do teardown que o Jest imprime**, no lugar do erro que quebrou de
verdade. A suíte reprova dizendo a coisa errada, de forma intermitente, e a
causa real nunca aparece no relatório.

**A limpeza do `afterAll` vai `best-effort`** (`await limpar().catch(() =>
undefined)`), pelo mesmo motivo: falha de limpeza também substitui o erro do
teste. As conexões fecham depois dela de qualquer jeito — sem `$disconnect` o
Jest não sai.

A URL do banco é constante de módulo: **não há motivo para o cliente esperar o
hook**. E a prova de que o mascaramento não existe não é a suíte passar: é pôr
um `throw` na primeira linha do `beforeAll` e conferir que o relatório mostra
AQUELA mensagem.

## Três armadilhas de banco, todas invisíveis no typecheck

- **`@@unique([recursoId, escolaId])` não impede duas linhas de contrato**: no
  Postgres `NULL` ≠ `NULL` num índice único. Quem fecha é o índice único
  **parcial** `WHERE escola_id IS NULL` (mesmo desenho de
  `escolas_regional_padrao_unica`). Sem ele, dois cliques em "desligar para a
  rede" criam duas linhas e o resolvedor passa a depender da ordem do `findMany`.
- **`disponibilidades` e `experiencias_versoes` ficam FORA da RLS**, contra o
  hábito da regra 1. São configuração da rede, e a linha de escopo-contrato tem
  `escola_id` nulo por desenho: a política por `escola_id` esconderia justamente
  a resposta. `tests/disponibilidades-postgres.spec.ts` prova a ausência, para que
  a próxima migração não a "conserte" — ligar RLS ali faz TODO produto parecer
  ligado.
- **Vocabulário em dois lugares**: `PRODUTOS` e `RECURSO_ID_RE` do código, e os
  CHECKs da migration. O mesmo par que já custou um deploy inteiro em
  `permissoes` — o Zod aceitou, o banco recusou, e o 500 só aparecia no log da
  api. O teste de Postgres compara os dois textos.

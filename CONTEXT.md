# Glossário de domínio — Plataforma Unooria

O vocabulário desta plataforma. Um termo por linha, com a definição curta e
**onde mora a definição de verdade** — quando as duas divergem, a fonte vence e
esta linha está desatualizada.

As regras que governam esses termos estão no `AGENTS.md` da raiz; as decisões
que os produziram, em `documentacao-latex/secoes/18-adr.tex`. Como as skills de
engenharia devem ler tudo isso está em `docs/agents/domain.md`.

**Nomes de domínio são pt-BR; termos técnicos, inglês** (`provider`, `guard`,
`batch`). Isto não é preferência de estilo: é o que faz o código, o banco, a
tela e o card do Notion falarem a mesma palavra.

## As pessoas e onde elas estão

| Termo | O que é | Fonte |
|---|---|---|
| **contrato** | Uma rede pública cliente (estado ou município). 1 contrato = 1 stack de infra GCP. O nome da rede **não existe no banco** — o contrato *é* a stack | `AGENTS.md` da raiz |
| **escola** | A unidade. Tudo que é dado de estudante é escopado por `escola_id`, com RLS | `escolas` |
| **regional** | O nível que agrupa escolas dentro de uma rede: Diretoria de Ensino, polo, secretaria municipal. Mesma tabela que escola, `tipo = 'regional'` | `escolas.tipo` |
| **rede** | O topo da árvore de organizações, `tipo = 'rede'` | `escolas.tipo` |
| **lotação** | O vínculo de uma **pessoa** com uma **escola**, datado, com papel. Um professor tem várias; um estudante, uma só ativa | `lotacoes` |
| **matrícula** | O vínculo de uma pessoa com uma **turma**. Só admite `estudante` e `professor` — gestor é papel de escola, não de turma | `matriculas` |
| **enturmamento** | O ato de pôr estudantes em turmas. Quem escreve pessoa é o importador, nunca um formulário direto | `apps/api/AGENTS.md` |
| **turma** | A sala. O `turma_id` do token é a matrícula **principal** do estudante | `turmas` |
| **período letivo** | Ano, semestre, bimestre ou trimestre. É o que impede a virada do ano de reescrever a história | `periodos_letivos` |
| **papel** | `estudante \| professor \| gestor_escola \| gestor_regional \| gestor_contrato \| admin`. Quem atribui quem sai da cadeia, nunca para cima | ADR-80; matriz em `secoes/07-tenancy-seguranca.tex` |
| **admin** | A Unooria. O único papel que opera a disponibilidade, na área `/unooria` | ADR-88 |

## O que o estudante abre

| Termo | O que é | Fonte |
|---|---|---|
| **experiência** | Um bundle estático (Vite) que o hub embeda num iframe. Nunca vira serviço no Cloud Run | `apps/experiencias/AGENTS.md` |
| **código da experiência** | O `expId`. Missão da trilha: `exp` + ano + etapa + unidade + `b` — `exp08ef1b` é o 8º ano do Fundamental, unidade 1; `exp02em1b`, a 2ª série do Médio. O que não é missão: `app-NN-nome` (`app-90-plano-de-aula`). É o mesmo na pasta, no pacote, no prefixo de tabela (`exp08ef1b_`, `app_70_`) e no bucket. O de missão é **derivado** de `series` + `unidade` do manifesto, nunca escolhido. Até 2026-09 era `exp-NN-slug`, com NN = ordem de criação — o de-para está na ADR | ADR-110; `apps/api/src/comum/codigo-da-experiencia.ts` |
| **missão** | A experiência **do ponto de vista da aula** — é a palavra que o professor e o estudante leem na tela | ADR-91 |
| **produto** | O agrupamento comercial de experiências. Declarado no `public/experiencia.json` de cada uma; a composição é **derivada** do manifesto, nunca uma lista à mão | regra 8 do `AGENTS.md` |
| **manifesto** | O `public/experiencia.json`: versão, produto, série, permissões. Mexeu na experiência, sobe a `versao` — e o `version` do `package.json` junto | `AGENTS.md` da raiz |
| **liberação** | *Esta missão está aberta NESTA TURMA?* Sem linha, não abre: 403 `missao-nao-liberada` | `liberacoes`, ADR-69 |
| **arquivada** | *Esta experiência saiu do produto sem ser apagada?* Quando uma missão nova toma o código de outra (o código é derivado da série e da unidade), a antiga ganha o prefixo `backup-` em tudo — pasta, módulo, tabelas, id nas tabelas da plataforma — e a linha do catálogo vai para `experiencias_arquivadas`. O código fica no lugar e compila; ninguém joga; o `admin` só LISTA em `/unooria/arquivados`. **Não é** desligada (disponibilidade: existe, mas está fora nesta rede) nem apagada (o Eco, ADR-113) | `apps/api/src/comum/arquivadas.ts`, ADR-116 |
| **equipe** | *Quem divide UM computador nesta missão?* Por turma × missão, montada pelo professor que leciona a turma (sorteio ou "Eu separo"); quem entra representa a equipe, e os painéis contam por computador. Só as missões de `EXPERIENCIAS_COM_EQUIPE` aceitam. **Não é** grupo pedagógico, nem as equipes fictícias Alfa e Bravo da Missão Tempestade, nem o "grupo" da ficção de uma missão | `apps/api/src/equipes/`, ADR-111 |
| **evidência** | *Que habilidade da BNCC esta criança DEMONSTROU nesta atividade, nesta rodada?* `atingiu \| em_processo \| nao_atingiu`. **N/A ("Não avaliado") é a AUSÊNCIA de linha**, e nunca conta como `nao_atingiu`; `nao_participou` é o N/A explícito que só o professor põe, e barra a cópia da equipe. Precedência: professor > a própria criança > a cópia da equipe (só o nível, nunca texto); a cópia da projeção chega `a_revisar` e só conta depois de "Confirmar para a turma". O estudante nunca vê a dele, e não há ranking. **Não é** nota, nem o dossiê do Instanooria | `apps/api/src/evidencias/`, ADR-112 |
| **atividade** | *O que a turma faz DENTRO de uma missão.* É da MISSÃO: cada uma define as suas, e a plataforma só recebe um id opaco (`atividade_id`). No Instanooria é a atividade que o professor prepara, clonada por turma; em Quem mandou isso? v2.2 é o PACOTE aprovado para a turma (ADR-118), e no Jornal da Escola, o pacote das oito notícias (ADR-117); o unooGPT será refeito com atividades em outra onda, e o UnooTube foi arquivado (ADR-116). **Não é** a missão, nem (por ora) um conceito de plataforma | `apps/api/src/evidencias/`, ADR-112; ADR-49; ADR-118 |
| **rodada** | Cada vez que uma atividade é feita. Reiniciar abre a seguinte, e a anterior fica. O resultado da atividade é a MELHOR rodada POR HABILIDADE; equipe que muda recalcula só a rodada em andamento. Quem conta os reinícios é a missão (em Quem mandou isso?, o "Zerar Turma para Nova Aplicação") | `apps/api/src/evidencias/regras.ts`, ADR-112 |
| **ficha pedagógica / régua** | O que uma missão MEDE: as habilidades da BNCC (o código exato), os marcadores de cada uma (uma ação ou uma pergunta de múltipla escolha) e o nível de cada alternativa — o gabarito, que nunca sai do servidor. Versionada, no código da api e não no manifesto. Missão sem ficha não tem evidência; hoje a exp05ef1b, a exp07ef1b e a exp04ef1b têm (ADR-118, ADR-115, ADR-117) | `apps/api/src/evidencias/fichas/`, ADR-112 |
| **disponibilidade** | *Este recurso existe NESTA REDE?* **Ausência de linha = LIGADO** — é mecanismo de exceção. É pré-condição da liberação, nunca o contrário | `disponibilidades`, ADR-87 |
| **clone / disfarce** | A superfície que imita um app real (Instanooria, o ChatGPT da exp02em1b, o mensageiro da exp06ef2b). Dentro dela a fidelidade é ao app imitado, não à marca Unooria | `packages/ui/AGENTS.md` |
| **revelação** | O momento em que a experiência deixa de fingir ser o app e volta a ser a plataforma. É **a revelação** que marca a fronteira entre as duas famílias do DS, não o arquivo | ADR-72 |
| **perfil portátil** | O que outra instalação afirmou sobre a criança, importado como documento assinado. **Nunca se mistura** com o dado produzido aqui | `perfis_portateis` |

## As peças

| Termo | O que é | Fonte |
|---|---|---|
| **hub** | O Next.js que autentica, lista e embeda. Assina os tokens de experiência e serve o JWKS | `apps/hub/AGENTS.md` |
| **api** | O NestJS. Guarda gabarito, correção, pontuação e toda chamada de IA | `apps/api/AGENTS.md` |
| **bridge** | O contrato `postMessage` entre hub e experiência. `targetOrigin` explícito, nunca `*` | `apps/experiencias/AGENTS.md` |
| **seção do DS** | Uma das seis famílias do `@unooria/design-system`: `unooria` para a plataforma, uma por clone. **Não se cruzam** — com UMA exceção: numa tela da Unooria, a peça que imita outra plataforma (o post e a mensagem da gaveta do Jornal da Escola) usa a seção dela | `docs/regras/design-system.md`, ADR-117 |
| **compensação** | Um ajuste local e **marcado** que existe porque o DS ainda não cobre algo — medida, espaçamento, grade. Nunca um componente | `AGENTS.md` da raiz |
| **quota** | O teto diário de tokens de IA, por usuário **e por perfil**. `temSaldo` antes, `consumir` depois | regra 5 |
| **fatia** | O recorte **vertical** de uma frente paralela: módulo da api + rota do hub + experiência. É barreira, não conselho — o `pre-commit` recusa fora dela | ADR-61/71 |

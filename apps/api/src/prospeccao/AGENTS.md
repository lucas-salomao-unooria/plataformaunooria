# apps/api/src/prospeccao — o cadastro de interesse do site (ADR-107)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## É o único módulo que escreve sem token, e o único sem tenancy

Os dois fatos andam juntos e vêm da mesma origem: **quem escreve aqui é um
visitante do site público**, meses antes de existir contrato. Não há escola para
isolar, não há pessoa para identificar e não há sessão para exigir.

| | `prospeccao/publico/cadastros` | `prospeccao/cadastros/*` |
|---|---|---|
| guard | **nenhum**, por desenho | `OidcGuard` + `@Roles("admin")` |
| quem chama | o formulário de `/` (via `/api/cadastro-de-interesse` do hub) | `/unooria/prospeccao` (via BFF) |
| defesa | Zod + cota por IP + campo-armadilha + dedupe | o papel (ADR-88) |

**Dois controllers, não um com métodos de guarda diferente.** Um `@UseGuards`
esquecido num método some na revisão; um arquivo inteiro sem guard é uma decisão
que se lê no topo. E prefixos diferentes deixam o BFF do hub liberar a leitura
sem liberar a escrita — é o que a allowlist dele faz hoje.

## A exceção à regra inviolável nº 1, escrita

`prospeccao_leads` **não tem `escola_id` e não tem RLS**, e é a única tabela de
dados do repositório nessa situação (`ia_quotas` e `disponibilidades` também não
têm, mas são configuração, não dado de pessoa). Consequência prática: **as
queries deste módulo rodam fora de `comTenancy`** — de propósito, e só aqui.

O porquê inteiro está na migration `20260916120000_prospeccao_de_interesse`,
com as três decisões que ela carrega: a base legal (consentimento, LGPD art. 7º,
I — ao contrário do dado de estudante), o `GRANT` com `DELETE` (para atender o
pedido de eliminação do titular, art. 18, VI) e a ausência de `UPDATE` (cadastro
não se edita).

## O que a rota pública NUNCA conta a quem chama

Três respostas são deliberadamente iguais — `201 { recebido: true }`:

1. gravou;
2. o e-mail já tinha se cadastrado na última hora (dedupe);
3. o campo-armadilha veio preenchido (robô).

Dizer "este e-mail já está cadastrado" transformaria a rota num verificador de
quem procurou a Unooria, e recusar a armadilha com erro ensinaria o robô a
tentar de novo sem o campo. **Quem quer saber o que aconteceu olha o log**
(`prospeccao-cadastro-recebido`, `prospeccao-duplicata`, `prospeccao-armadilha`),
e nenhuma dessas linhas carrega nome, e-mail ou IP.

## O aceite é a FRASE, não um booleano

`consentimento_texto` guarda a sentença que a pessoa marcou no site
(`TEXTO_DO_CONSENTIMENTO`, em `contrato-de-rotas.ts`). Um booleano prova que
alguém clicou; ele não prova **a que** se consentiu, que é o que a LGPD cobra
(art. 8º, §2º). Quando o texto do site mudar, a constante muda com ele — e as
linhas antigas continuam dizendo o que valia no dia em que foram escritas.

**Mudou a frase no site? Mude a constante no mesmo commit.** Os dois lugares são
`components/site/site-entre-redes.tsx` (o rótulo da caixa) e este módulo. Sem
isso o banco registra um aceite que ninguém deu.

## A cota é por IP, e o IP não é guardado

`CADASTROS_POR_IP_POR_HORA = 5` e `CADASTROS_GLOBAIS_POR_HORA = 200`. O IP chega
pelo `x-forwarded-for` que a rota do hub repassa — **e sem esse repasse a defesa
some**: todos os visitantes viram um cliente só, o primeiro robô gasta a cota de
todo mundo e o formulário passa a recusar gente de verdade, com a tela pedindo
para tentar mais tarde. O IP serve de chave e não é gravado em lugar nenhum.

Aqui a chave é o IP e não o usuário — o oposto do que `comum/rate-limit.ts`
recomenda, e pela razão que o próprio arquivo dá: não existe usuário a quem
cobrar. O caveat de contagem por instância vale, e é aceitável: o teto existe
contra enxurrada, não contra fraude.

# Rastreador de issues: Notion (Team Tasks)

As issues deste repo **não** vivem nas Issues do GitHub: vivem no board
**Team Tasks → database `Tasks`** do Notion, e é de lá que as skills de
engenharia leem e para lá que escrevem. Todo acesso é pelo MCP do Notion.

| Coordenada | Valor |
|---|---|
| Data source | `collection://2f706e40-9c3d-8182-bc1f-000bea7c7b8d` |
| Página pai | `2f806e409c3d80568fb7f85ae4d7f039` |
| `Responsável` padrão | `3b5d872b-594c-814d-9361-0002bf1faa38` (Lucas Salomão) |

**O recorte deste repo é `Segmento = "Entre Redes"`.** O board é compartilhado
com outros sete segmentos (Projeto Tocantins, LMS, Research…) que não são esta
plataforma. Toda listagem filtra por esse segmento — sem o filtro, a triagem
puxa card de outro projeto e o agente trabalha no produto errado.

## Operações

- **Criar um card**: `notion-create-pages` com `parent` no data source acima.
- **Ler um card**: `notion-fetch` na URL da página. Comentários por
  `notion-get-comments`.
- **Listar**: `notion-query-data-sources` sobre o data source, sempre com
  `Segmento = 'Entre Redes'` no `WHERE`, mais o filtro de `Triagem` ou `Status`
  que a tarefa pedir.
- **Comentar**: `notion-create-comment` na URL da página.
- **Aplicar / remover rótulo de triagem**: `notion-update-page`, escrevendo a
  propriedade `Triagem` (ver `triage-labels.md`).
- **Fechar**: `notion-update-page` com `Status = 'Concluída'` e `Data` = o dia
  da conclusão. `Arquivada` é o descarte, não a conclusão.

## As propriedades que um card sempre leva

Card criado por agente nasce com: `Segmento` = `Entre Redes`, `Time`
(`Dev`/`Design`/`Produto`), `Ambiente` (`Plataforma`/`Esteira`/`Missões`),
`Status`, `Prioridade`, `Responsável`. `Ano` e `Bimestre` **só** quando o card é
de uma missão específica. Título com prefixo em colchete: `[Melhoria]`,
`[Plataforma]`, `[Entrega]`.

## O corpo é escrito para quem NÃO lê código

Gestor e pedagogo leem estes cards. A estrutura esperada é *O que acontecia /
Por que acontecia / O que mudou / Como foi verificado / Atenção ao usar*, e o
texto traduz tudo: "90 registros de alteração" e não "commits", "mudança de
estrutura do banco" e não "migração", "lista de origens permitidas" e não
"CORS". Quando a proposta do card **não** foi seguida, o porquê vai num bloco de
destaque.

Isto vale inclusive para o que as skills chamariam de descrição técnica: um
card com stack trace no corpo é um card que o time de produto não consegue
priorizar.

## Quando uma skill diz "publique no rastreador de issues"

Criar um card no `Tasks` com as propriedades acima.

## Quando uma skill diz "busque o ticket relevante"

`notion-fetch` na URL do card. Quando só há o título, `notion-search` ou
`notion-query-data-sources` filtrando por `Segmento = 'Entre Redes'`.

## PRs como superfície de pedido

**PRs como superfície de pedido: não.** _(A `/triage` lê este flag. Este é um
repo privado de uma pessoa; não há PR externo pedindo funcionalidade.)_

## Wayfinding

Usado pela `/wayfinder`. O board **não tem** sub-itens nem dependências
nativas, então as duas relações são escritas no corpo — e é por isso que elas
quebram em silêncio se alguém editar o card à mão:

- **Mapa**: um card com `[Mapa]` no título, guardando Notas / Decisões até
  aqui / Névoa no corpo.
- **Ticket filho**: um card com `Parte de: <url do mapa>` na primeira linha do
  corpo, e uma entrada na lista de tarefas do corpo do mapa. O tipo
  (`research` / `prototype` / `grilling` / `task`) vai no prefixo do título.
- **Bloqueio**: linha `Bloqueado por: <url>, <url>` no topo do corpo do filho.
  Desbloqueado quando todo bloqueador está `Concluída` ou `Arquivada`.
- **Fronteira**: os filhos do mapa que não estão concluídos, sem bloqueador
  aberto e sem `Responsável`; vence o primeiro na ordem do mapa.
- **Reivindicar**: `notion-update-page` pondo o `Responsável`.
- **Resolver**: comentário com a resposta, `Status = 'Concluída'`, e o ponteiro
  de contexto anexado às Decisões até aqui do mapa.

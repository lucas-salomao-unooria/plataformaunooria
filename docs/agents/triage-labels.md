# Rótulos de triagem

As skills falam em cinco papéis canônicos de triagem. Este arquivo mapeia cada
papel para o valor real usado no rastreador deste repo.

O rastreador é o Notion (`docs/agents/issue-tracker.md`), e os cinco papéis
moram numa propriedade **`Triagem`** do data source `Tasks` — multi-select, uma
opção por papel, com o nome canônico preservado.

| Papel em mattpocock/skills | Valor no nosso rastreador | Significado |
|---|---|---|
| `needs-triage` | `Triagem = needs-triage` | Ainda não foi avaliado |
| `needs-info` | `Triagem = needs-info` | Esperando informação de quem reportou |
| `ready-for-agent` | `Triagem = ready-for-agent` | Especificado por inteiro, pronto para um agente rodar sozinho |
| `ready-for-human` | `Triagem = ready-for-human` | Precisa de implementação humana |
| `wontfix` | `Triagem = wontfix` | Não será feito |

## `Triagem` não é `Status`

São dois eixos, e confundi-los é o erro caro aqui. `Status` é o fluxo do card
(`Não iniciada`, `Produto`, `Design`, `Tecnologia`, `Em validação`,
`Aguardando`, `Impedido`, `Concluída`, `Arquivada`) e é o que o time de produto
lê no board. `Triagem` responde outra pergunta — *este card está pronto para um
agente pegar?* — e é o que a `/triage` escreve e a `/implement` consulta.

Um card pode estar `Status = Não iniciada` e `Triagem = ready-for-agent`: é
exatamente o card que a fila de trabalho AFK procura. E `Triagem = wontfix`
**não** fecha o card: quem fecha é o `Status`.

## Por que os valores ficaram em inglês

Pela mesma razão da ADR-91: identificador não é texto de interface. Estes cinco
valores são a chave que as skills procuram, não rótulo que professor ou gestor
lê. O que essas pessoas leem no board é o `Status`, que está em pt-BR.

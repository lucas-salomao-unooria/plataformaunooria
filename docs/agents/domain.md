# Documentação de domínio

Como as skills de engenharia devem consumir a documentação deste repo antes de
explorar o código.

**Este repo não usa o layout padrão das skills** (`CONTEXT.md` por contexto +
`docs/adr/`). Os dois papéis já estavam ocupados quando as skills chegaram, e
duplicá-los criaria a terceira cópia que ninguém atualiza junto. O mapeamento é
este:

| O que a skill procura | Onde está aqui |
|---|---|
| Glossário de domínio | `CONTEXT.md` na raiz |
| `CONTEXT-MAP.md` (mapa dos contextos) | `AGENTS.md` da raiz — a tabela de pastas no topo |
| `CONTEXT.md` de um contexto | o `AGENTS.md` da pasta correspondente (`apps/api/`, `apps/hub/`, `apps/experiencias/<exp>/`, `packages/<pacote>/`) |
| `docs/adr/` | `documentacao-latex/secoes/18-adr.tex` — as ADRs completas, numeradas, com alternativas descartadas e gatilho de reavaliação |
| ADR em resumo, para leitura rápida | `docs/DECISOES.md` (**resumo**, nunca a fonte) |

## Antes de explorar, leia

1. **`CONTEXT.md`** na raiz: o glossário. É curto de propósito.
2. **`AGENTS.md` da raiz**: as regras invioláveis de tenancy, segurança e
   disponibilidade, e a tabela que diz qual pasta tem doutrina própria.
3. **O `AGENTS.md` da pasta que você vai tocar.** Ele carrega sozinho quando a
   sessão mexe na pasta, mas quando você está só lendo de fora, leia à mão.
4. **As ADRs que tocam a área**, em `documentacao-latex/secoes/18-adr.tex`. É um
   arquivo grande: procure pelo assunto (`grep -n`), não leia inteiro.

Se algum desses não existir para a área em questão, **siga em frente em
silêncio**. Não sinalize a ausência nem proponha criar o arquivo na frente.

## Use o vocabulário do glossário

Quando sua saída nomeia um conceito de domínio — título de card, proposta de
refatoração, hipótese, nome de teste —, use o termo como o `CONTEXT.md` o
define. Não derive para sinônimo.

Aqui isso tem uma consequência extra que o layout padrão não tem: **os nomes de
domínio são em pt-BR** (`estudante`, `escola`, `turma`, `liberação`,
`disponibilidade`) e os termos técnicos em inglês (`provider`, `guard`,
`batch`). Um teste chamado `should allow student` num repo que escreve
`estudanteDaEscola` é ruído, não neutralidade.

Se o conceito que você precisa ainda não está no glossário, isso é sinal: ou
você está inventando linguagem que o projeto não usa (reconsidere), ou há uma
lacuna real (anote para a `/domain-modeling`).

## Decisão nova não vira arquivo em `docs/adr/`

A Definition of Done do `AGENTS.md` da raiz exige **ADR numerada no LaTeX**, no
mesmo commit, com o `main.pdf` regerado. Uma skill que queira registrar uma
decisão escreve em `documentacao-latex/secoes/18-adr.tex`.

Duas armadilhas ao fazer isso, e as duas já custaram tempo:

- **O número da ADR colide entre branches paralelas.** Conferir `origin/dev` não
  basta; confira também as branches de trabalho abertas, e na HORA de escrever
  o número.
- **`main.pdf` sempre conflita no merge.** Ele se regera, não se escolhe lado.

## Sinalize conflito com ADR

Se sua saída contradiz uma ADR existente, diga isso explicitamente em vez de
atropelar em silêncio:

> _Contradiz a ADR-72 (fronteira do disfarce da exp06ef2b), mas vale reabrir
> porque…_

# scripts — utilitários de linha de comando do monorepo

Complementa o `AGENTS.md` da raiz. A suíte de ponta a ponta tem doutrina própria
em `e2e/AGENTS.md`.

| Script | O que faz | Cuidado |
|---|---|---|
| `create-experiencia.mjs` | `pnpm new:exp exp-NN-slug` — copia o `_template` e ajusta nomes | a experiência nasce copiada, não linkada |
| `gerar-endpoints-tex.mjs` | escreve `apendices/c-endpoints.tex` **a partir** de `docs/openapi.json` | o apêndice é gerado: editar o `.tex` na mão é perder o texto no próximo commit |
| `gerar-chave-token.mjs` | par RS256 com que o hub assina os tokens de experiência | a chave privada nunca entra no repo |
| `importar-referencias-plano.mjs` | carrega as referências curriculares da exp-90 | exige `PLANOS_IMPORT_TOKEN` |
| `probe-pointerlock.mjs` | mede pointer lock dentro do iframe com sandbox | sustenta `permissoes` do manifesto e o `allow-pointer-lock` do `ExpFrame` |
| `configurar-github-ci.sh` | preenche `vars`/secret do environment do GitHub a partir do `terraform output` | escreve em ambiente REAL (dev/hml/prd) — confira o workspace |

**Script que gera arquivo versionado declara isso no topo do arquivo gerado.**
A regra é a mesma do apêndice C: no minuto em que alguém edita à mão a saída de
um gerador, existem duas fontes de verdade e a próxima execução apaga a errada
— que pode ser a boa.

**Nenhum script aqui cria recurso GCP.** Infra é Terraform, em outro repo
(`docs/INFRA.md`). `configurar-github-ci.sh` é a exceção que confirma: ele LÊ o
output do Terraform e escreve no GitHub, não na nuvem.

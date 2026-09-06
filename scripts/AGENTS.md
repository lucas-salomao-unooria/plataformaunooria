# scripts — utilitários de linha de comando do monorepo

Complementa o `AGENTS.md` da raiz. A suíte de ponta a ponta tem doutrina própria
em `e2e/AGENTS.md`.

| Script | O que faz | Cuidado |
|---|---|---|
| `worktree.mjs` | `pnpm worktree criar/listar/remover` — a frente paralela inteira: worktree sobre `origin/dev`, `.env` copiados, `pnpm install` + `prisma generate`, porta de Vite reservada, a fatia gravada em `<git-dir>/fatia` e o briefing impresso | o `origin/dev` está ESCRITO: partir da branch padrão de um clone antigo abre a frente sobre PRODUÇÃO em silêncio. Valida o nome da branch com o mesmo padrão do `.githooks/pre-push`, e a fatia que ele grava é o que o `.githooks/pre-commit` passa a exigir |
| `create-experiencia.mjs` | `pnpm new:exp exp-NN-slug` — copia o `_template` e ajusta nomes | a experiência nasce copiada, não linkada |
| `gerar-endpoints-tex.mjs` | escreve `apendices/c-endpoints.tex` **a partir** de `docs/openapi.json` | o apêndice é gerado: editar o `.tex` na mão é perder o texto no próximo commit |
| `gerar-chave-token.mjs` | par RS256 com que o hub assina os tokens de experiência | a chave privada nunca entra no repo |
| `extrair-bncc.mjs` | extrai as habilidades da BNCC dos PDFs oficiais para `apps/api/src/curriculo/dados/*.ts` | os `.ts` são GERADOS: editar à mão é perder o texto na próxima execução. Lê por COORDENADAS (`pdftotext -bbox-layout`), porque as tabelas da Base são um spread de duas páginas e no texto corrido a ligação habilidade↔objeto de conhecimento se perde. Exige `pdftotext` e `pdfinfo` (poppler). Fonte é o PDF **homologado**: a página do Ensino Médio do MEC serve um rascunho cujos textos divergem |
| `importar-referencias-plano.mjs` | carrega as referências curriculares da exp-90 | exige `PLANOS_IMPORT_TOKEN` |
| `probe-pointerlock.mjs` | mede pointer lock dentro do iframe com sandbox | sustenta `permissoes` do manifesto e o `allow-pointer-lock` do `ExpFrame` |
| `configurar-github-ci.sh` | preenche `vars`/secret do environment do GitHub a partir do `terraform output` | escreve em ambiente REAL (dev/hml/prd) — confira o workspace. `EXP_MAPAS_BUCKET` só entra depois do apply que criou o bucket |
| `mapear-stack.mjs` | traduz a stack minificada de um erro de cliente com o sourcemap da versão exata, lido do bucket PRIVADO `EXP_MAPAS_BUCKET` | só lê; sem dependência (`SourceMap` do Node). A stack vem de `jsonPayload.stack_trace` da linha `codigo=erro-cliente` |

**Script que gera arquivo versionado declara isso no topo do arquivo gerado.**
A regra é a mesma do apêndice C: no minuto em que alguém edita à mão a saída de
um gerador, existem duas fontes de verdade e a próxima execução apaga a errada
— que pode ser a boa.

**Nenhum script aqui cria recurso GCP.** Infra é Terraform, em outro repo
(`docs/INFRA.md`). `configurar-github-ci.sh` é a exceção que confirma: ele LÊ o
output do Terraform e escreve no GitHub, não na nuvem.

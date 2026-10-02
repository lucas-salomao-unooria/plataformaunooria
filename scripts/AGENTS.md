# scripts — utilitários de linha de comando do monorepo

Complementa o `AGENTS.md` da raiz. A suíte de ponta a ponta tem doutrina própria
em `e2e/AGENTS.md`.

| Script | O que faz | Cuidado |
|---|---|---|
| `worktree.mjs` | `pnpm worktree criar/listar/remover/limpar` — a frente de trabalho inteira, e TODA tarefa começa por uma (ADR-101): worktree sobre `origin/dev-local`, `.env` copiados, `pnpm install` + `prisma generate`, porta de Vite reservada, a fatia gravada em `<git-dir>/fatia` e o briefing impresso | o `origin/dev-local` está ESCRITO: partir da branch padrão abre a frente sobre `dev` ou sobre PRODUÇÃO em silêncio, e `dev-local` costuma estar À FRENTE de `dev`. `--fatia` é obrigatória — ele recusa sem ela. Valida o nome da branch com o mesmo padrão do `.githooks/pre-push`, e a fatia que grava é o que o `.githooks/pre-commit` passa a exigir |
| `.githooks/post-merge` | no `git pull` de `dev-local` que traz o merge do PR: atualiza o grafo do graphify em segundo plano (ADR-125) e poda as frentes já mergeadas (ADR-103) | é o ÚNICO gatilho automático que existe: o merge acontece no GitHub e nenhum outro hook local dispara nele. Ele **nunca derruba o pull** — erro vira aviso, exit 0. O grafo é `graphify update .` (AST, sem custo) com trava de 15 min em `graphify-out/.atualizando` e log em `graphify-out/atualizacao.log`; não roda se não houver `graph.json` (quem nunca gerou não ganha um à força). Escapes: `PULAR_GRAFO=1`, `PULAR_PODA_DE_WORKTREE=1` |
| `create-experiencia.mjs` | `pnpm new:exp exp06ef3b` (ou `app-NN-nome`) — copia o `_template`, ajusta nomes e deriva `series`/`unidade` do código (ADR-110) | a experiência nasce copiada, não linkada |
| `gerar-endpoints-tex.mjs` | escreve `apendices/c-endpoints.tex` **a partir** de `docs/openapi.json` | o apêndice é gerado: editar o `.tex` na mão é perder o texto no próximo commit |
| `gerar-chave-token.mjs` | par RS256 com que o hub assina os tokens de experiência | a chave privada nunca entra no repo |
| `gerar-base-da-ajuda.mjs` | a base de conhecimento do atendente da Ajuda (ADR-132) → `apps/api/src/ajuda/base/base-da-ajuda.gerada.ts`, a partir do mapa de produto (só PRONTO/PARCIAL), dos guias da aula e dos manifestos. `--verificar` sai 1 se o gerado estiver velho | o `.ts` é GERADO. Falha se a saída tiver vocabulário técnico (`TERMOS_SENSIVEIS`) — a correção é no mapa de produto. Carrega os guias `.ts` pelo strip de tipos do Node 24 (eles só têm `import type`) |
| `liveavatar-configurar.mjs` | cria, uma vez por contrato/ambiente, o segredo, a configuração de LLM (apontando para `<api pública>/ajuda/llm`) e o contexto do LiveAvatar, e imprime os ids das envs | exige `LIVEAVATAR_API_KEY` e `AJUDA_LLM_SEGREDO` exportadas; idempotente pelo nome (`unooria-ajuda-<ambiente>`). Escreve na conta REAL do vendor |
| `extrair-bncc.mjs` | extrai as habilidades da BNCC dos PDFs oficiais para `apps/api/src/curriculo/dados/*.ts` | os `.ts` são GERADOS: editar à mão é perder o texto na próxima execução. Lê por COORDENADAS (`pdftotext -bbox-layout`), porque as tabelas da Base são um spread de duas páginas e no texto corrido a ligação habilidade↔objeto de conhecimento se perde. Exige `pdftotext` e `pdfinfo` (poppler). Fonte é o PDF **homologado**: a página do Ensino Médio do MEC serve um rascunho cujos textos divergem |
| `importar-referencias-plano.mjs` | carrega as referências curriculares da app-90 | exige `PLANOS_IMPORT_TOKEN` |
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

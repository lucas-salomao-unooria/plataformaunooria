# Comandos

Os comandos da plataforma, com o que já custou tempo anotado ao lado.
Complementa o `AGENTS.md` da raiz, que vence em conflito.

## Comandos

```bash
pnpm dev                                  # tudo em watch, no host
pnpm docker:dev                           # a stack INTEIRA em container (pg/api/hub/3 exps) com o
                                          # código do host por bind mount: salvar arquivo recompila
                                          # lá dentro, sem build. Mesmas portas do `pnpm dev`, então
                                          # é um OU outro. `:logs` `:deps` `:down` completam.
pnpm turbo build --filter=@edu/exp-01     # builda 1 experiência (+ deps)
pnpm turbo build --filter='...[HEAD^]'    # só o que mudou (CI usa isso)
pnpm new:exp exp-12-fracoes               # scaffolda experiência do _template
pnpm worktree criar fix/<slug> --fatia api/<mod>,hub/<rota>,exp/<id>
                                          # COMEÇA TODA TAREFA (ADR-61/71/100): worktree sobre
                                          # origin/dev-local, .env copiados, install + prisma
                                          # generate, porta de Vite 52xx reservada e o briefing da
                                          # fatia impresso para colar no agente. `listar` mostra as
                                          # frentes e suas portas; `remover <slug>` fecha.
                                          # --fatia é OBRIGATÓRIA: o pre-commit recusa commit fora
                                          # dela. É VERTICAL (módulo da api + rota do hub +
                                          # experiência) — dois agentes na mesma camada brigam. Quem
                                          # mexe em ferramenta declara a pasta: scripts,.githooks.
                                          # No fim: gh pr create --base dev-local. NUNCA --base dev:
                                          # dev-local é o ambiente Docker onde VOCÊ testa antes.
                                          # Antes de abrir, REALINHA origin/dev-local com origin/dev se a
                                          # promoção a deixou atrás (fast-forward, ADR-104) — e RECUSA se
                                          # as duas divergiram de verdade.
pnpm worktree limpar [--seco]             # PODA as frentes já mergeadas em origin/dev-local: worktree,
                                          # branch local e remota (ADR-103). Roda SOZINHO no `git pull`
                                          # de dev-local (.githooks/post-merge) e antes de cada `criar`.
                                          # Pula worktree sujo, a frente em uso e branch sem commit
                                          # próprio — `--seco` mostra o que sairia sem remover nada.
pnpm --filter @edu/api test
pnpm --filter @edu/api exec prisma migrate reset --force --skip-seed  # ZERA o banco (dev)
npx ts-node --transpile-only apps/api/scripts/gerar-openapi.ts   # docs/openapi.json (roda da pasta apps/api)
node scripts/gerar-endpoints-tex.mjs                            # apendices/c-endpoints.tex A PARTIR do openapi.json
# /docs já vem LIGADO no docker:dev — http://localhost:3001/docs (docs / unooria-docs-local).
# No host (`pnpm dev`) as envs não existem e a rota some; exporte-as para ligar:
SWAGGER_USUARIO=docs SWAGGER_SENHA=unooria-docs-local pnpm dev
SEED_SENHA=<senha> pnpm --filter @edu/api seed  # a senha das contas de demo vem do AMBIENTE (ADR-47).
                                          # Nos dois compose ela já vem (unooria123); no host, no
                                          # apps/api/.env (o Prisma carrega) ou na linha de comando.
                                          # Ausente, o seed FALHA — não inventa senha.
SEED_MINIMO=1 pnpm --filter @edu/api seed   # só escola + um gestor + um admin: o "zero absoluto"
# OS LOGINS SAEM DO SEED, que os ESCREVE em credenciais-demo.csv na raiz — arquivo
# GITIGNORADO: ele nasce ao semear, e sem semear não existe. É a
# fonte, e é de lá que a suíte e2e lê (`scripts/e2e/lib/credenciais.mjs`). Nomes de
# gente, não `prof.demo`: o seed procura por MATRÍCULA (quem leciona no 8A), e
# `semear-demo.ts` diz por quê — login fixo reacopla o script a um nome inventado.
# Não escreva conta de demo em documentação: ela envelhece e manda a pessoa tentar
# um login que não existe. Aponte para o CSV.
pnpm --filter @edu/exp-90-plano-de-aula dev   # :5175 → hub /professor/plano-de-aula (qualquer prof.* do CSV; seed:demo importa referências demo)
pnpm --filter @edu/exp-91-bem-estar dev       # :5176 → hub /professor/bem-estar (qualquer prof.* do CSV; AI_PROVIDER=mock usa os textos fixos)
pnpm --filter @edu/exp-02-unootube dev    # :5174 (exp-01 usa :5173 — portas em apps/hub/lib/experiencias-dev.ts)
pnpm exec playwright install chromium     # PRE-REQUISITO da suíte e2e, uma vez por maquina.
                                          # `npx playwright install` NAO serve: o npx resolve o
                                          # playwright mais NOVO do npm e baixa a build de navegador
                                          # DELE, enquanto o repo fixa 1.62.1 (build 1234). O erro sai
                                          # como "Executable doesn't exist at .../chromium_headless_
                                          # shell-1234" com o cache CHEIO de navegador, e o banner
                                          # manda rodar justamente o npx que causou o descasamento.
node scripts/e2e/rodar.mjs                # A SUÍTE INTEIRA de ponta a ponta, na ordem canônica
                                          # (publico → estudante → professor → gestor_escola →
                                          # gestor_contrato → admin). O `admin` vem por ÚLTIMO porque o
                                          # painel dele mexe no interruptor que TODAS as outras leem.
                                          # A ordem não é alfabética: o estudante PRODUZ o estado
                                          # (runs, partidas, sessões) que as telas do professor leem, e a
                                          # administração vem por último porque importa gente e troca senha.
node scripts/e2e/rodar.mjs professor      # só um papel
node scripts/e2e/rodar.mjs estudante/02   # só uma suíte
node scripts/e2e/rodar.mjs --deck         # tudo + deck (.pptx) + vídeos (.webm), gerados dos manifestos
node scripts/e2e/publico/01-landing.mjs   # cada suíte também roda sozinha, direto
# Evidências em testes/<papel>/<suíte>/: os prints, `passos.json` (o manifesto) e `relatorio.md`.
# A pasta é APAGADA no começo de cada execução — print de duas corridas na mesma pasta conta
# uma história que nunca aconteceu. `testes/` inteira está no .gitignore.
# O deck e os vídeos NASCEM do `passos.json`: a descrição de cada tela é escrita no
# `registrar()` da suíte, ao lado do passo que a fotografa. Antes havia um roteiro de 66 KB
# mantido à mão, e ele divergiu — descrevia telas que o script já não tirava.
node scripts/e2e/ferramentas/gerar-deck.mjs             # só o deck
node scripts/e2e/ferramentas/gerar-videos.mjs           # só os vídeos (um por papel; o estudante, um por missão)
node scripts/e2e/ferramentas/gerar-videos.mjs --amostra # um quadro em JPEG, p/ conferir o layout sem codificar
EXP_MAPAS_BUCKET=<bucket> node scripts/mapear-stack.mjs exp-02-unootube 1.2.3 < stack.txt  # stack de erro de cliente -> fonte:linha (mapas no bucket PRIVADO)
pnpm --filter @edu/exp-70-vila-do-lume dev    # :5177 → hub /exp/exp-70-vila-do-lume (transversal, sem série)
pnpm --filter @edu/exp-03-unoogpt dev         # :5178 → hub /exp/exp-03-unoogpt (2ª série EM, unidade 1)
pnpm --filter @edu/exp-92-plano-de-ensino dev # :5180 → hub /professor/plano-de-ensino. Planejamento dirigido
                                          # pela BNCC: plano anual + plano de aulas, 1ºEF ao 3ºEM, todos os
                                          # componentes. Toda porta de exp entra no CORS_ORIGINS da api —
                                          # sem a :5180 o boot morre com "Failed to fetch".
node scripts/extrair-bncc.mjs             # BNCC dos PDFs oficiais → apps/api/src/curriculo/dados/*.ts
                                          # (GERADOS). Exige poppler (pdftotext/pdfinfo) e os PDFs em
                                          # documentos-fonte/bncc/ — que NÃO são versionados (>2MB).
pnpm --filter @edu/exp-07-o-eco-no-grupo dev   # :5179 → hub /exp/exp-07-o-eco-no-grupo (7º ano, unidade 1;
                                          # o professor prepara a mídia no painel antes da aula)
pnpm --filter @edu/exp-04-o-que-a-foto-conta dev  # :5183 → hub /exp/exp-04-o-que-a-foto-conta (1º ano,
                                          # unidade 1). 5183 e não 5182: a 5182 é da exp-08. A missão é
                                          # SÍNCRONA: a Roda congela os tablets e o professor libera pelo
                                          # painel (polling 3s, ADR-94).
pnpm --filter @edu/exp-06-rastro-boato dev    # :5181 → hub /exp/exp-06-rastro-boato (6º ano, unidade 2).
                                          # 5181 e não 5180: a 5180 é da exp-92. Zero IA, e sem áudio
                                          # gravado — a transcrição está sempre na tela.
pnpm --filter @edu/exp-08-manifesto-ia dev    # :5182 → hub /exp/exp-08-manifesto-ia (8º ano, unidade 4).
                                          # Clone do ChatGPT. IA SÓ no preparo do professor, antes da
                                          # aula: o motor de sala é determinístico e gasta zero token.
                                          # NÃO existe cláusula certa — as 4 são válidas, e o painel
                                          # mostra contagem, nunca acerto. O congelamento da turma para
                                          # o debate é POLLING de 5s (ADR-93), não WebSocket.
pnpm up -r @unooria/design-system --latest     # sobe o DS em ui/hub/exps de uma vez (caret ^0.1.x NÃO sobe minor)
npm view @unooria/design-system version        # qual é a última publicada
cd ../storybook-unooria && npm run storybook   # :6007, o catálogo das 6 seções (repo do DS, fora deste monorepo)
cd documentacao-latex && ./compilar.sh         # documentação técnica -> main.pdf (~612p). Atualizar SEMPRE
```

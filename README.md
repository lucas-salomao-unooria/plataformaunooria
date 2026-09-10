# Plataforma Unooria (monorepo)

Hub educacional + 48 experiências imersivas da **Plataforma Unooria**.
B2G governo (stack por contrato, isolamento lógico por escola). Veja `AGENTS.md`
para convenções e `docs/` para arquitetura e decisões.

## Nomes
Produto: **Plataforma Unooria**. Pacote raiz: `plataforma-unooria`.
O scope interno dos workspaces segue `@edu/*` (`@edu/sdk`, `@edu/hub`, `@edu/api`,
`@edu/exp-*`) — alias curto, não marca. Para alinhar ao produto:
`grep -rl "@edu/" --include="*.json" --include="*.ts" --include="*.tsx" . | xargs sed -i '' 's|@edu/|@unooria/|g'`

## Interface: tudo vem do `@unooria/design-system`

Hub e experiências não têm componente de UI próprio — a interface é o pacote npm
`@unooria/design-system`, **sempre na última versão publicada**, consumido pela
ponte `packages/ui` (`@edu/ui/ds` para a plataforma, `@edu/ui/ds-insta` e irmãos
para o clone de cada experiência). O pacote tem uma seção por marca: `unooria`
(plataforma) + `instanooria`, `unitube`, `chatgpt`, `whatsappmobile`, `tiktooria`
(os clones que as experiências imitam), cada uma com seus tokens e seu CSS.

```bash
pnpm up -r @unooria/design-system --latest   # ^0.1.x não sobe minor: atualizar de propósito
```

Componente que falta nasce no repo do DS (`storybook-unooria`, Storybook `:6007`)
e chega aqui por versão nova. Detalhes e as regras de não-misturar-seções em
`AGENTS.md`.

## Subir tudo em containers (o caminho mais curto)
```bash
node scripts/gerar-chave-token.mjs --env   # chave RS256 que o hub usa p/ assinar
docker compose up -d --build               # pg :5432 + api :3001 + hub :3000
```
Migrations e seed rodam sozinhos no primeiro `up` (serviço `migrate`). Depois
disso a plataforma já está usável em <http://localhost:3000>.

A **experiência** não entra no compose: em produção ela é bundle estático num
bucket, não um serviço. Para vê-la embedada, rode-a à parte:
```bash
pnpm install && pnpm --filter @edu/exp-01-instanooria dev   # :5173
pnpm --filter @edu/exp-02-unootube dev                       # :5174 (4º ano; vídeos em public/videos, ver README da exp)
```

## Subir para desenvolver (hot reload)

Duas formas. **Nas duas o código do host é a fonte** — as imagens de produção
(`docker compose up -d --build`) é que congelam um build e ficam velhas.

### Tudo em container, sincronizado com o editor (recomendado)
```bash
pnpm docker:dev          # pg + api + hub + as 3 experiências, cada um com o seu watcher
pnpm docker:dev:logs     # acompanha a recompilação
pnpm docker:dev:down     # desce
```
O repo entra nos containers por bind mount: salvar um arquivo no editor
recompila lá dentro (api ~1s, hub e Vite na hora), sem `build` e sem `up` de
novo. Migrations e seed rodam sozinhos a cada `up` (serviço `migrate`), e o
`node_modules` do host fica intocado — o do container é volume próprio, porque
binário de macOS não roda no Linux da imagem.

Depois de mexer em dependência (`package.json`/lockfile): `pnpm docker:dev:deps`.
Se algum dia salvar um arquivo e nada recompilar: `DEV_POLLING=1 pnpm docker:dev`.

As portas são as mesmas de sempre (hub :3000, api :3001, exps :5173/:5174/:5175),
então **não dá para rodar isto e `pnpm dev` ao mesmo tempo** — escolha um.

### Só o banco em container, o resto no host
```bash
pnpm install
docker compose up -d pg                # só o banco
cp .env.example apps/api/.env && cp .env.example apps/hub/.env.local   # e edite
pnpm --filter @edu/api migrate:dev     # migrations (Prisma + RLS)
pnpm --filter @edu/api seed            # a rede de demonstração — e ESCREVE credenciais-demo.csv
pnpm --filter @edu/api seed:demo       # atividade DEMO com 92 posts, sem Gemini
pnpm dev                               # hub :3000, api :3001, exp :5173
```

## O IdP (WSO2) é um compose à parte
Ele é um gerenciador central de identidade, compartilhado entre contratos e com
ciclo de vida próprio — por isso não sobe junto com a plataforma:
```bash
docker compose -f wso2/docker-compose.yml up -d       # IS :9443, pg dele :5433
docker compose -f wso2/docker-compose.yml watch       # e este fica olhando conf/ e bootstrap/
```
O `watch` é o equivalente do hot reload para ele: `conf/` já entra por volume
(nada de rebuild), e mudar o `deployment.toml` REINICIA o servidor — que é o
ciclo mais curto possível num servidor Java, porque o entrypoint só copia o
config-volume para o server home no boot (~2min). Mudar `bootstrap/` re-executa
o bootstrap (idempotente); só mudar o `Dockerfile` (driver JDBC) refaz imagem.
Vem configurado (tenant `dev-local`, app OIDC do hub, usuários de teste);
`docker compose -f wso2/docker-compose.yml logs bootstrap` imprime as envs OIDC
prontas para colar. Detalhes: `wso2/README.md`. Enquanto ele não é o emissor, o
próprio hub assina os tokens e publica o JWKS em `/.well-known/jwks.json`.

Senha de todos os usuários de demonstração: a de `SEED_SENHA` — nos dois
compose ela já vem (`unooria123`); no host, ponha-a no `apps/api/.env` ou
prefixe o comando. O seed NÃO tem senha padrão no fonte: ele roda contra o
`DATABASE_URL` que estiver no ambiente, e uma constante ali criaria contas com
senha conhecida se ele fosse apontado por engano ao banco de um contrato.
**Os logins ficam em `credenciais-demo.csv`, na raiz — escrito pelo próprio seed.**
Ele é gitignorado: nasce ao semear, e num clone novo só existe depois disso.
São nomes de gente (`prof.marcelo.lopes` é o do 8º A), todos com a senha do
`SEED_SENHA`. Não há `prof.demo` nem `gestor.demo`: o seed procura por matrícula,
não por login fixo. Escolha uma linha do CSV pelo papel — `prof.*` → `/professor`,
`gestor.*` → `/admin/usuarios` (importação CSV), qualquer estudante → `/estudante`.
Teste de experiência local: `/dev-embed`. Sanidade do DS: `/ds-smoke` (dev only).

## Testes de ponta a ponta
```bash
node scripts/e2e/rodar.mjs                # tudo: 21 suítes, cinco papéis
node scripts/e2e/rodar.mjs professor      # só um papel
node scripts/e2e/rodar.mjs --deck         # tudo + o deck (.pptx) e os vídeos (.webm)
```
Typecheck não pega ícone virando texto, link sublinhado nem iframe vazio — a
suíte pega, porque abre o produto num navegador de verdade com uma pessoa de
verdade logada. Precisa da plataforma no ar (containers ou `pnpm dev`) e do
Chromium do Playwright (`pnpm exec playwright install chromium`).

As evidências ficam em `testes/<papel>/<suíte>/`: os prints, um `passos.json`
com a descrição de cada tela e um `relatorio.md`. O deck e os vídeos são
gerados desse manifesto — a descrição mora no teste que tira o print, não num
roteiro paralelo.

## Branches
`main` é o tronco — a migração para o monorepo está mergeada nela (histórico
linear, 26 commits). Trabalho novo sai da `main` numa branch própria: **uma por
experiência**, com o nome do slug (`exp-12-fracoes`); o resto usa o prefixo do
tipo do commit (`fix/…`, `chore/…`, `ci/…`). Convenções de commit em `AGENTS.md`.

Build não vai para o git: `dist/`, `.next/`, `.next-prod/`, `.turbo/` e
`*.tsbuildinfo` estão no `.gitignore`. Stage por caminho — um `git add -A`
distraído já colocou 250MB de cache de webpack no histórico uma vez.

## Infra
Terraform vive em repo separado (ver `docs/INFRA.md` para o contrato entre os repos).

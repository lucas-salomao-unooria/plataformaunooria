# Plataforma Unooria (monorepo)

Hub educacional + 48 experiências imersivas da **Plataforma Unooria**.
B2G governo (stack por contrato, isolamento lógico por escola). Veja `CLAUDE.md`
para convenções e `docs/` para arquitetura e decisões.

## Nomes
Produto: **Plataforma Unooria**. Pacote raiz: `plataforma-unooria`.
O scope interno dos workspaces segue `@edu/*` (`@edu/sdk`, `@edu/hub`, `@edu/api`,
`@edu/exp-*`) — alias curto, não marca. Para alinhar ao produto:
`grep -rl "@edu/" --include="*.json" --include="*.ts" --include="*.tsx" . | xargs sed -i '' 's|@edu/|@unooria/|g'`

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
```

## Subir para desenvolver (hot reload)
```bash
pnpm install
docker compose up -d pg                # só o banco
cp .env.example apps/api/.env && cp .env.example apps/hub/.env.local   # e edite
pnpm --filter @edu/api migrate:dev     # migrations (Prisma + RLS)
pnpm --filter @edu/api seed            # escola-demo: prof.demo/gestor.demo/aluno01–40
pnpm --filter @edu/api seed:demo       # atividade DEMO com 92 posts, sem Gemini
pnpm dev                               # hub :3000, api :3001, exp :5173
```

## O IdP (WSO2) é um compose à parte
Ele é um gerenciador central de identidade, compartilhado entre contratos e com
ciclo de vida próprio — por isso não sobe junto com a plataforma:
```bash
docker compose -f wso2/docker-compose.yml up -d    # IS :9443, pg dele :5433
```
Vem configurado (tenant `dev-local`, app OIDC do hub, usuários de teste);
`docker compose -f wso2/docker-compose.yml logs bootstrap` imprime as envs OIDC
prontas para colar. Detalhes: `wso2/README.md`. Enquanto ele não é o emissor, o
próprio hub assina os tokens e publica o JWKS em `/.well-known/jwks.json`.

Senha de todos os usuários de demonstração: `unooria123`.
Login: `gestor.demo` → `/admin/usuarios` (importação CSV); `prof.demo` →
`/professor`; `aluno01` → experiência. Teste de experiência local:
`/dev-embed`. Sanidade do DS: `/ds-smoke` (dev only).

## Smoke visual
```bash
node scripts/walkthrough-aluno.mjs testes/wt-aluno
node scripts/walkthrough-professor.mjs testes/wt-professor
```
Typecheck não pega ícone virando texto, link sublinhado nem iframe vazio —
estes dois pegam. Precisam da plataforma no ar (containers ou `pnpm dev`).

## Infra
Terraform vive em repo separado (ver `docs/INFRA.md` para o contrato entre os repos).

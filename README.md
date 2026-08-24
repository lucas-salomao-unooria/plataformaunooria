# Plataforma Unooria (monorepo)

Hub educacional + 48 experiências imersivas da **Plataforma Unooria**.
B2G governo (stack por contrato, isolamento lógico por escola). Veja `CLAUDE.md`
para convenções e `docs/` para arquitetura e decisões.

## Nomes
Produto: **Plataforma Unooria**. Pacote raiz: `plataforma-unooria`.
O scope interno dos workspaces segue `@edu/*` (`@edu/sdk`, `@edu/hub`, `@edu/api`,
`@edu/exp-*`) — alias curto, não marca. Para alinhar ao produto:
`grep -rl "@edu/" --include="*.json" --include="*.ts" --include="*.tsx" . | xargs sed -i '' 's|@edu/|@unooria/|g'`

## Subir local
```bash
pnpm install
docker compose up -d   # pg da plataforma :5432 + WSO2 IS :9443 (pg dele na :5433)
cp .env.example apps/api/.env && cp .env.example apps/hub/.env.local   # e edite
pnpm --filter @edu/api migrate:dev     # aplica migrations (Prisma + RLS)
pnpm --filter @edu/api seed            # escola-demo: prof.demo/gestor.demo/aluno01–40, senha unooria123
pnpm dev            # hub :3000, api :3001, template exp :5173
```
O compose sobe também o IdP central (WSO2) já configurado — tenant `dev-local`,
app OIDC do hub e usuários de teste; `docker compose logs bootstrap` imprime as
envs OIDC prontas para colar. Detalhes e troubleshooting: `wso2/README.md`.
Quem quiser só o banco: `docker compose up -d pg`.
Login: `gestor.demo`/`unooria123` → `/admin/usuarios` (importação CSV);
`aluno01` → experiência. Teste de experiência local: `/dev-embed`.
Sanidade do DS: `/ds-smoke` (dev only).

## Infra
Terraform vive em repo separado (ver `docs/INFRA.md` para o contrato entre os repos).

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
docker run -d --name pg -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16
cp .env.example apps/api/.env && cp .env.example apps/hub/.env.local
pnpm dev            # hub :3000, api :3001, template exp :5173
```

## Infra
Terraform vive em repo separado (ver `docs/INFRA.md` para o contrato entre os repos).

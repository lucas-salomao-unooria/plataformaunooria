# Imagem da api (NestJS + Prisma). Build a partir da RAIZ do monorepo:
#   docker build -f apps/api/Dockerfile .
#
# O que este arquivo resolve, e que a versão anterior errava:
#   - `corepack enable` sozinho não fixa a versão do pnpm (e pode pedir
#     confirmação interativa): `corepack prepare` trava a do packageManager;
#   - copiar `node_modules` da build para a imagem final QUEBRA os symlinks do
#     pnpm (o store fica em `.pnpm/`): usamos `pnpm deploy`, que materializa
#     uma árvore real de produção;
#   - o Nest emite em `dist/src/main.js` (o tsconfig inclui `src`, `tests` e
#     os seeds), não em `dist/main.js`;
#   - o Prisma Client precisa do engine do Linux (binaryTargets no schema) e
#     do `prisma generate` rodado ANTES do build.

FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# `openssl` é dependência de runtime do engine do Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @edu/api generate
RUN pnpm turbo build --filter=@edu/api

# Árvore de produção sem symlinks, pronta para copiar.
# (na v9 o filtro vem ANTES do subcomando: `pnpm --filter=X deploy <dir>`)
RUN pnpm --filter=@edu/api deploy --prod /deploy

# O `deploy` monta um node_modules NOVO — o Client que o `generate` da build
# escreveu não vem junto. Gerar de novo lá dentro é o que faz o
# `new PrismaClient()` funcionar na imagem final.
RUN cp -r /repo/apps/api/prisma /deploy/prisma \
 && cd /deploy && ./node_modules/.bin/prisma generate

FROM node:24-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
# O schema acompanha a imagem: `prisma migrate deploy` roda no Cloud Run Job a
# partir dela (docs/INFRA.md), e o Client lê o schema no boot.
COPY --from=build /repo/apps/api/prisma ./prisma

# Roda como usuário sem privilégio (a imagem node já traz o usuário `node`).
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/src/main.js"]

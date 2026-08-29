# Imagem da api (NestJS + Prisma). Build a partir da RAIZ do monorepo:
#   docker build -f apps/api/Dockerfile .
#
# O que este arquivo resolve, e que a versão anterior errava:
#   - pnpm pinado pelo npm na versão do packageManager (Node 25+ não traz mais
#     o corepack na imagem oficial — o `corepack enable` morre com 127);
#   - copiar `node_modules` da build para a imagem final QUEBRA os symlinks do
#     pnpm (o store fica em `.pnpm/`): usamos `pnpm deploy`, que materializa
#     uma árvore real de produção;
#   - o Nest emite em `dist/src/main.js` (o tsconfig inclui `src`, `tests` e
#     os seeds), não em `dist/main.js`;
#   - o Prisma Client precisa do engine do Linux (binaryTargets no schema) e
#     do `prisma generate` rodado ANTES do build;
#   - `COPY . .` antes do install invalidava a camada de dependências em TODO
#     commit — o CI refazia o `pnpm install` inteiro mesmo com cache de layers.
#     O `pnpm fetch` só depende do lockfile, então a camada pesada sobrevive a
#     qualquer mudança de código e o install vira resolução offline.

FROM node:26.7.0-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# `openssl` é dependência de runtime do engine do Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Node 25+ NAO traz mais o corepack na imagem oficial (o `corepack enable` morre
# com "command not found"); o pnpm entra pelo npm, pinado na MESMA versao do
# `packageManager` do package.json — divergir aqui e lockfile reescrito.
RUN npm install -g pnpm@9.12.0

WORKDIR /repo
# Camada de dependências: só invalida quando o lockfile muda.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
# Código por cima; o install resolve do store local, sem rede.
COPY . .
RUN pnpm install --frozen-lockfile --offline
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

FROM node:26.7.0-slim
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

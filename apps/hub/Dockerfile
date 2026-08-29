# Imagem do hub (Next.js standalone). Build a partir da RAIZ do monorepo:
#   docker build -f apps/hub/Dockerfile .
#
# O que este arquivo resolve, e que a versão anterior errava:
#   - pnpm pinado pelo npm na versão do packageManager (Node 25+ não traz corepack);
#   - o `standalone` NÃO copia `.next/static` nem `public/` — os dois são
#     copiados à mão, senão a página sobe sem CSS e sem imagem (sintoma
#     clássico: "tela branca / css bugado");
#   - o tracing do standalone precisa do `outputFileTracingRoot` apontando
#     para a raiz do monorepo (configurado no next.config.mjs), senão
#     `@edu/ui` e `@edu/sdk` ficam de fora do bundle;
#   - `COPY . .` antes do install invalidava a camada de dependências em TODO
#     commit — o CI refazia o `pnpm install` inteiro mesmo com cache de layers.
#     O `pnpm fetch` só depende do lockfile, então a camada pesada sobrevive a
#     qualquer mudança de código e o install vira resolução offline.
#
# Envs de build: nenhuma. As `NEXT_PUBLIC_*` que entram no bundle do client
# devem ser passadas com `--build-arg` quando forem específicas do contrato.

FROM node:26.7.0-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
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
RUN pnpm turbo build --filter=@edu/hub

FROM node:26.7.0-slim
ENV NODE_ENV=production
WORKDIR /app

# O standalone traz o server.js e o node_modules mínimo já resolvido.
COPY --from=build /repo/apps/hub/.next/standalone ./
# ...mas não traz estes dois:
COPY --from=build /repo/apps/hub/.next/static ./apps/hub/.next/static
COPY --from=build /repo/apps/hub/public ./apps/hub/public

USER node
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node", "apps/hub/server.js"]

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
# Envs de build: uma. `NEXT_PUBLIC_*` que entra no bundle do CLIENT é
# substituída pelo literal durante o `next build`, então precisa existir AQUI —
# defini-la no Cloud Run depois não muda um bundle já compilado. As demais
# (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CDN_EXP_URL`) só são lidas em código
# server-only, e por isso continuam sendo env de runtime.

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
# Microsoft Clarity (ADR-60). O `deploy.yml` passa o valor de
# `vars.CLARITY_PROJECT_ID` do environment (dev/hml/prd). VAZIO = o hub não
# renderiza a tag e não manda o id às experiências — é o kill-switch, e é o
# default de qualquer build feito sem o argumento.
ARG NEXT_PUBLIC_CLARITY_PROJECT_ID=""
ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=$NEXT_PUBLIC_CLARITY_PROJECT_ID
# A "versão" do hub no Error Reporting dos erros de CLIENTE (o servidor usa
# K_REVISION). É o SHA do commit, inlinado no bundle do client — por isso ARG
# de build, como a do Clarity. Ausente (build local) fica "dev".
ARG NEXT_PUBLIC_HUB_VERSAO="dev"
ENV NEXT_PUBLIC_HUB_VERSAO=$NEXT_PUBLIC_HUB_VERSAO
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

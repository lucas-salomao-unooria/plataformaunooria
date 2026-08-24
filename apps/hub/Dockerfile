FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm turbo build --filter=@edu/hub
FROM node:20-slim
WORKDIR /app
COPY --from=build /repo/apps/hub/.next/standalone ./
COPY --from=build /repo/apps/hub/.next/static ./apps/hub/.next/static
ENV PORT=8080
CMD ["node", "apps/hub/server.js"]

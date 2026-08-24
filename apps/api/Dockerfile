FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm turbo build --filter=@edu/api
FROM node:20-slim
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json .
COPY --from=build /repo/node_modules ./node_modules
ENV PORT=8080
CMD ["node", "dist/main.js"]

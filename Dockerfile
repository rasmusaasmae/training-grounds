# The web app is built with Vite; Bun then runs the server's TypeScript
# directly. The server has no npm dependencies, so the runtime image only
# needs Bun, the server sources and the built `dist/`.

FROM oven/bun:1.4.3-alpine AS build

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun --bun run build

FROM oven/bun:1.4.3-alpine AS runner

WORKDIR /app

COPY --chown=bun:bun server ./server
COPY --chown=bun:bun src/lib ./src/lib
COPY --from=build --chown=bun:bun /app/dist ./dist

ENV NODE_ENV=production \
    PORT=3000

USER bun

EXPOSE 3000

CMD ["bun", "server/main.ts"]

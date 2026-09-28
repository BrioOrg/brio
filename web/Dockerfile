# syntax=docker/dockerfile:1
#
# Web image (ADR 0024). Build from the repository root — it is a pnpm workspace and
# @brio/api-client generates its types from docs/api/openapi.json:
#   docker build -f web/Dockerfile .
#
# The image holds no environment-specific value: the browser calls /api on its own
# origin and the server reads API_INTERNAL_URL / TUTEUR_REQUEST_CAP at runtime.

FROM node:22-alpine AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /src

# Manifests first, so source edits reuse the cached install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY web/package.json web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/content/package.json packages/content/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY docs/api/openapi.json docs/api/
COPY packages packages
COPY web web
RUN pnpm turbo build --filter=@brio/web...

FROM node:22-alpine
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# output: 'standalone' traces from the monorepo root, so the server lands in web/.
COPY --from=build --chown=node:node /src/web/.next/standalone ./
COPY --from=build --chown=node:node /src/web/.next/static ./web/.next/static
COPY --from=build --chown=node:node /src/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]

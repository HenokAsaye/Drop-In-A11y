# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/demo apps/demo
COPY packages packages
ARG VITE_SAVANNA_API_BASE=http://localhost:8000
ENV VITE_SAVANNA_API_BASE=$VITE_SAVANNA_API_BASE \
    CI=true
RUN pnpm install --frozen-lockfile && pnpm build

FROM nginx:1.29-alpine
COPY infra/demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/demo/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]

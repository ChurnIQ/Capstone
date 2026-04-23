# syntax=docker/dockerfile:1

# ── Backend — Node.js only ────────────────────────────────────────────────────
ARG NODE_VERSION=22.22.0
FROM node:${NODE_VERSION}-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Install dependencies (cached layer)
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY . .
RUN chmod -R 777 uploads

# Run as non-root
USER node

EXPOSE 3000
CMD ["node", "app.js"]

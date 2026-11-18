# SeatRush API image. Three stages, so the final image has only what runs.

# 1. deps: install every package exactly as package-lock.json says.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. build: compile TypeScript to dist/, then drop the dev-only packages.
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# 3. runtime: a small image with dist/ and production packages only.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Never run as root inside the container.
USER node
EXPOSE 3000
# Migrations run when the app starts (migrationsRun), then the demo event is seeded.
CMD ["node", "dist/main.js"]

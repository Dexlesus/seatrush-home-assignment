# SeatRush web image.

# 1. build: install exactly what package-lock.json says, then build static files.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. runtime: nginx serves the files and forwards /api to the API container.
#    The "unprivileged" nginx image runs as a non-root user (port 8080).
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

# Image chạy frontend JobPortal (Next.js) ở chế độ production. Build qua 3 giai đoạn (multi-stage):
# chỉ giai đoạn cuối thành image, nên image không chứa source, devDependencies hay cache build.

# 1. Cài thư viện
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build
FROM node:22-alpine AS build
WORKDIR /app
# rewrites() trong next.config.ts được tính LÚC BUILD, nên địa chỉ backend phải có ngay ở đây.
# "backend" là tên service trong docker-compose.yml.
ARG API_URL=http://backend:5000
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Chạy: chỉ lấy bản standalone (server.js + thư viện cần thiết) và file tĩnh
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

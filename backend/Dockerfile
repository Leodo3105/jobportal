# Image chạy backend JobPortal (Express) ở chế độ production.
FROM node:22-alpine

WORKDIR /app

# Cài thư viện trước, copy code sau: sửa code thì Docker dùng lại lớp (layer) node_modules đã cache.
# --omit=dev: không cài devDependencies (nodemon).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts

# Thư mục upload (gắn volume trong docker-compose). Giao cho user "node" có sẵn trong image
# để chạy server không cần quyền root.
RUN mkdir -p uploads && chown -R node:node uploads
USER node

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "src/server.js"]

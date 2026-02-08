# Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY server ./server
RUN cd server && npm ci --omit=dev
EXPOSE 3001
CMD ["node", "server/index.js"]

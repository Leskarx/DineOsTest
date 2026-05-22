# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build

# ─── Development Stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

# ─── Production Stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Production deps only
COPY package*.json ./
RUN npm install --only=production --ignore-scripts && npm cache clean --force

# Compiled output
COPY --from=builder /app/dist ./dist

# Local uploads directory (mounted as volume in docker-compose)
RUN mkdir -p uploads && chown appuser:appgroup uploads

USER appuser
EXPOSE 4000

# /health is unversioned — no /api/v1 prefix
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main"]

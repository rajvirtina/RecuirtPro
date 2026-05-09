# ═══════════════════════════════════════════════════
# RecuirtPro Backend — Production Dockerfile
# ═══════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ─── Production Stage ─────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache tini
WORKDIR /app

# Non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Create directories
RUN mkdir -p uploads/resumes logs && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

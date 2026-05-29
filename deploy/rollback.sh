#!/usr/bin/env bash
# rollback.sh — Roll back RecuirtPro to the previous release tag.
#
# Usage:
#   ./deploy/rollback.sh              — rolls back to the previous git tag
#   ./deploy/rollback.sh v1.2.3       — rolls back to a specific tag
#   ./deploy/rollback.sh --list       — lists the last 10 tags
#
# Requirements: docker, docker-compose, git
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# ── Helpers ────────────────────────────────────────────────────────────────────
log()  { echo "[rollback] $*"; }
die()  { echo "[rollback] ERROR: $*" >&2; exit 1; }

# ── List mode ──────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--list" ]]; then
  log "Last 10 release tags:"
  git tag --sort=-creatordate | head -10
  exit 0
fi

# ── Determine target tag ───────────────────────────────────────────────────────
CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || git describe --tags HEAD 2>/dev/null || echo "HEAD")

if [[ -n "${1:-}" ]]; then
  TARGET_TAG="$1"
else
  # Auto-detect: the tag immediately before the current one
  TARGET_TAG=$(git tag --sort=-creatordate | grep -v "^${CURRENT_TAG}$" | head -1)
fi

[[ -z "$TARGET_TAG" ]] && die "No previous tag found. Cannot roll back."

log "Current: ${CURRENT_TAG}"
log "Rolling back to: ${TARGET_TAG}"
read -rp "[rollback] Proceed? (y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { log "Aborted."; exit 0; }

# ── Snapshot current state ─────────────────────────────────────────────────────
log "Snapshotting current git HEAD..."
SNAPSHOT_BRANCH="rollback-snapshot-$(date +%Y%m%d-%H%M%S)"
git branch "$SNAPSHOT_BRANCH"
log "Snapshot saved to branch: ${SNAPSHOT_BRANCH}"

# ── Checkout target ────────────────────────────────────────────────────────────
log "Checking out ${TARGET_TAG}..."
git checkout "$TARGET_TAG"

# ── Rebuild + restart ─────────────────────────────────────────────────────────
log "Rebuilding images at ${TARGET_TAG}..."
docker-compose -f "$COMPOSE_FILE" build backend frontend

log "Restarting services..."
docker-compose -f "$COMPOSE_FILE" up -d backend frontend

# ── Health check ──────────────────────────────────────────────────────────────
log "Waiting for backend health check..."
for i in $(seq 1 12); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' recruitpro-backend 2>/dev/null || echo "missing")
  if [[ "$STATUS" == "healthy" ]]; then
    log "Backend is healthy. Rollback complete."
    log "Run 'git branch -D ${SNAPSHOT_BRANCH}' once verified to clean up the snapshot."
    exit 0
  fi
  log "Health status: ${STATUS} (attempt ${i}/12)..."
  sleep 10
done

die "Backend did not become healthy after rollback. Snapshot preserved at branch: ${SNAPSHOT_BRANCH}"

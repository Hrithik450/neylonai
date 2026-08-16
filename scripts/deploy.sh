#!/usr/bin/env bash
# =============================================================================
# Neylon AI — Deploy script
# Called by GitHub Actions CI/CD (and can be run manually on the server).
#
# Usage (on the server):
#   cd /srv/neylonai/app && bash scripts/deploy.sh
# =============================================================================
set -euo pipefail

APP_DIR="/srv/neylonai/app"

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[deploy]${NC} $*"; }

cd "$APP_DIR"

info "Pulling latest code..."
git fetch origin main
git reset --hard origin/main

info "Building images and starting services..."
docker compose up --build -d --remove-orphans

info "Waiting for Postgres to be healthy..."
docker compose exec -T postgres bash -c \
  'until pg_isready -U neylonai -d neylonai; do sleep 1; done'

info "Running database schema push..."
COMPOSE_PROFILES=migration docker compose run --rm migrator

info "Pruning unused Docker images..."
docker image prune -f

info "All done — $(docker compose ps --services | tr '\n' ' ') are running."

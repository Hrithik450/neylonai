#!/usr/bin/env bash
# =============================================================================
# Neylon AI — One-time server bootstrap
# Tested on: Ubuntu 22.04 / 24.04 (EC2 or any VPS)
#
# Usage:
#   bash scripts/setup-server.sh
#
# What it does:
#   1. Installs Docker + Docker Compose plugin
#   2. Installs Nginx + Certbot
#   3. Clones the repo to /srv/neylonai/app
#   4. Wires up the Nginx config
#   5. Issues an SSL certificate via Let's Encrypt
#   6. Generates a deploy SSH key for GitHub Actions
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/Hrithik450/neylonai.git"
APP_DIR="/srv/neylonai/app"
DOMAIN="neylonai.mhritihk.com"
EMAIL="${CERTBOT_EMAIL:-}"          # set CERTBOT_EMAIL env var before running

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "Run as root:  sudo bash scripts/setup-server.sh"

# ── 1. System packages ────────────────────────────────────────────────────────
info "Updating apt..."
apt-get update -qq
apt-get install -yq git curl ca-certificates gnupg lsb-release ufw

# ── 2. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  info "Docker already installed — skipping."
fi

# ── 3. Nginx + Certbot ────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  info "Installing Nginx..."
  apt-get install -yq nginx
  systemctl enable --now nginx
else
  info "Nginx already installed — skipping."
fi

if ! command -v certbot &>/dev/null; then
  info "Installing Certbot..."
  apt-get install -yq certbot python3-certbot-nginx
else
  info "Certbot already installed — skipping."
fi

# ── 4. Firewall ───────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 5. Clone repo ─────────────────────────────────────────────────────────────
mkdir -p /srv/neylonai
if [ ! -d "$APP_DIR/.git" ]; then
  info "Cloning repository to $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
else
  info "Repository already cloned — skipping."
fi

# ── 6. Create .env.local if missing ──────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.local" ]; then
  warn ".env.local not found — copying from .env.example."
  warn ">>> EDIT $APP_DIR/.env.local with your real secrets before deploying! <<<"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env.local"
fi

# ── 7. Wire Nginx config ──────────────────────────────────────────────────────
info "Installing Nginx config..."

# Serve HTTP only first so Certbot can do the ACME challenge
cat > /etc/nginx/sites-available/neylonai <<'NGINX_HTTP'
server {
    listen 80;
    listen [::]:80;
    server_name neylonai.mhritihk.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
NGINX_HTTP

mkdir -p /var/www/certbot
ln -sf /etc/nginx/sites-available/neylonai /etc/nginx/sites-enabled/neylonai
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 8. Issue SSL certificate ──────────────────────────────────────────────────
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  if [ -z "$EMAIL" ]; then
    warn "CERTBOT_EMAIL not set — using --register-unsafely-without-email"
    CERT_EMAIL_FLAG="--register-unsafely-without-email"
  else
    CERT_EMAIL_FLAG="--email $EMAIL"
  fi
  info "Issuing SSL certificate for $DOMAIN..."
  certbot certonly --nginx \
    $CERT_EMAIL_FLAG \
    --agree-tos \
    --non-interactive \
    -d "$DOMAIN"
else
  info "SSL certificate already exists — skipping certbot."
fi

# Install full HTTPS nginx config
info "Installing HTTPS Nginx config..."
cp "$APP_DIR/nginx/neylonai.conf" /etc/nginx/sites-available/neylonai
nginx -t && systemctl reload nginx

# ── 9. Auto-renew cron ────────────────────────────────────────────────────────
info "Setting up certbot auto-renewal cron..."
(crontab -l 2>/dev/null | grep -v certbot; \
 echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -

# ── 10. Generate deploy SSH key for GitHub Actions ────────────────────────────
DEPLOY_KEY_PATH="/root/.ssh/neylonai_deploy"
if [ ! -f "$DEPLOY_KEY_PATH" ]; then
  info "Generating deploy SSH key..."
  ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$DEPLOY_KEY_PATH" -N ""
  cat "$DEPLOY_KEY_PATH.pub" >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
fi

echo ""
info "========================================================"
info " Server setup complete!"
info "========================================================"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Edit your secrets:  nano $APP_DIR/.env.local"
echo ""
echo "  2. Add these 3 GitHub Actions secrets to your repo:"
echo "     (Settings → Secrets and variables → Actions)"
echo ""
echo -e "     ${GREEN}SSH_HOST${NC}         = $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo -e "     ${GREEN}SSH_USER${NC}         = root  (or your sudo user)"
echo -e "     ${GREEN}SSH_PRIVATE_KEY${NC}  = (contents below)"
echo ""
echo "── PRIVATE KEY (paste this into GitHub secret SSH_PRIVATE_KEY) ──"
cat "$DEPLOY_KEY_PATH"
echo "─────────────────────────────────────────────────────────────────"
echo ""
echo "  3. Push to main — CI/CD will build, migrate, and deploy automatically."
echo ""
echo "  4. Point your DNS A record:"
echo -e "     ${GREEN}neylonai.mhritihk.com${NC}  →  $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""

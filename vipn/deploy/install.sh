#!/usr/bin/env bash
set -euo pipefail

UP="${UP:-/tmp/vipn-upload}"
PUBLIC_URL="${PUBLIC_URL:-https://kadancevdmitrij15.clodocd.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@vipn.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

install -d -m 0755 /opt/vipn
install -m 0755 "$UP/vipn-panel" /opt/vipn/vipn-panel
install -m 0755 "$UP/vipn-agent" /opt/vipn/vipn-agent

install -d -m 0755 /var/www/vipn-landing
if [[ -f "$UP/index.html" ]]; then
  install -m 0644 "$UP/index.html" /var/www/vipn-landing/index.html
fi

install -d -m 0755 /var/www/vipn-downloads /var/lib/vipn/releases
install -m 0755 "$UP/vipn-sync-releases.py" /usr/local/bin/vipn-sync-releases
install -m 0644 "$UP/vipn-releases.service" /etc/systemd/system/vipn-releases.service
install -m 0644 "$UP/vipn-releases.timer" /etc/systemd/system/vipn-releases.timer

install -m 0644 "$UP/vipn-panel.service" /etc/systemd/system/vipn-panel.service
install -m 0644 "$UP/vipn-agent.service" /etc/systemd/system/vipn-agent.service

if [[ ! -f /etc/vipn/panel.env ]]; then
  umask 077
  cat > /etc/vipn/panel.env <<EOF
VIPN_BIND=127.0.0.1:8080
VIPN_DB=/var/lib/vipn/vipn.db
VIPN_PUBLIC_URL=$PUBLIC_URL
VIPN_ADMIN_EMAIL=$ADMIN_EMAIL
VIPN_ADMIN_PASSWORD=$ADMIN_PASSWORD
RUST_LOG=info
EOF
fi
chmod 600 /etc/vipn/panel.env

systemctl daemon-reload
systemctl enable --now vipn-panel
systemctl restart vipn-panel
systemctl enable --now vipn-releases.timer

if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y caddy >/dev/null
fi

install -m 0644 "$UP/Caddyfile" /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true

# shellcheck disable=SC1091
source /etc/vipn/panel.env
umask 077
cat > /root/vipn-credentials.txt <<EOF
URL: $VIPN_PUBLIC_URL
Email: $VIPN_ADMIN_EMAIL
Password: $VIPN_ADMIN_PASSWORD
EOF
chmod 600 /root/vipn-credentials.txt

echo "panel and caddy configured for $PUBLIC_URL"

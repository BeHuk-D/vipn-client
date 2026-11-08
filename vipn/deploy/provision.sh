#!/usr/bin/env bash
set -euo pipefail

IFACE="${IFACE:-awg1}"
PORT="${PORT:-51820}"
SRC=/etc/amnezia/amneziawg

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

install -d -m 0755 /opt/vipn
install -d -m 0700 /etc/vipn
install -d -m 0700 /var/lib/vipn

if ! id vipn >/dev/null 2>&1; then
  useradd --system --home /var/lib/vipn --shell /usr/sbin/nologin vipn
fi
chown vipn:vipn /var/lib/vipn

if [[ ! -f "$SRC/$IFACE.key" ]]; then
  umask 077
  awg genkey > "$SRC/$IFACE.key"
  awg pubkey < "$SRC/$IFACE.key" > "$SRC/$IFACE.pub"
  chmod 600 "$SRC/$IFACE.key"
  chmod 644 "$SRC/$IFACE.pub"
fi

if [[ ! -f "$SRC/$IFACE.conf" ]]; then
  umask 077
  cat > "$SRC/$IFACE.conf" <<EOF
[Interface]
PrivateKey = $(cat "$SRC/$IFACE.key")
Address = 10.66.66.1/24
ListenPort = $PORT
MTU = 1280
Jc = 4
Jmin = 40
Jmax = 70
S1 = 30
S2 = 40
S3 = 50
S4 = 60
H1 = 1
H2 = 2
H3 = 3
H4 = 4
PostUp = iptables -I FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ens3 -j MASQUERADE; iptables -t mangle -A FORWARD -o %i -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1240; iptables -t mangle -A FORWARD -i %i -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1240
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ens3 -j MASQUERADE; iptables -t mangle -D FORWARD -o %i -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1240; iptables -t mangle -D FORWARD -i %i -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1240
EOF
fi
chmod 600 "$SRC/$IFACE.conf"

sysctl -q -w net.ipv4.ip_forward=1

systemctl enable --now "awg-quick@$IFACE"

ufw allow "$PORT/udp" comment 'ViPN AmneziaWG' >/dev/null || true
ufw allow 443/tcp comment 'ViPN panel' >/dev/null || true

echo "interface: $IFACE (udp/$PORT)"
echo "server public key: $(cat "$SRC/$IFACE.pub")"
awg show "$IFACE"

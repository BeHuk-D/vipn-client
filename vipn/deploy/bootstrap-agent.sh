#!/usr/bin/env bash
set -euo pipefail

BASE=http://127.0.0.1:8080
ENV_FILE=/etc/vipn/panel.env
AGENT_ENV=/etc/vipn/agent.env

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for _ in $(seq 1 40); do
  curl -fsS -o /dev/null "$BASE/" && break
  sleep 0.25
done

JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

python3 - "$BASE" "$VIPN_ADMIN_EMAIL" "$VIPN_ADMIN_PASSWORD" "$JAR" <<'PY'
import http.cookiejar, json, sys, urllib.request

base, email, password, jar_path = sys.argv[1:5]
jar = http.cookiejar.MozillaCookieJar(jar_path)
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
request = urllib.request.Request(
    base + "/api/login",
    data=json.dumps({"email": email, "password": password}).encode(),
    headers={"content-type": "application/json"},
    method="POST",
)
opener.open(request, timeout=10).read()
jar.save(ignore_discard=True, ignore_expires=True)
PY

if [[ -f "$AGENT_ENV" ]]; then
  echo "agent env already present"
else
  SERVERS=$(curl -fsS -b "$JAR" "$BASE/api/servers")
  ID=$(printf '%s' "$SERVERS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')

  if [[ -z "$ID" ]]; then
    PUB=$(cat /etc/amnezia/amneziawg/awg1.pub)
    HOST=${VIPN_PUBLIC_URL#http://}
    HOST=${HOST#https://}
    RESP=$(curl -fsS -b "$JAR" -X POST "$BASE/api/servers" -H 'content-type: application/json' -d "{
      \"name\":\"Server-1\",
      \"host\":\"$HOST\",
      \"endpoint_port\":51820,
      \"interface\":\"awg1\",
      \"listen_port\":51820,
      \"server_public_key\":\"$PUB\",
      \"network_cidr\":\"10.66.66.0/24\",
      \"dns\":\"1.1.1.1\",
      \"awg_params\":{\"Jc\":4,\"Jmin\":40,\"Jmax\":70,\"S1\":30,\"S2\":40,\"S3\":50,\"S4\":60,\"H1\":1,\"H2\":2,\"H3\":3,\"H4\":4}
    }")
    TOKEN=$(printf '%s' "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["agent_token"])')
  else
    RESP=$(curl -fsS -b "$JAR" -X POST "$BASE/api/servers/$ID/agent-token")
    TOKEN=$(printf '%s' "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["agent_token"])')
  fi

  umask 077
  cat > "$AGENT_ENV" <<EOF
VIPN_PANEL_URL=$BASE
VIPN_AGENT_TOKEN=$TOKEN
VIPN_INTERFACE=awg1
RUST_LOG=info
EOF
  chmod 600 "$AGENT_ENV"
fi

systemctl daemon-reload
systemctl enable --now vipn-agent
systemctl restart vipn-agent

sleep 2
systemctl is-active vipn-panel vipn-agent caddy

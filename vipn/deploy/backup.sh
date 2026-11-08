#!/usr/bin/env bash
set -euo pipefail

DB=/var/lib/vipn/vipn.db
DEST=/var/backups/vipn

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required" >&2
  exit 1
fi

install -d -m 0700 "$DEST"
sqlite3 "$DB" ".backup '$DEST/vipn-$(date +%F).db'"
find "$DEST" -name 'vipn-*.db' -mtime +14 -delete

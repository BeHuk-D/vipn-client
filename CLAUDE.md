# ViPN — инфраструктура

Коммерческий VPN на AmneziaWG. Репозитории живут рядом, в `~/Documents/Projects/`:
`vipn-backend` (Rust/axum: panel + agent + shared), `vipn-web` (React/Vite +
Cloudflare Worker), `vipn-client` (Qt/QML), `vipn-infra` (bash, systemd, конфиги).
Этот каталог (`ViPN`) — корневой; здесь лежат локальные `.env` и документация.

## Хосты

| Роль | IP | ОС | Что запущено |
| --- | --- | --- | --- |
| Панель | `31.59.125.46` | Ubuntu 22.04, 1 vCPU, 1 ГБ | `vipn-panel`, `cloudflared`, `vipn-ip-tls`, `wg0` (10.99.0.1/24), `vipn-backup.timer`, `vipn-releases.timer` |
| NL-1 | `80.74.28.114` | Ubuntu 24.04 | `awg1` (VPN, UDP 51820), `wg0` (10.99.0.2), `vipn-agent` |
| Server-1 (DE) | `217.60.94.172` | Ubuntu 22.04 | `awg1` (VPN, UDP 51820), `wg0` (10.99.0.3), `vipn-agent` |

PANEL:
- `vipn-panel` слушает `127.0.0.1:8080` (public), `127.0.0.1:8081` (admin),
  `10.99.0.1:8082` (agent). Админка наружу не публикуется.
- `cloudflared` (именованный туннель `vipn`, id `f6056b42-347d-4017-9473-2c97417e699c`)
  проксирует `api.vipn-connect.space` → `127.0.0.1:8080`, остальное — 404.
- `vipn-ip-tls` (Caddy) слушает `31.59.125.46:443` с самоподписанным сертификатом
  и проксирует только `/s/*`, `/r/*`, `/health` в `127.0.0.1:8080`. Отпечаток
  сертификата зашит в клиент. Это канал подписки без домена и Cloudflare.
- ufw: SSH; `443/tcp` публично; `51820/udp` только с IP узлов; `8082/tcp` только
  из `10.99.0.0/24`.
- БД: `/var/lib/vipn/vipn.db` (владелец `vipn:vipn`, 600), env: `/etc/vipn/panel.env`.

УЗЛЫ:
- `awg1` — единственный входящий трафик клиентов, UDP 51820; `wg0` — служебная сеть
  до панели (клиентский конфиг, endpoint панели `31.59.125.46:51820`,
  PersistentKeepalive 25). Агент ходит на `http://10.99.0.1:8082`.
- Веб-порты на узлах закрыты, Caddy удалён (конфиги в `/root/caddy-retired-20261108`).
- env агента: `/etc/vipn/agent.env`.

DNS и Cloudflare: зона `vipn-connect.space`. Apex, `www` и `mirror` — Worker
`vipn-web` (статика + прокси `/api/account/*`, `/s/*`, `/r/*`, `/downloads/*`).
`api.` — туннель. Записи `admin.` и `agents.` удалены.
Релизы клиента зеркалируются на панель (`/var/www/vipn-downloads`,
`vipn-releases.timer`) и раздаются через `/downloads/*`; GitHub — только
источник синхронизации.

## Доступ

- SSH: `ssh root@<ip>`, пароли — в локальном `.env` (gitignored, не коммитить).
- Админка: `ssh -N -L 8081:127.0.0.1:8081 root@31.59.125.46`, затем
  `http://localhost:8081`.
- Агенты в панель — только через WireGuard, не через публичный интернет.

## Секреты

- `/etc/vipn/panel.env`, `/etc/vipn/agent.env` — 600 root.
- `/etc/vipn/ingress.env` — только `VIPN_INGRESS_SECRET` для Caddy, 600 root;
  создаётся из `panel.env`.
- `/etc/caddy/ip-tls/{cert,key}.pem` — TLS IP-канала; ключ `0640 root:caddy`.
  Замена сертификата ломает пиннинг в установленных клиентах.
- `/etc/vipn/backup-age.key` — приватный ключ расшифровки бэкапов; офсайт-копия
  `~/.config/vipn/backup-age.key` на рабочей машине. Потеря ключа = потеря бэкапов.
- `/root/.ssh/vipn-backup` — ключ панели для копирования бэкапов на узлы.
- `/etc/vipn/cloudflared/*.json` — credentials туннеля.
- Никогда не коммитить `.env`, `credentials.env`, `vipn-keystore/`, `*.jks`.

## Бэкапы

`vipn-backup.timer` (03:30 UTC, Persistent) → `/usr/local/bin/vipn-backup`:
снимок SQLite + `PRAGMA integrity_check`, архив с `vipn.db`, `panel.env`,
`wg0.conf`, конфигом и credentials туннеля, сертификатом и ключом IP-канала,
шифрование `age` публичным ключом,
копии на панель и на каждый узел из `/etc/vipn/backup-targets` по SSH через
`wg0`, проверка sha256, ретеншен 14 дней. Восстановление описано в
`vipn-infra/README.md`.

## Подписка и данные

- `/r/<public_id>` → 307 на `/s/<token>`; обязателен заголовок `x-vipn-hwid`
  ровно из 64 hex-символов.
- Канал без домена: `https://31.59.125.46/s/<token>` с пиннингом сертификата в
  клиенте; клиент перебирает домен → `workers.dev` → IP.
- Оба узла используют подсеть `10.66.66.0/24`, адреса выдаются по узлам
  (`?all=1` создаёт устройство на каждом). При росте — переход на /16.
- Метрики агент шлёт каждые 10 секунд; панель пишет `metrics` и обновляет
  `devices` (rx/tx, rate, last_handshake). Сырые метрики чистятся по
  `VIPN_METRICS_RETENTION_DAYS` (30 дней), закрытые алерты — 90 дней.

## Правила работы

- Не добавлять комментарии в код без просьбы.
- Не добавлять `Co-Authored-By` в коммиты и PR.
- После задачи — коммит, без push.
- Планы для чтения — в `~/Documents/MD-Storage/ViPN/`.
- Продовые действия (рестарты, удаление данных, firewall) — сначала проверить
  состояние, потом менять; секреты не печатать в чат.

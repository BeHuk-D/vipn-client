# ViPN

VPN по подписке: пользователь вставляет ссылку `https://<panel>/s/<token>`, клиент
скачивает конфиг AmneziaWG и подключается. Проект вырос из форка
[AmneziaVPN](https://github.com/amnezia-vpn/amnezia-client) (GPL-3.0) и состоит из
четырёх частей.

## Структура

| Каталог | Что это | Стек |
|---|---|---|
| `vipn-client/` | Настольный и мобильный клиент | Qt 6.10.1, C++17/20, QML |
| `vipn/` | Панель управления и агент узлов | Rust, axum, SQLite |
| `vipn-landing/` | Лендинг и страница загрузок | React 19, Vite, TypeScript |
| `vipn-keystore/` | Ключ подписи Android и пароли к нему | локально, не коммитится |

```
клиент ──GET /s/{token}──> панель ──x-agent-token──> агент ──> AmneziaWG на узле
   ^                          |
   └── подписка, серверы, ping, split tunneling
```

Подробности по клиенту — в [`vipn-client/README.md`](vipn-client/README.md).

## Клиент

Требования: CMake 3.25+, Qt 6.10.1, Python 3, Conan 2.28, компилятор C++17/20.

```bash
git submodule update --init --recursive
python3 -m venv .venv
.venv/bin/pip install "conan==2.28.0"

cd vipn-client
QT_INSTALL_DIR="$HOME/Qt" deploy/build.sh --generator Ninja --installer all
```

Artifacts: `deploy/build/ViPN_<version>_linux_x64.run`, на Windows —
`deploy/build/ViPN_<version>_windows_x64.exe` и `.msi`. Версия задаётся через
`AMNEZIAVPN_VERSION`.

## Бэкенд

```bash
cd vipn
cargo build --release          # target/release/vipn-panel, target/release/vipn-agent
cargo test
```

Панель читает конфигурацию из переменных окружения (образец —
`vipn/deploy/panel.env.example`), хранит состояние в SQLite и отдаёт админку и
личный кабинет с того же порта. Агент разворачивается на узле и синхронизирует
AmneziaWG-интерфейс с панелью.

Установка и обслуживание сервера — `vipn/deploy/`: `install.sh`, `provision.sh`,
`bootstrap-agent.sh`, `backup.sh`, systemd-юниты, `Caddyfile` и скрипт зеркалирования
релизов.

## Лендинг

```bash
cd vipn-landing
npm ci
npm run dev      # разработка
npm run build    # tsc --noEmit && vite build -> dist/
```

## CI и релизы

- `.github/workflows/tests.yml` — сборка клиента с тестами и `ctest` на каждый push и PR.
- `.github/workflows/release.yml` — по тегу `v*` собирает Linux, Windows и Android,
  подписывает APK и публикует GitHub Release.
- `.github/workflows/windows.yml` — ручная сборка под Windows.

Клиент проверяет обновления по GitHub Releases и открывает страницу релизов —
скачивание и установка остаются за пользователем.

## Секреты

`vipn-keystore/`, `*.jks`, `*.keystore`, `credentials.env`, `node_modules/`,
`target/`, `dist/` и каталоги сборки исключены через `.gitignore`. Ключ подписи и
пароли держите только локально или в GitHub Actions secrets
(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_ALIAS`, `ANDROID_KEYSTORE_STORE_PASS`,
`ANDROID_KEYSTORE_KEY_PASS`).

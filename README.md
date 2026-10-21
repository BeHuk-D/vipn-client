# ViPN

Клиент коммерческого VPN по подписке. Форк [Amnezia](https://github.com/amnezia-vpn/amnezia-client)
(GPL-3.0), переделанный под один сценарий: пользователь вставляет ссылку подписки и подключается.

## Возможности

- Подключение по ссылке вида `https://<panel>/s/<token>` — клиент сам скачивает
  конфиг AmneziaWG, показывает сервер, страну и срок действия.
- Обновление подписки из приложения и замена ссылки.
- Проверка задержки до сервера (через туннель — до шлюза, без VPN — до панели).
- Монохромный интерфейс, русский и английский языки.
- Настройки соединения: DNS и KillSwitch.
- Автообновление из GitHub Releases этого репозитория.

Поддерживаемые платформы сборки: Linux, Windows. Android и macOS собираются
инфраструктурой upstream, но в этом форке не тестировались.

## Сборка

Требования: CMake 3.25+, Qt 6.10.1, Python 3, Conan 2.28, компилятор C++17/20.

```bash
git submodule update --init --recursive
python3 -m venv .venv
.venv/bin/pip install "conan==2.28.0"

# Linux: бинарники + установщик IFW
QT_INSTALL_DIR="$HOME/Qt" deploy/build.sh --generator Ninja --installer all

# Windows (из cmd, при установленном Qt/MSVC)
deploy\build.bat --installer all
```

Артефакты:

- Linux: `deploy/build/ViPN_<version>_linux_x64.run`
- Windows: `deploy/build/ViPN_<version>_windows_x64.exe` и `.msi`

Версию можно задать переменной `AMNEZIAVPN_VERSION` (по умолчанию `1.0.0.0`).

## Релизы и автообновление

Релиз создаётся тегом:

```bash
git tag v1.2.0
git push origin v1.2.0
```

Workflow `.github/workflows/release.yml` собирает Linux и Windows сборки с этой
версией и прикладывает установщики к GitHub Release. Клиент при запуске
запрашивает `https://api.github.com/repos/BeHuk-D/vipn-client/releases/latest`,
сравнивает версию с собственной и предлагает скачать и установить обновление.

Репозиторий обновлений задаётся в `client/cmake/branding/common.cmake`
(`CLIENT_UPDATE_GITHUB_REPO`), включение автообновления — `CLIENT_ENABLE_APP_UPDATES`.

## Лицензия

GPL-3.0. Проект является форком Amnezia Client; исходный код и лицензия
сохранены в репозитории. При распространении сборок исходники должны быть
доступны.

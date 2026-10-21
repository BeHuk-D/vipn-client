# ViPN

ViPN — VPN-клиент для собственного (self-hosted) сервера, основанный на открытом
клиенте [Amnezia](https://github.com/amnezia-vpn/amnezia-client) (GPL-3.0).
Проект переименован в ViPN, получил собственную иконку и обновлённую тёмную
палитру с золотым акцентом.

## Возможности

- OpenVPN, WireGuard, IKEv2.
- Протоколы с маскировкой трафика: AmneziaWG, Xray/REALITY, OpenVPN over Cloak,
  OpenVPN over Shadowsocks.
- Автоматическая установка VPN-контейнеров на ваш сервер по SSH.
- Split tunneling (включая выбор приложений на Android и desktop).
- Linux, Windows и Android.

## Сборка

Требования: CMake 3.25+, Qt 6.10.x, Python 3, Conan 2.28, компилятор C++17/20.
Для Android дополнительно нужны Android SDK/NDK и Qt для Android.

```bash
git submodule update --init --recursive
python3 -m venv .venv
.venv/bin/pip install "conan==2.28.0"

# Linux (бинарники + IFW-установщик)
QT_INSTALL_DIR="$HOME/Qt" deploy/build.sh --generator Ninja --installer all

# Если в системе GCC новее 15 (Conan 2.28 его ещё не знает), укажите GCC 15:
CC=gcc-15 CXX=g++-15 QT_INSTALL_DIR="$HOME/Qt" \
  deploy/build.sh --generator Ninja --installer all

# Windows (из cmd, при установленном Qt/MSVC)
deploy\build.bat --installer all

# Android APK/AAB
QT_INSTALL_DIR="$HOME/Qt" deploy/build.sh -t android --aab
```

Точные версии Qt и набор модулей совпадают с upstream CI: Qt 6.10.1,
`qtremoteobjects qt5compat qtshadertools qthttpserver qtwebsockets`.
Для Android можно использовать Qt 6.10.3, как в upstream.

Готовые артефакты:

- Linux: `deploy/build/ViPN_<version>_linux_x64.run`
- Windows: `deploy/build/ViPN_<version>_windows_x64.exe` / `.msi`
- Android: `deploy/build/client/android-build/build/outputs/apk/...`

## Брендинг

Все основные настройки вынесены в CMake:

- `client/cmake/branding/common.cmake` — имя приложения, имя сервиса,
  организация QSettings, префикс переводов, ссылки на сайт/поддержку.
- `client/cmake/branding/android.cmake` — `applicationId` (`org.vipn.vpn`).
- `client/ui/qml/Modules/Style/AmneziaStyle.qml` — палитра интерфейса
  (графит `#333333`, золотой акцент `#F8DC3C`).
- `client/images/vipnLogo.png` — исходная иконка 512×512. Из неё собраны
  `app.ico`, `app.icns`, `icon.png`, Linux PNG и все Android mipmap-ресурсы.
- `deploy/data/linux/` — `.desktop`, systemd-юнит и PNG для Linux.
- `deploy/data/windows/` и `deploy/installer/` — скрипты и WIX/IFW-установщик.

Ссылки на сайт, документацию, поддержку и репозиторий по умолчанию пустые и
скрыты в интерфейсе. Задайте их через `CLIENT_BRAND_*` при конфигурации CMake,
например:

```bash
cmake -S . -B build \
  -DCLIENT_BRAND_WEBSITE_URL="https://example.org" \
  -DCLIENT_BRAND_SUPPORT_EMAIL="support@example.org"
```

Встроенные обновления отключены (`CLIENT_ENABLE_APP_UPDATES=0`): upstream-фид
предлагает и скачивает сборки Amnezia. Включайте их только после настройки
собственного сервера обновлений.

### Совместимость

Имена протоколов и серверных контейнеров (`AmneziaWG`, `AmneziaDNS`,
образы `amneziavpn/*`, пути `/opt/amnezia/*`) сохранены без изменений, чтобы
клиент продолжал работать с существующей серверной инфраструктурой Amnezia.
Низкоуровневые идентификаторы Windows-драйверов (`AmneziaWGTunnel$AmneziaVPN`,
`AmneziaVPNSplitTunnel`, именованный канал WireGuard) также оставлены как в
upstream, поскольку они связаны с преднастроенными драйверами.

## Лицензия

GPL-3.0. Проект является форком Amnezia Client; исходный код и лицензия
сохранены в репозитории.

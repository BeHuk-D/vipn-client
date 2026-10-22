#include "deviceFingerprint.h"

#include <QCryptographicHash>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSysInfo>

#include "core/repositories/secureAppSettingsRepository.h"

namespace
{
    QString rawHardwareId(const SecureAppSettingsRepository *settings)
    {
        QString value = QSysInfo::machineUniqueId();
        if (!value.isEmpty()) {
            return value;
        }
        if (settings) {
            value = settings->getInstallationUuid(true);
        }
        if (value.isEmpty()) {
            value = QSysInfo::machineHostName();
        }
        return value;
    }
}

QString deviceFingerprint::hardwareId(const SecureAppSettingsRepository *settings)
{
    const QString raw = rawHardwareId(settings);
    if (raw.isEmpty()) {
        return {};
    }
    const QByteArray digest =
            QCryptographicHash::hash(QStringLiteral("vipn-hwid-v1:%1").arg(raw).toUtf8(), QCryptographicHash::Sha256);
    return QString::fromLatin1(digest.toHex());
}

QString deviceFingerprint::deviceInfo(const SecureAppSettingsRepository *settings)
{
    Q_UNUSED(settings)

    QJsonObject info;
    info.insert(QStringLiteral("platform"), QSysInfo::productType());
    info.insert(QStringLiteral("os"), QSysInfo::prettyProductName());
    info.insert(QStringLiteral("arch"), QSysInfo::currentCpuArchitecture());
    info.insert(QStringLiteral("name"), QSysInfo::machineHostName());

    return QString::fromUtf8(QJsonDocument(info).toJson(QJsonDocument::Compact));
}

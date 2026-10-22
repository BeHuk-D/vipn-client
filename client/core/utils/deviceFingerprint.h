#ifndef DEVICEFINGERPRINT_H
#define DEVICEFINGERPRINT_H

#include <QString>

class SecureAppSettingsRepository;

namespace deviceFingerprint
{
    QString hardwareId(const SecureAppSettingsRepository *settings);
    QString deviceInfo(const SecureAppSettingsRepository *settings);
}

#endif // DEVICEFINGERPRINT_H

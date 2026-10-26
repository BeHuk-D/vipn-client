#ifndef IPC_H
#define IPC_H

#include <QObject>
#include <QString>
#include <QFile>
#include <QRegularExpression>
#include <QSet>

#if defined(Q_OS_UNIX) && !defined(Q_OS_ANDROID)
    #include <cerrno>
    #include <cstring>
    #include <grp.h>
    #include <sys/stat.h>
    #include <unistd.h>
#endif

#include "../client/core/utils/utilities.h"

#define IPC_SERVICE_URL "local:AmneziaVpnIpcInterface"
#define IPC_SOCKET_GROUP "vipn"

namespace amnezia {

enum PermittedProcess {
    Invalid,
    OpenVPN,
    Wireguard,
    Tun2Socks,
    CertUtil,
    PermittedProcessCount
};

inline QString permittedProcessPath(PermittedProcess pid)
{
    switch (pid) {
        case PermittedProcess::OpenVPN:
            return Utils::openVpnExecPath();
        case PermittedProcess::Wireguard:
            return Utils::wireguardExecPath();
        case PermittedProcess::CertUtil:
            return Utils::certUtilPath();
        case PermittedProcess::Tun2Socks:
            return Utils::tun2socksPath();
        default:
            return "";
    }
}


inline QString getIpcServiceUrl() {
#ifdef Q_OS_WIN
    return IPC_SERVICE_URL;
#else
    return QString("/tmp/%1").arg(IPC_SERVICE_URL);
#endif
}

inline QString getIpcProcessUrl(int pid) {
#ifdef Q_OS_WIN
    return QString("%1_%2").arg(IPC_SERVICE_URL).arg(pid);
#else
    return QString("/tmp/%1_%2").arg(IPC_SERVICE_URL).arg(pid);
#endif
}

inline bool restrictIpcSocket(const QString &path, QString &error) {
#if defined(Q_OS_WIN) || defined(Q_OS_ANDROID)
    Q_UNUSED(path)
    Q_UNUSED(error)
    return true;
#else
    const QByteArray nativePath = QFile::encodeName(path);
    const char *nativeName = nativePath.constData();

    const struct group *socketGroup = getgrnam(IPC_SOCKET_GROUP);
    if (!socketGroup) {
        error = QString("group '%1' does not exist").arg(QStringLiteral(IPC_SOCKET_GROUP));
        chmod(nativeName, S_IRUSR | S_IWUSR);
        return false;
    }

    bool hasGroup = true;
    if (chown(nativeName, static_cast<uid_t>(-1), socketGroup->gr_gid) != 0) {
        error = QString("chown to '%1' failed: %2").arg(QStringLiteral(IPC_SOCKET_GROUP),
                                                       QString::fromLocal8Bit(strerror(errno)));
        hasGroup = false;
    }

    if (chmod(nativeName, S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP) != 0) {
        error = QString("chmod failed: %1").arg(QString::fromLocal8Bit(strerror(errno)));
        return false;
    }

    return hasGroup;
#endif
}

inline QStringList sanitizeArguments(PermittedProcess proc, const QStringList &args) {
    using Validator = std::function<bool(const QString&)>;
    QMap<QString, Validator> namedArgs;
    QList<Validator> positionalArgs;

    switch (proc) {
    case OpenVPN: {
        namedArgs["--config"] = [](const QString& v) { return !v.isEmpty(); };
        namedArgs["--management"] = [](const QString& v) { return !v.isEmpty(); };
        namedArgs["--management-client"] = nullptr;
        positionalArgs.append([](const QString& v) {
            bool ok;
            int port = v.toInt(&ok);
            return ok && port > 0 && port <= 65535;
        });
        break;
    }
    case Tun2Socks:
        namedArgs["-device"] = [](const QString& v) { return v.startsWith("tun://"); };
        namedArgs["-proxy"] = [](const QString& v) { return v.startsWith("socks5://"); };
        break;
    case CertUtil:
        return args;
    default:
        return {};
    }

    QStringList sanitized;

    for (int i = 0, pos = 0; i < args.size(); i++) {
        const auto& key = args[i];

        if (const auto found = namedArgs.find(key); found != namedArgs.end()) {
            const auto validator = found.value();

            if (validator) {
                if (i + 1 < args.size()) {
                    const auto& value = args[i+1];
                    if (validator(value)) {
                        sanitized << key << value;
                        i++;
                    }
                }
            } else {
                sanitized << key;
            }
        } else if (pos < positionalArgs.size()) {
            if (const auto validator = positionalArgs[pos]; validator && validator(key)) {
                sanitized << key;
                pos++;
            }
        }
    }

    return sanitized;
}

} // namespace amnezia

#endif // IPC_H

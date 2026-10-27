#include "localserver.h"

#include <QAbstractSocket>
#include <QCoreApplication>
#include <QDebug>
#include <QFileInfo>
#include <QLocalServer>
#include <QLocalSocket>
#include <QObject>
#include <QSharedPointer>
#include <QString>

#include "ipc.h"
#include "killswitch.h"
#include "logger.h"

#ifdef Q_OS_WIN
    #include "tapcontroller_win.h"
#endif

namespace {
Logger logger("WgDaemonServer");

bool clearStaleSocket(const QString &serverName)
{
    QLocalSocket probe;
    probe.connectToServer(serverName);
    if (probe.waitForConnected(300)) {
        probe.disconnectFromServer();
        return false;
    }
    return QLocalServer::removeServer(serverName);
}
}

LocalServer::LocalServer(QObject *parent) : QObject(parent),
    m_ipcServer(this)
{
    // Create the server and listen outside of QtRO
    m_server = QSharedPointer<QLocalServer>(new QLocalServer(this));

    const QString ipcUrl = amnezia::getIpcServiceUrl();
    if (!m_server->listen(ipcUrl)) {
        const bool removed = m_server->serverError() == QAbstractSocket::AddressInUseError
                && clearStaleSocket(ipcUrl);
        if (!removed || !m_server->listen(ipcUrl)) {
            logger.error() << "Unable to start the server:" << m_server->errorString();
            return;
        }
        logger.info() << "Removed stale IPC socket" << ipcUrl;
    }

    QString socketError;
    if (!amnezia::restrictIpcSocket(ipcUrl, socketError)) {
        logger.error() << "Failed to restrict IPC socket access:" << socketError;
    }

    QObject::connect(m_server.data(), &QLocalServer::newConnection, this, [this]() {
        qDebug() << "LocalServer new connection";
        m_serverNode.addHostSideConnection(m_server->nextPendingConnection());

        if (!m_isRemotingEnabled) {
            m_isRemotingEnabled = true;
            m_serverNode.enableRemoting(&m_ipcServer);
        }
    });

    // Init Mozilla Wireguard Daemon
    if (!server.initialize()) {
        logger.error() << "Failed to initialize the server";
        return;
    }

    m_networkWatcher.initialize();
    connect(&m_networkWatcher, &NetworkWatcher::networkChanged, &m_ipcServer, &IpcServer::networkChanged);
    connect(&m_networkWatcher, &NetworkWatcher::wakeup, &m_ipcServer, &IpcServer::wakeup);
    KillSwitch::instance()->init();

#ifdef Q_OS_LINUX
    // Signal handling for a proper shutdown.
    QObject::connect(qApp, &QCoreApplication::aboutToQuit,
                     []() { LinuxDaemon::instance()->deactivate(); });
#endif

#ifdef Q_OS_MAC
    // Signal handling for a proper shutdown.
    QObject::connect(qApp, &QCoreApplication::aboutToQuit,
                     []() { MacOSDaemon::instance()->deactivate(); });
#endif

#ifdef Q_OS_WIN
    // Signal handling for a proper shutdown.
    QObject::connect(qApp, &QCoreApplication::aboutToQuit,
                     []() { WindowsDaemon::instance()->deactivate(); });
#endif
}

LocalServer::~LocalServer()
{
    qDebug() << "Local server stopped";
}


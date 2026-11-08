#include "pingController.h"

#include <QAbstractSocket>
#include <QTcpSocket>
#include <QTimer>

PingController::PingController(QObject *parent)
    : QObject(parent),
      m_socket(new QTcpSocket(this)),
      m_timeout(new QTimer(this))
{
    m_timeout->setSingleShot(true);

    connect(m_timeout, &QTimer::timeout, this, [this]() {
        if (!m_attemptActive) {
            return;
        }
        m_attemptActive = false;
        m_socket->abort();
        scheduleNext();
    });

    connect(m_socket, &QTcpSocket::connected, this, [this]() {
        handleSuccess();
    });

    connect(m_socket, &QAbstractSocket::errorOccurred, this, [this](QAbstractSocket::SocketError) {
        handleFailure();
    });
}

int PingController::serverPingMs(const QString &serverId) const
{
    return m_serverPings.value(serverId, -1);
}

bool PingController::isServerPingPending(const QString &serverId) const
{
    return m_pendingServers.contains(serverId);
}

void PingController::pingServer(const QString &serverId, const QString &host, int port)
{
    if (serverId.isEmpty() || host.isEmpty() || port <= 0) {
        return;
    }

    if (m_pendingServers.contains(serverId)) {
        return;
    }

    m_pendingServers.insert(serverId);
    m_queue.append({serverId, host, port});
    ++m_revision;
    emit pingUpdated();

    if (!m_busy) {
        QTimer::singleShot(0, this, [this]() { startNext(); });
    }
}

void PingController::startNext()
{
    if (m_busy || m_queue.isEmpty()) {
        return;
    }

    const Request request = m_queue.takeFirst();
    m_currentId = request.serverId;
    m_host = request.host;
    m_port = request.port;
    m_samples.clear();
    m_attempt = 0;
    m_busy = true;

    attempt();
}

void PingController::attempt()
{
    m_attemptActive = true;
    m_timer.start();
    m_timeout->start(kAttemptTimeoutMs);
    m_socket->connectToHost(m_host, static_cast<quint16>(m_port));
}

void PingController::handleSuccess()
{
    if (!m_attemptActive) {
        return;
    }

    m_attemptActive = false;
    m_timeout->stop();
    m_samples.append(static_cast<int>(m_timer.elapsed()));
    m_socket->abort();
    scheduleNext();
}

void PingController::handleFailure()
{
    if (!m_attemptActive) {
        return;
    }

    m_attemptActive = false;
    m_timeout->stop();
    m_socket->abort();
    scheduleNext();
}

void PingController::scheduleNext()
{
    if (++m_attempt >= kAttempts) {
        finish();
        return;
    }

    QTimer::singleShot(40, this, [this]() { attempt(); });
}

void PingController::finish()
{
    m_busy = false;

    int best = -1;
    if (!m_samples.isEmpty()) {
        best = m_samples.first();
        for (int sample : m_samples) {
            best = qMin(best, sample);
        }
    }

    const QString finishedId = m_currentId;
    m_currentId.clear();

    if (!finishedId.isEmpty()) {
        m_pendingServers.remove(finishedId);
        m_serverPings.insert(finishedId, best);
        ++m_revision;
        emit pingUpdated();
    }

    if (!m_queue.isEmpty()) {
        QTimer::singleShot(0, this, [this]() { startNext(); });
    }
}

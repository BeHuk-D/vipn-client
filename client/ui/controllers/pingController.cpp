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

void PingController::ping(const QString &host, int port)
{
    if (m_isPinging || host.isEmpty() || port <= 0) {
        return;
    }

    m_host = host;
    m_port = port;
    m_samples.clear();
    m_attempt = 0;
    m_isPinging = true;
    m_pingMs = -1;

    emit pingChanged();
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
    m_isPinging = false;

    if (m_samples.isEmpty()) {
        m_pingMs = -1;
    } else {
        int best = m_samples.first();
        for (int sample : m_samples) {
            best = qMin(best, sample);
        }
        m_pingMs = best;
    }

    emit pingChanged();
}

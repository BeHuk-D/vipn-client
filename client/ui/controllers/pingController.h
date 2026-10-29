#ifndef PINGCONTROLLER_H
#define PINGCONTROLLER_H

#include <QElapsedTimer>
#include <QHash>
#include <QObject>
#include <QSet>
#include <QString>
#include <QVector>

class QTcpSocket;
class QTimer;

class PingController : public QObject
{
    Q_OBJECT

    Q_PROPERTY(int revision READ revision NOTIFY pingUpdated)

public:
    explicit PingController(QObject *parent = nullptr);

    int revision() const { return m_revision; }

    Q_INVOKABLE int serverPingMs(const QString &serverId) const;
    Q_INVOKABLE bool isServerPingPending(const QString &serverId) const;

public slots:
    void pingServer(const QString &serverId, const QString &host, int port);

signals:
    void pingUpdated();

private:
    struct Request
    {
        QString serverId;
        QString host;
        int port = 0;
    };

    void startNext();
    void attempt();
    void scheduleNext();
    void finish();
    void handleSuccess();
    void handleFailure();

    QTcpSocket *m_socket;
    QTimer *m_timeout;
    QElapsedTimer m_timer;
    QVector<int> m_samples;
    QVector<Request> m_queue;
    QHash<QString, int> m_serverPings;
    QSet<QString> m_pendingServers;
    QString m_currentId;
    QString m_host;
    int m_port = 0;
    int m_attempt = 0;
    int m_revision = 0;
    bool m_busy = false;
    bool m_attemptActive = false;

    static constexpr int kAttempts = 3;
    static constexpr int kAttemptTimeoutMs = 2000;
};

#endif // PINGCONTROLLER_H

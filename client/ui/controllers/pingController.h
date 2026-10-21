#ifndef PINGCONTROLLER_H
#define PINGCONTROLLER_H

#include <QElapsedTimer>
#include <QObject>
#include <QString>
#include <QVector>

class QTcpSocket;
class QTimer;

class PingController : public QObject
{
    Q_OBJECT

    Q_PROPERTY(int pingMs READ pingMs NOTIFY pingChanged)
    Q_PROPERTY(bool isPinging READ isPinging NOTIFY pingChanged)

public:
    explicit PingController(QObject *parent = nullptr);

    int pingMs() const { return m_pingMs; }
    bool isPinging() const { return m_isPinging; }

public slots:
    void ping(const QString &host, int port);

signals:
    void pingChanged();

private:
    void attempt();
    void scheduleNext();
    void finish();
    void handleSuccess();
    void handleFailure();

    QTcpSocket *m_socket;
    QTimer *m_timeout;
    QElapsedTimer m_timer;
    QVector<int> m_samples;
    QString m_host;
    int m_port = 0;
    int m_attempt = 0;
    int m_pingMs = -1;
    bool m_isPinging = false;
    bool m_attemptActive = false;

    static constexpr int kAttempts = 3;
    static constexpr int kAttemptTimeoutMs = 2000;
};

#endif // PINGCONTROLLER_H

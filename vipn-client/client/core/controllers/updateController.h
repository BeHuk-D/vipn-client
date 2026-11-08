#ifndef UPDATECONTROLLER_H
#define UPDATECONTROLLER_H

#include <QObject>

class UpdateController : public QObject
{
    Q_OBJECT
public:
    explicit UpdateController(QObject *parent = nullptr);

    QString getVersion() const;
    QString getReleaseDate() const;
    QString getDescription() const;
    QString getReleasePageUrl() const;
    bool isUpdateCheckRunning() const;

public slots:
    void checkForUpdates();
    void openReleasePage();

signals:
    void updateFound();
    void updateNotFound();
    void updateCheckFailed();
    void updateCheckRunningChanged();

private:
    void setUpdateCheckRunning(bool running);
    void checkGitHubUpdates();

    QString m_version;
    QString m_releaseDate;
    QString m_description;
    QString m_releasePageUrl;

    bool m_updateCheckRunning = false;
};

#endif // UPDATECONTROLLER_H

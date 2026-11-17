#ifndef UPDATECONTROLLER_H
#define UPDATECONTROLLER_H

#include <QObject>
#include <QStringList>
#include <QVector>

class QNetworkReply;

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
    void openSite();

signals:
    void updateFound();
    void updateNotFound();
    void updateCheckFailed();
    void updateCheckRunningChanged();
    void siteUnavailable();

private:
    enum class SiteState {
        Pending,
        Dead,
        Alive
    };

    void setUpdateCheckRunning(bool running);
    void checkSiteUpdates();
    void checkGitHubUpdates();
    void resolveSiteChoice();

    QString m_version;
    QString m_releaseDate;
    QString m_description;
    QString m_releasePageUrl;

    QStringList m_siteManifests;
    int m_siteManifestIndex = 0;

    QStringList m_siteOrigins;
    QVector<QNetworkReply *> m_siteReplies;
    QVector<SiteState> m_siteStates;
    quint64 m_siteProbeId = 0;
    bool m_siteProbeRunning = false;

    bool m_updateCheckRunning = false;
};

#endif // UPDATECONTROLLER_H

#include "updateController.h"

#include <QDesktopServices>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QUrl>
#include <QVector>

#include "amneziaApplication.h"
#include "logger.h"
#include "core/utils/appUiConfig.h"
#include "version.h"

namespace
{
    Logger logger("UpdateController");

    QVector<int> versionParts(QString value)
    {
        if (value.startsWith(QLatin1Char('v'))) {
            value.remove(0, 1);
        }
        QVector<int> parts;
        for (const QString &part : value.split(QLatin1Char('.'))) {
            parts.append(part.toInt());
        }
        return parts;
    }

    bool isNewerVersion(const QString &candidate, const QString &current)
    {
        const QVector<int> candidateParts = versionParts(candidate);
        const QVector<int> currentParts = versionParts(current);
        const int size = qMax(candidateParts.size(), currentParts.size());
        for (int index = 0; index < size; ++index) {
            const int left = index < candidateParts.size() ? candidateParts.at(index) : 0;
            const int right = index < currentParts.size() ? currentParts.at(index) : 0;
            if (left != right) {
                return left > right;
            }
        }
        return false;
    }

    QString defaultReleasesPageUrl()
    {
        return QStringLiteral("https://github.com/%1/releases/latest").arg(QString::fromLatin1(CLIENT_UPDATE_GITHUB_REPO));
    }
}

UpdateController::UpdateController(QObject *parent)
    : QObject(parent)
{
}

QString UpdateController::getVersion() const
{
    return m_version;
}

QString UpdateController::getReleaseDate() const
{
    return m_releaseDate;
}

QString UpdateController::getDescription() const
{
    return m_description;
}

QString UpdateController::getReleasePageUrl() const
{
    return m_releasePageUrl.isEmpty() ? defaultReleasesPageUrl() : m_releasePageUrl;
}

bool UpdateController::isUpdateCheckRunning() const
{
    return m_updateCheckRunning;
}

void UpdateController::setUpdateCheckRunning(bool running)
{
    if (m_updateCheckRunning == running) {
        return;
    }
    m_updateCheckRunning = running;
    emit updateCheckRunningChanged();
}

void UpdateController::checkForUpdates()
{
#if !CLIENT_ENABLE_APP_UPDATES
    return;
#endif

    if (m_updateCheckRunning) {
        return;
    }

    if (QString::fromLatin1(CLIENT_UPDATE_GITHUB_REPO).isEmpty()) {
        logger.error() << "Update repository is not configured";
        emit updateCheckFailed();
        return;
    }

    checkGitHubUpdates();
}

void UpdateController::checkGitHubUpdates()
{
    setUpdateCheckRunning(true);

    const QString repo = QString::fromLatin1(CLIENT_UPDATE_GITHUB_REPO);
    QNetworkRequest request(QUrl(QStringLiteral("https://api.github.com/repos/%1/releases/latest").arg(repo)));
    request.setTransferTimeout(15000);
    request.setRawHeader("Accept", "application/vnd.github+json");
    request.setRawHeader("User-Agent", APPLICATION_NAME);

    QNetworkReply *reply = amnApp->networkManager()->get(request);

    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setUpdateCheckRunning(false);

        if (reply->error() != QNetworkReply::NoError) {
            logger.error() << "GitHub release request failed:" << static_cast<int>(reply->error())
                           << reply->errorString();
            emit updateCheckFailed();
            return;
        }

        const QJsonObject release = QJsonDocument::fromJson(reply->readAll()).object();
        const QString tag = release.value(QStringLiteral("tag_name")).toString();
        if (tag.isEmpty()) {
            logger.error() << "GitHub release has no tag";
            emit updateCheckFailed();
            return;
        }

        const QString version = tag.startsWith(QLatin1Char('v')) ? tag.mid(1) : tag;
        if (!isNewerVersion(version, QStringLiteral(APP_VERSION))) {
            logger.info() << "No application update available, latest release is" << version;
            emit updateNotFound();
            return;
        }

        m_version = version;
        m_releaseDate = release.value(QStringLiteral("published_at")).toString().left(10);
        m_description = release.value(QStringLiteral("body")).toString();
        m_releasePageUrl = release.value(QStringLiteral("html_url")).toString();

        logger.info() << "Application update available:" << version;
        emit updateFound();
    });
}

void UpdateController::openReleasePage()
{
    const QUrl url(getReleasePageUrl());
    if (!url.isValid()) {
        logger.error() << "Invalid release page URL";
        return;
    }
    QDesktopServices::openUrl(url);
}

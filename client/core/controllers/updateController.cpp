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

    QStringList siteOrigins()
    {
        return {
            QStringLiteral("https://vipn-connect.space"),
            QStringLiteral("https://mirror.vipn-connect.space"),
            QStringLiteral("https://vipn-web.vipn-net.workers.dev"),
            QStringLiteral("https://www.vipn-connect.space"),
        };
    }

    QString downloadsPageUrl(const QUrl &manifestUrl)
    {
        QUrl page = manifestUrl;
        page.setPath(QStringLiteral("/downloads/"));
        page.setQuery(QString());
        page.setFragment(QString());
        return page.toString();
    }

    constexpr int kSiteProbeTimeoutMs = 3500;
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

    m_siteManifests.clear();
    for (const QString &origin : siteOrigins()) {
        m_siteManifests.append(origin + QStringLiteral("/downloads/releases.json"));
    }
    m_siteManifestIndex = 0;

    checkSiteUpdates();
}

void UpdateController::checkSiteUpdates()
{
    if (m_siteManifestIndex >= m_siteManifests.size()) {
        logger.info() << "No site mirror responded, falling back to GitHub";
        checkGitHubUpdates();
        return;
    }

    setUpdateCheckRunning(true);

    const QUrl manifestUrl(m_siteManifests.at(m_siteManifestIndex));
    QNetworkRequest request(manifestUrl);
    request.setTransferTimeout(6000);
    request.setRawHeader("Accept", "application/json");
    request.setRawHeader("User-Agent", APPLICATION_NAME);

    QNetworkReply *reply = amnApp->networkManager()->get(request);

    connect(reply, &QNetworkReply::finished, this, [this, reply, manifestUrl]() {
        reply->deleteLater();

        if (reply->error() != QNetworkReply::NoError) {
            logger.warning() << "Release manifest request failed:" << manifestUrl.toString()
                             << static_cast<int>(reply->error()) << reply->errorString();
            ++m_siteManifestIndex;
            checkSiteUpdates();
            return;
        }

        const QJsonObject manifest = QJsonDocument::fromJson(reply->readAll()).object();
        const QString version = manifest.value(QStringLiteral("version")).toString().isEmpty()
                ? manifest.value(QStringLiteral("tag")).toString()
                : manifest.value(QStringLiteral("version")).toString();
        const QString normalized = version.startsWith(QLatin1Char('v')) ? version.mid(1) : version;
        if (normalized.isEmpty()) {
            logger.warning() << "Release manifest has no version:" << manifestUrl.toString();
            ++m_siteManifestIndex;
            checkSiteUpdates();
            return;
        }

        setUpdateCheckRunning(false);

        if (!isNewerVersion(normalized, QStringLiteral(APP_VERSION))) {
            logger.info() << "No application update available, latest release is" << normalized;
            emit updateNotFound();
            return;
        }

        m_version = normalized;
        m_releaseDate = manifest.value(QStringLiteral("published_at")).toString().left(10);
        m_description.clear();
        m_releasePageUrl = downloadsPageUrl(manifestUrl);

        logger.info() << "Application update available:" << normalized;
        emit updateFound();
    });
}

void UpdateController::checkGitHubUpdates()
{
    if (QString::fromLatin1(CLIENT_UPDATE_GITHUB_REPO).isEmpty()) {
        logger.error() << "Update repository is not configured";
        setUpdateCheckRunning(false);
        emit updateCheckFailed();
        return;
    }

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

void UpdateController::openSite()
{
    if (m_siteProbeRunning) {
        return;
    }

    m_siteProbeRunning = true;
    ++m_siteProbeId;
    const quint64 probeId = m_siteProbeId;

    m_siteOrigins = siteOrigins();
    m_siteStates = QVector<SiteState>(m_siteOrigins.size(), SiteState::Pending);
    m_siteReplies = QVector<QNetworkReply *>(m_siteOrigins.size(), nullptr);

    for (int index = 0; index < m_siteOrigins.size(); ++index) {
        QNetworkRequest request(QUrl(m_siteOrigins.at(index) + QStringLiteral("/")));
        request.setTransferTimeout(kSiteProbeTimeoutMs);
        request.setRawHeader("Accept", "text/html");
        request.setRawHeader("User-Agent", APPLICATION_NAME);

        QNetworkReply *reply = amnApp->networkManager()->get(request);
        m_siteReplies[index] = reply;

        connect(reply, &QNetworkReply::finished, this, [this, reply, probeId, index]() {
            if (probeId != m_siteProbeId) {
                reply->deleteLater();
                return;
            }

            m_siteReplies[index] = nullptr;

            const bool transportFailure = reply->error() != QNetworkReply::NoError;
            const bool hasStatus = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).isValid();
            m_siteStates[index] = (transportFailure && !hasStatus) ? SiteState::Dead : SiteState::Alive;

            reply->deleteLater();
            resolveSiteChoice();
        });
    }
}

void UpdateController::resolveSiteChoice()
{
    if (!m_siteProbeRunning) {
        return;
    }

    int chosenIndex = -1;
    for (int index = 0; index < m_siteStates.size(); ++index) {
        const SiteState state = m_siteStates.at(index);
        if (state == SiteState::Pending) {
            return;
        }
        if (state == SiteState::Alive) {
            chosenIndex = index;
            break;
        }
    }

    m_siteProbeRunning = false;
    ++m_siteProbeId;

    const QString chosenOrigin = chosenIndex >= 0 ? m_siteOrigins.at(chosenIndex) : QString();

    for (QNetworkReply *reply : m_siteReplies) {
        if (!reply) {
            continue;
        }
        reply->disconnect(this);
        reply->abort();
        reply->deleteLater();
    }
    m_siteReplies.clear();
    m_siteStates.clear();
    m_siteOrigins.clear();

    if (chosenIndex < 0) {
        logger.warning() << "No site mirror responded";
        emit siteUnavailable();
        return;
    }

    logger.info() << "Opening site mirror" << chosenOrigin;
    QDesktopServices::openUrl(QUrl(chosenOrigin + QStringLiteral("/")));
}

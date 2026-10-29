#include "importUiController.h"

#include <QDebug>
#include <QFile>
#include <QFileInfo>
#include <QMutex>
#include <QJsonDocument>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QUrl>
#include <QUrlQuery>

#include "amneziaApplication.h"
#include "core/utils/deviceFingerprint.h"
#include "systemController.h"

#ifdef Q_OS_ANDROID
    #include "platforms/android/android_controller.h"
#endif

#if defined Q_OS_ANDROID
ImportUiController* ImportUiController::mInstance = nullptr;
static QMutex qrDecodeMutex;
#endif

ImportUiController::ImportUiController(ImportController* importController, SecureAppSettingsRepository* appSettingsRepository,
                                       QObject *parent)
    : QObject(parent),
      m_importController(importController),
      m_appSettingsRepository(appSettingsRepository),
      m_isNativeWireGuardConfig(false)
{
#if defined Q_OS_ANDROID
    mInstance = this;
#endif

    connect(m_importController, &ImportController::importFinished, this, &ImportUiController::importFinished);
    connect(m_importController, &ImportController::importErrorOccurred, this, &ImportUiController::importErrorOccurred);
    connect(m_importController, &ImportController::restoreAppConfig, this, &ImportUiController::restoreAppConfig);
}

bool ImportUiController::extractConfigFromFile(const QString &fileName)
{
    m_pendingConfigs.clear();
    m_pendingSubscriptionUrl.clear();
    QString data;
    if (!SystemController::readFile(fileName, data)) {
        emit importErrorOccurred(ErrorCode::ImportOpenConfigError, false);
        return false;
    }
    
    QString configFileName = QFileInfo(QFile(fileName).fileName()).fileName();
#ifdef Q_OS_ANDROID
    if (configFileName.isEmpty()) {
        configFileName = AndroidController::instance()->getFileName(fileName);
    }
#endif
    
    auto result = m_importController->extractConfigFromData(data, configFileName);
    
    if (result.errorCode != ErrorCode::NoError) {
        emit importErrorOccurred(result.errorCode, false);
        return false;
    }
    
    m_config = result.config;
    m_configFileName = result.configFileName;
    m_maliciousWarningText = result.maliciousWarningText;
    m_isNativeWireGuardConfig = result.isNativeWireGuardConfig;
    
    emit importConfigChanged();
    return true;
}

bool ImportUiController::extractConfigFromData(QString data)
{
    m_pendingConfigs.clear();
    m_pendingSubscriptionUrl.clear();
    auto result = m_importController->extractConfigFromData(data);
    
    if (result.errorCode != ErrorCode::NoError) {
        emit importErrorOccurred(result.errorCode, false);
        return false;
    }
    
    m_config = result.config;
    m_configFileName = result.configFileName;
    m_maliciousWarningText = result.maliciousWarningText;
    m_isNativeWireGuardConfig = result.isNativeWireGuardConfig;
    
    emit importConfigChanged();
    return true;
}

bool ImportUiController::isFetchingConfig()
{
    return m_configUrlReply != nullptr;
}

bool ImportUiController::isRefreshingSubscription()
{
    return m_configUrlReply != nullptr && !m_refreshServerId.isEmpty();
}

void ImportUiController::refreshSubscription(const QString &serverId, const QString &url)
{
    if (serverId.isEmpty() || url.isEmpty()) {
        emit subscriptionRefreshFinished(false);
        return;
    }

    m_refreshServerId = serverId;
    if (!extractConfigFromUrl(url)) {
        m_refreshServerId.clear();
        emit subscriptionRefreshFinished(false);
    }
}

bool ImportUiController::extractConfigFromUrl(const QString &url)
{
    m_pendingConfigs.clear();
    m_pendingSubscriptionUrl.clear();
    const QUrl parsed(url.trimmed());
    if (!parsed.isValid() || parsed.scheme() != QStringLiteral("https")) {
        emit importErrorOccurred(ErrorCode::ImportConfigUrlError, false);
        return false;
    }

    if (QNetworkReply *previousReply = m_configUrlReply) {
        m_configUrlReply = nullptr;
        previousReply->abort();
        previousReply->deleteLater();
    }

    QUrl requestUrl = parsed;
    QUrlQuery query(requestUrl);
    query.removeQueryItem(QStringLiteral("all"));
    query.addQueryItem(QStringLiteral("all"), QStringLiteral("1"));
    requestUrl.setQuery(query);

    QNetworkRequest request(requestUrl);
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setTransferTimeout(15000);
    request.setRawHeader("Accept", "text/plain");

    const QString hwid = deviceFingerprint::hardwareId(m_appSettingsRepository);
    if (!hwid.isEmpty()) {
        request.setRawHeader("X-ViPN-Hwid", hwid.toLatin1());
    }
    const QString deviceInfo = deviceFingerprint::deviceInfo(m_appSettingsRepository);
    if (!deviceInfo.isEmpty()) {
        request.setRawHeader("X-ViPN-Device",
                             deviceInfo.toUtf8().toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals));
    }

    m_configUrlReply = amnApp->networkManager()->get(request);
    const QString normalizedUrl = parsed.toString();
    connect(m_configUrlReply, &QNetworkReply::finished, this, [this, normalizedUrl]() {
        handleConfigUrlReply(normalizedUrl);
    });

    emit configUrlFetchChanged();
    return true;
}

void ImportUiController::failConfigUrlFetch()
{
    emit importErrorOccurred(ErrorCode::ImportConfigUrlError, false);
    emit configUrlFetchFinished(false);
}

void ImportUiController::handleConfigUrlReply(const QString &url)
{
    constexpr int maxSubscriptionBytes = 256 * 1024;
    constexpr int httpStatusForbidden = 403;
    constexpr int httpStatusNotFound = 404;
    constexpr int httpStatusConflict = 409;

    QNetworkReply *reply = m_configUrlReply;
    m_configUrlReply = nullptr;
    if (!reply) {
        return;
    }

    const int statusCode = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    const bool hasReplyError = reply->error() != QNetworkReply::NoError;
    const QByteArray body = reply->readAll();
    reply->deleteLater();

    const bool isRefresh = !m_refreshServerId.isEmpty();
    const QString refreshServerId = m_refreshServerId;
    m_refreshServerId.clear();
    emit configUrlFetchChanged();

    const auto reportFailure = [this, isRefresh]() {
        if (isRefresh) {
            emit subscriptionRefreshFinished(false);
        } else {
            emit importErrorOccurred(ErrorCode::ImportConfigUrlError, false);
            emit configUrlFetchFinished(false);
        }
    };

    if (statusCode == httpStatusForbidden || statusCode == httpStatusNotFound) {
        emit subscriptionInvalid();
    }

    if (statusCode == httpStatusConflict) {
        if (isRefresh) {
            emit subscriptionRefreshFinished(false);
        } else {
            emit configUrlFetchFinished(false);
        }
        emit subscriptionDeviceLimitReached();
        return;
    }

    if (hasReplyError || body.isEmpty() || body.size() > maxSubscriptionBytes) {
        reportFailure();
        return;
    }

    const QString data = QString::fromUtf8(body).trimmed();
    if (data.isEmpty()) {
        reportFailure();
        return;
    }

    static const QRegularExpression entryMarker(
            QStringLiteral("^#\\s*ViPN-Expires-At:"), QRegularExpression::MultilineOption);
    QVector<int> entryStarts;
    auto matches = entryMarker.globalMatch(data);
    while (matches.hasNext()) {
        entryStarts.append(matches.next().capturedStart());
    }

    if (entryStarts.size() > 1) {
        QVector<QJsonObject> configs;
        for (int i = 0; i < entryStarts.size(); ++i) {
            const int from = entryStarts.at(i);
            const int to = (i + 1 < entryStarts.size()) ? entryStarts.at(i + 1) : data.size();
            const QString piece = data.mid(from, to - from).trimmed();
            if (piece.isEmpty()) {
                continue;
            }
            const QString prefixed = QStringLiteral("# ViPN-Subscription-Url: %1\n%2").arg(url, piece);
            const auto result = m_importController->extractConfigFromData(prefixed);
            if (result.errorCode == ErrorCode::NoError) {
                configs.append(result.config);
            }
        }

        if (configs.isEmpty()) {
            reportFailure();
            return;
        }

        if (isRefresh) {
            m_importController->replaceSubscriptionConfigs(url, configs);
            m_config = {};
            m_configFileName.clear();
            m_maliciousWarningText.clear();
            m_isNativeWireGuardConfig = false;
            emit importConfigChanged();
            emit subscriptionRefreshFinished(true);
            return;
        }

        m_pendingConfigs = configs;
        m_pendingSubscriptionUrl = url;
        m_config = {};
        m_configFileName.clear();
        m_maliciousWarningText.clear();
        m_isNativeWireGuardConfig = false;
        emit importConfigChanged();
        emit configUrlFetchFinished(true);
        return;
    }

    const QString prefixed = QStringLiteral("# ViPN-Subscription-Url: %1\n%2").arg(url, data);
    if (!extractConfigFromData(prefixed)) {
        if (isRefresh) {
            emit subscriptionRefreshFinished(false);
        } else {
            emit configUrlFetchFinished(false);
        }
        return;
    }

    if (isRefresh) {
        m_importController->replaceConfig(refreshServerId, m_config);
        m_config = {};
        m_configFileName.clear();
        m_maliciousWarningText.clear();
        m_isNativeWireGuardConfig = false;
        emit importConfigChanged();
        emit subscriptionRefreshFinished(true);
        return;
    }

    emit configUrlFetchFinished(true);
}

bool ImportUiController::extractConfigFromQr(const QByteArray &data)
{
    m_pendingConfigs.clear();
    m_pendingSubscriptionUrl.clear();
    auto result = m_importController->extractConfigFromQr(data);
    
    if (result.errorCode != ErrorCode::NoError) {
        emit importErrorOccurred(result.errorCode, false);
        return false;
    }
    
    m_config = result.config;
    m_configFileName = result.configFileName;
    m_maliciousWarningText = result.maliciousWarningText;
    m_isNativeWireGuardConfig = result.isNativeWireGuardConfig;
    
    emit importConfigChanged();
    return true;
}

QString ImportUiController::getConfig()
{
    return QJsonDocument(m_config).toJson(QJsonDocument::Indented);
}

QString ImportUiController::getConfigFileName()
{
    return m_configFileName;
}

QString ImportUiController::getMaliciousWarningText()
{
    return m_maliciousWarningText;
}

bool ImportUiController::isNativeWireGuardConfig()
{
    return m_isNativeWireGuardConfig;
}

void ImportUiController::processNativeWireGuardConfig()
{
    m_config = m_importController->processNativeWireGuardConfig(m_config);
    emit importConfigChanged();
}

void ImportUiController::importConfig()
{
    if (!m_pendingConfigs.isEmpty()) {
        m_importController->replaceSubscriptionConfigs(m_pendingSubscriptionUrl, m_pendingConfigs);
        m_pendingConfigs.clear();
        m_pendingSubscriptionUrl.clear();
    } else {
        m_importController->importConfig(m_config);
    }

    m_config = {};
    m_configFileName.clear();
    m_maliciousWarningText.clear();
    m_isNativeWireGuardConfig = false;
    
    emit importConfigChanged();
}

void ImportUiController::clearConfigFileName()
{
    m_configFileName.clear();
    emit importConfigChanged();
}

#if defined Q_OS_ANDROID || defined Q_OS_IOS
void ImportUiController::startDecodingQr()
{
    m_importController->startDecodingQr();
#if defined Q_OS_ANDROID
    AndroidController::instance()->startQrReaderActivity();
#endif
}

void ImportUiController::stopDecodingQr()
{
    emit qrDecodingFinished();
}

bool ImportUiController::parseQrCodeChunk(const QString &code)
{
    auto parseResult = m_importController->parseQrCodeChunk(code);
    if (parseResult.success) {
        m_config = parseResult.importResult.config;
        m_configFileName = parseResult.importResult.configFileName;
        m_maliciousWarningText = parseResult.importResult.maliciousWarningText;
        m_isNativeWireGuardConfig = parseResult.importResult.isNativeWireGuardConfig;
        emit importConfigChanged();
        stopDecodingQr();
        return true;
    }
    return false;
}

double ImportUiController::getQrCodeScanProgressBarValue()
{
    const int total = m_importController->qrChunksTotal();
    if (total == 0) {
        return 0.0;
    }
    return (1.0 / total) * m_importController->qrChunksReceived();
}

QString ImportUiController::getQrCodeScanProgressString()
{
    return tr("Scanned %1 of %2.").arg(m_importController->qrChunksReceived()).arg(m_importController->qrChunksTotal());
}
#endif

#if defined Q_OS_ANDROID
bool ImportUiController::decodeQrCode(const QString &code)
{
    QMutexLocker lock(&qrDecodeMutex);

    if (!mInstance) {
        return false;
    }

    if (!mInstance->m_importController->isQrDecodingActive()) {
        mInstance->m_importController->startDecodingQr();
    }
    return mInstance->parseQrCodeChunk(code);
}
#endif

QString ImportUiController::readTextFile(const QString &fileName)
{
    QFile file(fileName);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        return {};
    }
    return QString::fromUtf8(file.readAll());
}

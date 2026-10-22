#ifndef IMPORTUICONTROLLER_H
#define IMPORTUICONTROLLER_H

#include <QObject>

#include "core/controllers/selfhosted/importController.h"

class QNetworkReply;
class SecureAppSettingsRepository;

class ImportUiController : public QObject
{
    Q_OBJECT

    Q_PROPERTY(QString config READ getConfig NOTIFY importConfigChanged)
    Q_PROPERTY(QString configFileName READ getConfigFileName NOTIFY importConfigChanged)
    Q_PROPERTY(QString maliciousWarningText READ getMaliciousWarningText NOTIFY importConfigChanged)
    Q_PROPERTY(bool isNativeWireGuardConfig READ isNativeWireGuardConfig NOTIFY importConfigChanged)
    Q_PROPERTY(bool isFetchingConfig READ isFetchingConfig NOTIFY configUrlFetchChanged)
    Q_PROPERTY(bool isRefreshingSubscription READ isRefreshingSubscription NOTIFY configUrlFetchChanged)

public:
    explicit ImportUiController(ImportController* importController, SecureAppSettingsRepository* appSettingsRepository,
                                QObject *parent = nullptr);

public slots:
    void importConfig();
    void clearConfigFileName();
    bool extractConfigFromFile(const QString &fileName);
    bool extractConfigFromData(QString data);
    bool extractConfigFromUrl(const QString &url);
    bool extractConfigFromQr(const QByteArray &data);
    bool isFetchingConfig();
    bool isRefreshingSubscription();
    void refreshSubscription(const QString &serverId, const QString &url);
    QString getConfig();
    QString getConfigFileName();
    QString getMaliciousWarningText();
    bool isNativeWireGuardConfig();
    void processNativeWireGuardConfig();
    QString readTextFile(const QString &fileName);

#if defined Q_OS_ANDROID || defined Q_OS_IOS
    void startDecodingQr();
    bool parseQrCodeChunk(const QString &code);

    double getQrCodeScanProgressBarValue();
    QString getQrCodeScanProgressString();
#endif

#if defined Q_OS_ANDROID
    static bool decodeQrCode(const QString &code);
#endif

signals:
    void importFinished();
    void importErrorOccurred(ErrorCode errorCode, bool goToPageHome);
    void qrDecodingFinished();
    void restoreAppConfig(const QByteArray &data);
    void importConfigChanged();
    void configUrlFetchChanged();
    void configUrlFetchFinished(bool success);
    void subscriptionRefreshFinished(bool success);
    void subscriptionDeviceLimitReached();
    void subscriptionInvalid();

private:
#if defined Q_OS_ANDROID || defined Q_OS_IOS
    void stopDecodingQr();
#endif

    void handleConfigUrlReply(const QString &url);
    void failConfigUrlFetch();

    ImportController* m_importController;
    SecureAppSettingsRepository* m_appSettingsRepository;
    QNetworkReply* m_configUrlReply = nullptr;
    QString m_refreshServerId;

    QJsonObject m_config;
    QString m_configFileName;
    QString m_maliciousWarningText;
    bool m_isNativeWireGuardConfig;

#if defined Q_OS_ANDROID
    static ImportUiController* mInstance;
#endif
};

#endif // IMPORTUICONTROLLER_H

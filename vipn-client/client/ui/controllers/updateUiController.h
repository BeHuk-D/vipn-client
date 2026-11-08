#ifndef UPDATEUICONTROLLER_H
#define UPDATEUICONTROLLER_H

#include <QObject>

#include "core/controllers/updateController.h"

class UpdateUiController : public QObject
{
    Q_OBJECT

    Q_PROPERTY(QString version READ getVersion NOTIFY updateFound)
    Q_PROPERTY(QString releaseInfoText READ getReleaseInfoText NOTIFY updateFound)
    Q_PROPERTY(QString description READ getDescription NOTIFY updateFound)
    Q_PROPERTY(QString releasePageUrl READ getReleasePageUrl NOTIFY updateFound)

public:
    explicit UpdateUiController(UpdateController* updateController, QObject *parent = nullptr);

    QString getVersion() const;
    QString getReleaseInfoText() const;
    QString getDescription() const;
    QString getReleasePageUrl() const;

public slots:
    void openReleasePage();

signals:
    void updateFound();

private:
    UpdateController* m_updateController;
};

#endif // UPDATEUICONTROLLER_H

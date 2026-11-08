#include "updateUiController.h"

#include <QDate>
#include <QLocale>

UpdateUiController::UpdateUiController(UpdateController* updateController, QObject *parent)
    : QObject(parent), m_updateController(updateController)
{
    if (m_updateController) {
        connect(m_updateController, &UpdateController::updateFound, this, &UpdateUiController::updateFound);
    }
}

QString UpdateUiController::getVersion() const
{
    return m_updateController ? m_updateController->getVersion() : QString();
}

QString UpdateUiController::getReleaseInfoText() const
{
    if (!m_updateController) {
        return QString();
    }

    const QString version = m_updateController->getVersion();
    const QDate releaseDate = QDate::fromString(m_updateController->getReleaseDate(), Qt::ISODate);
    if (!releaseDate.isValid()) {
        return version;
    }

    const QString dateText = QLocale().toString(releaseDate, QStringLiteral("d MMM"));
    return QStringLiteral("%1 · %2").arg(dateText, version);
}

QString UpdateUiController::getDescription() const
{
    return m_updateController ? m_updateController->getDescription() : QString();
}

QString UpdateUiController::getReleasePageUrl() const
{
    return m_updateController ? m_updateController->getReleasePageUrl() : QString();
}

void UpdateUiController::openReleasePage()
{
    if (m_updateController) {
        m_updateController->openReleasePage();
    }
}

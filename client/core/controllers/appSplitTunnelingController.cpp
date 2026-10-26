#include "appSplitTunnelingController.h"

AppSplitTunnelingController::AppSplitTunnelingController(SecureAppSettingsRepository* appSettingsRepository)
    : m_appSettingsRepository(appSettingsRepository)
{
    m_currentRouteMode = m_appSettingsRepository->appsRouteMode();
    if (m_currentRouteMode == AppsRouteMode::VpnAllApps) { // for old split tunneling configs
        m_currentRouteMode = AppsRouteMode::VpnAllExceptApps;
    }
#ifdef Q_OS_WIN
    if (m_currentRouteMode == AppsRouteMode::VpnOnlyForwardApps) {
        m_currentRouteMode = AppsRouteMode::VpnAllExceptApps;
    }
#endif
    m_apps = m_appSettingsRepository->vpnApps(m_currentRouteMode);
    m_appSettingsRepository->setAppsRouteMode(m_currentRouteMode);
}

bool AppSplitTunnelingController::addApp(const amnezia::InstalledAppInfo &appInfo)
{
    if (m_apps.contains(appInfo)) {
        return false;
    }

    m_apps.append(appInfo);
    m_appSettingsRepository->setVpnApps(m_currentRouteMode, m_apps);

    return true;
}

void AppSplitTunnelingController::removeApp(int index)
{
    if (index < 0 || index >= m_apps.size()) {
        return;
    }

    m_apps.removeAt(index);
    m_appSettingsRepository->setVpnApps(m_currentRouteMode, m_apps);
}

void AppSplitTunnelingController::clearAppsList()
{
    m_apps.clear();
    m_appSettingsRepository->setVpnApps(m_currentRouteMode, m_apps);
}

void AppSplitTunnelingController::setRouteMode(AppsRouteMode routeMode)
{
#ifdef Q_OS_WIN
    if (routeMode == AppsRouteMode::VpnOnlyForwardApps) {
        routeMode = AppsRouteMode::VpnAllExceptApps;
    }
#endif
    m_currentRouteMode = routeMode;
    m_apps = m_appSettingsRepository->vpnApps(m_currentRouteMode);
    m_appSettingsRepository->setAppsRouteMode(routeMode);
}

void AppSplitTunnelingController::toggleSplitTunneling(bool enabled)
{
    m_appSettingsRepository->setAppsSplitTunnelingEnabled(enabled);
}

AppsRouteMode AppSplitTunnelingController::getRouteMode() const
{
    return m_currentRouteMode;
}

bool AppSplitTunnelingController::isSplitTunnelingEnabled() const
{
    return m_appSettingsRepository->isAppsSplitTunnelingEnabled();
}

QVector<amnezia::InstalledAppInfo> AppSplitTunnelingController::getApps() const
{
    return m_apps;
}


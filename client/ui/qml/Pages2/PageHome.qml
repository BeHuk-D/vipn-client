import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import PageEnum 1.0
import Style 1.0

import "./"
import "../Controls2"
import "../Controls2/TextTypes"
import "../Config"
import "../Components"

PageType {
    id: root

    property bool autoRefreshDone: false
    property bool manualRefresh: false

    readonly property string subscriptionUrl: ServersUiController.defaultServerSubscriptionUrl
    readonly property string expiresAt: ServersUiController.defaultServerSubscriptionExpiresAt
    readonly property bool hasSubscription: ServersUiController.getServersCount() > 0

    function formatExpiry(value) {
        if (!value) {
            return ""
        }
        const date = new Date(value)
        if (isNaN(date.getTime())) {
            return ""
        }
        return Qt.formatDate(date, "dd.MM.yyyy")
    }

    function refreshSubscription(manual) {
        if (ServersUiController.defaultServerSubscriptionUrl === "") {
            PageController.showNotificationMessage(qsTr("Subscription link is missing"))
            return
        }
        root.manualRefresh = manual === true
        ImportController.refreshSubscription(ServersUiController.defaultServerId,
                                             ServersUiController.defaultServerSubscriptionUrl)
    }

    function measurePing() {
        if (ConnectionController.isConnected) {
            PingController.ping(ServersUiController.defaultServerDns, 53)
        } else {
            PingController.ping(ServersUiController.defaultServerHost, 443)
        }
    }

    function openReplace() {
        if (ConnectionController.isConnected) {
            PageController.showNotificationMessage(qsTr("Disconnect before replacing the subscription"))
            return
        }
        PageController.goToPage(PageEnum.PageSetupWizardConfigSource)
    }

    Component.onCompleted: {
        if (!root.hasSubscription) {
            PageController.goToPageHome()
            return
        }
        Qt.callLater(root.measurePing)
        if (!root.autoRefreshDone && root.subscriptionUrl !== "" && !ConnectionController.isConnected) {
            root.autoRefreshDone = true
            Qt.callLater(function() { root.refreshSubscription(false) })
        }
    }

    Connections {
        target: ServersModel

        function onModelReset() {
            if (!root.hasSubscription) {
                PageController.goToPageHome()
            }
        }
    }

    Connections {
        target: ImportController

        function onSubscriptionRefreshFinished(success) {
            if (success) {
                PageController.showNotificationMessage(qsTr("Subscription updated"))
            } else if (root.manualRefresh) {
                PageController.showNotificationMessage(qsTr("Could not update the subscription"))
            }
            root.manualRefresh = false
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: 8 + PageController.safeAreaTopMargin
        anchors.bottomMargin: 16 + PageController.safeAreaBottomMargin
        anchors.leftMargin: 16
        anchors.rightMargin: 16

        spacing: 0

        RowLayout {
            Layout.fillWidth: true

            spacing: 8

            BodyTextType {
                Layout.fillWidth: true

                text: qsTr("ViPN")
                color: AmneziaStyle.color.textPrimary
                font.pixelSize: 22
                font.weight: 600
            }

            IconButtonType {
                size: IconButtonType.Small
                icon.source: "qrc:/images/controls/settings.svg"
                Accessible.name: qsTr("Settings")

                onClicked: PageController.goToPageSettings()
            }
        }

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.topMargin: 8
            Layout.bottomMargin: 16

            ConnectButton {
                id: connectButton
                objectName: "connectButton"

                anchors.centerIn: parent
                width: Math.min(implicitWidth, parent.width, parent.height)
                height: width
            }
        }

        SubscriptionCard {
            Layout.fillWidth: true

            visible: root.hasSubscription

            serverName: ServersUiController.defaultServerName
            countryCode: ServersUiController.defaultServerCountryCode
            countryName: ServersUiController.defaultServerCountryName
            expiresAtText: root.formatExpiry(root.expiresAt)
            daysLeft: ServersUiController.defaultServerDaysLeft
            isExpired: ServersUiController.isServerSubscriptionExpired(ServersUiController.defaultServerId)
            isExpiringSoon: ServersUiController.isServerSubscriptionExpiringSoon(ServersUiController.defaultServerId)
            isRefreshing: ImportController.isRefreshingSubscription

            onRefreshRequested: root.refreshSubscription(true)
            onReplaceRequested: root.openReplace()
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.topMargin: 10

            spacing: 8

            visible: root.hasSubscription

            SmallTextType {
                Layout.fillWidth: true

                text: PingController.isPinging
                      ? qsTr("Measuring latency…")
                      : (PingController.pingMs >= 0
                         ? qsTr("Latency: %1 ms").arg(PingController.pingMs)
                         : qsTr("Latency not measured"))
                color: AmneziaStyle.color.textTertiary
            }

            ButtonType {
                variant: ButtonType.Text
                size: ButtonType.Medium

                enabled: !PingController.isPinging

                text: PingController.isPinging ? qsTr("Measuring") : qsTr("Check")

                onClicked: root.measurePing()
            }
        }
    }

    Connections {
        target: ConnectionController

        function onConnectionStateChanged() {
            if (root.hasSubscription) {
                Qt.callLater(root.measurePing)
            }
        }
    }
}

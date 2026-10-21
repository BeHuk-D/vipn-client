import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import PageEnum 1.0
import Style 1.0

import "./"
import "../Controls2"
import "../Controls2/TextTypes"
import "../Config"

PageType {
    id: root

    readonly property string expiresAt: ServersUiController.defaultServerSubscriptionExpiresAt
    readonly property int daysLeft: ServersUiController.defaultServerDaysLeft
    readonly property bool isExpired: ServersUiController.isServerSubscriptionExpired(ServersUiController.defaultServerId)
    readonly property bool isExpiringSoon: ServersUiController.isServerSubscriptionExpiringSoon(ServersUiController.defaultServerId)

    function formatExpiry(value) {
        if (!value) {
            return "—"
        }
        const date = new Date(value)
        if (isNaN(date.getTime())) {
            return "—"
        }
        return Qt.formatDate(date, "dd.MM.yyyy")
    }

    function statusText() {
        if (root.isExpired) {
            return qsTr("Subscription expired")
        }
        if (root.daysLeft === 0) {
            return qsTr("Expires today")
        }
        if (root.daysLeft > 0) {
            return qsTr("%n day(s) left", "", root.daysLeft)
        }
        return qsTr("Expiration date unknown")
    }

    function refreshSubscription() {
        if (ServersUiController.defaultServerSubscriptionUrl === "") {
            PageController.showNotificationMessage(qsTr("Subscription link is missing"))
            return
        }
        ImportController.refreshSubscription(ServersUiController.defaultServerId,
                                             ServersUiController.defaultServerSubscriptionUrl)
    }

    Connections {
        target: ImportController

        function onSubscriptionRefreshFinished(success) {
            if (success) {
                PageController.showNotificationMessage(qsTr("Subscription updated"))
            } else {
                PageController.showNotificationMessage(qsTr("Could not update the subscription"))
            }
        }
    }

    ColumnLayout {
        anchors.fill: parent

        spacing: 0

        NavigationBarType {
            Layout.fillWidth: true

            title: qsTr("Subscription")
        }

        FlickableType {
            Layout.fillWidth: true
            Layout.fillHeight: true

            contentHeight: content.implicitHeight + 32

            ColumnLayout {
                id: content

                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right

                spacing: 0

                SubscriptionCard {
                    Layout.fillWidth: true
                    Layout.topMargin: 8
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16

                    serverName: ServersUiController.defaultServerName
                    countryCode: ServersUiController.defaultServerCountryCode
                    countryName: ServersUiController.defaultServerCountryName
                    expiresAtText: root.formatExpiry(root.expiresAt)
                    daysLeft: root.daysLeft
                    isExpired: root.isExpired
                    isExpiringSoon: root.isExpiringSoon
                    isRefreshing: ImportController.isRefreshingSubscription

                    onRefreshRequested: root.refreshSubscription()
                    onReplaceRequested: PageController.goToPage(PageEnum.PageSetupWizardConfigSource)
                }

                ButtonType {
                    Layout.fillWidth: true
                    Layout.topMargin: 24
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16

                    variant: ButtonType.Secondary
                    loading: ImportController.isRefreshingSubscription

                    text: qsTr("Refresh subscription")

                    onClicked: root.refreshSubscription()
                }

                ButtonType {
                    Layout.fillWidth: true
                    Layout.topMargin: 8
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16

                    variant: ButtonType.Secondary

                    text: qsTr("Replace subscription")

                    onClicked: PageController.goToPage(PageEnum.PageSetupWizardConfigSource)
                }

                ButtonType {
                    Layout.fillWidth: true
                    Layout.topMargin: 8
                    Layout.leftMargin: 16
                    Layout.rightMargin: 16

                    variant: ButtonType.Text
                    destructive: true

                    text: qsTr("Remove subscription")

                    onClicked: removeDialog.open()
                }
            }
        }
    }

    AlertDialogType {
        id: removeDialog

        headerText: qsTr("Remove subscription?")
        descriptionText: qsTr("The app will disconnect and forget the current subscription. You can add it again with the same link.")
        confirmButtonText: qsTr("Remove")
        role: AlertDialogType.Destructive

        onConfirmed: {
            if (ConnectionController.isConnected) {
                ConnectionController.closeConnection()
            }
            ServersUiController.removeServer(ServersUiController.defaultServerId)
            PageController.goToPageHome()
        }
    }
}

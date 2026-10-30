import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import Style 1.0

import "../Controls2"
import "../Controls2/TextTypes"

Rectangle {
    id: root

    property string countryCode
    property string countryName
    property string expiresAtText
    property int daysLeft: -1
    property bool isExpired: false
    property bool isExpiringSoon: false
    property bool isRefreshing: false

    property bool serversExpanded: false
    readonly property bool canSwitchServer: {
        const serverId = ServersUiController.defaultServerId
        return serverId !== "" && ServersUiController.subscriptionServersCount() > 1
    }
    readonly property int pingRevision: PingController.revision

    signal refreshRequested()
    signal replaceRequested()
    signal pingRequested()
    signal serverSelected(string serverId)

    readonly property string statusText: {
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

    function pingText(serverId) {
        const revision = root.pingRevision
        if (!serverId || revision < 0) {
            return ""
        }
        if (PingController.isServerPingPending(serverId)) {
            return qsTr("…")
        }
        const value = PingController.serverPingMs(serverId)
        return value >= 0 ? qsTr("%1 ms").arg(value) : "—"
    }

    implicitHeight: content.implicitHeight + 32

    radius: 16
    color: AmneziaStyle.color.bgSurface
    border.width: 1
    border.color: root.isExpired ? AmneziaStyle.color.borderMedium : AmneziaStyle.color.borderSoft

    ColumnLayout {
        id: content

        anchors.fill: parent
        anchors.margins: 16

        spacing: 0

        Item {
            Layout.fillWidth: true
            implicitHeight: 36

            Rectangle {
                anchors.fill: parent
                radius: 10
                color: AmneziaStyle.color.bgStateLayer
                visible: root.canSwitchServer && headerMouse.containsMouse
            }

            RowLayout {
                anchors.centerIn: parent
                width: Math.min(implicitWidth, root.width - 140)

                spacing: 8

                Image {
                    width: 20
                    height: 15
                    fillMode: Image.PreserveAspectFit
                    source: root.countryCode !== ""
                            ? "qrc:/countriesFlags/images/flagKit/" + root.countryCode + ".svg"
                            : ""
                    visible: root.countryCode !== ""
                }

                BodyTextType {
                    Layout.maximumWidth: root.width - 168

                    text: root.countryName
                    color: AmneziaStyle.color.textPrimary
                    wrapMode: Text.NoWrap
                    elide: Text.ElideRight
                }
            }

            RowLayout {
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter

                Image {
                    width: 16
                    height: 16
                    fillMode: Image.PreserveAspectFit
                    visible: root.canSwitchServer

                    source: "qrc:/images/controls/chevron-down.svg"
                    rotation: root.serversExpanded ? 180 : 0

                    Behavior on rotation {
                        NumberAnimation {
                            duration: 140
                            easing.type: Easing.OutCubic
                        }
                    }
                }
            }

            MouseArea {
                id: headerMouse

                anchors.fill: parent
                hoverEnabled: true
                cursorShape: root.canSwitchServer ? Qt.PointingHandCursor : Qt.ArrowCursor

                onClicked: {
                    if (root.canSwitchServer) {
                        root.serversExpanded = !root.serversExpanded
                    } else {
                        root.pingRequested()
                    }
                }
            }
        }

        Loader {
            Layout.fillWidth: true
            Layout.topMargin: root.serversExpanded ? 10 : 0

            active: root.serversExpanded
            visible: root.serversExpanded

            sourceComponent: serverList
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: 14

            height: 1
            color: AmneziaStyle.color.borderFaint
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.topMargin: 14

            spacing: 2

            BodyTextType {
                Layout.fillWidth: true

                text: root.expiresAtText !== ""
                      ? qsTr("Valid until %1").arg(root.expiresAtText)
                      : qsTr("No expiration date")
                color: AmneziaStyle.color.textSecondary
                elide: Text.ElideRight
                wrapMode: Text.NoWrap
            }

            SmallTextType {
                Layout.fillWidth: true

                text: root.statusText
                color: root.isExpired || root.isExpiringSoon
                       ? AmneziaStyle.color.textPrimary
                       : AmneziaStyle.color.textTertiary
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.topMargin: 14

            spacing: 8

            ButtonType {
                Layout.fillWidth: true

                variant: ButtonType.Secondary
                size: ButtonType.Medium
                loading: root.isRefreshing
                enabled: !root.isRefreshing

                text: root.isRefreshing ? qsTr("Refreshing") : qsTr("Refresh")

                onClicked: root.refreshRequested()
            }

            ButtonType {
                Layout.fillWidth: true

                variant: root.isExpired ? ButtonType.Primary : ButtonType.Secondary
                size: ButtonType.Medium

                text: qsTr("Replace")

                onClicked: root.replaceRequested()
            }
        }
    }

    Component {
        id: serverList

        ColumnLayout {
            spacing: 0

            Repeater {
                id: serverRepeater

                model: ServersModel

                delegate: Item {
                    id: serverRow

                    Layout.fillWidth: true
                    implicitHeight: 44

                    visible: !isDefault && ServersUiController.isSameSubscription(serverId)

                    Rectangle {
                        anchors.fill: parent
                        radius: 10
                        color: AmneziaStyle.color.bgStateLayer
                        visible: rowMouse.containsMouse
                    }

                    RowLayout {
                        anchors.centerIn: parent

                        spacing: 8

                        Image {
                            width: 20
                            height: 15
                            fillMode: Image.PreserveAspectFit
                            source: ServersUiController.serverCountryCode(serverId) !== ""
                                    ? "qrc:/countriesFlags/images/flagKit/" + ServersUiController.serverCountryCode(serverId) + ".svg"
                                    : ""
                            visible: ServersUiController.serverCountryCode(serverId) !== ""
                        }

                        BodyTextType {
                            text: ServersUiController.serverCountryName(serverId)
                            color: AmneziaStyle.color.textPrimary
                            wrapMode: Text.NoWrap
                        }
                    }

                    BodyTextType {
                        anchors.right: parent.right
                        anchors.rightMargin: 8
                        anchors.verticalCenter: parent.verticalCenter

                        text: root.pingText(serverId)
                        color: AmneziaStyle.color.textTertiary
                        wrapMode: Text.NoWrap
                    }

                    MouseArea {
                        id: rowMouse

                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor

                        onClicked: {
                            root.serversExpanded = false
                            root.serverSelected(serverId)
                        }
                    }

                    Component.onCompleted: {
                        if (serverRow.visible) {
                            PingController.pingServer(serverId, ServersUiController.serverHostName(serverId), 443)
                        }
                    }
                }
            }
        }
    }
}

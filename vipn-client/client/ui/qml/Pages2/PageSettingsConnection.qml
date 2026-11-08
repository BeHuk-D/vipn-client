import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import PageEnum 1.0
import Style 1.0

import "./"
import "../Controls2"
import "../Config"

PageType {
    id: root

    FlickableType {
        id: flickable

        anchors.top: parent.top

        contentHeight: content.implicitHeight

        ColumnLayout {
            id: content

            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right

            spacing: 0

            NavigationBarType {
                Layout.fillWidth: true

                title: qsTr("Connection")
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.topMargin: 16
                Layout.leftMargin: 16
                Layout.rightMargin: 16
                Layout.bottomMargin: 16 + PageController.safeAreaBottomMargin

                spacing: 0

                ListItemType {
                    id: dnsServersButton

                    Layout.fillWidth: true

                    text: qsTr("DNS servers")
                    subtitle: qsTr("Resolvers used while the VPN is on")
                    trailingIconSource: "qrc:/images/controls/chevron-right.svg"

                    onClicked: {
                        PageController.goToPage(PageEnum.PageSettingsDns)
                    }
                }

                ListItemType {
                    id: killSwitchButton

                    Layout.fillWidth: true

                    visible: !GC.isMobile()

                    text: qsTr("KillSwitch")
                    subtitle: qsTr("Blocks network connections without VPN")
                    trailingIconSource: "qrc:/images/controls/chevron-right.svg"

                    onClicked: {
                        PageController.goToPage(PageEnum.PageSettingsKillSwitch)
                    }
                }
            }
        }
    }
}

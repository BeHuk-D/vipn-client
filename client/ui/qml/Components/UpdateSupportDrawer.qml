import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import Style 1.0

import "../Controls2"
import "../Controls2/TextTypes"
import "../Config"

SheetType {
    id: root

    expandedHeight: content.implicitHeight + 16 + PageController.safeAreaBottomMargin

    Item {
        id: contentRoot
        anchors.fill: parent

        ColumnLayout {
            id: content

            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.topMargin: 12
            spacing: 0

            SectionHeaderType {
                Layout.fillWidth: true
                Layout.leftMargin: 16
                Layout.rightMargin: 16
                Layout.bottomMargin: 32

                headerText: qsTr("Support")
                descriptionText: qsTr("If the update won't install, message us")
            }

            ListItemType {
                Layout.fillWidth: true
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                visible: ViPNBrand.telegramUrl !== ""
                leadingSlotWidth: 24
                text: qsTr("Telegram")
                subtitle: qsTr("We'll reply in chat")
                icon.source: "qrc:/images/controls/telegram.svg"
                trailingIconSource: "qrc:/images/controls/chevron-right.svg"

                onClicked: {
                    Qt.openUrlExternally(ViPNBrand.telegramUrl)
                }
            }

            ListItemType {
                Layout.fillWidth: true
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                visible: ViPNBrand.supportEmail !== ""
                leadingSlotWidth: 24
                text: ViPNBrand.supportEmail
                subtitle: qsTr("Support email")
                icon.source: "qrc:/images/controls/mail.svg"
                trailingIconSource: "qrc:/images/controls/chevron-right.svg"

                onClicked: {
                    Qt.openUrlExternally("mailto:" + ViPNBrand.supportEmail)
                }
            }

            ListItemType {
                Layout.fillWidth: true
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                visible: ViPNBrand.websiteUrl !== ""
                leadingSlotWidth: 24
                showSeparator: false
                text: ViPNBrand.websiteUrl
                subtitle: qsTr("Download the update manually")
                icon.source: "qrc:/images/controls/vipn.svg"
                trailingIconSource: "qrc:/images/controls/chevron-right.svg"

                onClicked: {
                    Qt.openUrlExternally(ViPNBrand.websiteUrl)
                }
            }
        }
    }
}

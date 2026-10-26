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

    Rectangle {
        anchors.fill: parent
        color: AmneziaStyle.color.bgBase
    }

    NavigationBarType {
        id: navigationBar

        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right

        title: qsTr("Update")
    }

    FlickableType {
        id: fl

        anchors.top: navigationBar.bottom
        anchors.bottom: bottomBar.top
        contentHeight: content.implicitHeight + 16 + 32

        ColumnLayout {
            id: content

            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.topMargin: 16
            anchors.leftMargin: 16
            anchors.rightMargin: 16
            spacing: 24

            ColumnLayout {
                id: headerBlock

                Layout.fillWidth: true
                spacing: 12

                Rectangle {
                    id: imageBlock

                    Layout.fillWidth: true
                    Layout.preferredHeight: 98

                    radius: 16
                    color: AmneziaStyle.color.bgSurfaceAlt
                    border.width: 1
                    border.color: AmneziaStyle.color.borderSoft

                    DisplayTextType {
                        anchors.centerIn: parent

                        text: "v. " + UpdateController.version
                    }
                }

                SmallTextType {
                    Layout.fillWidth: true

                    text: UpdateController.releaseInfoText
                }
            }

            ColumnLayout {
                id: changelogBlock

                Layout.fillWidth: true
                spacing: 12

                H1TextType {
                    Layout.fillWidth: true

                    text: qsTr("New version available")
                }

                BodyTextType {
                    Layout.fillWidth: true

                    visible: UpdateController.description !== ""

                    color: AmneziaStyle.color.textSecondary

                    text: UpdateController.description
                    wrapMode: Text.Wrap
                }

                SmallTextType {
                    Layout.fillWidth: true

                    text: qsTr("Download the new version from the releases page")
                }
            }
        }
    }

    BottomBarType {
        id: bottomBar

        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.right: parent.right

        filled: true

        ButtonType {
            Layout.fillWidth: true

            text: qsTr("Open GitHub")

            onClicked: UpdateController.openReleasePage()
        }
    }
}

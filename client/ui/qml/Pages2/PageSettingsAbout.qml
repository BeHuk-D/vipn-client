import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window

import PageEnum 1.0
import Style 1.0

import "./"
import "../Controls2"
import "../Config"
import "../Controls2/TextTypes"
import "../Components"

PageType {
    id: root

    Connections {
        target: UpdateController

        function onUpdateNotFound() {
            PageController.showNotificationMessage(qsTr("You have the latest version of ViPN"))
        }

        function onUpdateCheckFailed() {
            PageController.showNotificationMessage(qsTr("Failed to check for updates"))
        }
    }

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
            }

            Image {
                id: image

                Layout.alignment: Qt.AlignHCenter
                Layout.preferredWidth: 153
                Layout.preferredHeight: 131

                source: "qrc:/images/vipnLogo.png"
                sourceSize: Qt.size(153 * Screen.devicePixelRatio, 131 * Screen.devicePixelRatio)
                fillMode: Image.PreserveAspectFit
            }

            H1TextType {
                Layout.fillWidth: true
                Layout.topMargin: 12
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                horizontalAlignment: Text.AlignHCenter
                text: qsTr("Support ViPN")
            }

            BodyTextType {
                Layout.fillWidth: true
                Layout.topMargin: 8
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                horizontalAlignment: Text.AlignHCenter
                color: AmneziaStyle.color.textSecondary
                text: qsTr("ViPN is a free and open-source application. You can support the developers if you like it.")
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.topMargin: 32
                Layout.leftMargin: 16
                Layout.rightMargin: 16
                Layout.bottomMargin: 16 + PageController.safeAreaBottomMargin

                spacing: 24

                ColumnLayout {
                    Layout.fillWidth: true

                    spacing: 12

                    visible: telegramGroup.isVisible || mail.isVisible || github.isVisible || website.isVisible

                    BodyTextType {
                        Layout.fillWidth: true

                        color: AmneziaStyle.color.textTertiary
                        text: qsTr("Contacts")
                    }

                    ColumnLayout {
                        Layout.fillWidth: true

                        spacing: 0

                        Repeater {
                            model: contacts

                            delegate: ListItemType {
                                Layout.fillWidth: true

                                visible: isVisible
                                text: title
                                subtitle: description
                                icon.source: imageSource

                                onClicked: handler()
                            }
                        }
                    }
                }

                ColumnLayout {
                    Layout.alignment: Qt.AlignHCenter
                    Layout.maximumWidth: content.width - 32

                    spacing: 12

                    RowLayout {
                        Layout.alignment: Qt.AlignHCenter

                        spacing: 4

                        CaptionTextType {
                            text: SettingsController.getAppVersion()

                            MouseArea {
                                property int clickCount: 0
                                anchors.fill: parent
                                onClicked: {
                                    if (clickCount > 10) {
                                        SettingsController.enableDevMode()
                                    } else {
                                        clickCount++
                                    }
                                }
                            }
                        }

                        IconButtonType {
                            size: IconButtonType.Small
                            icon.source: "qrc:/images/controls/copy.svg"
                            Accessible.name: qsTr("Copy version")

                            onClicked: {
                                GC.copyToClipBoard(SettingsController.getAppVersion())
                                PageController.showNotificationMessage(qsTr("Copied"))
                            }
                        }
                    }

                    ButtonType {
                        id: checkUpdatesButton

                        Layout.alignment: Qt.AlignHCenter
                        Layout.preferredWidth: Math.max(220, implicitWidth)
                        Layout.maximumWidth: content.width - 32

                        visible: ViPNBrand.appUpdatesEnabled
                        variant: ButtonType.Secondary
                        loading: UpdateController.isCheckRunning
                        enabled: !UpdateController.isCheckRunning

                        text: UpdateController.isCheckRunning ? qsTr("Checking...") : qsTr("Check for updates")

                        onClicked: {
                            UpdateController.checkForUpdates()
                        }
                    }

                    ButtonType {
                        id: privacyPolicyButton

                        Layout.alignment: Qt.AlignHCenter

                        visible: ViPNBrand.privacyPolicyUrl !== ""
                        variant: ButtonType.Text
                        text: qsTr("Privacy Policy")

                        onClicked: {
                            Qt.openUrlExternally(ViPNBrand.privacyPolicyUrl)
                        }
                    }
                }
            }
        }
    }

    property list<QtObject> contacts: [
        telegramGroup,
        mail,
        github,
        website
    ]

    QtObject {
        id: telegramGroup

        readonly property bool isVisible: ViPNBrand.telegramUrl !== ""
        readonly property string title: qsTr("Telegram group")
        readonly property string description: qsTr("To discuss features")
        readonly property string imageSource: "qrc:/images/controls/telegram.svg"
        readonly property var handler: function() {
            Qt.openUrlExternally(ViPNBrand.telegramUrl)
        }
    }

    QtObject {
        id: mail

        readonly property bool isVisible: ViPNBrand.supportEmail !== ""
        readonly property string title: ViPNBrand.supportEmail
        readonly property string description: qsTr("For reviews and bug reports")
        readonly property string imageSource: "qrc:/images/controls/mail.svg"
        readonly property var handler: function() {
            Qt.openUrlExternally("mailto:" + ViPNBrand.supportEmail)
        }
    }

    QtObject {
        id: github

        readonly property bool isVisible: ViPNBrand.githubUrl !== ""
        readonly property string title: qsTr("GitHub")
        readonly property string description: qsTr("Discover the source code")
        readonly property string imageSource: "qrc:/images/controls/github.svg"
        readonly property var handler: function() {
            Qt.openUrlExternally(ViPNBrand.githubUrl)
        }
    }

    QtObject {
        id: website

        readonly property bool isVisible: ViPNBrand.websiteUrl !== ""
        readonly property string title: qsTr("Website")
        readonly property string description: qsTr("Visit official website")
        readonly property string imageSource: "qrc:/images/controls/vipn.svg"
        readonly property var handler: function() {
            Qt.openUrlExternally(ViPNBrand.websiteUrl)
        }
    }
}

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

    property string errorText
    property string previousServerId

    readonly property bool isReplacing: ServersUiController.getServersCount() > 0

    function submit() {
        const link = linkField.textField.text.trim()
        if (link === "") {
            return
        }

        errorText = ""

        if (link.startsWith("http://")) {
            errorText = qsTr("Subscription links must use https")
            return
        }
        if (!link.startsWith("https://")) {
            errorText = qsTr("Paste the subscription link you received")
            return
        }

        previousServerId = isReplacing ? ServersUiController.defaultServerId : ""
        ImportController.extractConfigFromUrl(link)
    }

    Connections {
        target: ImportController

        function onConfigUrlFetchFinished(success) {
            if (success) {
                ImportController.importConfig()
            } else {
                root.errorText = qsTr("Could not load the subscription. Check the link and try again.")
            }
        }

        function onImportFinished() {
            const previous = root.previousServerId
            root.previousServerId = ""

            if (previous !== "" && previous !== ServersUiController.defaultServerId) {
                ServersUiController.removeServer(previous)
            }

            root.errorText = ""
            linkField.textField.text = ""
            PageController.goToPageHome()
        }
    }

    FlickableType {
        anchors.fill: parent

        contentHeight: content.implicitHeight + 32

        ColumnLayout {
            id: content

            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right

            spacing: 0

            NavigationBarType {
                Layout.fillWidth: true

                title: qsTr("ViPN")
                description: qsTr("Subscription")
                backButtonVisible: root.isReplacing
            }

            Item {
                Layout.fillWidth: true
                Layout.preferredHeight: 24
            }

            BodyTextType {
                Layout.fillWidth: true
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                text: qsTr("Paste the subscription link")
                color: AmneziaStyle.color.textPrimary
                font.pixelSize: 20
                font.weight: 500
            }

            SmallTextType {
                Layout.fillWidth: true
                Layout.topMargin: 6
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                text: qsTr("The link is issued by the ViPN service after payment.")
            }

            TextFieldType {
                id: linkField

                Layout.fillWidth: true
                Layout.topMargin: 20
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                headerText: qsTr("Subscription link")
                placeholderText: "https://"
            }

            Connections {
                target: linkField.textField

                function onAccepted() {
                    root.submit()
                }
            }

            SmallTextType {
                Layout.fillWidth: true
                Layout.topMargin: 8
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                visible: root.errorText !== ""

                text: root.errorText
                color: AmneziaStyle.color.textPrimary
            }

            ButtonType {
                Layout.fillWidth: true
                Layout.topMargin: 16
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                enabled: !ImportController.isFetchingConfig
                loading: ImportController.isFetchingConfig

                text: ImportController.isFetchingConfig ? qsTr("Checking subscription") : qsTr("Connect")

                onClicked: root.submit()
            }

            SmallTextType {
                Layout.fillWidth: true
                Layout.topMargin: 12
                Layout.leftMargin: 16
                Layout.rightMargin: 16

                visible: root.isReplacing

                text: qsTr("The current subscription will be removed after the new one is added.")
            }
        }
    }
}

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

    signal refreshRequested()
    signal replaceRequested()

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

        RowLayout {
            Layout.fillWidth: true
            Layout.alignment: Qt.AlignHCenter

            spacing: 8

            visible: root.countryName !== ""

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
                text: root.countryName
                color: AmneziaStyle.color.textPrimary
                wrapMode: Text.NoWrap
            }
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
}

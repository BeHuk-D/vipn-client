pragma Singleton

import QtQuick

QtObject {
    property QtObject color: QtObject {
        readonly property color transparent: 'transparent'

        readonly property color textPrimary: '#FFFFFF'
        readonly property color textSecondary: '#F4F4F5'
        readonly property color textTertiary: '#A1A1AA'
        readonly property color textQuaternary: '#71717A'
        readonly property color textInverted: '#000000'
        readonly property color textAccent: '#FFFFFF'
        readonly property color textStaticWhite: '#FFFFFF'

        readonly property color bgBase: '#000000'
        readonly property color bgSurface: '#0A0A0B'
        readonly property color bgSurfaceAlt: '#141416'
        readonly property color bgSheet: '#141416'
        readonly property color bgPanel: '#1E1E21'
        readonly property color bgPanelAlt: '#26262A'
        readonly property color bgOverlay: '#B3000000'
        readonly property color bgStateLayer: '#14FFFFFF'
        readonly property color bgStateLayerPressed: '#1FFFFFFF'
        readonly property color bgStateLayerAccent: '#1FFFFFFF'
        readonly property color bgSurfaceInverse: '#F4F4F5'
        readonly property color bgSurfaceInverseAlt: '#E4E4E7'
        readonly property color bgControlTrack: '#1E1E21'
        readonly property color bgField: '#141416'
        readonly property color bgSelected: '#1E1E21'
        readonly property color bgAccentSubtle: '#26FFFFFF'
        readonly property color bgStaticWhite: '#FFFFFF'

        readonly property color bgAction: '#FFFFFF'
        readonly property color bgActionHover: '#E4E4E7'
        readonly property color bgActionPress: '#A1A1AA'

        readonly property color borderFaint: '#1F1F22'
        readonly property color borderSoft: '#2A2A2E'
        readonly property color borderMedium: '#3F3F46'
        readonly property color borderBold: '#71717A'
        readonly property color borderEmphasis: '#E4E4E7'
        readonly property color borderAccent: '#FFFFFF'
        readonly property color borderField: '#3F3F46'
        readonly property color borderFocus: '#FFFFFF'

        readonly property color accentLight: '#FFFFFF'
        readonly property color accentDefault: '#FFFFFF'
        readonly property color accentDark: '#A1A1AA'
        readonly property color accentDeep: '#3F3F46'

        readonly property color statusDestructive: '#D4D4D8'
        readonly property color statusWarning: '#A1A1AA'
        readonly property color statusSuccess: '#FFFFFF'

        readonly property color promoRecommendation: '#E4E4E7'
        readonly property color promoUpdate: '#A1A1AA'
        readonly property color promoOverlay: '#14FFFFFF'
        readonly property color promoPink: '#A1A1AA'
        readonly property color promoPinkDeep: '#3F3F46'

        readonly property color iconDefault: '#E4E4E7'
        readonly property color iconSecondary: '#A1A1AA'
        readonly property color iconTertiary: '#3F3F46'
        readonly property color iconInverted: '#000000'

        readonly property color shadowLayer1: '#66000000'
        readonly property color shadowLayer2: '#99000000'
        readonly property color shadowGlow: '#FFFFFF'
    }
}

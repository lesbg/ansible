// import QtQuick 1.0 // to target S60 5th Edition or Maemo 5
import QtQuick 1.1

Item {
    id: manager
    property Item activeScreen
    property Component delegate

    Repeater {
        id: repeater
        model: screensModel
        delegate : delegateItem
    }

    Component.onCompleted: {
        activeScreen = manager.children[0]
    }

    Component {
        id: delegateItem

        Item {
            x: geometry.x
            width: geometry.width
            y: geometry.y
            height: geometry.height
            
            MouseArea {
                id: mouseArea
                anchors.fill: parent
                hoverEnabled: true
                onEntered: {
                    screenManager.activeScreen = parent
                }
            }

            Loader {
                sourceComponent: manager.delegate
                anchors.fill: parent
            }
        }
    }
}

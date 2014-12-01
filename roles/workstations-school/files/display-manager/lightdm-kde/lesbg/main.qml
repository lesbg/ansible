/*
This file is part of LightDM-KDE.

Copyright 2011, 2012 David Edmundson <kde@davidedmundson.co.uk>

LightDM-KDE is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

LightDM-KDE is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with LightDM-KDE.  If not, see <http://www.gnu.org/licenses/>.
*/
import QtQuick 1.0
//TODO phase this out
import org.kde.plasma.graphicswidgets 0.1 as PlasmaWidgets
import org.kde.plasma.components 0.1 as PlasmaComponents
import org.kde.qtextracomponents 0.1 as ExtraComponents
import org.kde.plasma.core 0.1 as PlasmaCore

Item {
    width: screenSize.width;
    height: screenSize.height;

    ScreenManager {
        id: screenManager
        delegate: Image {
            // default to keeping aspect ratio
            fillMode: config.readEntry("BackgroundKeepAspectRatio") == false ? Image.Stretch : Image.PreserveAspectCrop;
            //read from config, if there's no entry use plasma theme
            source: config.readEntry("Background") ? config.readEntry("Background"): plasmaTheme.wallpaperPath(Qt.size(width,height));
        }
    }

    Item { //recreate active screen at a sibling level which we can anchor in.
        id: activeScreen
        x: screenManager.activeScreen.x
        y: screenManager.activeScreen.y
        width: screenManager.activeScreen.width
        height: screenManager.activeScreen.height
    }


    Connections {
        target: greeter;
        onShowPrompt: {
            if(text == "Password: ") {
                greeter.respond(passwordInput.text)
            } else if(text.toLowerCase() == "current password: ") {
                greeter.respond(passwordInput.text)
            } else if(text.toLowerCase() == "new password: ") {
                show_change();
            } else if(text.toLowerCase() == "retype new password: " || text.toLowerCase() == "reenter new password: ") {
                greeter.respond(confirmInput.text);
            }
        }

        onShowMessage: {
            check_text = text.toLowerCase();
            if(check_text.search("password not changed") != -1) {
                check_text = text.substring(check_text.search("server message: ") + 16, text.length)
                feedbackLabel.text = check_text;
            }
        }

        onAuthenticationComplete: {
            if(greeter.authenticated) {
                loginAnimation.start();
            }
            else {
                if(feedbackLabel.text.toLowerCase() == "checking password...") {
                    feedbackLabel.text = "Incorrect username or password";
                } 
                show_login();
                passwordInput.text = "";
                passwordInput.forceActiveFocus();
            }
        }
    }

    function show_login() {
        usernameInput.visible = true;
        passwordInput.visible = true;
        loginButton.visible = true;
        meetingIcon.visible = true;
        newInput.visible = false;
        confirmInput.visible = false;
        changeButton.visible = false;
        lockIcon.visible = false;
        usernameInput.forceActiveFocus();
    }

    function show_change() {
        feedbackLabel.text = "You must change your password"
        confirmInput.text = "";
        newInput.text = "";
        usernameInput.visible = false;
        passwordInput.visible = false;
        loginButton.visible = false;
        meetingIcon.visible = false;
        newInput.visible = true;
        confirmInput.visible = true;
        changeButton.visible = true;
        lockIcon.visible = true;
        feedbackLabel.forceActiveFocus();
    }

    function login() {
        loginButton.visible = false;
        feedbackLabel.text = "Checking password..."
        greeter.authenticate(usernameInput.text);
    }

    function change() {
        if(newInput.text != confirmInput.text) {
            feedbackLabel.text = "Passwords don't match!"
            confirmInput.focus = true;
        } else {
            changeButton.visible = false;
            feedbackLabel.text = "Changing password..."
            greeter.respond(newInput.text);
        }
    }

    function doSessionSync() {
        var session = "";
        greeter.startSessionSync(session);
    }

    ParallelAnimation {
        id: loginAnimation
        NumberAnimation { target: dialog; property: "opacity"; to: 0; duration: 400; easing.type: Easing.InOutQuad }
        NumberAnimation { target: powerDialog; property: "opacity"; to: 0; duration: 400; easing.type: Easing.InOutQuad }
        onCompleted: doSessionSync()
    }

    PlasmaCore.FrameSvgItem {
        id: dialog;
        imagePath: "widgets/background"
        anchors.centerIn: activeScreen;

        width: childrenRect.width + 55;
        height: childrenRect.height + 55;

        Column {
            spacing: 15
            anchors.centerIn: parent

            Image {
                id: logo
                source: config.readEntry("Logo")
                fillMode: Image.PreserveAspectFit
                height: 200
                anchors.horizontalCenter: parent.horizontalCenter
                smooth: true
            }


            PlasmaComponents.Label {
                anchors.horizontalCenter: parent.horizontalCenter;
                id: feedbackLabel;
                font.pointSize: 9
                text: config.readEntry("GreetMessage").replace("%hostname%", greeter.hostname);
            }


            Row {
                spacing: 10
                width: childrenRect.width
                height: childrenRect.height
                
                Grid {
                    columns: 2
                    spacing: 15
                    
                    ExtraComponents.QIconItem {
                        id: meetingIcon;
                        icon: "meeting-participant"
                        height: usernameInput.height;
                        width: usernameInput.height;
                    }

                    ExtraComponents.QIconItem {
                        id: lockIcon;
                        icon: "object-locked"
                        height: passwordInput.height;
                        width: passwordInput.height;
                        visible: false;
                    }

                    /*PlasmaComponents.*/TextField {
                        id: usernameInput;
                        placeholderText: i18n("Username");
                        text: ""
                        onAccepted: {
                            passwordInput.focus = true;
                        }
                        width: 320
                        
                        Component.onCompleted: {
                            //if the username field has text, focus the password, else focus the username
                            if (usernameInput.text) {
                                passwordInput.focus = true;
                            } else {
                                usernameInput.focus = true;
                            }
                        }
                        KeyNavigation.tab: passwordInput
                    }

                    /*PlasmaComponents.*/TextField {
                        id: newInput
                        visible: false
                        echoMode: TextInput.Password
                        placeholderText: i18n("New password")
                        onAccepted: {
                            confirmInput.focus = true;
                        }
                        width: 320
                        Component.onCompleted: {
                            //if the username field has text, focus the password, else focus the username
                            if (newInput.text) {
                                confirmInput.focus = true;
                            } else {
                                newInput.focus = true;
                            }
                        }
                        KeyNavigation.tab: confirmInput
                    }

                    ExtraComponents.QIconItem {
                        icon: "object-locked"
                        height: passwordInput.height;
                        width: passwordInput.height;
                    }

                    /*PlasmaComponents.*/TextField {
                        id: passwordInput
                        echoMode: TextInput.Password
                        placeholderText: i18n("Password")
                        onAccepted: {
                            login();
                        }
                        width: 320
                        KeyNavigation.backtab: usernameInput
                        KeyNavigation.tab: loginButton
                    }

                    /*PlasmaComponents.*/TextField {
                        id: confirmInput
                        visible: false
                        echoMode: TextInput.Password
                        placeholderText: i18n("Confirm new password")
                        onAccepted: {
                            change();
                        }   
                        width: 320
                        KeyNavigation.backtab: newInput
                        KeyNavigation.tab: changeButton
                    }  

                }
                
                /*PlasmaComponents.*/ToolButton {
                    id: loginButton
                    anchors.verticalCenter: parent.verticalCenter
                    iconSource: "go-next"
                    onClicked: {
                        login();
                    }
                    KeyNavigation.backtab: passwordInput
                    KeyNavigation.tab: usernameInput
                }
                /*PlasmaComponents.*/ToolButton {
                    id: changeButton
                    visible: false
                    anchors.verticalCenter: parent.verticalCenter
                    iconSource: "go-next"
                    onClicked: {
                        change();
                    }
                    KeyNavigation.backtab: confirmInput
                    KeyNavigation.tab: newInput
                }

            }

            Item {
                height: 50
            }
            Row {
                spacing: 10
                width: childrenRect.width
                height: 10
                 
                Grid {
                    columns: 2
                    spacing: 15
                    PlasmaComponents.Label {
                        anchors.horizontalCenter: parent.horizontalCenter;
                        id: feedbackLabel2;
                        font.pointSize: 9
                        text: " ";
                    }

                }          

            }

        }
    }

    PlasmaCore.FrameSvgItem {
        id: powerDialog
        anchors.top: dialog.bottom
        anchors.topMargin: 3
        anchors.horizontalCenter: activeScreen.horizontalCenter
        imagePath: "translucent/dialogs/background"
        opacity: 0

        Behavior on opacity { PropertyAnimation { duration: 500} }

        width: childrenRect.width + 30;
        height: childrenRect.height + 30;

        Row {
            spacing: 5
            anchors.centerIn: parent

            PlasmaWidgets.IconWidget {
                text: i18n("Suspend")
                icon: QIcon("system-suspend")
                enabled: power.canSuspend;
                onClicked: {power.suspend();}
            }
            
            PlasmaWidgets.IconWidget {
                text: i18n("Hibernate")
                icon: QIcon("system-suspend-hibernate")
                //Hibernate is a special case, lots of distros disable it, so if it's not enabled don't show it
                visible: power.canHibernate;
                onClicked: {power.hibernate();}
            }

            PlasmaWidgets.IconWidget {
                text: i18n("Restart")
                icon: QIcon("system-reboot")
                enabled: power.canRestart;
                onClicked: {power.restart();}
            }
            
            PlasmaWidgets.IconWidget {
                text: i18n("Shutdown")
                icon: QIcon("system-shutdown")
                enabled: power.canShutdown;
                onClicked: {power.shutdown();}
            }     
        }

    }
}

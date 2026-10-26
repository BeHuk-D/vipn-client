#!/bin/bash

APP_NAME=ViPN
SOCKET_GROUP=vipn
LOG_FOLDER=/var/log/$APP_NAME
LOG_FILE="$LOG_FOLDER/post-install.log"
APP_PATH=/opt/$APP_NAME

if ! test -f $LOG_FOLDER; then
        sudo mkdir $LOG_FOLDER
        echo "ViPN log dir created at /var/log/"
fi

if ! test -f $LOG_FILE; then
        touch $LOG_FILE
        echo "ViPN log file created at /var/log/ViPN/post-install.log"
fi

date > $LOG_FILE
echo "Script started" >> $LOG_FILE

if getent group "$SOCKET_GROUP" > /dev/null 2>&1; then
	echo "Group $SOCKET_GROUP already exists" >> $LOG_FILE
else
	sudo groupadd --system "$SOCKET_GROUP" >> $LOG_FILE
	echo "Group $SOCKET_GROUP created" >> $LOG_FILE
fi

IPC_USER="${SUDO_USER:-$(logname 2>/dev/null)}"
if [ -n "$IPC_USER" ] && [ "$IPC_USER" != "root" ]; then
	sudo usermod -aG "$SOCKET_GROUP" "$IPC_USER" >> $LOG_FILE
	echo "User $IPC_USER added to group $SOCKET_GROUP (re-login required)" >> $LOG_FILE
fi

sudo killall -9 $APP_NAME 2>> $LOG_FILE

if command -v steamos-readonly &> /dev/null; then
        sudo steamos-readonly disable >> $LOG_FILE
        echo "steamos-readonly disabled" >> $LOG_FILE
fi

if sudo systemctl is-active --quiet $APP_NAME; then
	sudo systemctl stop $APP_NAME >> $LOG_FILE
	sudo systemctl disable $APP_NAME >> $LOG_FILE
	sudo rm -rf /etc/systemd/system/$APP_NAME.service >> $LOG_FILE
fi

sudo chmod -R a-w $APP_PATH/

sudo cp $APP_PATH/$APP_NAME.service /etc/systemd/system/ >> $LOG_FILE

sudo systemctl start $APP_NAME >> $LOG_FILE
sudo systemctl enable $APP_NAME >> $LOG_FILE
sudo ln -sf $APP_PATH/bin/$APP_NAME /usr/local/sbin/$APP_NAME >> $LOG_FILE
sudo ln -sf $APP_PATH/bin/$APP_NAME /usr/local/bin/$APP_NAME >> $LOG_FILE

echo "user desktop creation loop started" >> $LOG_FILE
sudo cp $APP_PATH/$APP_NAME.desktop /usr/share/applications/ >> $LOG_FILE
sudo cp $APP_PATH/$APP_NAME.png /usr/share/pixmaps/ >> $LOG_FILE
sudo chmod 555 /usr/share/applications/$APP_NAME.desktop >> $LOG_FILE

echo "user desktop creation loop ended" >> $LOG_FILE

if command -v steamos-readonly &> /dev/null; then
        sudo steamos-readonly enable >> $LOG_FILE
        echo "steamos-readonly enabled" >> $LOG_FILE
fi

date >> $LOG_FILE
echo "Service status:" >> $LOG_FILE
sudo systemctl status $APP_NAME >> $LOG_FILE
date >> $LOG_FILE
echo "Script finished" >> $LOG_FILE
exit 0

sc stop AmneziaWGTunnel$AmneziaVPN
sc delete AmneziaWGTunnel$AmneziaVPN
taskkill /IM "ViPN-service.exe" /F
taskkill /IM "ViPN.exe" /F
exit /b 0

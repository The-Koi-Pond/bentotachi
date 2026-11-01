@echo off
rem Double-click to start the Bentotachi server.
rem "0.0.0.0" lets phones reach it (on home Wi-Fi or through Tailscale),
rem not just this PC. Leave this window open while using Bentotachi; closing
rem it stops the server.
title Bentotachi server
cd /d "%~dp0server"
echo Starting Bentotachi. Leave this window open; close it to stop the server.
echo.
pocketbase.exe serve --http 0.0.0.0:8090
echo.
echo The server has stopped. If there's an error above, copy it and send it to whoever set Bentotachi up for you.
pause

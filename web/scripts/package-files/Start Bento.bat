@echo off
rem Double-click to start the Bento server.
rem "0.0.0.0" lets phones reach it (on home Wi-Fi or through Tailscale),
rem not just this PC. Leave this window open while using Bento; closing it
rem stops the server.
title Bento server
cd /d "%~dp0server"
echo Starting Bento. Leave this window open; close it to stop the server.
echo.
pocketbase.exe serve --http 0.0.0.0:8090
echo.
echo The server has stopped. If there's an error above, copy it and send it to whoever set Bentotachi up for you.
pause

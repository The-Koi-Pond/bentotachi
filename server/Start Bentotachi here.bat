@echo off
rem Bentotachi used to run on this PC. It now runs on the Raspberry Pi as a
rem service (see README.md), so this only starts it here if you type YES:
rem running both would make two separate copies whose changes never meet.
title Bentotachi server (this PC)
echo Bentotachi now runs on the Raspberry Pi, so this PC
echo doesn't need to run it any more.
echo.
echo Starting it here as well would make a second, separate copy,
echo and changes made in one would never reach the other.
echo.
echo Only if you really mean to (for example, the Pi has died and you're
echo moving Bentotachi back to this PC), type YES and press Enter.
set /p answer=^>
if /i not "%answer%"=="YES" exit /b
cd /d "%~dp0"
echo Starting Bentotachi on this PC. Leave this window open; close it to stop.
pocketbase.exe serve --http 0.0.0.0:8090
pause

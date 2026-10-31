@echo off
rem Bento used to run on this PC. It now runs on the Raspberry Pi as a
rem service (see README.md), so this only starts it here if you type YES:
rem running both would make two separate copies whose changes never meet.
title Bento server (this PC)
echo Bento now runs on the Raspberry Pi, so this PC
echo doesn't need to run it any more.
echo.
echo Starting it here as well would make a second, separate copy of Bento,
echo and changes made in one would never reach the other.
echo.
echo Only if you really mean to (for example, the Pi has died and you're
echo moving Bento back to this PC), type YES and press Enter.
set /p answer=^> 
if /i not "%answer%"=="YES" exit /b
cd /d "%~dp0server"
echo Starting Bento on this PC. Leave this window open; close it to stop.
pocketbase.exe serve --http 0.0.0.0:8090
pause

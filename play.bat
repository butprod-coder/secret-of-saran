@echo off
rem Lance le serveur local et ouvre le jeu dans le navigateur.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" %*
pause

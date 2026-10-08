@echo off
rem Prayer Times Break - Discord (Vencord) plugin setup for Windows.
rem Double-click this file. It runs install.ps1 (downloaded first when it is not next to this file).
setlocal
set "PS1=%~dp0install.ps1"
if not exist "%PS1%" (
  set "PS1=%TEMP%\ptb-install.ps1"
  powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri https://raw.githubusercontent.com/mPhpMaster/prayer-times-reminder-chrome-ext/main/targets/vencord/install.ps1 -OutFile $env:TEMP\ptb-install.ps1"
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
echo.
pause

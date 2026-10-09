@echo off
setlocal EnableExtensions
title Horse Engine installer

rem ============================================================
rem  Horse torrent engine - one-time installer for Windows.
rem  1. downloads the engine (from github.com/hoseain756/Horse)
rem  2. installs it to %LOCALAPPDATA%\HorseEngine
rem  3. registers the horse-engine:// trigger, so the website's
rem     "Start engine" button can launch it with ONE click.
rem  Safe to run again later (it refreshes the installation).
rem ============================================================

where node >nul 2>nul
if errorlevel 1 (
  echo [installer] Node.js is not installed.
  echo [installer] Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

set "ENG=%LOCALAPPDATA%\HorseEngine"
set "TMPZIP=%TEMP%\horse-main.zip"
set "TMPDIR=%TEMP%\horse-main-extract"

echo [installer] Downloading the engine...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/hoseain756/Horse/archive/refs/heads/main.zip' -OutFile '%TMPZIP%'"
if errorlevel 1 (
  echo [installer] Download failed - check your internet connection and run this again.
  pause
  exit /b 1
)

echo [installer] Unpacking...
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force '%TMPZIP%' '%TMPDIR%'"
if errorlevel 1 (
  echo [installer] Unpacking failed - run this again.
  pause
  exit /b 1
)
xcopy /E /I /Y "%TMPDIR%\Horse-main\mini-services\torrent-service" "%ENG%" >nul
if errorlevel 1 (
  echo [installer] Copy failed - run this again.
  pause
  exit /b 1
)
del "%TMPZIP%" >nul 2>nul
rmdir /s /q "%TMPDIR%" >nul 2>nul

echo [installer] Installing dependencies (first run only, may take a minute)...
cd /d "%ENG%"
if not exist "node_modules" call npm install
if errorlevel 1 (
  echo [installer] npm install failed - check your connection and run this again.
  pause
  exit /b 1
)

echo [installer] Registering the one-click trigger (horse-engine://)...
> "%ENG%\engine-run.cmd" echo @echo off
>> "%ENG%\engine-run.cmd" echo cd /d "%%~dp0"
>> "%ENG%\engine-run.cmd" echo node -e "fetch('http://127.0.0.1:3031/health').then(r=>process.exit(0)).catch(()=>process.exit(1))"
>> "%ENG%\engine-run.cmd" echo if errorlevel 1 start "Horse Engine" /min cmd /q /c "npm start"

reg add "HKCU\Software\Classes\horse-engine" /ve /d "URL:Horse Engine" /f >nul
reg add "HKCU\Software\Classes\horse-engine" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\horse-engine\shell\open\command" /ve /d "\"%ENG%\engine-run.cmd\" \"%%1\"" /f >nul

echo [installer] Starting the engine (a minimized window named "Horse Engine")...
start "Horse Engine" /min cmd /q /c "npm start"

echo.
echo [installer] DONE.
echo [installer] Back in the website: Settings - Integrations - P2P
echo [installer] press "Save ^& test" (or the one-click Start button).
echo [installer] The engine lives in the minimized "Horse Engine" window -
echo [installer] close it only when you finish watching.
echo.
pause

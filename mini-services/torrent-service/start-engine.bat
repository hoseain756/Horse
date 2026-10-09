@echo off
rem Horse torrent engine - one-click launcher (Windows)
rem Docs: deploy/HOSTING-FREE.md and mini-services/torrent-service/README.md

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [start-engine] Node.js is not installed.
  echo [start-engine] Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [start-engine] First run - installing dependencies (one time)...
  call npm install
  if errorlevel 1 (
    echo [start-engine] npm install failed - check your internet connection and run this file again.
    pause
    exit /b 1
  )
)

echo [start-engine] Starting the engine on http://localhost:3031 ...
echo [start-engine] Keep this window open while watching. Press Ctrl+C to stop.
call npm start
echo [start-engine] The engine stopped.
pause

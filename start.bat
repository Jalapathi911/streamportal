@echo off
title StreamPortal Launcher

echo.
echo  ====================================
echo   StreamPortal - Starting Servers
echo  ====================================
echo.

:: Start backend server in new window
echo [1/2] Starting backend server (port 4000)...
start "StreamPortal - Backend" cmd /k "cd /d "%~dp0server" && npm run dev"

:: Small delay so backend gets a head start
timeout /t 2 /nobreak >nul

:: Start frontend client in new window
echo [2/2] Starting frontend client (port 5173)...
start "StreamPortal - Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

:: Wait for Vite to be ready, then open browser
timeout /t 4 /nobreak >nul

echo.
echo  Both servers are starting up...
echo  Opening dashboard in browser...
echo.
start "" "http://localhost:5173/dashboard"

echo  ====================================
echo   Backend  : http://localhost:4000
echo   Frontend : http://localhost:5173
echo   Dashboard: http://localhost:5173/dashboard
echo  ====================================
echo.
echo  Close the two terminal windows to stop the servers.
echo.
pause

@echo off
setlocal EnableDelayedExpansion
title MorNut - Docker Launch

:: Resolve project root from batch file location
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo.
echo  ============================================
echo    MorNut - Smart Queue Management System
echo  ============================================
echo.

:: --- Prerequisites ----------------------------------------------------------
where docker >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker not found. Install Docker Desktop and try again.
    pause & exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker Desktop doesn't seem to be running. Start it and try again.
    pause & exit /b 1
)

:: --- Env files ----------------------------------------------------------------
if not exist "%BACKEND%\.env" (
    echo  [!] backend\.env not found.
    echo      Copying .env.example to .env — edit it with real LINE/SlipOK keys before going live.
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
)
if not exist "%FRONTEND%\.env.local" (
    echo  [!] frontend\.env.local not found.
    echo      Copying .env.example to .env.local
    copy "%FRONTEND%\.env.example" "%FRONTEND%\.env.local" >nul
)

:: --- Build + launch everything in Docker --------------------------------------
echo.
echo  Building and starting containers (db, backend, frontend)...
echo.
docker compose -f "%ROOT%\docker-compose.yml" up -d --build
if errorlevel 1 (
    echo.
    echo  [ERROR] docker compose up failed. See output above.
    pause & exit /b 1
)

echo.
echo    Database     --  localhost:5455
echo    Backend  API --  http://localhost:8080
echo    API Docs     --  http://localhost:8080/docs
echo    Frontend     --  http://localhost:5175
echo.
echo  All services (mornut_db, mornut_backend, mornut_frontend) are running
echo  in Docker Desktop — check there for status and logs.
echo.
echo    View logs:  docker compose logs -f
echo    Stop all:   docker compose down
echo.
endlocal

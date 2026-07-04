@echo off
setlocal EnableDelayedExpansion
title MorNut - Setup and Launch

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
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Install Python 3.12+ and try again.
    pause & exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install Node.js 20+ and try again.
    pause & exit /b 1
)
where docker >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker not found. Install Docker Desktop and try again.
    pause & exit /b 1
)

:: --- Step 1: Database (Docker) -----------------------------------------------
echo  [1/5] Starting database (Docker)...
docker compose -f "%ROOT%\docker-compose.yml" up -d
if errorlevel 1 (
    echo  [ERROR] Failed to start Docker database.
    echo         Make sure Docker Desktop is running.
    pause & exit /b 1
)

:: Wait for PostgreSQL to be ready (retry up to 15 times, 2 sec apart)
echo        Waiting for PostgreSQL to be ready...
set /a RETRIES=0
:waitloop
set /a RETRIES+=1
if %RETRIES% gtr 15 (
    echo  [ERROR] Database did not become ready in time.
    pause & exit /b 1
)
docker exec mornut_db pg_isready -U mornut >nul 2>&1
if errorlevel 1 (
    ping 127.0.0.1 -n 3 >nul 2>&1
    goto waitloop
)
echo        Database is ready.

:: --- Step 2: Python virtual environment -------------------------------------
echo  [2/5] Checking Python virtual environment...
if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo        Creating .venv (first-time only^)...
    python -m venv "%BACKEND%\.venv"
    if errorlevel 1 (
        echo  [ERROR] Failed to create virtual environment.
        pause & exit /b 1
    )
)

:: --- Step 3: Backend packages -----------------------------------------------
echo  [3/5] Installing / verifying backend packages...
"%BACKEND%\.venv\Scripts\pip" install -r "%BACKEND%\requirements.txt" -q
if errorlevel 1 (
    echo  [ERROR] pip install failed.
    pause & exit /b 1
)

if not exist "%BACKEND%\.env" (
    echo.
    echo  [!] backend\.env not found.
    echo      Copying .env.example to .env — edit it before proceeding.
    echo.
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
)

:: --- Step 4: Frontend packages ----------------------------------------------
echo  [4/5] Checking frontend packages...
if not exist "%FRONTEND%\node_modules" (
    echo        Running npm install (first-time only^)...
    pushd "%FRONTEND%"
    npm install
    popd
    if errorlevel 1 (
        echo  [ERROR] npm install failed.
        pause & exit /b 1
    )
)

if not exist "%FRONTEND%\.env.local" (
    echo.
    echo  [!] frontend\.env.local not found.
    echo      Copying .env.example to .env.local
    echo.
    copy "%FRONTEND%\.env.example" "%FRONTEND%\.env.local" >nul
)

:: --- Step 5: Launch ----------------------------------------------------------
echo  [5/5] Launching servers...
echo.
echo    Database     --  localhost:5433
echo    Backend  API --  http://localhost:8080
echo    API Docs     --  http://localhost:8080/docs
echo    Frontend     --  http://localhost:5173
echo.

start "MorNut - Backend :8080"  /d "%BACKEND%"  cmd /k ".venv\Scripts\activate && uvicorn app.main:app --reload --port 8080"
ping 127.0.0.1 -n 3 >nul 2>&1
start "MorNut - Frontend :5173" /d "%FRONTEND%" cmd /k "npm run dev"

echo  Both servers are starting in separate windows.
echo  Close each window (or press Ctrl+C inside it) to stop.
echo  To stop the database: docker compose -f "%ROOT%\docker-compose.yml" down
echo.
endlocal

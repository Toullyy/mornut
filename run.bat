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

:: --- Step 1: Python virtual environment -------------------------------------
echo  [1/4] Checking Python virtual environment...
if not exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo        Creating .venv (first-time only^)...
    python -m venv "%BACKEND%\.venv"
    if errorlevel 1 (
        echo  [ERROR] Failed to create virtual environment.
        pause & exit /b 1
    )
)

:: --- Step 2: Backend packages -----------------------------------------------
echo  [2/4] Installing / verifying backend packages...
"%BACKEND%\.venv\Scripts\pip" install -r "%BACKEND%\requirements.txt" -q
if errorlevel 1 (
    echo  [ERROR] pip install failed.
    pause & exit /b 1
)

if not exist "%BACKEND%\.env" (
    echo.
    echo  [!] backend\.env not found.
    echo      Copying .env.example to .env
    echo      Edit backend\.env and fill in your real credentials.
    echo.
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
)

:: --- Step 3: Frontend packages ----------------------------------------------
echo  [3/4] Checking frontend packages...
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
    echo      Edit frontend\.env.local and fill in your real credentials.
    echo.
    copy "%FRONTEND%\.env.example" "%FRONTEND%\.env.local" >nul
)

:: --- Step 4: Launch ---------------------------------------------------------
echo  [4/4] Launching servers...
echo.
echo    Backend  API  --  http://localhost:8080
echo    API Docs      --  http://localhost:8080/docs
echo    Frontend      --  http://localhost:5173
echo.

start "MorNut - Backend :8080"  /d "%BACKEND%"  cmd /k ".venv\Scripts\activate && uvicorn app.main:app --reload --port 8080"
ping 127.0.0.1 -n 3 >nul 2>&1
start "MorNut - Frontend :5173" /d "%FRONTEND%" cmd /k "npm run dev"

echo  Both servers are starting in separate windows.
echo  Close each window (or press Ctrl+C inside it) to stop.
echo.
endlocal
@echo off
echo ============================================
echo   Job Hunting Agent - Backend Starter
echo ============================================

REM Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python not found!
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

echo [OK] Python found.

REM Check for .env file
if not exist "backend\.env" (
    echo.
    echo [WARNING] No .env file found!
    echo Copying .env.example to .env...
    copy backend\.env.example backend\.env
    echo.
    echo !! IMPORTANT: Open backend\.env and add your Claude API key !!
    echo    Get your key at: https://console.anthropic.com
    echo.
    pause
)

REM Install dependencies
echo.
echo Installing Python dependencies...
python -m pip install -r backend\requirements.txt

echo.
echo ============================================
echo   Starting backend on http://localhost:8000
echo ============================================
echo   Dashboard: Open dashboard\index.html
echo   API Docs:  http://localhost:8000/docs
echo ============================================
echo.

cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

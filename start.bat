@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Missing Python environment. Follow README.md.
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo Run npm ci in frontend first.
    exit /b 1
)
where go >nul 2>&1
if errorlevel 1 exit /b 1
where npm.cmd >nul 2>&1
if errorlevel 1 exit /b 1
start "QwQ OCR" /D "%~dp0" cmd /k .venv\Scripts\python.exe -m uvicorn ocr_server:app --app-dir ocr_service --port 8001
start "QwQ Backend" /D "%~dp0" cmd /k go run ./backend/cmd/app
echo Waiting for backend on port 8080...
powershell -NoProfile -Command "$ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 8080); $ready = $true; break } catch { Start-Sleep -Seconds 1 } finally { if ($c) { $c.Dispose() } } }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo Backend did not start. Check its window.
    exit /b 1
)
start "QwQ Overlay" /D "%~dp0" cmd /k .venv\Scripts\python.exe overlay\main.py
start "QwQ Frontend" /D "%~dp0frontend" cmd /k npm.cmd run dev
echo Open the local URL printed in the frontend window.
echo Close each component window to stop it.

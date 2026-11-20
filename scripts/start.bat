@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
pushd "%ROOT%" || exit /b 1
if not exist ".venv\Scripts\python.exe" (
    echo Run scripts\setup.bat first.
    popd
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo Run scripts\setup.bat first.
    popd
    exit /b 1
)
where go >nul 2>&1
if errorlevel 1 (
    echo Go was not found in PATH.
    popd
    exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo npm was not found in PATH.
    popd
    exit /b 1
)
start "QwQ OCR" /D "%ROOT%" cmd /k .venv\Scripts\python.exe -m uvicorn ocr_server:app --app-dir python\ocr_service --port 8001
start "QwQ Backend" /D "%ROOT%" cmd /k go -C backend run ./cmd/app
echo Waiting for backend on port 8080...
powershell -NoProfile -Command "$ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 8080); $ready = $true; break } catch { Start-Sleep -Seconds 1 } finally { if ($c) { $c.Dispose() } } }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo Backend did not start. Check its window.
    popd
    exit /b 1
)
start "QwQ Overlay" /D "%ROOT%" cmd /k .venv\Scripts\python.exe python\overlay\main.py
start "QwQ Frontend" /D "%ROOT%\frontend" cmd /k npm.cmd run dev
echo Open the local URL printed in the frontend window.
echo Close each component window to stop it.
popd
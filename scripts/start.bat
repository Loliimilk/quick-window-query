@echo off
setlocal
if not defined QWQ_API_ADDR set "QWQ_API_ADDR=127.0.0.1:18743"
if not defined QWQ_OCR_PORT set "QWQ_OCR_PORT=18744"
if not defined QWQ_WEB_PORT set "QWQ_WEB_PORT=15173"
if exist "%USERPROFILE%\AppData\Local\Programs\Go\1.26.11\bin\go.exe" set "PATH=%USERPROFILE%\AppData\Local\Programs\Go\1.26.11\bin;%PATH%"
if exist "%USERPROFILE%\AppData\Local\Programs\NodeJS\node.exe" set "PATH=%USERPROFILE%\AppData\Local\Programs\NodeJS;%PATH%"
if exist "%ProgramFiles%\Go\bin\go.exe" set "PATH=%ProgramFiles%\Go\bin;%PATH%"
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
pushd "%ROOT%" || exit /b 1
echo Starting QwQ on these local ports:
echo   API:      %QWQ_API_ADDR%
echo   OCR:      127.0.0.1:%QWQ_OCR_PORT%
echo   Frontend: http://127.0.0.1:%QWQ_WEB_PORT%
if not exist ".venv\Scripts\python.exe" (
    echo Run scripts\setup.bat first.
    popd
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo Run scripts\setup.bat first.
    popd
    pause
    exit /b 1
)
where go >nul 2>&1
if errorlevel 1 (
    echo Go was not found in PATH.
    popd
    pause
    exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found in PATH.
    popd
    pause
    exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo npm.cmd was not found in PATH.
    popd
    pause
    exit /b 1
)
if not exist "frontend\node_modules\vite\bin\vite.js" (
    echo Frontend dependencies are missing. Run scripts\setup.bat first.
    popd
    pause
    exit /b 1
)
echo Starting the OCR HTTP server in a new window...
start "QwQ OCR" /D "%ROOT%" cmd /k ".venv\Scripts\python.exe -m uvicorn ocr_server:app --app-dir python\ocr_service --host 127.0.0.1 --port %QWQ_OCR_PORT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-for-http.ps1" -ServiceName "OCR HTTP server" -Uri "http://127.0.0.1:%QWQ_OCR_PORT%/health/live" -TimeoutSeconds 60
if errorlevel 1 (
    echo OCR HTTP server did not respond. Check the QwQ OCR window above for its startup error.
    popd
    pause
    exit /b 1
)
echo OCR HTTP server is responding. The model may still be loading; watch the QwQ OCR window.
echo Starting the backend in a new window...
start "QwQ Backend" /D "%ROOT%" cmd /k "go -C backend run ./cmd/app"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-for-http.ps1" -ServiceName "Backend" -Uri "http://%QWQ_API_ADDR%/health" -TimeoutSeconds 60
if errorlevel 1 (
    echo Backend did not start. Check its window.
    popd
    pause
    exit /b 1
)
echo Backend is responding.
echo Starting the overlay and frontend in new windows...
start "QwQ Overlay" /D "%ROOT%" cmd /k .venv\Scripts\python.exe python\overlay\main.py
start "QwQ Frontend" /D "%ROOT%\frontend" cmd /k "npm.cmd run dev"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\wait-for-http.ps1" -ServiceName "Frontend" -Uri "http://127.0.0.1:%QWQ_WEB_PORT%/" -TimeoutSeconds 60
if errorlevel 1 (
    echo Frontend did not start. Check its window.
    popd
    pause
    exit /b 1
)
start "" "http://127.0.0.1:%QWQ_WEB_PORT%"
echo QwQ is running in your browser.
echo Close each component window to stop it.
pause
popd

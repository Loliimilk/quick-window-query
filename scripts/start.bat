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
if not exist "frontend\node_modules\vite\bin\vite.js" (
    echo Frontend dependencies are missing. Run scripts\setup.bat first.
    popd
    pause
    exit /b 1
)
start "QwQ OCR" /D "%ROOT%" cmd /k ".venv\Scripts\python.exe -m uvicorn ocr_server:app --app-dir python\ocr_service --host 127.0.0.1 --port %QWQ_OCR_PORT%"
echo Waiting for OCR service to start. First model loading can take a few minutes...
powershell -NoProfile -Command "$ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%QWQ_OCR_PORT%/health/live' -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { }; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo OCR service did not become ready. Check its window.
    popd
    pause
    exit /b 1
)
start "QwQ Backend" /D "%ROOT%" cmd /k "go -C backend run ./cmd/app"
echo Waiting for backend health endpoint...
powershell -NoProfile -Command "$healthUri = 'http://%QWQ_API_ADDR%/health'; $ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { }; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo Backend did not start. Check its window.
    popd
    pause
    exit /b 1
)
start "QwQ Overlay" /D "%ROOT%" cmd /k .venv\Scripts\python.exe python\overlay\main.py
start "QwQ Frontend" /D "%ROOT%\frontend" cmd /k "npm.cmd run dev"
echo Waiting for the frontend...
powershell -NoProfile -Command "$ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%QWQ_WEB_PORT%/' -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { }; Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
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

@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
pushd "%ROOT%" || exit /b 1
where python >nul 2>&1
if errorlevel 1 (
    echo Python was not found in PATH.
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
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 goto :failed
)
.venv\Scripts\python.exe -m pip install -r python\requirements.txt
if errorlevel 1 goto :failed
npm.cmd --prefix frontend ci
if errorlevel 1 goto :failed
go -C backend mod download
if errorlevel 1 goto :failed
echo All dependencies were installed.
popd
exit /b 0
:failed
echo Dependency setup failed. Review the output above.
popd
exit /b 1
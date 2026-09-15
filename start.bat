@echo off
chcp 65001 >nul
echo ==========================================
echo Запуск системы QwQ...
echo ==========================================

echo [1/3] Запускаем OCR-сервер...
start "OCR Server" cmd /k "cd ocr_service && uvicorn ocr_server:app --reload --port 8001"

echo [2/3] Запускаем PyQt-клиент...
start "PyQt Overlay" cmd /k ".venv\Scripts\python.exe client/get_frame.py"

echo [3/3] Запускаем Go-бэкенд...
go run backend/cmd/app/main.go

pause
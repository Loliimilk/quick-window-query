# QwQ — Quick Window Query

Прототип приложения для выделения области экрана, распознавания текста и работы с языковыми заметками.

## Структура

- `backend/cmd/app` — точка входа Go.
- `backend/internal/api` — HTTP API для координат области.
- `backend/internal/capture` — захват экрана.
- `backend/internal/ocr` — HTTP-клиент OCR.
- `frontend/src/components` — общие компоненты интерфейса.
- `frontend/src/pages` — страницы и стили.
- `frontend/src/features` — логика заметок и настроек.
- `frontend/src/grammar`, `locales`, `assets` — категории грамматики, переводы и иконки.
- `overlay` — PyQt-рамка выбора области.
- `ocr_service` — FastAPI + EasyOCR.
- `go.work` — Go workspace.
- `start.bat` — запуск компонентов под Windows.

Оверлей отправляет координаты в Go (`POST :8080/update-bounds`). Go захватывает область и передаёт PNG в OCR (`POST :8001/binary`), затем выводит результат в консоль. Веб-интерфейс пока использует демонстрационные фразы из `frontend/src/pages/capture/phrase.json`; заметки и настройки хранит в localStorage. Подключение интерфейса к OCR ещё не реализовано.

## Подготовка под Windows

Нужны Node.js с npm, Python с поддержкой PyQt5/PyTorch и Go **1.26.5 или новее**. Требования Node можно проверить в `frontend/package-lock.json` (поле `engines` пакета Vite). Версия в `go.mod` и `go.work` согласована с проверенным локальным Go 1.26.5.

Из корня репозитория, в PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Push-Location frontend
npm ci
Pop-Location
go -C backend mod download
```

Единый корневой `requirements.txt` содержит зависимости обоих Python-компонентов: PyQt5 и requests для оверлея; FastAPI, Uvicorn и EasyOCR для OCR. Это списки для установки, а не сами библиотеки: пакеты устанавливаются в `.venv` командой выше. Python-зависимости заданы диапазонами, а не lock-файлом. Зависимости EasyOCR устанавливает pip согласно метаданным пакета. Для использования GPU нужна совместимая сборка PyTorch; в OCR включено `gpu=True`. При первом запуске может потребоваться загрузка моделей из интернета.

## Запуск

```powershell
.\start.bat
```

Скрипт использует свою папку как рабочую и общий `.venv`, запускает OCR и Go, ждёт доступности порта Go, затем запускает оверлей и Vite. Откройте адрес из окна Vite. Пока OCR загружает модель, Go может выводить ошибки подключения.

Для остановки завершите процессы во всех открытых окнах через Ctrl+C и закройте окна. Если запуск оборвался, уже открытые компоненты нужно остановить отдельно перед повторным запуском.

Раздельный запуск — каждая команда в отдельном терминале из корня:

```powershell
.\.venv\Scripts\python.exe -m uvicorn ocr_server:app --app-dir ocr_service --port 8001
go run ./backend/cmd/app
.\.venv\Scripts\python.exe overlay/main.py
npm --prefix frontend run dev
```

## Проверки

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
go test ./backend/...
python -m py_compile overlay/main.py ocr_service/ocr_server.py
```

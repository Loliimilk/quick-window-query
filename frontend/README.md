# QwQ frontend

React + Vite интерфейс. Подготовка и запуск системы: [корневой README](../README.md).

Команды из этой папки: npm ci, npm run dev, npm run build, npm run lint.

- src/components — общие UI-компоненты.
- src/pages — страницы и стили; capture/phrase.json — демонстрационные данные.
- src/features/notes — хранение заметок и хук управления ими.
- src/features/settings — хранение и нормализация настроек.
- src/grammar — категории грамматики.
- src/locales и src/i18n.js — локализация.
- src/assets — графические ресурсы.

Заметки и настройки сохраняются в localStorage. Интерфейс пока не получает результаты OCR от бэкенда.

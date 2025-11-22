# Инструкции для агента Cursor

## Обязательные правила работы с проектом

### 1. Работа с n8n workflow

**⚠️ КРИТИЧЕСКИ ВАЖНО:** Все импорты и обновления workflow в n8n ДОЛЖНЫ выполняться через PowerShell скрипт `setup/setup_n8n_via_curl.ps1`.

**Подробная инструкция:** [N8N_WORKFLOW_IMPORT_GUIDE.md](./N8N_WORKFLOW_IMPORT_GUIDE.md)

**Кратко:**
- НЕ используй браузерную автоматизацию для настройки workflow
- НЕ импортируй workflow вручную через UI
- Всегда добавляй новые workflow в массив `$workflows` в скрипте `setup_n8n_via_curl.ps1`
- Запускай скрипт для импорта всех workflow разом

### 2. Работа с базой данных

- Используй Neon PostgreSQL через connection string
- SQL миграции выполняй через скрипты в папке `setup/`
- Всегда проверяй существование constraints перед созданием

### 3. Переменные окружения

- Все переменные окружения настраиваются в `.env` и `docker-compose.yml`
- Для n8n переменные передаются через `docker-compose.yml` в секцию `environment`
- Переменные доступны в workflows как `{{ $env.VARIABLE_NAME }}`

### 4. Работа с Telegram ботами

В проекте два бота:
- `TELEGRAM_BOT_TOKEN` - основной бот для работы с пользователями
- `N8N_ALERTS_TELEGRAM_BOT_TOKEN` - бот для алертов через n8n

Всегда проверяй, какой бот используется в каждом контексте.

### 5. Работа с UI компонентами (TailwindUI Plus)

**⚠️ ВАЖНО:** При создании веб-интерфейсов ВСЕГДА используй компоненты из `TailwindUI-Plus-components-2025/`.

**Правила:**
- ✅ Используй **Catalyst UI Kit** для новых веб-интерфейсов (страницы управления, дашборды, формы)
- ✅ Используй **Tailwind UI Application UI** для административных панелей
- ✅ Используй **Tailwind UI Marketing** для публичных страниц
- ✅ Копируй компоненты в `src/components/` перед использованием
- ✅ Используй TypeScript версии компонентов для React проектов
- ❌ НЕ создавай UI компоненты с нуля, если есть готовые в библиотеке
- ❌ НЕ модифицируй оригинальные компоненты в `TailwindUI-Plus-components-2025/`

**Документация:** [TAILWINDUI_PLUS_GUIDE.md](./TAILWINDUI_PLUS_GUIDE.md)

---

## Быстрые ссылки

- [N8N_WORKFLOW_IMPORT_GUIDE.md](./N8N_WORKFLOW_IMPORT_GUIDE.md) - Подробная инструкция по работе с n8n
- [TAILWINDUI_PLUS_GUIDE.md](./TAILWINDUI_PLUS_GUIDE.md) - Руководство по использованию TailwindUI Plus
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Архитектура системы
- [AGENTS.md](../AGENTS.md) - Описание агентов

---

**Обновлено:** 2025-11-09


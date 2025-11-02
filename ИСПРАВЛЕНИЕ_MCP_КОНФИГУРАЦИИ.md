# Исправление MCP конфигурации

## ❌ Проблема

Ошибка: `Invalid config: mcpServers must be an object`

Причина: В файле конфигурации отсутствует правильная структура `mcpServers` как объект.

## ✅ Решение

### Вариант 1: Через интерфейс Cursor (Рекомендуется)

1. В Cursor откройте настройки: `Ctrl+,` → **Tools & MCP**
2. Нажмите кнопку **"Open JSON"** (справа от ошибки)
3. Замените весь содержимое на:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\chrome-devtools-server.js"
      ],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    },
    "n8n": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\n8n-mcp-server.js"
      ],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents",
      "env": {
        "N8N_BASE_URL": "https://n8n.rentflow.rentals",
        "N8N_API_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"
      }
    }
  }
}
```

4. Сохраните файл
5. Перезапустите Cursor

### Вариант 2: Редактирование файла напрямую

Откройте файл конфигурации:
- `C:\Users\33pok\AppData\Roaming\Cursor\User\globalStorage\cursor-mcp\mcp.json`

Или через команду:
```powershell
notepad "$env:APPDATA\Cursor\User\globalStorage\cursor-mcp\mcp.json"
```

Замените содержимое на конфигурацию выше.

## ✅ После исправления

После перезапуска Cursor вы должны увидеть в списке MCP серверов:
- ✅ **chrome-devtools** (9 tools enabled)
- ✅ **n8n** (12 tools enabled)

## 🔍 API ключ n8n

API ключ взят из документации (`claude.md`):
- Действителен до: **2025-12-02**
- URL n8n: `https://n8n.rentflow.rentals` (ваш домен)

## 📋 Готовая конфигурация

Готовая конфигурация сохранена в файле: `CURSOR_MCP_FIXED_CONFIG.json`

Скопируйте оттуда, если удобнее.


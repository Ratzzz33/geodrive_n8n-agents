# MCP Chrome DevTools восстановлен ✅

**Дата:** 2025-01-27

## Что было сделано

1. ✅ Проверено наличие файла `mcp-server/chrome-devtools-server.js`
2. ✅ Проверены зависимости (puppeteer@24.27.0, @modelcontextprotocol/sdk@1.20.2)
3. ✅ Обновлена конфигурация MCP в `C:\Users\33pok\.cursor\mcp.json`

## Текущая конфигурация

Файл `C:\Users\33pok\.cursor\mcp.json` теперь содержит два MCP сервера:

1. **n8n-mcp-official** - для работы с n8n API
2. **chrome-devtools** - для управления браузером через Chrome DevTools Protocol

## Что нужно сделать дальше

### Шаг 1: Перезапустить Cursor

**ВАЖНО:** Полностью закройте и снова откройте Cursor, чтобы изменения вступили в силу.

1. Закройте все окна Cursor
2. Откройте Cursor заново
3. Подождите несколько секунд для инициализации MCP серверов

### Шаг 2: Проверить работу Chrome DevTools MCP

После перезапуска Cursor:

1. Откройте чат с AI
2. Попробуйте выполнить запрос, например:
   ```
   Открой страницу https://google.com и сделай скриншот
   ```

Если MCP сервер работает, AI сможет использовать инструменты для управления браузером.

### Шаг 3: Проверить в настройках Cursor

1. Нажмите `Ctrl+,` (или `Cmd+,` на Mac)
2. Перейдите в раздел **"Features"** → **"Model Context Protocol"**
3. Должны быть видны оба сервера:
   - `n8n-mcp-official`
   - `chrome-devtools`

## Конфигурация Chrome DevTools MCP

```json
{
  "chrome-devtools": {
    "command": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\chrome-devtools-server.js"
    ],
    "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
  }
}
```

## Доступные инструменты Chrome DevTools

После успешной настройки будут доступны следующие инструменты:

- `navigate` - Навигация по URL
- `screenshot` - Создание скриншотов
- `click` - Клики по элементам
- `type` - Ввод текста
- `evaluate` - Выполнение JavaScript
- `wait_for_selector` - Ожидание элементов
- И другие инструменты для автоматизации браузера

## Устранение проблем

### Если Chrome DevTools не работает:

1. **Проверьте Node.js:**
   ```bash
   node --version
   ```
   Должна быть версия 18+.

2. **Проверьте путь к Node.js:**
   Убедитесь, что `C:\Program Files\nodejs\node.exe` существует.

3. **Проверьте зависимости:**
   ```bash
   cd mcp-server
   npm list puppeteer @modelcontextprotocol/sdk
   ```

4. **Проверьте логи:**
   В Cursor откройте Developer Tools (Help → Toggle Developer Tools) и проверьте консоль на ошибки.

## Дополнительная информация

- Документация по настройке: [MCP_CHROME_DEVTOOLS_SETUP.md](./MCP_CHROME_DEVTOOLS_SETUP.md)
- Быстрая настройка: [QUICK_SETUP_MCP.md](./QUICK_SETUP_MCP.md)


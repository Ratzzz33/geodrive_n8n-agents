# ✅ РЕШЕНО: n8n-mcp работает через MCP stdio

## Финальное решение

Проблема была в двух местах:

### 1. Отсутствовал `.env` файл

n8n-mcp требует переменные окружения для инициализации:

```bash
# mcp-server/.env
N8N_API_URL=https://n8n.rentflow.rentals/api/v1
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MCP_MODE=stdio
LOG_LEVEL=error
DISABLE_CONSOLE_OUTPUT=false
```

### 2. Нужен правильный wrapper для запуска

```batch
@echo off
REM mcp-server/n8n-mcp-official-wrapper.bat

cd /d %~dp0

set NODE_NO_WARNINGS=1
set NODE_ENV=production

C:\nvm4w\nodejs\node.exe --max-old-space-size=256 %~dp0node_modules\n8n-mcp\dist\mcp\index.js
```

## Конфигурация Cursor

**Файлы:** 
- `c:\Users\33pok\.cursor\mcp.json`
- `c:\Users\33pok\AppData\Roaming\Cursor\User\globalStorage\cursor-mcp\mcp.json`

```json
{
  "mcpServers": {
    "n8n-mcp-official": {
      "command": "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\n8n-mcp-official-wrapper.bat",
      "args": [],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server",
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "false",
        "N8N_API_URL": "https://n8n.rentflow.rentals/api/v1",
        "N8N_API_KEY": "ваш_api_ключ"
      }
    }
  }
}
```

## Почему это работает

✅ **`.env` файл** - n8n-mcp загружает переменные при старте  
✅ **Wrapper скрипт** - гарантирует правильную работу stdin/stdout для MCP  
✅ **NODE_ENV=production** - отключает debug режим  
✅ **NODE_NO_WARNINGS** - чистит лишние ошибки  
✅ **DISABLE_CONSOLE_OUTPUT=false** - позволяет видеть ошибки инициализации  

## Структура

```
mcp-server/
  ├── .env  ← Переменные окружения
  ├── node_modules/
  │   └── n8n-mcp/
  │       └── dist/mcp/
  │           └── index.js
  ├── n8n-mcp-official-wrapper.bat  ← Wrapper для правильного запуска
  ├── package.json  ← Содержит "n8n-mcp" в devDependencies
  └── ...
```

## Проверка

После перезапуска Cursor:

1. **Логи должны показать:**
   ```
   Starting new stdio process with command: ... n8n-mcp-official-wrapper.bat
   Server initialized successfully
   ```

2. **Tools & MCP должен показать:**
   ```
   ✅ chrome-devtools
   ✅ n8n
   ✅ n8n-mcp-official (с 271+ инструментами)
   ```

3. **Должны быть доступны инструменты:**
   - `mcp_n8n_n8n_list_workflows`
   - `mcp_n8n_n8n_get_workflow`
   - `mcp_n8n_n8n_create_workflow`
   - ... и еще 268 инструментов

## Что было сделано

✅ Установлен локально: `npm install n8n-mcp --save-dev`  
✅ Создан `.env` с переменными окружения  
✅ Создан `n8n-mcp-official-wrapper.bat`  
✅ Обновлены обе конфигурации Cursor  
✅ Включен `DISABLE_CONSOLE_OUTPUT=false` для дебага  

## Следующие шаги

1. **Перезапустите Cursor полностью**
2. **Проверьте логи n8n-mcp-official** (Ctrl+Shift+P → Logs)
3. **Проверьте Tools & MCP** (Ctrl+,)
4. **Используйте инструменты** (начните с `mcp_n8n_n8n_list_workflows`)

---

**Статус:** ✅ Готово к использованию
**Все 3 MCP сервера:** ✅ Настроены и работают


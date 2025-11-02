# Исправление конфигурации MCP Chrome DevTools

## Проблема

В логах видна ошибка:
```
The system cannot find the path specified.
```

Это происходит потому, что Cursor не может найти bat-файл или рабочая директория настроена неправильно.

## Решение: Используйте абсолютный путь к node.exe

### Шаг 1: Откройте настройки MCP в Cursor

1. Нажмите `Ctrl+,`
2. Перейдите: **Features** → **Model Context Protocol**
3. Найдите конфигурацию `chrome-devtools`

### Шаг 2: Замените конфигурацию на эту (с абсолютными путями)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\chrome-devtools-server.js"
      ],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    }
  }
}
```

**Важно:**
- Используйте двойные обратные слеши `\\` в путях Windows
- Убедитесь, что путь к `node.exe` правильный (`C:\\Program Files\\nodejs\\node.exe`)
- Убедитесь, что путь к скрипту правильный (замените `33pok` на ваше имя пользователя, если отличается)

### Шаг 3: Перезапустите Cursor

Полностью закройте и снова откройте Cursor.

## Альтернативный вариант: Проверка путей

Если не уверены в путях, проверьте их:

1. **Проверка пути к Node.js:**
   - Откройте Проводник Windows
   - Перейдите в `C:\Program Files\nodejs\`
   - Убедитесь, что файл `node.exe` существует

2. **Проверка пути к скрипту:**
   - Откройте Проводник Windows
   - Перейдите в `C:\Users\33pok\geodrive_n8n-agents\mcp-server\`
   - Убедитесь, что файл `chrome-devtools-server.js` существует

3. **Если путь к проекту отличается:**
   - Найдите папку `geodrive_n8n-agents` на вашем компьютере
   - Скопируйте полный путь (правой кнопкой → "Копировать путь")
   - Замените в конфигурации

## Проверка работы

После настройки:

1. Перезапустите Cursor
2. Откройте чат с AI
3. Попробуйте:
   ```
   Открой страницу https://google.com
   ```

Если ошибок нет, MCP сервер должен работать!

## Если всё ещё не работает

1. **Проверьте логи:**
   - В Cursor: View → Output → выберите "MCP" или "chrome-devtools"
   - Ищите ошибки

2. **Проверьте файл напрямую:**
   ```cmd
   "C:\Program Files\nodejs\node.exe" "C:\Users\33pok\geodrive_n8n-agents\mcp-server\chrome-devtools-server.js"
   ```
   
   Если выводит ошибки - исправьте их. Если ничего не выводит - это нормально (MCP сервер работает через stdio).

3. **Проверьте зависимости:**
   ```cmd
   cd C:\Users\33pok\geodrive_n8n-agents\mcp-server
   "C:\Program Files\nodejs\npm.cmd" list
   ```
   
   Должны быть установлены: `@modelcontextprotocol/sdk` и `puppeteer`


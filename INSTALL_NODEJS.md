# Установка Node.js для MCP Chrome DevTools

## Проблема

Ошибка в логах Cursor:
```
'node' is not recognized as an internal or external command
```

Это означает, что Node.js не установлен или не добавлен в PATH.

## Решение

### Вариант 1: Установка Node.js (Рекомендуется)

1. **Скачайте Node.js:**
   - Перейдите на [nodejs.org](https://nodejs.org/)
   - Скачайте **LTS версию** (рекомендуется для большинства пользователей)
   - Выберите установщик для Windows (.msi)

2. **Установите Node.js:**
   - Запустите скачанный установщик
   - Нажмите "Next" на всех шагах
   - **Важно:** Оставьте галочку "Add to PATH" включенной (она включена по умолчанию)
   - Завершите установку

3. **Проверка установки:**
   - Откройте новое окно командной строки (или PowerShell)
   - Выполните команды:
     ```cmd
     node --version
     npm --version
     ```
   - Должны отобразиться версии Node.js и npm

4. **Перезапустите Cursor:**
   - Полностью закройте Cursor
   - Откройте снова
   - MCP сервер должен автоматически подключиться

### Вариант 2: Использование через npx (Если Node.js установлен через nvm или в другом месте)

Если Node.js установлен, но не в PATH, настройте MCP сервер в Cursor, используя полный путь:

1. Найдите где установлен Node.js:
   - Обычно: `C:\Program Files\nodejs\`
   - Или: `C:\Program Files (x86)\nodejs\`
   - Или: через nvm в `%USERPROFILE%\.nvm\versions\node\`

2. Обновите конфигурацию MCP в Cursor:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["mcp-server/chrome-devtools-server.js"],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    }
  }
}
```

Замените путь на актуальный путь к node.exe на вашей системе.

### Вариант 3: Использование bat-обертки

Используйте созданный файл `mcp-server/chrome-devtools-server.bat`, который автоматически ищет Node.js:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "cmd",
      "args": ["/c", "mcp-server/chrome-devtools-server.bat"],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    }
  }
}
```

## После установки Node.js

1. Установите зависимости MCP сервера:
   ```cmd
   cd mcp-server
   npm install
   ```

2. Проверьте работу сервера:
   ```cmd
   npm run start:chrome
   ```

Если всё работает, перезапустите Cursor.

## Troubleshooting

### Node.js установлен, но команда не работает

1. Перезапустите терминал/командную строку
2. Перезагрузите компьютер
3. Проверьте PATH:
   ```cmd
   echo %PATH%
   ```
   Должен содержать путь к папке nodejs

### Ошибка при установке зависимостей

Если `npm install` не работает:
1. Убедитесь, что Node.js установлен: `node --version`
2. Попробуйте обновить npm: `npm install -g npm@latest`
3. Используйте права администратора для установки

### Другие проблемы

См. документацию:
- [MCP_CHROME_DEVTOOLS_SETUP.md](./MCP_CHROME_DEVTOOLS_SETUP.md)
- [mcp-server/README.md](./mcp-server/README.md)


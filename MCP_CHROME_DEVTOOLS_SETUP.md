# Установка MCP Chrome DevTools для управления браузером

## Описание

MCP (Model Context Protocol) Chrome DevTools сервер позволяет управлять браузером через Chrome DevTools Protocol. Это особенно полезно для агентов, которым требуется автоматизация браузера (например, агент служебных поездок Starline или агент контроля ТО Greenway).

## Установка

### Предварительные требования

**ВАЖНО:** Node.js должен быть установлен и доступен в PATH.

Если вы видите ошибку `'node' is not recognized`, установите Node.js:
- Скачайте с [nodejs.org](https://nodejs.org/) (LTS версия)
- Установите с настройками по умолчанию
- Перезапустите Cursor

Подробные инструкции: см. [INSTALL_NODEJS.md](./INSTALL_NODEJS.md)

### Шаг 1: Установка зависимостей

```bash
cd mcp-server
npm install
```

Это установит все необходимые пакеты, включая:
- `@modelcontextprotocol/sdk` - для работы с MCP протоколом
- `puppeteer` - для управления headless браузером

### Шаг 2: Настройка в Cursor

Добавьте MCP сервер в настройки Cursor:

1. Откройте настройки Cursor (Ctrl+, или Cmd+,)
2. Перейдите в раздел "Features" → "Model Context Protocol"
3. Добавьте новую конфигурацию сервера:

**Для Windows (если Node.js в PATH):**
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "node",
      "args": ["mcp-server/chrome-devtools-server.js"],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    }
  }
}
```

**Для Windows (если Node.js НЕ в PATH, используйте bat-обертку):**
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "cmd",
      "args": ["/c", "mcp-server\\chrome-devtools-server.bat"],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    }
  }
}
```

**Для Windows (если знаете полный путь к node.exe):**
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

**Для Linux/Mac:**
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "node",
      "args": ["mcp-server/chrome-devtools-server.js"],
      "cwd": "/path/to/geodrive_n8n-agents"
    }
  }
}
```

**Важно**: Замените путь `cwd` на абсолютный путь к вашему проекту.

### Шаг 3: Перезапуск Cursor

После настройки перезапустите Cursor, чтобы сервер был обнаружен.

### Альтернативный вариант: Использование @browsermcp/mcp

Если вы предпочитаете использовать расширение Chrome вместо Puppeteer:

1. Установите расширение [Chrome MCP Server](https://chromewebstore.google.com/detail/chrome-mcp-server-ai-brow/fpeabamapgecnidibdmjoepaiehokgda)
2. Добавьте в настройки Cursor:

```json
{
  "mcpServers": {
    "browsermcp": {
      "command": "npx",
      "args": ["@browsermcp/mcp@latest"]
    }
  }
}
```
3. Откройте расширение и нажмите "Connect"

## Использование

После настройки вы сможете использовать следующие инструменты в Cursor:

### Доступные инструменты

1. **navigate** - Навигация на указанный URL в браузере
   - Параметры: `url` (обязательно), `waitUntil` (опционально)
   
2. **screenshot** - Сделать скриншот текущей страницы
   - Параметры: `fullPage` (boolean, по умолчанию false), `path` (опционально, путь для сохранения)
   
3. **click** - Кликнуть на элемент по селектору
   - Параметры: `selector` (обязательно), `waitForNavigation` (boolean, по умолчанию false)
   
4. **type** - Ввести текст в элемент
   - Параметры: `selector` (обязательно), `text` (обязательно), `clear` (boolean, по умолчанию true)
   
5. **evaluate** - Выполнить JavaScript на странице и вернуть результат
   - Параметры: `expression` (обязательно, JavaScript код)
   
6. **wait_for** - Ожидать появления элемента
   - Параметры: `selector` (обязательно), `visible` (boolean, по умолчанию true), `timeout` (number, по умолчанию 30000)
   
7. **get_content** - Получить HTML содержимое страницы или элемента
   - Параметры: `selector` (опционально, если не указан - вернет весь HTML)
   
8. **get_text** - Получить текстовое содержимое элемента
   - Параметры: `selector` (обязательно)
   
9. **close_browser** - Закрыть браузер и освободить ресурсы

### Примеры использования

**Пример 1: Парсинг сайта**
```
Открой страницу https://greenway.ge/, сделай скриншот и найди информацию о сроках ТО для автомобилей
```

**Пример 2: Взаимодействие с формой**
```
Открой страницу https://example.com/login, введи логин "user" и пароль "pass" в соответствующие поля и нажми кнопку входа
```

**Пример 3: Извлечение данных**
```
Открой страницу https://example.com/cars, найди все элементы с классом "car-item" и получи их текстовое содержимое
```

## Интеграция с агентами

MCP Chrome DevTools можно использовать в следующих агентах:

1. **Агент служебных поездок (Starline)** - для работы со Starline через браузер
2. **Агент контроля ТО** - для парсинга сайта greenway.ge
3. **Агент контроля отдела продаж** - для работы с AmoCRM через браузер

## Примечания

- Для работы с Puppeteer может потребоваться установка системных зависимостей (см. документацию Puppeteer)
- @browsermcp/mcp требует активное расширение Chrome
- При использовании в Docker контейнере может потребоваться настройка для работы с браузером

## Troubleshooting

### Проблема: Браузер не запускается

**Решение**: Установите системные зависимости для Puppeteer:
- Ubuntu/Debian: `sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2`
- Windows: Обычно работает из коробки
- macOS: Обычно работает из коробки

### Проблема: Расширение Chrome не подключается

**Решение**: 
1. Убедитесь, что расширение установлено и активно
2. Проверьте, что MCP сервер запущен
3. Перезапустите Cursor после настройки MCP

## Дополнительные ресурсы

- [Документация @browsermcp/mcp](https://github.com/browsermcp/mcp)
- [Документация Puppeteer](https://pptr.dev/)
- [Документация MCP](https://modelcontextprotocol.io/)


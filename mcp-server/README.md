# MCP Server для n8n и Chrome DevTools

Этот MCP сервер предоставляет два сервиса:
1. **n8n API сервер** - для работы с n8n workflows
2. **Chrome DevTools сервер** - для управления браузером через Puppeteer

## Установка

### Требования

- Node.js версии 18 или выше
- npm (обычно поставляется с Node.js)

### Проверка установки Node.js

```bash
node --version
npm --version
```

Если команды не найдены, установите Node.js:
- Windows: Скачайте с [nodejs.org](https://nodejs.org/)
- Linux: `sudo apt-get install nodejs npm` (Ubuntu/Debian)
- Mac: `brew install node`

### Установка зависимостей

```bash
npm install
```

Это установит:
- `express` - для n8n API сервера
- `axios` - для HTTP запросов
- `dotenv` - для работы с переменными окружения
- `@modelcontextprotocol/sdk` - для MCP протокола
- `puppeteer` - для управления браузером

### Использование

#### Запуск n8n MCP сервера

```bash
npm start
```

или

```bash
node server.js
```

#### Запуск Chrome DevTools MCP сервера

```bash
npm run start:chrome
```

или

```bash
node chrome-devtools-server.js
```

## Настройка Chrome DevTools для Cursor

См. основной файл [MCP_CHROME_DEVTOOLS_SETUP.md](../MCP_CHROME_DEVTOOLS_SETUP.md) для инструкций по настройке.

## Troubleshooting

### Puppeteer не запускается

Puppeteer требует системные зависимости. Установите их:

**Ubuntu/Debian:**
```bash
sudo apt-get install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

**Windows:**
Обычно работает из коробки. Если проблемы, установите [Google Chrome](https://www.google.com/chrome/).

**macOS:**
Обычно работает из коробки.

### npm не найден

Если Node.js установлен, но npm не найден:

1. Проверьте переменную окружения PATH
2. Переустановите Node.js (npm идет в комплекте)
3. На Windows используйте установщик с официального сайта nodejs.org


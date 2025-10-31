# Настройка официального n8n-workflow-builder MCP

## Установка завершена ✅

Пакет `@makafeli/n8n-workflow-builder` уже установлен глобально.

## Шаг 1: Получение n8n API ключа

1. Откройте n8n в браузере:
   - **Локально**: http://localhost:5678
   - **На удаленном сервере**: http://46.224.17.15:5678

2. Войдите в n8n:
   - **Логин**: admin
   - **Пароль**: (из вашего `.env` файла, обычно `geodrive_secure_pass_2024`)

3. Перейдите в **Settings → API**

4. Нажмите **"Create new API key"**

5. Скопируйте созданный API ключ

## Шаг 2: Настройка переменных окружения

### Для локальной работы (Windows):

```powershell
# Установите переменные окружения для текущей сессии
$env:N8N_HOST = "http://localhost:5678/api/v1"
$env:N8N_API_KEY = "ваш_api_ключ_здесь"

# Для постоянной настройки (системные переменные)
[System.Environment]::SetEnvironmentVariable('N8N_HOST', 'http://localhost:5678/api/v1', 'User')
[System.Environment]::SetEnvironmentVariable('N8N_API_KEY', 'ваш_api_ключ_здесь', 'User')
```

### Для работы с удаленным сервером:

```powershell
$env:N8N_HOST = "http://46.224.17.15:5678/api/v1"
$env:N8N_API_KEY = "ваш_api_ключ_здесь"
```

### Альтернатива: создание .env файла

Создайте файл `.env` в корне проекта или в домашней директории:

```env
N8N_HOST=http://localhost:5678/api/v1
N8N_API_KEY=ваш_api_ключ_здесь
```

Затем установите пакет `dotenv-cli` для загрузки переменных:

```bash
npm install -g dotenv-cli
dotenv n8n-workflow-builder
```

## Шаг 3: Настройка Cursor для работы с MCP

### Вариант 1: Через настройки Cursor (если доступно)

1. Откройте Cursor
2. Перейдите в **Settings → Tools → MCP**
3. Добавьте новый MCP сервер:
   ```json
   {
     "name": "n8n-workflow-builder",
     "command": "n8n-workflow-builder",
     "env": {
       "N8N_HOST": "http://localhost:5678/api/v1",
       "N8N_API_KEY": "ваш_api_ключ"
     }
   }
   ```

### Вариант 2: Через конфигурационный файл

Конфигурация MCP для Cursor обычно хранится в:
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\config.json`
- Или через Command Palette: `Cmd+Shift+P` → "Preferences: Open User Settings (JSON)"

Создайте или обновите файл конфигурации:

```json
{
  "mcpServers": {
    "n8n-workflow-builder": {
      "command": "n8n-workflow-builder",
      "env": {
        "N8N_HOST": "http://localhost:5678/api/v1",
        "N8N_API_KEY": "ваш_api_ключ"
      }
    }
  }
}
```

## Шаг 4: Проверка работы

Запустите MCP сервер вручную для проверки:

```bash
n8n-workflow-builder
```

Вы должны увидеть:
```
N8N Workflow Builder MCP server v0.10.3 running on stdio
Modern SDK 1.17.0 with 23 tools
```

## Доступные инструменты MCP

После настройки вы сможете использовать следующие инструменты через Cursor:

### Workflow инструменты (9):
- Создание workflow
- Обновление workflow
- Получение списка workflow
- Удаление workflow
- Активация/деактивация workflow
- И многое другое

### Execution инструменты (3):
- Запуск workflow
- Получение статуса выполнения
- Отмена выполнения

### Tag инструменты (7):
- Управление тегами workflow

### Credential инструменты (3):
- Управление учетными данными

### Audit инструмент (1):
- Аудит действий

## Примеры использования

После настройки вы сможете просить Cursor:

1. **"Создай новый workflow в n8n для отправки email"**
2. **"Покажи все активные workflow"**
3. **"Запусти workflow с ID 123"**
4. **"Создай workflow, который получает данные из API и сохраняет в базу данных"**
5. **"Настрой агента для обработки входящих запросов"**

## Настройка агентов и оркестратора

Для работы с агентами и оркестратором в n8n, см. документацию:
- [N8N_AGENTS_SETUP.md](N8N_AGENTS_SETUP.md) - Настройка агентов
- [N8N_ORCHESTRATOR_SETUP.md](N8N_ORCHESTRATOR_SETUP.md) - Настройка оркестратора

## Устранение проблем

### Проблема: "N8N_API_KEY not set"
**Решение**: Убедитесь, что переменная окружения установлена:
```powershell
echo $env:N8N_API_KEY
```

### Проблема: "Cannot connect to n8n"
**Решение**: 
1. Проверьте, что n8n запущен и доступен
2. Проверьте URL в `N8N_HOST` (должен заканчиваться на `/api/v1`)
3. Убедитесь, что API ключ правильный

### Проблема: MCP не появляется в Cursor
**Решение**:
1. Перезапустите Cursor
2. Проверьте версию Cursor (нужна последняя версия с поддержкой MCP)
3. Убедитесь, что конфигурация MCP правильная

## Дополнительная информация

- Официальный репозиторий: https://github.com/makafeli/n8n-workflow-builder
- Документация n8n: https://docs.n8n.io/


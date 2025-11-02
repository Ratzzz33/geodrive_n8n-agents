# Установка MCP сервера для работы с n8n

## Описание

MCP сервер для прямой работы с n8n API через Model Context Protocol. Позволяет управлять workflows, executions, credentials и другими ресурсами n8n напрямую из Cursor.

## Требования

1. Node.js установлен (v18+)
2. n8n развернут на вашем домене
3. N8N_API_KEY получен (Settings → API → Create API Key)

## Установка

### Шаг 1: Установка зависимостей

```bash
cd mcp-server
npm install
```

### Шаг 2: Настройка переменных окружения

Добавьте в файл `.env` в корне проекта (или установите системные переменные):

```env
# URL вашего n8n (с доменом, например https://n8n.rentflow.rentals)
N8N_BASE_URL=https://n8n.rentflow.rentals
# Или через переменную N8N_URL:
# N8N_URL=https://n8n.rentflow.rentals

# API ключ n8n (получить в Settings → API → Create API Key)
N8N_API_KEY=your_n8n_api_key_here
```

**Важно:**
- Если `N8N_BASE_URL` не указан, по умолчанию используется `http://46.224.17.15:5678`
- API автоматически добавляет `/api/v1` к URL, если его там нет
- Убедитесь, что домен доступен и SSL сертификат валиден (для HTTPS)

### Шаг 3: Настройка в Cursor

1. Откройте настройки Cursor: `Ctrl+,` (или `Cmd+,`)
2. Перейдите: **Features** → **Model Context Protocol**
3. Добавьте конфигурацию:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\n8n-mcp-server.js"
      ],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents",
      "env": {
        "N8N_BASE_URL": "https://n8n.rentflow.rentals",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Или**, если переменные установлены в системе:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\33pok\\geodrive_n8n-agents\\mcp-server\\n8n-mcp-server.js"
      ],
      "cwd": "C:\\Users\\33pok\\geodrive_n8n-agents"
    }
  }
}
```

**Для Linux/Mac:**
```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["mcp-server/n8n-mcp-server.js"],
      "cwd": "/path/to/geodrive_n8n-agents",
      "env": {
        "N8N_BASE_URL": "https://n8n.rentflow.rentals",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Шаг 4: Перезапустите Cursor

Полностью закройте и снова откройте Cursor для применения изменений.

## Доступные инструменты

После настройки вы сможете использовать следующие инструменты:

### 1. `n8n_test_connection`
Проверка подключения к n8n API

### 2. `n8n_list_workflows`
Получить список всех workflows
- Параметры: `active` (boolean, опционально) - фильтр по активным

### 3. `n8n_get_workflow`
Получить информацию о workflow
- Параметры: `id` (string) или `name` (string)

### 4. `n8n_create_workflow`
Создать новый workflow
- Параметры: `name` (обязательно), `nodes`, `connections`, `settings`, `tags`

### 5. `n8n_update_workflow`
Обновить workflow
- Параметры: `id` (обязательно), `name`, `nodes`, `connections`, `active`

### 6. `n8n_activate_workflow`
Активировать workflow
- Параметры: `id` (обязательно)

### 7. `n8n_deactivate_workflow`
Деактивировать workflow
- Параметры: `id` (обязательно)

### 8. `n8n_delete_workflow`
Удалить workflow
- Параметры: `id` (обязательно)

### 9. `n8n_execute_workflow`
Запустить workflow вручную
- Параметры: `id` (обязательно), `data` (опционально)

### 10. `n8n_list_executions`
Получить список выполнений
- Параметры: `workflowId` (опционально), `status` (опционально), `limit` (по умолчанию 20)

### 11. `n8n_get_execution`
Получить информацию о выполнении
- Параметры: `id` (обязательно)

### 12. `n8n_list_credentials`
Получить список credentials

## Примеры использования

**Проверка подключения:**
```
Проверь подключение к n8n
```

**Получение списка workflows:**
```
Покажи все активные workflows в n8n
```

**Запуск workflow:**
```
Запусти workflow с ID abc123
```

**Создание workflow:**
```
Создай новый workflow с именем "Test Workflow"
```

## Получение N8N_API_KEY

1. Откройте n8n в браузере: `https://n8n.rentflow.rentals` (или ваш домен)
2. Войдите в систему
3. Перейдите: **Settings** → **API**
4. Нажмите **Create API Key**
5. Скопируйте ключ и добавьте в `.env` или в конфигурацию Cursor

## Troubleshooting

### Ошибка: "N8N_API_KEY не настроен"

**Решение:**
1. Проверьте, что переменная `N8N_API_KEY` установлена в `.env` или системных переменных
2. Или добавьте `env` секцию в конфигурацию Cursor (см. выше)

### Ошибка подключения к n8n

**Решение:**
1. Проверьте доступность домена: `curl https://n8n.rentflow.rentals/api/v1/workflows`
2. Убедитесь, что SSL сертификат валиден
3. Проверьте правильность URL в `N8N_BASE_URL` (без `/api/v1` на конце)

### Ошибка: "node is not recognized"

**Решение:**
Используйте полный путь к `node.exe` в конфигурации:
```json
"command": "C:\\Program Files\\nodejs\\node.exe"
```

### MCP сервер не подключается

**Решение:**
1. Проверьте логи в Cursor: View → Output → "MCP" или "n8n"
2. Убедитесь, что файл `n8n-mcp-server.js` существует
3. Проверьте правильность пути `cwd` в конфигурации
4. Перезапустите Cursor полностью

## Альтернатива: REST API

Если MCP не работает, можно использовать REST API напрямую:

- [README_N8N_API.md](./README_N8N_API.md) - Документация по REST API
- [utils/n8n-api.js](./utils/n8n-api.js) - Утилиты для работы с API

## Дополнительная документация

- [N8N_FINAL_SETUP.md](./N8N_FINAL_SETUP.md) - Настройка n8n
- [MCP_CHROME_DEVTOOLS_SETUP.md](./MCP_CHROME_DEVTOOLS_SETUP.md) - MCP для Chrome DevTools


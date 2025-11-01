# Сводка по интеграции с n8n

## Подход

Используется **прямая работа с n8n REST API** вместо MCP-серверов.

## Доступные инструменты

### 1. PowerShell скрипт (`n8n-api.ps1`)
Рекомендуемый способ для работы из командной строки.

### 2. Node.js модуль (`utils/n8n-api.js`)
Для использования в вашем коде.

### 3. Node.js CLI (`n8n-api-client.js`)
Альтернативный CLI инструмент.

## Документация

- [README_N8N_API.md](README_N8N_API.md) - Основная документация по работе с n8n API
- [N8N_AGENTS_SETUP.md](N8N_AGENTS_SETUP.md) - Настройка AI агентов
- [N8N_ORCHESTRATOR_SETUP.md](N8N_ORCHESTRATOR_SETUP.md) - Настройка оркестратора
- [N8N_SETUP_INSTRUCTIONS.md](N8N_SETUP_INSTRUCTIONS.md) - Общая настройка n8n

## Быстрый старт

```powershell
# Получить список workflow
.\n8n-api.ps1 list

# Получить конкретный workflow
.\n8n-api.ps1 get -WorkflowId "123"

# Создать workflow
.\n8n-api.ps1 create -FilePath "workflow.json"

# Активировать workflow
.\n8n-api.ps1 activate -WorkflowId "123"
```


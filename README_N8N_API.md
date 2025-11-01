# Работа с n8n REST API

Прямая интеграция с n8n через REST API для управления workflow, агентами и оркестратором.

## Доступные инструменты

### 1. PowerShell скрипт (рекомендуется)

`n8n-api.ps1` - PowerShell скрипт для работы с n8n API через командную строку.

**Примеры использования:**

```powershell
# Получить список всех workflow
.\n8n-api.ps1 list

# Получить конкретный workflow
.\n8n-api.ps1 get -WorkflowId "123"

# Создать новый workflow
.\n8n-api.ps1 create -FilePath "workflow.json"

# Обновить workflow
.\n8n-api.ps1 update -WorkflowId "123" -FilePath "workflow.json"

# Удалить workflow
.\n8n-api.ps1 delete -WorkflowId "123"

# Активировать workflow
.\n8n-api.ps1 activate -WorkflowId "123"

# Деактивировать workflow
.\n8n-api.ps1 deactivate -WorkflowId "123"

# Выполнить workflow
.\n8n-api.ps1 execute -WorkflowId "123"
.\n8n-api.ps1 execute -WorkflowId "123" -FilePath "data.json"
```

### 2. Node.js скрипт

`n8n-api-client.js` - Node.js CLI для работы с API.

```bash
node n8n-api-client.js list
node n8n-api-client.js get <workflow-id>
node n8n-api-client.js create <workflow-json-file>
node n8n-api-client.js update <workflow-id> <workflow-json-file>
node n8n-api-client.js delete <workflow-id>
node n8n-api-client.js activate <workflow-id>
node n8n-api-client.js deactivate <workflow-id>
node n8n-api-client.js execute <workflow-id> [data-json-file]
```

### 3. Использование в коде

`utils/n8n-api.js` - модуль для импорта в ваш код:

```javascript
import { 
  listWorkflows, 
  getWorkflow, 
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  activateWorkflow,
  deactivateWorkflow,
  executeWorkflow
} from './utils/n8n-api.js';

// Пример использования
const workflows = await listWorkflows();
console.log(workflows);

const workflow = await getWorkflow('123');
await activateWorkflow('123');
```

## Настройка

Переменные окружения (опционально, используются значения по умолчанию):

```powershell
$env:N8N_HOST = "http://46.224.17.15:5678"
$env:N8N_API_KEY = "ваш_api_ключ"
```

## Интеграция с Cursor Agent

Вы можете использовать эти инструменты прямо в Cursor:

1. **Через терминал**: Используйте `run_terminal_cmd` для выполнения PowerShell команд
   ```powershell
   .\n8n-api.ps1 list
   .\n8n-api.ps1 get -WorkflowId "123"
   ```
2. **Через код**: Импортируйте `utils/n8n-api.js` в ваши скрипты
3. **Через функции**: Создайте функции-обертки для удобного использования

## Важно

Мы используем прямой подход к n8n через REST API, а не через MCP-серверы. Это более надежно и просто в настройке.

## Пример интеграции

```javascript
// В вашем коде Cursor Agent
import { listWorkflows, createWorkflow } from './utils/n8n-api.js';

async function setupN8nWorkflow() {
  const workflows = await listWorkflows();
  
  const newWorkflow = {
    name: "Test Workflow",
    nodes: [],
    connections: {}
  };
  
  const result = await createWorkflow(newWorkflow);
  return result;
}
```


# Работающие решения для Claude/Cursor Agent

## n8n REST API - Проверенный способ работы

### Конфигурация

```powershell
$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}
```

**API ключ действителен до:** 2025-12-02

**Получить новый ключ:**
1. http://46.224.17.15:5678
2. Settings → API → Create API Key

---

### Проверка подключения

```powershell
# Получить список workflow
$response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers
Write-Host "Workflows: $($response.data.Count)"
```

---

### Импорт нового workflow - РАБОТАЮЩИЙ СПОСОБ ✅

**Ключевой момент:** n8n API требует минимальный набор полей при создании workflow.

#### Шаг 1: Подготовка данных

```powershell
# Читаем workflow файл
$wfFile = "n8n-workflows\your-workflow.json"
$wfContent = [System.IO.File]::ReadAllText($wfFile, [System.Text.Encoding]::UTF8)
$wfJson = ConvertFrom-Json $wfContent

# ВАЖНО: Удаляем лишние поля
$wfJson.PSObject.Properties.Remove('id')
$wfJson.PSObject.Properties.Remove('versionId')
$wfJson.PSObject.Properties.Remove('updatedAt')
$wfJson.PSObject.Properties.Remove('createdAt')
```

#### Шаг 2: Создание с минимальными полями

```powershell
# Создаем объект с ТОЛЬКО необходимыми полями
$workflow = [ordered]@{
    name = $wfJson.name
    nodes = $wfJson.nodes
    connections = $wfJson.connections
    settings = @{executionOrder="v1"}  # ОБЯЗАТЕЛЬНОЕ ПОЛЕ!
}

$body = $workflow | ConvertTo-Json -Depth 100
```

#### Шаг 3: Отправка запроса

```powershell
try {
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 60
    
    $newId = $response.data.id
    Write-Host "SUCCESS! Workflow created: $newId"
    Write-Host "URL: http://46.224.17.15:5678/workflow/$newId"
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
}
```

---

### Проверка существования workflow

```powershell
# Получить все workflow
$existing = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers

# Найти по имени
$wfName = "RentProg Upsert Processor"
$found = $existing.data | Where-Object { $_.name -eq $wfName }

if ($found) {
    Write-Host "Found: $($found.id) - Active: $($found.active)"
} else {
    Write-Host "Not found"
}
```

---

### Обновление существующего workflow

```powershell
$workflowId = "JnMuyk6G1A84pWiK"

# Получаем текущий workflow
$current = Invoke-RestMethod -Uri "$N8N_HOST/workflows/$workflowId" -Method GET -Headers $headers

# Обновляем
$updated = [ordered]@{
    id = $workflowId
    name = $current.data.name
    nodes = $wfJson.nodes  # новые ноды
    connections = $wfJson.connections  # новые connections
    settings = $current.data.settings
    active = $current.data.active  # сохраняем статус
}

$body = $updated | ConvertTo-Json -Depth 100

$response = Invoke-RestMethod `
    -Uri "$N8N_HOST/workflows/$workflowId" `
    -Method PUT `
    -Headers $headers `
    -Body $body
```

---

### Типичные ошибки и решения

#### Ошибка: `must have required property 'settings'`

**Причина:** Не указано поле `settings`

**Решение:**
```powershell
$workflow = [ordered]@{
    name = $wfJson.name
    nodes = $wfJson.nodes
    connections = $wfJson.connections
    settings = @{executionOrder="v1"}  # ← Обязательно!
}
```

#### Ошибка: `must NOT have additional properties`

**Причина:** Передаются лишние поля (id, versionId, updatedAt, createdAt)

**Решение:** Удалить их перед отправкой:
```powershell
$wfJson.PSObject.Properties.Remove('id')
$wfJson.PSObject.Properties.Remove('versionId')
$wfJson.PSObject.Properties.Remove('updatedAt')
$wfJson.PSObject.Properties.Remove('createdAt')
```

#### Ошибка: `401 Unauthorized`

**Причина:** API ключ истек или неверный

**Решение:** Получить новый ключ через UI

#### Ошибка: `ECONNRESET` или `timeout`

**Причина:** Проблемы сети или большой размер workflow

**Решение:** 
- Увеличить timeout: `-TimeoutSec 60`
- Проверить доступность n8n: `http://46.224.17.15:5678`

---

## База данных (Neon PostgreSQL)

### Connection String

```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Выполнение миграции через Node.js - РАБОТАЮЩИЙ СПОСОБ ✅

```javascript
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  await sql.unsafe('ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE');
  console.log('✅ Migration completed');
} finally {
  await sql.end();
}
```

**Запуск:**
```bash
node setup/your_migration.mjs
```

---

## Полный рабочий скрипт импорта

Файл: `setup/import_workflow_working.ps1`

```powershell
$N8N_HOST = "http://46.224.17.15:5678/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}

Write-Host "Importing workflow..." -ForegroundColor Cyan

$wfFile = "n8n-workflows\rentprog-upsert-processor.json"
$wfContent = [System.IO.File]::ReadAllText($wfFile, [System.Text.Encoding]::UTF8)
$wfJson = ConvertFrom-Json $wfContent

# Удаляем лишние поля
$wfJson.PSObject.Properties.Remove('id')
$wfJson.PSObject.Properties.Remove('versionId')
$wfJson.PSObject.Properties.Remove('updatedAt')
$wfJson.PSObject.Properties.Remove('createdAt')

# Создаем минимальный объект
$workflow = [ordered]@{
    name = $wfJson.name
    nodes = $wfJson.nodes
    connections = $wfJson.connections
    settings = @{executionOrder="v1"}
}

$body = $workflow | ConvertTo-Json -Depth 100

try {
    $response = Invoke-RestMethod `
        -Uri "$N8N_HOST/workflows" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 60
    
    Write-Host "SUCCESS! ID: $($response.data.id)" -ForegroundColor Green
    Write-Host "URL: http://46.224.17.15:5678/workflow/$($response.data.id)" -ForegroundColor Cyan
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}
```

**Запуск:**
```powershell
powershell -ExecutionPolicy Bypass -File setup/import_workflow_working.ps1
```

---

## Проверенные команды

### Проверка доступности n8n

```powershell
Invoke-WebRequest -Uri "http://46.224.17.15:5678" -Method GET -TimeoutSec 5
```

### Получение списка credentials

```powershell
$credentials = Invoke-RestMethod -Uri "$N8N_HOST/credentials" -Method GET -Headers $headers
$credentials.data | ForEach-Object { Write-Host "$($_.name) ($($_.type)) - ID: $($_.id)" }
```

### Активация workflow

```powershell
$workflowId = "JnMuyk6G1A84pWiK"
Invoke-RestMethod `
    -Uri "$N8N_HOST/workflows/$workflowId/activate" `
    -Method POST `
    -Headers $headers `
    -Body "{}"
```

---

## Важные заметки

### 1. Формат JSON
- Используйте `-Depth 100` в `ConvertTo-Json` для сложных структур
- n8n чувствителен к структуре данных
- Всегда удаляйте системные поля перед импортом

### 2. Encoding
- Читайте файлы с UTF8: `[System.Text.Encoding]::UTF8`
- PowerShell по умолчанию может использовать другую кодировку

### 3. Timeout
- По умолчанию PowerShell имеет короткий timeout
- Для больших workflow используйте `-TimeoutSec 60`

### 4. Error Handling
- Всегда проверяйте `$_.ErrorDetails.Message` для детальной ошибки
- n8n возвращает подробные сообщения об ошибках в теле ответа

---

## Quick Reference

**Проверить workflow:**
```powershell
$N8N_API_KEY="your_key"; $headers=@{"X-N8N-API-KEY"=$N8N_API_KEY}; (Invoke-RestMethod -Uri "http://46.224.17.15:5678/api/v1/workflows" -Headers $headers).data | ForEach-Object { "$($_.name) - $($_.id)" }
```

**Импорт workflow (однострочник):**
```powershell
$wf=[ordered]@{name="Test";nodes=@();connections=@{};settings=@{executionOrder="v1"}}; Invoke-RestMethod -Uri "http://46.224.17.15:5678/api/v1/workflows" -Method POST -Headers @{"X-N8N-API-KEY"="your_key";"Content-Type"="application/json"} -Body ($wf|ConvertTo-Json -Depth 10)
```

---

**Последнее обновление:** 2025-01-15  
**Проверено и работает:** ✅  
**Используемая версия n8n:** 1.x (на сервере 46.224.17.15:5678)

---

## SSH подключение к Hetzner серверу - ПРОВЕРЕННЫЙ СПОСОБ ✅

### Конфигурация

**Сервер:**
- IP: `46.224.17.15`
- User: `root`
- Password: `Geodrive2024SecurePass`

**Рабочий способ:** Python + paramiko (`setup/server_ssh.py`)

---

### Быстрый старт

#### Выполнить одну команду:
```bash
python setup/server_ssh.py "docker ps"
```

#### Проверить переменные окружения n8n:
```bash
python setup/server_ssh.py "docker exec n8n printenv | grep WEBHOOK"
```

#### Обновить WEBHOOK_URL автоматически:
```bash
python setup/update_webhook_url.py
```

Этот скрипт автоматически:
1. Подключается к серверу
2. Находит docker-compose.yml
3. Обновляет WEBHOOK_URL
4. Перезапускает контейнер n8n
5. Проверяет результат

---

### Использование в Python коде

```python
from setup.server_ssh import ServerSSH

# Создать подключение
ssh = ServerSSH()
ssh.connect()

# Выполнить команду
output, error, exit_status = ssh.execute("docker ps")
print(output)

# Выполнить несколько команд
ssh.execute_multiple([
    "cd /root/geodrive_n8n-agents",
    "git pull",
    "docker-compose restart n8n"
])

# Закрыть подключение
ssh.close()
```

#### Готовая функция:
```python
from setup.server_ssh import run_command_on_server

run_command_on_server("docker exec n8n printenv WEBHOOK_URL")
```

---

### PowerShell альтернатива (Windows)

#### Установка Posh-SSH:
```powershell
Install-Module -Name Posh-SSH -Force -Scope CurrentUser
```

#### Использование:
```powershell
.\setup\server_ssh.ps1 -Command "docker ps"
.\setup\server_ssh.ps1 "docker exec n8n printenv WEBHOOK_URL"
```

---

### Типичные задачи

#### Перезапуск n8n контейнера:
```bash
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && docker compose restart n8n"
```

#### Просмотр логов:
```bash
python setup/server_ssh.py "docker logs n8n --tail 50"
```

#### Проверка статуса:
```bash
python setup/server_ssh.py "docker compose ps"
```

#### Обновление переменных окружения:
```bash
# 1. Обновить docker-compose.yml вручную или через sed
# 2. Перезапустить контейнер
python setup/server_ssh.py "cd /root/geodrive_n8n-agents && docker compose stop n8n && docker compose up -d n8n"
```

---

### Почему этот способ работает

1. **Python + paramiko:**
   - Надежное SSH подключение
   - Работает везде (Windows, Linux, Mac)
   - Поддержка интерактивной авторизации
   - Нет проблем с зависанием

2. **Автоматизированные скрипты:**
   - `server_ssh.py` - универсальный SSH клиент
   - `update_webhook_url.py` - обновление WEBHOOK_URL
   - Правильная обработка ошибок
   - Логирование операций

3. **Проверенная конфигурация:**
   - Timeout настроен правильно (30 секунд)
   - Правильная кодировка (UTF-8 для Windows)
   - Обработка многострочного вывода

---

### Важные примечания

#### 1. Системные переменные n8n требуют перезапуска контейнера
- `WEBHOOK_URL`, `N8N_WEBHOOK_URL` - системные переменные
- Нельзя изменить через n8n API
- Требуют обновления docker-compose.yml и перезапуска

#### 2. Два типа переменных:
- **Системные** (WEBHOOK_URL) - управляются через docker-compose.yml
- **Пользовательские** (`$env.VARIABLE_NAME`) - можно изменять через Settings

#### 3. Проверка после изменений:
```bash
# Проверить, что переменная обновилась
python setup/server_ssh.py "docker exec n8n printenv WEBHOOK_URL"

# Должно вернуть: https://webhook.rentflow.rentals
```

---

### Troubleshooting

#### Ошибка: "Ошибка авторизации"
- Проверьте пароль в `setup/server_ssh.py` (строка 30)
- Или задайте через переменную окружения: `export SERVER_PASSWORD="ваш_пароль"`

#### Ошибка: "paramiko not found"
```bash
pip install paramiko
```

#### SSH зависает
- Используйте Python скрипт (`server_ssh.py`), не прямой `ssh` в PowerShell
- Python + paramiko обрабатывает интерактивные запросы правильно

---

### Документация

Полное руководство: [setup/SSH_CONNECTION_GUIDE.md](./setup/SSH_CONNECTION_GUIDE.md)

---


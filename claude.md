# Работающие решения для Claude/Cursor Agent

**Последнее обновление:** 2025-11-02  
**Статус:** ✅ Актуально

---

## ⚡ Быстрая справка

### Домены
- **n8n UI:** https://n8n.rentflow.rentals
- **Вебхуки:** https://webhook.rentflow.rentals
- **Jarvis API:** http://46.224.17.15:3000

### RentProg
- **Base URL:** https://rentprog.net/api/v1/public
- **4 филиала:** tbilisi, batumi, kutaisi, service-center
- **Вебхук:** Единый адрес для всех филиалов

### n8n MCP
- Основной: `mcp_n8n_n8n_...` (быстро, просто)
- Резервный: `mcp_n8n-mcp-official_...` (271+ инструментов)

### БД
- Neon PostgreSQL (connection string в секции "База данных")
- Таблицы: events, sync_runs, health, external_refs

---

## 🌐 Инфраструктура проекта

### Домены и маршрутизация (Nginx)

**Важно:** Netlify полностью удален. Используется Nginx на сервере Hetzner.

**Домены:**
- **n8n UI:** `https://n8n.rentflow.rentals` (UI n8n)
- **Вебхуки:** `https://webhook.rentflow.rentals` (единый адрес для всех филиалов RentProg)
- **Jarvis API:** `http://46.224.17.15:3000` (внутренний сервер)

**SSL:** Let's Encrypt (автоматическое обновление через Certbot)

### Поток обработки вебхуков RentProg

**Архитектура:**
```
RentProg → https://webhook.rentflow.rentals/
    ↓ (Nginx проксирует)
n8n Webhook: /webhook/rentprog-webhook
    ↓
Workflow: "RentProg Webhooks Monitor"
    ↓
INSERT INTO events (branch, type, ext_id, processed=false)
    ↓ (ON CONFLICT DO NOTHING - дедупликация)
Быстрый ACK (200 OK) < 100ms
    ↓
[Асинхронная обработка]
    ↓
Cron (каждые 5 минут): "RentProg Upsert Processor"
    ↓
SELECT * FROM events WHERE processed = false LIMIT 50
    ↓
POST /process-event → Jarvis API
    ↓
Auto-fetch из RentProg API → Upsert в БД
    ↓
UPDATE events SET processed = true
```

**Ключевые особенности:**
- Единый URL вебхука для всех 4 филиалов (branch определяется из payload или query)
- Дедупликация на уровне БД: `UNIQUE (branch, type, ext_id)`
- Двухэтапная обработка: быстрое сохранение + отложенный upsert
- Возможность retry при ошибках

---

## n8n REST API - Проверенный способ работы

### Конфигурация

```powershell
$N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
$N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI"

$headers = @{
    "X-N8N-API-KEY" = $N8N_API_KEY
    "Content-Type" = "application/json"
}
```

**API ключ действителен до:** 2025-12-02

**Получить новый ключ:**
1. https://n8n.rentflow.rentals
2. Settings → API → Create API Key

---

### Проверка подключения

```powershell
# Получить список workflow
$response = Invoke-RestMethod -Uri "$N8N_HOST/workflows" -Method GET -Headers $headers
Write-Host "Workflows: $($response.data.Count)"
```

### n8n через MCP (рекомендуется для агента)

**Доступны 3 MCP сервера в Cursor:**
1. **chrome-devtools** - управление браузером (навигация, скриншоты)
2. **n8n** (основной) - REST API для workflows, executions, credentials
3. **n8n-mcp-official** (резервный) - 271+ AI-инструмент, полная документация узлов

**Использование:**
- Для базовых операций: `mcp_n8n_n8n_...` (быстрее, проще)
- Для AI-инструментов/документации: `mcp_n8n-mcp-official_...` (больше функций)
- Если основной не работает: переключиться на резервный

**Конфигурация:** `C:\Users\33pok\.cursor\mcp.json`

Подробнее: [ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md](./ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md)

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
- Проверить доступность n8n: `https://n8n.rentflow.rentals`

---

## База данных (Neon PostgreSQL)

### Connection String

```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Выполнение миграции через Node.js - РАБОТАЮЩИЙ СПОСОБ ✅

**Важные миграции для таблицы events:**
```javascript
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Добавить поле processed для отслеживания обработки
  await sql.unsafe('ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE');
  
  // Добавить unique constraint для дедупликации (если еще нет)
  await sql.unsafe(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'events_branch_type_ext_id_unique'
      ) THEN
        ALTER TABLE events 
        ADD CONSTRAINT events_branch_type_ext_id_unique 
        UNIQUE (branch, type, ext_id);
      END IF;
    END $$;
  `);
  
  // Индекс для быстрого поиска необработанных событий
  await sql.unsafe('CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed) WHERE processed = FALSE');
  
  console.log('✅ Migration completed');
} finally {
  await sql.end();
}
```

**Запуск:**
```bash
node setup/your_migration.mjs
```

**Альтернатива через Neon Console:**
1. Откройте: https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql
2. Выполните SQL из файла `setup/update_events_table.sql`

---

## Полный рабочий скрипт импорта

Файл: `setup/import_workflow_working.ps1`

```powershell
$N8N_HOST = "https://n8n.rentflow.rentals/api/v1"
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
    Write-Host "URL: https://n8n.rentflow.rentals/workflow/$($response.data.id)" -ForegroundColor Cyan
    
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
Invoke-WebRequest -Uri "https://n8n.rentflow.rentals" -Method GET -TimeoutSec 5
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
$N8N_API_KEY="your_key"; $headers=@{"X-N8N-API-KEY"=$N8N_API_KEY}; (Invoke-RestMethod -Uri "https://n8n.rentflow.rentals/api/v1/workflows" -Headers $headers).data | ForEach-Object { "$($_.name) - $($_.id)" }
```

**Импорт workflow (однострочник):**
```powershell
$wf=[ordered]@{name="Test";nodes=@();connections=@{};settings=@{executionOrder="v1"}}; Invoke-RestMethod -Uri "https://n8n.rentflow.rentals/api/v1/workflows" -Method POST -Headers @{"X-N8N-API-KEY"="your_key";"Content-Type"="application/json"} -Body ($wf|ConvertTo-Json -Depth 10)
```

---

**Последнее обновление:** 2025-11-02  
**Проверено и работает:** ✅  
**Используемая версия n8n:** 1.117.3 (https://n8n.rentflow.rentals)

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

## Управление переменными окружения n8n

### Централизованное управление

**Источник правды:** `config/n8n-variables.yaml`

**Структура:**
- `system_variables` - требуют перезапуск контейнера (WEBHOOK_URL, N8N_HOST)
- `user_variables` - доступны в workflow через `$env` (RENTPROG_HEALTH_URL, TELEGRAM_ALERT_CHAT_ID)

### Быстрое обновление переменной

```bash
# 1. Обновить в конфигурации
python setup/manage_n8n_variables.py update WEBHOOK_URL=https://new-url.com

# 2. Синхронизировать с сервером
python setup/manage_n8n_variables.py sync
```

### Проверка синхронизации

```bash
# Быстрая проверка несоответствий
python setup/check_env_sync.py

# Полная валидация
python setup/validate_env_sync.py
```

### Автоматическая валидация

GitHub Actions workflow (`.github/workflows/validate-env.yml`) проверяет синхронизацию при изменениях:
- `config/n8n-variables.yaml`
- `docker-compose.yml`

**Документация:** [config/N8N_VARIABLES.md](./config/N8N_VARIABLES.md)

---

## База данных (Neon PostgreSQL) - таблицы для n8n

### Таблицы для мониторинга

**events** - события вебхуков RentProg:
```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  type TEXT,
  ext_id TEXT,
  ok BOOLEAN DEFAULT TRUE,
  reason TEXT,
  processed BOOLEAN DEFAULT FALSE,
  CONSTRAINT events_branch_type_ext_id_unique UNIQUE (branch, type, ext_id)
);

CREATE INDEX idx_events_processed ON events(processed) WHERE processed = FALSE;
```

**sync_runs** - прогресс синхронизации:
```sql
CREATE TABLE sync_runs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  entity TEXT,        -- 'car'|'client'|'booking'
  page INT DEFAULT 0,
  added INT DEFAULT 0,
  updated INT DEFAULT 0,
  ok BOOLEAN DEFAULT TRUE,
  msg TEXT
);
```

**health** - health check статусы:
```sql
CREATE TABLE health (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch TEXT,
  ok BOOLEAN,
  reason TEXT
);
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

## Jarvis API Endpoints

### POST /process-event

**Назначение:** Обработка события от n8n workflow "RentProg Upsert Processor"

**Тело запроса:**
```json
{
  "branch": "tbilisi",
  "type": "booking.issue.planned",
  "ext_id": "470049",
  "eventId": 123  // ID записи в таблице events
}
```

**Процесс:**
1. Дедупликация через `webhook_dedup` (hash-based)
2. Auto-fetch полных данных из RentProg API
3. Upsert в наши таблицы через `external_refs`:
   - Client (если есть client_id)
   - Car (если есть car_id)
   - Booking
4. Возврат `{ok: true, entityId: "uuid", created: true/false}`

**Использование:**
- Вызывается из n8n workflow "RentProg Upsert Processor"
- URL: `http://46.224.17.15:3000/process-event` (внутренний сервер)

### GET /rentprog/health

**Назначение:** Проверка здоровья интеграции RentProg по всем филиалам

**Ответ:**
```json
{
  "ok": true,
  "perBranch": {
    "tbilisi": {"ok": true},
    "batumi": {"ok": true, "error": "..."},
    "kutaisi": {"ok": false, "error": "..."},
    "service-center": {"ok": true}
  }
}
```

**Использование:**
- Вызывается из n8n workflow "Health & Status"
- URL: `http://46.224.17.15:3000/rentprog/health`

---

## 🎯 Важные архитектурные принципы для агента

### 1. Модель данных - External Refs Pattern

**КРИТИЧНО:** Никогда не создавать таблицы с префиксом `rp_*` как основные.

**Правильная архитектура:**
- Наши UUID как первичные ключи: `cars`, `clients`, `bookings`, `branches`, `employees`
- Внешние ссылки через `external_refs`: `system='rentprog'|'amocrm'|'umnico'`, `external_id`
- Универсальность: одна сущность может иметь ссылки на несколько систем

**Пример:**
```sql
-- НЕПРАВИЛЬНО:
CREATE TABLE rp_cars (id, rentprog_id, ...)  -- ❌

-- ПРАВИЛЬНО:
CREATE TABLE cars (id UUID PK, ...)
CREATE TABLE external_refs (
  entity_type TEXT,      -- 'car'
  entity_id UUID,        -- наш UUID из cars
  system TEXT,           -- 'rentprog'
  external_id TEXT       -- ID в RentProg
)
```

### 2. RentProg интеграция

**Base URL:** `https://rentprog.net/api/v1/public` (НЕ api.rentprog.example!)

**Особенности:**
- Пагинация: 10-20 сущностей за запрос, листать до конца
- Двухэтапная аутентификация: company token → request token (TTL ~240 сек)
- Кэширование токенов с автообновлением
- Fallback endpoints при 404

**4 филиала:** `tbilisi`, `batumi`, `kutaisi`, `service-center`

### 3. Вебхуки RentProg

**Единый адрес для всех филиалов:**
```
https://webhook.rentflow.rentals/
```

**Branch определяется из:**
- Query параметра: `?branch=tbilisi` (если есть)
- Payload: `{branch: "tbilisi", ...}` (если есть)
- Иначе дефолт из конфигурации

**Поток обработки:**
1. Быстрый ACK (< 100ms) → сохранение в `events`
2. Дедупликация на уровне БД: `UNIQUE (branch, type ext_id)`
3. Cron workflow каждые 5 мин → обработка `processed=false`
4. Auto-fetch + upsert через Jarvis API `/process-event`

### 4. n8n Workflows

**Обязательные workflow (файлы в `n8n-workflows/`):**
1. **RentProg Webhooks Monitor** (`rentprog-webhooks-monitor.json`)
   - Прием вебхуков от RentProg через Nginx
   - Сохранение в таблицу `events` с дедупликацией
   - Telegram алерты при ошибках
   
2. **RentProg Upsert Processor** (`rentprog-upsert-processor.json`)
   - Cron каждые 5 минут
   - Обработка необработанных событий (`processed=false`)
   - Вызов Jarvis API `/process-event` для auto-fetch и upsert
   
3. **Health & Status** (`health-status.json`)
   - Cron каждые 5 минут
   - Проверка здоровья филиалов через Jarvis API
   - Сохранение в таблицу `health`
   
4. **Sync Progress** (`sync-progress.json`)
   - Webhook для приема прогресса синхронизации
   - Cron для периодических проверок
   - Сохранение в таблицу `sync_runs`

**Импорт workflow:**
```powershell
# Импорт всех workflow через PowerShell
powershell -ExecutionPolicy Bypass -File setup/setup_n8n_via_curl.ps1
```

**Credentials в n8n:**
- PostgreSQL (Neon) - для всех Postgres нод
  - Host: `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
  - Database: `neondb`
  - User: `neondb_owner`
  - SSL: Enable (reject unauthorized = false)
  
- Telegram Bot (@n8n_alert_geodrive_bot) - для алертов
  - ⚠️ Это отдельный бот для алертов, не основной бот!

**Переменные окружения:**
- Управление через `config/n8n-variables.yaml`
- Системные (docker-compose.yml): `WEBHOOK_URL`, `N8N_HOST` - требуют перезапуск
- Пользовательские (`$env`): `RENTPROG_HEALTH_URL`, `TELEGRAM_ALERT_CHAT_ID` - без перезапуска

### 5. Использование стандартных n8n инструментов

**Используй готовые ноды n8n когда возможно:**
- ✅ OpenAI/Anthropic для LLM и переводов
- ✅ Telegram для уведомлений
- ✅ Postgres/Data Tables для хранения
- ✅ HTTP Request для API вызовов
- ✅ Webhook для приема событий
- ✅ Code/Function только если нет готовой ноды

**Кастомный код только если:**
- Нет подходящей ноды
- Нужен специальный алгоритм
- Требуется оптимизация производительности

### 6. Секреты и безопасность

**Хранение секретов:**
- ✅ В ENV переменных (docker-compose.yml, .env на сервере)
- ✅ В GitHub Secrets (для CI/CD)
- ✅ В n8n Credentials (для workflow)
- ❌ НИКОГДА не хардкодить в коде
- ❌ НИКОГДА не коммитить в репозиторий (кроме .env.example)

**Уровни доступа:**
- RentProg branch keys → Jarvis .env
- Telegram bot tokens → n8n Credentials или Jarvis .env
- Neon DB credentials → n8n Credentials + Jarvis .env
- n8n API key → GitHub Secrets + локальный .env

---

## 📚 Дополнительная документация

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура системы
- [STRUCTURE.md](./STRUCTURE.md) - Структура данных и интеграций
- [ORCHESTRATOR.md](./ORCHESTRATOR.md) - Оркестратор событий
- [AGENTS.md](./AGENTS.md) - Список всех 33 агентов
- [ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md](./ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md) - MCP серверы
- [SESSION_REPORT_NGINX_NETLIFY_MIGRATION.md](./SESSION_REPORT_NGINX_NETLIFY_MIGRATION.md) - Миграция на Nginx
- [IMPROVEMENTS_COMPLETE.md](./IMPROVEMENTS_COMPLETE.md) - Управление переменными

---


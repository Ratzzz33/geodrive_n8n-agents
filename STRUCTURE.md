# Структура проекта и данных

## Интеграции с внешними системами

### RentProg v1
- **API**: REST API с временными токенами (company token → request token, TTL ≈ 240 сек)
- **Multi-branch**: 4 филиала (`tbilisi`, `batumi`, `kutaisi`, `service-center`)
- **Аутентификация**:
  - `RENTPROG_BRANCH_KEYS` в n8n → `getBranchToken()` (кэш, автообновление)
  - Retry + backoff для 401/429
- **API функции**:
  - `apiFetch()` — обёртка с таймаутами и логированием
  - `paginate()` — автоматическая выгрузка по 10–20 сущностей
  - `healthCheck()` — per-branch проверка (используется workflow `Health & Status`)
- **Webhooks**:
  - Вариант A (единый адрес): `https://webhook.rentflow.rentals` → Nginx → n8n `RentProg Webhooks Monitor` → таблица `events` (`processed=false`) → cron `RentProg Upsert Processor` → Jarvis API `/process-event`
  - Вариант B (текущая эксплуатация, 2025‑11‑05): 4 processor workflows по адресам `/webhook/{branch}-webhook` (Tbilisi/Batumi/Kutaisi/Service Center); парсинг `entityType/operation`, запись в БД/`external_refs`, параллельные Telegram-алерты (Code → Telegram)
  - Авто-fetch + upsert/архивизация выполняются либо через Jarvis API, либо напрямую из workflow/SQL
  - Telegram алерты: чат берётся из `$env.TELEGRAM_ALERT_CHAT_ID` (credential "Telegram account" в n8n)
- **Ограничения RentProg**: пагинация, rate limit 60 GET/мин, company_id вместо branch в payload
- **База знаний**: `rp_capture` (PostgreSQL на localhost:5434) — используется агентом-инструктором/LLM
  - `rp_pages`, `rp_api_calls`, `rp_entities`, `rp_docs`, `rp_doc_chunks`
- **Документация**: [docs/RENTPROG_COMPLETE_GUIDE.md](./docs/RENTPROG_COMPLETE_GUIDE.md)

### Umnico
- Единая точка для WhatsApp и Telegram клиентов
- Webhooks входящих сообщений
- API для отправки сообщений
- Сопоставление клиентов с темами сотрудников

### AmoCRM
- API для работы со сделками и контактами
- Автоматическое создание задач
- Отслеживание продаж страховок

### Starline
- **Важно**: Нет API, требуется браузерная автоматизация через Playwright
- Получаем: координаты авто, статус GPS оборудования, информация о поездках
- Проверка несанкционированных поездок

### Stripe
- API для создания счетов и payment links
- Webhooks для отслеживания статусов платежей

### YouGile
- API для работы с задачами и расписанием сотрудников

### Roistat
- API для аналитики источников лидов
- Атрибуция броней к источникам

### Greenway.ge
- Парсинг сайта техосмотра (Playwright)
- Проверка сроков ТО по госномерам

## Структура базы данных NEON

### Наша модель данных (основная)

Система использует **наши UUID как первичные ключи**, а внешние ID хранятся как ссылки в `external_refs`.

#### Базовые таблицы (core)

**branches** - Филиалы
- `id` (UUID PK)
- `code` (text, unique) - код филиала: `tbilisi`, `batumi`, `kutaisi`, `service-center`
- `name` (text)
- `created_at`, `updated_at`

**employees** - Сотрудники
- `id` (UUID PK)
- `name`, `role`, `tg_user_id`
- `cash_gel`, `cash_usd`, `cash_eur` (NUMERIC) - касса сотрудника по валютам
- `cash_last_updated`, `cash_last_synced` (TIMESTAMPTZ) - последнее обновление и сверка
- `task_chat_id` (TEXT) - ID группы "Tasks | <ФИО>" в Telegram
- `created_at`, `updated_at`

**clients** - Клиенты
- `id` (UUID PK)
- `name`, `phone`, `email`
- `created_at`, `updated_at`

**cars** - Автомобили
- `id` (UUID PK)
- `branch_id` (UUID FK → branches)
- `plate`, `vin`, `model`, `starline_id`
- `created_at`, `updated_at`

**bookings** - Бронирования
- `id` (UUID PK)
- `branch_id` (UUID FK → branches)
- `car_id` (UUID FK → cars)
- `client_id` (UUID FK → clients)
- `start_at`, `end_at`, `status`
- `created_at`, `updated_at`

#### Таблицы мониторинга событий

**events**
- `id BIGSERIAL PK`
- `ts TIMESTAMPTZ DEFAULT now()`
- `company_id INTEGER` — идентификатор филиала из RentProg
- `type TEXT` — нормализованный тип события
- `rentprog_id TEXT` (в `payload` → хранится в `ext_id` для дедупликации)
- `ok BOOLEAN DEFAULT TRUE`
- `reason TEXT`
- `processed BOOLEAN DEFAULT FALSE`
- `UNIQUE (company_id, type, rentprog_id)`
- Индексы: `idx_events_processed`, `idx_events_company_id`

**sync_runs**
- Лог загрузок snapshot’ов (`branch`, `entity`, `page`, `added`, `updated`, `ok`, `msg`)

**health**
- Результаты health-check (периодический workflow)
- Поля: `branch`, `ok`, `reason`, `ts`

**webhook_dedup**
- `source`, `dedup_hash`, `received_at`
- Используется для дедупликации нестандартных источников (Umnico и др.)

**event_processing_log** - дедупликация UI событий
- `id UUID PK`
- `hash TEXT UNIQUE NOT NULL` — SHA256(branch + ts + description)
- `event_data JSONB NOT NULL` — полные данные события
- `event_type TEXT` — cash_operation, maintenance, mileage, booking_status
- `processed_at TIMESTAMPTZ DEFAULT NOW()`
- `processing_result JSONB`

**history** - все операции из RentProg History API
- `id BIGSERIAL PK`
- `branch TEXT NOT NULL`
- `operation_type TEXT` — тип операции из history
- `raw_data JSONB` — полные данные операции
- `description TEXT` — текстовое описание
- `created_at TIMESTAMPTZ` — время операции в RentProg
- `processed BOOLEAN DEFAULT FALSE` — обработано ли
- `matched BOOLEAN DEFAULT FALSE` — сопоставлено ли с вебхуком
- `notes TEXT` — ошибки/результаты обработки

**history_operation_mappings** - маппинг типов операций на стратегии обработки
- `id BIGSERIAL PK`
- `operation_type TEXT UNIQUE` — тип операции из history
- `matched_event_type TEXT` — вебхук (если есть)
- `is_webhook_event BOOLEAN` — TRUE = skip processing
- `target_table TEXT` — payments/cars/bookings/skip
- `processing_strategy TEXT` — extract_payment, update_employee_cash, add_maintenance_note и т.д.
- `field_mappings JSONB` — JSONPath правила извлечения полей
- `priority INTEGER` — 100=skip, 90=critical, 70=normal, 50=low
- `enabled BOOLEAN DEFAULT TRUE`
- `notes TEXT`

#### Подсистема Entity Timeline & Event Links

- Назначение: денормализованная лента событий по `car/booking/client` и автоматическое связывание платежей/событий/истории.
- API: `/entity-timeline/*`, `/event-links/*` (см. документацию).
- Документация схем и реализации:
  - `docs/ENTITY_TIMELINE.md`, `ENTITY_TIMELINE_IMPLEMENTATION.md`
  - `docs/EVENT_LINKS.md`, `EVENT_LINKS_IMPLEMENTATION.md`

#### Внешние ссылки (external_refs)

Универсальная таблица для связи наших UUID с внешними системами:

- `id` (UUID PK)
- `entity_type` (text) - тип: `'car'|'client'|'booking'|'employee'|'branch'`
- `entity_id` (UUID FK) - наш UUID из базовых таблиц
- `system` (text) - система: `'rentprog'|'amocrm'|'umnico'|...`
- `external_id` (text) - ID во внешней системе
- `branch_code` (text, nullable) - код филиала (для систем с филиалами)
- `meta` (JSONB) - дополнительные метаданные
- `created_at`, `updated_at`

**Индексы:**
- `UNIQUE(system, external_id)` - уникальность по системе и внешнему ID
- Индексы на `(entity_type, entity_id)`, `(system, external_id)`

### Пример работы с external_refs

**Создание автомобиля из RentProg:**
1. Проверяем `external_refs` по `system='rentprog'` и `external_id=rp_car_123`
2. Если нет - создаем запись в `cars` с нашим UUID
3. Создаем ссылку в `external_refs`: `(entity_type='car', entity_id=<наш_uuid>, system='rentprog', external_id='rp_car_123', branch_code='tbilisi')`
4. При обновлении - находим по external_ref и обновляем нашу запись

Это позволяет:
- Использовать наши UUID везде в системе
- Поддерживать несколько внешних систем для одной сущности
- Легко добавлять новые системы интеграции
- Госномер (для проверки ТО)

#### Брони
- ID RentProg
- ID AmoCRM
- Связь с авто, клиентом, филиалом
- Время выдачи/приемки

### Склады

#### Допоборудование
- Учет по филиалам
- Возможность перемещения между филиалами
- Закрепление ответственного
- Контроль передачи в бронь
- Напоминания при приемке

#### Шины
- Склад по филиалам
- Учет наличия

#### Запчасти
- Склад по филиалам
- Учет наличия

## Подсистема задач (Jarvis Tasks)

### Назначение
- Централизованная система задач для сотрудников и агентов
- Источники: события от RentProg/агентов, команды Jarvis, ручной ввод
- Привязки к нашим сущностям (`cars`, `bookings`, `clients`, `branches`) или личные задачи

### Таблицы

**tasks**
- `id UUID PK`
- `title TEXT NOT NULL`
- `description TEXT DEFAULT ''`
- `status TEXT NOT NULL` — `todo|in_progress|blocked|done|cancelled`
- `priority TEXT NOT NULL DEFAULT 'normal'` — `low|normal|high|urgent`
- `creator_id UUID FK → employees`
- `assignee_id UUID FK → employees` (nullable)
- `branch_id UUID FK → branches` (nullable)
- `due_at TIMESTAMPTZ` (nullable)
- `snooze_until TIMESTAMPTZ` (nullable)
- `source TEXT NOT NULL` — `jarvis|agent|rentprog|human`
- `tg_chat_id TEXT` — ID группы сотрудника в Telegram (для темы задачи)
- `tg_topic_id TEXT` — ID темы в группе сотрудника
- `created_at TIMESTAMPTZ DEFAULT now()`
- `updated_at TIMESTAMPTZ DEFAULT now()`

Индексы: `idx_tasks_assignee_status_due (assignee_id, status, due_at)`, `idx_tasks_branch_status (branch_id, status)`

**task_links** — связи задачи с сущностями (много к одному к задаче)
- `id BIGSERIAL PK`
- `task_id UUID FK → tasks`
- `entity_type TEXT` — `'car'|'booking'|'client'|'employee'|'branch'`
- `entity_id UUID` — наш UUID соответствующей сущности
- `created_at TIMESTAMPTZ DEFAULT now()`

Индексы: `(task_id)`, `(entity_type, entity_id)`

**task_events** — журнал изменений (аудит)
- `id BIGSERIAL PK`
- `task_id UUID FK → tasks`
- `event TEXT` — `created|updated|status_changed|reminder_sent|comment`
- `payload JSONB` — детали
- `created_at TIMESTAMPTZ DEFAULT now()`

**task_comments** (опционально)
- `id BIGSERIAL PK`
- `task_id UUID FK → tasks`
- `author_id UUID FK → employees`
- `text TEXT`
- `tg_message_id TEXT` — если комментарий пришёл из Telegram темы
- `created_at TIMESTAMPTZ DEFAULT now()`

### Telegram-мэппинг
- У каждого сотрудника собственная группа `Tasks | <ФИО>` → `employees.task_chat_id` (добавить колонку)
- Для каждой новой открытой задачи создаётся тема в этой группе → сохраняются `tasks.tg_topic_id`
- В закреп темы: описание, ссылки (на сущность, RentProg), чек-лист
- Кнопки: `Done`, `Snooze 1h/Today/Tomorrow`, `Assign`, `Details`

### Политики
- Задача должна иметь одного ответственного (assignee), наблюдатели — через комментарии/уведомления
- Напоминания: по `due_at` и `snooze_until` (агент задач выполняет пинги)
- Эскалация: если просрочка > SLA, копия в группу руководителя филиала

## Подсистема диалогов (Umnico & AmoCRM)

Используется ночным агентом для RAG и аналитики конверсий. Сбор данных через Playwright Services.

### Схема БД (Neon + pgvector)

```sql
-- Диалоги (сессии)
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  umnico_conversation_id TEXT,            -- ID диалога в Umnico
  amocrm_scope_id TEXT,                   -- ID диалога в AmoCRM (связь с Umnico)
  channel TEXT,                           -- 'whatsapp' | 'telegram' | 'amocrm'
  status TEXT,                            -- 'active' | 'closed' | 'archived'
  client_name TEXT,
  car_info TEXT,
  booking_dates TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  UNIQUE (umnico_conversation_id) WHERE umnico_conversation_id IS NOT NULL
);

-- Сообщения
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  channel TEXT NOT NULL,                  -- 'whatsapp' | 'amocrm_note'
  ts TIMESTAMPTZ NOT NULL,
  direction TEXT CHECK (direction IN ('in','out')) NOT NULL,
  author TEXT,
  text TEXT,
  external_id TEXT,                       -- ID сообщения в Umnico/AmoCRM
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Чанки для эмбеддингов
CREATE TABLE message_chunks (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  content TEXT NOT NULL
);

-- Эмбеддинги (pgvector)
-- Перед использованием: CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE message_embeddings (
  id UUID PRIMARY KEY,
  chunk_id UUID REFERENCES message_chunks(id) ON DELETE CASCADE,
  embedding vector(1024)                  -- размер под выбранную модель эмбеддингов
);

-- Метки/исход диалога
CREATE TABLE dialog_labels (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  outcome TEXT CHECK (outcome IN ('won','lost','other')),
  reason TEXT,
  stage_path TEXT
);

-- Сделки AmoCRM
CREATE TABLE amocrm_deals (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  conversation_id UUID REFERENCES conversations(id),
  amocrm_deal_id TEXT UNIQUE NOT NULL,
  pipeline_id TEXT,
  status_id TEXT,
  status_label TEXT,                      -- 'successful' | 'unsuccessful' | 'in_progress'
  price NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  custom_fields JSONB,                    -- Все кастомные поля (rentprog_booking_id, rentprog_car_id и т.д.)
  metadata JSONB                          -- Связи с bookings, cars через UUID
);

-- Контакты AmoCRM
CREATE TABLE amocrm_contacts (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  amocrm_contact_id TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Статус синхронизации
CREATE TABLE sync_state (
  id BIGSERIAL PRIMARY KEY,
  workflow_name TEXT NOT NULL,
  system TEXT NOT NULL,                   -- 'umnico' | 'amocrm' | 'rentprog'
  last_sync_at TIMESTAMPTZ,
  status TEXT,                            -- 'success' | 'error' | 'running'
  items_processed INT DEFAULT 0,
  items_added INT DEFAULT 0,
  error_message TEXT,
  UNIQUE (workflow_name, system)
);
```

Связи с сущностями:
- Через `external_refs` линкуем `amocrm_deal_id`/`amocrm_contact_id` к нашим `clients`/`bookings`/`cars` (entity_type='client'|'booking'|'car', system='amocrm').
- Umnico conversations связываются с clients по телефону через `external_refs` (system='umnico').
- Сырые сообщения храним в `messages`, векторный поиск — по `message_chunks/message_embeddings`.

## Объектное хранилище

### Структура путей
```
cars/{car_id}/operations/{operation_id}/YYYYMMDD/{filename}
cars/{car_id}/cv/masks/{uuid}.png
cars/{car_id}/damages/{damage_id}/{photos}
```

### Политики доступа
- Подписанные URL с TTL для публикации в Telegram
- Private по умолчанию
- Доступ через сервисный аккаунт

## Словарь сленга для проблем из чатов

- Расширяемый словарь фраз → нормализованные теги
- Обучение на размеченных кейсах
- Версионирование классификатора
- Редактирование через админ-команды бота

## Политики системы

- **Топливо**: Допустимое расхождение 5%
- **Работа**: Полный-полный бак
- **Эскалация**: По иерархии (сотрудник → руководитель филиала → руководитель подразделения → директор)
- **SLA ответов**: Настраиваемые пороги по каналам
- **Конфигурация**: Источник правды `config/n8n-variables.yaml` → синхронизация с `docker-compose.yml` и сервером
- **Дедупликация**: `events` + `webhook_dedup` обеспечивают идемпотентность, повторная обработка проходит через `processed=false`
- **Мониторинг**: n8n workflows + Telegram-алерты, переход к Grafana/Prometheus в Q2 2026 (см. roadmap)


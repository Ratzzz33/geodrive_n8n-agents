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
  - Единый адрес: `https://webhook.rentflow.rentals`
  - Nginx → n8n `RentProg Webhooks Monitor` → таблица `events` (`processed=false`)
  - Cron workflow `RentProg Upsert Processor` вызывает Jarvis API `/process-event`
  - Авто-fetch данных из RentProg + upsert/архивирование (operation: `create/update/delete`)
  - Telegram alert для неизвестных форматов (ручное обучение)
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


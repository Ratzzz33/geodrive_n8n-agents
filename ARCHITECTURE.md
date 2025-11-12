# Архитектура системы "Jarvis - Telegram Бот для управления автопрокатом"

## Общее описание

Единая система управления автопрокатом Geodrive через Telegram-бот "Jarvis", который работает как персональный помощник для каждого сотрудника. Система состоит из оркестратора и множества узкоспециализированных агентов, выполняющих конкретные функции автоматизации и контроля.

## Компоненты системы

### 1. Telegram-бот "Jarvis" (Gateway + UI)
- Единый интерфейс для всех сотрудников
- Управление группами и темами в Telegram
- Интерактивные чек-листы и быстрые действия
- Система эскалации задач по иерархии

### 2. Оркестратор (Router + Scheduler)
- Прием и классификация событий (webhooks, сообщения, cron)
- Распределение задач между агентами
- Планирование периодических проверок
- Координация работы нескольких агентов для комплексных задач

### 3. n8n (оркестр интеграций и наблюдаемость)
- Визуальные workflow для приёма вебхуков и фоновых задач
- **RentProg workflows:**
  - `RentProg Webhooks Monitor` (единый webhook)
  - `RentProg Upsert Processor` (обработка events)
  - `Health & Status`, `Sync Progress`
  - 4 per-branch processor'а: `Tbilisi/Batumi/Kutaisi/Service Center Processor Rentprog`
- **UI Events workflows:**
  - `RentProg Events Scraper` (Playwright парсинг страницы "События" каждые 5 минут)
  - `Cash Register Reconciliation` (ночная сверка касс в 04:00)
- **History Processing workflows:**
  - `History Matcher & Processor` (обработка операций из history каждые 5 минут)
- **Data Collection workflows:**
  - `Umnico Chat Scraper` (сбор диалогов каждые 5 минут)
  - `AmoCRM Deals Scraper` (сбор сделок каждые 30 минут)
  - `AmoCRM All Deals Parser` (полный парсинг всех сделок каждые 6 часов)
- Параллельные Telegram-алерты (Code → Telegram node) с Chat ID из `$env.TELEGRAM_ALERT_CHAT_ID` (-5004140602)
- Двухэтапная обработка (быстрый ACK → отложенный upsert) и/или прямой upsert из processors (см. ниже)

### 4. Jarvis API (Express)
- HTTP шлюз между n8n и бизнес-логикой
- **Основные эндпоинты:**
  - **RentProg:**
    - `GET /rentprog/health` — проверка здоровья интеграции по всем филиалам
    - `POST /process-event` — обработка событий из n8n (upsert processor)
    - `POST /process-webhook` — быстрая обработка вебхуков (quick update)
    - `POST /upsert-car` — upsert машины (вызывается из n8n workflow)
    - `POST /upsert-client` — upsert клиента (вызывается из n8n workflow)
  - **UI Events:** ⚠️ `/process-ui-event` — роутер создан, но **не подключен** в `index.ts` (требуется подключение)
  - **History Processing:** ⚠️ `/process-history/*` — роутер создан, но **временно отключен** в `index.ts`
  - **Entity Timeline:**
    - `GET /entity-timeline/entity/:entityType/:entityId` — timeline для сущности
    - `POST /entity-timeline/related` — timeline для связанных сущностей
    - `GET /entity-timeline/stats` — статистика
  - **Event Links:**
    - `POST /event-links/payment/:paymentId` — связать платеж с events/history
    - `POST /event-links/event/:eventId` — связать событие с payment/history
    - `GET /event-links/payment/:paymentId` — получить связи для платежа
    - `GET /event-links/stats` — статистика связей
    - `GET /event-links/unlinked` — несвязанные платежи
  - **Umnico:**
    - `GET /api/umnico/conversations/:id` — история диалога
    - `POST /api/umnico/send` — отправить сообщение клиенту
  - **Starline:**
    - `GET /starline/diagnose` — диагностика Starline scraper
    - `POST /starline/update-gps` — обновление GPS данных
    - `POST /starline/sync-devices` — синхронизация устройств в `starline_devices`
    - `POST /starline/match-devices` — автоматическое сопоставление устройств с cars
    - `GET /starline/sync-status` — статус синхронизации
    - `GET /starline/match-cars` — сопоставление машин (legacy)
  - **Sync:**
    - `GET /sync-prices/:branch` — синхронизация цен автомобилей
    - `GET /check-cars-without-prices` — проверка машин без цен (все филиалы)
    - `GET /check-cars-without-prices/:branch` — проверка машин без цен (конкретный филиал)
    - `POST /sync-employee-cash` — синхронизация касс сотрудников из RentProg
    - `POST /sync-bookings` — синхронизация бронирований из всех филиалов
  - **Utilities:**
    - `POST /scrape-exchange-rates` — парсинг курсов валют из RentProg через Playwright
    - `POST /restore-cars` — запуск скрипта восстановления машин из RentProg
    - `POST /amocrm/process-webhook` — обработка вебхуков от AmoCRM
  - **Health:**
    - `GET /health` — health check
    - `GET /` — root endpoint
- Выполняет auto-fetch, upsert и архивацию сущностей
- Обработка UI событий: классификация, парсинг, обновление касс, создание задач (⚠️ требует подключения роутера)
- Обработка истории операций: автоматическая обработка платежей, кассовых операций, техобслуживания (⚠️ временно отключено)
- Планируется запуск как постоянно работающий сервис (сейчас запускается вручную)

### 5. Агенты (Microservices/Workers)
- Независимые модули, каждый отвечает за узкую функцию
- Вызываются оркестратором по необходимости
- Используют LLM/tools для обработки данных
- Взаимодействуют с внешними API и БД

### 6. База данных (PostgreSQL/Neon)
- Хранение всех бизнес-данных
- External References pattern для интеграций
- **Таблицы мониторинга:** `events`, `sync_runs`, `health`, `webhook_dedup`, `event_processing_log`, `sync_state`
- **Таблицы диалогов:** `conversations`, `messages`, `message_chunks`, `message_embeddings` (pgvector)
- **Таблицы AmoCRM:** `amocrm_deals`, `amocrm_contacts`
- **Таблицы истории:** `history`, `history_operation_mappings`
- Поддержка миграций через Drizzle

### 7. Объектное хранилище (GCS/S3/MinIO)
- Медиафайлы (фото, видео)
- Результаты CV-обработки (маски, оверлеи)
- Подписанные URL для безопасного доступа

### 8. Интеграции
- RentProg (API + Webhooks, company_id-модель)
- Umnico (WA/TG клиентов)
- AmoCRM
- Starline (браузерная автоматизация)
- Stripe
- YouGile
- Roistat
- Greenway.ge (парсинг для ТО)

### 9. Подсистема задач (Jarvis Tasks)
- Создание задач из событий (агенты/вручную/команды), а также напрямую сотрудниками через Jarvis
- Привязки: к `car` / `booking` / `client` / `branch` или без привязки (личная)
- Telegram UI: у каждого сотрудника своя группа «Задачи <ФИО>», каждая тема = открытая задача; в закрепе — контекст (описание, ссылки, чек-лист); кнопки Done/Snooze/Assign
- Напоминания и эскалация: по SLA и дедлайну, до закрытия; эскалация по иерархии
- Интеграция с дневным планом и агентами контроля (автосоздание задач при нарушениях/пропусках)

### 10. Ночной агент продаж (AmoCRM‑only MVP)
- Назначение: автоматические ночные ответы клиентам через “Чаты в CRM” AmoCRM без прямой интеграции Umnico.
- Роль в системе: AI Agent (n8n) + RAG (pgvector в Neon) + шаблоны; источники — выигранные/проигранные сделки и истории переписки.
- Безопасность: белые списки интентов, лимиты частоты, запрет рисковых операций (цены/депозиты), эскалация человеку.

### 11. Entity Timeline & Event Links
- Назначение: денормализованная лента событий по сущностям (машина/бронь/клиент) и автоматическое связывание платежей/событий/истории
- Возможности:
  - Быстрый доступ без сложных JOIN (агрегаты и фильтры по типу/источнику/времени/филиалу)
  - Автосвязывание новых платежей в скользящем окне времени с оценкой уверенности (high/medium/low)
  - Диагностика "несвязанных" записей для ручной обработки
- API:
  - `/entity-timeline/stats` — агрегаты событий
  - `/event-links/stats` — агрегаты связей
  - `/event-links/unlinked` — список несвязанных платежей

### 12. Playwright Services (Umnico & AmoCRM)
- **Umnico Service** (`:3001`): постоянно работающий браузер с сохраненной сессией, автологин, HTTP API для n8n
  - Endpoints: `/api/conversations`, `/api/conversations/:id/messages`
- **AmoCRM Service** (`:3002`): постоянно работающий браузер с сохраненной сессией, автологин, HTTP API + REST API через браузерную сессию
  - Endpoints: `/api/deals`, `/api/deals/:id`, `/api/deals/:id/notes`, `/api/deals/all`, `/api/deals/:id/extended`
- Автозапуск при рестарте сервера (Docker Compose)

### 13. History Processing System
- Назначение: автоматическая обработка ВСЕХ операций из истории RentProg (не только вебхуки)
- Компоненты:
  - Таблица `history` — все операции из `/history_items` API
  - Таблица `history_operation_mappings` — маппинг типов операций на стратегии обработки
  - Автоматическая обработка: платежи, кассовые операции, техобслуживание, статусы броней
  - Incremental Learning — автосоздание маппингов для новых типов операций
- API: `/process-history`, `/process-history/stats`, `/process-history/unknown`, `/process-history/learn`
- Workflow: `History Matcher & Processor` (каждые 5 минут)

## Структура Telegram-чатов

### Рабочие форумы филиалов
- Название: `Branch_<name> (forum)`
- Темы: по автомобилям (создаются/удаляются ботом при перемещении)
- Участники: сотрудники филиала
- Модерация: бот удаляет попытки публикации медиа от пользователей

### Архивные чаты (read-only)
- Отдельные чаты для публикаций ботом
- Участники только читают
- Хранилище материалов по автомобилям

### Служебные чаты
- Руководители
- Маркетинг
- Продажи

### Персональные группы сотрудников
- Группа сотрудника + бот
- Темы по клиентам (название: `<Client Name> | <Car>`)
- Переводчик сообщений клиентов
- Эскалация неотвеченных сообщений
 
### Персональные группы задач сотрудников
- Название: `Tasks | <ФИО>`
- Темы: по открытым задачам; закрытая задача → тема архивируется/помечается
- Закреп: описание, ссылки на `car/booking/client`, чек-лист, кнопки действий

## Потоки данных

### Входящие события
1. Webhooks (RentProg через `https://webhook.rentflow.rentals`, Umnico, Stripe)
2. Сообщения в Telegram (бот/форумы)
3. Cron-задачи (n8n workflows и внутренний scheduler)
4. Результаты браузерной автоматизации (Starline, Greenway)

### Обработка (pipeline)
1. Nginx принимает HTTP webhook → проксирует в n8n
2. Вариант A (обобщённый): `RentProg Webhooks Monitor` → запись в `events` (дедуп) → быстрый ACK (<100 мс) → cron `RentProg Upsert Processor` → Jarvis API `/process-event` → upsert → `processed=true` → внутренние события для оркестратора
3. Вариант B (текущая эксплуатация для RentProg, 2025‑11‑05): 4 processor workflows по филиалам (`…-webhook`) выполняют парсинг `entityType/operation`, сохраняют в БД, вызывают триггеры (`process_booking_nested_entities`) для nested-объектов и ПАРАЛЛЕЛЬНО отправляют Telegram-алерты. Запись в `external_refs` и upsert выполняются напрямую из workflow/SQL.
4. Оркестратор подписан на внутренние события (успех/ошибка) и прогоняет их через соответствующих агентов

### Исходящие действия
1. Сообщения в Telegram (темы авто, персональные группы, алерты)
2. Задачи/уведомления во внешние системы (YouGile, AmoCRM, Stripe)
3. Записи и обновления в БД (business-сущности + мониторинг)
4. API-вызовы во внешние сервисы / поднятие webhooks

### Потоки данных (AmoCRM ночной агент)
1) n8n (cron) → AmoCRM API: получить диалоги в ожидании ответа (ночное окно).
2) Jarvis API / БД: собрать контекст (история диалога, карточка сделки/контакта).
3) RAG (pgvector): извлечь релевантные "победные" фрагменты; сгенерировать ответ (LLM/Ollama).
4) n8n → AmoCRM "Чаты в CRM": отправить ответ (conversation_id, текст).
5) БД: лог решений (источники RAG, scores, ограничения), метрики KPI.

### Потоки данных (Umnico & AmoCRM сбор данных)
1) **Umnico:** n8n (cron каждые 5 мин) → Playwright Service `:3001` → `/api/conversations` → извлечение сообщений → сохранение в `conversations`, `messages`, `clients` → добавление `external_refs` (umnico → client)
2) **AmoCRM:** n8n (cron каждые 30 мин / 6 часов) → Playwright Service `:3002` → `/api/deals/all` → `/api/deals/:id/extended` → извлечение данных → сохранение в `amocrm_deals`, `clients`, `conversations`, `messages` → связывание с RentProg через `external_refs`

### Потоки данных (History Processing)
1) n8n (cron каждые 3 мин) → RentProg History API `/history_items` → сохранение в `history` (`processed=false`)
2) n8n (cron каждые 5 мин) → `History Matcher & Processor` → загрузка маппингов → обработка необработанных операций → Jarvis API `/process-history` → применение стратегий (extract_payment, update_employee_cash, add_maintenance_note) → обновление `payments`, `employees`, `cars`, `bookings` → `processed=true`
3) Telegram алерты при ошибках и обнаружении новых типов операций

## Безопасность

- Централизованное хранение конфигурации (`config/n8n-variables.yaml` + `docker-compose.yml`, синхронизация скриптами)
- Секреты и токены в `.env`, GitHub Secrets, n8n Credentials (Production переменные не хранятся в UI variables)
- SSL/HTTPS через Nginx + Let's Encrypt (`webhook.rentflow.rentals`, `n8n.rentflow.rentals`)
- Дедупликация и идемпотентность (`events` `UNIQUE(company_id, type, rentprog_id)`)
- Планируемые меры: IP whitelist RentProg, HSTS и rate limiting в Nginx
- ACL в Telegram (бот модератор), аудит действий через логи n8n и Jarvis API
- Переменные для алертов: `TELEGRAM_ALERT_CHAT_ID` (на сервере, docker-compose); credential "Telegram account" хранится в n8n

## Технологический стек

- **Backend**: TypeScript (Node.js 20/22), Express API, Drizzle ORM
- **Workflow / orchestration**: n8n 1.x (self-hosted, UI `https://n8n.rentflow.rentals`)
- **Ingress**: Nginx + Let's Encrypt (`webhook.rentflow.rentals`)
- **Telegram**: Telegraf (Bot API)
- **Браузерная автоматизация**: Playwright
- **LLM**: OpenAI/Anthropic (function calling, переводы)
- **БД**: PostgreSQL (Neon) + external refs pattern
- **Хранилище**: GCS/S3/MinIO (план)
- **Мониторинг**: n8n executions, Health-check workflow, Telegram alerts; планируется Grafana/Prometheus
- **CV/ML**: YOLOv8/YOLOv9, SAM2, OCR (Tesseract)

## Масштабирование

На старте: монолитное приложение с модульной структурой
При росте: микросервисы, Redis Streams для очередей, горизонтальное масштабирование воркеров


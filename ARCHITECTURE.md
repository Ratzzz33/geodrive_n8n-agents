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
- Workflows: `RentProg Webhooks Monitor`, `RentProg Upsert Processor`, `Health & Status`, `Sync Progress`
- Мониторинг, алерты в Telegram
- Двухэтапная обработка (быстрый ACK → отложенный upsert)

### 4. Jarvis API (Express)
- HTTP шлюз между n8n и бизнес-логикой
- Эндпоинты: `/rentprog/health`, `/process-event`
- Выполняет auto-fetch, upsert и архивацию сущностей
- Планируется запуск как постоянно работающий сервис (сейчас запускается вручную)

### 5. Агенты (Microservices/Workers)
- Независимые модули, каждый отвечает за узкую функцию
- Вызываются оркестратором по необходимости
- Используют LLM/tools для обработки данных
- Взаимодействуют с внешними API и БД

### 6. База данных (PostgreSQL/Neon)
- Хранение всех бизнес-данных
- External References pattern для интеграций
- Таблицы мониторинга (`events`, `sync_runs`, `health`, `webhook_dedup`)
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

## Потоки данных

### Входящие события
1. Webhooks (RentProg через `https://webhook.rentflow.rentals`, Umnico, Stripe)
2. Сообщения в Telegram (бот/форумы)
3. Cron-задачи (n8n workflows и внутренний scheduler)
4. Результаты браузерной автоматизации (Starline, Greenway)

### Обработка (pipeline)
1. Nginx принимает HTTP webhook → проксирует в n8n
2. n8n `RentProg Webhooks Monitor` → сохраняет событие в `events` (дедуп) → быстрый ACK (<100 мс)
3. Каждые 5 мин `RentProg Upsert Processor` берет `processed = false`, вызывает Jarvis API `/process-event`
4. Jarvis API auto-fetch’ит полные данные, upsert’ит в БД/`external_refs`, отмечает `processed = true`
5. Оркестратор подписан на внутренние события (успешные upsert’ы, ошибки) и прогоняет их через агентов

### Исходящие действия
1. Сообщения в Telegram (темы авто, персональные группы, алерты)
2. Задачи/уведомления во внешние системы (YouGile, AmoCRM, Stripe)
3. Записи и обновления в БД (business-сущности + мониторинг)
4. API-вызовы во внешние сервисы / поднятие webhooks

## Безопасность

- Централизованное хранение конфигурации (`config/n8n-variables.yaml` + `docker-compose.yml`, синхронизация скриптами)
- Секреты и токены в `.env`, GitHub Secrets, n8n Credentials (Production переменные не хранятся в UI variables)
- SSL/HTTPS через Nginx + Let's Encrypt (`webhook.rentflow.rentals`, `n8n.rentflow.rentals`)
- Дедупликация и идемпотентность (`events` `UNIQUE(company_id, type, rentprog_id)`)
- Планируемые меры: IP whitelist RentProg, HSTS и rate limiting в Nginx
- ACL в Telegram (бот модератор), аудит действий через логи n8n и Jarvis API

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


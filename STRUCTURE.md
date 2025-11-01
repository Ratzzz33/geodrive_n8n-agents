# Структура проекта и данных

## Интеграции с внешними системами

### RentProg v1
- **API**: REST API с токенами (временные токены через ключи филиалов)
- **Multi-branch**: Поддержка 4 филиалов (tbilisi, batumi, kutaisi, service-center)
- **Аутентификация**: 
  - Company token (постоянный ключ филиала) → Request token (временный, TTL ~240 сек)
  - Автоматическое кэширование и обновление токенов
  - Backoff на 401/429 ошибки
- **API функции**:
  - `getBranchToken()` - получение токена для филиала
  - `apiFetch()` - выполнение запросов с retry и таймаутами
  - `paginate()` - автоматическая пагинация (по 10-20 сущностей)
  - `healthCheck()` - per-branch проверка доступности
- **Webhooks**: 
  - Netlify Functions на `https://geodrive.netlify.app/webhooks/rentprog/{branch}?t={secret}`
  - Валидация: query токен (`?t=`) или HMAC подпись (`X-Rentprog-Signature`)
  - Быстрый ACK (200 OK) и асинхронная обработка через оркестратор
  - Нормализация событий: `booking.issue.planned`, `booking.return.planned`, `car.moved`, и др.
- **Ограничения**: Пагинация по 10-20 сущностей, требуется итеративная загрузка
- **База знаний**: `rp_capture` (PostgreSQL на localhost:5434)
  - `rp_pages` - снимки страниц с HTML и текстом
  - `rp_api_calls` - перехваченные API вызовы
  - `rp_entities` - извлеченные сущности
  - `rp_docs` и `rp_doc_chunks` - документы и чанки для эмбеддингов
- **Подключение**: `postgresql://rp_user:rp_pass_123@127.0.0.1:5434/rp_capture`
- **pgAdmin**: http://localhost:5052 (admin@local / admin123)
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

#### Базовые таблицы

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

#### Дедупликация вебхуков (webhook_dedup)

- `id` (BIGSERIAL PK)
- `source` (text) - источник: `'rentprog'|'umnico'|...`
- `dedup_hash` (text, unique) - SHA256 hash для дедупликации
- `received_at` (timestamptz)

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


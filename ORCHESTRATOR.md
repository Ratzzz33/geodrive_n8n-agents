# Оркестратор системы

## Назначение

Центральный компонент, который координирует работу всех агентов, классифицирует входящие события и распределяет задачи.

## Основные функции

### 1. Прием событий
- HTTP вебхуки через Nginx → n8n (RentProg, Umnico, Stripe)
- Сообщения в Telegram от сотрудников
- Результаты периодических проверок (n8n cron + внутренний scheduler)
- Результаты браузерной автоматизации (Starline, Greenway)

### 2. Классификация
- LLM-классификатор для определения типа события
- Правила (rule-based) для критичных событий
- Определение набора нужных агентов для обработки

### 3. Планирование
- Cron-расписания для периодических проверок
- Приоритизация задач
- Очередь выполнения (последовательно или параллельно)

### 4. Координация агентов
- Вызов нужных агентов
- Агрегация результатов от нескольких агентов
- Обработка ошибок и ретраи

### 5. Публикация результатов
- Отправка уведомлений в нужные Telegram-каналы
- Обновление БД
- Создание задач во внешних системах (YouGile, AmoCRM)

## Типы событий

### События от RentProg (две модели эксплуатации)

Модель A (единый webhook, deferred processing):
1. RentProg отправляет webhook на `https://webhook.rentflow.rentals`
2. Nginx проксирует запрос в n8n `RentProg Webhooks Monitor`
3. Запись в `events` (`processed=false`, дедуп)
4. Каждые 5 минут workflow `RentProg Upsert Processor` вызывает Jarvis API `/process-event`
5. Jarvis API auto-fetch → upsert/архивирование → `processed=true` → внутреннее событие для оркестратора

Модель B (текущая эксплуатация, 2025‑11‑05):
1. RentProg → n8n `/webhook/{branch}-webhook` (4 processor workflows)
2. `Parse Webhook` определяет `entityType/operation`, сохраняет событие/данные в БД (включая `external_refs`)
3. Для nested данных (booking → car/client) используется триггер БД `process_booking_nested_entities`
4. Параллельно: `Format Telegram Alert` → `Send Telegram Alert` отправляет уведомление в чат `$env.TELEGRAM_ALERT_CHAT_ID`
5. При необходимости эмитится нормализованное внутреннее событие в оркестратор

Поддерживаемые типы событий (после нормализации):
- `booking.issue.planned`, `booking.return.planned`
- `booking.created`, `booking.updated`, `booking.cancelled`
- `booking.issued`, `booking.returned`
- `car.updated`, `car.moved`
- `client.updated`
- `cash.collected` и другие финансовые события

**Формат внутренних событий от RentProg:**

```typescript
{
  type: 'booking.issue.planned' | 'booking.return.planned' | ...,
  timestamp: Date,
  source: 'rentprog',
  operation: 'create' | 'update' | 'delete',
  companyId: 9247 | 9248 | 9506 | 11163,
  payload: {
    rentprogId: string,
    entityType: 'booking' | 'car' | 'client',
    data: Record<string, unknown>,
  }
}
```

**Ключевые особенности:**
1. **Идемпотентность:** `events` имеет `UNIQUE (company_id, type, rentprog_id)` и флаг `processed`
2. **Уточнение филиала:** используется `companyId → branch` из `src/config/company-branch-mapping.ts`
3. **Операция:** `operation` помогает агентам различать upsert/архивирование
4. **Алерты:** неизвестные payload уходят в Telegram для обучения

### События от Umnico
- `message.incoming` - сообщение от клиента
- `message.sent` - сообщение отправлено клиенту

### События от Telegram
- `message.employee` - сообщение от сотрудника боту
- `callback.button` - нажатие кнопки
- `photo.uploaded` - загрузка фото

### События задач (Jarvis Tasks)
- `task.created` — создана новая задача (источник: Jarvis/агент/RentProg)
- `task.updated` — обновлены поля/срок/приоритет/исполнитель
- `task.status.changed` — смена статуса (`todo`→`in_progress`→`done`/`blocked`/`cancelled`)
- `task.reminder` — сработал напоминатель (по `due_at`/`snooze_until`)
- `task.escalate` — эскалация просроченной задачи

### Внутренние события
- `check.cash` - проверка инкассации (cron)
- `check.bookings` - проверка броней (cron)
- `check.to` - проверка ТО (cron)
- `check.starline` - проверка поездок Starline (cron)
- `daily.plan.generate` - генерация дневного плана (cron)

### События AmoCRM (ночной агент)
- `amocrm.conversation.pending` — диалог ожидает ответа (ночное окно)
- `amocrm.message.created` — новое входящее сообщение
- `night_agent.reply.requested` — запрошена генерация ответа
- `night_agent.reply.sent` — ответ успешно отправлен в Amo
- `night_agent.escalate` — эскалация человеку (правила/стоп‑слова/риски)

## Примеры маршрутизации

### Выдача авто (от RentProg webhook)
1. RentProg шлёт `booking_update` → n8n сохраняет в `events`
2. Jarvis API `/process-event` выполняет auto-fetch, помечает `processed=true`, эмитит `booking.issue.planned`
3. Оркестратор получает событие через `eventBus`
4. Оркестратор вызывает:
   - Агент контролер броней (напоминание ответственному)
   - Агент помощник по выдаче (проверка готовности, чеклист)

### Приемка авто (от RentProg webhook)
1. RentProg шлёт `booking_update` → n8n сохраняет в `events`
2. Jarvis API `/process-event` выполняет auto-fetch, эмитит `booking.return.planned`
3. Оркестратор получает событие через `eventBus`
4. Оркестратор вызывает:
   - Агент контролер броней (напоминание ответственному)
   - Агент помощник по приемке (ожидание материалов, проверка чеклиста)

### Сообщение от клиента
1. Событие: `umnico.message.incoming`
2. Оркестратор вызывает:
   - Агент клиентских чатов (обработка, перевод, публикация в тему)
   - Агент контроля SLA (проверка времени ответа)

### Несанкционированная поездка
1. Событие: `starline.unauthorized.trip`
2. Оркестратор вызывает:
   - Агент служебных поездок (создание инцидента)
   - Публикация в тему авто филиала
   - Уведомление руководителю

### Создание личной задачи сотрудником
1. Команда Jarvis: `/task create "Проверить авто между бронями" car:52138 due:today 18:00`
2. Оркестратор парсит команду → `task.created`
3. Агент задач:
   - Создает запись в `tasks` (`assignee_id` = автор; `task_links` → `car`)
   - Создает тему в `Tasks | <ФИО>` и публикует закреп с чек-листом
   - Планирует напоминание по `due_at`

### Автоматическая задача от агента контроля выдач
1. Агент контроля броней выявил пропуск пункта чек-листа → эмитит `task.created`
2. Агент задач создает задачу, назначает ответственным по брони, публикует тему
3. При нажатии `Done` в теме — `task.status.changed: done` → закрытие задачи, архив темы

### Ночной агент (AmoCRM‑only MVP)
1. Cron(night) → Fetch pending from Amo → emit `amocrm.conversation.pending`
2. AI Agent (RAG+LLM) → `night_agent.reply.requested`
3. HTTP Request → Amo “Чаты в CRM” (send) → `night_agent.reply.sent`
4. При рисках (цены/депозиты/конфликт/частые ответы) → `night_agent.escalate` → создаём задачу руководителю + ссылку на диалог

### Правила/ограничения для ночного агента
- Белый список интентов: FAQ, наличие/сроки, адрес/график, базовые условия
- Лимиты: не более N ответов/диалог/ночь; минимум X минут между автоответами
- Стадии/воронки: работает только на разрешённых стадиях (например, “Новый лид/Переписка”)
- Логирование: сохраняем источник RAG (IDs чанков), score/threshold, текст ответа, контроль PII

## Обработка ошибок

- Retry с экспоненциальной задержкой
- Dead letter queue для неудачных задач
- Логирование всех операций
- Алерты при критичных ошибках

## Мониторинг

- Метрики производительности агентов
- Время отклика системы
- Количество обработанных событий
- Ошибки и их типы


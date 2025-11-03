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

### События от RentProg (Nginx → n8n → Jarvis API → Оркестратор)

Поток обработки:
1. RentProg отправляет webhook на `https://webhook.rentflow.rentals`
2. Nginx проксирует запрос в n8n `RentProg Webhooks Monitor`
3. Workflow парсит payload (Ruby hash → JSON), определяет `companyId`, `entityType`, `operation` и сохраняет запись в таблицу `events` (`processed=false`)
4. Каждые 5 минут workflow `RentProg Upsert Processor` выбирает необработанные события и вызывает Jarvis API `/process-event`
5. Jarvis API auto-fetch’ит полные данные из RentProg, выполняет upsert/архивацию, обновляет `events.processed=true` и эмитит нормализованное событие в оркестратор

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

### Внутренние события
- `check.cash` - проверка инкассации (cron)
- `check.bookings` - проверка броней (cron)
- `check.to` - проверка ТО (cron)
- `check.starline` - проверка поездок Starline (cron)
- `daily.plan.generate` - генерация дневного плана (cron)

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


# Отладка записи в БД - RentProg Webhooks Monitor

## Дата: 2025-11-02

## Проблема
✅ Debug сообщения приходят в Telegram  
✅ Error Alert не срабатывает при `ok: true`  
❌ События не сохраняются в БД

## Проверено

### 1. Credentials
- ✅ PostgreSQL credentials назначены: ID `3I9fyXVlGg4Vl4LZ`
- ✅ Telegram credentials назначены: ID `1tKryXxL5Gq395nN`

### 2. Параметры queryParameters
Проверены через тестовый скрипт - генерируются правильно:
```javascript
[
  "tbilisi",
  "booking.issue.planned", 
  "testwebhook1762110302809",
  true,
  "ok"
]
```

### 3. SQL запрос
```sql
INSERT INTO events (ts, branch, type, ext_id, ok, reason, processed)
VALUES (NOW(), $1, $2, $3, $4, $5, FALSE)
ON CONFLICT (branch, type, ext_id) DO NOTHING
RETURNING id
```

## Возможные причины

1. **Ошибка SQL подавлена `onError: "continueRegularOutput"`**
   - Нода падает, но ошибка не видна
   - Workflow продолжает работу

2. **Неправильный формат queryParameters**
   - n8n может требовать другой формат массива
   - Возможно нужно использовать другой синтаксис

3. **Нода не выполняется**
   - Данные не доходят до "Save Event"
   - Возможно проблема в connections

## Решение

Добавлена временная debug нода "Debug: Query Params" перед "Save Event" для проверки:
- Какие данные получает нода
- Правильно ли генерируются queryParameters
- Доходят ли данные до ноды

## Следующие шаги

1. Отправить тестовый вебхук
2. Проверить Telegram - должно прийти debug сообщение с queryParams
3. Проверить execution в n8n UI:
   - Открыть последний execution
   - Проверить ноду "Save Event"
   - Посмотреть ошибки (если есть)

## Альтернативные решения

### Вариант 1: Убрать `onError` временно
Чтобы увидеть реальные ошибки SQL:
```json
"onError": null  // или убрать поле
```

### Вариант 2: Упростить queryParameters
Использовать Set ноду для подготовки данных перед Save Event.

### Вариант 3: Использовать Code ноду
Собрать queryParameters в Code ноде для лучшего контроля.


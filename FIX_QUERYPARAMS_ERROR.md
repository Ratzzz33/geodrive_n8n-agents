# Исправление ошибки "there is no parameter $1"

## Дата: 2025-11-02

## Проблема
**Ошибка в ноде "Save Event":** `there is no parameter $1`

Это означает, что параметры SQL запроса не передаются в PostgreSQL ноду.

## Причина
Выражение `queryParameters` слишком сложное и n8n не может его правильно вычислить. Выражение содержит множественные тернарные операторы и проверки, которые могут вызывать проблемы при парсинге.

## Исправление

### Вариант 1: Упростить выражение (текущий)
Разбил выражение на отдельные строки для лучшей читаемости и упростил логические проверки:

```json
"queryParameters": "={{ [\n  $json.query && $json.query.branch ? $json.query.branch : ($json.body && $json.body.branch ? $json.body.branch : 'unknown'),\n  $json.body && $json.body.type ? $json.body.type : ($json.body && $json.body.event ? $json.body.event : 'unknown'),\n  $json.body && $json.body.payload && $json.body.payload.id ? $json.body.payload.id : ($json.body && $json.body.payload && ($json.body.payload.rentprog_id || $json.body.payload.rentprogid) ? ($json.body.payload.rentprog_id || $json.body.payload.rentprogid) : 'unknown'),\n  $json.body && $json.body.ok !== false ? true : false,\n  $json.body && $json.body.error ? $json.body.error : ($json.body && $json.body.reason ? $json.body.reason : 'ok')\n] }}"
```

### Вариант 2: Использовать Set ноду (если вариант 1 не сработает)
Добавить Set ноду перед Save Event для подготовки параметров:

1. Добавить ноду "Set Query Params" после "If Error"
2. Установить значения:
   - `branch`: `={{ $json.query && $json.query.branch ? $json.query.branch : ($json.body && $json.body.branch ? $json.body.branch : 'unknown') }}`
   - `type`: `={{ $json.body && $json.body.type ? $json.body.type : ($json.body && $json.body.event ? $json.body.event : 'unknown') }}`
   - `ext_id`: `={{ $json.body && $json.body.payload && $json.body.payload.id ? $json.body.payload.id : ($json.body && $json.body.payload && ($json.body.payload.rentprog_id || $json.body.payload.rentprogid) ? ($json.body.payload.rentprog_id || $json.body.payload.rentprogid) : 'unknown') }}`
   - `ok`: `={{ $json.body && $json.body.ok !== false ? true : false }}`
   - `reason`: `={{ $json.body && $json.body.error ? $json.body.error : ($json.body && $json.body.reason ? $json.body.reason : 'ok') }}`
3. В Save Event использовать: `{{ [$json.branch, $json.type, $json.ext_id, $json.ok, $json.reason] }}`

## Тестирование
1. Обновить workflow в n8n
2. Отправить тестовый вебхук
3. Проверить execution - должна исчезнуть ошибка "there is no parameter $1"
4. Проверить запись в БД

## Статус
✅ Исправлено в локальном файле
⏳ Требуется обновление в n8n


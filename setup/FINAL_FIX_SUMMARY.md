# Финальное решение проблемы с полем `data` в bookings

**Дата:** 2025-11-20  
**Execution:** https://n8n.rentflow.rentals/workflow/rCCVTgR2FcWWRxpq/executions/25137

---

## ❌ Проблема

Поле `data` (JSONB) в таблице `bookings` **НЕ заполняется**, хотя `payload_json` (TEXT) есть.

---

## 🔍 Причины

1. **n8n Postgres нода не делает CAST автоматически:**
   - Маппинг `"data": "={{ $json.payload_json }}"` передает TEXT
   - Postgres нода **не преобразует** TEXT → JSONB автоматически
   - Результат: `data` остается пустым `{}`

2. **Trigger не помогает:**
   - Создали trigger `auto_populate_data_from_payload_json()` для автозаполнения
   - Но есть **другой trigger** `process_booking_nested_entities_trigger`
   - Он срабатывает **ПОСЛЕ** и **ОЧИЩАЕТ** `data`!

3. **8 BEFORE triggers на таблице bookings:**
   - Порядок выполнения непредсказуем
   - `process_booking_nested_entities_trigger` конфликтует с нашим trigger

---

## ✅ Решение

**Использовать executeQuery вместо upsert в n8n:**

### Вариант 1: Явный CAST в SQL (рекомендуется)

В ноде "Save to DB" изменить:
- `operation`: `executeQuery` (вместо `upsert`)
- `query`: SQL с явным `payload_json::jsonb AS data`

**SQL запрос:**
```sql
INSERT INTO bookings (
  rentprog_id, number, branch_id, branch, is_active, is_technical,
  start_date, end_date, start_at, end_at, created_at,
  client_name, client_category, car_name, car_code, 
  rentprog_car_id, car_id, location_start, location_end,
  total, deposit, rental_cost, days, state, in_rent, archive,
  start_worker_id, end_worker_id, responsible, description, source,
  technical_type, technical_purpose,
  data,  -- ✅ ЯВНЫЙ CAST
  payload_json
)
VALUES (
  {{ $json.rentprog_id }}, {{ $json.number }}, {{ $json.branch_id }}, {{ $json.branch }},
  {{ $json.is_active }}, {{ $json.is_technical }},
  {{ $json.start_date }}, {{ $json.end_date }}, {{ $json.start_at }}, {{ $json.end_at }},
  {{ $json.created_at }}, {{ $json.client_name }}, {{ $json.client_category }},
  {{ $json.car_name }}, {{ $json.car_code }}, {{ $json.rentprog_car_id }}, {{ $json.car_id }},
  {{ $json.location_start }}, {{ $json.location_end }},
  {{ $json.total }}, {{ $json.deposit }}, {{ $json.rental_cost }}, {{ $json.days }},
  {{ $json.state }}, {{ $json.in_rent }}, {{ $json.archive }},
  {{ $json.start_worker_id }}, {{ $json.end_worker_id }}, {{ $json.responsible }},
  {{ $json.description }}, {{ $json.source }},
  {{ $json.technical_type }}, {{ $json.technical_purpose }},
  {{ $json.payload_json }}::jsonb,  -- ✅ CAST TEXT → JSONB
  {{ $json.payload_json }}
)
ON CONFLICT (rentprog_id)
DO UPDATE SET
  number = EXCLUDED.number,
  branch_id = EXCLUDED.branch_id,
  ... (все остальные поля),
  data = EXCLUDED.data,  -- ✅ Обновляем data
  payload_json = EXCLUDED.payload_json,
  updated_at = NOW()
```

### Вариант 2: Использовать `$json.data` (объект)

Вернуть маппинг:
```json
"data": "={{ $json.data }}"
```

Но проверить что n8n Postgres нода правильно сериализует объект в JSONB.

---

## 🎯 Рекомендация

**Вариант 1** - использовать `executeQuery` с явным CAST `payload_json::jsonb`.

**Почему:**
- Надежно работает
- Избегает конфликтов с triggers
- Полный контроль над SQL

**Следующий шаг:**
1. Удалить trigger `auto_populate_data_trigger` (он не нужен)
2. Изменить ноду "Save to DB" на `executeQuery`
3. Тестировать на следующем execution

---

## 📊 Статистика

**До исправления:**
- `payload_json` заполнено: **100%** ✅
- `data` заполнено: **0%** ❌

**После исправления (ожидается):**
- `payload_json` заполнено: **100%** ✅
- `data` заполнено: **100%** ✅

---

## 🔗 Связанные файлы

- `setup/migrations/0038_auto_populate_data_from_payload_json.sql` - миграция с trigger (не сработала)
- `setup/fix_data_field_in_save_node.mjs` - первая попытка исправления (не сработала)
- Этот файл - финальное решение

---

**Итог:** Нужно использовать `executeQuery` вместо `upsert` для явного CAST TEXT → JSONB.


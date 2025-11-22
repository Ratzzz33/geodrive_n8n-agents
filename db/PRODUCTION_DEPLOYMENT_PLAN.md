# План переноса нормализации БД на Production

**Ветка разработки:** `ep-curly-sunset`  
**Production:** `ep-rough-heart-ahnybmq0-pooler`  
**Дата создания:** 2025-01-XX

---

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Подготовка к Production

### 1. Предварительные проверки

**Перед началом миграции на production:**

```sql
-- 1. Проверить текущее состояние production БД
SELECT COUNT(*) FROM payments WHERE car_id IS NOT NULL OR client_id IS NOT NULL OR user_id IS NOT NULL;
SELECT COUNT(*) FROM tasks WHERE tg_chat_id IS NOT NULL OR tg_topic_id IS NOT NULL;
SELECT COUNT(*) FROM external_refs;

-- 2. Проверить наличие всех необходимых таблиц
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('external_refs', 'payments', 'tasks', 'events', 'starline_devices', 'branches', 'employees');

-- 3. Проверить существующие FK
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

### 2. Создание резервной копии

**ОБЯЗАТЕЛЬНО перед применением миграций:**

```bash
# Через Neon Console или pg_dump
# 1. Создать snapshot в Neon Console
# 2. Или через pg_dump (если есть доступ)

pg_dump "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  --schema-only > backup_prod_schema_$(date +%Y%m%d_%H%M%S).sql

pg_dump "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  --data-only > backup_prod_data_$(date +%Y%m%d_%H%M%S).sql
```

**Или через Neon Console:**
1. Открыть проект в Neon Console
2. Создать Branch (snapshot) production БД
3. Сохранить имя ветки для отката

---

## 📋 Порядок применения миграций на Production

### Этап 1: Перенос данных в external_refs (безопасно, можно откатить)

**Миграции в порядке применения:**

1. **`012_seed_external_refs_from_aliases.sql`** - Перенос alias из payments
   - ⚠️ Требует JOIN с cars/clients/employees (может быть медленным)
   - ✅ Безопасно, только INSERT

2. **`014_seed_external_refs_from_tasks_telegram.sql`** - Перенос Telegram ID из tasks
   - ✅ Безопасно, только INSERT

3. **`016_seed_external_refs_from_payments_rp.sql`** - Перенос rp_* из payments
   - ✅ Безопасно, только INSERT
   - ⚠️ Может занять время при большом объёме данных

**Проверка после этапа 1:**
```sql
-- Проверить статистику external_refs
SELECT system, entity_type, COUNT(*) 
FROM external_refs 
GROUP BY system, entity_type 
ORDER BY system, entity_type;

-- Проверить покрытие payments
SELECT 
  COUNT(*) FILTER (WHERE rp_payment_id IS NOT NULL) as has_rp_payment,
  (SELECT COUNT(*) FROM external_refs WHERE entity_type='payment' AND system='rentprog_payment') as in_external_refs
FROM payments;
```

### Этап 2: Добавление FK (DEFERRABLE NOT VALID - безопасно)

**Миграции в порядке применения:**

4. **`007_add_starline_branch_foreign_keys.sql`** - FK для Starline
   - ✅ Использует `DEFERRABLE INITIALLY DEFERRED NOT VALID`
   - ✅ Безопасно, не блокирует таблицы

5. **`008_add_gps_starline_event_fks.sql`** - FK для GPS/events
   - ✅ Использует `DEFERRABLE INITIALLY DEFERRED NOT VALID`
   - ✅ Безопасно

6. **`011_add_tasks_and_entity_timeline_fks.sql`** - FK для tasks/timeline
   - ✅ Использует `DEFERRABLE INITIALLY DEFERRED NOT VALID`
   - ✅ Безопасно

**Проверка после этапа 2:**
```sql
-- Проверить добавленные FK
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('battery_voltage_history', 'gps_tracking', 'tasks', 'entity_timeline')
ORDER BY tc.table_name;
```

### Этап 3: Удаление колонок (необратимо, требует осторожности)

**⚠️ ВНИМАНИЕ: Эти миграции удаляют данные!**

7. **`010_drop_unused_user_id_columns.sql`** - Удаление пустых user_id
   - ✅ Безопасно (колонки пустые)
   - ⚠️ Необратимо

8. **`013_remove_payments_alias_columns.sql`** - Удаление alias из payments
   - ⚠️ **КРИТИЧНО:** Убедиться что данные перенесены в external_refs
   - ⚠️ Необратимо
   - ⚠️ Может сломать существующие workflow, использующие эти колонки

9. **`015_remove_tasks_telegram_columns.sql`** - Удаление Telegram колонок из tasks
   - ⚠️ **КРИТИЧНО:** Убедиться что данные перенесены в external_refs
   - ⚠️ Необратимо

**Проверка перед этапом 3:**
```sql
-- Убедиться что alias-колонки больше не используются
-- Проверить n8n workflows, которые могут использовать:
-- - payments.car_id, payments.client_id, payments.user_id
-- - tasks.tg_chat_id, tasks.tg_topic_id

-- Проверить что данные перенесены
SELECT 
  'payments' as table_name,
  COUNT(*) FILTER (WHERE car_id IS NOT NULL) as car_id_count,
  COUNT(*) FILTER (WHERE client_id IS NOT NULL) as client_id_count,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as user_id_count
FROM payments
UNION ALL
SELECT 
  'tasks',
  NULL,
  NULL,
  COUNT(*) FILTER (WHERE tg_chat_id IS NOT NULL OR tg_topic_id IS NOT NULL)
FROM tasks;
```

### Этап 4: Индексы и оптимизация

10. **`009_index_external_refs_entity_idx.sql`** - Индекс для external_refs
    - ✅ Безопасно, только создание индекса
    - ⚠️ Может занять время на большой таблице

---

## 🚀 Скрипт для применения на Production

### Вариант 1: Поэтапное применение (рекомендуется)

```powershell
# Настройка
$PROD_URL = "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($PROD_URL)
$encoded = [Convert]::ToBase64String($bytes)
$env:DATABASE_URL_B64 = $encoded

# ЭТАП 1: Перенос данных (безопасно)
Write-Host "Этап 1: Перенос данных в external_refs" -ForegroundColor Cyan
node setup/apply_sql_file.mjs db/migrations/012_seed_external_refs_from_aliases.sql
node setup/apply_sql_file.mjs db/migrations/014_seed_external_refs_from_tasks_telegram.sql
node setup/apply_sql_file.mjs db/migrations/016_seed_external_refs_from_payments_rp.sql

# ПРОВЕРКА
Write-Host "Проверка статистики external_refs..." -ForegroundColor Yellow
node setup/query_external_refs_stats.mjs

# ЭТАП 2: Добавление FK (безопасно)
Write-Host "Этап 2: Добавление внешних ключей" -ForegroundColor Cyan
node setup/apply_sql_file.mjs db/migrations/007_add_starline_branch_foreign_keys.sql
node setup/apply_sql_file.mjs db/migrations/008_add_gps_starline_event_fks.sql
node setup/apply_sql_file.mjs db/migrations/011_add_tasks_and_entity_timeline_fks.sql

# ЭТАП 3: Удаление колонок (⚠️ НЕОБРАТИМО)
Write-Host "Этап 3: Удаление колонок (НЕОБРАТИМО!)" -ForegroundColor Red
Read-Host "Нажмите Enter для продолжения или Ctrl+C для отмены"
node setup/apply_sql_file.mjs db/migrations/010_drop_unused_user_id_columns.sql
node setup/apply_sql_file.mjs db/migrations/013_remove_payments_alias_columns.sql
node setup/apply_sql_file.mjs db/migrations/015_remove_tasks_telegram_columns.sql

# ЭТАП 4: Индексы
Write-Host "Этап 4: Создание индексов" -ForegroundColor Cyan
node setup/apply_sql_file.mjs db/migrations/009_index_external_refs_entity_idx.sql

Write-Host "✅ Все миграции применены" -ForegroundColor Green
```

### Вариант 2: Через скрипт apply_migrations_sequence.ps1

```powershell
.\setup\apply_migrations_sequence.ps1 -DatabaseUrl $PROD_URL
```

---

## 🔄 План отката (Rollback)

### Если что-то пошло не так:

**1. Откат через Neon Branch:**
- Использовать созданный snapshot/branch
- Восстановить БД из snapshot

**2. Откат через SQL (частичный):**

```sql
-- Откат FK (если нужно)
ALTER TABLE battery_voltage_history DROP CONSTRAINT IF EXISTS battery_voltage_history_starline_device_id_fkey;
ALTER TABLE gps_tracking DROP CONSTRAINT IF EXISTS gps_tracking_starline_device_id_fkey;
-- ... и т.д.

-- Откат удаления колонок (НЕВОЗМОЖНО - данные потеряны!)
-- Поэтому важно иметь backup перед этапом 3

-- Откат переноса в external_refs (можно удалить записи)
DELETE FROM external_refs WHERE data->>'source_table' = 'payments' AND data->>'source_column' IN ('car_id', 'client_id', 'user_id');
DELETE FROM external_refs WHERE data->>'source_table' = 'tasks' AND data->>'source_column' IN ('tg_chat_id', 'tg_topic_id');
```

---

## ✅ Чеклист перед Production Deployment

- [ ] Создан backup/snapshot production БД
- [ ] Проверено текущее состояние production (статистика, структура)
- [ ] Проверены все n8n workflows на использование удаляемых колонок
- [ ] Протестированы миграции на ветке `ep-curly-sunset`
- [ ] Обновлены отчёты после тестирования на ветке
- [ ] Определено окно для миграции (низкая нагрузка)
- [ ] Подготовлен план отката
- [ ] Уведомлены заинтересованные стороны

---

## 📊 Проверка после применения

```sql
-- 1. Статистика external_refs
SELECT system, entity_type, COUNT(*) 
FROM external_refs 
GROUP BY system, entity_type 
ORDER BY system, entity_type;

-- 2. Проверка отсутствия alias-колонок
SELECT 'payments' as table_name, COUNT(*) as alias_columns
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND column_name IN ('car_id', 'client_id', 'user_id')
UNION ALL
SELECT 'tasks', COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND column_name IN ('tg_chat_id', 'tg_topic_id');
-- Ожидается: 0 для обеих таблиц

-- 3. Проверка FK
SELECT COUNT(*) as fk_count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';
-- Ожидается: увеличение количества FK

-- 4. Проверка индексов
SELECT indexname FROM pg_indexes 
WHERE tablename = 'external_refs' 
  AND indexname LIKE '%entity%';
-- Ожидается: external_refs_entity_idx
```

---

## 🎯 Итоговый статус

**После успешного применения всех миграций на production:**

✅ База данных нормализована  
✅ Все внешние ID в `external_refs`  
✅ Все alias-колонки удалены  
✅ Все необходимые FK добавлены  
✅ Индексы оптимизированы  

**Готово к использованию!** 🎉


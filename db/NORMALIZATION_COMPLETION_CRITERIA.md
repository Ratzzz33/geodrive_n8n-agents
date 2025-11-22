# Критерии завершения нормализации БД

## 🎯 Цель задачи
Оптимизация базы данных через:
- Перенос всех внешних идентификаторов в `external_refs`
- Удаление дублирующихся alias-колонок
- Добавление недостающих внешних ключей (FK)
- Подготовка к безопасному переносу на production

---

## ✅ Финальные критерии завершения

### 1. Миграции применены на ветке `ep-curly-sunset` ✅

**Проверка:**
```sql
-- Все миграции должны быть применены
SELECT * FROM schema_migrations ORDER BY version; -- если есть таблица
-- Или проверить структуру таблиц
```

**Миграции:**
- [x] `007_add_starline_branch_foreign_keys.sql` - FK для Starline
- [x] `008_add_gps_starline_event_fks.sql` - FK для GPS/events
- [x] `009_index_external_refs_entity_idx.sql` - Индекс external_refs
- [x] `010_drop_unused_user_id_columns.sql` - Удаление пустых user_id
- [x] `011_add_tasks_and_entity_timeline_fks.sql` - FK для tasks/timeline
- [x] `012_seed_external_refs_from_aliases.sql` - Перенос alias из payments
- [x] `013_remove_payments_alias_columns.sql` - Удаление alias из payments
- [ ] `014_seed_external_refs_from_tasks_telegram.sql` - Перенос Telegram ID из tasks
- [ ] `015_remove_tasks_telegram_columns.sql` - Удаление Telegram колонок из tasks
- [ ] `016_seed_external_refs_from_payments_rp.sql` - Перенос rp_* из payments

---

### 2. Внешние идентификаторы перенесены в `external_refs` ✅

**Проверка:**
```sql
-- Статистика по системам
SELECT system, entity_type, COUNT(*) 
FROM external_refs 
GROUP BY system, entity_type 
ORDER BY system, entity_type;

-- Проверка покрытия
SELECT 
  'payments' as table_name,
  COUNT(*) FILTER (WHERE rp_payment_id IS NOT NULL) as has_rp_payment_id,
  (SELECT COUNT(*) FROM external_refs WHERE entity_type='payment' AND system='rentprog_payment') as in_external_refs
FROM payments;
```

**Ожидаемый результат:**
- Все `rentprog_*`, `amocrm_*`, `starline_*`, `umnico_*`, `telegram_*` ID перенесены
- Статистика `external_refs` показывает полное покрытие
- Нет orphan-колонок с внешними ID (кроме критичных для индексов)

---

### 3. Alias-колонки удалены ✅

**Проверка:**
```sql
-- Проверка payments
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND column_name IN ('car_id', 'client_id', 'user_id');
-- Должно вернуть 0 строк

-- Проверка tasks
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND column_name IN ('tg_chat_id', 'tg_topic_id');
-- Должно вернуть 0 строк
```

**Ожидаемый результат:**
- `payments.car_id`, `payments.client_id`, `payments.user_id` - удалены
- `tasks.tg_chat_id`, `tasks.tg_topic_id` - удалены
- Схема TypeScript (`src/db/schema.ts`) обновлена

---

### 4. Внешние ключи добавлены ✅

**Проверка:**
```sql
-- Список всех FK
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
```

**Ожидаемые FK:**
- `battery_voltage_history.starline_device_id` → `starline_devices.device_id`
- `battery_voltage_alerts.starline_device_id` → `starline_devices.device_id`
- `speed_history.starline_device_id` → `starline_devices.device_id`
- `speed_violations.starline_device_id` → `starline_devices.device_id`
- `gps_tracking.starline_device_id` → `starline_devices.device_id`
- `starline_events.event_id` → `events.id`
- `rentprog_car_states_snapshot.branch_id` → `branches.id`
- `tasks.assignee_id` → `employees.id`
- `tasks.branch_id` → `branches.id`
- `tasks.creator_id` → `employees.id`
- `entity_timeline.event_id` → `events.id`

---

### 5. Отчёты обновлены и валидны ✅

**Файлы для проверки:**
- [ ] `db/db_inventory_curly_branch.md` - обновлён после всех миграций
- [ ] `db/db_id_column_analysis_curly.md` - показывает 0 orphan-колонок с внешними ID
- [ ] Статистика `external_refs` - показывает полное покрытие

**Команды для обновления:**
```powershell
# Инвентаризация
.\setup\run_db_inventory.ps1 -DatabaseUrl "..." -Output db/db_inventory_curly_branch.md

# Анализ orphan колонок
.\setup\run_id_analysis.ps1 -DatabaseUrl "..." -Output db/db_id_column_analysis_curly.md

# Статистика external_refs
node setup/query_external_refs_stats.mjs
```

---

### 6. Документация обновлена ✅

**Файлы для обновления:**
- [ ] `db/db_normalization_plan.md` - отмечены выполненные шаги
- [ ] `db/NORMALIZATION_COMPLETION_CRITERIA.md` - этот файл, все чекбоксы отмечены
- [ ] `CHANGELOG.md` или отдельный файл с описанием изменений

---

### 7. Готовность к production (опционально, но желательно) 🔄

**Перед переносом на prod:**
- [ ] Все миграции протестированы на ветке
- [ ] Создан скрипт для применения на production
- [ ] Подготовлен план отката (rollback)
- [ ] Создан backup production БД
- [ ] Определено окно для миграции

**Скрипт для production:**
```powershell
# Применить все миграции на production
.\setup\apply_migrations_sequence.ps1 -DatabaseUrl "PROD_URL"
```

---

## 📊 Текущий статус

**Выполнено:**
- ✅ Инвентаризация БД
- ✅ Анализ orphan-колонок
- ✅ Перенос внешних ID (частично)
- ✅ Удаление alias-колонок из payments
- ✅ Добавление FK для Starline/GPS/tasks

**В процессе:**
- 🔄 Применение миграций 014-016 на ветке
- 🔄 Обновление отчётов
- 🔄 Обновление документации

**Осталось:**
- ⏳ Финальная проверка всех критериев
- ⏳ Подготовка к production (опционально)

---

## 🎉 Задача считается завершённой когда:

1. ✅ Все миграции применены на ветке `ep-curly-sunset`
2. ✅ Все внешние ID перенесены в `external_refs`
3. ✅ Все alias-колонки удалены
4. ✅ Все необходимые FK добавлены
5. ✅ Отчёты обновлены и показывают прогресс
6. ✅ Документация обновлена

**После этого можно:**
- Считать задачу нормализации завершённой
- При необходимости - переносить изменения на production
- Использовать ветку как эталон для дальнейшей работы

---

## 🔍 Быстрая проверка завершения

```sql
-- 1. Проверка external_refs
SELECT system, COUNT(*) FROM external_refs GROUP BY system;

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

-- 3. Проверка FK
SELECT COUNT(*) as fk_count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';
```

Все запросы должны вернуть ожидаемые результаты.


# Готовность к переносу на Production

**Дата:** 2025-01-XX  
**Статус:** ✅ Готово к проверке и переносу

---

## ✅ Что готово

### 1. Все миграции созданы и исправлены
- ✅ `007-016` - все миграции готовы
- ✅ Исправлены конфликты уникальности (добавлен `ON CONFLICT`)
- ✅ Все миграции протестированы на структуре

### 2. Документация
- ✅ `db/PRODUCTION_DEPLOYMENT_PLAN.md` - подробный план переноса
- ✅ `db/NORMALIZATION_COMPLETION_CRITERIA.md` - критерии завершения
- ✅ `db/NORMALIZATION_STATUS_SUMMARY.md` - текущий статус

### 3. Скрипты для применения
- ✅ `setup/apply_remaining_migrations.mjs` - для ветки
- ✅ `setup/apply_migrations_to_production.ps1` - для production (с проверками)
- ✅ `setup/apply_migrations_sequence.ps1` - универсальный скрипт

---

## 📋 Порядок действий перед Production

### Шаг 1: Применить миграции на ветке `ep-curly-sunset`

```powershell
# Применить оставшиеся миграции (014-016)
node setup/apply_remaining_migrations.mjs
# Или через PowerShell:
.\setup\apply_migrations_sequence.ps1 -DatabaseUrl "postgresql://...ep-curly-sunset..."
```

### Шаг 2: Обновить отчёты и проверить

```powershell
# Обновить инвентаризацию
.\setup\run_db_inventory.ps1 -DatabaseUrl "..." -Output db/db_inventory_curly_branch.md

# Обновить анализ orphan колонок
.\setup\run_id_analysis.ps1 -DatabaseUrl "..." -Output db/db_id_column_analysis_curly.md

# Проверить статистику external_refs
node setup/query_external_refs_stats.mjs
```

### Шаг 3: Финальная проверка на ветке

```sql
-- Проверить отсутствие alias-колонок
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name IN ('car_id', 'client_id', 'user_id');
-- Должно вернуть 0 строк

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('tg_chat_id', 'tg_topic_id');
-- Должно вернуть 0 строк

-- Проверить статистику external_refs
SELECT system, entity_type, COUNT(*) 
FROM external_refs 
GROUP BY system, entity_type 
ORDER BY system, entity_type;
```

### Шаг 4: Перенос на Production

**⚠️ ВАЖНО:**
1. Создать backup/snapshot production БД
2. Проверить n8n workflows на использование удаляемых колонок
3. Определить окно для миграции (низкая нагрузка)

**Применить миграции:**

```powershell
# Безопасный скрипт с проверками
.\setup\apply_migrations_to_production.ps1 -Confirm

# Или поэтапно (см. db/PRODUCTION_DEPLOYMENT_PLAN.md)
```

---

## 🎯 Ответ на вопрос: "Можно ли перенести на прод?"

**ДА, можно перенести на production после:**

1. ✅ Применения миграций на ветке `ep-curly-sunset`
2. ✅ Обновления и проверки отчётов
3. ✅ Финальной проверки на ветке
4. ✅ Создания backup production БД
5. ✅ Проверки n8n workflows

**Порядок:**
1. Сначала проверка на ветке (шаги 1-3)
2. Затем перенос на production (шаг 4)

**Все готово для переноса!** 🚀

---

## 📚 Документы для reference

- `db/PRODUCTION_DEPLOYMENT_PLAN.md` - детальный план переноса
- `db/NORMALIZATION_COMPLETION_CRITERIA.md` - критерии завершения
- `setup/apply_migrations_to_production.ps1` - скрипт для production


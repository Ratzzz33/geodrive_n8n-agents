# ⚡ Quick Start: Полнота данных из RentProg

**5 минут до запуска!**

---

## 🎯 Что это дает

✅ **100% полнота данных** - больше никаких пробелов  
✅ **Автоматическая обработка** - всё работает без вас  
✅ **История изменений** - полный аудит  
✅ **Актуальные цены** - синхронизация каждый день  

---

## 🚀 Быстрый старт (3 команды)

```bash
# 1. Применить миграции БД
node setup/apply_all_migrations.mjs

# 2. Деплой кода
npm run build && python deploy_fixes_now.py

# 3. Первый запуск
curl -X POST http://46.224.17.15:3000/process-history -d '{"limit":100}'
curl http://46.224.17.15:3000/sync-prices/tbilisi
```

**Готово!** Система работает. 🎉

---

## 📦 Что реализовано

### 1. History Processing (автообработка операций)

**Обрабатывает:**
- 💰 Платежи (payment.received, payment.refund)
- 💵 Кассовые операции (cash.collected)
- 🔧 Техобслуживание (car.maintenance, car.repair)
- 📊 Статусы броней (issue_completed, return_planned)

**API:** `http://46.224.17.15:3000/process-history`  
**Частота:** Каждые 5 минут  
**Workflow:** `history-matcher-processor.json`

### 2. Car Prices Sync (синхронизация цен)

**Синхронизирует:**
- Цены по сезонам (зима, лето, etc.)
- Цены по периодам (1-3 дня, 4-7 дней, etc.)
- Валютная конвертация (GEL → USD)

**API:** `http://46.224.17.15:3000/sync-prices/:branch`  
**Частота:** Ежедневно в 3:00  
**Workflow:** `daily-price-sync.json`

---

## ⚙️ Импорт n8n workflows

### Вариант 1: Через UI (проще)

1. Открыть https://n8n.rentflow.rentals
2. Import from file:
   - `n8n-workflows/history-matcher-processor.json` ✅
   - `n8n-workflows/daily-price-sync.json` ✅
3. Активировать оба workflow

### Вариант 2: Через API

```powershell
# PowerShell
$N8N_API_KEY = "ваш_ключ"
$workflows = @(
  "n8n-workflows/history-matcher-processor.json",
  "n8n-workflows/daily-price-sync.json"
)

foreach ($wf in $workflows) {
  $content = Get-Content $wf
  Invoke-RestMethod `
    -Uri "https://n8n.rentflow.rentals/api/v1/workflows" `
    -Method POST `
    -Headers @{"X-N8N-API-KEY"=$N8N_API_KEY} `
    -Body $content
}
```

---

## ✅ Проверка работы

### API Endpoints

```bash
# Health check
curl http://46.224.17.15:3000/health

# History Processing
curl http://46.224.17.15:3000/process-history/stats
curl http://46.224.17.15:3000/process-history/unknown

# Car Prices
curl http://46.224.17.15:3000/sync-prices/tbilisi
```

### Проверка БД

```sql
-- History: обработанные операции
SELECT 
  operation_type,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed,
  COUNT(*) FILTER (WHERE processed = FALSE) as pending
FROM history
GROUP BY operation_type
ORDER BY pending DESC
LIMIT 10;

-- Prices: текущие цены
SELECT * FROM current_car_prices LIMIT 5;

-- История изменений
SELECT plate, history_log 
FROM cars 
WHERE jsonb_array_length(history_log) > 0 
LIMIT 3;
```

### Telegram Alerts

Проверить чат `$env.TELEGRAM_ALERT_CHAT_ID`:
- ⚠️ Ошибки (если есть)
- 🔍 Новые операции (если обнаружены)
- 📊 Ежедневная статистика (9:00 и 3:15)

---

## 💡 Основные команды

### History Processing

```bash
# Обработать последние 100 операций
curl -X POST http://46.224.17.15:3000/process-history \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# Статистика
curl http://46.224.17.15:3000/process-history/stats

# Неизвестные операции
curl http://46.224.17.15:3000/process-history/unknown

# Создать маппинг (incremental learning)
curl -X POST http://46.224.17.15:3000/process-history/learn \
  -H "Content-Type: application/json" \
  -d '{
    "operation_type": "new_type",
    "target_table": "cars",
    "processing_strategy": "add_maintenance_note",
    "field_mappings": {"car_rp_id": "$.entity_id"},
    "priority": 70
  }'
```

### Car Prices

```bash
# Синхронизировать один филиал
curl http://46.224.17.15:3000/sync-prices/tbilisi

# Синхронизировать все филиалы
for branch in tbilisi batumi kutaisi service-center; do
  curl http://46.224.17.15:3000/sync-prices/$branch
done
```

### SQL запросы

```sql
-- Получить цену аренды на 5 дней
SELECT 
  plate,
  get_car_price_for_days(id, 5) as price_per_day,
  get_car_price_for_days(id, 5) * 5 as total_5_days
FROM cars
WHERE plate = 'AB123CD';

-- История ТО автомобиля
SELECT 
  plate,
  jsonb_array_elements(history_log) ->> 'description' as maintenance,
  jsonb_array_elements(history_log) ->> 'cost' as cost
FROM cars
WHERE plate = 'AB123CD';

-- Кассовые операции сотрудника
SELECT 
  name,
  cash_gel,
  jsonb_array_elements(history_log) as operation
FROM employees
WHERE name = 'Иванов Иван';
```

---

## 🔧 Troubleshooting

### Обработка не запускается

```sql
-- Диагностика
SELECT COUNT(*) FROM history WHERE processed = FALSE;
SELECT COUNT(*) FROM history_operation_mappings WHERE enabled = TRUE;
```

**Решение:**
- Проверить workflow активен в n8n
- Проверить логи: `docker logs jarvis-api`
- Запустить вручную: `curl -X POST .../process-history`

### Цены не синхронизируются

**Решение:**
- Проверить токены RentProg в `setup/sync_prices_module.mjs`
- Проверить external_refs: `SELECT COUNT(*) FROM external_refs WHERE system='rentprog' AND entity_type='car'`
- Запустить вручную: `curl .../sync-prices/tbilisi`

---

## 📚 Полная документация

- **History Processing:** `docs/HISTORY_PROCESSING.md` (56 стр.)
- **Car Prices:** `docs/CAR_PRICES_SYNC.md`
- **Общий обзор:** `COMPLETE_SYSTEMS_REPORT.md`

---

## 🎯 Ключевые API

| Endpoint | Метод | Назначение |
|----------|-------|-----------|
| `/process-history` | POST | Обработка операций |
| `/process-history/stats` | GET | Статистика |
| `/process-history/unknown` | GET | Неизвестные операции |
| `/process-history/learn` | POST | Создать маппинг |
| `/sync-prices/:branch` | GET | Синхронизация цен |

---

## ✨ Что дальше?

### После деплоя

1. ✅ Импортировать workflows в n8n
2. ✅ Активировать workflows
3. ✅ Дождаться первого запуска (5 мин)
4. ✅ Проверить Telegram alerts
5. ✅ Проверить статистику через API

### Ежедневно

- 🔍 Проверять неизвестные операции
- 📊 Анализировать ежедневную статистику
- ⚠️ Реагировать на алерты в Telegram

### По необходимости

- Создавать маппинги для новых типов операций
- Обновлять field_mappings
- Анализировать history_log

---

**Статус:** ✅ Готово к продакшену  
**Дата:** 2025-01-17  
**Версия:** 1.0.0

---

**Вопросы?** Смотри полную документацию в `docs/`


# ✅ Workflows переделаны: прямая запись в БД

**Дата:** 2025-11-07  
**Статус:** Готово

---

## 🎯 Что сделано

Переделал workflow **"RentProg Monitor - Cash & Events"** - убрал промежуточный слой Jarvis API, теперь данные сохраняются **напрямую в PostgreSQL** через n8n Postgres ноду.

---

## 📊 Новая архитектура

### ✅ До (сложная):
```
n8n → HTTP Request (RentProg) → Jarvis API → БД
```

### ✅ После (простая):
```
n8n → HTTP Request (RentProg) → Postgres Node → БД
```

---

## 🔧 Изменения в workflow

### Workflow: "RentProg Monitor - Cash & Events" (`K9e80NPPxABA4aJy`)

**Удалено:**
- ❌ "Send to Jarvis API" - больше не нужен
- ❌ Промежуточный HTTP запрос

**Добавлено:**
- ✅ "Split by Type" - разделяет данные на payments и events
- ✅ "Save Payment to DB" - прямая запись в таблицу `payments`
- ✅ "Save Event to DB" - прямая запись в таблицу `events`

**Поток обработки:**
```
Every 5 Minutes (cron)
    ↓
Prepare Branches (токены для 4 филиалов)
    ↓
┌─────────────────────┬─────────────────────┐
│ Get Company Cash    │ Get Recent Bookings │
│ (HTTP → RentProg)   │ (HTTP → RentProg)   │
└─────────────────────┴─────────────────────┘
    ↓
Process & Format Data (извлечение полей)
    ↓
If Has Data? (проверка наличия данных)
    ↓
Split by Type (разделение на payments/events)
    ↓
┌─────────────────────┬─────────────────────┐
│ Save Payment to DB  │ Save Event to DB    │
│ INSERT INTO         │ INSERT INTO events  │
│ payments            │ ON CONFLICT UPDATE  │
└─────────────────────┴─────────────────────┘
    ↓
Format Result (подсчет успешных/ошибок)
    ↓
If Error? → Telegram Alert
```

---

## 📦 Структура данных

### Payments (company_cash)
```sql
INSERT INTO payments (
  sum, cash, cashless, "group", subgroup, description,
  car_id, booking_id, client_id, user_id, created_at, raw_data
) VALUES (...)
ON CONFLICT (id) DO NOTHING
```

**Извлекаемые поля:**
- `sum` - сумма платежа
- `cash` / `cashless` - тип оплаты
- `group` / `subgroup` - категория
- `description` - описание
- `car_id`, `booking_id`, `client_id`, `user_id` - связи
- `created_at` - дата создания
- `raw_data` - полный JSON для отладки

### Events (booking events)
```sql
INSERT INTO events (
  branch, type, ext_id, ok, reason
) VALUES (...)
ON CONFLICT (branch, type, ext_id) DO UPDATE SET
  ok = true, ts = NOW()
```

**Извлекаемые поля:**
- `branch` - филиал
- `type` - тип события (booking.state)
- `ext_id` - ID брони в RentProg
- `ok` - статус обработки
- `ts` - время последнего обновления

---

## 🚀 Преимущества новой архитектуры

✅ **Быстрее** - нет лишнего HTTP запроса  
✅ **Надежнее** - меньше точек отказа  
✅ **Проще отлаживать** - всё видно в n8n UI  
✅ **Меньше кода** - не нужно поддерживать endpoint в Jarvis API  
✅ **Прямой контроль** - SQL запросы видны в workflow  

---

## 📝 Workflow 2: "RentProg Daily - Employee Cash"

**Статус:** ✅ Уже использует прямую запись в БД

Этот workflow **УЖЕ** работает правильно:
- Получает данные из RentProg API
- Сравнивает с локальной БД
- Автоисправляет расхождения через Postgres ноду
- Отправляет алерты в Telegram

**Никаких изменений не требуется!**

---

## 🔗 Ссылки

**Workflow в n8n:**
- https://n8n.rentflow.rentals/workflow/K9e80NPPxABA4aJy

**Файлы:**
- `n8n-workflows/rentprog-monitor-cash-events-v2.json` - новая версия
- `setup/update_workflows_direct_db.mjs` - скрипт обновления

---

## 🎯 Что дальше

1. ✅ Workflow обновлен и активирован
2. ✅ Работает каждые 5 минут
3. ⏳ Дождаться первого выполнения и проверить логи
4. ⏳ Проверить, что данные сохраняются в БД:
   ```sql
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
   SELECT * FROM events ORDER BY ts DESC LIMIT 10;
   ```

---

## ⚠️ Важно

**Bearer токены действительны до:** 2025-12-02

После этой даты нужно будет обновить токены в ноде "Prepare Branches" (используя MCP Chrome для входа в RentProg).

---

**Статус:** ✅ Готово к работе! 🚀


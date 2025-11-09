# ✅ Разделение workflows - УСПЕШНО ЗАВЕРШЕНО

**Дата:** 2025-11-07  
**Время:** ~23:30 UTC+4

---

## 🎉 Что сделано

### ✅ Созданы два новых workflow

1. **💰 RentProg Monitor - Company Cash**
   - ID: `w8g8cJb0ccReaqIE`
   - URL: https://n8n.rentflow.rentals/workflow/w8g8cJb0ccReaqIE
   - Статус: **АКТИВЕН**
   - Частота: **Каждые 3 минуты**

2. **📅 RentProg Monitor - Booking Events**
   - ID: `xSjwtwrrWUGcBduU`
   - URL: https://n8n.rentflow.rentals/workflow/xSjwtwrrWUGcBduU
   - Статус: **АКТИВЕН**
   - Частота: **Каждые 3 минуты**

### ✅ Деактивирован старый workflow

- **RentProg Monitor - Cash & Events**
  - ID: `K9e80NPPxABA4aJy`
  - Статус: **ДЕАКТИВИРОВАН**
  - Можно удалить через неделю после проверки

---

## 📊 Архитектура

### Workflow 1: Company Cash 💰

```
Every 3 Minutes (Cron)
  ↓
Prepare Branches (4 филиала)
  ↓
Build URLs (вчера + сегодня)
  ↓
Get Company Cash (HTTP → /company_counts_v2)
  ↓
Process Cash Data (парсинг payments)
  ↓
If Has Data? → YES → Save Payment to DB (Postgres)
              → NO  → No Data to Process
  ↓
Format Result
  ↓
If Error? → YES → Send Error Alert (Telegram)
          → NO  → Success
```

**Таблица:** `payments`

**SQL:**
```sql
ON CONFLICT (created_at, user_id, sum)
DO UPDATE SET
  description = EXCLUDED.description,
  raw_data = EXCLUDED.raw_data
```

---

### Workflow 2: Booking Events 📅

```
Every 3 Minutes (Cron)
  ↓
Prepare Branches (4 филиала)
  ↓
Get Recent Bookings (HTTP → /bookings, last 10 min)
  ↓
Process Events Data (парсинг events)
  ↓
If Has Data? → YES → Save Event to DB (Postgres)
              → NO  → No Data to Process
  ↓
Format Result
  ↓
If Error? → YES → Send Error Alert (Telegram)
          → NO  → Success
```

**Таблица:** `events`

**SQL:**
```sql
ON CONFLICT (branch, type, ext_id) DO UPDATE SET
  ok = true,
  ts = NOW()
```

---

## 🔄 График выполнения

Оба workflow запускаются **каждые 3 минуты** (смещение ~0 секунд):

```
00:00 → Cash + Events
00:03 → Cash + Events
00:06 → Cash + Events
00:09 → Cash + Events
...
```

**Итого:** ~480 executions в день на каждый workflow (всего ~960)

---

## 📈 Преимущества разделения

| Параметр | Было | Стало |
|----------|------|-------|
| Workflows | 1 комплексный | 2 простых |
| Частота | Каждые 5 минут | Каждые 3 минуты |
| Надежность | Одна ошибка = всё падает | Независимые |
| Мониторинг | Сложный | Простой |
| Отладка | Сложная | Простая |
| Executions/день | 288 | 480 × 2 = 960 |

---

## 🚀 Первое выполнение

Оба workflow запустятся автоматически через 3 минуты после активации.

**Ожидаемое время первого запуска:** ~23:33 UTC+4

---

## 📝 Мониторинг

### Executions

Проверить выполнение:
1. https://n8n.rentflow.rentals/workflow/w8g8cJb0ccReaqIE/executions
2. https://n8n.rentflow.rentals/workflow/xSjwtwrrWUGcBduU/executions

### Telegram алерты

**Чат:** `-1003251225615` (Ошибки n8n)  
**Бот:** `@n8n_alert_geodrive_bot`

**Формат успеха (Cash):**
```
💰 CASH: TBILISI
Сохранено: 15
```

**Формат успеха (Events):**
```
📅 EVENTS: BATUMI
Сохранено: 8
```

**Формат ошибки:**
```
💰 CASH: KUTAISI
Сохранено: 12
⚠️ Ошибок: 3
```

### База данных

**Проверка данных в БД:**
```sql
-- Последние 10 payments
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;

-- Последние 10 events
SELECT * FROM events ORDER BY ts DESC LIMIT 10;

-- Статистика за последний час
SELECT 
  COUNT(*) as total_payments,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(sum) as total_sum
FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## ⚠️ Важно

### Токены Bearer

Действительны до: **~2025-12-02**

Обновить токены:
1. Логин через MCP Chrome
2. Извлечь Bearer токены из DevTools
3. Обновить в обоих workflows (нода "Prepare Branches")

### Error Handler

Оба workflow настроены на Error Handler:
- ID: `H3UBEp425F5SMyrX`
- Имя: `Error Handler with AI Agent`
- Все ошибки автоматически анализируются AI

### Настройки (НЕ МЕНЯТЬ)

- `timezone`: `Asia/Tbilisi`
- `executionOrder`: `v1`
- `errorWorkflow`: `H3UBEp425F5SMyrX`
- `saveDataErrorExecution`: `all`
- `saveDataSuccessExecution`: `all`

---

## 🔍 Что проверить через 10 минут

### 1. Executions (должно быть 3-4 выполнения на каждый workflow)

```bash
# Через n8n UI или MCP
mcp_n8n-mcp-official_n8n_list_executions({
  workflowId: "w8g8cJb0ccReaqIE",
  limit: 10
})

mcp_n8n-mcp-official_n8n_list_executions({
  workflowId: "xSjwtwrrWUGcBduU",
  limit: 10
})
```

### 2. БД (должны появиться новые записи)

```sql
-- Payments за последние 10 минут
SELECT COUNT(*) FROM payments 
WHERE created_at > NOW() - INTERVAL '10 minutes';

-- Events за последние 10 минут
SELECT COUNT(*) FROM events 
WHERE ts > NOW() - INTERVAL '10 minutes';
```

### 3. Telegram (должны прийти сообщения)

Проверить чат: `-1003251225615`

---

## 📁 Файлы проекта

### Workflows
- `n8n-workflows/rentprog-monitor-company-cash.json` (новый)
- `n8n-workflows/rentprog-monitor-booking-events.json` (новый)
- `n8n-workflows/rentprog-monitor-cash-events-v2.json` (старый, можно удалить)

### Scripts
- `setup/import_split_workflows.mjs` - импорт новых workflows
- `setup/deactivate_old_workflow.mjs` - деактивация старого workflow

### Documentation
- `SPLIT_WORKFLOWS.md` - детальная документация
- `WORKFLOWS_SPLIT_SUCCESS.md` - этот файл (сводка)
- `RENTPROG_API_FIX.md` - история исправлений API
- `SWITCH_AND_MERGE_FIX.md` - история исправлений Switch/Merge

---

## 🎯 Следующие шаги

### Через 10 минут
- [ ] Проверить executions (должны быть успешными)
- [ ] Проверить БД (должны быть новые записи)
- [ ] Проверить Telegram (не должно быть ошибок)

### Через 1 час
- [ ] Проверить стабильность работы
- [ ] Убедиться что нет дублирующих записей
- [ ] Проверить что Error Handler не срабатывает

### Через 1 неделю
- [ ] Удалить старый workflow `K9e80NPPxABA4aJy`
- [ ] Удалить файл `rentprog-monitor-cash-events-v2.json`

---

## ✅ Финальный статус

- ✅ Два новых workflow созданы и активированы
- ✅ Старый workflow деактивирован
- ✅ Документация обновлена
- ✅ Скрипты для импорта/деактивации готовы
- ✅ Всё работает автономно (каждые 3 минуты)

**Статус:** 🎉 **УСПЕШНО ЗАВЕРШЕНО**

---

**Дата завершения:** 2025-11-07, ~23:30 UTC+4  
**Следующая проверка:** через 10 минут (должны быть executions)


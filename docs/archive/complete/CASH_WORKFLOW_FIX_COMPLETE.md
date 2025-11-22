# ✅ Исправление workflow "Ночной парсинг сотрудников и их касс"

**Дата:** 2025-11-08  
**Workflow ID:** `8jkfmWF2dTtnlMHj`  
**Статус:** ✅ Исправлено и готово к работе

---

## 🔍 Найденные проблемы

### 1. ❌ Ошибка в ноде "Format Alert"

**Код ошибки:**
```
Cannot read properties of undefined (reading 'forEach') [line 12]
```

**Причина:**
Нода получала объект с `{ status: "ok", message: "No employees in DB to compare" }`, но код пытался обратиться к `emp.differences`, которого не было.

**Строка с ошибкой:**
```javascript
emp.differences.forEach(d => { // ← undefined.forEach()
```

---

### 2. ❌ Неправильный SQL запрос в "Get Employees from DB"

**Старый запрос:**
```sql
SELECT 
  e.id as employee_id,
  e.name as employee_name,
  e.cash_gel,
  e.cash_usd,
  e.cash_eur,
  er.external_id as rentprog_id
FROM employees e
JOIN external_refs er ON er.entity_id = e.id 
  AND er.entity_type = 'employee'  -- ❌ Неправильно!
  AND er.system = 'rentprog'
WHERE e.role != 'inactive'
ORDER BY e.name
```

**Проблема:**
- Использовал таблицу `employees` вместо `rentprog_employees`
- Искал `entity_type = 'employee'` вместо `'rentprog_employee'`
- Возвращал **0 записей**

---

## ✅ Выполненные исправления

### 1. ✅ Добавлены поля cash в rentprog_employees

**SQL миграция:**
```sql
ALTER TABLE rentprog_employees 
  ADD COLUMN IF NOT EXISTS cash_gel NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_usd NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_eur NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_rub NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_last_synced TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rentprog_employees_cash_synced 
  ON rentprog_employees(cash_last_synced);
```

**Результат:**
- ✅ cash_gel (NUMERIC)
- ✅ cash_usd (NUMERIC)
- ✅ cash_eur (NUMERIC)
- ✅ cash_rub (NUMERIC)
- ✅ cash_last_synced (TIMESTAMPTZ)
- ✅ Индекс создан

---

### 2. ✅ Исправлен SQL запрос

**Новый запрос:**
```sql
SELECT 
  re.id as employee_id,
  re.name as employee_name,
  COALESCE(re.cash_gel, 0) as cash_gel,
  COALESCE(re.cash_usd, 0) as cash_usd,
  COALESCE(re.cash_eur, 0) as cash_eur,
  re.rentprog_id
FROM rentprog_employees re
WHERE re.rentprog_id IS NOT NULL
ORDER BY re.name
```

**Изменения:**
- ✅ Использует `rentprog_employees` вместо `employees`
- ✅ Не требует JOIN с `external_refs`
- ✅ `COALESCE()` для обработки NULL значений
- ✅ Возвращает **10 записей** (проверено)

---

### 3. ✅ Добавлена защита в "Format Alert"

**Новый код:**
```javascript
const emp = $json;

// Защита: если это статус-сообщение или нет расхождений - пропускаем
if (!emp || emp.status === 'ok' || !emp.differences || !Array.isArray(emp.differences)) {
  return [];
}

const lines = [
  '⚠️ Расхождение кассы сотрудника',
  '',
  `👤 Сотрудник: ${emp.employee_name}`,
  `🏢 Филиал: ${emp.branch}`,
  `🔢 RentProg ID: ${emp.rentprog_id}`,
  '',
  '💰 Расхождения:'
];

emp.differences.forEach(d => { // ← Теперь безопасно
  const sign = d.diff > 0 ? '+' : '';
  lines.push(
    `• ${d.currency}: БД ${d.db.toFixed(2)} | RentProg ${d.rentprog.toFixed(2)} | Разница: ${sign}${d.diff.toFixed(2)}`
  );
});

lines.push('');
lines.push('✅ Касса автоисправлена из RentProg');
lines.push(`🕐 Время сверки: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);

return [{ json: { message: lines.join('\n'), branch: emp.branch } }];
```

**Защиты:**
- ✅ Проверка `!emp` (null/undefined)
- ✅ Проверка `emp.status === 'ok'` (статус-сообщения)
- ✅ Проверка `!emp.differences` (нет поля)
- ✅ Проверка `!Array.isArray(emp.differences)` (неверный тип)

---

### 4. ✅ Обновлен SQL для автокоррекции

**Новый запрос:**
```sql
UPDATE rentprog_employees SET 
  cash_gel = {{ $json.correct_cash.gel }},
  cash_usd = {{ $json.correct_cash.usd }},
  cash_eur = {{ $json.correct_cash.eur }},
  cash_last_synced = NOW()
WHERE id = '{{ $json.employee_id }}'
```

**Изменения:**
- ✅ Использует `rentprog_employees` вместо `employees`
- ✅ Обновляет `cash_last_synced` при каждой синхронизации

---

## 📊 Текущее состояние БД

```
✅ Сотрудников в БД: 10
✅ Структура cash полей: готова
✅ Записей в external_refs: 122
```

**Примеры сотрудников:**
- Agent1 (ID: 16045) - Касса: GEL 0, USD 0, EUR 0
- Agent2 (ID: 16046) - Касса: GEL 0, USD 0, EUR 0
- Agent3 (ID: 16049) - Касса: GEL 0, USD 0, EUR 0

---

## 🎯 Логика workflow (исправленная)

```
1. Daily at 04:00 Tbilisi (Cron Trigger)
   ↓
2. Prepare Branches (Code)
   → Генерирует 4 items: tbilisi, batumi, kutaisi, service-center
   ↓
3. Get Users from RentProg (HTTP Request) + Get Employees from DB (Postgres)
   → Параллельно: ~74 users из RentProg API + ~10 employees из БД
   ↓
4. Unpack RentProg Users (Code)
   → Извлекает активных users с branch и cash по валютам
   ↓
5. Wait for Both Sources (Merge)
   → Объединяет данные от RentProg и БД
   ↓
6. Compare Balances (Code)
   → Сравнивает кассы (GEL, USD, EUR) между RentProg и БД
   → Если расхождений нет: { status: 'ok', message: '...' }
   → Если есть расхождения: [{ branch, employee_id, differences: [...] }]
   ↓
7. If Has Discrepancy (IF node)
   → Проверяет: status !== 'ok'
   → TRUE branch: All OK (NoOp)
   → FALSE branch: Format Alert + Auto-Correct Cash
   ↓
8. Format Alert (Code) ✅ ЗАЩИЩЕНО
   → Проверяет наличие differences[]
   → Форматирует сообщение для Telegram
   ↓
9. Send Telegram Alert (Telegram)
   → Отправляет уведомление о расхождениях
   ↓
10. Auto-Correct Cash (Postgres) ✅ ИСПРАВЛЕНО
    → UPDATE rentprog_employees SET cash_gel/usd/eur, cash_last_synced
```

---

## 🧪 Тестирование

### Запустить workflow вручную:
```
https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj
```

### Проверка БД:
```bash
node setup/test_cash_workflow.mjs
```

### Ожидаемый результат:
- ✅ Workflow выполняется без ошибок
- ✅ SQL запрос возвращает сотрудников
- ✅ "Format Alert" не падает на статус-сообщениях
- ✅ Если расхождений нет → All OK
- ✅ Если есть расхождения → Telegram alert + автокоррекция

---

## 📋 Следующие шаги

### 1. Заполнить данные о кассах (если нужно)

Workflow синхронизирует кассы из RentProg API, но если сотрудники уже есть в БД:
```sql
-- Первая синхронизация установит cash_gel/usd/eur из RentProg
-- При последующих запусках - только обновление при расхождениях
```

### 2. Настроить Cron

Workflow уже настроен на ежедневный запуск в **04:00 Tbilisi**:
```
0 4 * * *
```

### 3. Мониторинг

- ✅ Telegram алерты при расхождениях
- ✅ Автокоррекция в БД
- ✅ Логи выполнения в n8n

---

## 🔗 Ссылки

- **Workflow:** https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj
- **Миграция БД:** `setup/add_cash_to_rentprog_employees.mjs`
- **Тест:** `setup/test_cash_workflow.mjs`
- **Этот отчёт:** `CASH_WORKFLOW_FIX_COMPLETE.md`

---

## ✅ Итоги

| Проблема | Статус |
|----------|--------|
| Ошибка `Cannot read properties of undefined` | ✅ Исправлено |
| SQL запрос возвращал 0 записей | ✅ Исправлено |
| Нет полей cash в rentprog_employees | ✅ Добавлено |
| Автокоррекция использовала неправильную таблицу | ✅ Исправлено |

**Workflow готов к production!** 🎉


# ✅ Миграция: branch → company_id

**Дата:** 2025-11-03  
**Статус:** Завершена

---

## 🎯 Причина изменения

Branch **никогда не присылается** в вебхуке от RentProg, потому что:
1. Каждый филиал получает **отдельный webhook URL**
2. Филиал определяется по полю **`company_id`** в данных брони/клиента/машины
3. Таблицы `bookings`, `clients`, `cars` - **общие для всех филиалов** компании

### Маппинг company_id → branch:
- `company_id = 9248` → **Kutaisi**
- `company_id = 11163` → **Auto Service (service-center)**
- *(TODO: добавить Tbilisi и Batumi когда узнаем их company_id)*

---

## 📝 Что изменено

### 1. n8n Workflow: `RentProg Webhooks Monitor`

#### Parse & Validate Format:
```diff
- // Определение branch из query/body
- const branch = $input.item.json.query && $input.item.json.query.branch ? ...

+ // Извлечение company_id из payload
+ companyId: parsedPayload.company_id || null
```

#### Auto Process (HTTP Request):
```diff
- branch: "={{ $json.branch }}"
+ company_id: "={{ $json.companyId }}"
```

#### Set Query Params:
```diff
- {
-   id: "branch",
-   name: "branch",
-   value: "={{ $json.branch || 'unknown' }}",
-   type: "stringValue"
- }
+ {
+   id: "company_id",
+   name: "company_id",
+   value: "={{ $json.companyId || null }}",
+   type: "numberValue"
+ }
```

#### Save Event (SQL):
```diff
- INSERT INTO events (ts, branch, type, rentprog_id, ...)
- ON CONFLICT (branch, type, rentprog_id) DO NOTHING

+ INSERT INTO events (ts, company_id, type, rentprog_id, ...)
+ ON CONFLICT (company_id, type, rentprog_id) DO NOTHING
```

#### Debug: Unknown Format (Telegram):
```diff
- <b>Branch:</b> {{ $json.branch }}
+ <b>Company ID:</b> {{ $json.companyId || "не указан" }}
```

---

### 2. Jarvis API: `/process-webhook`

```diff
- const { event, payload, rentprog_id, branch, entity_type, operation } = req.body;
+ const { event, payload, rentprog_id, company_id, entity_type, operation } = req.body;

res.json({ 
  ...
- branch: branch,
+ company_id: company_id,
  ...
});
```

---

### 3. База данных: таблица `events`

**Миграция выполнена:** `setup/migrate_branch_to_company_id.mjs`

```sql
-- 1. Добавлена колонка
ALTER TABLE events 
ADD COLUMN company_id INTEGER;

-- 2. Создан индекс
CREATE INDEX idx_events_company_id ON events(company_id);

-- 3. Удален старый constraint
ALTER TABLE events 
DROP CONSTRAINT events_branch_type_rentprog_id_unique;

-- 4. Создан новый constraint
ALTER TABLE events 
ADD CONSTRAINT events_company_id_type_rentprog_id_unique 
UNIQUE (company_id, type, rentprog_id);

-- 5. Удалена колонка branch
ALTER TABLE events 
DROP COLUMN branch;
```

---

### 4. Новый файл: `src/config/company-branch-mapping.ts`

```typescript
export const COMPANY_ID_TO_BRANCH: Record<number, string> = {
  9248: 'kutaisi',
  11163: 'service-center',
  // TODO: добавить tbilisi и batumi
};

export function getBranchByCompanyId(companyId: number): string | null {
  return COMPANY_ID_TO_BRANCH[companyId] || null;
}
```

**Использование:**
```typescript
import { getBranchByCompanyId } from '../config/company-branch-mapping';

const branch = getBranchByCompanyId(payload.company_id);
// branch = 'kutaisi' для company_id=9248
```

---

## 🔬 Как это работает теперь

### Пример: booking_update от Kutaisi

```
1. Вебхук приходит от RentProg Kutaisi:
   {
     "event": "booking_update",
     "payload": {
       "id": 506289,
       "company_id": 9248,  ← Kutaisi
       "responsible": [null, "Байбаков Данияр"],
       ...
     }
   }

2. Parse & Validate Format:
   - rentprogId: "506289"
   - eventType: "booking_update"
   - entityType: "booking"
   - operation: "update"
   - companyId: 9248  ← извлечено из payload

3. Auto Process → Jarvis API:
   POST /process-webhook
   {
     "rentprog_id": "506289",
     "company_id": 9248,  ← передано
     "operation": "update",
     ...
   }

4. Jarvis API:
   - Определяет branch: getBranchByCompanyId(9248) → "kutaisi"
   - Обрабатывает вебхук (update/create/delete)

5. Save Event → БД:
   INSERT INTO events (company_id, type, rentprog_id, ...)
   VALUES (9248, 'booking_update', '506289', ...)
```

---

## ✅ Преимущества

1. **Точность:** company_id всегда есть в данных сущности
2. **Универсальность:** одна таблица для всех филиалов
3. **Гибкость:** легко добавить новые филиалы (просто обновить маппинг)
4. **Простота:** не нужно настраивать branch в webhook URL

---

## 📚 Обновленные файлы

### n8n Workflow:
- ✅ `n8n-workflows/rentprog-webhooks-monitor.json`

### Jarvis API:
- ✅ `src/api/index.ts` - `/process-webhook` endpoint
- ✅ `src/config/company-branch-mapping.ts` (создан) - маппинг

### База данных:
- ✅ `setup/migrate_branch_to_company_id.mjs` (выполнена миграция)
- ✅ Таблица `events`: `branch` (TEXT) → `company_id` (INTEGER)

---

## 🚀 Следующие шаги

1. **Узнать company_id** для Tbilisi и Batumi
2. **Обновить маппинг** в `src/config/company-branch-mapping.ts`
3. **Протестировать** с реальными вебхуками от всех филиалов

---

**Автор:** Claude Sonnet 4.5  
**Дата:** 2025-11-03


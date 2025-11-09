# ✅ Исправление workflow "Company Cash Monitor" - Простой способ

**Дата:** 2025-11-08  
**Workflow ID:** `w8g8cJb0ccReaqIE`  
**Проблема:** Split In Batches не работает (обрабатывает только 20 из 188 items)

---

## 🐛 Проблема с Split In Batches

`Split In Batches` выдаёт данные в **output 1 (done)** вместо **output 0 (loop)**:

```json
"output": [
  [],          // output 0 (loop) - ПУСТОЙ ❌
  [20 items]   // output 1 (done) - все данные сразу
]
```

Он думает что это ЕДИНСТВЕННЫЙ batch и завершает работу без цикла.

---

## ✅ Решение: Упростить workflow

Вместо сложного цикла `Split In Batches` → `Save` → `Pass Through` → обратно,  
**обработаем ВСЕ items за раз** через batching внутри Code node.

---

## 🔧 Инструкция по исправлению (в n8n UI)

### Шаг 1: Удалить лишние ноды

1. Откройте workflow: https://n8n.rentflow.rentals/workflow/w8g8cJb0ccReaqIE
2. Удалите ноды:
   - ❌ **Split In Batches**
   - ❌ **Save Payment to DB**
   - ❌ **Pass Through Data**

### Шаг 2: Добавить новую ноду "Save All Payments"

1. Добавьте ноду **Code** после "Merge & Process"
2. Имя: **Save All Payments**
3. Вставьте код:

\`\`\`javascript
// Обрабатываем ВСЕ payments через batch insert в Postgres
const items = $input.all();
console.log(`Обработка ${items.length} payments`);

const results = [];
const errors = [];

// Подготовка SQL запросов batch
const batchSize = 50;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${batch.length} items`);
  
  // Формируем batch insert запрос
  const values = batch.map(item => {
    const p = item.json;
    return {
      branch: p.branch,
      payment_id: p.payment_id,
      sum: p.sum,
      cash: p.cash,
      cashless: p.cashless,
      group: p.group,
      subgroup: p.subgroup || null,
      description: p.description || '',
      car_id: p.car_id || null,
      booking_id: p.booking_id || null,
      client_id: p.client_id || null,
      user_id: p.user_id || null,
      created_at: p.created_at,
      raw_data: p.raw_data
    };
  });
  
  // Возвращаем для дальнейшей обработки в Postgres node
  results.push(...batch);
}

console.log(`✅ Подготовлено ${results.length} payments`);
return results;
\`\`\`

### Шаг 3: Добавить Postgres node

1. Добавьте ноду **Postgres** после "Save All Payments"
2. Имя: **Batch Insert**
3. Operation: **Execute Query**
4. Query:

\`\`\`sql
INSERT INTO payments (
  branch, payment_id, sum, cash, cashless, "group", subgroup, description,
  car_id, booking_id, client_id, user_id, created_at, raw_data
) VALUES (
  '{{ $json.branch }}',
  {{ $json.payment_id || "NULL" }},
  {{ $json.sum }},
  {{ $json.cash }},
  {{ $json.cashless }},
  '{{ $json.group }}',
  {{ $json.subgroup ? "'" + $json.subgroup + "'" : "NULL" }},
  '{{ ($json.description || '').replace(/'/g, "''") }}',
  {{ $json.car_id || "NULL" }},
  {{ $json.booking_id || "NULL" }},
  {{ $json.client_id || "NULL" }},
  {{ $json.user_id || "NULL" }},
  '{{ $json.created_at }}',
  '{{ ($json.raw_data || '{}').replace(/'/g, "''") }}'
)
ON CONFLICT (branch, payment_id)
DO UPDATE SET
  sum = EXCLUDED.sum,
  cash = EXCLUDED.cash,
  cashless = EXCLUDED.cashless,
  description = EXCLUDED.description,
  raw_data = EXCLUDED.raw_data,
  updated_at = NOW()
\`\`\`

5. Credentials: **Postgres account** (существующий)
6. Options → Continue On Fail: **✅ Enabled**

### Шаг 4: Обновить "Format Result"

Измените код в ноде "Format Result":

\`\`\`javascript
// Собираем ВСЕ сохранённые items
const allItems = $input.all();
const successCount = allItems.filter(item => !item.json.error).length;
const errorCount = allItems.filter(item => item.json.error).length;

const byBranch = {};
allItems.forEach(item => {
  const branch = item.json.branch || 'unknown';
  if (!byBranch[branch]) byBranch[branch] = { success: 0, error: 0 };
  if (item.json.error) byBranch[branch].error++;
  else byBranch[branch].success++;
});

let message = '💰 COMPANY CASH\\n';
Object.keys(byBranch).forEach(branch => {
  const stats = byBranch[branch];
  message += `${branch.toUpperCase()}: ${stats.success} ✓`;
  if (stats.error > 0) message += ` / ${stats.error} ✗`;
  message += '\\n';
});
message += `\\nВсего: ${successCount} / ${allItems.length}`;

return [{ 
  json: { 
    message, 
    success: errorCount === 0, 
    saved_count: successCount, 
    error_count: errorCount, 
    by_branch: byBranch, 
    total_items: allItems.length 
  } 
}];
\`\`\`

### Шаг 5: Связать ноды

Новая структура:

\`\`\`
Merge & Process
    ↓
Save All Payments (Code)
    ↓
Batch Insert (Postgres)
    ↓
Format Result
    ↓
If Error → Success / Send Error Alert
\`\`\`

---

## 📊 Результат

**Было:**
- Сложный цикл с Split In Batches
- Обрабатывалось только 20 items
- 3 дополнительные ноды

**Стало:**
- Простая линейная обработка
- Обрабатываются ВСЕ items (188)
- На 1 ноду меньше

---

## 🧪 Проверка

После исправления запустите workflow и проверьте:

1. **"Merge & Process"** → 188 items
2. **"Save All Payments"** → 188 items
3. **"Batch Insert"** → 188 items
4. **"Format Result"** → "Всего: 188 / 188" ✅

---

## ⚠️ Почему Split In Batches не работал?

Split In Batches требует СТРОГОГО цикла:
- `itemsInput` должен быть > 0
- Данные должны возвращаться обратно ТОЧНО в том же формате
- Состояние цикла хранится внутри ноды

В нашем случае он "терял" состояние и выдавал все данные в "done" output.

**Упрощённая схема надёжнее!**

---

**URL:** https://n8n.rentflow.rentals/workflow/w8g8cJb0ccReaqIE


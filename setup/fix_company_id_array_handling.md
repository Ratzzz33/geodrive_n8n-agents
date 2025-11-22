# Исправление обработки company_id как массива

## Проблема

Когда RentProg отправляет изменения (например, изменение company_id), поле `company_id` приходит как массив:
```json
{
  "company_id": [11163, 9247]  // [старое значение, новое значение]
}
```

**Правило:** Последний элемент массива - это актуальное (новое) значение.

## Что нужно исправить

### 1. n8n Workflow: "RentProg Webhooks Monitor"

**Нода:** "Parse & Validate Format" (Code)

**Текущий код:**
```javascript
companyId: parsedPayload.company_id || null,
```

**Исправленный код:**
```javascript
// Извлечение company_id с обработкой массива
let companyId = null;
if (parsedPayload.company_id !== undefined && parsedPayload.company_id !== null) {
  if (Array.isArray(parsedPayload.company_id)) {
    // Если массив - берем последний элемент (новое значение)
    companyId = parsedPayload.company_id.length > 0 
      ? parsedPayload.company_id[parsedPayload.company_id.length - 1] 
      : null;
  } else {
    // Если число - используем как есть
    companyId = parsedPayload.company_id;
  }
}
```

### 2. Jarvis API: `handleRentProgEvent`

**Файл:** `src/orchestrator/rentprog-handler.ts`

**Текущий код:**
```typescript
const branch = (payload.branch || 'tbilisi') as BranchName;
```

**Исправленный код:**
```typescript
// Определяем branch по company_id из payload
let branch: BranchName = 'tbilisi'; // по умолчанию

// Извлекаем company_id с обработкой массива
let companyId: number | null = null;
if (payload.company_id !== undefined && payload.company_id !== null) {
  if (Array.isArray(payload.company_id)) {
    // Если массив - берем последний элемент (новое значение)
    companyId = payload.company_id.length > 0 
      ? payload.company_id[payload.company_id.length - 1] 
      : null;
  } else {
    // Если число - используем как есть
    companyId = payload.company_id;
  }
}

// Определяем branch по company_id
if (companyId) {
  const branchFromCompanyId = getBranchByCompanyId(companyId);
  if (branchFromCompanyId) {
    branch = branchFromCompanyId as BranchName;
  }
}

// Fallback: если branch указан в payload, используем его
if (payload.branch) {
  branch = payload.branch as BranchName;
}
```

### 3. Обновление машины 39736

После исправления нужно:
1. Обновить событие в БД (исправить company_id с 11158 на 9247)
2. Переобработать событие или вручную обновить branch_id машины

## Почему запись из history не попала в events

**Ответ:** Запись "CEO Eliseev Aleksei изменил company_id с 11163 на 9247" попала в таблицу `history`, а не в `events`, потому что:

1. **History Parser** (`xSjwtwrrWUGcBduU`) парсит операции из `/history_items` API
2. Сохраняет их в таблицу `history` (не `events`)
3. `events` таблица заполняется только из вебхуков RentProg

**Решение:** Нужно либо:
- Создать workflow который будет сопоставлять записи из `history` с `events`
- Или добавить логику в History Parser для создания событий в `events` при обнаружении изменений company_id


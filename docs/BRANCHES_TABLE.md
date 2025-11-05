# Таблица branches

**Дата создания:** 2025-11-03  
**Статус:** ✅ Активна

---

## Назначение

Справочная таблица филиалов компании с маппингом на `company_id` из RentProg.

---

## Структура таблицы

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                      -- Код филиала (tbilisi, batumi, kutaisi, service-center)
  name TEXT NOT NULL,                      -- Название на русском
  company_id INTEGER UNIQUE NOT NULL,      -- ID компании в RentProg
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы и ограничения
CREATE UNIQUE INDEX idx_branches_company_id ON branches(company_id);
ALTER TABLE branches ADD CONSTRAINT branches_company_id_unique UNIQUE (company_id);
```

---

## Данные филиалов

| UUID | Code | Name | Company ID (RentProg) |
|------|------|------|----------------------|
| `277eaada-1428-4c04-9cd7-5e614e43bedc` | `tbilisi` | Тбилиси | `9247` |
| `5e551b32-934c-498f-a4a1-a90079985c0a` | `kutaisi` | Кутаиси | `9248` |
| `627c4c88-d8a1-47bf-b9a6-2e9ad33112a4` | `batumi` | Батуми | `9506` |
| `6026cff7-eee8-4fb9-be26-604f308911f0` | `service-center` | Сервисный центр | `11163` |

---

## Использование

### 1. Получение филиала по company_id

```sql
SELECT id, code, name 
FROM branches 
WHERE company_id = 9247;
-- Результат: tbilisi, Тбилиси
```

### 2. Получение филиала по коду

```sql
SELECT id, company_id, name 
FROM branches 
WHERE code = 'tbilisi';
-- Результат: UUID, 9247, Тбилиси
```

### 3. Получение всех филиалов

```sql
SELECT * FROM branches ORDER BY company_id;
```

---

## Связь с другими таблицами

### External References

Таблица `external_refs` может ссылаться на филиалы:

```sql
-- Получить все машины в филиале Тбилиси
SELECT er.* 
FROM external_refs er
JOIN branches b ON b.company_id = /* company_id из RentProg данных */
WHERE b.code = 'tbilisi' 
  AND er.entity_type = 'car';
```

### Events

Таблица `events` содержит `company_id` из вебхуков:

```sql
-- Получить события по филиалу
SELECT e.*, b.code AS branch, b.name AS branch_name
FROM events e
LEFT JOIN branches b ON b.company_id = e.company_id
WHERE e.company_id = 9247;
```

---

## Миграции

### Добавление company_id (2025-11-03)

**Скрипт:** `setup/add_company_id_to_branches.mjs`

**Выполненные шаги:**
1. Добавлена колонка `company_id INTEGER`
2. Заполнены данные для всех 4 филиалов
3. Добавлено ограничение `UNIQUE (company_id)`
4. Создан индекс `idx_branches_company_id`

**Маппинг:**
- `tbilisi` → `9247`
- `kutaisi` → `9248`
- `batumi` → `9506`
- `service-center` → `11163`

---

## TypeScript типы

```typescript
// src/types/branch.ts
export interface Branch {
  id: string;              // UUID
  code: string;            // 'tbilisi' | 'batumi' | 'kutaisi' | 'service-center'
  name: string;            // 'Тбилиси' | 'Батуми' | 'Кутаиси' | 'Сервисный центр'
  company_id: number;      // 9247 | 9248 | 9506 | 11163
  created_at: Date;
  updated_at: Date;
}

// Маппинг company_id → code
export const COMPANY_ID_TO_BRANCH: Record<number, string> = {
  9247: 'tbilisi',
  9248: 'kutaisi',
  9506: 'batumi',
  11163: 'service-center',
};

// Получение филиала по company_id
export function getBranchByCompanyId(companyId: number): string | null {
  return COMPANY_ID_TO_BRANCH[companyId] || null;
}
```

---

## SQL для проверки данных

```sql
-- Проверка структуры
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'branches'
ORDER BY ordinal_position;

-- Проверка данных
SELECT 
  id,
  code,
  name,
  company_id,
  created_at,
  updated_at
FROM branches
ORDER BY company_id;

-- Проверка индексов
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'branches';

-- Проверка constraints
SELECT 
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'branches'::regclass;
```

---

## Примечания

1. **`company_id` - это ID компании в RentProg**, не путать с `company_token` (используется для аутентификации)
2. **`code` используется в коде** как идентификатор филиала (например, в RentProg API клиенте)
3. **`name` используется в UI** для отображения пользователю
4. **UUID `id`** - наш внутренний идентификатор для связей в БД

---

## См. также

- [src/config/company-branch-mapping.ts](../src/config/company-branch-mapping.ts) - TypeScript маппинг
- [BRANCH_TO_COMPANY_ID_MIGRATION.md](../BRANCH_TO_COMPANY_ID_MIGRATION.md) - История миграции от branch к company_id
- [STRUCTURE.md](../STRUCTURE.md) - Общая структура данных



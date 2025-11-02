# Руководство по миграциям БД

## Подключение к Neon PostgreSQL

### Connection String

```
postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Параметры подключения

```env
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am
NEON_SSL=require
```

---

## Выполнение миграций

### Способ 1: Через Node.js скрипт (рекомендуется)

```bash
node setup/execute_migration_and_import.mjs
```

Или только миграция:

```bash
node setup/run_migration_using_project.ts
```

**Требования:**
- Node.js установлен
- Библиотека `postgres` в проекте

### Способ 2: Через Neon Console (ручной)

1. Откройте: https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql
2. Войдите в аккаунт Neon
3. Скопируйте SQL из файла миграции (например, `setup/update_events_table.sql`)
4. Вставьте в SQL Editor
5. Выполните

### Способ 3: Через psql (если установлен)

```bash
psql "postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" -f setup/your_migration.sql
```

---

## Создание новой миграции

### 1. Создайте SQL файл

```bash
# Имя файла: setup/migrations/YYYY-MM-DD_description.sql
# Например: setup/migrations/2025-01-15_add_processed_field.sql
```

### 2. Напишите миграцию

```sql
-- Описание: Добавление поля processed в таблицу events
-- Дата: 2025-01-15

-- Проверка и добавление поля
ALTER TABLE events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Создание индекса
CREATE INDEX IF NOT EXISTS idx_events_processed 
ON events(processed) 
WHERE processed = FALSE;

-- Комментарий
COMMENT ON COLUMN events.processed IS 'Флаг обработки события';
```

### 3. Создайте TypeScript скрипт для выполнения

```typescript
// setup/run_migration_YYYY_MM_DD.ts
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const CONNECTION_STRING = process.env.NEON_DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('✅ Подключено к Neon PostgreSQL');

    const sqlFile = path.join(__dirname, 'migrations', 'YYYY-MM-DD_description.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Выполняю миграцию...');
    
    await sql.unsafe(sqlContent);
    
    console.log('✅ Миграция выполнена успешно!');

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration().catch(console.error);
```

### 4. Выполните миграцию

```bash
node setup/run_migration_YYYY_MM_DD.ts
```

---

## Проверка миграций

### Проверка применения миграции

```sql
-- Проверка существования таблицы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'your_table';

-- Проверка колонок
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'your_table';

-- Проверка индексов
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'your_table';

-- Проверка constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'your_table';
```

---

## Откат миграций

### Создайте файл отката

```sql
-- setup/migrations/rollback/YYYY-MM-DD_description_rollback.sql

-- Откат добавления поля
ALTER TABLE events DROP COLUMN IF EXISTS processed;

-- Удаление индекса
DROP INDEX IF EXISTS idx_events_processed;
```

### Выполните откат

```bash
psql "$NEON_DATABASE_URL" -f setup/migrations/rollback/YYYY-MM-DD_description_rollback.sql
```

---

## Best Practices

### 1. Безопасность миграций

✅ **Делайте:**
- Используйте `IF EXISTS` / `IF NOT EXISTS`
- Добавляйте транзакции для критичных операций
- Тестируйте на копии БД
- Создавайте бэкапы перед миграцией

❌ **Не делайте:**
- `DROP TABLE` без проверок
- Изменение типов колонок с данными
- Удаление constraints без проверки зависимостей

### 2. Структура миграций

```sql
-- 1. Описание
-- 2. Дата
-- 3. Автор (опционально)

BEGIN;

-- 4. Проверки перед выполнением
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'your_table') THEN
    RAISE EXCEPTION 'Table your_table does not exist';
  END IF;
END $$;

-- 5. Основные изменения
ALTER TABLE your_table ADD COLUMN new_field TEXT;

-- 6. Индексы
CREATE INDEX IF NOT EXISTS idx_new_field ON your_table(new_field);

-- 7. Комментарии
COMMENT ON COLUMN your_table.new_field IS 'Description';

COMMIT;
```

### 3. Версионирование

Используйте таблицу для отслеживания миграций:

```sql
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- При выполнении миграции
INSERT INTO migrations (name) VALUES ('2025-01-15_add_processed_field');
```

---

## CI/CD Integration

### GitHub Actions пример

```yaml
name: Run Migrations

on:
  push:
    paths:
      - 'setup/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run migrations
        env:
          NEON_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          node setup/run_latest_migration.ts
```

---

## Troubleshooting

### Ошибка подключения

```bash
Error: connection timeout
```

**Решение:**
1. Проверьте доступность хоста
2. Проверьте SSL настройки
3. Убедитесь, что IP не заблокирован

### Ошибка прав доступа

```bash
Error: permission denied
```

**Решение:**
1. Убедитесь, что используете правильного пользователя (`neondb_owner`)
2. Проверьте пароль
3. Убедитесь, что пользователь имеет права на таблицу

### Конфликт имен

```bash
Error: relation "table_name" already exists
```

**Решение:**
Используйте `IF NOT EXISTS` в CREATE операциях:

```sql
CREATE TABLE IF NOT EXISTS your_table (...);
ALTER TABLE your_table ADD COLUMN IF NOT EXISTS new_field TEXT;
```

---

## Дополнительные ресурсы

- [Neon Console](https://console.neon.tech/app/projects/rough-heart-ahnybmq0)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) (если используем Drizzle)


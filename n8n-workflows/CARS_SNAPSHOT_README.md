# RentProg Cars Snapshot Workflow

## Быстрый старт

Workflow для единоразового импорта всех автомобилей из RentProg API в таблицу `cars`.

### 1. Выполните миграцию БД

```bash
node setup/migrations/run_001_migration.mjs
```

### 2. Настройте переменную окружения в n8n

В n8n Settings → Environments добавьте:

**`RENTPROG_BRANCH_KEYS`:**
```json
{
  "tbilisi": "your_token_1",
  "batumi": "your_token_2",
  "kutaisi": "your_token_3",
  "service-center": "your_token_4"
}
```

### 3. Импортируйте workflow

```powershell
powershell -ExecutionPolicy Bypass -File setup/import_cars_snapshot_workflow.ps1
```

### 4. Запустите workflow

1. Откройте n8n UI: https://n8n.rentflow.rentals
2. Найдите workflow "RentProg Cars Snapshot"
3. Нажмите "Execute Workflow"

### 5. Проверьте результат

```sql
-- Количество импортированных автомобилей
SELECT COUNT(*) FROM cars;

-- По филиалам
SELECT b.code, COUNT(c.id) as cars_count
FROM cars c
LEFT JOIN branches b ON c.branch_id = b.id
GROUP BY b.code;
```

---

## Характеристики

- **Тип:** Manual trigger (inactive)
- **Филиалы:** 4 (tbilisi, batumi, kutaisi, service-center)
- **Пагинация:** 20 автомобилей/страницу
- **Rate limiting:** 1 секунда между запросами
- **Время выполнения:** ~5-15 минут

---

## Документация

Полная документация: [docs/RENTPROG_CARS_SNAPSHOT_GUIDE.md](../docs/RENTPROG_CARS_SNAPSHOT_GUIDE.md)

---

## Структура данных

### Таблица `cars`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| branch_id | UUID | FK к branches |
| plate | TEXT | Госномер |
| vin | TEXT | VIN код |
| model | TEXT | Модель автомобиля |
| starline_id | TEXT | ID в Starline |
| **data** | **JSONB** | **Полный JSON из RentProg** |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

### Таблица `external_refs`

Связь между нашими UUID и внешними системами:

| Поле | Значение для автомобилей |
|------|-------------------------|
| entity_type | 'car' |
| entity_id | UUID из таблицы cars |
| system | 'rentprog' |
| external_id | ID автомобиля в RentProg |
| branch_code | 'tbilisi', 'batumi', и т.д. |

---

## Troubleshooting

### "Не удалось распарсить RENTPROG_BRANCH_KEYS"

✅ Проверьте формат JSON переменной в n8n Settings

### "401 Unauthorized"

✅ Проверьте токены в `RENTPROG_BRANCH_KEYS`

### "Не найден филиал в таблице branches"

✅ Выполните:
```sql
INSERT INTO branches (id, code, name, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'tbilisi', 'Тбилиси', NOW(), NOW()),
  (gen_random_uuid(), 'batumi', 'Батуми', NOW(), NOW()),
  (gen_random_uuid(), 'kutaisi', 'Кутаиси', NOW(), NOW()),
  (gen_random_uuid(), 'service-center', 'Сервисный центр', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
```

---

## Важно

- ✅ Workflow создается как **inactive** (manual trigger)
- ✅ Поддерживает **повторный запуск** (upsert, не создает дубликаты)
- ✅ Соблюдает **rate limiting** (60 запросов/минуту)
- ✅ Хранит **полный JSON** из RentProg в поле `data`
- ✅ Использует паттерн **external_refs** для связи с внешними системами

---

**Версия:** 1.0  
**Дата:** 2025-11-03  
**Автор:** Cursor Agent


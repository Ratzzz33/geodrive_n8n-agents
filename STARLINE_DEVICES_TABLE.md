# Таблица `starline_devices` - Устройства Starline

**Дата создания:** 2025-11-08  
**Миграция:** `0013_starline_devices.sql`

---

## 🎯 Назначение

Таблица `starline_devices` хранит **все устройства из Starline** с возможностью сопоставления с нашей таблицей `cars`.

### Преимущества перед прямым сопоставлением:

✅ Хранит **все** устройства, даже не сопоставленные  
✅ Отслеживает изменение названий (история `previous_aliases`)  
✅ Автоматически извлекает модель и 3 цифры номера  
✅ Сохраняет уверенность сопоставления (0.00 - 1.00)  
✅ Позволяет ручное сопоставление  
✅ История попыток сопоставления для аналитики  

---

## 📋 Структура таблицы

### Основные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Уникальный ID записи |
| `device_id` | BIGINT | IMEI устройства (уникальный) |
| `alias` | TEXT | Название в Starline ("BMW 3 587") |
| `car_id` | UUID | Связь с `cars` (nullable) |

### Метаданные устройства

| Поле | Тип | Описание |
|------|-----|----------|
| `imei` | TEXT | IMEI устройства |
| `phone` | TEXT | Телефон SIM-карты |
| `sn` | TEXT | Серийный номер |
| `device_type` | INT | Тип устройства |
| `fw_version` | TEXT | Версия прошивки |

### Данные сопоставления

| Поле | Тип | Описание |
|------|-----|----------|
| `matched` | BOOLEAN | Сопоставлено ли с `cars` |
| `match_confidence` | NUMERIC(3,2) | Уверенность (0.00-1.00) |
| `match_method` | TEXT | Метод: `auto` / `manual` |
| `match_notes` | TEXT | Заметки о сопоставлении |

### Извлеченные данные

| Поле | Тип | Описание |
|------|-----|----------|
| `extracted_model` | TEXT | Модель из alias ("BMW 3") |
| `extracted_digits` | TEXT | 3 цифры ("587") |

### История изменений

| Поле | Тип | Описание |
|------|-----|----------|
| `previous_aliases` | TEXT[] | Массив прежних названий |
| `alias_changed_at` | TIMESTAMPTZ | Время изменения |

---

## 🔄 Автоматические функции

### 1. Извлечение данных из alias

**Триггер:** `starline_devices_extract_alias_trigger`

При INSERT/UPDATE автоматически:
- Извлекает 3 цифры номера → `extracted_digits`
- Извлекает модель → `extracted_model`

**Пример:**
```
alias: "BMW 3 587" 
  → extracted_model: "BMW 3"
  → extracted_digits: "587"
```

### 2. История изменений названия

**Триггер:** `starline_devices_extract_alias_trigger`

При изменении `alias`:
- Сохраняет старое название в `previous_aliases[]`
- Обновляет `alias_changed_at`
- **Сбрасывает сопоставление** если изменились 3 цифры

**Пример:**
```sql
-- Было: "BMW 3 587"
-- Стало: "BMW 3 Series 587"
-- Результат: previous_aliases = {"BMW 3 587"}

-- Было: "BMW 3 587"
-- Стало: "BMW 3 599"  -- изменились цифры!
-- Результат: matched = FALSE, car_id = NULL (требует пересопоставление)
```

---

## 🔍 Алгоритм сопоставления

### Уровни уверенности

| Confidence | Условие | Метод |
|------------|---------|-------|
| **0.95** | Цифры + модель совпала | `auto_model_digits` |
| **0.80** | Цифры + модель похожа | `auto_fuzzy_match` |
| **0.60** | Только цифры | `auto_digits_only` |

### Процесс сопоставления

1. **Извлечение данных:**
   - Starline: `extracted_digits` + `extracted_model`
   - Cars: 3 цифры из `license_plate` + `brand + model`

2. **Сравнение:**
   - Сначала проверяются цифры (обязательное совпадение)
   - Затем модель (повышает уверенность)

3. **Сохранение:**
   - Обновление `starline_devices`: `car_id`, `matched`, `match_confidence`
   - Запись в `starline_match_history`

---

## 📊 View для просмотра

### `starline_devices_with_cars`

Объединяет `starline_devices` + `cars`:

```sql
SELECT * FROM starline_devices_with_cars 
WHERE matched = TRUE
ORDER BY last_seen DESC;
```

**Результат:**
```
starline_alias    | car_brand | car_model | car_license_plate | match_confidence
------------------|-----------|-----------|-------------------|------------------
BMW 3 587         | BMW       | 3         | WW587UU          | 0.95
Audi Q7 White 950 | Audi      | Q7        | XX950DX          | 0.95
```

---

## 🚀 API Endpoints

### POST `/starline/sync-devices`
Синхронизирует все устройства из Starline в таблицу:

```bash
curl -X POST http://46.224.17.15:3000/starline/sync-devices
```

**Response:**
```json
{
  "ok": true,
  "total": 30,
  "new": 2,
  "updated": 28,
  "errors": []
}
```

### POST `/starline/match-devices`
Автоматически сопоставляет устройства с `cars`:

```bash
curl -X POST http://46.224.17.15:3000/starline/match-devices
```

**Response:**
```json
{
  "ok": true,
  "matches": [
    {
      "deviceId": "uuid",
      "carId": "uuid",
      "confidence": 0.95,
      "method": "auto_model_digits"
    }
  ],
  "count": 25
}
```

### GET `/starline/sync-status`
Получить статус синхронизации:

```bash
curl http://46.224.17.15:3000/starline/sync-status
```

**Response:**
```json
{
  "ok": true,
  "total": 30,
  "matched": 25,
  "unmatched": 3,
  "inactive": 2
}
```

---

## 💡 Примеры использования

### Просмотр всех устройств

```sql
SELECT 
  alias,
  extracted_model,
  extracted_digits,
  matched,
  match_confidence,
  active
FROM starline_devices
ORDER BY matched DESC, last_seen DESC;
```

### Несопоставленные устройства

```sql
SELECT 
  alias,
  extracted_digits,
  active
FROM starline_devices
WHERE matched = FALSE
  AND active = TRUE;
```

### История изменений названия

```sql
SELECT 
  alias,
  previous_aliases,
  alias_changed_at
FROM starline_devices
WHERE previous_aliases IS NOT NULL
ORDER BY alias_changed_at DESC;
```

### История попыток сопоставления

```sql
SELECT 
  starline_alias,
  car_license_plate,
  matched,
  confidence,
  method,
  created_at
FROM starline_match_history
ORDER BY created_at DESC
LIMIT 20;
```

### Устройства с низкой уверенностью

```sql
SELECT 
  sd.alias,
  c.license_plate,
  sd.match_confidence,
  sd.match_method
FROM starline_devices sd
JOIN cars c ON c.id = sd.car_id
WHERE sd.matched = TRUE
  AND sd.match_confidence < 0.80
ORDER BY sd.match_confidence ASC;
```

---

## 🔧 Ручное сопоставление

Если автоматическое сопоставление не сработало:

```sql
-- Сопоставить устройство с машиной вручную
UPDATE starline_devices
SET 
  car_id = 'uuid-машины',
  matched = TRUE,
  match_confidence = 1.00,
  match_method = 'manual',
  match_notes = 'Вручную сопоставлено: причина'
WHERE device_id = 869573070871005;

-- Записать в историю
INSERT INTO starline_match_history (
  starline_device_id,
  car_id,
  matched,
  confidence,
  method,
  starline_alias,
  car_license_plate,
  reason,
  created_by
) VALUES (
  (SELECT id FROM starline_devices WHERE device_id = 869573070871005),
  'uuid-машины',
  TRUE,
  1.00,
  'manual',
  'BMW 3 587',
  'WW587UU',
  'Ручное сопоставление',
  'user:admin'
);
```

---

## 🔄 Обновление при переименовании

### Что происходит автоматически:

**Сценарий 1: Изменение названия (цифры не менялись)**
```sql
-- Было: "BMW 3 587"
-- Стало: "BMW 3 Series 587"

-- Результат:
-- ✅ previous_aliases = {"BMW 3 587"}
-- ✅ alias_changed_at = NOW()
-- ✅ extracted_model = "BMW 3 Series"
-- ✅ extracted_digits = "587"
-- ✅ matched остается TRUE
-- ✅ car_id не меняется
```

**Сценарий 2: Изменились 3 цифры**
```sql
-- Было: "BMW 3 587"
-- Стало: "BMW 3 599"

-- Результат:
-- ✅ previous_aliases = {"BMW 3 587"}
-- ✅ alias_changed_at = NOW()
-- ✅ extracted_digits = "599"
-- ⚠️ matched = FALSE (сброшено!)
-- ⚠️ car_id = NULL (сброшено!)
-- ⚠️ match_notes = "Автоматически сброшено: изменились цифры в alias"
```

**Почему сбрасывается?**  
Если изменились 3 цифры номера, это вероятно другая машина. Требуется пересопоставление.

---

## 📈 Интеграция с `gps_tracking`

Таблица `gps_tracking` теперь ссылается на `starline_devices`:

```sql
ALTER TABLE gps_tracking 
ADD COLUMN starline_device_uuid UUID REFERENCES starline_devices(id);
```

**Join для получения полной информации:**
```sql
SELECT 
  c.license_plate,
  sd.alias as starline_name,
  g.current_lat,
  g.current_lng,
  g.status,
  g.is_moving
FROM gps_tracking g
JOIN starline_devices sd ON sd.id = g.starline_device_uuid
JOIN cars c ON c.id = sd.car_id
WHERE g.status = 'moving';
```

---

## ⚙️ Первый запуск

### Шаг 1: Применить миграцию

```bash
psql $DATABASE_URL -f drizzle/migrations/0013_starline_devices.sql
```

### Шаг 2: Синхронизировать устройства

```bash
curl -X POST http://46.224.17.15:3000/starline/sync-devices
```

### Шаг 3: Автосопоставление

```bash
curl -X POST http://46.224.17.15:3000/starline/match-devices
```

### Шаг 4: Проверка результатов

```sql
SELECT * FROM starline_devices_with_cars;
```

---

## 🎯 Итого

✅ Таблица хранит все устройства Starline  
✅ Автоматически извлекает модель и 3 цифры  
✅ Отслеживает изменения названий  
✅ Автоматически сопоставляет с cars  
✅ Сбрасывает сопоставление при смене цифр  
✅ История попыток для аналитики  
✅ View для удобного просмотра  
✅ API endpoints для управления  

---

**Документация:** [STARLINE_DEVICES_TABLE.md](./STARLINE_DEVICES_TABLE.md)  
**API:** http://46.224.17.15:3000/starline/


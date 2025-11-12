# 📡 Starline API Reference для ботов

**Дата:** 2025-11-12  
**Версия БД:** После миграции 0017  
**Цель:** Единый источник данных о GPS и машинах для всех ботов

---

## 🎯 Основные принципы

### 1. **Device ID — центральный идентификатор**
- `device_id` (IMEI) — уникальный идентификатор устройства Starline
- **НЕ МЕНЯЕТСЯ** в отличие от `alias` (название может меняться)
- Используй `device_id` для всех связей и сопоставлений

### 2. **Таблица `starline_devices` — единый источник**
- Содержит все данные о машинах и Starline устройствах
- Включает `avatar_url` для быстрого доступа к аватаркам
- **НЕ ТРЕБУЕТ JOIN** с таблицей `cars` для основных данных

---

## 📊 Структура таблицы `starline_devices`

### Основные поля:

| Поле | Тип | Описание |
|------|-----|----------|
| `device_id` | BIGINT | **IMEI устройства Starline (уникальный, неизменяемый)** |
| `alias` | TEXT | Название устройства в Starline (может меняться) |
| `car_id` | UUID | Ссылка на таблицу `cars` |
| `plate` | TEXT | **Номер машины (для удобного поиска)** |
| `avatar_url` | TEXT | **Прямая ссылка на аватарку машины** |
| `matched` | BOOLEAN | Сопоставлено ли устройство с машиной |
| `match_confidence` | NUMERIC | Уверенность сопоставления (0.0-1.0) |
| `match_method` | TEXT | Метод сопоставления |
| `extracted_model` | TEXT | Модель машины (из `cars.model`) |
| `active` | BOOLEAN | Активно ли устройство |
| `last_seen` | TIMESTAMPTZ | Последнее обновление от Starline |

---

## 🚀 Типовые запросы

### 1. Получить данные машины по номеру

```sql
SELECT 
  device_id,
  alias,
  plate,
  avatar_url,
  extracted_model,
  car_id,
  matched
FROM starline_devices
WHERE plate = 'OB700OB'
  AND matched = TRUE
  AND active = TRUE;
```

**Результат:**
```json
{
  "device_id": 864326066742275,
  "alias": "MB GLE OB700OB",
  "plate": "OB700OB",
  "avatar_url": "https://rentprog.storage.yandexcloud.net/car_avatars/9592bf49192052bd269edda1e791d141.jpg",
  "extracted_model": "Mercedes Benz GLE 350",
  "car_id": "b4505fd6-ef4d-4462-bbed-86f9a1fcf647",
  "matched": true
}
```

---

### 2. Получить текущее GPS положение машины

```sql
SELECT 
  sd.device_id,
  sd.alias,
  sd.plate,
  sd.avatar_url,
  gt.current_lat,
  gt.current_lng,
  gt.status,
  gt.speed,
  gt.is_moving,
  gt.last_activity,
  gt.google_maps_link
FROM starline_devices sd
JOIN gps_tracking gt ON gt.starline_device_id = sd.device_id
WHERE sd.plate = 'OB700OB'
  AND sd.matched = TRUE;
```

**Результат:**
```json
{
  "device_id": 864326066742275,
  "alias": "MB GLE OB700OB",
  "plate": "OB700OB",
  "avatar_url": "https://rentprog.storage.yandexcloud.net/car_avatars/...",
  "current_lat": 41.65376,
  "current_lng": 41.638368,
  "status": "offline",
  "speed": 0.0,
  "is_moving": false,
  "last_activity": "2025-11-12T09:49:02.000Z",
  "google_maps_link": "https://www.google.com/maps?q=41.65376,41.638368"
}
```

---

### 3. Получить список всех активных машин с GPS

```sql
SELECT 
  sd.device_id,
  sd.alias,
  sd.plate,
  sd.avatar_url,
  sd.extracted_model,
  gt.current_lat,
  gt.current_lng,
  gt.status,
  gt.speed,
  gt.last_sync
FROM starline_devices sd
JOIN gps_tracking gt ON gt.starline_device_id = sd.device_id
WHERE sd.matched = TRUE
  AND sd.active = TRUE
ORDER BY sd.plate;
```

---

### 4. Получить только аватарку по номеру машины

```sql
SELECT avatar_url
FROM starline_devices
WHERE plate = 'OB700OB'
  AND matched = TRUE
LIMIT 1;
```

**Результат:**
```
https://rentprog.storage.yandexcloud.net/car_avatars/9592bf49192052bd269edda1e791d141.jpg
```

---

### 5. Поиск машины по части номера или модели

```sql
SELECT 
  device_id,
  alias,
  plate,
  avatar_url,
  extracted_model
FROM starline_devices
WHERE matched = TRUE
  AND active = TRUE
  AND (
    plate ILIKE '%700%'
    OR extracted_model ILIKE '%Mercedes%'
    OR alias ILIKE '%GLE%'
  )
ORDER BY plate;
```

---

### 6. Получить последние 10 GPS событий машины

```sql
SELECT 
  et.event_type,
  et.data,
  et.created_at
FROM entity_timeline et
JOIN starline_devices sd ON sd.car_id = et.entity_id
WHERE sd.plate = 'OB700OB'
  AND et.entity_type = 'car'
  AND et.event_type LIKE 'gps.%'
ORDER BY et.created_at DESC
LIMIT 10;
```

**Структура `data`:**
```json
{
  "lat": 41.65376,
  "lng": 41.638368,
  "status": "parking",
  "speed": 0,
  "device_id": 864326066742275
}
```

---

## 🔍 Поиск по device_id vs plate

### ✅ Рекомендуется: Поиск по `plate`
```sql
-- Быстро и понятно
WHERE plate = 'OB700OB'
```

### ⚙️ Для системных операций: Поиск по `device_id`
```sql
-- Когда известен точный IMEI
WHERE device_id = 864326066742275
```

---

## 📋 Таблица `gps_tracking` — Текущее GPS положение

### Основные поля:

| Поле | Тип | Описание |
|------|-----|----------|
| `car_id` | UUID | ID машины |
| `starline_device_id` | BIGINT | **IMEI устройства (уникальный ключ)** |
| `starline_alias` | TEXT | Название устройства |
| `current_lat` | NUMERIC | Широта |
| `current_lng` | NUMERIC | Долгота |
| `current_timestamp` | TIMESTAMPTZ | Время GPS данных |
| `status` | TEXT | parking/driving/offline |
| `is_moving` | BOOLEAN | В движении? |
| `speed` | NUMERIC | Скорость (км/ч) |
| `distance_moved` | NUMERIC | Пройдено с последнего обновления (м) |
| `google_maps_link` | TEXT | **Готовая ссылка на Google Maps** |
| `gps_level` | INTEGER | Уровень GPS сигнала (%) |
| `gsm_level` | INTEGER | Уровень GSM сигнала (%) |
| `ignition_on` | BOOLEAN | Зажигание включено? |
| `engine_running` | BOOLEAN | Двигатель работает? |
| `parking_brake` | BOOLEAN | Ручник включен? |
| `battery_voltage` | NUMERIC | Напряжение АКБ (V) |
| `last_activity` | TIMESTAMPTZ | Последняя активность |
| `last_sync` | TIMESTAMPTZ | **Последняя синхронизация с нашей системой** |

---

## 🗺️ Формирование ссылки на Google Maps

### Автоматически (из `gps_tracking`)
```sql
SELECT google_maps_link
FROM gps_tracking
WHERE starline_device_id = 864326066742275;
```

### Вручную (если нужно)
```
https://www.google.com/maps?q={lat},{lng}
```

**Пример:**
```
https://www.google.com/maps?q=41.65376,41.638368
```

---

## ⚠️ Важные правила

### 1. **ВСЕГДА используй `device_id` для связей**
```sql
-- ✅ ПРАВИЛЬНО
JOIN gps_tracking gt ON gt.starline_device_id = sd.device_id

-- ❌ НЕПРАВИЛЬНО (alias может меняться!)
JOIN gps_tracking gt ON gt.starline_alias = sd.alias
```

### 2. **Проверяй `matched = TRUE` и `active = TRUE`**
```sql
WHERE matched = TRUE  -- Устройство привязано к машине
  AND active = TRUE   -- Устройство активно
```

### 3. **Используй `plate` для поиска по номеру**
```sql
-- ✅ Быстрый поиск по индексу
WHERE plate = 'OB700OB'

-- ❌ Медленный поиск по всем машинам
WHERE car_id IN (SELECT id FROM cars WHERE plate = 'OB700OB')
```

### 4. **Учитывай NULL значения**
```sql
-- avatar_url может быть NULL
WHERE avatar_url IS NOT NULL

-- last_sync может быть старым
WHERE last_sync > NOW() - INTERVAL '10 minutes'
```

---

## 📊 Статистика (актуально на 2025-11-12)

- **Всего устройств Starline:** 120
- **Сопоставлено с машинами:** 117
- **С аватарками:** 116
- **Активных устройств:** 117

---

## 🔄 Обновление данных

### Периодичность обновления:
- **GPS данные:** Каждые 2 минуты (n8n workflow)
- **Starline устройства:** При изменениях от Starline API
- **Аватарки:** При обновлении машины в RentProg

### Источники обновлений:
1. **n8n workflow** `✅Starline GPS Monitor (Every 2 Minutes)` → API `/starline/update-gps` → `gps_tracking`
2. **Синхронизация** `sync_starline_devices_from_gps_tracking.mjs` → `starline_devices`
3. **RentProg sync** → `cars` → `starline_devices.avatar_url`

---

## 🧪 Примеры использования в коде

### Node.js (postgres)
```javascript
import postgres from 'postgres';

const sql = postgres(CONNECTION_STRING);

// Получить данные машины
const car = await sql`
  SELECT 
    device_id,
    alias,
    plate,
    avatar_url,
    extracted_model
  FROM starline_devices
  WHERE plate = ${plateNumber}
    AND matched = TRUE
  LIMIT 1
`;

if (car.length > 0) {
  console.log('Car found:', car[0].plate);
  console.log('Avatar:', car[0].avatar_url);
}
```

### Python (psycopg2)
```python
import psycopg2

conn = psycopg2.connect(CONNECTION_STRING)
cur = conn.cursor()

# Получить GPS положение
cur.execute("""
  SELECT 
    sd.plate,
    sd.avatar_url,
    gt.current_lat,
    gt.current_lng,
    gt.google_maps_link
  FROM starline_devices sd
  JOIN gps_tracking gt ON gt.starline_device_id = sd.device_id
  WHERE sd.plate = %s
    AND sd.matched = TRUE
""", (plate_number,))

result = cur.fetchone()
if result:
    plate, avatar, lat, lng, maps_link = result
    print(f"Car: {plate}")
    print(f"Location: {lat}, {lng}")
    print(f"Maps: {maps_link}")
```

---

## 📝 Changelog

### 2025-11-12 (Миграция 0017)
- ✅ Добавлено поле `avatar_url` в `starline_devices`
- ✅ Заполнены все существующие записи
- ✅ Создан индекс для быстрого поиска
- ✅ Обновлён скрипт синхронизации

### 2025-11-12 (Миграция 0016)
- ✅ Исправлен UNIQUE CONSTRAINT для `ON CONFLICT (starline_device_id)`
- ✅ Удалён partial index, создан полноценный UNIQUE constraint

### 2025-11-09
- ✅ Добавлено поле `plate` в `starline_devices`
- ✅ Создана таблица `starline_devices`
- ✅ Реализована синхронизация из `gps_tracking`

---

## 🆘 Поддержка

**Вопросы или проблемы?**
- Проверь актуальность данных: `SELECT last_sync FROM gps_tracking WHERE starline_device_id = ?`
- Проверь статус сопоставления: `SELECT matched, active FROM starline_devices WHERE device_id = ?`
- Убедись, что workflow `✅Starline GPS Monitor` активен в n8n

**База данных:**
- Host: `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
- Database: `neondb`
- SSL: Required

---

**Конец справки**  
Версия: 1.0  
Автор: Jarvis System  
Дата: 2025-11-12


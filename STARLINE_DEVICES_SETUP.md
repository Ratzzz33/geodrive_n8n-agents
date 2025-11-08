# Starline Devices - Быстрая настройка

**Дата:** 2025-11-08  
**Статус:** ✅ Готово

---

## ✅ Что добавлено

### Таблица `starline_devices`
- ✅ Хранит **все** устройства из Starline
- ✅ Связь с `cars` через `car_id` (nullable)
- ✅ Автоматическое извлечение модели и 3 цифр номера
- ✅ **История изменений названия** (`previous_aliases[]`)
- ✅ **Автоматический сброс сопоставления** при смене цифр
- ✅ Уверенность сопоставления (0.00 - 1.00)
- ✅ История попыток сопоставления

### Автоматические триггеры

**При изменении `alias`:**
1. Сохраняет старое название в `previous_aliases[]`
2. Обновляет `alias_changed_at`
3. Извлекает новую модель и цифры
4. **ВАЖНО:** Если изменились 3 цифры → сбрасывает `matched = FALSE`, `car_id = NULL`

---

## 🚀 Первый запуск

### 1. Применить миграцию

```bash
# SSH на сервер
ssh root@46.224.17.15
cd /root/geodrive_n8n-agents

# Применить миграцию
psql postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require \
  -f drizzle/migrations/0013_starline_devices.sql
```

### 2. Деплой кода

```bash
# Из локальной машины
cd C:\Users\33pok\geodrive_n8n-agents
python deploy_fixes_now.py
```

### 3. Синхронизировать устройства

```bash
# Первая синхронизация - загружает все устройства из Starline
curl -X POST http://46.224.17.15:3000/starline/sync-devices

# Ответ:
# {
#   "ok": true,
#   "total": 30,
#   "new": 30,     # все устройства новые при первом запуске
#   "updated": 0,
#   "errors": []
# }
```

### 4. Автоматическое сопоставление

```bash
# Сопоставить устройства с cars
curl -X POST http://46.224.17.15:3000/starline/match-devices

# Ответ:
# {
#   "ok": true,
#   "matches": [...],
#   "count": 25    # сколько устройств сопоставлено
# }
```

### 5. Проверка результатов

```sql
-- Подключитесь к Neon DB
-- https://console.neon.tech/app/projects/rough-heart-ahnybmq0/sql

-- Просмотр всех устройств с сопоставлениями
SELECT * FROM starline_devices_with_cars;

-- Статус синхронизации
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE matched = TRUE) as matched,
  COUNT(*) FILTER (WHERE matched = FALSE) as unmatched
FROM starline_devices;
```

---

## 📊 API Endpoints

### POST `/starline/sync-devices`
Синхронизация устройств из Starline:
```bash
curl -X POST http://46.224.17.15:3000/starline/sync-devices
```

### POST `/starline/match-devices`
Автосопоставление с cars:
```bash
curl -X POST http://46.224.17.15:3000/starline/match-devices
```

### GET `/starline/sync-status`
Статус синхронизации:
```bash
curl http://46.224.17.15:3000/starline/sync-status
```

---

## 🔄 Как работает отслеживание изменений

### Пример 1: Изменение названия (цифры не менялись)

**Было в Starline:** `"BMW 3 587"`  
**Стало в Starline:** `"BMW 3 Series 587"`

**Что произошло автоматически:**
```sql
-- В таблице starline_devices:
alias = "BMW 3 Series 587"
previous_aliases = {"BMW 3 587"}  -- сохранено старое название
alias_changed_at = NOW()
extracted_model = "BMW 3 Series"
extracted_digits = "587"
matched = TRUE  -- НЕ изменилось
car_id = "uuid" -- НЕ изменилось
```

✅ **Сопоставление сохранено** - цифры не менялись

---

### Пример 2: Изменились 3 цифры

**Было в Starline:** `"BMW 3 587"`  
**Стало в Starline:** `"BMW 3 599"`

**Что произошло автоматически:**
```sql
-- В таблице starline_devices:
alias = "BMW 3 599"
previous_aliases = {"BMW 3 587"}
alias_changed_at = NOW()
extracted_digits = "599"  -- изменилось!
matched = FALSE  -- СБРОШЕНО автоматически
car_id = NULL    -- СБРОШЕНО автоматически
match_notes = "Автоматически сброшено: изменились цифры в alias"
```

⚠️ **Сопоставление сброшено** - требуется пересопоставление

**Причина:** Если цифры номера изменились, это вероятно другая машина.

**Действие:** Запустите пересопоставление:
```bash
curl -X POST http://46.224.17.15:3000/starline/match-devices
```

---

## 🛠️ Ручное сопоставление

Если автосопоставление не сработало:

```sql
-- 1. Найти device_id устройства
SELECT id, device_id, alias, extracted_digits 
FROM starline_devices 
WHERE matched = FALSE;

-- 2. Найти car_id машины
SELECT id, license_plate, brand, model 
FROM cars 
WHERE license_plate LIKE '%587%';

-- 3. Сопоставить вручную
UPDATE starline_devices
SET 
  car_id = 'uuid-машины',
  matched = TRUE,
  match_confidence = 1.00,
  match_method = 'manual',
  match_notes = 'Ручное сопоставление: причина'
WHERE id = 'uuid-устройства';
```

---

## 📈 Интеграция с GPS

`gps_tracking` теперь связан с `starline_devices`:

```sql
-- Обновить gps_tracking для использования новой таблицы
UPDATE gps_tracking g
SET starline_device_uuid = (
  SELECT sd.id 
  FROM starline_devices sd 
  WHERE sd.device_id = g.starline_device_id
);

-- Проверить связь
SELECT 
  sd.alias,
  c.license_plate,
  g.status,
  g.current_lat,
  g.current_lng
FROM gps_tracking g
JOIN starline_devices sd ON sd.id = g.starline_device_uuid
JOIN cars c ON c.id = sd.car_id
LIMIT 10;
```

---

## 🔍 Полезные запросы

### Несопоставленные устройства
```sql
SELECT alias, extracted_digits, active
FROM starline_devices
WHERE matched = FALSE AND active = TRUE;
```

### История изменений названий
```sql
SELECT 
  alias,
  previous_aliases,
  alias_changed_at
FROM starline_devices
WHERE previous_aliases IS NOT NULL
ORDER BY alias_changed_at DESC;
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
  AND sd.match_confidence < 0.80;
```

---

## ✅ Чек-лист

- [ ] Применена миграция `0013_starline_devices.sql`
- [ ] Код задеплоен на сервер
- [ ] Выполнена первая синхронизация (`/starline/sync-devices`)
- [ ] Выполнено автосопоставление (`/starline/match-devices`)
- [ ] Проверены результаты в БД (`starline_devices_with_cars`)
- [ ] Обновлены связи в `gps_tracking`

---

**Документация:**
- **Полная:** [STARLINE_DEVICES_TABLE.md](./STARLINE_DEVICES_TABLE.md)
- **GPS Monitor:** [STARLINE_GPS_MONITOR.md](./STARLINE_GPS_MONITOR.md)


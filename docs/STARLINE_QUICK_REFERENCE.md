# 📡 Starline Quick Reference — Шпаргалка для ботов

---

## 🎯 Главное правило

**Используй таблицу `starline_devices` — в ней ВСЁ:**
- ✅ Номер машины (`plate`)
- ✅ Аватарка (`avatar_url`)
- ✅ Модель (`extracted_model`)
- ✅ Device ID (`device_id`)
- ✅ Название устройства (`alias`)

**НЕ НУЖЕН JOIN с `cars`** для основных данных!

---

## 🚗 Получить машину по номеру (ОДНИМ ЗАПРОСОМ)

```sql
SELECT 
  device_id,
  alias,
  plate,
  avatar_url,
  extracted_model,
  car_id
FROM starline_devices
WHERE plate = 'OB700OB'
  AND matched = TRUE;
```

**Результат:**
```json
{
  "device_id": 864326066742275,
  "alias": "MB GLE OB700OB",
  "plate": "OB700OB",
  "avatar_url": "https://rentprog.storage.yandexcloud.net/car_avatars/9592bf49192052bd269edda1e791d141.jpg",
  "extracted_model": "Mercedes Benz GLE 350",
  "car_id": "b4505fd6-ef4d-4462-bbed-86f9a1fcf647"
}
```

---

## 📍 Получить GPS положение

```sql
SELECT 
  sd.plate,
  sd.avatar_url,
  gt.current_lat,
  gt.current_lng,
  gt.status,
  gt.speed,
  gt.google_maps_link,
  gt.last_sync
FROM starline_devices sd
JOIN gps_tracking gt ON gt.starline_device_id = sd.device_id
WHERE sd.plate = 'OB700OB';
```

**Результат:**
```json
{
  "plate": "OB700OB",
  "avatar_url": "https://...",
  "current_lat": 41.65376,
  "current_lng": 41.638368,
  "status": "offline",
  "speed": 0,
  "google_maps_link": "https://www.google.com/maps?q=41.65376,41.638368",
  "last_sync": "2025-11-12T20:15:22Z"
}
```

---

## 🔍 Поиск машины (по номеру/модели/названию)

```sql
SELECT 
  device_id,
  plate,
  avatar_url,
  extracted_model,
  alias
FROM starline_devices
WHERE matched = TRUE
  AND (
    plate ILIKE '%OB700%'
    OR extracted_model ILIKE '%Mercedes%'
    OR alias ILIKE '%GLE%'
  );
```

---

## 📊 Список всех машин с GPS

```sql
SELECT 
  sd.plate,
  sd.avatar_url,
  sd.extracted_model,
  gt.status,
  gt.last_sync
FROM starline_devices sd
JOIN gps_tracking gt ON gt.starline_device_id = sd.device_id
WHERE sd.matched = TRUE
  AND sd.active = TRUE
ORDER BY sd.plate;
```

---

## 🖼️ Только аватарка

```sql
SELECT avatar_url
FROM starline_devices
WHERE plate = 'OB700OB'
  AND matched = TRUE
LIMIT 1;
```

---

## 📋 Ключевые поля

### `starline_devices`:
- `device_id` — IMEI устройства (уникальный, **НЕ МЕНЯЕТСЯ**)
- `plate` — Номер машины
- `avatar_url` — **Прямая ссылка на аватарку**
- `alias` — Название в Starline (может меняться)
- `extracted_model` — Модель машины
- `matched` — Привязано к машине? (TRUE/FALSE)
- `active` — Активно? (TRUE/FALSE)

### `gps_tracking`:
- `starline_device_id` — IMEI (связь с `starline_devices`)
- `current_lat`, `current_lng` — Координаты
- `status` — parking/driving/offline
- `speed` — Скорость (км/ч)
- `is_moving` — В движении?
- `google_maps_link` — **Готовая ссылка на карту**
- `last_sync` — **Последнее обновление от нас**
- `last_activity` — Последняя активность устройства

---

## ⚠️ ВАЖНО

1. **ВСЕГДА проверяй `matched = TRUE`** — только привязанные машины
2. **Используй `device_id` для JOIN**, НЕ `alias` (он может меняться!)
3. **`avatar_url` может быть NULL** — проверяй перед использованием
4. **GPS обновляется каждые 2 минуты** — проверяй `last_sync`

---

## 🔗 Полная документация

Подробности в [`STARLINE_API_REFERENCE_FOR_BOTS.md`](./STARLINE_API_REFERENCE_FOR_BOTS.md)

---

**Версия:** 1.0  
**Дата:** 2025-11-12


# История GPS координат

**Дата создания:** 2025-11-18  
**Статус:** ✅ Реализовано

---

## 🎯 Назначение

Сохранение полной истории GPS координат для всех автомобилей при каждом обновлении GPS данных. Это позволяет:

- Отслеживать маршруты движения автомобилей
- Анализировать историю перемещений
- Восстанавливать треки для расследований
- Строить карты движения

---

## 📊 Структура данных

### Таблица `gps_tracking_history`

Хранит полную историю всех GPS обновлений:

```sql
CREATE TABLE gps_tracking_history (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  starline_device_id BIGINT,
  
  -- Координаты
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  satellites INT,
  
  -- Статус и движение
  status TEXT, -- 'offline', 'gps_offline', 'moving', 'parked_on', 'parked_off'
  is_moving BOOLEAN DEFAULT FALSE,
  speed NUMERIC(6, 2), -- км/ч
  distance_moved NUMERIC(10, 2), -- метры
  
  -- GPS и связь
  gps_level INT,
  gsm_level INT,
  
  -- Состояние автомобиля
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  parking_brake BOOLEAN DEFAULT FALSE,
  battery_voltage NUMERIC(5, 2),
  
  -- Метаданные
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Время GPS данных
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Время создания записи в БД
);
```

**Поля:**
- `car_id` - ID автомобиля
- `starline_device_id` - ID устройства Starline
- `latitude`, `longitude` - Координаты
- `satellites` - Количество спутников
- `status` - Статус GPS (offline, moving, parked_on, etc.)
- `is_moving` - Машина в движении
- `speed` - Скорость в км/ч
- `distance_moved` - Расстояние, пройденное с предыдущего обновления (в метрах)
- `gps_level`, `gsm_level` - Уровни сигналов
- `ignition_on`, `engine_running`, `parking_brake` - Состояние автомобиля
- `battery_voltage` - Напряжение АКБ
- `timestamp` - Время GPS данных (из Starline)
- `created_at` - Время создания записи в БД

---

## 🔄 Автоматическое сохранение

История координат сохраняется **автоматически** при каждом обновлении GPS данных через endpoint `/starline/update-gps`.

**Код сохранения** (в `src/services/starline-monitor.ts`):

```typescript
// Сохраняем историю координат при каждом обновлении GPS (независимо от скорости)
if (gpsUpdate.currentLat !== null && gpsUpdate.currentLng !== null) {
  await sqlConnection`
    INSERT INTO gps_tracking_history (
      car_id, starline_device_id,
      latitude, longitude, satellites,
      status, is_moving, speed, distance_moved,
      gps_level, gsm_level,
      ignition_on, engine_running, parking_brake, battery_voltage,
      timestamp
    ) VALUES (
      ${gpsUpdate.carId}, ${gpsUpdate.starlineDeviceId},
      ${gpsUpdate.currentLat}, ${gpsUpdate.currentLng}, ${gpsUpdate.currentSatQty},
      ${gpsUpdate.status}, ${gpsUpdate.isMoving}, ${gpsUpdate.speed}, ${gpsUpdate.distanceMoved},
      ${gpsUpdate.gpsLevel}, ${gpsUpdate.gsmLevel},
      ${gpsUpdate.ignitionOn}, ${gpsUpdate.engineRunning}, ${gpsUpdate.parkingBrake}, ${gpsUpdate.batteryVoltage},
      ${gpsUpdate.currentTimestamp.toISOString()}
    )
  `;
}
```

**Условия сохранения:**
- ✅ Сохраняется при каждом обновлении GPS (каждую минуту)
- ✅ Сохраняется независимо от скорости (даже если скорость = 0)
- ✅ Сохраняется только если есть координаты (`latitude` и `longitude` не NULL)

---

## 📈 Индексы

Для быстрого поиска созданы индексы:

```sql
-- По автомобилю
CREATE INDEX idx_gps_tracking_history_car_id ON gps_tracking_history(car_id);

-- По времени (для сортировки)
CREATE INDEX idx_gps_tracking_history_timestamp ON gps_tracking_history(timestamp DESC);

-- По устройству
CREATE INDEX idx_gps_tracking_history_device_id ON gps_tracking_history(starline_device_id);

-- Композитный индекс (автомобиль + время)
CREATE INDEX idx_gps_tracking_history_car_timestamp ON gps_tracking_history(car_id, timestamp DESC);

-- По статусу
CREATE INDEX idx_gps_tracking_history_status ON gps_tracking_history(status) WHERE status IS NOT NULL;

-- По движению (для фильтрации активных перемещений)
CREATE INDEX idx_gps_tracking_history_moving ON gps_tracking_history(car_id, timestamp DESC) WHERE is_moving = TRUE;
```

---

## 🔍 Примеры запросов

### Получить историю координат для автомобиля

```sql
SELECT 
  timestamp,
  latitude,
  longitude,
  speed,
  status,
  is_moving
FROM gps_tracking_history
WHERE car_id = 'uuid-автомобиля'
ORDER BY timestamp DESC
LIMIT 100;
```

### Получить маршрут за период

```sql
SELECT 
  timestamp,
  latitude,
  longitude,
  speed,
  distance_moved
FROM gps_tracking_history
WHERE car_id = 'uuid-автомобиля'
  AND timestamp >= '2025-11-18 00:00:00'
  AND timestamp <= '2025-11-18 23:59:59'
  AND is_moving = TRUE
ORDER BY timestamp ASC;
```

### Получить все точки движения (исключая стоянки)

```sql
SELECT 
  timestamp,
  latitude,
  longitude,
  speed
FROM gps_tracking_history
WHERE car_id = 'uuid-автомобиля'
  AND is_moving = TRUE
  AND status = 'moving'
ORDER BY timestamp ASC;
```

### Статистика по автомобилю за день

```sql
SELECT 
  COUNT(*) as total_points,
  COUNT(*) FILTER (WHERE is_moving = TRUE) as moving_points,
  SUM(distance_moved) as total_distance_meters,
  MAX(speed) as max_speed,
  AVG(speed) FILTER (WHERE speed > 0) as avg_speed
FROM gps_tracking_history
WHERE car_id = 'uuid-автомобиля'
  AND timestamp >= CURRENT_DATE
  AND timestamp < CURRENT_DATE + INTERVAL '1 day';
```

---

## 🔄 Отличие от других таблиц

### `gps_tracking` vs `gps_tracking_history`

| Таблица | Назначение | Данные |
|---------|-----------|--------|
| `gps_tracking` | Текущее состояние | Только последние координаты (текущие + предыдущие) |
| `gps_tracking_history` | Полная история | Все координаты за всё время |

### `speed_history` vs `gps_tracking_history`

| Таблица | Назначение | Данные |
|---------|-----------|--------|
| `speed_history` | История скорости | Сохраняется только когда есть скорость |
| `gps_tracking_history` | История координат | Сохраняется всегда, когда есть координаты |

**Важно:** `gps_tracking_history` сохраняет координаты **независимо от скорости**, что позволяет отслеживать все перемещения, включая медленные движения и стоянки.

---

## 📦 Миграция

Миграция находится в: `setup/migrations/0024_create_gps_tracking_history.sql`

**Применение:**

```bash
node apply_gps_history_migration.mjs
```

Или напрямую через psql:

```bash
psql $DATABASE_URL -f setup/migrations/0024_create_gps_tracking_history.sql
```

---

## ⚠️ Важные замечания

1. **Объём данных:** Таблица будет расти быстро (каждую минуту для каждого автомобиля). Рекомендуется:
   - Регулярная очистка старых данных (например, старше 90 дней)
   - Партиционирование по датам (для больших объёмов)
   - Мониторинг размера таблицы

2. **Производительность:** Индексы оптимизированы для частых запросов по `car_id` и `timestamp`. Для запросов по другим полям может потребоваться дополнительная оптимизация.

3. **Синхронизация:** История сохраняется автоматически при каждом вызове `/starline/update-gps` (каждую минуту через n8n workflow).

---

## 🔗 Связанные документы

- [STARLINE_GPS_MONITOR.md](./STARLINE_GPS_MONITOR.md) - Общая информация о GPS мониторинге
- [SPEED_MONITORING.md](./SPEED_MONITORING.md) - Мониторинг скорости
- [BATTERY_VOLTAGE_MONITORING.md](./BATTERY_VOLTAGE_MONITORING.md) - Мониторинг напряжения АКБ


# Мониторинг скорости

**Дата создания:** 2025-11-12  
**Статус:** ✅ Реализовано

---

## 🎯 Назначение

Система автоматического мониторинга скорости для контроля превышения лимита (125 км/ч) и сохранения истории скорости для анализа.

---

## 📊 Структура данных

### Таблица `speed_history`

Хранит историю всех измерений скорости:

```sql
CREATE TABLE speed_history (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id),
  starline_device_id BIGINT,
  speed NUMERIC(6, 2) NOT NULL, -- Скорость в км/ч
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  status TEXT,
  is_moving BOOLEAN DEFAULT FALSE
);
```

**Поля:**
- `speed` - Скорость в км/ч
- `timestamp` - Время измерения (из GPS данных)
- `latitude`, `longitude` - Координаты в момент измерения
- `ignition_on` - Зажигание включено в момент измерения
- `engine_running` - Двигатель работал в момент измерения
- `status` - Статус авто (offline, moving, parked_on, parked_off)
- `is_moving` - Машина в движении (определяется по координатам)

### Таблица `speed_violations`

Логирует превышения скорости для предотвращения спама:

```sql
CREATE TABLE speed_violations (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id),
  starline_device_id BIGINT,
  speed NUMERIC(6, 2) NOT NULL,
  speed_limit NUMERIC(6, 2) NOT NULL DEFAULT 125,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  google_maps_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 🔄 Процесс работы

### 1. Сохранение истории

При каждом обновлении GPS данных (каждую минуту):

1. **Сохраняется текущая скорость** в `gps_tracking.speed`
2. **Добавляется запись в историю** `speed_history` с метаданными:
   - Время измерения
   - Координаты (широта, долгота)
   - Состояние зажигания и двигателя
   - Статус авто
   - Флаг движения

**Условия сохранения:**
- Скорость > 0 ИЛИ машина в движении (`is_moving = TRUE`)

### 2. Проверка превышения скорости

После сохранения истории автоматически запускается проверка:

**Порог:** Скорость > **125 км/ч**

**При обнаружении превышения:**
- Отправляется уведомление в Telegram
- Сохраняется запись в `speed_violations`
- Защита от спама: уведомление не чаще **1 раза в 10 минут** для одной машины

### 3. Уведомления

**Формат уведомления:**
```
🚨 **Превышение скорости**

🚗 **Машина:** Toyota Camry (OC700OC)
📱 **Устройство:** Camry White ZR174ZR

⚡ **Скорость:** 135 км/ч
🚫 **Лимит:** 125 км/ч
📊 **Превышение:** 10 км/ч

📍 **Местоположение:** 41.653760, 41.638368
🗺️ **Карта:** https://www.google.com/maps?q=41.653760,41.638368

🕐 **Время:** 2025-11-12T10:30:00.000Z

⚠️ **Требуется:** Проверить обстоятельства превышения скорости
```

---

## 📈 Примеры использования

### Получить историю скорости для машины

```sql
SELECT 
  speed,
  timestamp,
  latitude,
  longitude,
  ignition_on,
  engine_running,
  status,
  is_moving
FROM speed_history
WHERE car_id = '2fa2085b-7315-4ba1-918f-2238d669f64b'
ORDER BY timestamp DESC
LIMIT 100;
```

### Средняя скорость по машине за последние 24 часа

```sql
SELECT 
  AVG(speed) as avg_speed,
  MAX(speed) as max_speed,
  MIN(speed) as min_speed,
  COUNT(*) as sample_count
FROM speed_history
WHERE car_id = '2fa2085b-7315-4ba1-918f-2238d669f64b'
  AND timestamp >= NOW() - INTERVAL '24 hours'
  AND speed > 0;
```

### Все превышения скорости

```sql
SELECT 
  c.plate,
  c.model,
  sv.speed,
  sv.speed_limit,
  sv.latitude,
  sv.longitude,
  sv.google_maps_link,
  sv.created_at
FROM speed_violations sv
JOIN cars c ON c.id = sv.car_id
ORDER BY sv.created_at DESC
LIMIT 50;
```

### График скорости для машины за последние 7 дней

```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(speed) as avg_speed,
  MAX(speed) as max_speed,
  MIN(speed) as min_speed
FROM speed_history
WHERE car_id = '2fa2085b-7315-4ba1-918f-2238d669f64b'
  AND timestamp >= NOW() - INTERVAL '7 days'
  AND speed > 0
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;
```

### Статистика превышений по машинам

```sql
SELECT 
  c.plate,
  c.model,
  COUNT(*) as violations_count,
  MAX(sv.speed) as max_speed,
  AVG(sv.speed) as avg_violation_speed
FROM speed_violations sv
JOIN cars c ON c.id = sv.car_id
WHERE sv.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.plate, c.model
ORDER BY violations_count DESC;
```

---

## ⚙️ Настройки

### Порог превышения скорости

Находится в `src/services/starline-monitor.ts` в методе `checkSpeedViolation`:

```typescript
// Порог превышения: 125 км/ч
const speedLimit = 125;

if (gpsUpdate.speed > speedLimit) {
  await this.checkSpeedViolation(...);
}
```

### Интервал проверки

- **История:** Сохраняется при каждом обновлении GPS (каждую минуту)
- **Проверка превышения:** Выполняется при каждом сохранении истории
- **Защита от спама:** Уведомление не чаще **1 раза в 10 минут**

---

## 🔧 Миграции

### Применение миграций

```bash
# На сервере
cd /root/geodrive_n8n-agents
psql $DATABASE_URL -f setup/migrations/0020_create_speed_history.sql
psql $DATABASE_URL -f setup/migrations/0021_create_speed_violations.sql
```

Или через Node.js:

```javascript
import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);

// Применить миграции
const migration1 = fs.readFileSync('setup/migrations/0020_create_speed_history.sql', 'utf8');
const migration2 = fs.readFileSync('setup/migrations/0021_create_speed_violations.sql', 'utf8');

await sql.unsafe(migration1);
await sql.unsafe(migration2);

await sql.end();
```

---

## 📝 Логирование

Все события логируются в `src/services/starline-monitor.ts`:

- **Успешное сохранение:** `logger.debug` (не логируется по умолчанию)
- **Обнаружено превышение:** `logger.warn` с деталями
- **Ошибки:** `logger.error` с контекстом

**Пример лога:**
```
Speed violation detected for OC700OC: 135 km/h (limit: 125 km/h)
```

---

## 🚨 Устранение неполадок

### История не сохраняется

1. **Проверьте, что скорость приходит от Starline:**
   ```sql
   SELECT speed FROM gps_tracking 
   WHERE car_id = '<car_id>' LIMIT 1;
   ```

2. **Проверьте условия сохранения:**
   - Скорость > 0 ИЛИ `is_moving = TRUE`
   - Скорость не NULL

3. **Проверьте логи API:**
   ```bash
   pm2 logs jarvis-api --lines 100 | grep -i speed
   ```

### Уведомления о превышении не приходят

1. **Проверьте порог:**
   - Убедитесь, что скорость действительно > 125 км/ч

2. **Проверьте защиту от спама:**
   ```sql
   SELECT * FROM speed_violations 
   WHERE car_id = '<car_id>' 
   ORDER BY created_at DESC LIMIT 5;
   ```

3. **Проверьте настройку `N8N_ALERTS_URL`:**
   - Должна быть установлена в `.env`
   - Должен быть активен n8n workflow "Battery Voltage Alerts"

---

## 📚 Связанные файлы

- **Код:** `src/services/starline-monitor.ts` (метод `checkSpeedViolation`)
- **Миграции:**
  - `setup/migrations/0020_create_speed_history.sql`
  - `setup/migrations/0021_create_speed_violations.sql`
- **Интеграция:** `src/integrations/n8n.ts` (метод `sendTelegramAlert`)
- **n8n Workflow:** `n8n-workflows/battery-voltage-alerts.json` (используется для всех алертов)

---

**Дата создания:** 2025-11-12  
**Версия:** 1.0


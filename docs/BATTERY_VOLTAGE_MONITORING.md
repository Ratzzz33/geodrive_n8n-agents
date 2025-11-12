# Мониторинг вольтажа батареи

**Дата создания:** 2025-11-12  
**Статус:** ✅ Реализовано

---

## 🎯 Назначение

Система автоматического мониторинга вольтажа батареи для контроля нестандартного падения по сравнению с другими авто. При обнаружении аномалии отправляются уведомления сотрудникам компании.

---

## 📊 Структура данных

### Таблица `battery_voltage_history`

Хранит историю всех измерений вольтажа:

```sql
CREATE TABLE battery_voltage_history (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id),
  starline_device_id BIGINT,
  battery_voltage NUMERIC(5, 2) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ignition_on BOOLEAN DEFAULT FALSE,
  engine_running BOOLEAN DEFAULT FALSE,
  status TEXT
);
```

**Поля:**
- `battery_voltage` - Напряжение АКБ в вольтах (V)
- `timestamp` - Время измерения (из GPS данных)
- `ignition_on` - Зажигание включено в момент измерения
- `engine_running` - Двигатель работал в момент измерения
- `status` - Статус авто (offline, moving, parked_on, parked_off)

### Таблица `battery_voltage_alerts`

Логирует уведомления для предотвращения спама:

```sql
CREATE TABLE battery_voltage_alerts (
  id BIGSERIAL PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES cars(id),
  starline_device_id BIGINT,
  battery_voltage NUMERIC(5, 2) NOT NULL,
  avg_voltage NUMERIC(5, 2) NOT NULL,
  deviation NUMERIC(5, 2) NOT NULL,
  deviation_percent NUMERIC(5, 2) NOT NULL,
  is_critical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 🔄 Процесс работы

### 1. Сохранение истории

При каждом обновлении GPS данных (каждую минуту):

1. **Сохраняется текущий вольтаж** в `gps_tracking.battery_voltage`
2. **Добавляется запись в историю** `battery_voltage_history` с метаданными:
   - Время измерения
   - Состояние зажигания и двигателя
   - Статус авто

### 2. Проверка аномалий

После сохранения истории автоматически запускается проверка:

**Условия проверки:**
- ✅ Зажигание выключено (`ignition_on = FALSE`)
- ✅ Двигатель не работает (`engine_running = FALSE`)
- ✅ Вольтаж не NULL и > 0

**Вычисление статистики:**
- Средний вольтаж по всем авто за последние 24 часа
- Стандартное отклонение
- Минимум 10 измерений для статистики

**Пороги для уведомления:**
- Абсолютное отклонение > **0.5V** ИЛИ
- Относительное отклонение > **10%** ИЛИ
- Вольтаж ниже среднего на **2 стандартных отклонения** (критично)

### 3. Уведомления

**Защита от спама:**
- Уведомление отправляется не чаще **1 раза в час** для одной машины
- Проверка через таблицу `battery_voltage_alerts`

**Формат уведомления:**
```
⚠️ ВНИМАНИЕ **Нестандартное падение вольтажа**

🚗 **Машина:** Toyota Camry (OC700OC)
📱 **Устройство:** Camry White ZR174ZR

📊 **Текущий вольтаж:** 11.8V
📈 **Средний по парку:** 12.5V
📉 **Отклонение:** -0.7V (-5.6%)

📋 **Статистика:**
• Образцов для сравнения: 150
• Стандартное отклонение: 0.3V

💡 **Рекомендация:** Проверить состояние АКБ и генератора
```

---

## 📈 Примеры использования

### Получить историю вольтажа для машины

```sql
SELECT 
  battery_voltage,
  timestamp,
  ignition_on,
  engine_running,
  status
FROM battery_voltage_history
WHERE car_id = '2fa2085b-7315-4ba1-918f-2238d669f64b'
ORDER BY timestamp DESC
LIMIT 100;
```

### Средний вольтаж по парку за последние 24 часа

```sql
SELECT 
  AVG(battery_voltage) as avg_voltage,
  MIN(battery_voltage) as min_voltage,
  MAX(battery_voltage) as max_voltage,
  STDDEV(battery_voltage) as stddev_voltage,
  COUNT(*) as sample_count
FROM battery_voltage_history
WHERE timestamp >= NOW() - INTERVAL '24 hours'
  AND ignition_on = FALSE
  AND engine_running = FALSE
  AND battery_voltage IS NOT NULL
  AND battery_voltage > 0;
```

### Все уведомления о нестандартном падении

```sql
SELECT 
  c.plate,
  c.model,
  bva.battery_voltage,
  bva.avg_voltage,
  bva.deviation,
  bva.deviation_percent,
  bva.is_critical,
  bva.created_at
FROM battery_voltage_alerts bva
JOIN cars c ON c.id = bva.car_id
ORDER BY bva.created_at DESC
LIMIT 50;
```

### График вольтажа для машины за последние 7 дней

```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(battery_voltage) as avg_voltage,
  MIN(battery_voltage) as min_voltage,
  MAX(battery_voltage) as max_voltage
FROM battery_voltage_history
WHERE car_id = '2fa2085b-7315-4ba1-918f-2238d669f64b'
  AND timestamp >= NOW() - INTERVAL '7 days'
  AND ignition_on = FALSE
  AND engine_running = FALSE
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;
```

---

## ⚙️ Настройки

### Пороги уведомлений

Находятся в `src/services/starline-monitor.ts` в методе `checkBatteryVoltageAnomaly`:

```typescript
// Абсолютное отклонение > 0.5V
const absoluteThreshold = 0.5;

// Относительное отклонение > 10%
const percentThreshold = 10;

// Критическое отклонение (2 стандартных отклонения)
const criticalMultiplier = 2;
```

### Интервал проверки

- **История:** Сохраняется при каждом обновлении GPS (каждую минуту)
- **Статистика:** Вычисляется за последние **24 часа**
- **Защита от спама:** Уведомление не чаще **1 раза в час**

---

## 🔧 Миграции

### Применение миграций

```bash
# На сервере
cd /root/geodrive_n8n-agents
psql $DATABASE_URL -f setup/migrations/0018_create_battery_voltage_history.sql
psql $DATABASE_URL -f setup/migrations/0019_create_battery_voltage_alerts.sql
```

Или через Node.js:

```javascript
import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);

// Применить миграции
const migration1 = fs.readFileSync('setup/migrations/0018_create_battery_voltage_history.sql', 'utf8');
const migration2 = fs.readFileSync('setup/migrations/0019_create_battery_voltage_alerts.sql', 'utf8');

await sql.unsafe(migration1);
await sql.unsafe(migration2);

await sql.end();
```

---

## 📝 Логирование

Все события логируются в `src/services/starline-monitor.ts`:

- **Успешное сохранение:** `logger.debug` (не логируется по умолчанию)
- **Обнаружена аномалия:** `logger.warn` с деталями
- **Ошибки:** `logger.error` с контекстом

**Пример лога:**
```
Battery voltage anomaly detected for OC700OC: 11.8V (avg: 12.5V, deviation: -0.7V)
```

---

## 🚨 Устранение неполадок

### Уведомления не приходят

1. **Проверьте наличие данных:**
   ```sql
   SELECT COUNT(*) FROM battery_voltage_history 
   WHERE timestamp >= NOW() - INTERVAL '24 hours';
   ```

2. **Проверьте пороги:**
   - Убедитесь, что есть минимум 10 измерений
   - Проверьте, что отклонение превышает пороги

3. **Проверьте защиту от спама:**
   ```sql
   SELECT * FROM battery_voltage_alerts 
   WHERE car_id = '<car_id>' 
   ORDER BY created_at DESC LIMIT 5;
   ```

### История не сохраняется

1. **Проверьте, что вольтаж приходит от Starline:**
   ```sql
   SELECT battery_voltage FROM gps_tracking 
   WHERE car_id = '<car_id>' LIMIT 1;
   ```

2. **Проверьте логи API:**
   ```bash
   pm2 logs jarvis-api --lines 100 | grep -i battery
   ```

---

## 📚 Связанные файлы

- **Код:** `src/services/starline-monitor.ts` (метод `checkBatteryVoltageAnomaly`)
- **Миграции:**
  - `setup/migrations/0018_create_battery_voltage_history.sql`
  - `setup/migrations/0019_create_battery_voltage_alerts.sql`
- **Интеграция:** `src/integrations/n8n.js` (метод `sendTelegramAlert`)

---

**Дата создания:** 2025-11-12  
**Версия:** 1.0


# Автоматическая обработка событий через триггеры БД

**Дата создания:** 2025-11-14  
**Статус:** ✅ Реализовано и работает

---

## 🎯 Архитектура решения

### Преимущества триггеров БД над n8n workflow:

1. ✅ **Мгновенная обработка** - события обрабатываются сразу при вставке
2. ✅ **Гарантированная обработка** - в рамках транзакции БД
3. ✅ **Меньше задержек** - нет ожидания cron (5 минут)
4. ✅ **Надежность** - не зависит от внешних сервисов (n8n)
5. ✅ **Простота** - вся логика в БД

---

## 📋 Как это работает

### 1. Триггер на INSERT в таблицу `events`

```sql
CREATE TRIGGER auto_process_event_on_insert
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.processed IS NULL OR NEW.processed = FALSE)
  EXECUTE FUNCTION auto_process_event_trigger();
```

**Что делает триггер:**
- Определяет `branch` по `company_id`
- Извлекает `ext_id` из различных источников
- Отправляет `pg_notify` с данными события

### 2. Служба прослушивания (Event Listener)

Служба `setup/create_event_listener_service.mjs`:
- Подписывается на канал `rentprog_event_processed`
- Получает уведомления от триггера
- Вызывает Jarvis API `/process-event`
- Обновляет статус события в БД

---

## 🚀 Быстрый старт

### Шаг 1: Применить миграцию (уже сделано)

```bash
node setup/apply_db_triggers.mjs
```

### Шаг 2: Обработать существующие события

```bash
# Вариант 1: Через скрипт (рекомендуется)
node setup/process_existing_events_via_db.mjs

# Вариант 2: Через функцию БД (отправляет только pg_notify)
SELECT * FROM process_all_unprocessed_events();
```

### Шаг 3: Запустить службу для новых событий

```bash
# Запуск в фоне (рекомендуется через PM2 или systemd)
node setup/create_event_listener_service.mjs

# Или через PM2:
pm2 start setup/create_event_listener_service.mjs --name event-listener
pm2 save
```

---

## 📊 Функции БД

### `get_branch_from_company_id(company_id INTEGER)`

Определяет branch по company_id:
- `9247` → `tbilisi`
- `9248` → `kutaisi`
- `9506` → `batumi`
- `11163` → `service-center`

### `extract_ext_id_from_event(rentprog_id, ext_id, payload)`

Извлекает ext_id с приоритетом:
1. `rentprog_id`
2. `ext_id`
3. `payload.id`
4. `payload.car_id`
5. `payload.client_id`
6. `payload.booking_id`

### `auto_process_event_trigger()`

Триггерная функция, которая:
- Определяет branch и ext_id
- Отправляет `pg_notify('rentprog_event_processed', 'event_id|branch|type|ext_id')`

### `process_all_unprocessed_events()`

Обрабатывает все необработанные события:
```sql
SELECT * FROM process_all_unprocessed_events();
-- Возвращает: processed_count, error_count
```

---

## 🔧 Настройка службы

### PM2 (рекомендуется)

```bash
# Установка PM2 (если нет)
npm install -g pm2

# Запуск службы
pm2 start setup/create_event_listener_service.mjs --name event-listener

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Просмотр логов
pm2 logs event-listener

# Перезапуск
pm2 restart event-listener
```

### systemd (Linux)

Создайте файл `/etc/systemd/system/event-listener.service`:

```ini
[Unit]
Description=RentProg Event Listener Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/geodrive_n8n-agents
ExecStart=/usr/bin/node setup/create_event_listener_service.mjs
Restart=always
RestartSec=10
Environment="JARVIS_API_URL=http://46.224.17.15:3000"

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl daemon-reload
sudo systemctl enable event-listener
sudo systemctl start event-listener
sudo systemctl status event-listener
```

---

## 📝 Формат уведомления

Триггер отправляет уведомление в формате:
```
event_id|branch|type|ext_id
```

Пример:
```
2286|batumi|car_update|61630
```

---

## 🔍 Мониторинг

### Проверка статуса событий

```sql
-- Статистика обработки
SELECT 
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE processed = false OR processed IS NULL) as unprocessed,
  COUNT(*) FILTER (WHERE processed = true AND ok = false) as errors
FROM events;
```

### Просмотр последних обработанных событий

```sql
SELECT id, ts, event_name, rentprog_id, processed, ok, reason
FROM events
WHERE processed = true
ORDER BY ts DESC
LIMIT 20;
```

### Просмотр ошибок

```sql
SELECT id, ts, event_name, rentprog_id, reason
FROM events
WHERE processed = true AND ok = false
ORDER BY ts DESC
LIMIT 20;
```

---

## ⚠️ Важные замечания

1. **Триггер работает только для новых событий** - существующие нужно обработать вручную
2. **Служба должна работать постоянно** - иначе новые события не будут обрабатываться
3. **При перезапуске службы** - она автоматически обработает все необработанные события при старте
4. **Ошибки обрабатываются** - события помечаются как `processed=true, ok=false` с причиной ошибки

---

## 🔄 Откат к n8n workflow (если нужно)

Если нужно вернуться к n8n workflow:

1. Удалить триггер:
```sql
DROP TRIGGER IF EXISTS auto_process_event_on_insert ON events;
```

2. Активировать n8n workflow "RentProg Events Auto Processor"

---

## ✅ Результат

- ✅ Все новые события обрабатываются автоматически при вставке
- ✅ Существующие события можно обработать через скрипт
- ✅ Надежная обработка без задержек
- ✅ Простая архитектура на уровне БД


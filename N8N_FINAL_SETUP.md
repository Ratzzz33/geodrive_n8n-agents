# Финальная настройка n8n - Итоговая сводка

## ✅ Выполнено автоматически:

1. **Таблицы созданы в Neon PostgreSQL:**
   - `events` - события вебхуков RentProg
   - `sync_runs` - прогресс синхронизации  
   - `health` - health check статусы

2. **Код Jarvis обновлен:**
   - `src/integrations/n8n.ts` - отправка событий с правильным форматом
   - `src/bot/index.ts` - отправка прогресса синхронизации каждые 20 записей
   - `src/config/index.ts` - поддержка `N8N_BASE_WEBHOOK_URL`

## ⚠️ Требуется ручная настройка в n8n UI:

### 1. Создание Credentials

**PostgreSQL Credential:**
1. Войдите в n8n UI: `http://46.224.17.15:5678`
2. Перейдите в **Credentials** → **New Credential**
3. Выберите **PostgreSQL**
4. Заполните:
   - **Host:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
   - **Port:** `5432`
   - **Database:** `neondb`
   - **User:** `neondb_owner`
   - **Password:** `npg_cHIT9Kxfk1Am`
   - **SSL:** Enable SSL (reject unauthorized = false)
5. Назовите: **PostgreSQL**

**Telegram Bot Credential (для алертов):**
1. **Credentials** → **New Credential**
2. Выберите **Telegram**
3. Введите токен бота `@n8n_alert_geodrive_bot` (НЕ основной бот!)
4. Назовите: **Telegram Bot** (или **Telegram Alert Bot** для ясности)
5. ⚠️ **Важно:** Это бот специально для алертов, не путать с основным ботом `@test_geodrive_check_bot`

### 2. Импорт Workflow

1. В n8n UI: **Workflows** → **Import from File**
2. Импортируйте 3 файла из `n8n-workflows/`:
   - `rentprog-webhooks-monitor.json`
   - `sync-progress.json`
   - `health-status.json`
3. Для каждого workflow:
   - Назначьте **PostgreSQL** credential всем Postgres нодам
   - Назначьте **Telegram Bot** credential всем Telegram нодам

### 3. Переменные окружения

В n8n UI: **Settings** → **Environment Variables** или в каждом workflow:

- `RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health`
- `TELEGRAM_ALERT_CHAT_ID=<ваш chat id или id группы>`

### 4. Активация Workflow

1. Откройте каждый workflow
2. Нажмите **Active** toggle (вкл/выкл) для активации

## 🧪 Тестирование:

1. **Тест вебхука:**
```bash
curl -X POST "http://46.224.17.15/webhook/rentprog-webhook?branch=tbilisi" \
  -H "Content-Type: application/json" \
  -d '{"ts":"2025-01-15T12:00:00Z","branch":"tbilisi","type":"booking.issue.planned","payload":{"id":"test_123"},"ok":true}'
```

2. **Проверка в n8n:**
   - Откройте "RentProg Webhooks Monitor" workflow
   - Проверьте **Executions** - должно появиться выполнение
   - Проверьте таблицу `events` в Neon - должна быть запись

3. **Тест синхронизации:**
   - В Telegram боте: `/sync_rentprog`
   - В n8n проверьте "Sync Progress" workflow executions
   - Проверьте таблицу `sync_runs` - должны быть записи

4. **Тест Health:**
   - Дождитесь cron (каждые 5 минут) или запустите вручную
   - Проверьте "Health & Status" workflow executions
   - Проверьте таблицу `health` - должны быть записи по филиалам

## 📊 Структура таблиц:

**events:**
- `ts` - timestamp события
- `branch` - филиал (tbilisi/batumi/kutaisi/service-center)
- `type` - тип события (booking.issue.planned, car.moved и т.д.)
- `ext_id` - внешний ID (из RentProg)
- `ok` - успешно ли обработано
- `reason` - причина (ok/duplicate/ошибка)

**sync_runs:**
- `ts` - timestamp
- `branch` - филиал
- `entity` - тип сущности (car/client/booking)
- `page` - номер страницы/батча
- `added` - количество созданных
- `updated` - количество обновленных
- `ok` - успешно ли
- `msg` - сообщение

**health:**
- `ts` - timestamp
- `branch` - филиал
- `ok` - здоров ли филиал
- `reason` - причина (ok/ошибка)

## 🔗 URL вебхуков для Jarvis:

Jarvis будет отправлять на:
- `http://46.224.17.15/webhook/rentprog-webhook?branch={branch}` - события вебхуков
- `http://46.224.17.15/webhook/sync/progress` - прогресс синхронизации

Убедитесь, что в `.env` на сервере установлено:
```env
N8N_BASE_WEBHOOK_URL=http://46.224.17.15/webhook
```

## ✅ Definition of Done:

После настройки должно быть:
- ✅ В n8n видны выполнения по "RentProg Webhooks Monitor" и "Sync Progress"
- ✅ Таблицы `events`, `sync_runs`, `health` в Neon получают записи
- ✅ Telegram алерты работают при ошибках (ok:false)
- ✅ `/status` в боте показывает зеленый статус по RentProg
- ✅ В таблице `health` актуальные записи по филиалам


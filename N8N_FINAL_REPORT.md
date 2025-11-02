# Отчет: Настройка n8n для мониторинга RentProg

## ✅ Выполнено автоматически:

### 1. База данных
- ✅ Созданы 3 таблицы в Neon PostgreSQL:
  - `events` - события вебхуков
  - `sync_runs` - прогресс синхронизации
  - `health` - health check статусы

### 2. Workflow в n8n
- ✅ Импортированы 3 workflow:
  - "RentProg Webhooks Monitor" (ID: `gNXRKIQpNubEazH7`) - **Active**
  - "Sync Progress" (ID: `TNg2dX78ovQrgWdL`) - **Active**
  - "Health & Status" (ID: `vNOWh8H7o5HL7fJ3`) - **Active`

### 3. Credentials
- ✅ "Postgres account" - создан (подключение к Neon)
- ✅ "Telegram account" - создан (токен @n8n_alert_geodrive_bot)

### 4. Код Jarvis
- ✅ Обновлен `src/integrations/n8n.ts` - отправка событий с branch в query
- ✅ Обновлен `src/bot/index.ts` - прогресс синхронизации каждые 20 записей
- ✅ Добавлены комментарии о различии ботов

### 5. Браузер
- ✅ Браузер запущен в **видимом режиме** (headless: false)
- ✅ Вход в n8n выполнен (33pokrov33@gmail.com)
- ✅ Страницы workflow доступны

---

## ⚠️ Требуется ручная настройка (5-10 минут):

Из-за сложной структуры UI n8n (React/Vue, динамическая загрузка), автоматизация назначения credentials через браузер затруднена. **Нужно выполнить вручную:**

### Шаг 1: Откройте каждый workflow

**RentProg Webhooks Monitor:**
http://46.224.17.15:5678/workflow/gNXRKIQpNubEazH7

**Sync Progress:**
http://46.224.17.15:5678/workflow/TNg2dX78ovQrgWdL

**Health & Status:**
http://46.224.17.15:5678/workflow/vNOWh8H7o5HL7fJ3

### Шаг 2: Назначьте credentials для каждой ноды

Для **Postgres нод:**
1. Двойной клик на ноду (или правый клик → Edit)
2. В правой панели найдите поле **"Credential"**
3. Выберите **"Postgres account"**
4. Закройте панель (автосохранение)

Для **Telegram нод:**
1. Двойной клик на ноду
2. В поле **"Credential"** выберите **"Telegram account"**
3. Закройте панель

### Шаг 3: Переменные окружения

В настройках проекта или каждого workflow:
- `RENTPROG_HEALTH_URL` = `http://46.224.17.15:3000/rentprog/health`
- `TELEGRAM_ALERT_CHAT_ID` = `<ваш chat id>`

---

## 🧪 Проверка работы:

### Тест 1: Webhook
```powershell
powershell -ExecutionPolicy Bypass -File setup/test_n8n_workflows.ps1
```

Проверьте:
- n8n → Executions → "RentProg Webhooks Monitor"
- Таблица `events` в Neon

### Тест 2: Синхронизация
- В Telegram: `/sync_rentprog`
- Проверьте таблицу `sync_runs`

### Тест 3: Health Check
- Дождитесь cron (5 минут)
- Проверьте таблицу `health`

---

## 📊 URLs для быстрого доступа:

**Workflow:**
- RentProg Webhooks Monitor: http://46.224.17.15:5678/workflow/gNXRKIQpNubEazH7
- Sync Progress: http://46.224.17.15:5678/workflow/TNg2dX78ovQrgWdL
- Health & Status: http://46.224.17.15:5678/workflow/vNOWh8H7o5HL7fJ3

**Executions:**
http://46.224.17.15:5678/projects/YeYimRJroeGbDN4w/executions

**Credentials:**
http://46.224.17.15:5678/projects/YeYimRJroeGbDN4w/credentials

---

**Браузер открыт и готов для завершения настройки!** 🎯


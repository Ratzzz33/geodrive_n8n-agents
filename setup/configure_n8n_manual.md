# Инструкция: Настройка n8n вручную через браузер

## Доступ
- **URL:** http://46.224.17.15:5678
- **Email:** 33pokrov33@gmail.com
- **Password:** Alex1144

---

## 1. Переименование Credentials

### Шаг 1: Войдите в n8n
1. Откройте http://46.224.17.15:5678
2. Введите email и пароль
3. Выберите проект (если нужно)

### Шаг 2: Переименуйте Credentials
1. Перейдите в **Credentials** (в левом меню или через Overview)
2. Найдите следующие credentials:

#### Telegram Bot
- **Старое имя:** "Telegram account"
- **Новое имя:** "Telegram Bot" (или "Telegram Alert Bot")
- **Действия:**
  1. Нажмите на credential
  2. Или нажмите **⋮** (три точки) → **Edit**
  3. Измените название на "Telegram Bot"
  4. Сохраните

#### PostgreSQL
- **Старое имя:** "Postgres account"  
- **Новое имя:** "PostgreSQL" (или "Neon PostgreSQL")
- **Действия:**
  1. Нажмите на credential
  2. Или нажмите **⋮** (три точки) → **Edit**
  3. Измените название на "PostgreSQL"
  4. Сохраните

---

## 2. Назначение Credentials в Workflow

### RentProg Webhooks Monitor
1. Откройте workflow "RentProg Webhooks Monitor"
2. Для каждой **Postgres** ноды:
   - Откройте ноду
   - В поле **Credential** выберите **PostgreSQL**
   - Сохраните
3. Для каждой **Telegram** ноды:
   - Откройте ноду
   - В поле **Credential** выберите **Telegram Bot**
   - Сохраните

### Sync Progress
1. Откройте workflow "Sync Progress"
2. Для **Postgres** ноды:
   - Выберите credential **PostgreSQL**

### Health & Status
1. Откройте workflow "Health & Status"
2. Для **Postgres** ноды:
   - Выберите credential **PostgreSQL**
3. Для **Telegram** ноды:
   - Выберите credential **Telegram Bot**

---

## 3. Настройка переменных окружения

### Вариант A: Глобальные переменные
1. Перейдите в **Settings** → **Environment Variables** (или через проект)
2. Добавьте:
   - `RENTPROG_HEALTH_URL` = `http://46.224.17.15:3000/rentprog/health`
   - `TELEGRAM_ALERT_CHAT_ID` = `<ваш chat id или id группы>`

### Вариант B: В каждом workflow
1. Откройте workflow
2. В правом меню найдите **Variables** или **Environment**
3. Добавьте те же переменные

---

## 4. Активация Workflow

Проверьте, что все workflow активны:
1. Откройте каждый workflow
2. Переключатель **Active** должен быть включен
3. Если нет — включите

---

## 5. Проверка

### Тест вебхука:
```bash
curl -X POST "http://46.224.17.15/webhook/rentprog-webhook?branch=tbilisi" \
  -H "Content-Type: application/json" \
  -d '{"ts":"2025-01-15T12:00:00Z","branch":"tbilisi","type":"booking.issue.planned","payload":{"id":"test_123"},"ok":true}'
```

### Проверьте в n8n:
1. Откройте "RentProg Webhooks Monitor"
2. Посмотрите **Executions** — должно появиться выполнение
3. Проверьте таблицу `events` в Neon — должна быть запись

---

## Важные заметки

⚠️ **Telegram Bot credential:**
- Используется токен бота **@n8n_alert_geodrive_bot** (НЕ основной бот!)
- Это специально для алертов через n8n

✅ **PostgreSQL credential:**
- Host: `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
- Database: `neondb`
- User: `neondb_owner`


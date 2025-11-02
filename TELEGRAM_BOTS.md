# Telegram боты в системе

## Описание ботов

### 1. Основной бот (TELEGRAM_BOT_TOKEN)

**Имя бота:** `@test_geodrive_check_bot` (или другой основной бот)

**Назначение:**
- Команды пользователей (`/status`, `/sync_rentprog` и т.д.)
- Ответы на сообщения
- Работа с пользователями

**Переменная окружения:**
```env
TELEGRAM_BOT_TOKEN=your_main_bot_token
```

**Использование в коде:**
- `src/bot/index.ts` - основной бот для команд и ответов

---

### 2. Бот для алертов n8n (N8N_ALERTS_TELEGRAM_BOT_TOKEN)

**Имя бота:** `@n8n_alert_geodrive_bot`

**Назначение:**
- Отправка алертов об ошибках через n8n workflows
- Уведомления о проблемах в системе
- НЕ используется для работы с пользователями

**Переменная окружения:**
```env
N8N_ALERTS_TELEGRAM_BOT_TOKEN=your_n8n_alert_bot_token
```

**Использование:**
- В n8n credentials: создайте credential "Telegram Bot" с токеном этого бота
- В n8n workflows: назначается на Telegram ноды для отправки алертов
- В коде: `src/integrations/n8n.ts` - функция `sendTelegramAlert()` (но используется через n8n)

---

## Настройка в n8n

### Credentials в n8n

**Название:** `Telegram Bot` (или `Telegram Alert Bot`)

**Токен:** токен бота `@n8n_alert_geodrive_bot`

**Где использовать:**
- Workflow "RentProg Webhooks Monitor" - нода "Telegram Alert"
- Workflow "Health & Status" - нода "Telegram Alert"

---

## Важно

⚠️ **Не путать ботов:**
- Основной бот (`TELEGRAM_BOT_TOKEN`) - для пользователей
- Бот алертов (`N8N_ALERTS_TELEGRAM_BOT_TOKEN`) - только для уведомлений через n8n

✅ В n8n credentials нужно использовать токен `@n8n_alert_geodrive_bot`


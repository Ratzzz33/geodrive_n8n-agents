# Настройка переменных окружения для Umnico Telegram интеграции

## Шаг 1: Откройте файл .env

Файл `.env` находится в корне проекта: `C:\Users\33pok\geodrive_n8n-agents\.env`

## Шаг 2: Добавьте следующие переменные

Добавьте в конец файла `.env` следующие строки:

```env
# Umnico Telegram интеграция
# ID Telegram чата (группы/форума) для создания тем диалогов с клиентами
UMNICO_FORUM_CHAT_ID=-5015844768
# Интервал polling активных чатов в секундах (по умолчанию 5)
UMNICO_POLLING_INTERVAL=5
# URL веб-приложения для просмотра истории переписки
WEB_APP_URL=https://conversations.rentflow.rentals
# URL Playwright Service для взаимодействия с Umnico UI
PLAYWRIGHT_UMNICO_URL=http://localhost:3001
```

## Шаг 3: Проверьте наличие токена бота

Убедитесь, что в `.env` есть один из следующих токенов:

- `N8N_ALERTS_TELEGRAM_BOT_TOKEN` (токен бота @n8n_alert_geodrive_bot)
- `TELEGRAM_BOT_TOKEN` (основной токен бота)

## Шаг 4: Проверьте настройки

После добавления переменных выполните:

```bash
node setup/check_umnico_env.mjs
```

Должно показать ✅ для всех переменных.


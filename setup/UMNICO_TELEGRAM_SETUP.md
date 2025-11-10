# Чек-лист настройки Umnico Telegram Bridge

## Предварительные требования

- [ ] База данных Neon PostgreSQL настроена и доступна
- [ ] Telegram бот создан и добавлен в группу/форум
- [ ] Playwright Service для Umnico запущен и работает
- [ ] Jarvis API запущен и работает

## Шаг 1: Применить миграцию БД

```bash
# Вариант 1: Через Neon Console
# Откройте https://console.neon.tech
# Выполните SQL из файла sql/umnico_telegram_integration.sql

# Вариант 2: Через psql
psql $DATABASE_URL -f sql/umnico_telegram_integration.sql
```

**Проверка:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name IN ('tg_chat_id', 'tg_topic_id', 'session_expires_at');
-- Должно вернуть 3 строки
```

## Шаг 2: Настроить переменные окружения

Добавить в `.env` на сервере:

```env
UMNICO_FORUM_CHAT_ID=-5015844768
UMNICO_POLLING_INTERVAL=5
WEB_APP_URL=https://conversations.rentflow.rentals
PLAYWRIGHT_UMNICO_URL=http://playwright-umnico:3001
```

**Проверка:**
```bash
# На сервере
docker exec jarvis-api printenv | grep UMNICO
```

## Шаг 3: Проверить тип Telegram чата

```bash
node setup/check_telegram_chat_type.mjs
```

**Если чат не форум:**
1. Откройте Telegram
2. Зайдите в настройки группы "Umnico + TG BOT"
3. Выберите "Тип группы" → "Форум"
4. Подтвердите конвертацию
5. Повторно запустите скрипт проверки

## Шаг 4: Пересобрать и перезапустить сервисы

### Playwright Service

```bash
# На сервере
cd /root/geodrive_n8n-agents
cd services
npm run build
docker compose restart playwright-umnico

# Проверка
docker logs playwright-umnico --tail 50
# Должны быть новые endpoints в логах
```

### Jarvis API

```bash
# На сервере
cd /root/geodrive_n8n-agents
npm run build
docker compose restart jarvis-api

# Проверка
docker logs jarvis-api --tail 50
# Должно быть: "✅ Umnico Realtime Sync started"
```

## Шаг 5: Проверка работоспособности

### 1. Проверить что UmnicoRealtimeSync запущен

```bash
docker logs jarvis-api | grep "Umnico Realtime Sync"
# Должно быть: "Starting UmnicoRealtimeSync with interval 5s"
```

### 2. Проверить создание темы (тестовый диалог)

Создайте тестовое сообщение в Umnico и проверьте:
- Создалась ли тема в Telegram форуме
- Есть ли закрепленное сообщение с информацией
- Работают ли кнопки

### 3. Проверить отправку сообщения

Напишите сообщение в теме Telegram и проверьте:
- Отправилось ли сообщение клиенту в Umnico
- Сохранилось ли в БД

### 4. Проверить веб-интерфейс

Откройте ссылку из закрепленного сообщения:
- Должна загрузиться страница с историей
- Должны отображаться все сообщения

## Шаг 6: Настройка субдомена (опционально)

См. инструкцию в `docs/WEB_INTERFACE_SETUP.md`

## Troubleshooting

### Ошибка: "UMNICO_FORUM_CHAT_ID not configured"

**Решение:** Проверьте что переменная установлена в `.env` и контейнер перезапущен.

### Ошибка: "Chat is not a forum"

**Решение:** Конвертируйте группу в форум (см. Шаг 3).

### Ошибка: "Failed to create forum topic"

**Решение:** 
- Проверьте что бот является администратором
- Проверьте что бот имеет права на создание тем
- Проверьте логи бота на наличие ошибок

### Сообщения не синхронизируются

**Решение:**
1. Проверьте что Playwright Service доступен: `curl http://localhost:3001/health`
2. Проверьте логи UmnicoRealtimeSync
3. Проверьте есть ли активные чаты в БД

### Веб-интерфейс показывает 404

**Решение:**
1. Проверьте что статическая раздача настроена в `src/api/index.ts`
2. Проверьте что файл `web/conversations/index.html` существует
3. Проверьте логи Nginx (если используется)

## Проверка после настройки

- [ ] Миграция БД применена
- [ ] Переменные окружения установлены
- [ ] Чат является форумом
- [ ] Playwright Service перезапущен
- [ ] Jarvis API перезапущен
- [ ] UmnicoRealtimeSync запущен (логи)
- [ ] Тестовая тема создается
- [ ] Сообщения синхронизируются
- [ ] Отправка сообщений работает
- [ ] Веб-интерфейс доступен

---

**После выполнения всех шагов система готова к работе!**


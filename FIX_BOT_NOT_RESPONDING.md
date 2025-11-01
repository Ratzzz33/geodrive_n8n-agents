# Исправление: бот не реагирует на команды

## Диагностика проблемы

Выполните в Git Bash для подключения к серверу:

```bash
ssh root@46.224.17.15
# Пароль: enebit7Lschwrkb93vnm
```

После подключения выполните диагностику:

### 1. Проверка процессов бота
```bash
ps aux | grep -E "tsx|node.*index" | grep -v grep
```

Если процессов нет - бот не запущен.

### 2. Проверка webhook (важно!)
```bash
cd /root/geodrive_n8n-agents
source .env 2>/dev/null || true
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | grep -A 5 "result"
```

Если `url` не пустой - webhook установлен, его нужно удалить!

### 3. Проверка логов
```bash
tail -n 50 /root/bot.log
```

Посмотрите последние строки логов.

---

## Решение: Полный перезапуск с исправлением

Выполните эти команды на сервере:

```bash
cd /root/geodrive_n8n-agents

# Обновляем код
git pull

# Останавливаем ВСЕ процессы бота (принудительно)
pkill -9 -f "tsx.*index.ts" || true
pkill -9 -f "node.*dist/index.js" || true
pkill -9 -f "npm run dev" || true
sleep 3

# Удаляем webhook через API (если установлен)
source .env 2>/dev/null || true
if [ ! -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "Удаляю webhook..."
    curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"
    echo ""
fi

# Очищаем старые логи
rm -f /root/bot.log

# Запускаем бота заново
echo "Запускаю бота..."
cd /root/geodrive_n8n-agents
nohup npm run dev > /root/bot.log 2>&1 &

# Ждем запуска
sleep 5

# Проверяем логи
echo "Последние 30 строк логов:"
tail -n 30 /root/bot.log

# Проверяем процессы
echo ""
echo "Запущенные процессы:"
ps aux | grep -E "tsx|node.*index" | grep -v grep
```

---

## Что должно быть в логах:

После перезапуска должны увидеть:
```
✅ Webhook удален, переходим на polling режим
🤖 Bot started (polling mode)
📱 Bot @test_geodrive_check_bot connected (ID: ...)
```

---

## Если проблема не решена:

1. **Проверьте токен бота:**
   ```bash
   grep TELEGRAM_BOT_TOKEN /root/geodrive_n8n-agents/.env
   ```

2. **Проверьте что Node.js установлен:**
   ```bash
   node --version
   npm --version
   ```

3. **Проверьте зависимости:**
   ```bash
   cd /root/geodrive_n8n-agents
   npm install
   ```

4. **Проверьте подключение бота к Telegram:**
   ```bash
   source .env
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
   ```
   
   Должен вернуть информацию о боте (username, id).

---

## Быстрый скрипт (одной командой):

```bash
cd /root/geodrive_n8n-agents && git pull && pkill -9 -f "tsx.*index.ts" || pkill -9 -f "node.*dist/index.js" || true && sleep 3 && source .env 2>/dev/null && curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true" && rm -f /root/bot.log && nohup npm run dev > /root/bot.log 2>&1 & && sleep 5 && tail -n 30 /root/bot.log
```


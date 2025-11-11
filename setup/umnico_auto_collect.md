# Автоматический сбор чатов из Umnico через MCP Chrome

## 📋 Полный процесс

### Шаг 1: Создать таблицу в БД

```bash
node setup/collect_umnico_chat_ids.mjs
```

Это создаст таблицу `umnico_chat_ids`.

---

### Шаг 2: Собрать ID чатов через браузер

#### Вариант A: Через MCP Chrome в Cursor AI

1. Откройте Cursor AI
2. Скажите агенту:

```
Открой https://umnico.com/app/inbox/deals/inbox через MCP Chrome
```

3. После загрузки страницы (войдите вручную если нужно), скажите:

```
Выполни через MCP Chrome следующий JavaScript:

(async () => {
  // Прокрутка списка чатов
  const container = document.querySelector('[data-test-id="conversation-list"]') || 
                   document.querySelector('.conversations-list') ||
                   document.querySelector('.inbox-list');
  
  if (!container) return { error: 'Container not found' };
  
  let previousHeight = 0;
  let scrollAttempts = 0;
  const maxScrolls = 50;
  
  while (scrollAttempts < maxScrolls) {
    container.scrollTop = container.scrollHeight;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentHeight = container.scrollHeight;
    if (currentHeight === previousHeight) break;
    
    previousHeight = currentHeight;
    scrollAttempts++;
    console.log(`Scroll ${scrollAttempts}/${maxScrolls}`);
  }
  
  // Сбор ID
  const chatElements = document.querySelectorAll('[data-conversation-id], .conversation-item, .chat-item');
  const chatIds = new Set();
  
  chatElements.forEach(el => {
    const id = el.getAttribute('data-conversation-id') || 
               el.getAttribute('data-chat-id') ||
               el.getAttribute('data-id');
    
    if (id) chatIds.add(id);
    
    const link = el.querySelector('a[href*="/details/"]');
    if (link) {
      const match = link.href.match(/\/details\/(\d+)/);
      if (match) chatIds.add(match[1]);
    }
  });
  
  return {
    total: chatIds.size,
    ids: Array.from(chatIds)
  };
})()
```

4. Сохраните результат в файл `chat_ids.json`:

```json
{
  "total": 150,
  "ids": ["123456", "789012", ...]
}
```

#### Вариант B: Через DevTools Console

1. Откройте https://umnico.com/app/inbox/deals/inbox
2. Войдите в аккаунт
3. Нажмите F12 (DevTools)
4. Вставьте скрипт из Варианта A в Console
5. Скопируйте результат
6. Сохраните в `chat_ids.json`

---

### Шаг 3: Сохранить ID в БД

```bash
node setup/save_umnico_chat_ids.mjs chat_ids.json
```

Или из буфера обмена:

```bash
echo '{"ids":["123","456"]}' | node setup/save_umnico_chat_ids.mjs --stdin
```

---

### Шаг 4: Синхронизировать переписку

```bash
# Убедитесь что Playwright Service запущен
docker-compose up -d playwright-umnico

# Запустите синхронизацию (обрабатывает по 5 чатов)
node setup/sync_umnico_conversations.mjs
```

Скрипт будет обрабатывать по 5 чатов за раз. Запускайте его повторно, пока все чаты не будут обработаны.

---

### Шаг 5: Проверить результаты

```bash
node setup/check_umnico_sync_status.mjs
```

---

## 📊 Мониторинг процесса

### Статистика в БД

```sql
-- Общая статистика
SELECT 
  COUNT(*) as total_chats,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed,
  COUNT(*) FILTER (WHERE processed = FALSE) as pending
FROM umnico_chat_ids;

-- Последние обработанные
SELECT 
  id,
  metadata->>'client_name' as client,
  metadata->>'messages_count' as messages,
  last_sync_at
FROM umnico_chat_ids
WHERE processed = TRUE
ORDER BY last_sync_at DESC
LIMIT 10;

-- Ошибки
SELECT 
  id,
  metadata->>'error' as error,
  metadata->>'failed_at' as failed_at
FROM umnico_chat_ids
WHERE metadata->>'error' IS NOT NULL;
```

---

## 🔄 Автоматизация

### Cron-задача для регулярной синхронизации

```bash
# Каждый час синхронизировать новые чаты
0 * * * * cd /path/to/project && node setup/sync_umnico_conversations.mjs >> logs/umnico_sync.log 2>&1
```

---

## 🚨 Troubleshooting

### Ошибка: "Playwright Service недоступен"

```bash
# Проверить статус
docker-compose ps playwright-umnico

# Перезапустить
docker-compose restart playwright-umnico

# Проверить логи
docker-compose logs playwright-umnico
```

### Ошибка: "Chat not found"

Некоторые ID могут быть устаревшими или удаленными. Скрипт автоматически помечает их как обработанные с ошибкой.

### Медленная обработка

Измените параметры в `sync_umnico_conversations.mjs`:

```javascript
const BATCH_SIZE = 10; // Больше чатов за раз
const DELAY_BETWEEN_REQUESTS = 1000; // Меньше задержка (будьте осторожны!)
```

---

## 💡 Оптимизация

### Параллельная обработка

Запустите несколько экземпляров скрипта одновременно:

```bash
# Терминал 1
node setup/sync_umnico_conversations.mjs

# Терминал 2
node setup/sync_umnico_conversations.mjs

# Терминал 3
node setup/sync_umnico_conversations.mjs
```

Они автоматически разделят работу благодаря `LIMIT 5` в запросе.

---

## ✅ Готово!

После выполнения всех шагов у вас будет:

- ✅ Все ID чатов из Umnico в таблице `umnico_chat_ids`
- ✅ Полная история переписки в таблицах `conversations` и `messages`
- ✅ Готовность к интеграции с Telegram Bridge


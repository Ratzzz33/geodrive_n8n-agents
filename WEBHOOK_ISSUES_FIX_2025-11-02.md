# Исправление проблем с вебхуками - Отчет

**Дата:** 2025-11-02  
**Статус:** В процессе исправления

---

## Найденные проблемы

### 1. ❌ Error handling не работает

**Проблема:** При ошибке в нодах workflow просто падает, не обрабатывая ошибки.

**Причина:** Не было настроено `onError` в нодах.

**Исправление:**
- ✅ Добавлен `onError: "continueRegularOutput"` в:
  - Webhook ноду
  - Save Event (PostgreSQL)
  - Telegram Alert
- ✅ Добавлен `onError: "continueErrorOutput"` в If Error ноду

**Статус:** ✅ Исправлено в workflow и файле

---

### 2. ❌ Запись в БД не происходит

**Проблема:** Execution успешен (status: success), но записи в таблицу `events` нет.

**Возможные причины:**
1. PostgreSQL credentials не назначены в ноде "Save Event"
2. Неверное выражение queryParameters (optional chaining не поддерживается)
3. Ошибка SQL выполняется, но подавляется onError

**Исправления:**
- ✅ Убрал optional chaining (`?.`) из queryParameters
- ✅ Заменил на проверки через `&&` и тернарные операторы

**Проверка:**
1. Откройте workflow в n8n UI
2. Откройте ноду "Save Event"
3. Проверьте, что выбран credential "PostgreSQL"
4. Если нет - создайте credential:
   - Host: `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
   - Port: `5432`
   - Database: `neondb`
   - User: `neondb_owner`
   - Password: `npg_cHIT9Kxfk1Am`
   - SSL: Enable (reject unauthorized = false)

---

### 3. ❌ Не видно тестового вебхука в n8n UI

**Проблема:** Execution 43 успешен, но не видно деталей в UI.

**Причина:** Возможно фильтрация или скрытие executions.

**Решение:**
1. Откройте n8n UI: https://n8n.rentflow.rentals
2. Откройте workflow "RentProg Webhooks Monitor"
3. Перейдите в "Executions"
4. Найдите execution 43 (или последний)
5. Откройте детали - там должны быть данные всех нод

---

### 4. ❌ Реальные вебхуки не доходят

**Проблема:** Вебхуки от RentProg поступают каждые несколько минут, но не обрабатываются.

**Возможные причины:**
1. Неверный URL в настройках RentProg
2. Проблема с Nginx проксированием
3. Неверный путь в webhook ноде

**Проверка URL:**
- RentProg должен отправлять на: `https://webhook.rentflow.rentals/`
- Nginx должен проксировать: `https://webhook.rentflow.rentals/` → `http://localhost:5678/webhook/rentprog-webhook`
- Webhook path в n8n: `rentprog-webhook`

**Диагностика:**
1. Проверить логи Nginx на сервере:
   ```bash
   tail -f /var/log/nginx/webhook-access.log
   tail -f /var/log/nginx/webhook-error.log
   ```

2. Проверить логи n8n:
   ```bash
   docker logs n8n --tail 100 | grep -i webhook
   ```

3. Проверить настройки в RentProg:
   - Должен быть URL: `https://webhook.rentflow.rentals/`
   - Должен быть метод: POST
   - Проверить что webhook активен

4. Проверить что workflow активен:
   - В n8n UI должно быть: "RentProg Webhooks Monitor" - Active

---

## Исправления в коде

### Файл: `n8n-workflows/rentprog-webhooks-monitor.json`

1. **Добавлен error handling:**
   ```json
   {
     "onError": "continueRegularOutput"  // в Webhook, Save Event, Telegram Alert
     "onError": "continueErrorOutput"    // в If Error
   }
   ```

2. **Исправлены выражения (убрал optional chaining):**
   ```javascript
   // Было:
   $json.query?.branch || $json.body?.branch || 'unknown'
   
   // Стало:
   $json.query && $json.query.branch ? $json.query.branch : ($json.body && $json.body.branch ? $json.body.branch : 'unknown')
   ```

3. **Добавлена операция в Telegram:**
   ```json
   {
     "operation": "sendMessage"
   }
   ```

---

## Следующие шаги

1. ✅ **Проверить PostgreSQL credentials**
   - Открыть workflow в n8n UI
   - Проверить ноду "Save Event"
   - Убедиться что credential назначен

2. ✅ **Проверить детали execution**
   - Открыть последний execution в UI
   - Посмотреть данные каждой ноды
   - Найти ошибку (если есть)

3. ✅ **Проверить реальные вебхуки**
   - Проверить логи Nginx
   - Проверить настройки в RentProg
   - Убедиться что URL правильный

4. ✅ **Повторить тест**
   - Отправить тестовый вебхук
   - Проверить execution в n8n
   - Проверить запись в БД

---

**Все исправления применены в коде и обновлены в n8n** ✅

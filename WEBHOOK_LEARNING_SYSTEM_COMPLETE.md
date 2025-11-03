# ✅ Система обучения вебхуков RentProg - завершена

**Дата:** 2025-11-03  
**Статус:** Готова к тестированию с запущенным Jarvis API

---

## 🎯 Что сделано

### 1. Добавлены все типы событий в knownEventTypes

**Parse & Validate Format** теперь распознает:
- `booking_update`, `booking_create`, `booking_delete`
- `car_update`, `car_create`, `car_delete`
- `client_update`, `client_create`, `client_delete`

### 2. Определение operation (update/create/delete)

Добавлено поле `operation` для определения типа операции:
- **update** - обновление существующей сущности
- **create** - создание новой сущности
- **delete** - удаление (архивация) сущности

### 3. Jarvis API - логика обработки по типам

**`/process-webhook` endpoint обновлен:**

#### UPDATE операция:
```
1. Проверяем существование сущности в БД (через rentprog_id)
2. Если есть → быстрое обновление измененных полей (quick update)
3. Если нет → возвращаем needsUpsert=true → запуск Upsert Processor
```

#### CREATE операция:
```
1. Всегда отправляем на полный upsert через Upsert Processor
2. Создаем полную запись из payload (все данные есть в JSON)
```

#### DELETE операция:
```
1. Проверяем существование сущности
2. Если есть → архивируем (archived=true)
3. Если нет → ничего не делаем
```

### 4. Создан модуль архивации

**`src/db/archive.ts`:**
- Функция `archiveEntity(entityType, entityId)`
- Устанавливает `archived = true` в таблице
- Поддержка всех типов: car, booking, client, branch, employee

---

## 📊 Обновленные файлы

### n8n Workflow
- ✅ `n8n-workflows/rentprog-webhooks-monitor.json`
  - Parse & Validate Format: добавлены типы событий + operation
  - Auto Process: передает operation в Jarvis API

### Jarvis API
- ✅ `src/api/index.ts`
  - `/process-webhook` endpoint: логика для update/create/delete
- ✅ `src/db/archive.ts` (создан)
  - Модуль архивации сущностей

---

## 🔬 Как это работает

### Пример: booking_update

```
1. Вебхук приходит от RentProg:
   {
     "event": "booking_update",
     "payload": {
       "responsible": [null, "Байбаков Данияр"],
       "responsible_id": [null, 16003],
       "id": 506289,
       ...
     }
   }

2. Parse & Validate Format:
   - rentprogId: "506289"
   - eventType: "booking_update"
   - entityType: "booking"
   - operation: "update"  ← НОВОЕ!
   - isKnownFormat: true

3. If Known Format → TRUE → Auto Process:
   POST /process-webhook
   {
     "event": "booking_update",
     "rentprog_id": "506289",
     "entity_type": "booking",
     "operation": "update",  ← НОВОЕ!
     "payload": {...}
   }

4. Jarvis API /process-webhook:
   - operation === 'update'
   - Проверяем: есть ли booking с rentprog_id=506289?
   
   4a. Если ДА:
       - Quick update: обновляем responsible, responsible_id
       - Ответ: { processed: true, updated: true }
   
   4b. Если НЕТ:
       - Ответ: { needsUpsert: true }
       - Workflow запускает Upsert Processor
       - Полный fetch от RentProg → создание записи

5. Set Query Params → Save Event → Respond
```

---

## 🚨 Текущая проблема

**Jarvis API не запущен!**

Вебхуки приходят в n8n, парсятся правильно, но при попытке вызвать Jarvis API (`http://46.224.17.15:3000`) получается **504 Gateway Timeout**.

### Решение:

```bash
# На сервере Hetzner (46.224.17.15):
cd /root/geodrive_n8n-agents
npm run build
npm start
```

Или через PM2:
```bash
pm2 start dist/index.js --name jarvis
pm2 save
```

---

## ✅ Тестирование

### Когда Jarvis API будет запущен:

1. **Тестовый booking_update:**
   ```bash
   node setup/send_booking_update_test.mjs
   ```
   
   **Ожидается:**
   - Execution в n8n: success
   - Parse & Validate Format: isKnownFormat=true, operation="update"
   - Auto Process: вызов Jarvis API
   - НЕ должно быть Telegram уведомления (известный формат)

2. **Реальный вебхук от RentProg:**
   - При изменении booking в RentProg
   - Вебхук должен автоматически обработаться
   - Telegram уведомление только для неизвестных форматов

---

## 📝 Следующие шаги

1. **Запустить Jarvis API** на сервере
2. **Протестировать** с реальными вебхуками
3. **Добавить новые типы** событий по мере необходимости
4. **Обучить систему** распознавать специфичные форматы payload

---

## 💡 Как добавить новый тип события

1. **Добавить в knownEventTypes** (`Parse & Validate Format`):
   ```javascript
   const knownEventTypes = [
     ...
     'new_event_type'  // ← добавить сюда
   ];
   ```

2. **Обновить workflow** через API:
   ```bash
   node setup/fix_and_update.mjs
   ```

3. **Тест**:
   ```bash
   node setup/send_test_webhook.mjs
   ```

---

## 📚 Документация

- **Workflow:** https://n8n.rentflow.rentals/workflow/gNXRKIQpNubEazH7
- **Jarvis API:** `http://46.224.17.15:3000`
- **Database:** Neon PostgreSQL (таблица `events`)

---

**Автор:** Claude Sonnet 4.5  
**Дата:** 2025-11-03


# ✅ Service Center Processor - Готов к работе!

**Дата:** 2025-11-04  
**Статус:** ✅ ИМПОРТИРОВАН И АКТИВИРОВАН

---

## 📦 Workflow создан

**ID:** `PbDKuU06H7s2Oem8`  
**Название:** Service Center Processor  
**URL:** https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8

---

## 🔗 Webhook URL

```
https://n8n.rentflow.rentals/webhook/service-center-webhook
```

**Настройте этот URL в RentProg:**
1. Откройте RentProg для филиала Service Center
2. Перейдите в Настройки → API/Webhooks
3. Укажите URL: `https://n8n.rentflow.rentals/webhook/service-center-webhook`
4. Выберите события: `car_*`, `client_*`, `booking_*`

---

## 🎯 Что делает workflow

### 1. CREATE (создание)
- Получает вебхук с новой сущностью
- Сохраняет в `events` с `company_id = 11163`
- Создаёт запись в `external_refs`

**Пример:**
```json
{
  "event": "booking_create",
  "payload": {
    "id": 506539,
    "state": "Новая",
    "total": 487.0
  }
}
```

### 2. UPDATE (обновление)
- Проверяет существование записи
- **Если EXISTS:** Обновляет данные (берёт последнее значение из `[old, new]`)
- **Если NOT EXISTS:** Запрашивает из RentProg API и создаёт

**Пример:**
```json
{
  "event": "car_update",
  "payload": {
    "company_id": [9247, 11163],
    "id": 38204
  }
}
```
→ Обновит `company_id` на `11163`

### 3. DESTROY (удаление)
- Помечает запись флагом `_deleted: true`
- **НЕ удаляет физически** из БД

**Пример:**
```json
{
  "event": "client_destroy",
  "payload": {
    "id": 381164
  }
}
```

---

## 📊 Архитектура

```
Webhook (прямой в n8n)
    ↓
Parse Webhook (Ruby hash → JSON)
    ↓
Save to Events (company_id = 11163)
    ↓
Switch by Operation
    ├─→ CREATE → Insert Entity
    ├─→ UPDATE → Check Exists
    │              ├─→ Exists → Update
    │              └─→ Not Exists → Fetch from RentProg → Insert
    └─→ DESTROY → Mark as Deleted
```

---

## ⚙️ Используемые ноды

| Node | Тип | Назначение |
|------|-----|-----------|
| **Webhook** | Trigger | Приём вебхуков |
| **Parse Webhook** | Code | Парсинг Ruby hash → JSON |
| **Save to Events** | PostgreSQL | Сохранение в `events` |
| **Switch by Operation** | Switch | Маршрутизация по `operation` |
| **Check Exists** | PostgreSQL | Проверка существования |
| **Insert Entity** | PostgreSQL | CREATE в `external_refs` |
| **Update Entity** | PostgreSQL | UPDATE в `external_refs` |
| **Get RentProg Token** | Code | Получение токена API |
| **Fetch Car/Client/Booking** | HTTP Request | Запросы к RentProg API |
| **Mark as Deleted** | PostgreSQL | Пометка как удалённой |
| **Respond Success** | Respond | Ответ вебхуку |

---

## 🧪 Тестирование

### Тест CREATE

```bash
curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "booking_create",
    "payload": {
      "id": 999999,
      "state": "Тест",
      "total": 100.0
    }
  }'
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "operation": "create",
  "entity_id": "uuid-here"
}
```

### Проверка в БД

```sql
-- Последнее событие
SELECT * FROM events 
WHERE company_id = 11163 
ORDER BY ts DESC 
LIMIT 1;

-- Созданная запись
SELECT * FROM external_refs 
WHERE system = 'rentprog' 
  AND external_id = '999999';
```

---

## 📁 Файлы

**Workflow:**
- ✅ `n8n-workflows/service-center-processor.json` - workflow definition

**Скрипты:**
- ✅ `setup/import_service_center_workflow.mjs` - импорт

**Документация:**
- ✅ `docs/SERVICE_CENTER_WORKFLOW.md` - полное описание
- ✅ `SERVICE_CENTER_WORKFLOW_COMPLETE.md` - эта сводка

---

## 🔍 Мониторинг

### Проверка выполнений

**n8n Executions:**
```
https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8/executions
```

### SQL запросы

```sql
-- События за последний час
SELECT COUNT(*) 
FROM events 
WHERE company_id = 11163 
  AND ts > NOW() - INTERVAL '1 hour';

-- Необработанные события
SELECT * FROM events 
WHERE company_id = 11163 
  AND processed = false;

-- Статистика по операциям
SELECT 
  operation,
  COUNT(*) as total
FROM events 
WHERE company_id = 11163 
GROUP BY operation;
```

---

## 🚀 Следующие шаги

1. ✅ Workflow импортирован и активирован
2. ✅ Webhook URL создан
3. ⏳ **Настроить URL в RentProg** для филиала Service Center
4. ⏳ **Протестировать** реальный вебхук
5. ⏳ **Проверить** что данные сохраняются правильно

---

## 💡 Особенности

### Парсинг Ruby hash

Workflow автоматически конвертирует Ruby hash → JSON:
```ruby
{"id"=>38204, "company_id"=>9247}
```
→
```json
{"id": 38204, "company_id": 9247}
```

### Обработка массивов [old, new]

Берёт последнее значение:
```json
{"total": [763.0, 721.0]}  → 721.0
{"company_id": [9247, 11163]} → 11163
```

### Токен RentProg

Автоматически получает `request_token` через `company_token`:
- Company token: `5y4j4gcs75o9n5s1e2vrxx4a`
- Request token: динамический, TTL ~240 сек

### Дедупликация

`ON CONFLICT` в Save to Events предотвращает дубликаты.

---

## ⚠️ Важные замечания

1. **Company ID:** Жёстко задан `11163` (service-center)
2. **Прямой webhook:** Минуя Nginx, прямо в n8n
3. **Не удаляем:** При DESTROY только помечаем флагом `_deleted: true`
4. **Auto-fetch:** При UPDATE если нет в БД - автоматически запросит из RentProg
5. **Стандартные ноды:** Максимум PostgreSQL/HTTP/Switch, минимум Code

---

## 📞 Troubleshooting

### Webhook не работает

**Проверка:**
```bash
curl https://n8n.rentflow.rentals/webhook/service-center-webhook
```

Должен вернуть 404 (это нормально для неактивного webhook).

### Не сохраняется в events

**Причина:** Ошибка парсинга payload

**Решение:** Проверьте в Executions → Parse Webhook node

### Entity not found

**Причина:** Записи нет в RentProg

**Решение:** Проверьте через RentProg API напрямую

---

## ✅ Статус

**Workflow:** ✅ Готов  
**Импорт:** ✅ Завершён  
**Активация:** ✅ Активирован  
**Webhook:** ✅ Доступен  
**Тестирование:** ⏳ Требуется  

**Workflow готов к приёму вебхуков от RentProg!**

---

**URL для настройки:**
```
https://n8n.rentflow.rentals/webhook/service-center-webhook
```



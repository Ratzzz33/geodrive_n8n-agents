# 📊 AmoCRM All Deals Parser - Полный парсер всех сделок

**Дата создания:** 2025-11-09  
**Версия:** 1.0  
**Статус:** ✅ Ready for deployment

---

## 🎯 Назначение

Парсер **всех сделок** из воронки "Первичка" AmoCRM с полными деталями и автоматическим связыванием со всеми сущностями системы:

- ✅ **Все сделки** (активные и закрытые)
- ✅ **Полные детали** каждой сделки
- ✅ **Автоматическое связывание**: Client → Booking → Car → Conversation
- ✅ **Big Data** для аналитики продаж

---

## 🏗️ Архитектура

```
AmoCRM Playwright Service (:3002)
    ↓
GET /api/deals/all (все сделки с пагинацией)
    ↓
Для каждой сделки:
    ↓
GET /api/deals/:id/extended (детали + контакты + notes + inbox)
    ↓
Извлечение данных:
    - Телефон → Client
    - custom_fields → RentProg IDs
    - scope_id → Conversation (Umnico)
    ↓
Upsert в БД:
    - clients (по phone)
    - external_refs (amocrm, rentprog)
    - conversations (по scope_id)
    - amocrm_deals (со всеми связями)
    - messages (из notes)
    ↓
Связывание:
    - bookings (через rentprog_booking_id)
    - cars (через booking.car_id или rentprog_car_id)
```

---

## 📦 Компоненты

### 1. Playwright Service (обновлен)

**Новые методы:**

#### `getAllDeals(params)`
- Получает **все сделки** воронки с автоматической пагинацией
- Включает все статусы (активные и закрытые)
- Параметры: `pipelineId`, `limit`, `updatedSince`

#### `getDealDetailsExtended(dealId)`
- Получает **расширенные детали** сделки:
  - Детали сделки с контактами
  - Примечания (notes)
  - Inbox для поиска `scope_id` (связь с Umnico)

**Новые endpoints:**
- `GET /api/deals/all` - все сделки с пагинацией
- `GET /api/deals/:id/extended` - расширенные детали

---

### 2. n8n Workflow

**Файл:** `n8n-workflows/amocrm-all-deals-parser.json`

**Триггер:** Cron (каждые 6 часов)

**Алгоритм:**

1. Получить `last_sync` timestamp из БД
2. Получить все сделки через `/api/deals/all` (с пагинацией)
3. Для каждой сделки:
   - Получить расширенные детали через `/api/deals/:id/extended`
   - Извлечь данные:
     - Телефон, имя, email из контактов
     - Custom fields (rentprog_client_id, rentprog_booking_id, rentprog_car_id)
     - scope_id из inbox
     - Статус (successful/unsuccessful/in_progress)
   - Upsert клиента по телефону
   - Добавить external_refs (amocrm, rentprog)
   - Найти/создать conversation по scope_id
   - Найти booking по rentprog_booking_id
   - Найти car по rentprog_car_id или через booking
   - Upsert сделку со всеми связями
   - Сохранить notes как messages
4. Обновить sync_state

---

## 🔗 Схема связей

```
AmoCRM Deal
    ↓
├─ Client (по phone)
│   ├─ external_refs: amocrm → contact_id
│   ├─ external_refs: rentprog → rentprog_client_id
│   └─ external_refs: umnico → phone
│
├─ Conversation (по amocrm_scope_id)
│   └─ Связь с Umnico через umnico_conversation_id
│
├─ Booking (через custom_fields.rentprog_booking_id)
│   └─ external_refs: rentprog → booking_id
│       └─ Car (через booking.car_id)
│
├─ Car (через custom_fields.rentprog_car_id или booking.car_id)
│   └─ external_refs: rentprog → car_id
│
└─ Messages (из notes)
    └─ channel='amocrm_note'
```

---

## 📊 Извлекаемые данные

### Из сделки:
- `amocrm_deal_id` - ID сделки
- `pipeline_id` - ID воронки (8580102)
- `status_id` - ID статуса
- `status_label` - Метка: successful/unsuccessful/in_progress
- `price` - Сумма сделки
- `created_at`, `updated_at`, `closed_at` - Даты
- `custom_fields` - Все кастомные поля (JSONB)

### Из контактов:
- `phone` - Телефон клиента
- `name` - Имя клиента
- `email` - Email клиента
- `contact_id` - ID контакта в AmoCRM

### Из custom_fields:
- `rentprog_client_id` - ID клиента в RentProg
- `rentprog_booking_id` - ID брони в RentProg
- `rentprog_car_id` - ID машины в RentProg
- Другие поля (динамически)

### Из inbox:
- `scope_id` - ID диалога в AmoCRM (связь с Umnico)

### Из notes:
- Все примечания сохраняются как `messages` с `channel='amocrm_note'`

---

## 🚀 Деплой

### 1. Обновить Playwright Service

```bash
# Пересобрать контейнер
docker-compose build playwright-amocrm
docker-compose restart playwright-amocrm

# Проверить новые endpoints
curl http://46.224.17.15:3002/api/deals/all?pipeline_id=8580102&limit=10
curl http://46.224.17.15:3002/api/deals/38617385/extended
```

### 2. Импортировать n8n Workflow

```bash
# Через n8n UI:
# 1. Открыть https://n8n.rentflow.rentals
# 2. Workflows → Import from File
# 3. Выбрать n8n-workflows/amocrm-all-deals-parser.json
# 4. Активировать workflow
```

### 3. Проверить синхронизацию

```sql
-- Проверить статус синхронизации
SELECT * FROM sync_state WHERE workflow_name = 'amocrm_all_deals_parser';

-- Проверить количество сделок
SELECT status_label, COUNT(*) FROM amocrm_deals GROUP BY status_label;

-- Проверить связи
SELECT 
  COUNT(*) as total_deals,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(DISTINCT conversation_id) as deals_with_chats,
  COUNT(*) FILTER (WHERE metadata->>'booking_id' IS NOT NULL) as deals_with_bookings,
  COUNT(*) FILTER (WHERE metadata->>'car_id' IS NOT NULL) as deals_with_cars
FROM amocrm_deals;
```

---

## 📈 Аналитические запросы

Создан файл `sql/amocrm_analytics_queries.sql` с 12 готовыми запросами:

1. **Полная картина клиента** - все данные из всех систем
2. **Анализ успешных vs неуспешных** - конверсия и причины отказов
3. **Связь сделок с бронями** - какие сделки привели к броням
4. **Топ клиентов по выручке** - VIP клиенты
5. **Анализ по статусам воронки** - где теряются клиенты
6. **Клиенты с активными сделками** - текущая активность
7. **Связь сделок с чатами** - влияние коммуникации на конверсию
8. **Анализ custom fields** - какие поля заполняются чаще
9. **Временной анализ** - сезонность и тренды
10. **Сделки без связей** - требующие ручной обработки
11. **Конверсия по этапам** - эффективность воронки
12. **Клиенты с множественными сделками** - лояльные клиенты

---

## 🔍 Мониторинг

### Проверка работы workflow:

```sql
-- Статус последней синхронизации
SELECT 
  workflow_name,
  last_sync_at,
  status,
  items_processed,
  items_added,
  error_message
FROM sync_state
WHERE workflow_name = 'amocrm_all_deals_parser'
ORDER BY last_sync_at DESC
LIMIT 1;
```

### Статистика данных:

```sql
-- Общая статистика
SELECT 
  'Total Deals' as metric, COUNT(*)::text as value FROM amocrm_deals
UNION ALL
SELECT 'Successful Deals', COUNT(*)::text FROM amocrm_deals WHERE status_label = 'successful'
UNION ALL
SELECT 'Unsuccessful Deals', COUNT(*)::text FROM amocrm_deals WHERE status_label = 'unsuccessful'
UNION ALL
SELECT 'Active Deals', COUNT(*)::text FROM amocrm_deals WHERE status_label = 'in_progress'
UNION ALL
SELECT 'Deals with Bookings', COUNT(*)::text FROM amocrm_deals WHERE metadata->>'booking_id' IS NOT NULL
UNION ALL
SELECT 'Deals with Cars', COUNT(*)::text FROM amocrm_deals WHERE metadata->>'car_id' IS NOT NULL
UNION ALL
SELECT 'Deals with Chats', COUNT(*)::text FROM amocrm_deals WHERE conversation_id IS NOT NULL
UNION ALL
SELECT 'Total Revenue', SUM(price)::text FROM amocrm_deals WHERE status_label = 'successful';
```

---

## ⚠️ Важные замечания

### 1. Частота синхронизации

- **Рекомендуется:** каждые 6 часов
- **Причина:** Полный парсинг всех сделок может занять время
- **Альтернатива:** Использовать `updated_since` для incremental updates

### 2. Пагинация

- Playwright Service автоматически обрабатывает пагинацию
- Лимит: 250 сделок на страницу
- Задержка: 500ms между страницами

### 3. Связывание с RentProg

- Сделки связываются с бронями через `custom_fields.rentprog_booking_id`
- Если бронь не найдена в БД, связь не создается (но сохраняется в metadata)
- Аналогично для машин через `rentprog_car_id`

### 4. Inbox для scope_id

- Inbox запрашивается для каждой сделки (может быть медленно)
- **Оптимизация:** Можно кэшировать inbox один раз в начале workflow

---

## 🔧 Troubleshooting

### Workflow не синхронизирует:

```bash
# Проверить логи Playwright Service
docker-compose logs playwright-amocrm --tail 100

# Проверить доступность endpoints
curl http://playwright-amocrm:3002/health
curl http://playwright-amocrm:3002/api/deals/all?pipeline_id=8580102&limit=5

# Проверить sync_state
SELECT * FROM sync_state WHERE workflow_name = 'amocrm_all_deals_parser';
```

### Сделки не связываются с бронями:

```sql
-- Проверить custom_fields
SELECT 
  amocrm_deal_id,
  custom_fields->>'rentprog_booking_id' as rentprog_booking_id,
  metadata->>'booking_id' as booking_uuid
FROM amocrm_deals
WHERE custom_fields->>'rentprog_booking_id' IS NOT NULL
  AND metadata->>'booking_id' IS NULL;

-- Проверить есть ли бронь в БД
SELECT er.external_id, b.id, b.status
FROM external_refs er
INNER JOIN bookings b ON er.entity_id = b.id
WHERE er.entity_type = 'booking'
  AND er.system = 'rentprog'
  AND er.external_id = '470049'; -- пример ID
```

---

## 📚 Дополнительные ресурсы

- **Playwright Service:** `services/playwright-amocrm.ts`
- **Workflow:** `n8n-workflows/amocrm-all-deals-parser.json`
- **Аналитические запросы:** `sql/amocrm_analytics_queries.sql`
- **Разведка AmoCRM:** `amocrm/RECONNAISSANCE_REPORT.md`
- **Статус интеграции:** `amocrm/STATUS_REPORT.md`

---

## ✅ Итог

**Готовность:** ✅ **Готов к использованию**

**Что работает:**
- ✅ Парсинг всех сделок (активные и закрытые)
- ✅ Полные детали каждой сделки
- ✅ Автоматическое связывание со всеми сущностями
- ✅ Сохранение примечаний как messages
- ✅ Big Data для аналитики

**Следующие шаги:**
- 🚧 Оптимизация: кэширование inbox
- 🚧 Добавление webhook от AmoCRM для real-time обновлений
- 🚧 Создание дашборда с аналитикой

---

**Последнее обновление:** 2025-11-09  
**Автор:** Jarvis AI Agent


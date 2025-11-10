# 🚀 Быстрый старт: AmoCRM All Deals Parser

**Дата:** 2025-11-09  
**Версия:** 1.0

---

## ✅ Что сделано

1. ✅ **Playwright Service** - добавлены методы `getAllDeals()` и `getDealDetailsExtended()`
2. ✅ **Endpoints** - `/api/deals/all` и `/api/deals/:id/extended`
3. ✅ **n8n Workflow** - `amocrm-all-deals-parser.json` создан
4. ✅ **SQL аналитика** - `sql/amocrm_analytics_queries.sql` с 12 запросами
5. ✅ **Документация** - полное описание в `docs/AMOCRM_ALL_DEALS_PARSER.md`

---

## 🚀 Деплой (3 шага)

### Шаг 1: Пересобрать Playwright Service

```bash
# На сервере
cd /root/geodrive_n8n-agents
docker-compose build playwright-amocrm
docker-compose restart playwright-amocrm

# Проверить новые endpoints
curl http://46.224.17.15:3002/api/deals/all?pipeline_id=8580102&limit=5
curl http://46.224.17.15:3002/api/deals/38617385/extended
```

### Шаг 2: Импортировать n8n Workflow

1. Открыть: https://n8n.rentflow.rentals
2. Workflows → Import from File
3. Выбрать: `n8n-workflows/amocrm-all-deals-parser.json`
4. Проверить credentials: "Neon PostgreSQL"
5. Активировать workflow

### Шаг 3: Проверить работу

```sql
-- Проверить статус синхронизации
SELECT * FROM sync_state 
WHERE workflow_name = 'amocrm_all_deals_parser'
ORDER BY last_sync_at DESC LIMIT 1;

-- Проверить количество сделок
SELECT status_label, COUNT(*) 
FROM amocrm_deals 
GROUP BY status_label;

-- Проверить связи
SELECT 
  COUNT(*) as total_deals,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(*) FILTER (WHERE conversation_id IS NOT NULL) as deals_with_chats,
  COUNT(*) FILTER (WHERE metadata->>'booking_id' IS NOT NULL) as deals_with_bookings,
  COUNT(*) FILTER (WHERE metadata->>'car_id' IS NOT NULL) as deals_with_cars
FROM amocrm_deals;
```

---

## 📊 Что парсится

### Из каждой сделки:
- ✅ Детали сделки (ID, статус, цена, даты)
- ✅ Контакты (телефон, имя, email)
- ✅ Custom fields (rentprog_client_id, rentprog_booking_id, rentprog_car_id)
- ✅ Примечания (notes) → сохраняются как messages
- ✅ scope_id из inbox → связь с Umnico

### Автоматическое связывание:
- ✅ Client (по phone) → external_refs (amocrm, rentprog)
- ✅ Conversation (по scope_id) → связь с Umnico
- ✅ Booking (по rentprog_booking_id) → через external_refs
- ✅ Car (через booking.car_id или rentprog_car_id)

---

## 🔍 Аналитика

Готовые SQL запросы в `sql/amocrm_analytics_queries.sql`:

1. Полная картина клиента
2. Успешные vs неуспешные сделки
3. Связь сделок с бронями
4. Топ клиентов по выручке
5. Анализ по статусам воронки
6. Клиенты с активными сделками
7. Связь сделок с чатами
8. Анализ custom fields
9. Временной анализ
10. Сделки без связей
11. Конверсия по этапам
12. Клиенты с множественными сделками

---

## ⚙️ Настройки

**Триггер:** Каждые 6 часов  
**Timeout:** 2 часа (7200 сек)  
**Incremental:** Да (использует `updated_since`)

---

## ⚠️ Важно

1. **Первый запуск** может занять время (парсит все сделки)
2. **Inbox запрашивается** для каждой сделки (может быть медленно)
3. **Связи с RentProg** создаются только если сущности есть в БД

---

## 📚 Документация

- **Полная документация:** `docs/AMOCRM_ALL_DEALS_PARSER.md`
- **Аналитические запросы:** `sql/amocrm_analytics_queries.sql`
- **Workflow:** `n8n-workflows/amocrm-all-deals-parser.json`

---

**Готово к использованию!** 🎉


# Анализ orphan *_id колонок

Источник: ep-curly-sunset-ah8bjx6h-pooler.c-3.us-east-1.aws.neon.tech
Схема: public
Всего orphan колонок: 109
- Кандидаты на FK: 7
- Внешние идентификаторы: 41
- Требуют ручного анализа: 61

## Кандидаты на добавление внешних ключей

| Таблица | Колонка | Тип | Nullable | Примечание |
| --- | --- | --- | --- | --- |
| battery_voltage_history | starline_device_id | bigint | YES | Похоже на связь с таблицей starline_devices |
| battery_voltage_alerts | starline_device_id | bigint | YES | Похоже на связь с таблицей starline_devices |
| speed_history | starline_device_id | bigint | YES | Похоже на связь с таблицей starline_devices |
| speed_violations | starline_device_id | bigint | YES | Похоже на связь с таблицей starline_devices |
| starline_events | event_id | bigint | NO | Похоже на связь с таблицей events |
| rentprog_car_states_snapshot | branch_id | uuid | YES | Похоже на связь с таблицей branches |
| gps_tracking | starline_device_id | bigint | YES | Похоже на связь с таблицей starline_devices |

### battery_voltage_history.starline_device_id

```sql
ALTER TABLE "battery_voltage_history"
  ADD CONSTRAINT "battery_voltage_history_starline_device_id_fkey"
  FOREIGN KEY ("starline_device_id") REFERENCES "starline_devices"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "battery_voltage_history" VALIDATE CONSTRAINT "battery_voltage_history_starline_device_id_fkey";
```

### battery_voltage_alerts.starline_device_id

```sql
ALTER TABLE "battery_voltage_alerts"
  ADD CONSTRAINT "battery_voltage_alerts_starline_device_id_fkey"
  FOREIGN KEY ("starline_device_id") REFERENCES "starline_devices"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "battery_voltage_alerts" VALIDATE CONSTRAINT "battery_voltage_alerts_starline_device_id_fkey";
```

### speed_history.starline_device_id

```sql
ALTER TABLE "speed_history"
  ADD CONSTRAINT "speed_history_starline_device_id_fkey"
  FOREIGN KEY ("starline_device_id") REFERENCES "starline_devices"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "speed_history" VALIDATE CONSTRAINT "speed_history_starline_device_id_fkey";
```

### speed_violations.starline_device_id

```sql
ALTER TABLE "speed_violations"
  ADD CONSTRAINT "speed_violations_starline_device_id_fkey"
  FOREIGN KEY ("starline_device_id") REFERENCES "starline_devices"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "speed_violations" VALIDATE CONSTRAINT "speed_violations_starline_device_id_fkey";
```

### starline_events.event_id

```sql
ALTER TABLE "starline_events"
  ADD CONSTRAINT "starline_events_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "starline_events" VALIDATE CONSTRAINT "starline_events_event_id_fkey";
```

### rentprog_car_states_snapshot.branch_id

```sql
ALTER TABLE "rentprog_car_states_snapshot"
  ADD CONSTRAINT "rentprog_car_states_snapshot_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "rentprog_car_states_snapshot" VALIDATE CONSTRAINT "rentprog_car_states_snapshot_branch_id_fkey";
```

### gps_tracking.starline_device_id

```sql
ALTER TABLE "gps_tracking"
  ADD CONSTRAINT "gps_tracking_starline_device_id_fkey"
  FOREIGN KEY ("starline_device_id") REFERENCES "starline_devices"(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "gps_tracking" VALIDATE CONSTRAINT "gps_tracking_starline_device_id_fkey";
```

## Кандидаты на перенос в external_refs

| Таблица | Колонка | Тип | Nullable | Примечание |
| --- | --- | --- | --- | --- |
| payments | rp_payment_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_car_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_user_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_client_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_company_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_cashbox_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_category_id | bigint | YES | Внешняя система: rentprog |
| payments | rp_subcategory_id | bigint | YES | Внешняя система: rentprog |
| clients | vseprokaty_id | text | YES | Внешняя система: vseprokaty |
| clients | tinkoff_card_id | text | YES | Внешняя система: tinkoff |
| clients | tinkoff_rebill_id | text | YES | Внешняя система: tinkoff |
| clients | amocrm_id | text | YES | Внешняя система: amocrm |
| clients | yandex_driver_id | text | YES | Внешняя система: yandex |
| entity_branch_cache | rentprog_id | text | NO | Внешняя система: rentprog |
| webhook_error_log | rentprog_id | text | YES | Внешняя система: rentprog |
| events | rentprog_id | text | YES | Внешняя система: rentprog |
| car_prices | rentprog_price_id | text | YES | Внешняя система: rentprog |
| event_links | rp_entity_id | text | YES | Внешняя система: rentprog |
| event_links | rp_company_id | integer | YES | Внешняя система: rentprog |
| amocrm_deals | amocrm_deal_id | text | NO | Внешняя система: amocrm |
| rentprog_car_states_snapshot | rentprog_id | text | NO | Внешняя система: rentprog |
| amocrm_webhook_events | amocrm_entity_id | text | NO | Внешняя система: amocrm |
| conversations | umnico_conversation_id | text | YES | Внешняя система: umnico |
| conversations | amocrm_scope_id | text | YES | Внешняя система: amocrm |
| conversations | amocrm_lead_id | text | YES | Внешняя система: amocrm |
| conversations | tg_chat_id | bigint | YES | Внешняя система: telegram |
| conversations | tg_topic_id | integer | YES | Внешняя система: telegram |
| messages | umnico_message_id | text | YES | Внешняя система: umnico |
| messages | amocrm_note_id | text | YES | Внешняя система: amocrm |
| car_price_checks | rentprog_car_id | text | NO | Внешняя система: rentprog |
| bookings | amocrm_id | text | YES | Внешняя система: amocrm |
| bookings | localrent_id | text | YES | Внешняя система: localrent |
| bookings | vseprokaty_id | text | YES | Внешняя система: vseprokaty |
| bookings | rentprog_car_id | text | YES | Внешняя система: rentprog |
| employees | tg_user_id | integer | YES | Внешняя система: telegram |
| cars | starline_id | text | YES | Внешняя система: starline |
| cars | rentprog_id | text | YES | Внешняя система: rentprog |
| cars | amocrm_id | text | YES | Внешняя система: amocrm |
| cars | ygibdd_id | text | YES | Внешняя система: yandex |
| cars | yandex_vehicle_id | text | YES | Внешняя система: yandex |
| rentprog_employees | rentprog_id | text | NO | Внешняя система: rentprog |

### payments.rp_payment_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_payment_id
FROM payments
WHERE rp_payment_id IS NOT NULL;
```

### payments.rp_car_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_car_id
FROM payments
WHERE rp_car_id IS NOT NULL;
```

### payments.rp_user_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_user_id
FROM payments
WHERE rp_user_id IS NOT NULL;
```

### payments.rp_client_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_client_id
FROM payments
WHERE rp_client_id IS NOT NULL;
```

### payments.rp_company_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_company_id
FROM payments
WHERE rp_company_id IS NOT NULL;
```

### payments.rp_cashbox_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_cashbox_id
FROM payments
WHERE rp_cashbox_id IS NOT NULL;
```

### payments.rp_category_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_category_id
FROM payments
WHERE rp_category_id IS NOT NULL;
```

### payments.rp_subcategory_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'payment', id, 'rentprog', rp_subcategory_id
FROM payments
WHERE rp_subcategory_id IS NOT NULL;
```

### clients.vseprokaty_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'client', id, 'vseprokaty', vseprokaty_id
FROM clients
WHERE vseprokaty_id IS NOT NULL;
```

### clients.tinkoff_card_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'client', id, 'tinkoff', tinkoff_card_id
FROM clients
WHERE tinkoff_card_id IS NOT NULL;
```

### clients.tinkoff_rebill_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'client', id, 'tinkoff', tinkoff_rebill_id
FROM clients
WHERE tinkoff_rebill_id IS NOT NULL;
```

### clients.amocrm_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'client', id, 'amocrm', amocrm_id
FROM clients
WHERE amocrm_id IS NOT NULL;
```

### clients.yandex_driver_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'client', id, 'yandex', yandex_driver_id
FROM clients
WHERE yandex_driver_id IS NOT NULL;
```

### entity_branch_cache.rentprog_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'entity_branch_cach', id, 'rentprog', rentprog_id
FROM entity_branch_cache
WHERE rentprog_id IS NOT NULL;
```

### webhook_error_log.rentprog_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'webhook_error_lo', id, 'rentprog', rentprog_id
FROM webhook_error_log
WHERE rentprog_id IS NOT NULL;
```

### events.rentprog_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'event', id, 'rentprog', rentprog_id
FROM events
WHERE rentprog_id IS NOT NULL;
```

### car_prices.rentprog_price_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car_price', id, 'rentprog', rentprog_price_id
FROM car_prices
WHERE rentprog_price_id IS NOT NULL;
```

### event_links.rp_entity_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'event_link', id, 'rentprog', rp_entity_id
FROM event_links
WHERE rp_entity_id IS NOT NULL;
```

### event_links.rp_company_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'event_link', id, 'rentprog', rp_company_id
FROM event_links
WHERE rp_company_id IS NOT NULL;
```

### amocrm_deals.amocrm_deal_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'amocrm_deal', id, 'amocrm', amocrm_deal_id
FROM amocrm_deals
WHERE amocrm_deal_id IS NOT NULL;
```

### rentprog_car_states_snapshot.rentprog_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'rentprog_car_states_snapsho', id, 'rentprog', rentprog_id
FROM rentprog_car_states_snapshot
WHERE rentprog_id IS NOT NULL;
```

### amocrm_webhook_events.amocrm_entity_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'amocrm_webhook_event', id, 'amocrm', amocrm_entity_id
FROM amocrm_webhook_events
WHERE amocrm_entity_id IS NOT NULL;
```

### conversations.umnico_conversation_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'conversation', id, 'umnico', umnico_conversation_id
FROM conversations
WHERE umnico_conversation_id IS NOT NULL;
```

### conversations.amocrm_scope_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'conversation', id, 'amocrm', amocrm_scope_id
FROM conversations
WHERE amocrm_scope_id IS NOT NULL;
```

### conversations.amocrm_lead_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'conversation', id, 'amocrm', amocrm_lead_id
FROM conversations
WHERE amocrm_lead_id IS NOT NULL;
```

### conversations.tg_chat_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'conversation', id, 'telegram', tg_chat_id
FROM conversations
WHERE tg_chat_id IS NOT NULL;
```

### conversations.tg_topic_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'conversation', id, 'telegram', tg_topic_id
FROM conversations
WHERE tg_topic_id IS NOT NULL;
```

### messages.umnico_message_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'message', id, 'umnico', umnico_message_id
FROM messages
WHERE umnico_message_id IS NOT NULL;
```

### messages.amocrm_note_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'message', id, 'amocrm', amocrm_note_id
FROM messages
WHERE amocrm_note_id IS NOT NULL;
```

### car_price_checks.rentprog_car_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car_price_check', id, 'rentprog', rentprog_car_id
FROM car_price_checks
WHERE rentprog_car_id IS NOT NULL;
```

### bookings.amocrm_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'booking', id, 'amocrm', amocrm_id
FROM bookings
WHERE amocrm_id IS NOT NULL;
```

### bookings.localrent_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'booking', id, 'localrent', localrent_id
FROM bookings
WHERE localrent_id IS NOT NULL;
```

### bookings.vseprokaty_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'booking', id, 'vseprokaty', vseprokaty_id
FROM bookings
WHERE vseprokaty_id IS NOT NULL;
```

### bookings.rentprog_car_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'booking', id, 'rentprog', rentprog_car_id
FROM bookings
WHERE rentprog_car_id IS NOT NULL;
```

### employees.tg_user_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'employee', id, 'telegram', tg_user_id
FROM employees
WHERE tg_user_id IS NOT NULL;
```

### cars.starline_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car', id, 'starline', starline_id
FROM cars
WHERE starline_id IS NOT NULL;
```

### cars.rentprog_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car', id, 'rentprog', rentprog_id
FROM cars
WHERE rentprog_id IS NOT NULL;
```

### cars.amocrm_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car', id, 'amocrm', amocrm_id
FROM cars
WHERE amocrm_id IS NOT NULL;
```

### cars.ygibdd_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car', id, 'yandex', ygibdd_id
FROM cars
WHERE ygibdd_id IS NOT NULL;
```

### cars.yandex_vehicle_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'car', id, 'yandex', yandex_vehicle_id
FROM cars
WHERE yandex_vehicle_id IS NOT NULL;
```

### rentprog_employees.rentprog_id

```sql
-- Пример вставки во external_refs
INSERT INTO external_refs (entity_type, entity_id, system, external_id)
SELECT 'rentprog_employee', id, 'rentprog', rentprog_id
FROM rentprog_employees
WHERE rentprog_id IS NOT NULL;
```

## Требуют ручного решения

| Таблица | Колонка | Тип | Nullable | Примечание |
| --- | --- | --- | --- | --- |
| payments | debt_id | bigint | YES | Требуется ручная проверка |
| payments | agent_id | bigint | YES | Требуется ручная проверка |
| payments | investor_id | bigint | YES | Требуется ручная проверка |
| payments | contractor_id | bigint | YES | Требуется ручная проверка |
| payments | payment_id | bigint | YES | Требуется ручная проверка |
| external_refs | entity_id | uuid | NO | Требуется ручная проверка |
| external_refs | external_id | text | NO | Требуется ручная проверка |
| clients | company_id | integer | YES | Требуется ручная проверка |
| clients | user_id | text | YES | Требуется ручная проверка |
| clients | account_id | text | YES | Требуется ручная проверка |
| clients | main_company_id | bigint | YES | Требуется ручная проверка |
| entity_branch_cache | company_id | integer | YES | Требуется ручная проверка |
| history | operation_id | text | YES | Требуется ручная проверка |
| history | entity_id | text | YES | Требуется ручная проверка |
| webhook_error_log | request_id | text | YES | Требуется ручная проверка |
| webhook_error_log | company_id | integer | YES | Требуется ручная проверка |
| branches | company_id | integer | YES | Требуется ручная проверка |
| events | ext_id | text | YES | Требуется ручная проверка |
| events | company_id | integer | YES | Требуется ручная проверка |
| events | execution_id | text | YES | Требуется ручная проверка |
| car_prices | season_id | integer | YES | Требуется ручная проверка |
| event_links | entity_id | uuid | YES | Требуется ручная проверка |
| amocrm_deals | pipeline_id | integer | YES | Требуется ручная проверка |
| amocrm_deals | status_id | integer | YES | Требуется ручная проверка |
| rentprog_car_states_snapshot | company_id | text | YES | Требуется ручная проверка |
| rentprog_car_states_snapshot | investor_id | bigint | YES | Требуется ручная проверка |
| entity_timeline | entity_id | uuid | NO | Требуется ручная проверка |
| entity_timeline | source_id | text | YES | Требуется ручная проверка |
| amocrm_webhook_events | account_id | integer | YES | Требуется ручная проверка |
| starline_devices | device_id | bigint | NO | Требуется ручная проверка |
| error_analysis_cache | workflow_id | text | YES | Требуется ручная проверка |
| conversations | assigned_to_user_id | integer | YES | Требуется ручная проверка |
| sync_state | last_processed_id | text | YES | Требуется ручная проверка |
| task_links | entity_id | uuid | NO | Требуется ручная проверка |
| bookings | sign_id | text | YES | Требуется ручная проверка |
| bookings | user_id | text | YES | Требуется ручная проверка |
| bookings | agent_id | text | YES | Требуется ручная проверка |
| bookings | price_id | text | YES | Требуется ручная проверка |
| bookings | tariff_id | text | YES | Требуется ручная проверка |
| bookings | company_id | bigint | YES | Требуется ручная проверка |
| bookings | end_worker_id | text | YES | Требуется ручная проверка |
| bookings | end_location_id | text | YES | Требуется ручная проверка |
| bookings | location_end_id | text | YES | Требуется ручная проверка |
| bookings | main_company_id | bigint | YES | Требуется ручная проверка |
| bookings | start_worker_id | text | YES | Требуется ручная проверка |
| bookings | location_start_id | text | YES | Требуется ручная проверка |
| bookings | start_location_id | text | YES | Требуется ручная проверка |
| employees | task_chat_id | text | YES | Требуется ручная проверка |
| cars | company_id | integer | YES | Требуется ручная проверка |
| cars | user_id | text | YES | Требуется ручная проверка |
| cars | traccar_id | text | YES | Требуется ручная проверка |
| cars | car_mark_id | bigint | YES | Требуется ручная проверка |
| cars | investor_id | bigint | YES | Требуется ручная проверка |
| cars | car_model_id | bigint | YES | Требуется ручная проверка |
| cars | main_company_id | bigint | YES | Требуется ручная проверка |
| cars | car_generation_id | bigint | YES | Требуется ручная проверка |
| cars | car_complectation_id | text | YES | Требуется ручная проверка |
| cars | car_configuration_id | bigint | YES | Требуется ручная проверка |
| rentprog_employees | company_id | integer | YES | Требуется ручная проверка |
| rentprog_employees | account_id | integer | YES | Требуется ручная проверка |
| rentprog_employees | traccar_id | integer | YES | Требуется ручная проверка |

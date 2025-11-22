# План нормализации БД (ветка ep-curly-sunset)

## 1. База для анализа
- Отчёт `db/db_inventory_curly_branch.md` сгенерирован скриптом `setup/db_inventory_report.mjs` (через `setup/run_db_inventory.ps1`), источник: `ep-curly-sunset-ah8bjx6h-pooler`.
- Все таблицы содержат структуру production, но данные обнулены — можно безопасно экспериментировать.
- Основные блоки без внешних ключей: `bookings`, `cars`, `clients`, `payments`, `rentprog_*`, `starline_*`, `conversations/messages`.

## 2. Кандидаты на консолидацию
- **Cars stack:** `cars`, `rentprog_car_states_snapshot`, `cars_with_investors`, `gps_tracking_with_labels`, `starline_devices_with_cars`. План — оставить `cars` как primary, остальные перевести в представления или таблицы привязок (через `external_refs`).
- **Bookings & payments:** десятки `*_id` полей без FK. Требуется нормализовать ссылки на `clients`, `cars`, `employees`, `branches`. Внешние системы (`rentprog_*`, `amocrm_*`) должны уходить в `external_refs` или отдельные lookup-таблицы.
- **Clients & conversations:** `conversations`/`messages` держат Umnico/AmoCRM/TG идентификаторы без связей. Нужно завести справочник источников + FK на `clients`/`employees`.
- **RentProg snapshots:** `rentprog_car_states_snapshot`, `rentprog_employees`, `entity_branch_cache` — определить, какие из них могут быть заменены на materialized view + `external_refs`.

## 3. Принципы нормализации
1. **Внутренние сущности (UUID)** — добавляем FK (cars → branches, bookings → clients и т.д.). Перед добавлением — чистка/дедуп через временные запросы.
2. **Внешние идентификаторы** — переносим в `external_refs` (`entity_type`, `system`, `external_id`). Табличные поля `rentprog_id`, `amocrm_id`, `starline_id` остаются только если используются в критичных индексах; иначе удаляются после миграций.
3. **Снимки/истории** — перевод в отдельные схемы (`history`, `snapshots`) или materialized views. Обновление через cron/workflow вместо ручного копирования.
4. **Сопоставительные таблицы** — оставить для N:M (например, `cars_with_investors`), но добавить FK + уникальные ограничения.

## 4. Пошаговый план
1. **Инвентаризация (готово):** `db_inventory_curly_branch.md`.
2. **Проверки данных:** скрипты на Node/SQL для поиска:
   - дубликатов по ключам (например, `cars.plate`, `clients.phone`),
   - записей с `*_id`, указывающих на несуществующие сущности,
   - расхождений между `external_refs` и реальными таблицами.
3. **Миграции ветки:**
   - Создать временные таблицы для чистки (`_tmp`), заполнить данными и сравнить.
   - Добавить FK (по одному домену за раз) с `NOT VALID`, затем `VALIDATE CONSTRAINT`.
   - Вынести внешние идентификаторы в `external_refs` (см. `setup/backfill_external_refs_from_columns.mjs` + `setup/run_backfill_external_refs.ps1`), после чего удалить столбцы или оставить как view.
4. **Тестирование:**
   - Прогнать основные сервисы (Jarvis API, n8n workflows) против ветки.
   - Проверить миграции rollback через `BEGIN; ...; ROLLBACK;`.
5. **Подготовка к prod:**
   - Сформировать миграции в `migrations/` (drizzle/sql) с чётким порядком.
   - Добавить инструкции деплоя и отката (pg_dump перед применением).
   - После проверки — применить на prod через тот же `setup/run_db_inventory.ps1` для повторного отчёта.

## 5. Откат
- Перед каждой крупной миграцией: `pg_dump --schema-only` и `pg_dump` для ветки, хранить архив рядом с миграцией.
- Использовать транзакционные миграции (`BEGIN; ...; COMMIT;`). В случае ошибки — `ROLLBACK` и повторный запуск.
- В prod — строгое окно, проверка `external_refs` консистентности и наличие резервной копии Neon branch.

Этот план фиксирует шаги для «смелой» нормализации в ветке ep-curly-sunset и подготовку безопасного переноса на production.


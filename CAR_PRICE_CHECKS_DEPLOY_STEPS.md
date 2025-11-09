# 🚀 Деплой системы проверки цен - Пошаговая инструкция

**Дата:** 2025-11-09  
**Статус:** ✅ Готово к деплою на сервер

---

## ✅ Что уже сделано локально

1. ✅ Создан скрипт `setup/check_cars_without_prices.mjs`
2. ✅ Добавлены API endpoints в `src/api/index.ts`
3. ✅ Создана SQL миграция `setup/migrations/013_create_car_price_checks_table.sql`
4. ✅ Создан n8n workflow `n8n-workflows/check-cars-without-prices.json`
5. ✅ Миграция БД выполнена успешно (таблица, view, функции)
6. ✅ TypeScript код исправлен и готов к сборке

---

## 🔧 Деплой на сервер

### Шаг 1: Коммит и пуш изменений

```bash
# Локально
cd C:\Users\33pok\geodrive_n8n-agents

git add .
git commit -m "Добавлена система проверки автомобилей без цен на сезоны

- Скрипт check_cars_without_prices.mjs для проверки через API
- API endpoints /check-cars-without-prices
- SQL миграция 013 для таблицы car_price_checks
- n8n workflow для автоматической проверки
- Документация и quick start guide"

git push origin main
```

### Шаг 2: Обновление на сервере

```bash
# SSH на сервер
ssh root@46.224.17.15
# Password: Geodrive2024SecurePass

# Переход в директорию проекта
cd /root/geodrive_n8n-agents

# Обновление кода
git pull origin main

# Установка зависимостей (если нужно)
npm install

# Сборка TypeScript (API уже скомпилирован)
npm run build

# Перезапуск API
docker compose restart jarvis-api

# Проверка что API запустился
docker logs jarvis-api --tail 50
```

### Шаг 3: Проверка миграции БД

```bash
# На сервере
cd /root/geodrive_n8n-agents

# Проверка что миграция уже выполнена
node setup/check_migration_013.mjs

# Если не выполнена - выполнить
# psql $DATABASE_URL -f setup/migrations/013_create_car_price_checks_table.sql
```

**Ожидаемый вывод:**
```
✅ Таблица car_price_checks: создана
✅ View unresolved_price_issues: создан
✅ Функции:
   - get_price_issues_stats
   - resolve_price_issue
✅ Индексы: 8
✅ Миграция 013 выполнена успешно!
```

### Шаг 4: Тест скрипта проверки

```bash
# На сервере (токены уже в .env)
node setup/test_check_single_branch.mjs
```

**Ожидаемый вывод:**
```
🧪 Тестирую проверку филиала tbilisi...

[tbilisi] Получение request token...
[tbilisi] Request token получен, истекает: 2025-11-09T12:34:56.000Z
[tbilisi] Получение списка автомобилей...
[tbilisi] Найдено автомобилей: 50
[tbilisi] Проверка цен для 50 автомобилей...
...
✅ Тест завершен успешно!
```

### Шаг 5: Тест API endpoint

```bash
# Из локальной машины или на сервере
curl http://46.224.17.15:3000/check-cars-without-prices/tbilisi

# Должен вернуть JSON с результатами
```

**Ожидаемый ответ:**
```json
{
  "branch": "tbilisi",
  "total": 50,
  "checked": 50,
  "withoutPrices": 5,
  "withPrices": 45,
  "errors": 0,
  "cars": [...]
}
```

---

## 🔄 Импорт n8n workflow

### Вариант 1: Через UI (рекомендуется)

1. Открыть https://n8n.rentflow.rentals
2. Workflows → Import from File
3. Выбрать файл `n8n-workflows/check-cars-without-prices.json`
4. Проверить credentials:
   - ✅ Telegram Bot (Alerts) - должен быть настроен
   - ✅ Neon PostgreSQL - должен быть настроен
5. Проверить переменные окружения:
   - ✅ `TELEGRAM_ALERT_CHAT_ID` - должен быть установлен
6. Сохранить workflow
7. **Активировать** workflow (Toggle "Active")

### Вариант 2: Через API (PowerShell)

```powershell
# Локально
cd C:\Users\33pok\geodrive_n8n-agents

powershell -ExecutionPolicy Bypass -File setup/import_single_workflow.ps1 -WorkflowFile "n8n-workflows/check-cars-without-prices.json"
```

---

## ✅ Проверка работоспособности

### 1. Проверка API

```bash
# Один филиал
curl http://46.224.17.15:3000/check-cars-without-prices/tbilisi

# Все филиалы
curl http://46.224.17.15:3000/check-cars-without-prices
```

### 2. Проверка БД

```sql
-- Проверка нерешенных проблем
SELECT * FROM unresolved_price_issues LIMIT 10;

-- Статистика
SELECT * FROM get_price_issues_stats();

-- История проверок
SELECT 
  branch, 
  COUNT(*) as checks,
  MAX(checked_at) as last_check
FROM car_price_checks
GROUP BY branch;
```

### 3. Ручной запуск n8n workflow

1. Открыть https://n8n.rentflow.rentals
2. Workflows → Check Cars Without Prices
3. Нажать "Execute Workflow"
4. Проверить Telegram - должно прийти уведомление (если есть проблемы)

### 4. Проверка автоматического запуска

Workflow настроен на запуск **каждый день в 4:00** (UTC).

Для проверки:
1. Подождать до 4:00 или изменить время в Schedule Trigger
2. Проверить Executions в n8n UI
3. Проверить Telegram уведомления

---

## 📊 Мониторинг

### Логи API

```bash
# На сервере
docker logs jarvis-api --tail 100 -f
```

Искать строки:
```
[Price Check] Starting check...
[Price Check] Completed for tbilisi: X/Y без цен
```

### Логи n8n

```bash
# На сервере
docker logs n8n --tail 100 -f
```

Искать:
- Executions для workflow "Check Cars Without Prices"
- Ошибки при отправке Telegram

### БД мониторинг

```sql
-- Последние 10 проверок
SELECT 
  branch,
  car_number,
  seasons_count,
  prices_count,
  checked_at,
  resolved
FROM car_price_checks
ORDER BY checked_at DESC
LIMIT 10;

-- Проблемы за последние 24 часа
SELECT 
  branch,
  COUNT(*) as issues
FROM car_price_checks
WHERE checked_at > NOW() - INTERVAL '24 hours'
  AND resolved = FALSE
GROUP BY branch;
```

---

## 🐛 Troubleshooting

### Ошибка: "invalid credentials"

**Причина:** Токены RentProg устарели или неверные

**Решение:**
```bash
# Проверить токены в .env на сервере
grep RENTPROG_BRANCH_KEYS /root/geodrive_n8n-agents/.env

# Или
grep RENTPROG_TOKEN /root/geodrive_n8n-agents/.env
```

### Ошибка: "Car not found in database"

**Причина:** Автомобиль не синхронизирован в нашу БД

**Решение:**
```bash
# Запустить синхронизацию автомобилей
curl http://46.224.17.15:3000/sync-prices/tbilisi
```

### n8n workflow не запускается

**Проверить:**
1. Workflow активен (Toggle "Active")
2. Credentials корректны (Telegram, PostgreSQL)
3. Переменные окружения установлены (`TELEGRAM_ALERT_CHAT_ID`)
4. API доступен (`curl http://46.224.17.15:3000/check-cars-without-prices/tbilisi`)

### Нет Telegram уведомлений

**Проверить:**
1. Bot token корректный (в credentials)
2. Chat ID правильный (`TELEGRAM_ALERT_CHAT_ID`)
3. Бот добавлен в чат
4. Есть проблемные авто (иначе уведомление не отправляется)

---

## 📝 Следующие шаги

После успешного деплоя:

1. ✅ Подождать первый автоматический запуск (4:00 UTC)
2. ✅ Проверить Telegram уведомления
3. ✅ Проверить данные в БД
4. ✅ При обнаружении проблем - добавить цены в RentProg
5. ✅ Отметить проблемы как решенные в БД

---

## 🎉 Готово!

Система полностью развернута и готова к работе.

**Автоматические проверки:** Каждый день в 4:00 UTC  
**Уведомления:** Telegram при обнаружении проблем  
**Хранение:** БД PostgreSQL (Neon)  
**Мониторинг:** n8n UI, БД, API logs

---

**Документация:**
- [CAR_PRICE_CHECKS.md](docs/CAR_PRICE_CHECKS.md) - Полная документация
- [CAR_PRICE_CHECKS_QUICK_START.md](CAR_PRICE_CHECKS_QUICK_START.md) - Быстрый старт
- [CAR_PRICE_CHECKS_COMPLETE.md](CAR_PRICE_CHECKS_COMPLETE.md) - Итоговое резюме


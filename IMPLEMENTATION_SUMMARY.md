# 🎯 Итоговая реализация: Система парсинга UI событий RentProg

**Дата:** 2025-11-05  
**Статус:** ✅ Готово к тестированию  
**Версия:** 1.0

---

## 📋 Что реализовано

### ✅ 1. Документация обновлена

- `ARCHITECTURE.md` - добавлено описание UI Events workflows
- `STRUCTURE.md` - расширены таблицы `employees` и добавлена `event_processing_log`
- `docs/UI_EVENTS_SYSTEM.md` - полная документация новой системы

### ✅ 2. SQL миграции созданы

**`setup/migrations/005_add_employee_cash_fields.sql`**
- Добавлены поля кассы в `employees`: `cash_gel`, `cash_usd`, `cash_eur`
- Timestamps: `cash_last_updated`, `cash_last_synced`
- Поле для Telegram групп задач: `task_chat_id`
- Индексы для оптимизации

**`setup/migrations/006_create_event_processing_log.sql`**
- Таблица `event_processing_log` для дедупликации
- Hash-based уникальность
- JSONB для данных событий и результатов обработки
- Функция автоочистки старых записей

### ✅ 3. TypeScript сервисы

**`src/services/eventParsers.ts`** - Парсеры событий
- `parseEvent()` - главная функция парсинга
- `classifyEvent()` - классификация по типу
- `parsePaymentEvent()` - кассовые операции
- `parseServiceEvent()` - техобслуживание
- `parseMileageEvent()` - изменение пробега
- `parseBookingStatusEvent()` - статусы броней
- `parseDateFromRussian()` - парсинг русских дат
- `createEventHash()` - хеш для дедупликации

**`src/services/cashRegisterService.ts`** - Управление кассами
- `updateEmployeeCash()` - обновить кассу
- `getEmployeeCash()` - получить кассу
- `reconcileCash()` - сверить с RentProg UI
- `initializeEmployeeCash()` - инициализация
- `getAllEmployeesWithCash()` - получить всех
- `formatCashDiscrepancyAlert()` - форматирование алертов

**`src/services/taskService.ts`** - Интеграция с задачами
- `createTask()` - создать задачу
- `updateTaskStatus()` - обновить статус
- `linkTaskToEntity()` - связать с сущностью
- `findTaskByExternalRef()` - найти по external_id
- `handleMaintenanceCompleted()` - обработка завершения ТО

### ✅ 4. API Endpoint

**`src/api/routes/processUIEvent.ts`**

**POST /process-ui-event**
- Прием спарсенных событий из n8n
- Дедупликация через hash
- Классификация событий
- Обработчики по типам:
  - `handleCashOperation()` - кассовые операции
  - `handleMaintenance()` - техобслуживание (с интеграцией задач)
  - `handleMileageUpdate()` - пробег
  - `handleBookingStatus()` - статусы броней
- Запись в `event_processing_log`

### ✅ 5. n8n Workflows

**`n8n-workflows/rentprog-events-scraper.json`**
- **Триггер:** Cron каждые 5 минут
- **Действие:** Playwright парсинг 4 филиалов параллельно
- **Обработка:** Вызов Jarvis API `/process-ui-event`
- **Telegram Alert:** При ошибках в чат `-5004140602`

**`n8n-workflows/cash-register-reconciliation.json`**
- **Триггер:** Cron ежедневно в 04:00 Tbilisi
- **Действие:** Playwright парсинг касс сотрудников
- **Сверка:** Сравнение с расчетными значениями
- **Автоисправление:** RentProg UI = источник правды
- **Telegram Alert:** При расхождениях

### ✅ 6. Вспомогательные скрипты

**`setup/run_migrations.mjs`**
- Автоматическое применение всех миграций из `setup/migrations/`
- Сортировка по номерам (001_, 002_, ...)
- Обработка ошибок

**`setup/test_event_parsers.mjs`**
- Unit-тесты для парсеров событий
- 5 тестовых случаев (касса, ТО, пробег, бронь)
- Проверка классификации и извлечения сущностей

---

## 🚀 Запуск системы

### Шаг 1: Применить миграции БД

```bash
cd /root/geodrive_n8n-agents
node setup/run_migrations.mjs
```

**Результат:**
```
✅ 005_add_employee_cash_fields.sql applied successfully
✅ 006_create_event_processing_log.sql applied successfully
✅ All migrations applied successfully!
```

### Шаг 2: Запустить Jarvis API

```bash
npm install
npm run build
pm2 start dist/index.js --name jarvis-api
pm2 logs jarvis-api
```

**Проверка:**
```bash
curl http://46.224.17.15:3000/
# Должен вернуть: {"ok":true,"message":"Jarvis API is running"}
```

### Шаг 3: Импортировать n8n workflows

```powershell
# На локальной машине
cd C:\Users\33pok\geodrive_n8n-agents

# Импорт парсера событий
.\setup\import_workflow_working.ps1 -File "n8n-workflows\rentprog-events-scraper.json"

# Импорт ночной сверки
.\setup\import_workflow_working.ps1 -File "n8n-workflows\cash-register-reconciliation.json"
```

### Шаг 4: Настроить credentials в n8n

1. Откройте: `https://n8n.rentflow.rentals`
2. Settings → Credentials
3. Добавьте RentProg UI доступы (4 филиала):

```json
{
  "name": "RentProg UI - Tbilisi",
  "type": "custom",
  "data": {
    "login": "ВАШЕ_ИМЯ_ПОЛЬЗОВАТЕЛЯ",
    "password": "ВАШ_ПАРОЛЬ"
  }
}
```

Повторить для `batumi`, `kutaisi`, `service-center`.

### Шаг 5: Обновить Playwright скрипты

После получения реальных credentials:

1. Откройте workflow "RentProg Events Scraper"
2. Найдите node "Scrape Events (Playwright)"
3. Обновите объект `credentials` с реальными логинами/паролями
4. **ВАЖНО:** Обновите селекторы DOM после тестирования на реальном UI:
   - `[name="email"]` → правильный селектор поля логина
   - `[name="password"]` → правильный селектор поля пароля
   - `table tbody tr` → селектор строк таблицы событий

То же самое для "Cash Register Reconciliation" workflow.

### Шаг 6: Активировать workflows

```
https://n8n.rentflow.rentals/workflows
→ RentProg Events Scraper → Active: ON
→ Cash Register Reconciliation → Active: ON
```

---

## 🧪 Тестирование

### 1. Проверить парсеры событий

```bash
node setup/test_event_parsers.mjs
```

**Ожидаемый результат:**
```
✅ PASS (5/5 tests)
```

### 2. Проверить миграции

```sql
-- Проверить поля кассы в employees
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
  AND column_name LIKE 'cash%';

-- Должно вернуть: cash_gel, cash_usd, cash_eur, cash_last_updated, cash_last_synced

-- Проверить таблицу event_processing_log
SELECT COUNT(*) FROM event_processing_log;
```

### 3. Тестовый запрос к API

```bash
curl -X POST http://46.224.17.15:3000/process-ui-event \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-11-05T18:46:00Z",
    "branch": "tbilisi",
    "rawDescription": "Neverov Leonid создал платёж №1834894, расход наличными 60.0GEL"
  }'
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "eventType": "cash_operation",
  "processingResult": {
    "handled": true,
    "employeeId": "uuid...",
    "operation": "subtract",
    "amount": 60.0,
    "currency": "GEL"
  }
}
```

### 4. Мануальный запуск workflow

1. Откройте: `https://n8n.rentflow.rentals/workflow/[ID]`
2. Нажмите кнопку "Execute Workflow"
3. Проверьте executions: `https://n8n.rentflow.rentals/executions`

---

## 📊 Мониторинг

### Проверка обработанных событий

```sql
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(processed_at) as last_processed
FROM event_processing_log
GROUP BY event_type
ORDER BY count DESC;
```

### Проверка касс сотрудников

```sql
SELECT 
  name,
  cash_gel,
  cash_usd,
  cash_eur,
  cash_last_updated,
  cash_last_synced
FROM employees
WHERE role != 'inactive'
ORDER BY cash_last_updated DESC NULLS LAST;
```

### Логи Jarvis API

```bash
pm2 logs jarvis-api --lines 50
```

### Логи n8n workflows

```
https://n8n.rentflow.rentals/executions
→ Filter by workflow: "RentProg Events Scraper"
→ Check last executions
```

---

## ⚠️ Важные замечания

### 1. Первый запуск (инициализация касс)

При первом запуске ночной сверки (04:00) произойдет **инициализация касс** из RentProg UI. Это нормально и не вызовет алертов.

### 2. Credentials безопасность

**НЕ КОММИТИТЬ** credentials в репозиторий!
- Используйте n8n Credentials (зашифрованы)
- Или переменные окружения на сервере

### 3. Селекторы Playwright

Все селекторы в Playwright скриптах (`[data-field="cash-gel"]`, `table tbody tr`) - **примерные**.  
После получения доступа к UI нужно обновить на реальные селекторы.

### 4. Расхождения касс

При обнаружении расхождения кассы:
- **RentProg UI всегда прав**
- Автоматическое исправление в БД
- Telegram Alert в чат `-5004140602`

### 5. Rate Limiting

RentProg API имеет rate limit: **60 GET/мин**  
Playwright парсинг UI этого лимита не касается.

---

## ✅ Credentials получены!

Все credentials для 4 филиалов предоставлены. См. файл `docs/CREDENTIALS_SETUP.md`

### Следующие шаги

#### 1. Настроить credentials в n8n

См. подробную инструкцию: `docs/CREDENTIALS_SETUP.md`

**Быстрая инструкция:**
1. Откройте `https://n8n.rentflow.rentals`
2. Settings → Credentials → Add Credential → Generic Credential
3. Создайте 4 credentials (по одному на филиал)
4. Скопируйте логины/пароли из `docs/CREDENTIALS_SETUP.md`

#### 2. Проверка и обновление селекторов

После получения доступа:
1. Открыть https://web.rentprog.ru/tbilisi/login
2. Проверить селекторы полей логина/пароля (DevTools)
3. Открыть https://web.rentprog.ru/tbilisi/events
4. Проверить селекторы таблицы событий
5. Открыть https://web.rentprog.ru/tbilisi/company/employees
6. Проверить селекторы полей кассы сотрудников

### 3. Тестирование на реальных данных

После настройки credentials:
1. Запустить workflow "RentProg Events Scraper" вручную
2. Проверить, что события извлекаются корректно
3. Проверить, что API обрабатывает события
4. Проверить, что кассы обновляются в БД

---

## 📚 Дополнительная документация

- [docs/UI_EVENTS_SYSTEM.md](./docs/UI_EVENTS_SYSTEM.md) - Полная документация системы
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура
- [STRUCTURE.md](./STRUCTURE.md) - Структура данных
- [AGENTS.md](./AGENTS.md) - Список агентов

---

## ✅ Чек-лист готовности

- [x] SQL миграции созданы
- [x] TypeScript сервисы реализованы
- [x] API endpoint создан
- [x] n8n workflows созданы
- [x] Документация написана
- [x] Тесты парсеров подготовлены
- [x] Credentials от пользователя получены ✅
- [ ] Автотест селекторов запущен (`node setup/test_rentprog_login.mjs`)
- [ ] Селекторы Playwright обновлены в workflows
- [ ] Миграции применены на проде
- [ ] Jarvis API запущен как сервис
- [ ] Workflows импортированы и активированы
- [ ] Тестирование на реальных данных

---

**Статус:** ✅ Готово к тестированию после получения credentials  
**Следующий шаг:** Получить credentials и обновить Playwright селекторы

**Автор:** Claude Sonnet 4.5  
**Дата:** 2025-11-05


# 🚀 Быстрый старт: Система парсинга UI событий

**Дата:** 2025-11-05  
**Время до запуска:** ~30 минут

---

## ✅ Предварительные требования

- [x] Credentials получены (4 филиала)
- [x] Доступ к серверу (SSH)
- [x] Доступ к n8n UI (`https://n8n.rentflow.rentals`)
- [x] Node.js установлен на сервере

---

## 📋 Шаг 1: Применить миграции БД (5 минут)

```bash
# На сервере
cd /root/geodrive_n8n-agents
node setup/run_migrations.mjs
```

**Ожидаемый результат:**
```
✅ 005_add_employee_cash_fields.sql applied successfully
✅ 006_create_event_processing_log.sql applied successfully
✅ All migrations applied successfully!
```

**Проверка:**
```sql
-- В Neon Console
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'employees' AND column_name LIKE 'cash%';

-- Должно вернуть: cash_gel, cash_usd, cash_eur
```

---

## 🔧 Шаг 2: Настроить credentials в n8n (10 минут)

### 2.1 Открыть n8n

`https://n8n.rentflow.rentals` → Settings → Credentials

### 2.2 Создать 4 Generic Credentials

**Для каждого филиала создайте credential:**

#### Service Center
- Name: `RentProg UI - Service Center`
- Type: Generic Credential
- Fields:
  - `login`: `sofia2020eliseeva@gmail.com`
  - `password`: `x2tn7hks`
  - `branch`: `service-center`

#### Tbilisi
- Name: `RentProg UI - Tbilisi`
- Type: Generic Credential
- Fields:
  - `login`: `eliseevaleksei32@gmail.com`
  - `password`: `a0babuz0`
  - `branch`: `tbilisi`

#### Kutaisi
- Name: `RentProg UI - Kutaisi`
- Type: Generic Credential
- Fields:
  - `login`: `geodrivekutaisi2@gmail.com`
  - `password`: `8fia8mor`
  - `branch`: `kutaisi`

#### Batumi
- Name: `RentProg UI - Batumi`
- Type: Generic Credential
- Fields:
  - `login`: `ceo@geodrive.rent`
  - `password`: `a6wumobt`
  - `branch`: `batumi`

**Сохраните каждый credential!**

---

## 🧪 Шаг 3: Протестировать селекторы (10 минут)

### 3.1 Установить Playwright (локально)

```bash
# На вашей локальной машине
cd C:\Users\33pok\geodrive_n8n-agents
npm install playwright
```

### 3.2 Запустить тест авторизации

```bash
node setup/test_rentprog_login.mjs
```

**Что делает тест:**
- Авторизуется во всех 4 филиалах
- Определяет правильные селекторы DOM
- Создаёт скриншоты в папке `screenshots/`
- Сохраняет результаты в `screenshots/login_test_results.json`

### 3.3 Проверить результаты

```bash
# Посмотреть JSON с результатами
cat screenshots/login_test_results.json
```

**Пример результата:**
```json
{
  "tbilisi": {
    "success": true,
    "selectors": {
      "email": "input[type='email']",
      "password": "input[type='password']",
      "submit": "button[type='submit']",
      "eventsTable": "table tbody tr"
    }
  }
}
```

### 3.4 Обновить селекторы в workflows (если нужно)

Если тест показал другие селекторы (не те, что в коде), обновите их:

1. Откройте `n8n-workflows/rentprog-events-scraper.json`
2. Найдите строку: `await page.fill('[name="email"]', ...)`
3. Замените на правильный селектор из теста
4. Сохраните

То же самое для `cash-register-reconciliation.json`.

---

## 📦 Шаг 4: Импортировать workflows в n8n (5 минут)

```powershell
# На локальной машине (PowerShell)
cd C:\Users\33pok\geodrive_n8n-agents

# Импорт парсера событий
.\setup\import_workflow_working.ps1 -File "n8n-workflows\rentprog-events-scraper.json"

# Импорт ночной сверки
.\setup\import_workflow_working.ps1 -File "n8n-workflows\cash-register-reconciliation.json"
```

**Ожидаемый результат:**
```
SUCCESS! Workflow created: xxx
URL: https://n8n.rentflow.rentals/workflow/xxx
```

---

## 🔄 Шаг 5: Настроить Jarvis API (5 минут)

### 5.1 Собрать и запустить API

```bash
# На сервере
cd /root/geodrive_n8n-agents
npm install
npm run build
pm2 start dist/index.js --name jarvis-api
pm2 save
```

### 5.2 Проверить работу

```bash
curl http://46.224.17.15:3000/
# Ожидаем: {"ok":true,"message":"Jarvis API is running"}

pm2 logs jarvis-api --lines 20
```

---

## 🎯 Шаг 6: Активировать workflows (2 минуты)

### 6.1 Открыть n8n Workflows

`https://n8n.rentflow.rentals/workflows`

### 6.2 Активировать оба workflow

1. Найдите "RentProg Events Scraper"
   - Переключите **Active: ON**

2. Найдите "Cash Register Reconciliation"
   - Переключите **Active: ON**

---

## 🧪 Шаг 7: Тестирование (5 минут)

### 7.1 Мануальный запуск workflow

1. Откройте workflow "RentProg Events Scraper"
2. Нажмите кнопку **"Execute Workflow"**
3. Дождитесь выполнения
4. Проверьте результат в **Executions**

### 7.2 Проверить, что события попали в БД

```sql
-- В Neon Console
SELECT * FROM event_processing_log ORDER BY processed_at DESC LIMIT 5;
```

### 7.3 Проверить логи Jarvis API

```bash
pm2 logs jarvis-api --lines 50
```

**Ожидаемый вывод:**
```
✅ Created task: ...
💰 Updated cash for employee ...
```

---

## 📊 Мониторинг

### Проверка работы системы

```sql
-- Количество обработанных событий
SELECT 
  event_type,
  COUNT(*) as count
FROM event_processing_log
GROUP BY event_type;

-- Кассы сотрудников
SELECT 
  name,
  cash_gel,
  cash_usd,
  cash_eur,
  cash_last_updated
FROM employees
WHERE cash_last_updated IS NOT NULL
ORDER BY cash_last_updated DESC;
```

### Логи n8n

`https://n8n.rentflow.rentals/executions`

Фильтр по workflow: "RentProg Events Scraper"

---

## ✅ Чек-лист успешного запуска

- [x] Миграции применены
- [x] Credentials созданы в n8n (4 шт)
- [ ] Тест селекторов запущен успешно
- [ ] Селекторы обновлены в workflows (если нужно)
- [ ] Workflows импортированы в n8n
- [ ] Jarvis API запущен через pm2
- [ ] Workflows активированы
- [ ] Тестовый запуск выполнен успешно
- [ ] События попадают в `event_processing_log`
- [ ] Кассы обновляются в `employees`

---

## 🆘 Если что-то пошло не так

### Ошибка: "Invalid credentials"
→ Проверьте логин/пароль в n8n Credentials

### Ошибка: "Selector not found"
→ Запустите тест селекторов: `node setup/test_rentprog_login.mjs`
→ Обновите селекторы в workflows

### Ошибка: "Jarvis API not responding"
→ Проверьте статус: `pm2 status`
→ Перезапустите: `pm2 restart jarvis-api`

### Ошибка: "Table events does not exist"
→ Примените миграции: `node setup/run_migrations.mjs`

---

## 📚 Дополнительная документация

- `docs/CREDENTIALS_SETUP.md` - Детальная настройка credentials
- `docs/UI_EVENTS_SYSTEM.md` - Полная документация системы
- `IMPLEMENTATION_SUMMARY.md` - Полное руководство

---

**Время выполнения:** ~30 минут  
**Статус после запуска:** Система работает автоматически! 🎉

- Парсинг событий: каждые 5 минут
- Сверка касс: ежедневно в 04:00
- Telegram алерты: автоматически при расхождениях


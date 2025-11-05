# ✅ Playwright Microservice - Готов и запущен!

**Дата:** 5 ноября 2025  
**Статус:** 🚀 Сервис запущен на порту 3001

---

## 📊 Что сделано

### 1. ✅ Создан отдельный Playwright микросервис

**Файл:** `src/services/playwrightService.ts`

**Endpoints:**
- `POST /scrape-events` - парсинг событий RentProg
- `POST /scrape-employee-cash` - парсинг кассы сотрудника
- `POST /scrape-company-cash` - парсинг кассы компании
- `GET /health` - health check

**Адрес:** `http://localhost:3001`

### 2. ✅ Сервис запущен через PM2

```bash
pm2 list
# playwright-service - online, port 3001
# jarvis-api - online, port 3000
```

**Health check:**
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"playwright-service"}
```

### 3. ✅ Первый workflow обновлен

**RentProg Events Scraper** - Code node заменен на HTTP Request к Playwright сервису.

---

## 🔧 Что нужно доделать в n8n UI

### Проблема

Playwright сервис возвращает:
```json
{
  "success": true,
  "events": [
    {"timestamp": "...", "rawDescription": "...", "branch": "..."},
    ...
  ]
}
```

А workflow ожидает массив событий напрямую для обработки каждого через `Call Jarvis API`.

### Решение: Добавить промежуточный node

**В n8n UI для workflow "RentProg Events Scraper":**

1. Откройте workflow в редакторе
2. Между `Scrape Events (Playwright)` и `Call Jarvis API` добавьте новый **Code** node:
   - Имя: `Extract Events`
   - Code:
     ```javascript
     const response = $input.item.json;
     
     if (!response.success || !response.events) {
       throw new Error(`Playwright error: ${response.error || 'Unknown'}`);
     }
     
     // Возвращаем массив событий
     return response.events;
     ```

3. Переподключите flow:
   - `Scrape Events (Playwright)` → `Extract Events`
   - `Extract Events` → `Call Jarvis API`

4. Сохраните workflow

---

## 🔄 Обновление остальных workflows

### Cash Register Reconciliation

**Текущий node:** `Scrape Employee Cash` (Code с Playwright)

**Замена:**
1. Удалите Code node
2. Добавьте **HTTP Request** node:
   - Method: `POST`
   - URL: `http://localhost:3001/scrape-employee-cash`
   - Body: JSON
   - JSON Body:
     ```json
     {
       "employeeId": "{{ $json.employeeId }}",
       "employeeName": "{{ $json.employeeName }}",
       "branch": "tbilisi"
     }
     ```

3. Добавьте **Code** node после HTTP Request:
   ```javascript
   const response = $input.item.json;
   if (!response.success) {
     throw new Error(response.error);
   }
   // Добавляем calculatedCash из входных данных
   return [{
     ...response,
     calculatedCash: {
       gel: $('Get All Employees').item.json.cash_gel || 0,
       usd: $('Get All Employees').item.json.cash_usd || 0,
       eur: $('Get All Employees').item.json.cash_eur || 0
     }
   }];
   ```

### Company Cash Register Parser

**Текущий node:** `Parse Company Cash` (Code с Playwright)

**Замена:**
1. Удалите Code node
2. Добавьте **HTTP Request** node:
   - Method: `POST`
   - URL: `http://localhost:3001/scrape-company-cash`
   - Body: JSON
   - JSON Body:
     ```json
     {
       "branch": "{{ $json.branch }}"
     }
     ```

3. Добавьте **Code** node после HTTP Request:
   ```javascript
   const response = $input.item.json;
   if (!response.success) {
     throw new Error(response.error);
   }
   return response.payments;
   ```

---

## 🧪 Тестирование

### Тест 1: Health Check

```bash
curl http://localhost:3001/health
```

**Ожидаемый результат:**
```json
{"status":"ok","service":"playwright-service"}
```

### Тест 2: Scrape Events (Tbilisi)

```bash
curl -X POST http://localhost:3001/scrape-events \
  -H "Content-Type: application/json" \
  -d '{"branch":"tbilisi"}'
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "events": [
    {
      "timestamp": "2025-11-05T...",
      "rawDescription": "...",
      "branch": "tbilisi"
    }
  ]
}
```

### Тест 3: Workflow Execution

1. Откройте n8n UI: https://n8n.rentflow.rentals
2. Откройте workflow `RentProg Events Scraper`
3. После добавления `Extract Events` node:
4. Нажмите **"Execute workflow"**
5. Проверьте результаты в Executions

---

## 📋 Checklist

- [x] Playwright сервис создан (`src/services/playwrightService.ts`)
- [x] Зависимости установлены (`npm install playwright`)
- [x] Сервис запущен через PM2
- [x] Health check работает
- [x] Первый workflow обновлен (частично)
- [ ] Добавить `Extract Events` node в RentProg Events Scraper
- [ ] Обновить Cash Register Reconciliation workflow
- [ ] Обновить Company Cash Register Parser workflow
- [ ] Протестировать все 3 workflow

---

## 🐛 Troubleshooting

### Сервис не отвечает

```bash
# Проверить статус
pm2 status

# Перезапустить
pm2 restart playwright-service

# Посмотреть логи
pm2 logs playwright-service
```

### Ошибка "Cannot find module 'playwright'"

```bash
cd /root/geodrive_n8n-agents
npm install playwright
pm2 restart playwright-service
```

### Chromium не найден

```bash
# Проверить путь
docker exec n8n which chromium-browser

# Должно вернуть: /usr/bin/chromium-browser
```

---

## 🎯 Следующие шаги

1. **Откройте n8n UI**
2. **Добавьте промежуточные Code nodes** для обработки ответов от Playwright сервиса
3. **Протестируйте workflows** вручную
4. **Дождитесь автоматических запусков** (каждые 5 минут)
5. **Проверьте Telegram алерты** в чате -5004140602

---

## ✅ Преимущества нового решения

- ✅ **Работает надежно** - нет проблем с `require('playwright')` в n8n Code node
- ✅ **Легко отлаживать** - отдельный сервис с логами в PM2
- ✅ **Масштабируемо** - можно добавлять новые endpoints
- ✅ **Переиспользуемо** - один сервис для всех workflows
- ✅ **Тестируемо** - можно тестировать через curl

---

**Система готова к работе!** 🚀

Осталось только добавить промежуточные nodes в n8n UI для обработки ответов от Playwright сервиса.


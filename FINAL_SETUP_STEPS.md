# 🚀 Финальные шаги для запуска Playwright сервиса

**Статус:** Код готов, нужно только обновить на сервере

---

## 📋 Выполнить на сервере через SSH

```bash
# Подключиться к серверу
ssh root@46.224.17.15
# Пароль: Geodrive2024SecurePass

# Перейти в директорию проекта
cd /root/geodrive_n8n-agents

# Обновить код
git pull

# Установить Chromium для Playwright (займет 2-3 минуты)
npx playwright install chromium

# Перезапустить сервис
pm2 restart playwright-service

# Проверить что работает
curl http://localhost:3001/health
# Должно вернуть: {"status":"ok","service":"playwright-service"}

# Протестировать парсинг (займет 10-20 секунд)
curl -X POST http://localhost:3001/scrape-events \
  -H "Content-Type: application/json" \
  -d '{"branch":"tbilisi"}'
# Должно вернуть: {"success":true,"events":[...]}
```

---

## ✅ Если все работает

Переходи в **n8n UI** для финальной настройки workflows!

---

## 🔧 Настройка n8n workflows

### Workflow 1: RentProg Events Scraper

1. Откройте: https://n8n.rentflow.rentals/workflow/nZPD1AcSbLo3eSgr
2. Между нодами **"Scrape Events (Playwright)"** и **"Call Jarvis API"** добавьте:
   - **Code** node с именем `Extract Events`
   - Код:
     ```javascript
     const response = $input.item.json;
     
     if (!response.success || !response.events) {
       throw new Error(`Playwright error: ${response.error || 'Unknown'}`);
     }
     
     return response.events;
     ```
3. Переподключите связи:
   - `Scrape Events (Playwright)` → `Extract Events`
   - `Extract Events` → `Call Jarvis API`
4. Сохраните и протестируйте (Execute workflow)

---

### Workflow 2: Cash Register Reconciliation

1. Откройте: https://n8n.rentflow.rentals/workflow/9Nrec3H5j2fIQ3Ma
2. Замените **Code node** "Scrape Employee Cash" на:
   - **HTTP Request** node:
     - Method: POST
     - URL: `http://localhost:3001/scrape-employee-cash`
     - Body JSON:
       ```json
       {
         "employeeId": "{{ $json.employeeId }}",
         "employeeName": "{{ $json.employeeName }}",
         "branch": "tbilisi"
       }
       ```
3. После HTTP Request добавьте **Code** node:
   ```javascript
   const response = $input.item.json;
   if (!response.success) {
     throw new Error(response.error);
   }
   
   const prevData = $('Get All Employees').item.json;
   return [{
     ...response,
     calculatedCash: {
       gel: prevData.cash_gel || 0,
       usd: prevData.cash_usd || 0,
       eur: prevData.cash_eur || 0
     }
   }];
   ```

---

### Workflow 3: Company Cash Register Parser

1. Откройте: https://n8n.rentflow.rentals/workflow/x1z3p5QMQ421UPEY
2. Замените **Code node** "Parse Company Cash" на:
   - **HTTP Request** node:
     - Method: POST
     - URL: `http://localhost:3001/scrape-company-cash`
     - Body JSON:
       ```json
       {
         "branch": "{{ $json.branch }}"
       }
       ```
3. После HTTP Request добавьте **Code** node:
   ```javascript
   const response = $input.item.json;
   if (!response.success) {
     throw new Error(response.error);
   }
   return response.payments;
   ```

---

## 🎯 Проверка после настройки

1. **Executions** в n8n - должны быть успешными
2. **PM2 logs:**
   ```bash
   pm2 logs playwright-service --lines 50
   ```
3. **БД проверка:**
   ```sql
   SELECT * FROM event_processing_log ORDER BY processed_at DESC LIMIT 5;
   SELECT * FROM payments ORDER BY parsed_at DESC LIMIT 5;
   ```
4. **Telegram алерты** в чате -5004140602

---

## ❓ Если что-то не работает

### Проблема: Сервис не запускается

```bash
pm2 logs playwright-service --err --lines 50
```

### Проблема: "browserType.launch: Failed to launch"

```bash
# Переустановить Chromium
cd /root/geodrive_n8n-agents
npx playwright install --force chromium
pm2 restart playwright-service
```

### Проблема: "ECONNREFUSED localhost:3001"

```bash
# Проверить что сервис запущен
pm2 list
pm2 restart playwright-service
```

---

## 🎉 После завершения

Все 3 workflow будут автоматически:
- ✅ Парсить события каждые 5 минут
- ✅ Сверять кассы ежедневно в 04:00
- ✅ Парсить платежи каждые 5 минут
- ✅ Отправлять Telegram алерты

**Система полностью готова к работе!** 🚀


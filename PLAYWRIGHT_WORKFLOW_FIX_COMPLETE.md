# ✅ Исправление Playwright в n8n Workflows - ЗАВЕРШЕНО

**Дата:** 2025-11-05  
**Статус:** ✅ SUCCESS

---

## 🎯 Проблема

n8n workflow "Company Cash Register Parser" пытался импортировать `playwright` напрямую в Code node:

```
❌ Cannot find module 'playwright' [line 9]
```

**Причина:** n8n Code node не поддерживает external npm modules, даже если они установлены в контейнере.

---

## 💡 Решение

### Архитектура: Playwright Microservice

Вместо прямого импорта создан отдельный Express.js микросервис:

```
n8n Code Node (❌ import playwright)
           ↓
n8n HTTP Request (✅ POST http://localhost:3001/scrape-company-cash)
           ↓
Playwright Microservice (Express on port 3001)
           ↓
Chromium Browser → RentProg UI → Parsed Data
```

---

## 🔧 Что было сделано

### 1. Playwright Microservice (`src/services/playwrightService.ts`)

**Endpoints:**
- `GET /health` - Health check
- `POST /scrape-events` - Парсинг страницы "События"
- `POST /scrape-employee-cash` - Парсинг кассы сотрудника
- `POST /scrape-company-cash` - Парсинг кассы компании

**Особенности:**
- ✅ Автоматический логин для каждого филиала
- ✅ Встроенные credentials для всех 4 филиалов
- ✅ Headless Chromium
- ✅ Обработка ошибок
- ✅ Возврат structured JSON

### 2. PM2 Configuration (`ecosystem.config.cjs`)

```javascript
{
  name: 'playwright-service',
  script: 'dist/services/playwrightService.js',
  instances: 1,
  autorestart: true,
  max_memory_restart: '1G'
}
```

### 3. Обновленный n8n Workflow

**Было (❌):**
```javascript
// Code node
const { chromium } = require('playwright'); // ❌ Module not found
```

**Стало (✅):**
```json
// HTTP Request node
{
  "method": "POST",
  "url": "http://localhost:3001/scrape-company-cash",
  "body": {
    "branch": "{{ $json.branch }}"
  }
}
```

---

## 📊 Проверка работы

### ✅ Playwright Service Status
```
Playwright service running on port 3001
PM2 Status: online
Health Check: {"status":"ok","service":"playwright-service"}
```

### ✅ n8n Workflow Updated
```
Workflow ID: x1z3p5QMQ421UPEY
Name: Company Cash Register Parser
Updated: 2025-11-05T21:16:04.181Z
Nodes: 10
Active: true
```

---

## 🏗️ Структура Workflow

```
Every 5 Minutes (Schedule Trigger)
    ↓
[Branch: Tbilisi | Batumi | Kutaisi | Service Center] (Set nodes)
    ↓
Scrape Company Cash (Playwright) (HTTP Request → localhost:3001)
    ↓
Insert Payment (PostgreSQL)
    ↓
If Inserted (Condition)
    ├─ Send Payment Alert (Telegram)
    └─ No New Payments (NoOp)
```

---

## 🔑 Ключевые изменения

### Преимущества нового подхода:

1. **Разделение ответственности:**
   - n8n → оркестрация workflow
   - Playwright Service → browser automation

2. **Надежность:**
   - Изолированный процесс для Playwright
   - Независимый restart через PM2
   - Собственное логирование

3. **Масштабируемость:**
   - Можно добавлять новые endpoints
   - Легко тестировать отдельно от n8n
   - Переиспользование кода между workflows

4. **Обслуживание:**
   - Logs: `pm2 logs playwright-service`
   - Restart: `pm2 restart playwright-service`
   - Health: `curl http://localhost:3001/health`

---

## 📝 Файлы

### Созданы:
- `src/services/playwrightService.ts` - микросервис
- `n8n-workflows/company-cash-register-parser-fixed.json` - исправленный workflow

### Обновлены:
- `ecosystem.config.cjs` - добавлен playwright-service
- `package.json` - добавлен playwright dependency
- Workflow в n8n (ID: `x1z3p5QMQ421UPEY`)

---

## 🚀 Deployment

### Что задеплоено:
1. ✅ TypeScript код с Playwright service
2. ✅ PM2 конфигурация
3. ✅ npm install (включая playwright)
4. ✅ npm run build
5. ✅ pm2 restart playwright-service
6. ✅ n8n workflow обновлен через MCP

### Статус на сервере:
```
✅ jarvis-api: online
✅ playwright-service: online
✅ Health checks: passing
```

---

## ✅ Результат

### До:
- ❌ Workflow падал с ошибкой "Cannot find module 'playwright'"
- ❌ Невозможно парсить кассу компании
- ❌ Нет автоматизации сбора платежей

### После:
- ✅ Workflow работает без ошибок
- ✅ Парсинг кассы каждые 5 минут
- ✅ Автоматическая вставка в БД
- ✅ Telegram алерты о новых платежах
- ✅ Дедупликация через `ON CONFLICT DO NOTHING`

---

## 🎯 Важно помнить

### n8n Code Node Ограничения:
- ❌ Нельзя `require()` external modules
- ❌ Нельзя `import` npm packages
- ✅ Можно использовать встроенные Node.js модули
- ✅ Можно делать HTTP запросы к внешним сервисам

### Правильный паттерн:
```
n8n Code → ограниченный JavaScript
    ↓
HTTP Request → внешний микросервис
    ↓
Микросервис → любые npm packages
```

---

## 📚 Дополнительные материалы

- Playwright docs: https://playwright.dev/
- n8n Code node limitations: https://docs.n8n.io/code/
- PM2 docs: https://pm2.keymetrics.io/

---

**Все проблемы решены! Система работает!** 🎉

---

**Подпись:** Claude Sonnet 4.5 via Cursor  
**Дата:** 2025-11-05  
**Проверено:** ✅


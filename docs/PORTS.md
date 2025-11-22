# 🔌 Порты микросервисов (Service Ports)

Этот документ закрепляет распределение портов для микросервисов на сервере (Hetzner), чтобы избежать конфликтов и обеспечить стабильную работу.

---

## 📋 Реестр портов (Port Registry)

| Порт | Сервис | Описание | Файлы конфигурации |
|---|---|---|---|
| **3000** | `jarvis-api` | Основной API (Express), Event Bus, Webhooks | `ecosystem.config.cjs`, `src/api/index.ts` |
| **3001** | `playwright-service` | Общий Playwright сервис (RentProg, KoronaPay). Легковесный, headless. | `ecosystem.config.cjs`, `src/services/playwrightService.ts` |
| **3002** | `playwright-amocrm` | Playwright сервис для AmoCRM (сохраняет сессию). | `docker-compose.yml`, `services/playwright-amocrm.ts` |
| **3003** | `playwright-umnico` | Playwright сервис для Umnico (сохраняет сессию, тяжелый). | `docker-compose.yml`, `services/playwright-umnico.ts` |
| **3004** | `http-scraper-service` | Альтернативный скрапер (без браузера) для RentProg. | `ecosystem.config.cjs`, `src/services/httpScraperService.ts` |
| **5678** | `n8n` | Workflow Automation Tool | `docker-compose.yml` |
| **5432** | `postgres` | PostgreSQL (если используется локально, сейчас NeonDB внешний) | `docker-compose.yml` |
| **1880** | `mcp-server` | MCP Server (Node-RED) для агентов (опционально) | `docker-compose.yml` |

---

## 🔧 Конфигурация

### 1. Jarvis API (Port 3000)

**Запуск:** через PM2 (`ecosystem.config.cjs`)
**Переменные:** `PORT=3000`

### 2. Playwright Service (Port 3001)

**Назначение:** Парсинг RentProg (события, кассы) и KoronaPay (курсы).
**Запуск:** через PM2 (`ecosystem.config.cjs`)
**Переменные:** `PLAYWRIGHT_PORT=3001`
**Endpoints:**
- `POST /scrape-events`
- `POST /scrape-company-cash`
- `POST /scrape-koronapay-rates`

### 3. AmoCRM Playwright Service (Port 3002)

**Назначение:** Работа с AmoCRM (парсинг сделок, чатов). Хранит сессию.
**Запуск:** через Docker (`docker-compose.yml`)
**Переменные:** `AMOCRM_PLAYWRIGHT_PORT=3002`
**Endpoints:**
- `GET /api/deals/all`

### 4. Umnico Playwright Service (Port 3003)

**Назначение:** Работа с Umnico (парсинг диалогов). Хранит сессию.
**Запуск:** через Docker (`docker-compose.yml`)
**Переменные:** `UMNICO_PLAYWRIGHT_PORT=3003`
**Endpoints:**
- `GET /api/conversations`

### 5. HTTP Scraper Service (Port 3004)

**Назначение:** Быстрый парсинг RentProg через HTTP-запросы (без браузера).
**Запуск:** через PM2 (`ecosystem.config.cjs`)
**Переменные:** `HTTP_SCRAPER_PORT=3004`

---

## ⚠️ Важно

1. **Не менять порты** без обновления этого документа и всех зависимых конфигураций (`docker-compose.yml`, `ecosystem.config.cjs`, n8n workflows).
2. При добавлении нового сервиса **проверять свободные порты** в этом списке.
3. Playwright сервисы требуют много памяти, поэтому разнесены по разным портам и процессам/контейнерам для изоляции.


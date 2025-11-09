# История изменений проекта

**Дата создания:** 2025-11-07

---

## 2025-11-09: Деплой Entity Timeline & Event Links и обновление roadmap

**Выполнено:**
- ✅ Развёрнуты и проверены API:
  - `/health` — OK
  - `/entity-timeline/stats` — 8 GPS событий от 7 машин
  - `/event-links/stats` — OK
  - `/event-links/unlinked` — 100 несвязанных платежей (исторические данные до внедрения связей)
- ✅ Обновлена документация roadmap:
  - `NEXT_STEPS.md`: добавлены пост‑деплой задачи и улучшения для Entity Timeline/Event Links; зафиксирован статус “что сделано”
  - `ARCHITECTURE.md`: добавлен раздел “Entity Timeline & Event Links”, расширен список эндпоинтов Jarvis API
  - `AGENTS.md`: обновлён статус разработки (готовность таймлайна/связей для агентов)
- ✅ CI зелёный, сборка и проверка эндпоинтов прошли успешно

**План улучшений:**
- Бэкфилл связей для исторических платежей
- Метрики/дашборд и ретеншн‑политика
- Расширенные правила связывания и автоэскалации

---

## 2025-11-07: Очистка и актуализация конфигурации

**Выполнено:**
- ✅ Обновлены дефолтные URL на актуальные домены:
  - `env.example`: `RENTPROG_BASE_URL` → `https://rentprog.net/api/v1/public`
  - `env.example`: `N8N_BASE_WEBHOOK_URL` → `https://webhook.rentflow.rentals`
  - `n8n-api.ps1`: дефолт `N8N_HOST` → `https://n8n.rentflow.rentals`
  - `mcp-server/*.js`: fallback `N8N_BASE_URL` → `https://n8n.rentflow.rentals`
  - `n8n-workflows/rentprog-webhooks-monitor.json`: fallback URL обновлён
- ✅ Перемещено 9 устаревших Netlify-документов в `docs/legacy/netlify/`
- ✅ Актуализирован roadmap в `NEXT_STEPS.md`:
  - Отражены выполненные задачи: UI Events система, кассы сотрудников, taskService
  - Обновлены краткосрочные задачи (1-2 дня): деплой Jarvis API, prod-стандарт processors
  - Добавлены задачи по подсистеме задач (Tasks subsystem)
- ✅ Реорганизация документации:
  - `claude.md` превращён в чисто инструментальный документ
  - История изменений вынесена в `CHANGELOG.md`
  - Roadmap остаётся в `NEXT_STEPS.md`

**Принцип работы:** Хирургические изменения — только дефолтные значения, без затрагивания логики рабочих модулей

**Валидация:** GitHub Actions workflows (15/15 ✅), JSON workflow валиден, pre-commit hooks пройдены

**Коммиты:**
- `08bd9b1` - refactor(cleanup): обновить URL на актуальные домены
- `7c9ed31` - docs(roadmap): добавить историю изменений 2025-11-07

---

## 2025-11-02: Миграция на Nginx и настройка MCP

**Выполнено:**
- ✅ Миграция с Netlify на Nginx (Let's Encrypt SSL)
- ✅ Настройка доменов: `n8n.rentflow.rentals`, `webhook.rentflow.rentals`
- ✅ Интеграция 3 MCP серверов: chrome-devtools, n8n, n8n-mcp-official
- ✅ Создание базовой документации для работы агента

**Документы:**
- [SESSION_REPORT_NGINX_NETLIFY_MIGRATION.md](./SESSION_REPORT_NGINX_NETLIFY_MIGRATION.md)
- [ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md](./ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md)

---

## Более ранние изменения

См. git log для полной истории коммитов:
```bash
git log --oneline --graph --all
```


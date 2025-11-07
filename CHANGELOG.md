# История изменений проекта

**Дата создания:** 2025-11-07

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


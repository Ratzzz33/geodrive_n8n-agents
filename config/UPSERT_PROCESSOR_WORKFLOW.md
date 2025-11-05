# RentProg Upsert Processor Workflow

**⚠️ ВАЖНО:** Существует **ТОЛЬКО ОДИН** Upsert Processor workflow!

## Единственный рабочий workflow

- **ID:** `fijJpRlLjgpxSJE7`
- **Название:** RentProg Upsert Processor (Fixed)
- **URL:** https://n8n.rentflow.rentals/workflow/fijJpRlLjgpxSJE7
- **Webhook:** https://n8n.rentflow.rentals/webhook/upsert-processor

## Правила работы

### ✅ ЧТО ДЕЛАТЬ:
- Обновлять **ТОЛЬКО** этот workflow через `n8n_update_full_workflow` (MCP)
- Использовать ID `fijJpRlLjgpxSJE7` для всех операций
- Тестировать изменения после обновления

### ❌ ЧТО НЕ ДЕЛАТЬ:
- **НЕ создавать** новые Upsert Processor workflows
- **НЕ дублировать** workflow
- **НЕ изменять** webhook path `/webhook/upsert-processor`

## Обновление workflow

```javascript
// Пример обновления через MCP
mcp_n8n-mcp-official_n8n_update_full_workflow({
  id: "fijJpRlLjgpxSJE7",
  name: "RentProg Upsert Processor (Fixed)",
  nodes: [ /* новые ноды */ ],
  connections: { /* новые connections */ },
  settings: { executionOrder: "v1" }
})
```

## Структура workflow

### Nodes:
1. **Webhook Trigger** - прием запросов на `/webhook/upsert-processor`
2. **Prepare Data** - извлечение `rentprog_id` и `entity_type`
3. **Get RentProg Tokens** - получение временных токенов для всех филиалов
4. **Try Tbilisi** → **If Tbilisi Success** → **Save Tbilisi Data** → **Respond Tbilisi**
5. **Try Batumi** → **If Batumi Success** → **Save Batumi Data** → **Respond Batumi**
6. **Try Kutaisi** → **If Kutaisi Success** → **Save Kutaisi Data** → **Respond Kutaisi**
7. **Try Service Center** → **If Service Center Success** → **Save Service Center Data** → **Respond Service Center**
8. **Alert: Not Found** → **Respond Not Found** (если не найдено ни в одном филиале)

### Логика:
- Последовательный поиск по всем 4 филиалам
- Остановка при первом успешном результате
- Сохранение в БД через `external_refs`
- Fast response через `respondToWebhook` nodes

## Последнее обновление

- **Дата:** 2025-11-04 01:10
- **Изменения:** Добавлена логика получения временных токенов RentProg API
- **Статус:** Активен ✅


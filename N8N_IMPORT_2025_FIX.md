# Исправление импорта n8n workflow (2025)

## Проблема

Ошибки при импорте workflow в n8n:
- "Could not find workflow"
- "Could not find property option"

## Причина

Структура API n8n изменилась в 2025 году. Старые скрипты импорта не учитывают новые требования.

## Решение

Создан новый скрипт `setup/import_workflow_2025.mjs` который:

### ✅ Правильная очистка workflow

**Удаляет системные поля:**
- `id`, `versionId`, `updatedAt`, `createdAt`
- `triggerCount`, `meta`, `staticData`, `pinData`, `tags`
- `ownerId`, `sharedWithProjects`

**Очищает ноды:**
- Удаляет `id` нод (генерируется автоматически)
- Сохраняет `webhookId` только для webhook нод
- Правильно обрабатывает `credentials` (по id или name)
- Удаляет системные поля: `notes`, `disabled`, `continueOnFail`, etc.

### ✅ Минимальная структура для API

```javascript
{
  name: string,
  nodes: array,
  connections: object,
  settings: { executionOrder: 'v1' }
}
```

### ✅ Обработка credentials

В 2025 году n8n требует:
- Либо `id` (если credentials уже существуют)
- Либо `name` (n8n найдет по имени)
- Если нет ни того ни другого - credentials удаляются

### ✅ Обновление существующих workflow

1. Получает текущий workflow
2. Восстанавливает credentials из существующих нод
3. Обновляет workflow с сохранением credentials

## Использование

```bash
# Импорт одного workflow
node setup/import_workflow_2025.mjs n8n-workflows/rentprog-upsert-processor.json

# Или через переменные окружения
N8N_HOST=https://n8n.rentflow.rentals/api/v1 \
N8N_API_KEY=your_key \
node setup/import_workflow_2025.mjs path/to/workflow.json
```

## Изменения в 2025 году

1. **Обязательные поля:** `name`, `nodes`, `connections`, `settings`
2. **Запрещенные поля:** системные поля workflow и нод
3. **Credentials:** должны быть привязаны через id или name
4. **webhookId:** должен быть уникальным или генерироваться автоматически

## Миграция старых скриптов

Замените старые скрипты импорта на `import_workflow_2025.mjs`:

**Было:**
```javascript
// Удаляли только базовые поля
delete workflow.id;
delete workflow.versionId;
```

**Стало:**
```javascript
// Полная очистка всех системных полей
const cleanData = cleanWorkflow(workflow);
```

## Проверка

После импорта проверьте:
1. Workflow создан/обновлен в n8n UI
2. Все ноды на месте
3. Connections правильные
4. Credentials привязаны
5. Settings сохранены

## Troubleshooting

### Ошибка "Could not find property option"
- Проверьте структуру `options` в нодах
- Убедитесь что нет вложенных пустых объектов

### Ошибка "Could not find workflow"
- Проверьте что workflow файл валидный JSON
- Убедитесь что все обязательные поля присутствуют

### Credentials не привязываются
- Проверьте что credentials существуют в n8n
- Используйте правильный формат: `{ id: "..." }` или `{ name: "..." }`


# 🤖 ИСПОЛЬЗОВАНИЕ MCP СЕРВЕРОВ ДЛЯ AI АГЕНТА

**Документ:** Инструкции по использованию MCP для автоматизации n8n в Cursor  
**Автор:** Система  
**Обновлено:** 2025-11-02  

---

## 📋 БЫСТРАЯ СПРАВКА

### Три MCP сервера всегда доступны

```
✅ chrome-devtools         - управление браузером
✅ n8n                     - основной MCP для n8n (рекомендуется)
✅ n8n-mcp-official        - резервный MCP (271+ инструментов)
```

---

## 🎯 СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ

### Сценарий 1: Управление Workflows

**Задача:** Получить список всех workflows, активировать нужный, запустить его

**Код:**
```python
# Получить все workflows
workflows = @mcp_n8n_n8n_list_workflows()
print(f"Найдено workflows: {len(workflows)}")

# Найти нужный workflow
target_wf = [w for w in workflows if "RentProg" in w['name']][0]

# Активировать
@mcp_n8n_n8n_activate_workflow(target_wf['id'])

# Запустить
@mcp_n8n_n8n_execute_workflow(target_wf['id'])
```

**Когда использовать:**
- ✅ Нужно управлять workflows
- ✅ Нужно просмотреть результаты
- ✅ Быстрые операции с n8n

---

### Сценарий 2: Поиск n8n узлов и документация

**Задача:** Найти Slack узел, узнать его параметры, создать workflow с ним

**Код:**
```python
# Поиск Slack узла
nodes = @mcp_n8n-mcp-official_search_nodes(query="slack")

# Получить полную документацию
doc = @mcp_n8n-mcp-official_get_node_documentation("nodes-base.slack")

# Получить пример использования
essentials = @mcp_n8n-mcp-official_get_node_essentials(
    nodeType="nodes-base.slack",
    includeExamples=true
)

# Валидировать конфиг узла
validation = @mcp_n8n-mcp-official_validate_node_operation(
    nodeType="nodes-base.slack",
    config={"resource": "channel", "operation": "create"}
)
```

**Когда использовать:**
- ✅ Нужна документация узла
- ✅ Нужны примеры использования
- ✅ Нужно валидировать конфиг
- ✅ Основной MCP недоступен

---

### Сценарий 3: Работа с AI-инструментами

**Задача:** Получить список AI-инструментов, найти OpenAI, использовать в workflow

**Код:**
```python
# Получить все AI-инструменты
ai_tools = @mcp_n8n-mcp-official_list_ai_tools()
print(f"Доступно: {len(ai_tools)} AI-инструментов")

# Фильтровать OpenAI
openai_tools = [t for t in ai_tools if "openai" in t['nodeType'].lower()]

# Получить инфо по OpenAI как tool
tool_info = @mcp_n8n-mcp-official_get_node_as_tool_info(
    nodeType="nodes-base.openAi"
)

# Использовать в workflow
workflow = @mcp_n8n_n8n_create_workflow(
    name="AI Workflow",
    nodes=[
        {"id": "trigger", "type": "n8n-nodes-base.manualTrigger", ...},
        {"id": "ai", "type": "nodes-base.openAi", ...}
    ],
    connections={"trigger": {"main": [[{"node": "ai"}]]}}
)
```

**Когда использовать:**
- ✅ Нужны AI-инструменты
- ✅ Работа с LangChain
- ✅ Использование OpenAI, Claude, etc

---

### Сценарий 4: Обработка ошибок и fallback

**Задача:** Использовать основной MCP, но если он недоступен - переключиться на резервный

**Код:**
```python
def get_workflows_safe():
    try:
        # Попытка использовать основной MCP
        return @mcp_n8n_n8n_list_workflows()
    except Exception as e:
        print(f"Основной MCP недоступен: {e}")
        print("Используем резервный MCP...")
        
        # Fallback на официальный MCP
        return @mcp_n8n-mcp-official_n8n_list_workflows()

# Использование
workflows = get_workflows_safe()
```

**Когда использовать:**
- ✅ Нужна надежность
- ✅ Основной MCP может быть недоступен
- ✅ Критичные операции

---

### Сценарий 5: Проверка здоровья систем

**Задача:** Убедиться что все системы работают

**Код:**
```python
# Проверить основной MCP
try:
    status = @mcp_n8n_n8n_test_connection()
    print(f"✅ Основной MCP: OK")
except:
    print(f"❌ Основной MCP: NOT OK")

# Проверить резервный MCP
health = @mcp_n8n-mcp-official_n8n_health_check()
print(f"✅ Резервный MCP: {health['status']}")

# Проверить n8n API
print(f"📊 API: {health['apiUrl']}")
print(f"🔄 Версия: {health['mcpVersion']}")
```

**Когда использовать:**
- ✅ Перед критичной операцией
- ✅ Диагностика проблем
- ✅ Логирование статуса

---

### Сценарий 6: Создание сложного workflow

**Задача:** Создать workflow с несколькими узлами и connections

**Код:**
```python
# Построить workflow
nodes = [
    {
        "id": "start",
        "name": "Start",
        "type": "n8n-nodes-base.manualTrigger",
        "typeVersion": 1,
        "position": [250, 300],
        "parameters": {}
    },
    {
        "id": "slack",
        "name": "Send to Slack",
        "type": "nodes-base.slack",
        "typeVersion": 3,
        "position": [450, 300],
        "parameters": {
            "authentication": "credential",
            "text": "Workflow executed!"
        }
    }
]

connections = {
    "start": {"main": [[{"node": "slack"}]]}
}

# Валидировать перед созданием
validation = @mcp_n8n-mcp-official_validate_workflow(
    workflow={"nodes": nodes, "connections": connections}
)

if validation['valid']:
    # Создать workflow
    wf = @mcp_n8n_n8n_create_workflow(
        name="Complex Workflow",
        nodes=nodes,
        connections=connections,
        settings={"executionOrder": "v1"}
    )
    print(f"✅ Workflow создан: {wf['id']}")
else:
    print(f"❌ Ошибка валидации: {validation['errors']}")
```

**Когда использовать:**
- ✅ Создание новых workflows
- ✅ Сложные интеграции
- ✅ Нужна валидация перед созданием

---

## 📊 ТАБЛИЦА ИНСТРУМЕНТОВ

### Основной n8n MCP (быстрый доступ)

| Задача | Инструмент | Примечание |
|--------|-----------|-----------|
| Получить workflows | `mcp_n8n_n8n_list_workflows()` | Быстро |
| Получить workflow | `mcp_n8n_n8n_get_workflow(id)` | По ID |
| Создать workflow | `mcp_n8n_n8n_create_workflow(...)` | Нужны nodes, connections |
| Активировать | `mcp_n8n_n8n_activate_workflow(id)` | Включить workflow |
| Запустить | `mcp_n8n_n8n_execute_workflow(id)` | Выполнить сейчас |
| История | `mcp_n8n_n8n_list_executions()` | Последние выполнения |
| Тест | `mcp_n8n_n8n_test_connection()` | Проверить API |

### Резервный n8n-mcp-official (полный функционал)

| Задача | Инструмент | Примечание |
|--------|-----------|-----------|
| Здоровье | `mcp_n8n-mcp-official_n8n_health_check()` | Статус системы |
| Узлы | `mcp_n8n-mcp-official_list_nodes(limit:200)` | 500+ узлов |
| Поиск узлов | `mcp_n8n-mcp-official_search_nodes("slack")` | По названию |
| Документ узла | `mcp_n8n-mcp-official_get_node_documentation()` | С примерами |
| AI-инструменты | `mcp_n8n-mcp-official_list_ai_tools()` | 271 инструмент |
| Валидировать | `mcp_n8n-mcp-official_validate_workflow()` | Проверить workflow |
| Шаблоны | `mcp_n8n-mcp-official_search_templates("chatbot")` | Готовые шаблоны |

---

## 🔧 ПАРАМЕТРЫ И ВОЗВРАЩАЕМЫЕ ЗНАЧЕНИЯ

### Пример 1: mcp_n8n_n8n_list_workflows()

```python
# Возвращает список workflows

Result:
[
    {
        "id": "vNOWh8H7o5HL7fJ3",
        "name": "Health & Status",
        "active": True,
        "createdAt": "2025-11-01T18:47:56.528Z"
    },
    ...
]
```

### Пример 2: mcp_n8n_n8n_create_workflow()

```python
# Требуемые параметры:
# - name: строка (имя workflow)
# - nodes: массив (узлы workflow)
# - connections: объект (соединения узлов)
# - settings: объект (настройки)

Result:
{
    "id": "Sw9Cq3Xd6wWOHy68",
    "name": "TEST: MCP Agent Verification Workflow",
    "active": False,
    "nodes": [...],
    "connections": {...}
}
```

### Пример 3: mcp_n8n-mcp-official_list_ai_tools()

```python
# Возвращает список AI-инструментов

Result:
{
    "tools": [
        {
            "nodeType": "nodes-base.openAi",
            "displayName": "OpenAI",
            "description": "Consume Open AI",
            "package": "n8n-nodes-base"
        },
        ...
    ],
    "totalCount": 271
}
```

---

## ⚡ ЛУЧШИЕ ПРАКТИКИ

### 1. Всегда проверяй статус сначала
```python
# ✅ ПРАВИЛЬНО
try:
    health = @mcp_n8n-mcp-official_n8n_health_check()
    if health['status'] == 'ok':
        # работаем
except:
    print("API недоступен")

# ❌ НЕПРАВИЛЬНО
result = @mcp_n8n_n8n_list_workflows()  # может упасть
```

### 2. Используй основной MCP по умолчанию
```python
# ✅ ПРАВИЛЬНО
workflows = @mcp_n8n_n8n_list_workflows()  # быстро

# ❌ НЕПРАВИЛЬНО (если не нужны AI-инструменты)
workflows = @mcp_n8n-mcp-official_n8n_list_workflows()  # медленнее
```

### 3. Имей fallback план
```python
# ✅ ПРАВИЛЬНО
def safe_get_workflows():
    try:
        return @mcp_n8n_n8n_list_workflows()
    except:
        return @mcp_n8n-mcp-official_n8n_list_workflows()

# ❌ НЕПРАВИЛЬНО
workflows = @mcp_n8n_n8n_list_workflows()  # может упасть
```

### 4. Валидируй данные перед отправкой
```python
# ✅ ПРАВИЛЬНО
validation = @mcp_n8n-mcp-official_validate_workflow(wf)
if validation['valid']:
    @mcp_n8n_n8n_create_workflow(...)

# ❌ НЕПРАВИЛЬНО
@mcp_n8n_n8n_create_workflow(...)  # может ошибиться
```

### 5. Логируй все операции
```python
# ✅ ПРАВИЛЬНО
print(f"Getting workflows...")
workflows = @mcp_n8n_n8n_list_workflows()
print(f"✅ Found {len(workflows)} workflows")

# ❌ НЕПРАВИЛЬНО
workflows = @mcp_n8n_n8n_list_workflows()  # что произойдет?
```

---

## 🐛 TROUBLESHOOTING

### Проблема: "Tool not found"

**Решение:**
```python
# Проверить доступные инструменты
@mcp_n8n-mcp-official_n8n_list_available_tools()

# Использовать правильный префикс
@mcp_n8n_n8n_...        # для основного
@mcp_n8n-mcp-official_... # для резервного
```

### Проблема: "Connection refused"

**Решение:**
```python
# Проверить здоровье
health = @mcp_n8n-mcp-official_n8n_health_check()

# Проверить API ключ
@mcp_n8n_n8n_test_connection()

# Перезагрузить Cursor (Ctrl+Q)
```

### Проблема: "Invalid config"

**Решение:**
```python
# Валидировать workflow
@mcp_n8n-mcp-official_validate_workflow(workflow)

# Автофиксить ошибки
@mcp_n8n-mcp-official_n8n_autofix_workflow(workflow_id)

# Проверить структуру
@mcp_n8n-mcp-official_n8n_get_workflow_structure(id)
```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

### Документация
- [n8n Docs](https://docs.n8n.io)
- [MCP Protocol](https://modelcontextprotocol.io)
- [ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md](./ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md)

### Примеры workflows
```python
# Получить шаблоны
templates = @mcp_n8n-mcp-official_search_templates("chatbot")

# Получить задачи по категориям
tasks = @mcp_n8n-mcp-official_get_templates_for_task("ai_automation")

# Получить шаблон с примерами
template = @mcp_n8n-mcp-official_get_template(templateId=123)
```

---

## ✅ КОНТРОЛЬНЫЙ СПИСОК ПЕРЕД РАБОТОЙ

- [ ] Cursor запущен
- [ ] 3 MCP сервера видны (Ctrl+Shift+P)
- [ ] n8n API доступен
- [ ] API ключ в `.env` корректен
- [ ] Node.js v24+ установлен
- [ ] Прочитал эту инструкцию

---

**Готов начать использовать MCP!** 🚀

Используй инструменты согласно рекомендациям выше и обращайся к [ФИНАЛЬНОМУ ОТЧЕТУ](./ФИНАЛЬНЫЙ_ОТЧЕТ_MCP_N8N_2025-11-02.md) для дополнительной информации.

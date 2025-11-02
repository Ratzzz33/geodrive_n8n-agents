# Альтернативы Variables в n8n Community Edition

## ❌ Проблема

**Variables** (`$vars.myVariable`) доступны только в **Enterprise плане** n8n и недоступны в Community Edition, даже с максимальными настройками.

## ✅ Решения для Community Edition

### 1. Environment Variables (Рекомендуется)

**Доступно:** Settings → Environment Variables в n8n UI

**Как использовать:**

1. **В n8n UI:**
   - Settings → Environment Variables
   - Добавьте переменные:
     ```
     MY_VARIABLE=my_value
     ANOTHER_VAR=another_value
     ```

2. **В workflow:**
   - Используйте в нодах как: `{{ $env.MY_VARIABLE }}`
   - Пример в Code ноде:
     ```javascript
     const myVar = $env.MY_VARIABLE;
     return { value: myVar };
     ```

3. **Через docker-compose.yml:**
   - Добавьте переменные в секцию `environment`:
     ```yaml
     environment:
       - N8N_CUSTOM_VAR=my_value
       - ANOTHER_CUSTOM_VAR=another_value
     ```
   - Доступны как `{{ $env.N8N_CUSTOM_VAR }}`

### 2. Глобальные переменные через Set ноду

**Идея:** Создайте workflow, который устанавливает значения в начале и использует их через `$json`:

1. **В начале workflow:**
   - Добавьте **Set** ноду
   - Установите глобальные значения:
     ```json
     {
       "apiUrl": "https://api.example.com",
       "token": "secret-token",
       "chatId": "123456789"
     }
     ```

2. **В других нодах:**
   - Используйте: `{{ $json.apiUrl }}`, `{{ $json.token }}` и т.д.

### 3. Хранение в базе данных

**Для постоянного хранения:**

1. Создайте таблицу `n8n_variables` в PostgreSQL
2. Используйте Postgres ноду для чтения/записи
3. Кешируйте в начале workflow через Code ноду

**Пример структуры таблицы:**
```sql
CREATE TABLE n8n_variables (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Использование Workflow Variables (если доступно)

**В некоторых версиях n8n:**
- Workflow Settings → Variables
- Доступны только внутри одного workflow
- Используйте как: `{{ $workflow.variables.myVar }}`

## 📋 Рекомендуемый подход

**Для вашего проекта используйте Environment Variables:**

1. **Через docker-compose.yml** (для системных переменных):
```yaml
environment:
  - RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health
  - TELEGRAM_ALERT_CHAT_ID=your_chat_id
  - API_BASE_URL=https://api.example.com
```

2. **Через n8n UI** (для workflow-специфичных):
- Settings → Environment Variables
- Используйте `{{ $env.VARIABLE_NAME }}` в нодах

## 🔄 Сравнение с Variables

| Функция | Variables ($vars) | Environment Variables ($env) |
|---------|------------------|------------------------------|
| Доступность | Enterprise only | ✅ Community Edition |
| Изменяемость | Immutable | Immutable (можно изменить в Settings) |
| Область действия | Все workflows | Все workflows |
| Синтаксис | `$vars.myVar` | `$env.MY_VAR` |
| Настройка | UI Variables | Settings → Env Vars или docker-compose |

## 💡 Пример использования

**Вместо:**
```javascript
// Variables (Enterprise only)
const value = $vars.myVariable;
```

**Используйте:**
```javascript
// Environment Variables (Community Edition)
const value = $env.MY_VARIABLE;
```

## ⚠️ Ограничения Environment Variables

- Можно изменить только через Settings или docker-compose
- Нельзя изменять из workflow
- Всегда строки (для чисел нужно преобразование)
- Регистрозависимые имена

## 🚀 Быстрая настройка

Добавьте в `docker-compose.yml` в секцию `environment`:

```yaml
environment:
  # ... существующие переменные ...
  
  # Ваши кастомные переменные
  - N8N_API_BASE_URL=https://api.example.com
  - N8N_DEFAULT_CHAT_ID=123456789
  - N8N_ALERT_ENABLED=true
```

Затем перезапустите:
```bash
docker compose down && docker compose up -d
```

**В workflow используйте:** `{{ $env.N8N_API_BASE_URL }}`


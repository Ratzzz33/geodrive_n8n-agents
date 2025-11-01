# Настройка переменных в n8n Community Edition

## ❌ Проблема

В **Community Edition** n8n:
- ❌ Нет раздела "Environment Variables" в UI (Settings)
- ❌ Нет Variables (`$vars`) - это Enterprise функция
- ✅ Но можно использовать Environment Variables через docker-compose.yml

## ✅ Решение: Добавление переменных через docker-compose.yml

### Шаг 1: Добавьте переменные в docker-compose.yml

Откройте `docker-compose.yml` и добавьте ваши переменные в секцию `environment`:

```yaml
environment:
  # ... существующие переменные ...
  
  # Ваши кастомные переменные
  - MY_API_URL=https://api.example.com
  - TELEGRAM_CHAT_ID=123456789
  - ENABLE_ALERTS=true
  - RENTPROG_BASE_URL=https://api.rentprog.example
```

### Шаг 2: Перезапустите контейнер

```bash
docker compose down
docker compose up -d
```

### Шаг 3: Используйте в workflow

В любом workflow используйте переменные так:

**В выражении:**
```
{{ $env.MY_API_URL }}
{{ $env.TELEGRAM_CHAT_ID }}
{{ $env.ENABLE_ALERTS }}
```

**В Code ноде:**
```javascript
const apiUrl = $env.MY_API_URL;
const chatId = $env.TELEGRAM_CHAT_ID;
const alertsEnabled = $env.ENABLE_ALERTS === 'true';

return {
  apiUrl,
  chatId,
  alertsEnabled
};
```

## 📋 Пример для вашего проекта

Добавьте в `docker-compose.yml`:

```yaml
environment:
  # ... существующие ...
  
  # Ваши переменные
  - RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health
  - TELEGRAM_ALERT_CHAT_ID=ваш_chat_id
  - API_BASE_URL=https://api.example.com
```

**В workflow:**
- `{{ $env.RENTPROG_HEALTH_URL }}` - URL для проверки здоровья
- `{{ $env.TELEGRAM_ALERT_CHAT_ID }}` - ID чата для алертов
- `{{ $env.API_BASE_URL }}` - Базовый URL API

## 🔍 Как проверить

1. Добавьте переменную в docker-compose.yml
2. Перезапустите: `docker compose down && docker compose up -d`
3. В workflow создайте временную Code ноду:
```javascript
return {
  test: $env.MY_VARIABLE_NAME
};
```
4. Запустите workflow - если переменная доступна, увидите значение

## ⚠️ Важные замечания

1. **Имена переменных** должны быть в UPPER_CASE
2. **Все значения** - строки (для boolean используйте `'true'/'false'`)
3. **Изменения** требуют перезапуска контейнера
4. **Синтаксис**: `{{ $env.VARIABLE_NAME }}` (регистр важен!)

## 🆚 Сравнение

| Функция | Enterprise Variables | Community Env Vars |
|---------|---------------------|-------------------|
| UI настройка | ✅ Settings → Variables | ❌ Нет UI |
| Через docker-compose | ❌ | ✅ |
| Синтаксис | `$vars.myVar` | `$env.MY_VAR` |
| Изменение | Через UI | Через docker-compose |

## 💡 Итог

**В Community Edition:**
- Добавляйте переменные в `docker-compose.yml` → секция `environment`
- Используйте в workflow как `{{ $env.VARIABLE_NAME }}`
- Перезапускайте контейнер после изменений

UI для переменных нет, но они работают через docker-compose!


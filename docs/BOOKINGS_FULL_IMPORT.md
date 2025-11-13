# Полный импорт броней RentProg

## Статус: ✅ Готов к запуску

**Дата подготовки:** 2025-11-13  
**Workflow ID:** `P3BnmX7Nrmh1cusF`

---

## Что было сделано

### 1. Удалён date filter
- **Было:** `filters: {"start_date_from":"YYYY-MM-DD"}` (последние 30 дней)
- **Стало:** Без фильтра → импорт **ВСЕХ** броней

### 2. Увеличен per_page
- **Было:** `per_page: 50`
- **Стало:** `per_page: 100` (быстрее импорт)

### 3. Добавлен retry механизм
Согласно `.cursorrules` best practices:
```javascript
retryOnFail: true
maxTries: 2
continueOnFail: true
```

### 4. Увеличен timeout
- **Было:** Default (1 час)
- **Стало:** `7200s` (2 часа)

### 5. Включено сохранение прогресса
```javascript
saveExecutionProgress: true
saveDataSuccessExecution: 'all'
```

---

## Как запустить

### Через n8n UI (рекомендуется)

1. Открой: https://n8n.rentflow.rentals/workflow/P3BnmX7Nrmh1cusF
2. Нажми **"Execute Workflow"** (большая кнопка справа сверху)
3. Следи за прогрессом в реальном времени

### Мониторинг

- **Текущий execution:** В правом боковом меню появится прогресс
- **Все executions:** https://n8n.rentflow.rentals/executions
- **Прогресс в БД:** Следи за ростом количества записей

---

## Ожидаемый результат

### Параметры импорта
- **Филиалов:** 4 (tbilisi, batumi, kutaisi, service-center)
- **Типов броней:** 2 (активные + неактивные)
- **Всего запросов:** 8 параллельных потоков
- **Per page:** 100 записей
- **Примерно записей:** 10,000-20,000 (все исторические брони)

### Время выполнения
- **Оптимистично:** 30 минут
- **Реалистично:** 45-60 минут
- **Максимум (с timeout):** 120 минут

### Что произойдёт

1. **HTTP Request ноды** (8 шт.) выполнятся параллельно
2. **Merge All Branches** соберёт все данные
3. **Process All Bookings** распарсит JSON
4. **Save to DB** выполнит batch UPSERT
5. **If Error** проверит ошибки
6. **Success** или **Send Alert** завершат execution

---

## Мониторинг прогресса

### Через БД

```bash
# На сервере
cd /root/geodrive_n8n-agents
node setup/check_bookings_count.mjs
```

### Скрипт мониторинга

```bash
# Локально (каждые 30 сек)
cd C:\Users\33pok\geodrive_n8n-agents
python setup/monitor_n8n_execution.py P3BnmX7Nrmh1cusF
```

---

## Что делать после завершения

### 1. Проверить результат

```sql
SELECT 
  branch, 
  COUNT(*) as total,
  COUNT(DISTINCT number) as unique_bookings,
  COUNT(CASE WHEN is_technical THEN 1 END) as technical
FROM bookings 
GROUP BY branch;
```

### 2. Вернуть date filter

После успешного импорта **обязательно вернуть фильтр** для регулярных обновлений:

```bash
node setup/enable_date_filter_30_days.mjs
```

### 3. Активировать workflow

Если нужны автоматические обновления каждые 15 минут:

```bash
# Через n8n UI: переключить Active = true
# Или через API:
curl -X POST https://n8n.rentflow.rentals/api/v1/workflows/P3BnmX7Nrmh1cusF/activate \
  -H "X-N8N-API-KEY: your_key"
```

---

## Troubleshooting

### Execution завершился с ошибкой

1. Проверь execution в n8n UI
2. Найди ноду с ошибкой (красная)
3. Посмотри детали ошибки
4. Если timeout → увеличь в settings
5. Если API error → проверь токены

### Данные не сохраняются в БД

1. Проверь "Save to DB" ноду
2. Проверь credentials PostgreSQL
3. Проверь SQL query (должен быть UPSERT с ON CONFLICT)
4. Проверь логи PostgreSQL на сервере

### Execution висит

1. Проверь что `saveExecutionProgress = true`
2. Посмотри в БД растёт ли количество записей
3. Если нет прогресса > 10 минут → останови и перезапусти

---

## Возврат к регулярному режиму

После успешного полного импорта **ОБЯЗАТЕЛЬНО**:

1. Вернуть date filter (последние 30 дней)
2. Уменьшить per_page до 50 (меньше нагрузка)
3. Вернуть timeout к 1 часу
4. Активировать для автоматических запусков каждые 15 минут

**Скрипт для возврата:**
```bash
node setup/restore_regular_mode.mjs
```

---

## Ссылки

- **Workflow:** https://n8n.rentflow.rentals/workflow/P3BnmX7Nrmh1cusF
- **Executions:** https://n8n.rentflow.rentals/executions
- **Правила n8n:** `.cursorrules`
- **Best practices:** `claude.md` → "Best Practices: Проектирование надежных n8n workflow"


# 🤖 Error Handler - AI Agent Workflow

**Дата создания:** 2025-11-07  
**Статус:** ✅ Активен  
**Workflow ID:** `RNuZ1U40BIF9bnkJ`  
**URL:** https://n8n.rentflow.rentals/workflow/RNuZ1U40BIF9bnkJ

---

## 📋 Описание

Автоматическая система анализа ошибок n8n workflows с использованием AI (GPT-5 Codex) для генерации готовых промптов для исправления в Cursor.

### Что делает:
1. ✅ **Перехватывает ошибки** из всех подключенных workflows
2. ✅ **Дедуплицирует** - не тратит токены на одинаковые ошибки
3. ✅ **Классифицирует** - определяет тип и сложность ошибки
4. ✅ **Анализирует через AI** - GPT-5 Codex изучает код и контекст
5. ✅ **Генерирует Cursor промпт** - готовый промпт для исправления
6. ✅ **Отправляет в Telegram** - в чат "Ошибки n8n" (-1003251225615)
7. ✅ **Кэширует результаты** - для экономии токенов

---

## 🎯 Ключевые возможности

### 1. **Умная дедупликация**
- Нормализует сообщения об ошибках (убирает ID, числа, пути)
- Создает SHA-256 hash для идентификации
- Кэширует AI-анализ на 7 дней
- Экономия **60-80% токенов** на повторяющихся ошибках

### 2. **Многоуровневая классификация**

| Тип ошибки | Сложность | AI модель | Стоимость/запрос |
|-----------|-----------|-----------|------------------|
| TypeScript (типы, синтаксис) | Simple | gpt-5-nano | ~$0.001 |
| API (HTTP, timeout) | Medium | gpt-5-mini | ~$0.006 |
| Database (схемы, constraints) | Complex | **gpt-5-codex** | ~$0.03 |
| Logic (deadlocks, race) | Critical | o3-mini | ~$0.02 |

### 3. **Контекстный анализ**
- Изучает репозиторий GitHub (опционально)
- Понимает архитектуру проекта
- Учитывает документацию (ARCHITECTURE.md, STRUCTURE.md)
- Генерирует конкретные решения

### 4. **Telegram интеграция**
- **Сообщение 1:** Информация об ошибке + статистика
- **Сообщение 2:** Готовый Cursor промпт (моноширинный, до 3500 символов)

---

## 🔧 Настройка

### 1. **Необходимые Credentials**

Убедитесь, что настроены следующие credentials в n8n:

#### PostgreSQL (Neon)
- **ID:** `neon_postgres`
- **Host:** `ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech`
- **Database:** `neondb`
- **User:** `neondb_owner`
- **SSL:** Enable (reject unauthorized = false)

#### Telegram Bot
- **ID:** `telegram_alert_bot`
- **Bot:** `@n8n_alert_geodrive_bot`
- **Token:** (из BotFather)
- **Chat ID:** `-1003251225615` (Ошибки n8n)

#### OpenAI API Key
- **ID:** `openai_api_key`
- **Type:** HTTP Header Auth
- **Header:** `Authorization`
- **Value:** `Bearer YOUR_OPENAI_API_KEY`

#### GitHub OAuth2 (опционально)
- **ID:** `github_oauth`
- **Repository:** `geodrive_n8n-agents`
- **Owner:** `geodrive-admin`

---

### 2. **Добавление в существующие workflows**

#### Автоматически (рекомендуется):
```bash
node setup/add_error_workflow_to_all.mjs
```

Скрипт автоматически добавит Error Workflow в критичные workflows:
- Service Center Processor Rentprog
- Tbilisi Processor Rentprog
- Batumi Processor Rentprog
- Kutaisi Processor Rentprog
- RentProg Webhooks Monitor
- RentProg Upsert Processor
- Health & Status
- Sync Progress
- Auto Company Cash Parser

#### Вручную:
1. Откройте workflow в n8n
2. Settings (⚙️) → Error Workflow
3. Выберите **"Error Handler - AI Agent"**
4. Сохраните

---

## 📊 База данных

### Таблица `error_analysis_cache`

Создана автоматически при первом запуске:

```sql
CREATE TABLE error_analysis_cache (
  id UUID PRIMARY KEY,
  error_hash VARCHAR(64) UNIQUE,  -- SHA-256 hash ошибки
  
  -- Информация об ошибке
  workflow_id TEXT,
  workflow_name TEXT,
  node_name TEXT,
  error_message TEXT,
  error_type VARCHAR(50),
  
  -- AI анализ
  ai_model_used VARCHAR(50),
  ai_analysis TEXT,
  cursor_prompt TEXT,
  estimated_cost DECIMAL(10, 6),
  
  -- Статистика
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  
  -- Мета
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Просмотр статистики:**
```sql
-- Топ повторяющихся ошибок
SELECT 
  workflow_name,
  error_type,
  occurrence_count,
  last_seen
FROM error_analysis_cache
ORDER BY occurrence_count DESC
LIMIT 10;

-- Общая статистика
SELECT 
  error_type,
  COUNT(*) as unique_errors,
  SUM(occurrence_count) as total_occurrences,
  SUM(estimated_cost) as total_cost
FROM error_analysis_cache
GROUP BY error_type;
```

---

## 💰 Стоимость

### Модели и цены (за 1M токенов):

| Модель | Input | Output | Типичный запрос |
|--------|-------|--------|-----------------|
| gpt-5-nano | $0.05 | $0.40 | ~$0.001 |
| gpt-5-mini | $0.25 | $2.00 | ~$0.006 |
| **gpt-5-codex** | **$1.25** | **$10.00** | **~$0.03** |
| o3-mini | $1.10 | $4.40 | ~$0.02 |

### Расчет на месяц:

```javascript
// Без кэша (100 ошибок):
100 * $0.03 = $3.00

// С кэшем (100 ошибок, 70% повторы):
30 * $0.03 = $0.90  // 30 новых ошибок
70 * $0 = $0        // 70 из кэша

// Итого: ~$1/месяц 💰
```

---

## 🔍 Как работает

### Workflow структура:

```
Error Trigger
    ↓
Extract Context (Code) → Классифицирует ошибку
    ↓
Check Cache (PostgreSQL) → Ищет в БД
    ↓
Is Cached? (IF)
    ↓                          ↓
CACHED PATH              NEW ERROR PATH
    ↓                          ↓
Format Cached Message    Get Repo Structure (GitHub)
    ↓                          ↓
Update Counter           Build AI Prompt (Code)
    ↓                          ↓
Send to Telegram         Call OpenAI (gpt-5-codex)
    ↓                          ↓
Send Cursor Prompt       Format New Message
                              ↓
                         Save to Cache (PostgreSQL)
                              ↓
                         Send to Telegram
                              ↓
                         Send Cursor Prompt
```

### Алгоритм нормализации ошибок:

```javascript
"Cannot insert into table 'cars' - null value in column 'plate' (car ID: 12345)"
    ↓ Убираем числа
"Cannot insert into table 'cars' - null value in column 'plate' (car ID: N)"
    ↓ SHA-256 hash
"a3f5c8d9e2b4..." → Используется для поиска в кэше
```

---

## 📨 Формат сообщений в Telegram

### Повторяющаяся ошибка (из кэша):

```
🔁 ПОВТОРЯЮЩАЯСЯ ОШИБКА (AI токены не потрачены ✅)

📋 Workflow: RentProg Upsert Processor
   • ID: JnMuyk6G1A84pWiK
🔴 Node: Extract Error Context (code)
⏰ Время: 07.11.2025, 10:30:45

❌ Ошибка:
Cannot read property 'id' of undefined

📊 Статистика:
• Всего появлений: 15
• Первое: 05.11.2025, 14:20:00
• Последнее: 07.11.2025, 10:30:45
• AI модель (кэш): gpt-5-codex
• Стоимость кэша: $0.0325

💾 Решение в кэше - см. следующее сообщение

🔗 View: https://n8n.rentflow.rentals/...
```

### Новая ошибка:

```
🚨 НОВАЯ ОШИБКА (AI анализ выполнен)

📋 Workflow: Service Center Processor
   • ID: PbDKuU06H7s2Oem8
🔴 Node: Upsert Car (postgres)
⏰ Время: 07.11.2025, 10:35:12

❌ Ошибка:
null value in column "plate" violates not-null constraint

🤖 AI Анализ:
• Модель: gpt-5-codex
• Тип: database
• Сложность: complex
• Стоимость: ~$0.0325

✅ Cursor промпт готов - см. следующее сообщение

🔗 View: https://n8n.rentflow.rentals/...
```

### Cursor промпт (моноширинный):

```
ОШИБКА: null value in column "plate" violates not-null constraint

КОНТЕКСТ:
- Workflow: Service Center Processor
- Node: Upsert Car
- Файл: src/db/upsert.ts

ПРОБЛЕМА:
При вставке автомобиля в БД поле "plate" (госномер) 
отправляется как NULL, но в схеме оно NOT NULL.

АНАЛИЗ:
В функции upsertCarFromRentProg() извлечение plate 
происходит через extractCarFields(), которая возвращает 
null если данных нет. Нужно добавить валидацию.

РЕШЕНИЕ:
Исправь src/db/upsert.ts следующим образом:

1. Добавь валидацию перед insert:
   if (!extractedFields.plate) {
     console.warn(`Car without plate: ${rentprogId}`);
     extractedFields.plate = 'UNKNOWN';
   }

2. Или обнови схему, сделав plate nullable:
   plate: text('plate'),  // Убрать .notNull()

ФАЙЛЫ:
- src/db/upsert.ts (строки 140-172)
- src/db/schema.ts (строка 44)
```

---

## 🧪 Тестирование

### 1. Создайте тестовый workflow с ошибкой:

```javascript
// Node: "Test Error"
// Type: Code
throw new Error('Test error for AI analysis');
```

### 2. Настройте Error Workflow:
Settings → Error Workflow → Error Handler - AI Agent

### 3. Запустите и проверьте:
- Сообщение пришло в Telegram?
- Cursor промпт сгенерирован?
- Запись появилась в `error_analysis_cache`?

### 4. Проверьте кэширование:
- Запустите еще раз
- Должно прийти сообщение "ПОВТОРЯЮЩАЯСЯ ОШИБКА"
- AI не должен вызываться повторно

---

## 📈 Мониторинг

### SQL запросы для мониторинга:

```sql
-- Сколько токенов потрачено за сегодня
SELECT 
  SUM(estimated_cost) as cost_today,
  COUNT(*) as new_errors_today
FROM error_analysis_cache
WHERE DATE(created_at) = CURRENT_DATE;

-- Какие workflows ошибаются чаще всего
SELECT 
  workflow_name,
  COUNT(*) as error_types,
  SUM(occurrence_count) as total_errors
FROM error_analysis_cache
GROUP BY workflow_name
ORDER BY total_errors DESC;

-- Эффективность кэша
SELECT 
  SUM(CASE WHEN occurrence_count = 1 THEN 1 ELSE 0 END) as unique_errors,
  SUM(CASE WHEN occurrence_count > 1 THEN occurrence_count - 1 ELSE 0 END) as cached_hits,
  ROUND(100.0 * SUM(CASE WHEN occurrence_count > 1 THEN occurrence_count - 1 ELSE 0 END) / 
    NULLIF(SUM(occurrence_count), 0), 2) as cache_hit_rate_percent
FROM error_analysis_cache;
```

---

## 🔧 Troubleshooting

### Ошибка: "credentials not found"
**Решение:** Проверьте, что все credentials настроены в n8n

### Ошибка: "OpenAI API rate limit"
**Решение:** Подождите или увеличьте лимит на OpenAI dashboard

### Не приходят сообщения в Telegram
**Решение:** 
- Проверьте, что бот добавлен в чат -1003251225615
- Проверьте права бота (должен уметь отправлять сообщения)

### Cursor промпт пустой/некорректный
**Решение:** 
- Проверьте логи OpenAI вызова
- Возможно, нужно добавить больше контекста в промпт

---

## 📚 Ссылки

- [n8n Documentation](https://docs.n8n.io/)
- [OpenAI GPT-5 Pricing](https://openai.com/pricing)
- [Cursor Documentation](https://cursor.sh/docs)
- [Project Architecture](./ARCHITECTURE.md)
- [Database Structure](./STRUCTURE.md)

---

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи workflow в n8n
2. Проверьте таблицу `error_analysis_cache`
3. Посмотрите executions с ошибками

**Важно:** Error Workflow имеет `continueOnFail: true` на критичных нодах, чтобы избежать бесконечного цикла ошибок.

---

**Последнее обновление:** 2025-11-07  
**Версия:** 1.0  
**Статус:** ✅ Production Ready


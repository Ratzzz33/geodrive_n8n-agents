# Реализация связывания сотрудников Telegram ↔ RentProg

**Дата:** 2025-11-05  
**Статус:** ✅ Готово к тестированию

---

## Проблема

Сотрудники Jarvis (Telegram) не связаны с RentProg employee IDs. Необходимо:
1. Регистрировать сотрудников в Telegram боте
2. Связывать их с RentProg аккаунтами
3. Использовать связь для персонализированных уведомлений

---

## Решение: Команда `/link_rentprog`

### Архитектура

```
┌─────────────────┐
│  Telegram User  │
│   (tg_user_id)  │
└────────┬────────┘
         │
         │ /start
         ▼
┌─────────────────┐
│   employees     │
│   (Jarvis DB)   │
│  • id (UUID)    │
│  • tg_user_id   │
│  • name         │
└────────┬────────┘
         │
         │ /link_rentprog 14714
         ▼
┌─────────────────┐
│ external_refs   │
│ • system='rp'   │
│ • entity_type   │
│ • entity_id ────┘ (link)
│ • external_id='14714'
└─────────────────┘
         │
         │ (извлечено из bookings)
         ▼
┌─────────────────┐
│ RentProg API    │
│ booking.issue_  │
│ employee_id     │
└─────────────────┘
```

---

## Реализованные команды

### 1. `/start` - Регистрация

**Файл:** `src/bot/commands/start.ts`

**Функционал:**
- Проверка существования по `tg_user_id`
- Создание записи в `employees`:
  - `name` из Telegram (first_name + last_name)
  - `tg_user_id` = Telegram User ID
  - `tg_username` = @username
  - `role` = 'employee'

**Пример:**
```
/start

🎉 Добро пожаловать в систему Jarvis!

👤 Зарегистрированы как: Иван Иванов
🆔 Ваш ID: 123e4567-...

Следующие шаги:
1️⃣ Свяжите ваш аккаунт с RentProg:
   /link_rentprog <ваш_RentProg_ID>

2️⃣ Проверьте информацию:
   /myinfo
```

---

### 2. `/link_rentprog <ID>` - Связывание

**Файл:** `src/bot/commands/link_rentprog.ts`

**Аргументы:**
- `<ID>` - RentProg employee ID (например, 14714)

**Процесс:**
1. ✅ Проверка регистрации в Jarvis
2. ✅ Проверка существования RentProg ID в `external_refs`
3. ✅ Проверка что RentProg ID не связан с другим
4. ✅ Проверка что сотрудник не связан с другим RentProg ID
5. ✅ Обновление `external_refs.entity_id`

**Валидация:**
- Нет регистрации → "Сначала выполните /start"
- RentProg ID не найден → "Вас еще не упоминали в бронях"
- ID занят → "Связан с другим сотрудником"
- Уже связан → "Вы уже связаны с другим ID"

**Пример успеха:**
```
/link_rentprog 14714

✅ Успешно связано!

👤 Jarvis: Иван Иванов
🔗 RentProg: Ivane Ivanishvili (ID: 14714)

🎉 Теперь вы будете получать:
• Уведомления о ваших бронях
• Напоминания о задачах
• Персонализированные алерты
```

---

### 3. `/myinfo` - Информация

**Файл:** `src/bot/commands/myinfo.ts`

**Показывает:**
- Данные из `employees` (Jarvis)
- Связь с RentProg через `external_refs`
- Доступные команды

**Пример:**
```
/myinfo

👤 Информация о вас

Jarvis:
• ID: 123e4567-...
• Имя: Иван Иванов
• Telegram ID: 123456789
• Роль: employee
• Зарегистрирован: 05.11.2025

RentProg:
• ✅ Связан
• ID: 14714
• Имя: Ivane Ivanishvili

Доступные команды:
• /myinfo - эта информация
• /help - помощь
```

---

## Структура БД

### Таблица `employees`

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT DEFAULT 'employee',
  branch_id UUID REFERENCES branches(id),
  tg_user_id BIGINT UNIQUE,  -- Telegram User ID
  tg_username TEXT,           -- @username
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_tg_user_id ON employees(tg_user_id);
```

### Таблица `external_refs`

```sql
CREATE TABLE external_refs (
  id BIGSERIAL PRIMARY KEY,
  system TEXT NOT NULL,           -- 'rentprog'
  entity_type TEXT NOT NULL,      -- 'employee'
  entity_id UUID,                 -- employees.id (NULL до связывания)
  external_id TEXT NOT NULL,      -- RentProg employee ID
  data JSONB,                     -- {"name": "Ivane Ivanishvili"}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT external_refs_unique 
    UNIQUE (system, entity_type, external_id)
);

CREATE INDEX idx_external_refs_lookup 
  ON external_refs(system, entity_type, entity_id);
CREATE INDEX idx_external_refs_external_id 
  ON external_refs(system, entity_type, external_id);
```

---

## Откуда берутся RentProg employee IDs

### Источник: Bookings

RentProg **не имеет** отдельного endpoint для получения списка сотрудников.

Мы извлекаем их из **bookings** при обработке:

**Webhook payload:**
```json
{
  "id": "470049",
  "issue_employee_id": "14714",
  "issue_employee_name": "Ivane Ivanishvili",
  "return_employee_id": "14715",
  "return_employee_name": "Giorgi Giorgadze"
}
```

**Процесс:**
1. Webhook от RentProg → n8n
2. n8n → Jarvis API `/process-event`
3. Jarvis:
   ```typescript
   // Извлечь employee IDs
   const issueEmployeeId = booking.issue_employee_id;
   const returnEmployeeId = booking.return_employee_id;
   
   // Upsert в external_refs
   await upsertExternalRef({
     system: 'rentprog',
     entity_type: 'employee',
     external_id: issueEmployeeId,
     data: { name: booking.issue_employee_name }
   });
   ```

**Важно:**
- Сотрудник появляется в системе только после первого упоминания в брони
- До этого команда `/link_rentprog <ID>` вернет "не найден"

---

## Флоу для нового сотрудника

### Сценарий 1: Сначала Telegram, потом RentProg

```
1. Сотрудник → /start
   ✅ Создана запись в employees (entity_id = UUID)

2. (время проходит, сотрудника назначают на бронь в RentProg)

3. RentProg → webhook
   ✅ Создана запись в external_refs (entity_id = NULL)

4. Сотрудник → /link_rentprog 14714
   ❌ "RentProg ID не найден"
   
   (ждем пока система обработает webhook)

5. Повторно → /link_rentprog 14714
   ✅ Связь создана (external_refs.entity_id = employees.id)
```

### Сценарий 2: Сначала RentProg, потом Telegram

```
1. Сотрудника назначают на бронь в RentProg

2. RentProg → webhook
   ✅ Создана запись в external_refs (entity_id = NULL)

3. Сотрудник → /start
   ✅ Создана запись в employees

4. Сотрудник → /link_rentprog 14714
   ✅ Связь создана (external_refs.entity_id = employees.id)
```

---

## Интеграция с ботом

### Обновлен `src/bot/index.ts`

```typescript
import { startCommand } from './commands/start.js';
import { linkRentprogCommand } from './commands/link_rentprog.js';
import { myinfoCommand } from './commands/myinfo.js';

// Регистрация команд
bot.command('start', startCommand);
bot.command('link_rentprog', linkRentprogCommand);
bot.command('myinfo', myinfoCommand);
```

### Обновлена `/help`

```
📋 Доступные команды:

Личные:
/start - Регистрация в системе
/myinfo - Информация о вас
/link_rentprog <ID> - Связать с RentProg аккаунтом

Система:
/help - Показать это сообщение
/status - Проверить статус системы
/sync_rentprog - Первичная синхронизация RentProg
```

---

## Файлы

### Созданы

1. ✅ `src/bot/commands/start.ts` - регистрация
2. ✅ `src/bot/commands/link_rentprog.ts` - связывание
3. ✅ `src/bot/commands/myinfo.ts` - информация
4. ✅ `src/bot/commands/index.ts` - экспорт команд
5. ✅ `docs/BOT_COMMANDS.md` - полная документация

### Обновлены

1. ✅ `src/bot/index.ts` - регистрация команд
2. ✅ `src/db/schema.ts` - таблицы employees, external_refs

---

## Тестирование

### Тест 1: Регистрация нового пользователя

```bash
# В Telegram боте
/start

# Ожидается:
# ✅ Создана запись в employees
# ✅ Показано приветствие с инструкциями
```

**Проверка в БД:**
```sql
SELECT * FROM employees 
WHERE tg_user_id = <ваш_telegram_id>;
```

---

### Тест 2: Связывание с несуществующим RentProg ID

```bash
/link_rentprog 99999

# Ожидается:
# ❌ "Сотрудник с RentProg ID 99999 не найден"
```

---

### Тест 3: Создание external_ref через webhook

**Вариант A: Через тестовый скрипт**

```bash
node setup/link_employees_tables.mjs
```

Этот скрипт:
- Извлекает всех сотрудников из bookings
- Создает записи в `external_refs`

**Вариант B: Ждать настоящий webhook**

Когда придет webhook от RentProg с `issue_employee_id`, система автоматически создаст запись.

---

### Тест 4: Успешное связывание

```bash
# После создания external_ref
/link_rentprog 14714

# Ожидается:
# ✅ "Успешно связано!"
# ✅ Показана информация о связи
```

**Проверка в БД:**
```sql
SELECT 
  e.name AS jarvis_name,
  er.external_id AS rentprog_id,
  er.data->>'name' AS rentprog_name
FROM employees e
JOIN external_refs er ON er.entity_id = e.id
WHERE er.system = 'rentprog' 
  AND er.entity_type = 'employee';
```

---

### Тест 5: Повторное связывание

```bash
/link_rentprog 14714

# Ожидается:
# ✅ "Вы уже связаны с этим RentProg аккаунтом!"
```

---

### Тест 6: Просмотр информации

```bash
/myinfo

# Ожидается:
# ✅ Показаны данные из Jarvis
# ✅ Показана связь с RentProg
# ✅ Показаны доступные команды
```

---

## SQL запросы для мониторинга

### Все связанные сотрудники

```sql
SELECT 
  e.id,
  e.name AS jarvis_name,
  e.tg_user_id,
  e.tg_username,
  er.external_id AS rentprog_id,
  er.data->>'name' AS rentprog_name,
  e.created_at AS registered_at
FROM employees e
JOIN external_refs er ON er.entity_id = e.id
WHERE er.system = 'rentprog' 
  AND er.entity_type = 'employee'
ORDER BY e.created_at DESC;
```

### Несвязанные RentProg сотрудники

```sql
SELECT 
  external_id AS rentprog_id,
  data->>'name' AS rentprog_name,
  created_at AS first_seen
FROM external_refs
WHERE system = 'rentprog' 
  AND entity_type = 'employee'
  AND entity_id IS NULL
ORDER BY created_at DESC;
```

### Зарегистрированные но не связанные Telegram пользователи

```sql
SELECT 
  e.id,
  e.name,
  e.tg_user_id,
  e.tg_username,
  e.created_at
FROM employees e
WHERE e.tg_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM external_refs er
    WHERE er.entity_id = e.id
      AND er.system = 'rentprog'
      AND er.entity_type = 'employee'
  )
ORDER BY e.created_at DESC;
```

---

## Следующие шаги

### 1. Тестирование на продакшене

- [ ] Запустить бота
- [ ] Попросить 2-3 сотрудников протестировать
- [ ] Проверить что связи создаются корректно

### 2. Использование связей

После успешного связывания можно реализовать:

**Агент контролер броней:**
```typescript
// Найти ответственного сотрудника
const employee = await getEmployeeByRentProgId(booking.issue_employee_id);

if (employee?.tg_user_id) {
  // Отправить уведомление в Telegram
  await bot.telegram.sendMessage(
    employee.tg_user_id,
    `⏰ Напоминание: выдача авто через 30 минут\n` +
    `🚗 ${carName}\n` +
    `📍 ${booking.branch}`
  );
}
```

**Дневной план:**
```typescript
// Получить все брони сотрудника на сегодня
const todayBookings = await getEmployeeBookingsForDate(
  employee.id, 
  new Date()
);

// Отправить план
await sendDailyPlan(employee.tg_user_id, todayBookings);
```

### 3. Миграция существующих данных

```bash
# Извлечь всех сотрудников из исторических bookings
node setup/link_employees_tables.mjs

# Результат:
# ✅ Созданы external_refs для всех упомянутых сотрудников
# ✅ Готово к связыванию командой /link_rentprog
```

---

## Безопасность

### Валидация

- ✅ Проверка существования пользователя
- ✅ Проверка прав на связывание
- ✅ Защита от дублирования связей
- ✅ Проверка что RentProg ID существует

### Логирование

Все операции логируются:
```
✅ New employee registered: UUID (Иван Иванов)
✅ Linked: employee UUID (Иван Иванов) → rentprog 14714
```

### Error Handling

Все ошибки обрабатываются gracefully:
- Database errors → "Попробуйте позже"
- Invalid input → Подсказки по использованию
- Edge cases → Понятные сообщения

---

## Документация

Полная документация в `docs/BOT_COMMANDS.md`:
- Описание всех команд
- Примеры использования
- Возможные ошибки
- SQL запросы для проверки
- Архитектура системы

---

## Заключение

✅ **Готово к продакшену:**
- Реализованы все команды
- Добавлена валидация
- Написана документация
- Готовы тесты

🚀 **Следующий шаг:**
```bash
# Запустить бота
npm run dev

# В Telegram:
/start
/link_rentprog <ваш_RentProg_ID>
/myinfo
```

📚 **Документация:**
- Команды бота: `docs/BOT_COMMANDS.md`
- Архитектура: `ARCHITECTURE.md`
- Агенты: `AGENTS.md`


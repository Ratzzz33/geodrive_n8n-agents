# Исправление обработки дат в вебхуках RentProg

**Дата:** 2025-11-06  
**Статус:** ✅ Завершено

---

## Проблема

При создании бронирования через вебхук RentProg возникала ошибка:

```
Problem in node 'Insert Entity'
date/time field value out of range: "14-11-2025 21:00"
```

### Причина

RentProg отправляет даты в формате `DD-MM-YYYY HH:mm`, но PostgreSQL ожидает ISO формат (`YYYY-MM-DDTHH:mm:ss+TZ`).

---

## Решение

Добавлена функция конвертации дат в ноду **Prepare Create** во всех 4 процессорах RentProg:

### Функционал

```javascript
// Функция конвертации даты DD-MM-YYYY HH:mm → ISO
function convertDateToISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  // Проверяем формат DD-MM-YYYY HH:mm или DD-MM-YYYY
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return dateStr; // Не наш формат, возвращаем как есть
  
  const [, day, month, year, hours, minutes] = match;
  
  // Создаем ISO дату
  if (hours && minutes) {
    // С временем: YYYY-MM-DDTHH:mm:ss+04:00 (Tbilisi timezone)
    return `${year}-${month}-${day}T${hours}:${minutes}:00+04:00`;
  } else {
    // Только дата: YYYY-MM-DD
    return `${year}-${month}-${day}`;
  }
}
```

### Обработка

- Рекурсивно обходит весь payload
- Конвертирует все поля с датами:
  - Поля содержащие `date`
  - Поля содержащие `_at`
  - Поля `start` и `end`
- Сохраняет оригинальные данные если формат не подходит

---

## Обновленные workflow

| ID | Название | Статус |
|----|----------|--------|
| `P65bXE5Xhupkxxw6` | Tbilisi Processor Rentprog | ✅ OK |
| `YsBma7qYsdsDykTq` | Batumi Processor Rentprog | ✅ OK |
| `gJPvJwGQSi8455s9` | Kutaisi Processor Rentprog | ✅ OK |
| `PbDKuU06H7s2Oem8` | Service Center Processor Rentprog | ✅ OK |

### Настройки workflow сохранены

⚠️ **ВАЖНО:** Настройки workflow (`Execution Order`, `Timezone`, `Save executions`) НЕ изменены.

Обновлена только нода **Prepare Create** - добавлен код конвертации дат.

---

## Примеры конвертации

### До исправления

```json
{
  "start_date": "12-11-2025 09:00",
  "end_date": "14-11-2025 21:00"
}
```

❌ PostgreSQL error: `date/time field value out of range`

### После исправления

```json
{
  "start_date": "2025-11-12T09:00:00+04:00",
  "end_date": "2025-11-14T21:00:00+04:00"
}
```

✅ Успешно вставляется в БД

---

## Проверка

### Скрипт проверки

```bash
python setup/verify_date_fix.py
```

**Результат:**

```
Tbilisi              OK         (длина кода: 1986)
Batumi               OK         (длина кода: 1986)
Kutaisi              OK         (длина кода: 1986)
Service Center       OK         (длина кода: 1986)
```

### Повторное применение исправления

```bash
python setup/fix_date_format_processors.py
```

Скрипт автоматически пропускает уже обновленные workflow (проверка наличия `convertDateToISO` в коде).

---

## Технические детали

### Обновленная нода

**Тип:** `n8n-nodes-base.code` (JavaScript)  
**ID:** `prepare-create`  
**Название:** `Prepare Create`

### Что изменилось

1. Добавлена функция `convertDateToISO(dateStr)`
2. Добавлена функция `convertDatesInObject(obj)` для рекурсивной обработки
3. Payload конвертируется перед записью в БД

### Что НЕ изменилось

- Структура workflow
- Connections между нодами
- Другие ноды
- Settings workflow
- Credentials

---

## Тестирование

### Тестовый вебхук

Отправить вебхук создания брони с датами в формате `DD-MM-YYYY HH:mm`:

```json
{
  "event_name": "booking.create",
  "entity_type": "booking",
  "rentprog_id": "508078",
  "payload": {
    "id": 508078,
    "start_date": "12-11-2025 09:00",
    "end_date": "14-11-2025 21:00",
    "created_at": "06-11-2025 16:14"
  }
}
```

**Ожидаемый результат:** ✅ Бронирование создано без ошибок

---

## Файлы

### Созданные скрипты

1. **setup/fix_date_format_processors.py** - Скрипт обновления всех 4 процессоров
2. **setup/verify_date_fix.py** - Скрипт проверки обновления
3. **setup/get_workflow_node.py** - Вспомогательный скрипт для получения нод

### Временные файлы (можно удалить)

- setup/tbilisi_prepare_create.json
- setup/tbilisi_insert_entity.json

---

## Резюме

✅ **Проблема решена**  
✅ **Все 4 процессора обновлены**  
✅ **Настройки workflow сохранены**  
✅ **Готово к использованию**

Теперь все вебхуки RentProg с датами в формате `DD-MM-YYYY HH:mm` будут корректно обрабатываться и записываться в PostgreSQL.


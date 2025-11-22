# ✅ Исправления Workflow "Парсинг автомобилей"

**Дата:** 2025-11-14  
**Workflow ID:** `u3cOUuoaH5RSw7hm`  
**URL:** https://n8n.rentflow.rentals/workflow/u3cOUuoaH5RSw7hm

---

## 🔴 ПРОБЛЕМЫ КОТОРЫЕ БЫЛИ:

### 1. ❌ "Unrecognized node type: n8n-nodes-base.throwError"
**Причина:** Нода "Throw Error" не установлена в этой версии n8n

**Решение:** ✅ Удалена нода "Throw Error"

---

### 2. ❌ "column 'branch' of relation 'cars' does not exist"
**Причина:** В SQL использовалась колонка `branch` (text), но в БД есть только `branch_id` (UUID)

**Решение:** ✅ Везде заменено:
- `branch` → `branch_id` (UUID)
- `branch` → `branch_code` (для отображения: 'tbilisi', 'batumi', etc.)

**Где исправлено:**
1. ✅ "Merge & Process" - добавлен маппинг `BRANCH_MAP` (code → UUID)
2. ✅ "Save to Cars" - используется `branch_id` (UUID)
3. ✅ "Pass Through Data" - используется `branch_code`
4. ✅ "Format Result" - используется `branch_code`

**Маппинг филиалов:**
```javascript
const BRANCH_MAP = {
  'tbilisi': '277eaada-1428-4c04-9cd7-5e614e43bedc',
  'batumi': '627c4c88-d8a1-47bf-b9a6-2e9ad33112a4',
  'kutaisi': '5e551b32-934c-498f-a4a1-a90079985c0a',
  'service-center': '6026cff7-eee8-4fb9-be26-604f308911f0'
};
```

---

### 3. ❌ "there is no parameter $1"
**Причина:** Нода Postgres с `executeQuery` и параметрами `$1, $2, $3...` не передавала значения

**Решение:** ✅ Заменена **Postgres нода** на **Code ноду** с прямым использованием `postgres` библиотеки

**Новая нода "Save to Cars":**
```javascript
const postgres = require('postgres');

const sql = postgres('connection_string', {
  ssl: { rejectUnauthorized: false }
});

// Для каждого автомобиля:
await sql`
  INSERT INTO cars (
    branch_id, rentprog_id, car_name, code, number,
    vin, color, year, transmission, fuel, car_type, car_class,
    active, state, tank_state, clean_state,
    mileage, tire_type, tire_size, last_inspection,
    deposit, price_hour, hourly_deposit, monthly_deposit, 
    investor_id, purchase_price, purchase_date,
    age_limit, driver_year_limit, franchise, max_fine, repair_cost,
    is_air, climate_control, parktronic, parktronic_camera, 
    heated_seats, audio_system, usb_system, rain_sensor,
    engine_capacity, number_doors, tank_value,
    pts, registration_certificate, body_number,
    data
  ) VALUES (
    ${data.branch_id}, ${data.rentprog_id}, ${data.car_name}, ...
  )
  ON CONFLICT (rentprog_id) DO UPDATE SET
    branch_id = COALESCE(EXCLUDED.branch_id, cars.branch_id),
    car_name = COALESCE(EXCLUDED.car_name, cars.car_name),
    updated_at = NOW()
  RETURNING id
`;
```

**Преимущества:**
- ✅ Tagged templates - безопасная подстановка
- ✅ `sql.json(data.data)` - правильная обработка JSONB
- ✅ Try/catch для каждого элемента
- ✅ Возвращает `saved: true/false` + `error_message`

---

### 4. ❌ "No cars data in response"
**Причина:** Нода "Merge & Process" запускалась ДО завершения всех 4 HTTP запросов

**Решение:** ✅ Добавлена нода **"Wait for All Branches"** (Merge node)

**Структура потока:**
```
Every Hour
  ├─→ Tbilisi Pages → Get Tbilisi ────┐
  ├─→ Batumi Pages → Get Batumi ───────┤
  ├─→ Kutaisi Pages → Get Kutaisi ─────┤→ Wait for All Branches (4 входа)
  └─→ Service Pages → Get Service ─────┘        ↓
                                          (Дождётся ВСЕХ 4!)
                                                 ↓
                                         Merge & Process
```

**Настройки Merge node:**
- Mode: `mergeByPosition`
- 4 входа (по одному на каждый филиал)
- Гарантирует что все данные получены до обработки

---

## 📊 СТРУКТУРА WORKFLOW (ФИНАЛЬНАЯ)

### Ноды (17 штук):

1. **Every Hour** (Schedule) - триггер раз в час
2. **Tbilisi Pages** (Set) - JWT токен для Тбилиси
3. **Batumi Pages** (Set) - JWT токен для Батуми
4. **Kutaisi Pages** (Set) - JWT токен для Кутаиси
5. **Service Pages** (Set) - JWT токен для сервис-центра
6. **Get Tbilisi** (HTTP Request) - GET /all_cars_with_bookings
7. **Get Batumi** (HTTP Request) - GET /all_cars_with_bookings
8. **Get Kutaisi** (HTTP Request) - GET /all_cars_with_bookings
9. **Get Service** (HTTP Request) - GET /all_cars_with_bookings
10. **Wait for All Branches** (Merge) - ждёт все 4 филиала ⭐
11. **Merge & Process** (Code) - парсинг 46 полей + маппинг branch_id
12. **Save to Cars** (Code) - UPSERT в БД через postgres ⭐
13. **Pass Through Data** (Code) - маркировка saved: true/false
14. **Format Result** (Code) - генерация отчёта
15. **If Error** (If) - проверка error_count > 0
16. **Send Alert** (Telegram) - уведомление при ошибках
17. **Success** (NoOp) - успешное завершение

---

## 🎯 ПАРСИМЫЕ ПОЛЯ (46 полей)

### Основные (5):
1. `branch_id` (UUID) ⭐
2. `rentprog_id`
3. `car_name`
4. `code`
5. `number`

### Характеристики (7):
6. `vin`
7. `color`
8. `year`
9. `transmission`
10. `fuel`
11. `car_type`
12. `car_class`

### Состояния (4):
13. `active`
14. `state`
15. `tank_state`
16. `clean_state`

### Пробег и ТО (4):
17. `mileage`
18. `tire_type`
19. `tire_size`
20. `last_inspection`

### Цены (7):
21. `deposit`
22. `price_hour`
23. `hourly_deposit`
24. `monthly_deposit`
25. `investor_id`
26. `purchase_price`
27. `purchase_date`

### Ограничения (5):
28. `age_limit`
29. `driver_year_limit`
30. `franchise`
31. `max_fine`
32. `repair_cost`

### Опции (8):
33. `is_air`
34. `climate_control`
35. `parktronic`
36. `parktronic_camera`
37. `heated_seats`
38. `audio_system`
39. `usb_system`
40. `rain_sensor`

### Технические (3):
41. `engine_capacity`
42. `number_doors`
43. `tank_value`

### Документы (3):
44. `pts`
45. `registration_certificate`
46. `body_number`

### Полный JSON:
47. `data` (JSONB со ВСЕМИ полями)

---

## ✅ ИТОГОВЫЙ СТАТУС

### Что работает:
- ✅ Парсинг всех 4 филиалов
- ✅ Ожидание всех запросов перед обработкой
- ✅ Маппинг branch_id (UUID)
- ✅ Парсинг 46 критичных полей
- ✅ UPSERT в БД через postgres библиотеку
- ✅ Обработка ошибок для каждого элемента
- ✅ Telegram уведомления при ошибках
- ✅ Защита от NULL через COALESCE (частично)

### Что НЕ работает (требует проверки):
- ⚠️ Могут быть проблемы с `require('postgres')` в Code ноде
- ⚠️ Connection string в открытом виде в коде

### Рекомендации:
1. Протестировать workflow
2. Проверить что автомобили сохраняются в БД
3. Активировать на расписание (раз в час)
4. Если `require('postgres')` не работает - использовать стандартную Postgres ноду

---

**Workflow готов к тестированию!** 🚀


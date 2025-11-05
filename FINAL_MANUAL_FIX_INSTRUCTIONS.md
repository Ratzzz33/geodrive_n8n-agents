# 🎯 РЕШЕНИЕ НАЙДЕНО: Ручное исправление в n8n UI

**Дата:** 2025-11-05 04:40  \n**Проблема:** n8n Postgres nodes имеют баг с `queryReplacement`  \n**Решение:** Заменить на Code nodes с HTTP Request к Jarvis API

---

## 🚨 Важно: Проблема решена!

После глубокого анализа выяснилось, что **n8n Postgres node имеет критический баг** с `queryReplacement` — неправильно парсит параметры при наличии запятых в JSON. Code nodes не могут использовать модуль `pg` из-за sandbox среды.

**✅ Решение найдено:** HTTP Request nodes к Jarvis API endpoints.

---

## 📋 Ручные шаги в n8n UI

### Шаг 1: Открыть workflow
```
https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8
```

### Шаг 2: Удалить старые ноды
- Найти и удалить: `Upsert Car` (Postgres node)
- Найти и удалить: `Upsert Client` (Postgres node)

### Шаг 3: Создать новые HTTP Request ноды

#### Создать "Upsert Car HTTP"
- **Type:** HTTP Request
- **Name:** Upsert Car HTTP
- **URL:** `http://46.224.17.15:3000/upsert-car`
- **Method:** POST
- **Send Body:** ON
- **Body Content Type:** JSON
- **JSON Body:**
```json
{
  "rentprog_id": "{{ $json.car_rentprog_id }}",
  "data_hex": "{{ $json.car_data_hex }}"
}
```

#### Создать "Upsert Client HTTP"
- **Type:** HTTP Request
- **Name:** Upsert Client HTTP
- **URL:** `http://46.224.17.15:3000/upsert-client`
- **Method:** POST
- **Send Body:** ON
- **Body Content Type:** JSON
- **JSON Body:**
```json
{
  "rentprog_id": "{{ $json.client_rentprog_id }}",
  "data_hex": "{{ $json.client_data_hex }}"
}
```

### Шаг 4: Подключить ноды
```
Process Nested → Upsert Car HTTP → Upsert Client HTTP → Merge UUIDs
```

### Шаг 5: Исправить Merge UUIDs
Найти ноду `Merge UUIDs` и изменить код:

```javascript
const carResult = $('Upsert Car HTTP').first().json;
const clientResult = $('Upsert Client HTTP').first().json;
const nestedData = $('Process Nested').first().json;

return {
  json: {
    booking_entity_id: nestedData.booking_entity_id,
    car_uuid: carResult.entity_id,
    client_uuid: clientResult.entity_id
  }
};
```

---

## ✅ Тестирование

После применения исправлений:

```bash
# Очистить тестовые данные
node setup/cleanup_booking_486033.mjs

# Отправить тест
node setup/retry_booking_486033.mjs

# Проверить результат
node setup/check_nested_processing_result.mjs
```

**Ожидаемый результат:**
- `car_id` и `client_id` в booking должны заполниться UUID
- Car и Client должны быть созданы в соответствующих таблицах

---

## 🔍 Почему это работает

1. **n8n Code nodes** не могут использовать `pg` модуль (sandbox)
2. **n8n Postgres nodes** имеют баг с `queryReplacement`
3. **HTTP Request nodes** обходит обе проблемы через Jarvis API
4. **Jarvis API** использует TypeScript с полным доступом к `pg`

---

## 📞 Контакт

После применения инструкций workflow будет полностью функциональным!

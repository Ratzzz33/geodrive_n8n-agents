# Включение webhook в RentProg для Service Center

## Проблема
Webhook для Service Center (company_id: 11163) **отключен** (`enabled: false`) в RentProg.

## Текущее состояние webhook:
```json
{
  "id": 40,
  "company_id": 11163,
  "url": "https://n8n.rentflow.rentals/webhook/service-center-webhook",
  "enabled": false,
  "subscriptions": [
    "booking_create", "booking_update", "booking_destroy",
    "car_create", "car_update", "car_destroy",
    "client_create", "client_update", "client_destroy"
  ]
}
```

## Решение: Включить webhook через UI RentProg

### Шаг 1: Войти в RentProg
1. Открыть: https://rentprog.net
2. Войти в компанию **Service Center** (ID: 11163)
3. Перейти в **Настройки → Интеграции → Webhooks**

### Шаг 2: Найти webhook
- **ID:** 40
- **URL:** `https://n8n.rentflow.rentals/webhook/service-center-webhook`

### Шаг 3: Включить webhook
1. Нажать "Редактировать" на webhook ID 40
2. Установить галочку **"Включен"** (Enabled)
3. Проверить что URL правильный: `https://n8n.rentflow.rentals/webhook/service-center-webhook`
4. Проверить подписки (должны быть все 9 событий):
   - ✅ booking_create
   - ✅ booking_update
   - ✅ booking_destroy
   - ✅ car_create
   - ✅ car_update
   - ✅ car_destroy
   - ✅ client_create
   - ✅ client_update
   - ✅ client_destroy
5. Сохранить изменения

### Шаг 4: Проверить работу
После включения webhook:

1. **Создать тестовое событие в RentProg** (например, изменить клиента)
2. **Проверить в n8n:**
   - URL: https://n8n.rentflow.rentals/workflow/PbDKuU06H7s2Oem8
   - Должны появиться новые executions

3. **Проверить в БД:**
   ```sql
   SELECT * FROM events 
   WHERE company_id = 11163 
   ORDER BY ts DESC 
   LIMIT 10;
   ```

## Альтернатива: Создать новый webhook

Если webhook ID 40 не работает, создать новый:

1. В RentProg: **Настройки → Интеграции → Webhooks → Создать**
2. Заполнить:
   - **URL:** `https://n8n.rentflow.rentals/webhook/service-center-webhook`
   - **Включен:** ✅
   - **События:** выбрать все 9 событий (booking/car/client: create/update/destroy)
3. Сохранить

## Проверка после включения

Запустить тестовый webhook:
```bash
node setup/test_client_update_service_center.mjs
```

Проверить результат:
```bash
node setup/check_client_in_db.mjs
```

## Важно

- **URL должен быть:** `https://n8n.rentflow.rentals/webhook/service-center-webhook`
- **НЕ:** `https://webhook.rentflow.rentals/...` (старый адрес)
- **Enabled должен быть:** `true`
- **Company ID должен быть:** 11163

## Документация RentProg API

К сожалению, управление webhooks через API не доступно для публичного токена.
Все изменения нужно делать через UI.


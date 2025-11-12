# Battery Voltage Alerts - n8n Workflow

**Дата создания:** 2025-11-12  
**Статус:** ✅ Готов к использованию

---

## 🎯 Назначение

n8n workflow для приема и обработки алертов о нестандартном падении вольтажа батареи от Jarvis API.

---

## 📋 Структура workflow

```
Webhook (POST) → Send Telegram Alert → Respond to Webhook
```

### 1. Webhook Trigger

**Путь:** `/webhook/battery-voltage-alerts`  
**Метод:** `POST`  
**Production URL:** `https://webhook.rentflow.rentals`

**Принимает:**
```json
{
  "message": "⚠️ ВНИМАНИЕ **Нестандартное падение вольтажа**\n\n🚗 **Машина:** ..."
}
```

### 2. Send Telegram Alert

**Chat ID:** `{{ $env.TELEGRAM_ALERT_CHAT_ID || '-5004140602' }}`  
**Parse Mode:** `Markdown`  
**Credentials:** `Telegram account` (ID: `1tKryXxL5Gq395nN`)

**Отправляет сообщение в Telegram чат для алертов.**

### 3. Respond to Webhook

**Response:** `{ "ok": true, "message": "Alert sent" }`

**Возвращает подтверждение отправки алерта.**

---

## 🔧 Настройка

### 1. Импорт workflow

**Через скрипт:**
```bash
node setup/import_workflow_2025.mjs n8n-workflows/battery-voltage-alerts.json
```

**Через n8n UI:**
1. Откройте https://n8n.rentflow.rentals
2. Workflows → Import from File
3. Выберите `n8n-workflows/battery-voltage-alerts.json`
4. Активируйте workflow

### 2. Проверка Webhook URL

После активации workflow, webhook URL будет:
```
https://webhook.rentflow.rentals/webhook/battery-voltage-alerts
```

**Проверка:**
```bash
curl -X POST https://webhook.rentflow.rentals/webhook/battery-voltage-alerts \
  -H "Content-Type: application/json" \
  -d '{"message": "Test alert"}'
```

### 3. Настройка переменных

**В n8n Settings → Variables:**
- `TELEGRAM_ALERT_CHAT_ID` = `-5004140602` (или ваш чат ID)

**В `.env` на сервере:**
```bash
N8N_ALERTS_URL=https://webhook.rentflow.rentals/webhook/battery-voltage-alerts
```

### 4. Проверка credentials

**В n8n Settings → Credentials:**
- Найдите "Telegram account" (ID: `1tKryXxL5Gq395nN`)
- Убедитесь, что токен бота актуален

---

## 🔄 Интеграция с Jarvis API

**Jarvis API** (`src/services/starline-monitor.ts`) отправляет алерты через:

```typescript
await sendTelegramAlert(message);
```

**Который вызывает:**
```typescript
// src/integrations/n8n.ts
await axios.post(config.n8nAlertsUrl, { message });
```

**Где `config.n8nAlertsUrl` = `N8N_ALERTS_URL` из `.env`**

---

## 📊 Примеры сообщений

### Обычное предупреждение

```
⚠️ ВНИМАНИЕ **Нестандартное падение вольтажа**

🚗 **Машина:** Toyota Camry (OC700OC)
📱 **Устройство:** Camry White ZR174ZR

📊 **Текущий вольтаж:** 11.8V
📈 **Средний по парку:** 12.5V
📉 **Отклонение:** -0.7V (-5.6%)

📋 **Статистика:**
• Образцов для сравнения: 150
• Стандартное отклонение: 0.3V

🕐 **Время:** 2025-11-12T10:30:00.000Z

💡 **Рекомендация:** Проверить состояние АКБ и генератора
```

### Критическое предупреждение

```
🔴 КРИТИЧНО **Нестандартное падение вольтажа**

🚗 **Машина:** Subaru Forester (BZ390ZB)
📱 **Устройство:** Forest Blue 390

📊 **Текущий вольтаж:** 11.2V
📈 **Средний по парку:** 12.5V
📉 **Отклонение:** -1.3V (-10.4%)
🚨 **Критическое отклонение:** ниже среднего на 2.5 стандартных отклонений

📋 **Статистика:**
• Образцов для сравнения: 150
• Стандартное отклонение: 0.3V

🕐 **Время:** 2025-11-12T10:30:00.000Z

💡 **Рекомендация:** Проверить состояние АКБ и генератора
```

---

## 🚨 Устранение неполадок

### Уведомления не приходят

1. **Проверьте, что workflow активирован:**
   - Откройте workflow в n8n UI
   - Убедитесь, что статус "Active"

2. **Проверьте Webhook URL:**
   ```bash
   curl -X POST https://webhook.rentflow.rentals/webhook/battery-voltage-alerts \
     -H "Content-Type: application/json" \
     -d '{"message": "Test"}'
   ```

3. **Проверьте переменную `N8N_ALERTS_URL`:**
   ```bash
   # На сервере
   grep N8N_ALERTS_URL .env
   docker exec jarvis-api printenv | grep N8N_ALERTS_URL
   ```

4. **Проверьте логи API:**
   ```bash
   pm2 logs jarvis-api --lines 100 | grep -i battery
   ```

5. **Проверьте credentials Telegram:**
   - В n8n Settings → Credentials
   - Убедитесь, что токен бота актуален

### Webhook не отвечает

1. **Проверьте Nginx конфигурацию:**
   ```bash
   # На сервере
   cat /etc/nginx/sites-enabled/webhook.rentflow.rentals.conf
   ```

2. **Проверьте логи n8n:**
   - В n8n UI → Executions
   - Найдите последние выполнения workflow

3. **Проверьте доступность n8n:**
   ```bash
   curl https://n8n.rentflow.rentals
   ```

---

## 📝 Тестирование

### Ручной тест через curl

```bash
curl -X POST https://webhook.rentflow.rentals/webhook/battery-voltage-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "message": "⚠️ ТЕСТ **Нестандартное падение вольтажа**\n\n🚗 **Машина:** Test Car (TEST123)\n📊 **Текущий вольтаж:** 11.5V\n📈 **Средний по парку:** 12.5V"
  }'
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "message": "Alert sent"
}
```

### Тест из Jarvis API

```bash
# На сервере
curl -X POST http://localhost:3000/starline/update-gps
```

После выполнения проверьте:
1. Telegram чат `TELEGRAM_ALERT_CHAT_ID` - должно прийти уведомление
2. n8n Executions - должно быть новое выполнение workflow

---

## 🔗 Связанные документы

- [BATTERY_VOLTAGE_MONITORING.md](./BATTERY_VOLTAGE_MONITORING.md) - Полная документация системы мониторинга
- [STARLINE_GPS_MONITOR.md](../STARLINE_GPS_MONITOR.md) - Документация GPS мониторинга

---

**Дата создания:** 2025-11-12  
**Версия:** 1.0


# Starline Routes HTML Webhook

## Описание

Workflow для получения HTML страницы с маршрутами Starline за указанный период через вебхук.

## Использование

### Endpoint

```
POST https://webhook.rentflow.rentals/webhook/starline-routes-html
```

### Параметры запроса

**Body (JSON):**
```json
{
  "deviceId": 123456,
  "dateFrom": "2025-11-01",
  "dateTo": "2025-11-11",
  "callbackUrl": "https://your-server.com/webhook/starline-result"  // Опционально
}
```

**Query параметры (альтернатива):**
```
?deviceId=123456&dateFrom=2025-11-01&dateTo=2025-11-11
```

### Параметры

- `deviceId` (number, обязательный) - ID устройства Starline
- `dateFrom` (string, обязательный) - Дата начала периода в формате `YYYY-MM-DD`
- `dateTo` (string, обязательный) - Дата конца периода в формате `YYYY-MM-DD`
- `callbackUrl` (string, опциональный) - URL для отправки результата (POST запрос с отчетом)

### Ответ

**Успешный ответ (синхронный):**
```json
{
  "ok": true,
  "url": "https://transfer.sh/starline-routes-123456-2025-11-01-2025-11-11.html",
  "fileName": "starline-routes-123456-2025-11-01-2025-11-11.html",
  "deviceId": 123456,
  "dateFrom": "2025-11-01",
  "dateTo": "2025-11-11",
  "fileSizeFormatted": "2.5 MB",
  "durationFormatted": "45.23 сек",
  "note": "Файл доступен 7 дней",
  "callbackSent": true
}
```

**Успешный ответ (на callback URL, если указан):**
```json
{
  "ok": true,
  "timestamp": "2025-11-12T15:30:00.000Z",
  "deviceId": 123456,
  "dateFrom": "2025-11-01",
  "dateTo": "2025-11-11",
  "url": "https://transfer.sh/starline-routes-123456-2025-11-01-2025-11-11.html",
  "fileName": "starline-routes-123456-2025-11-01-2025-11-11.html",
  "fileSize": 2621440,
  "fileSizeFormatted": "2.5 MB",
  "duration": 45230,
  "durationFormatted": "45.23 сек",
  "note": "Файл доступен 7 дней",
  "steps": [
    {
      "step": "Получение HTML страницы",
      "status": "success",
      "duration": "~27138 мс"
    },
    {
      "step": "Загрузка на transfer.sh",
      "status": "success",
      "duration": "~18092 мс"
    }
  ]
}
```

**Ошибка:**
```json
{
  "ok": false,
  "error": "Error message",
  "deviceId": 123456,
  "dateFrom": "2025-11-01",
  "dateTo": "2025-11-11"
}
```

## Архитектура

### Workflow структура

1. **Webhook** - Принимает POST запрос с параметрами (`deviceId`, `dateFrom`, `dateTo`, `callbackUrl`)
2. **Get Routes HTML** - HTTP Request к API `/starline/routes-html` для получения HTML страницы
3. **Check Success** - Проверяет успешность запроса
4. **Prepare File Data** - Конвертирует HTML в binary формат, сохраняет размер файла и время начала
5. **Upload to transfer.sh** - Загружает HTML файл на бесплатный хостинг transfer.sh
6. **Check Upload Success** - Проверяет успешность загрузки
7. **Prepare Report** - Формирует подробный отчет о проделанной работе (размер файла, время выполнения, шаги)
8. **Check Callback URL** - Проверяет наличие callback URL
9. **Send Callback** - Отправляет результат на callback URL (если указан)
10. **Respond to Webhook** - Отправляет синхронный ответ на вебхук
11. **Prepare Error Report** / **Send Error Callback** - Обработка ошибок с отправкой на callback (если указан)

### API Endpoint

**POST** `/starline/routes-html`

Использует `StarlineScraperService.getRoutesHTML()` для:
1. Логина на сайте Starline (если не залогинен)
2. Выбора устройства по `deviceId`
3. Установки периода через календарь
4. Получения HTML страницы с маршрутами

### Обработка ошибок

- При ошибке API возвращается JSON с описанием ошибки
- Временный файл удаляется даже при ошибке (через "Delete File On Error")
- Все ошибки логируются в n8n

## Пример использования

### cURL

```bash
# Базовый запрос
curl -X POST https://webhook.rentflow.rentals/webhook/starline-routes-html \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": 123456,
    "dateFrom": "2025-11-01",
    "dateTo": "2025-11-11"
  }'

# С callback URL (результат будет отправлен на указанный адрес)
curl -X POST https://webhook.rentflow.rentals/webhook/starline-routes-html \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": 123456,
    "dateFrom": "2025-11-01",
    "dateTo": "2025-11-11",
    "callbackUrl": "https://your-server.com/webhook/starline-result"
  }'
```

### JavaScript/Node.js

```javascript
const response = await fetch('https://webhook.rentflow.rentals/webhook/starline-routes-html', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceId: 123456,
    dateFrom: '2025-11-01',
    dateTo: '2025-11-11'
  })
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `starline-routes-123456-2025-11-01-2025-11-11.html`;
  a.click();
} else {
  const error = await response.json();
  console.error('Error:', error);
}
```

### Python

```python
import requests

response = requests.post(
    'https://webhook.rentflow.rentals/webhook/starline-routes-html',
    json={
        'deviceId': 123456,
        'dateFrom': '2025-11-01',
        'dateTo': '2025-11-11'
    }
)

if response.status_code == 200:
    with open('routes.html', 'wb') as f:
        f.write(response.content)
    print('File saved successfully')
else:
    print('Error:', response.json())
```

## Callback URL

Если указан `callbackUrl`, workflow отправит результат на указанный адрес **POST запросом** с полным отчетом:

- ✅ **Успешный результат**: содержит URL файла, размер, время выполнения, шаги
- ❌ **Ошибка**: содержит описание ошибки и детали

**Преимущества callback:**
- Асинхронная обработка (не нужно ждать ответа)
- Подробный отчет о работе
- Автоматическая отправка результата на ваш сервер

**Пример обработки callback на вашем сервере:**
```javascript
app.post('/webhook/starline-result', async (req, res) => {
  const { ok, url, fileName, fileSizeFormatted, durationFormatted, steps } = req.body;
  
  if (ok) {
    console.log(`✅ Файл готов: ${url}`);
    console.log(`📊 Размер: ${fileSizeFormatted}, Время: ${durationFormatted}`);
    // Обработка успешного результата
  } else {
    console.error(`❌ Ошибка: ${req.body.error}`);
    // Обработка ошибки
  }
  
  res.json({ received: true });
});
```

## Ограничения

- Таймаут запроса: 120 секунд (2 минуты)
- Максимальный размер HTML: ограничен памятью n8n
- Файлы хранятся на transfer.sh 7 дней
- Одновременные запросы обрабатываются последовательно (ограничение Playwright)
- Callback URL должен быть доступен из интернета

## Troubleshooting

### Ошибка: "Device not found"
- Проверьте правильность `deviceId`
- Убедитесь, что устройство доступно в аккаунте Starline

### Ошибка: "Invalid date format"
- Используйте формат `YYYY-MM-DD` (например, `2025-11-01`)
- Проверьте, что даты валидны

### Ошибка: "Timeout"
- Увеличьте таймаут в workflow (текущий: 120 секунд)
- Проверьте доступность API сервера

### Ошибка: "Login failed"
- Проверьте переменные окружения `STARLINE_USERNAME` и `STARLINE_PASSWORD`
- Убедитесь, что аккаунт Starline активен

## Примечания

- HTML файл содержит полную страницу с маршрутами, включая карту и список поездок
- Файл можно открыть в браузере для просмотра
- Для парсинга данных из HTML используйте соответствующие библиотеки (BeautifulSoup, Cheerio и т.д.)

